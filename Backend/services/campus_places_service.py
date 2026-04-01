from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List

from routers.traffic import tracker
from services import place_registry_service

PLACE_SNAPSHOT_TTL_SECONDS = 60


STATIC_PLACE_META: Dict[str, Dict[str, Any]] = {
    "libr": {
        "hours": "Open daily · check library schedule",
        "description": "Main research library near the Academic Plaza.",
    },
    "annex": {
        "hours": "Open daily · check library schedule",
        "description": "Annex study and overflow library space.",
    },
    "wcl": {
        "hours": "Open daily · check library schedule",
        "description": "Business and west campus study hub.",
    },
    "srec": {
        "hours": "6:00 AM – 11:45 PM",
        "description": "Primary rec center with fitness, courts, pools, and climbing.",
        "features": [
            "Strength & Conditioning",
            "Indoor Track",
            "Pools",
            "Climbing Wall",
        ],
    },
    "southside-rec": {
        "hours": "5:30 AM – 11:59 PM",
        "description": "Southside rec center near the Commons with indoor and outdoor space.",
        "features": [
            "Strength & Conditioning",
            "Cardio Equipment",
            "Locker Rooms",
            "Sand Volleyball",
        ],
    },
    "polo-rec": {
        "hours": "6:00 AM – 10:00 PM",
        "description": "North campus rec center focused on cardio and strength training.",
        "features": [
            "Strength & Conditioning",
            "Cardio Equipment",
            "Indoor Track",
        ],
    },
    "sbisa": {
        "hours": "Breakfast, lunch, and dinner service",
        "description": "Northside all-you-care-to-eat dining hall.",
    },
    "commons": {
        "hours": "Breakfast, lunch, and dinner service",
        "description": "Southside dining hall near the Commons.",
    },
    "duncan": {
        "hours": "Check dining schedule",
        "description": "Dining hall near the Corps Quad.",
    },
    "msc": {
        "hours": "Open daily",
        "description": "Central student hub, dining, lounges, and events.",
    },
    "polo-garage-food": {
        "hours": "Check dining schedule",
        "description": "Dining hub inside the Polo Road Garage complex.",
    },
    "rudder": {
        "hours": "Open daily",
        "description": "Event and campus activity landmark adjacent to the MSC.",
    },
}


def _prefer_place_type(base_type: str, live_type: str | None) -> str:
    if base_type == "Hub":
        return "Hub"
    if live_type and live_type not in {"General", "Landmark", "Building"}:
        return live_type
    return base_type or live_type or "General"


def _base_locations() -> Dict[str, Dict[str, Any]]:
    snapshot: Dict[str, Dict[str, Any]] = {}
    for place in place_registry_service.get_all_places():
        meta = STATIC_PLACE_META.get(place["place_id"], {})
        snapshot[place["place_id"]] = {
            "placeId": place["place_id"],
            "location": place["name"],
            "shortName": place.get("short_name"),
            "percent_full": 0,
            "type": place["type"],
            "is_live": False,
            "available_seats": None,
            "coord": dict(place["coord"]),
            "hours": meta.get("hours"),
            "description": meta.get("description"),
            "features": meta.get("features"),
            "current_event": None,
            "source": "snapshot",
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

        meta = STATIC_PLACE_META.get(resolved_place["place_id"], {})
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
                "hours": row.get("hours") or existing.get("hours") or meta.get("hours"),
                "description": existing.get("description") or row.get("description") or meta.get("description"),
                "features": existing.get("features") or meta.get("features"),
                "current_event": row.get("current_event") or existing.get("current_event"),
                "source": "snapshot",
            }
        )


def get_places_map_snapshot() -> Dict[str, Any]:
    locations = _base_locations()
    _merge_operational_state(locations)

    ordered_locations: List[Dict[str, Any]] = sorted(
        locations.values(),
        key=lambda location: (
            0 if location["type"] in {"Hub", "Dining", "Library", "Rec"} else 1,
            location["location"],
        ),
    )

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "stale_after": PLACE_SNAPSHOT_TTL_SECONDS,
        "source_status": "live" if any(location["is_live"] for location in ordered_locations) else "preview",
        "locations": ordered_locations,
    }
