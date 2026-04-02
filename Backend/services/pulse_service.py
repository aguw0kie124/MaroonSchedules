from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Tuple

from routers.traffic import tracker
from services import cache_service, place_registry_service
from repositories import feed_repository


HOT_COLOR = "#FF6B57"
ACTIVE_COLOR = "#FFB347"
BUBBLING_COLOR = "#5ACD7C"
PULSE_SNAPSHOT_TTL_SECONDS = 60


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


def get_pulse_map(limit: int = 12) -> Dict[str, Any]:
    cache_key = f"campus:pulse:map:v1:{limit}"
    cached = cache_service.get_json(cache_key)
    if cached is not None:
        return cached

    try:
        pings = feed_repository.get_crowdping_feed(limit=80)
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
                "categoryWeights": {},
                "items": [],
            }
        return grouped[place_id]

    for ping in pings:
        ping_id = ping["id"]
        custom = ping.get("custom_data") or {}

        # Resolve place_id: check custom_data first, then try location_tag fallback
        place_id = custom.get("place_id") or None
        location_tag = ping.get("location_tag") or ""
        lat = ping.get("lat")
        lng = ping.get("lng")

        if not place_id and location_tag:
            resolved = place_registry_service.resolve_place(location_tag, lat, lng)
            if resolved:
                place_id = resolved["place_id"]

        if not place_id:
            continue

        place = place_registry_service.get_place_by_id(place_id)
        if not place:
            continue

        category = str(custom.get("ping_category") or ping.get("post_type") or "Popup")
        start_at = str(custom.get("start_at") or ping.get("created_at") or datetime.now(timezone.utc).isoformat())

        counts = interactions.get(ping_id, {})
        like_count = int(counts.get("like") or counts.get("upvote") or 0)
        comment_count = int(counts.get("comment") or 0)

        weight = (
            14 * _recency_weight(start_at)
            + min(6, like_count * 0.8)
            + min(4, comment_count * 0.7)
            + _ping_category_boost(category)
        )

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

        hotspots.append(
            {
                "id": f"hotspot-{place_id}",
                "placeId": place_id,
                "locationName": group["locationName"],
                "coord": group["coord"],
                "score": score,
                "pulseLabel": _pulse_label_for(score),
                "pulseColor": _pulse_color_for(score),
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
                "place": place_registry_service.serialize_place(place_registry_service.get_place_by_id(place_id)),
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
