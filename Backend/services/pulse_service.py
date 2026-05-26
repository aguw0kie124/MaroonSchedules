from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple
import math
import psycopg

from services import cache_service, campus_hub_service, place_registry_service, tag_access_service
from repositories import feed_repository, tag_repository, user_repository
from db_config import CONNECTION_PARAMS


HOT_COLOR = "#FF6B57"
ACTIVE_COLOR = "#FFB347"
BUBBLING_COLOR = "#5ACD7C"
BOOSTED_GOLD_COLOR = "#F5B301"
PULSE_CACHE_LIMITS: Tuple[int, ...] = tuple(range(1, 251))


def _parse_iso(iso_value: Optional[str]) -> Optional[datetime]:
    if not iso_value:
        return None
    try:
        parsed = datetime.fromisoformat(str(iso_value).replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            return parsed.replace(tzinfo=timezone.utc)
        return parsed
    except ValueError:
        return None


def _copy_place(place: Optional[Dict[str, Any]], *, name: Optional[str] = None) -> Optional[Dict[str, Any]]:
    if not place:
        return None
    copied = dict(place)
    if name:
        copied["name"] = name
    return copied


def _format_clock_time(value: datetime) -> str:
    return value.strftime("%I:%M %p").lstrip("0")


def _format_month_day(value: datetime) -> str:
    return f"{value.strftime('%b')} {value.day}"


def _format_time_label(iso_value: str) -> str:
    target = _parse_iso(iso_value)
    if not target:
        return "Soon"

    now = datetime.now(timezone.utc)
    diff_hours = (target - now).total_seconds() / 3600
    local_time = target.astimezone()
    local_now = now.astimezone()

    if -1.5 <= diff_hours <= 1:
        return "Now"
    if local_time.date() == local_now.date():
        return f"Today · {_format_clock_time(local_time)}"

    tomorrow = local_now.date() + timedelta(days=1)
    if local_time.date() == tomorrow:
        return f"Tomorrow · {_format_clock_time(local_time)}"

    return f"{_format_month_day(local_time)} · {_format_clock_time(local_time)}"


def _recency_weight(iso_value: str) -> float:
    target = _parse_iso(iso_value)
    if not target:
        return 0.18

    now = datetime.now(timezone.utc)
    diff_hours = (target - now).total_seconds() / 3600
    if -2 <= diff_hours <= 1:
        return 1.0
    if -6 <= diff_hours <= 4:
        return 0.85
    if -12 <= diff_hours <= 14:
        return 0.65
    if -18 <= diff_hours <= 36:
        return 0.42
    return 0.18


def _ping_category_boost(category: str) -> int:
    normalized = category.lower()
    if "free food" in normalized:
        return 7
    if "show" in normalized or "sports" in normalized:
        return 6
    if "hangout" in normalized or "popup" in normalized:
        return 5
    return 3


def _haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371000.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    delta_phi, delta_lambda = math.radians(lat2 - lat1), math.radians(lon2 - lon1)
    a = math.sin(delta_phi / 2.0)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0)**2
    return R * (2 * math.atan2(math.sqrt(a), math.sqrt(1 - a)))


def _is_pulse_ping_post(ping: Dict[str, Any]) -> bool:
    custom = ping.get("custom_data") or {}
    post_type = str(ping.get("post_type") or "").strip().lower()
    content_type = str(custom.get("content_type") or "").strip().lower()

    if post_type == "ping":
        return True
    if content_type == "ping":
        return True
    if custom.get("ping_title") or custom.get("ping_category"):
        return True
    return False


def _pulse_label_for(score: int) -> str:
    if score >= 60:
        return "Hot"
    if score >= 34:
        return "Active"
    return "Bubbling"


def _pulse_color_for(score: int) -> str:
    if score >= 60:
        return HOT_COLOR
    if score >= 34:
        return ACTIVE_COLOR
    return BUBBLING_COLOR


def _build_summary(location_name: str, ping_count: int, event_count: int, percent_full: Optional[int]) -> str:
    parts: List[str] = []
    if ping_count > 0:
        parts.append(f"{ping_count} live ping{'s' if ping_count != 1 else ''}")
    if event_count > 0:
        parts.append(f"{event_count} featured event{'s' if event_count != 1 else ''}")
    if percent_full is not None and percent_full >= 50:
        parts.append(f"{percent_full}% full nearby")
    if not parts:
        return f"{location_name} is picking up."
    return f"{location_name} has {' · '.join(parts)}."


def _coerce_access_tags(value: Any) -> List[str]:
    if isinstance(value, str):
        return [value]
    if isinstance(value, (list, tuple, set)):
        return [str(entry) for entry in value if entry]
    return []


def _resolve_access_scope(clerk_id: Optional[str]) -> tuple[List[str], bool]:
    if not clerk_id:
        return [], False

    profile = user_repository.get_user(clerk_id) or {}
    try:
        user_tags = tag_repository.get_user_tags(clerk_id)
    except Exception as exc:
        print(f"[pulse_service] failed to load user tags for {clerk_id}: {exc}")
        user_tags = []
    return user_tags, bool(profile.get("is_admin"))


def _load_admin_events() -> List[Dict[str, Any]]:
    try:
        with psycopg.connect(CONNECTION_PARAMS) as conn:
            tag_repository._ensure_access_dependencies(conn)
            with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
                cur.execute(
                    """
                    SELECT
                        e.id,
                        e.title,
                        e.location_name,
                        e.lat,
                        e.lng,
                        e.start_time,
                        e.end_time,
                        e.image_url,
                        COALESCE(
                            (
                                SELECT json_agg(t.label ORDER BY t.label)
                                FROM event_tags et
                                JOIN tags t ON t.id = et.tag_id
                                WHERE et.event_id = e.id::TEXT
                            ),
                            '[]'::json
                        ) AS access_tags,
                        app.organization_name
                    FROM admin_events e
                    LEFT JOIN admin_applications app ON app.clerk_id = e.clerk_id
                    WHERE COALESCE(e.end_time, e.start_time + interval '6 hours') >= NOW() - interval '18 hours'
                    ORDER BY e.start_time ASC
                    """
                )
                rows = cur.fetchall()
                return rows
    except Exception as exc:
        if isinstance(exc, psycopg.errors.UndefinedTable):
            return []
        print(f"[pulse_service] failed to load admin events: {exc}")
        return []


def _load_occupancy_by_place() -> Dict[str, int]:
    try:
        from routers.traffic import tracker
        locations = tracker.get_all_locations_with_events()
    except Exception as exc:
        print(f"[pulse_service] failed to load traffic occupancy: {exc}")
        return {}

    occupancy: Dict[str, int] = {}
    for row in locations:
        place = place_registry_service.resolve_place(
            row.get("location"),
            (row.get("coord") or {}).get("lat"),
            (row.get("coord") or {}).get("lng"),
        )
        if not place:
            continue
        percent_full = row.get("percent_full")
        if percent_full is None:
            continue
        occupancy[place["place_id"]] = int(percent_full)
    return occupancy


def invalidate_pulse_map_cache() -> None:
    keys = [f"campus:pulse:map:v2:{limit}" for limit in PULSE_CACHE_LIMITS]
    if hasattr(cache_service, 'delete_many'):
        cache_service.delete_many(keys)
    else:
        for limit in PULSE_CACHE_LIMITS:
            cache_service.delete(f"campus:pulse:map:v2:{limit}")


def get_pulse_map(limit: int = 60, clerk_id: Optional[str] = None, force_refresh: bool = False) -> Dict[str, Any]:
    if force_refresh and not clerk_id:
        cache_service.delete(f"campus:pulse:map:v2:{limit}")

    user_access_tags, bypass_access_restrictions = _resolve_access_scope(clerk_id)

    status = "live"
    try:
        campus_hub_service._ensure_social_tables()
    except Exception as exc:
        print(f"[pulse_service] failed to ensure social tables: {exc}")
        status = "error"

    try:
        import psycopg
    except ModuleNotFoundError:
        print("[pulse_service] CRITICAL: psycopg driver missing")
        return {
            "status": "driver_missing",
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "hotspots": [],
            "source_status": "disconnected"
        }
    
    try:
        raw_pings = feed_repository.get_crowdping_feed(post_types=["ping", "post"], limit=500)
        pings = [
            ping
            for ping in raw_pings
            if _is_pulse_ping_post(ping)
            and tag_access_service.has_matching_access_tag(
                user_tags=user_access_tags,
                access_tags=_coerce_access_tags((ping.get("custom_data") or {}).get("access_tags")),
                bypass_restrictions=bypass_access_restrictions,
            )
        ]
    except Exception as exc:
        print(f"[pulse_service] DB query failed for crowdping feed: {exc}")
        pings = []
        status = "error"

    post_ids = [p["id"] for p in pings]
    try:
        interactions = feed_repository.get_batch_interaction_counts(post_ids) if post_ids else {}
    except Exception as exc:
        print(f"[pulse_service] DB query failed for interaction counts: {exc}")
        interactions = {}

    try:
        user_reactions = (
            feed_repository.get_user_interactions_batch(clerk_id, post_ids)
            if clerk_id and post_ids
            else {}
        )
    except Exception as exc:
        print(f"[pulse_service] DB query failed for user reactions: {exc}")
        user_reactions = {}

    try:
        occupancy_by_place = _load_occupancy_by_place()
    except Exception as exc:
        print(f"[pulse_service] occupancy load failed: {exc}")
        occupancy_by_place = {}

    grouped: Dict[str, Dict[str, Any]] = {}

    def ensure_group(place_id: str, location_name: str, coord: Dict[str, float]) -> Dict[str, Any]:
        if place_id not in grouped:
            grouped[place_id] = {
                "placeId": place_id,
                "locationName": location_name,
                "coord": coord,
                "score": 0.0,
                "pingCount": 0,
                "eventCount": 0,
                "boosted": False,
                "categoryWeights": {},
                "items": [],
            }
        return grouped[place_id]

    for ping in pings:
        ping_id = ping["id"]
        custom = ping.get("custom_data") or {}
        
        # Robust extraction from both top-level columns and custom metadata
        place_id = ping.get("place_id") or custom.get("place_id")
        location_tag = (
            ping.get("location_tag")
            or custom.get("location_tag")
            or custom.get("place_name")
        )
        
        lat = ping.get("lat") or custom.get("lat") or custom.get("place_lat") or custom.get("location_lat")
        lng = ping.get("lng") or custom.get("lng") or custom.get("place_lng") or custom.get("location_lng")

        place = None
        if place_id:
             place = _copy_place(place_registry_service.get_place_by_id(place_id))
        
        if not place and location_tag:
             # Fallback: resolve using the building name
             place = _copy_place(place_registry_service.resolve_place(location_tag, lat, lng))

        # 2. If no campus building, but we have geographic coordinates, create a synthetic place (or cluster with nearby)
        if not place and lat is not None and lng is not None:
            fl_lat, fl_lng = float(lat), float(lng)
            
            nearby_place = None
            for g_place_id, g_group in grouped.items():
                if g_place_id.startswith("geo:"):
                    dist = _haversine_distance(fl_lat, fl_lng, g_group["coord"]["lat"], g_group["coord"]["lng"])
                    if dist <= 120.0:  # 120 meters cluster radius
                        nearby_place = {
                            "place_id": g_place_id,
                            "name": g_group["locationName"],
                            "lat": g_group["coord"]["lat"],
                            "lng": g_group["coord"]["lng"],
                            "is_synthetic": True
                        }
                        break
            
            if nearby_place:
                place = nearby_place
            else:
                # We use a synthetic place ID for coordinates outside the registry
                place_id = f"geo:{location_tag.lower().replace(' ', '-') if location_tag else 'ping'}:{fl_lat}:{fl_lng}"
                place = {
                    "place_id": place_id,
                    "name": location_tag or "Current Location",
                    "lat": fl_lat,
                    "lng": fl_lng,
                    "is_synthetic": True
                }
        
        # 3. Last fallback: MSC (just to ensure it's not discarded if it's on campus without a match)
        if not place and location_tag:
             place = _copy_place(
                 place_registry_service.resolve_place("Memorial Student Center", None, None),
                 name=location_tag,
             )
             if place:
                 place["is_fallback"] = True
        
        # FINAL SAFETY: If still no place (no tag, no GPS), default to MSC just to keep markers visible
        if not place:
             fallback_name = location_tag or custom.get("place_name") or "Campus"
             place = _copy_place(place_registry_service.get_place_by_id("MSC"), name=fallback_name)
             if not place:
                 place = _copy_place(
                     place_registry_service.resolve_place("Memorial Student Center", None, None),
                     name=fallback_name,
                 )
             if place:
                 place["is_fallback"] = True
        
        if not place:
            print(f"[pulse_service] Discarding ping {ping_id}: No location or fallback possible.")
            continue
        
        # Update IDs to match the resolved place
        place_id = place.get("place_id") or place.get("id")
        
        if not place_id:
            continue

        category = str(custom.get("ping_category") or ping.get("post_type") or "Popup")
        start_at = str(custom.get("start_at") or ping.get("created_at") or datetime.now(timezone.utc).isoformat())

        end_at = str(custom.get("end_at") or "")
        end_time = _parse_iso(end_at)
        target_time = _parse_iso(start_at)

        if end_time:
            if datetime.now(timezone.utc) > end_time:
                continue
        elif target_time:
            age_hours = (datetime.now(timezone.utc) - target_time).total_seconds() / 3600
            if age_hours > 3:
                continue

        counts = interactions.get(ping_id, {})
        own_reactions = user_reactions.get(ping_id, {})
        upvote_count = int(counts.get("upvote") or counts.get("like") or 0)
        downvote_count = int(counts.get("downvote") or 0)
        item_score = upvote_count - downvote_count
        comment_count = int(counts.get("comment") or 0)

        weight = (
            14 * _recency_weight(start_at)
            + min(6, upvote_count * 0.8)
            + min(4, comment_count * 0.7)
            + _ping_category_boost(category)
        )

        # Boost off-campus pings to verify they show up even when campus is active
        if place.get("is_synthetic"):
            weight += 15
        
        
        # Logic processing...

        group = ensure_group(place_id, place["name"], {"lat": place["lat"], "lng": place["lng"]})
        group["score"] += weight
        group["pingCount"] += 1
        group["categoryWeights"][category] = group["categoryWeights"].get(category, 0) + weight
        group["items"].append(
            {
                "id": ping_id,
                "source": "ping",
                "title": custom.get("ping_title") or ping.get("content") or "Campus Ping",
                "subtitle": "Anonymous" if custom.get("is_anonymous") else (custom.get("user_name") or ping.get("user_name") or "Aggie"),
                "body": ping.get("content") or "",
                "category": category,
                "timeLabel": _format_time_label(start_at),
                "startAt": start_at,
                "link": None,
                "activityId": ping_id,
                "locationTag": place["name"],
                "imageUrl": ping.get("image_url") or custom.get("image_url") or (ping.get("media_urls") and ping.get("media_urls")[0] if ping.get("media_urls") else None) or (ping.get("images") and ping.get("images")[0] if ping.get("images") else None),
                "upvotes": upvote_count,
                "downvotes": downvote_count,
                "commentCount": comment_count,
                "itemScore": item_score,
                "userVote": 1 if own_reactions.get("upvote") else (-1 if own_reactions.get("downvote") else 0),
            }
        )

    for event in _load_admin_events():
        if not tag_access_service.has_matching_access_tag(
            user_tags=user_access_tags,
            access_tags=_coerce_access_tags(event.get("access_tags")),
            bypass_restrictions=bypass_access_restrictions,
        ):
            continue

        start_at = event["start_time"].isoformat() if event.get("start_time") else datetime.now(timezone.utc).isoformat()
        target_time = _parse_iso(start_at)
        if target_time:
            dh = (target_time - datetime.now(timezone.utc)).total_seconds() / 3600
            if dh < -18 or dh > 72:
                continue

        resolved_place = place_registry_service.resolve_place(
            event.get("location_name"),
            event.get("lat"),
            event.get("lng"),
        )
        boosted = False
        if not resolved_place:
            resolved_place = place_registry_service.resolve_place("Memorial Student Center", None, None)
            boosted = True

        if not resolved_place:
            continue

        group = ensure_group(
            resolved_place["place_id"],
            resolved_place["name"],
            {"lat": resolved_place["lat"], "lng": resolved_place["lng"]},
        )
        weight = 18 * _recency_weight(start_at) + 12
        if boosted:
            weight += 10
            group["boosted"] = True
        group["score"] += weight
        group["eventCount"] += 1
        group["categoryWeights"]["Featured Event"] = group["categoryWeights"].get("Featured Event", 0) + weight
        group["items"].append(
            {
                "id": str(event["id"]),
                "source": "event",
                "title": event.get("title") or "Featured Event",
                "subtitle": event.get("organization_name") or "Campus organizer",
                "category": "Featured Event",
                "timeLabel": _format_time_label(start_at),
                "startAt": start_at,
                "link": None,
                "imageUrl": event.get("image_url"),
                "upvotes": 0,
                "downvotes": 0,
                "itemScore": 0,
                "userVote": 0
            }
        )

    hotspots: List[Dict[str, Any]] = []
    for place_id, group in grouped.items():
        percent_full = occupancy_by_place.get(place_id)
        occupancy_boost = min(14, (percent_full - 15) * 0.18) if percent_full is not None and percent_full > 15 else 0
        score = round(group["score"] + occupancy_boost)
        # Aggressive restoration: no minimum score required
        if False and score < 1:
            continue

        dominant_category = sorted(
            group["categoryWeights"].items(),
            key=lambda entry: entry[1],
            reverse=True,
        )[0][0] if group["categoryWeights"] else "Campus"

        # Resolution for Frontend CampusLocation model
        resolved_place = place_registry_service.get_place_by_id(place_id)
        if not resolved_place and place_id.startswith("geo:"):
            resolved_place = {
                "place_id": place_id,
                "name": group["locationName"],
                "lat": group["coord"]["lat"],
                "lng": group["coord"]["lng"],
                "type": "General",
                "coord": group["coord"],
                "is_live": True,
                "percent_full": 0,
                "available_seats": None
            }

        # Sanitize place_id for frontend layer compatibility (remove colons/dots)
        safe_place_id = str(place_id).replace(":", "-").replace(".", "_")
        hotspots.append(
            {
                "id": f"hotspot-{safe_place_id}",
                "place_id": place_id,
                "locationName": group["locationName"],
                "coord": group["coord"],
                "score": score,
                "pulseLabel": "Hot" if group.get("boosted") else _pulse_label_for(score),
                "pulseColor": BOOSTED_GOLD_COLOR if group.get("boosted") else _pulse_color_for(score),
                "radius": 110 + min(score, 80) * 3.2,
                "pingCount": group["pingCount"],
                "eventCount": group["eventCount"],
                "percentFull": percent_full,
                "dominantCategory": dominant_category,
                "previewLabel": (
                    f"{group['pingCount']} pings · {group['eventCount']} events"
                    if group["pingCount"] > 0 and group["eventCount"] > 0
                    else f"{group['pingCount']} live pings"
                    if group["pingCount"] > 0
                    else f"{group['eventCount']} featured events"
                ),
                "summary": _build_summary(
                    group["locationName"],
                    group["pingCount"],
                    group["eventCount"],
                    percent_full,
                ),
                "items": sorted(
                    group["items"],
                    key=lambda item: (
                        0 if item["source"] == "ping" else 1,
                        -int(item.get("itemScore") or 0),
                        -int(item.get("commentCount") or 0),
                        item.get("startAt") or "",
                    ),
                )[:6],
                "place": place_registry_service.serialize_place(resolved_place) if resolved_place else None,
            }
        )

    hotspots.sort(key=lambda hotspot: hotspot["score"], reverse=True)
    ordered_hotspots = hotspots[:limit]
    payload = {
        "status": status,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "hotspots": ordered_hotspots,
    }
    return payload
