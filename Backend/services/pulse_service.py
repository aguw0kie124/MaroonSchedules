from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Tuple

from routers.traffic import tracker
from services import campus_events_service, ping_service, place_registry_service


HOT_COLOR = "#FF6B57"
ACTIVE_COLOR = "#FFB347"
BUBBLING_COLOR = "#5ACD7C"


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


def _event_category(event: Dict[str, Any]) -> str:
    categories = event.get("categories") or {}
    if categories.get("food"):
        return "Free Food"
    if categories.get("sports"):
        return "Sports"
    if categories.get("entertainment"):
        return "Show"
    if categories.get("social"):
        return "Hangout"
    if categories.get("academic"):
        return "Study"
    return "Event"


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


def _eligible_events(limit: int) -> List[Dict[str, Any]]:
    now = datetime.now(timezone.utc)
    events = campus_events_service.load_campus_events()
    filtered: List[Dict[str, Any]] = []
    for event in events:
        start_time = _parse_iso(event.get("start_time"))
        if not start_time or not event.get("place_id"):
            continue

        interest_score = int(event.get("campus_interest_score") or 40)
        categories = event.get("categories") or {}
        has_high_signal = (
            interest_score >= 48
            or categories.get("sports")
            or categories.get("food")
            or categories.get("entertainment")
            or categories.get("social")
        )
        if not has_high_signal:
            continue

        if not (now - timedelta(hours=8) <= start_time <= now + timedelta(hours=48)):
            continue
        filtered.append(event)

    return filtered[:limit]


def get_pulse_map(limit: int = 12) -> List[Dict[str, Any]]:
    pings = ping_service.get_campus_ping_activities(limit=80)
    events = _eligible_events(limit=80)
    occupancy_by_place = _load_occupancy_by_place()

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
        custom = ping.get("custom") or {}
        place_id = custom.get("place_id")
        if not place_id:
            continue
        place = place_registry_service.get_place_by_id(place_id)
        if not place:
            continue

        category = str(custom.get("ping_category") or "Popup")
        start_at = str(custom.get("start_at") or ping.get("time") or datetime.now(timezone.utc).isoformat())
        like_count = int((ping.get("reaction_counts") or {}).get("like") or ping.get("reaction_count") or 0)
        comment_count = int((ping.get("reaction_counts") or {}).get("comment") or 0)
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
                "id": ping.get("id") or f"ping:{place_id}:{len(group['items'])}",
                "source": "ping",
                "title": custom.get("ping_title") or "Campus Ping",
                "subtitle": custom.get("user_name") or "Aggie",
                "category": category,
                "timeLabel": _format_time_label(start_at),
                "startAt": start_at,
                "link": None,
            }
        )

    for event in events:
        place_id = event.get("place_id")
        place = place_registry_service.get_place_by_id(place_id)
        if not place:
            continue

        category = _event_category(event)
        start_at = str(event.get("start_time"))
        weight = 18 * _recency_weight(start_at) + min(12, (int(event.get("campus_interest_score") or 40)) / 8)

        group = ensure_group(place_id, place["name"], {"lat": place["lat"], "lng": place["lng"]})
        group["score"] += weight
        group["eventCount"] += 1
        group["categoryWeights"][category] = group["categoryWeights"].get(category, 0) + weight
        group["items"].append(
            {
                "id": str(event.get("event_id")),
                "source": "event",
                "title": event.get("title") or "Campus Event",
                "subtitle": "Featured event",
                "category": category,
                "timeLabel": _format_time_label(start_at),
                "startAt": start_at,
                "link": event.get("link") or event.get("source_url"),
            }
        )

    hotspots: List[Dict[str, Any]] = []
    for place_id, group in grouped.items():
        percent_full = occupancy_by_place.get(place_id)
        occupancy_boost = min(14, (percent_full - 35) * 0.22) if percent_full is not None and percent_full > 35 else 0
        score = round(group["score"] + occupancy_boost)
        if score < 16:
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
    return hotspots[:limit]
