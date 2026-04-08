from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Tuple
import psycopg

from routers.traffic import tracker
from services import cache_service, campus_hub_service, place_registry_service
from repositories import feed_repository
from db_config import CONNECTION_PARAMS


HOT_COLOR = "#FF6B57"
ACTIVE_COLOR = "#FFB347"
BUBBLING_COLOR = "#5ACD7C"
BOOSTED_GOLD_COLOR = "#F5B301"
PULSE_SNAPSHOT_TTL_SECONDS = 60
PULSE_CACHE_LIMITS: Tuple[int, ...] = (8, 12, 25)


def _parse_iso(iso_value: str | None) -> datetime | None:
    if not iso_value:
        return None
    try:
        parsed = datetime.fromisoformat(str(iso_value).replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            return parsed.replace(tzinfo=timezone.utc)
        return parsed
    except ValueError:
        return None


def _format_time_label(iso_value: str) -> str:
    target = _parse_iso(iso_value)
    if not target:
        return "Soon"

    now = datetime.now(timezone.utc)
    diff_hours = (target - now).total_seconds() / 3600
    local_time = target.astimezone()

    if -1.5 <= diff_hours <= 1:
        return "Now"
    if local_time.date() == now.astimezone().date():
        return local_time.strftime("Today · %I:%M %p").replace("· 0", "· ")

    tomorrow = now.astimezone().date() + timedelta(days=1)
    if local_time.date() == tomorrow:
        return local_time.strftime("Tomorrow · %#I:%M %p")
        return local_time.strftime("Tomorrow · %#I:%M %p")

    return local_time.strftime("%b %#d · %#I:%M %p")
    return local_time.strftime("%b %#d · %#I:%M %p")


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


def _build_summary(location_name: str, ping_count: int, event_count: int, percent_full: int | None) -> str:
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


def _load_admin_events() -> List[Dict[str, Any]]:
    try:
        with psycopg.connect(CONNECTION_PARAMS) as conn:
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
                        app.organization_name
                    FROM admin_events e
                    LEFT JOIN admin_applications app ON app.clerk_id = e.clerk_id
                    WHERE COALESCE(e.end_time, e.start_time + interval '6 hours') >= NOW() - interval '18 hours'
                    ORDER BY e.start_time ASC
                    """
                )
                return cur.fetchall()
    except Exception as exc:
        if isinstance(exc, psycopg.errors.UndefinedTable):
            return []
        print(f"[pulse_service] failed to load admin events: {exc}")
        return []


def _load_occupancy_by_place() -> Dict[str, int]:
    try:
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
    for limit in PULSE_CACHE_LIMITS:
        cache_service.delete(f"campus:pulse:map:v2:{limit}")


def get_pulse_map(limit: int = 12) -> Dict[str, Any]:
    cache_key = f"campus:pulse:map:v2:{limit}"
    cached = cache_service.get_json(cache_key)
    if cached is not None:
        return cached

    try:
        campus_hub_service._ensure_social_tables()
    except Exception as exc:
        print(f"[pulse_service] failed to ensure social tables: {exc}")

    try:
        raw_pings = feed_repository.get_crowdping_feed(post_types=["ping", "post"], limit=80)
        pings = [ping for ping in raw_pings if _is_pulse_ping_post(ping)]
    except Exception as exc:
        print(f"[pulse_service] DB query failed for crowdping feed: {exc}")
        pings = []

    post_ids = [p["id"] for p in pings]
    try:
        interactions = feed_repository.get_batch_interaction_counts(post_ids) if post_ids else {}
    except Exception as exc:
        print(f"[pulse_service] DB query failed for interaction counts: {exc}")
        interactions = {}

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
        place = None

        # Resolve place_id: check custom_data first, then try location_tag fallback
        place_id = custom.get("place_id") or None
        location_tag = ping.get("location_tag") or ""
        lat = ping.get("lat")
        lng = ping.get("lng")

        if not place_id:
            if location_tag and lat is not None and lng is not None:
                # Synthetic place for non-campus snaps (allows off-campus pings to be seen)
                place = {
                    "place_id": f"geo:{location_tag.lower().replace(' ', '-')}",
                    "name": location_tag,
                    "lat": lat,
                    "lng": lng
                }
                place_id = place["place_id"]
            else:
                continue

        place = place or place_registry_service.get_place_by_id(place_id)
        if not place:
            continue

        category = str(custom.get("ping_category") or ping.get("post_type") or "Popup")
        start_at = str(custom.get("start_at") or ping.get("created_at") or datetime.now(timezone.utc).isoformat())

        target_time = _parse_iso(start_at)
        if target_time:
            dh = (target_time - datetime.now(timezone.utc)).total_seconds() / 3600
            if dh < -18 or dh > 72:
                continue
        else:
            print(f"[pulse_service] Warning: Failed to parse start_at for ping {ping_id} ({start_at})")
            continue  # Don't show pings with invalid dates!

        counts = interactions.get(ping_id, {})
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
        
        print(f"[pulse_service] Including ping: {ping_id} (Date: {start_at}, Weight: {weight}, Category: {category})")

        group = ensure_group(place_id, place["name"], {"lat": place["lat"], "lng": place["lng"]})
        group["score"] += weight
        group["pingCount"] += 1
        group["categoryWeights"][category] = group["categoryWeights"].get(category, 0) + weight
        group["items"].append(
            {
                "id": ping_id,
                "source": "ping",
                "title": custom.get("ping_title") or ping.get("content") or "Campus Ping",
                "subtitle": custom.get("user_name") or ping.get("user_name") or "Aggie",
                "category": category,
                "timeLabel": _format_time_label(start_at),
                "startAt": start_at,
                "link": None,
                "imageUrl": ping.get("image_url") or custom.get("image_url") or (ping.get("media_urls") and ping.get("media_urls")[0] if ping.get("media_urls") else None) or (ping.get("images") and ping.get("images")[0] if ping.get("images") else None),
                "upvotes": upvote_count,
                "downvotes": downvote_count,
                "itemScore": item_score,
                "userVote": 0 # userVote can be mapped client-side or handled dynamically
            }
        )

    for event in _load_admin_events():
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
        if score < 8:
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
                "is_live": True,
                "percent_full": 0,
                "available_seats": None
            }

        hotspots.append(
            {
                "id": f"hotspot-{place_id}",
                "placeId": place_id,
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
                "items": sorted(group["items"], key=lambda item: item["startAt"])[:6],
                "place": place_registry_service.serialize_place(resolved_place) if resolved_place else None,
            }
        )

    hotspots.sort(key=lambda hotspot: hotspot["score"], reverse=True)
    ordered_hotspots = hotspots[:limit]
    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "stale_after": PULSE_SNAPSHOT_TTL_SECONDS,
        "source_status": "live" if ordered_hotspots else "preview",
        "hotspots": ordered_hotspots,
    }
    cache_service.set_json(cache_key, payload, PULSE_SNAPSHOT_TTL_SECONDS)
    return payload
