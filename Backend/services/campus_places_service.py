from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List

from routers.traffic import tracker
from services import cache_service, place_registry_service
from services.place_type_service import normalize_place_type

PLACE_SNAPSHOT_TTL_SECONDS = 60
PLACE_SNAPSHOT_CACHE_VERSION = "v2"


def _prefer_place_type(base_type: str, live_type: str | None) -> str:
    base_type = normalize_place_type(base_type)
    live_type = normalize_place_type(live_type)
    if base_type == "Hub":
        return "Hub"
    if live_type and live_type not in {"General", "Landmark", "Academic"}:
        return live_type
    return base_type or live_type or "General"


def _base_locations() -> Dict[str, Dict[str, Any]]:
    snapshot: Dict[str, Dict[str, Any]] = {}
    for place in place_registry_service.get_all_places():
        snapshot[place["place_id"]] = {
            "placeId": place["place_id"],
            "location": place["name"],
            "shortName": place.get("short_name"),
            "percent_full": 0,
            "type": place["type"],
            "is_live": False,
            "available_seats": None,
            "coord": dict(place["coord"]),
            "aliases": list(place.get("aliases") or []),
            "hours": place.get("hours"),
            "description": place.get("description"),
            "address": place.get("address"),
            "features": place.get("features"),
            "current_event": None,
            "source": place.get("source") or "snapshot",
            "searchOnly": bool(place.get("search_only")),
        }
    return snapshot


def _merge_operational_state(locations: Dict[str, Dict[str, Any]]) -> None:
    try:
        rows = tracker.get_all_locations_with_events()
    except Exception as exc:
        print(f"[campus_places_service] failed to load operational rows: {exc}")
        rows = []

    for row in rows:
        coord = row.get("coord") or {}
        resolved_place = place_registry_service.resolve_place(
            row.get("location"),
            coord.get("lat"),
            coord.get("lng"),
        )
        if not resolved_place:
            continue

        existing = locations.get(resolved_place["place_id"])
        if not existing:
            continue

        existing.update(
            {
                "location": resolved_place["name"],
                "shortName": existing.get("shortName") or resolved_place.get("short_name"),
                "percent_full": int(round(float(row.get("percent_full") or 0))),
                "type": _prefer_place_type(existing.get("type"), row.get("type")),
                "is_live": bool(row.get("is_live")),
                "available_seats": row.get("available_seats"),
                "coord": {"lat": resolved_place["lat"], "lng": resolved_place["lng"]},
                "hours": row.get("hours") or existing.get("hours"),
                "description": existing.get("description") or row.get("description"),
                "features": existing.get("features") or resolved_place.get("features"),
                "current_event": row.get("current_event") or existing.get("current_event"),
                "source": existing.get("source") or "snapshot",
            }
        )


def get_places_map_snapshot() -> Dict[str, Any]:
    cache_key = f"campus:places:map:{PLACE_SNAPSHOT_CACHE_VERSION}"
    cached = cache_service.get_json(cache_key)
    if cached is not None:
        return cached

    locations = _base_locations()
    _merge_operational_state(locations)

    ordered_locations: List[Dict[str, Any]] = sorted(
        locations.values(),
        key=lambda location: (
            1 if location.get("searchOnly") else 0,
            0 if location["type"] in {"Hub", "Dining", "Library", "Rec"} else 1,
            location["location"],
        ),
    )

    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "stale_after": PLACE_SNAPSHOT_TTL_SECONDS,
        "source_status": "live" if any(location["is_live"] for location in ordered_locations) else "preview",
        "locations": ordered_locations,
    }
    cache_service.set_json(cache_key, payload, PLACE_SNAPSHOT_TTL_SECONDS)
    return payload
