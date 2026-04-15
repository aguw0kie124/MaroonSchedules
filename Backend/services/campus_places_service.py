from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List
from zoneinfo import ZoneInfo

from routers.traffic import LIBRARY_PLACE_ID_BY_API_KEY, tracker
from services import cache_service, parking_realtime_service, place_registry_service
from services.dineoncampus_hours_service import fetch_dining_periods_summary
from services.place_type_service import normalize_place_type
from services.rec_hours_data import REC_PLACE_ID_TO_FACILITY_KEY, weekly_payload_for_facility_key
from services.tamu_calendar_service import holiday_hours_notice_for_date
from services.weekly_public_hours import today_hours_for_place

PLACE_SNAPSHOT_TTL_SECONDS = 60
PLACE_SNAPSHOT_CACHE_VERSION = "v7"
CAPACITY_REALTIME_STALE_AFTER_SECONDS = 15

CAPACITY_ALIAS_PLACE_IDS: Dict[str, tuple[str, ...]] = {
    "annex": ("osm:way:307098419",),
}

# Visitor realtime counts from transport.tamu.edu (CCG, PRG, SBG, UCG, WCG)
VISITOR_GARAGE_CODE_BY_PLACE_ID: Dict[str, str] = {
    "osm:way:91100311": "CCG",
    "garage-polo": "PRG",
    "osm:way:450686873": "SBG",
    "garage-university-center": "UCG",
    "garage-west-campus": "WCG",
}

# Matches Texas A&M Transportation visitor garage names (realtime.aspx)
VISITOR_GARAGE_FULL_NAME_BY_CODE: Dict[str, str] = {
    "CCG": "Central Campus Garage",
    "PRG": "Polo Road Garage",
    "SBG": "Stallings Blvd Garage",
    "UCG": "University Center Garage",
    "WCG": "West Campus Garage",
}


def _safe_int(value: Any) -> int | None:
    try:
        if value is None:
            return None
        return int(value)
    except (TypeError, ValueError):
        return None


def _safe_float(value: Any) -> float | None:
    try:
        if value is None:
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _expand_capacity_alias_rows(rows_by_place_id: Dict[str, Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    expanded: Dict[str, Dict[str, Any]] = {}
    for place_id, payload in rows_by_place_id.items():
        expanded[place_id] = dict(payload)
        for alias_place_id in CAPACITY_ALIAS_PLACE_IDS.get(place_id, ()):
            alias_payload = dict(payload)
            alias_payload["canonical_place_id"] = place_id
            expanded[alias_place_id] = alias_payload
    return expanded


def get_places_capacity_realtime_snapshot() -> Dict[str, Any]:
    rec_rows = tracker.fetch_rec_data() or []
    rec_counts = tracker.get_rec_center_live_counts(rec_rows)
    rec_locations: Dict[str, Dict[str, Any]] = {}
    rec_last_updated_values: List[str] = []

    for place_id, live_count in rec_counts.items():
        last_updated = live_count.get("last_updated")
        if isinstance(last_updated, str) and last_updated.strip():
            rec_last_updated_values.append(last_updated)

        rec_locations[place_id] = {
            "percent_full": live_count.get("percent_full"),
            "available_seats": live_count.get("available_seats"),
            "capacity": live_count.get("capacity"),
            "current_count": live_count.get("current_count"),
            "occupancy_name": live_count.get("location_name"),
            "facility_counts": live_count.get("facility_counts") or [],
            "capacity_last_updated": last_updated,
            "capacity_source_url": tracker.rec_api,
            "capacity_as_of": last_updated,
            "is_live": True,
        }

    library_raw = tracker.fetch_library_data()
    library_lastupdate = library_raw.get("lastupdate") if isinstance(library_raw, dict) else None
    library_locations: Dict[str, Dict[str, Any]] = {}

    if isinstance(library_raw, dict):
        for api_key, entry in library_raw.items():
            if api_key == "lastupdate" or not isinstance(entry, dict):
                continue
            place_id = LIBRARY_PLACE_ID_BY_API_KEY.get(str(api_key).strip().lower())
            if not place_id:
                continue

            capacity = _safe_int(entry.get("max"))
            current_count = _safe_int(entry.get("occupancy"))
            percent_full = _safe_float(entry.get("percentfull"))
            available_seats = _safe_int(entry.get("remaining"))

            library_locations[place_id] = {
                "percent_full": percent_full,
                "available_seats": available_seats,
                "capacity": capacity,
                "current_count": current_count,
                "occupancy_name": entry.get("name"),
                "capacity_last_updated": library_lastupdate,
                "capacity_source_url": tracker.library_api,
                "capacity_as_of": library_lastupdate,
                "is_live": True,
            }

    expanded_rec_locations = _expand_capacity_alias_rows(rec_locations)
    expanded_library_locations = _expand_capacity_alias_rows(library_locations)

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "stale_after": CAPACITY_REALTIME_STALE_AFTER_SECONDS,
        "source_status": "live" if expanded_rec_locations or expanded_library_locations else "preview",
        "recreation": {
            "source_url": tracker.rec_api,
            "fetched_at": max(rec_last_updated_values) if rec_last_updated_values else None,
            "locations": expanded_rec_locations,
        },
        "libraries": {
            "source_url": tracker.library_api,
            "fetched_at": library_lastupdate,
            "locations": expanded_library_locations,
        },
    }


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
        # Prefer explicit place_id from tracker, fallback to coordinate resolution
        pid = row.get("place_id")
        existing = locations.get(pid) if pid else None
        
        resolved_place = None
        if not existing:
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

        loc_name = resolved_place["name"] if resolved_place else existing["location"]
        short_name = existing.get("shortName")
        if resolved_place and not short_name:
            short_name = resolved_place.get("short_name")

        existing.update(
            {
                "location": loc_name,
                "shortName": short_name,
                "percent_full": int(round(float(row.get("percent_full") or 0))),
                "type": _prefer_place_type(existing.get("type"), row.get("type")),
                "is_live": bool(row.get("is_live")),
                "available_seats": row.get("available_seats"),
                "coord": {"lat": resolved_place["lat"], "lng": resolved_place["lng"]} if resolved_place else existing.get("coord"),
                "hours": existing.get("hours") or row.get("hours"),
                "description": existing.get("description") or row.get("description"),
                "features": existing.get("features") or (resolved_place.get("features") if resolved_place else None),
                "current_event": row.get("current_event") or existing.get("current_event"),
                "source": existing.get("source") or "snapshot",
            }
        )
        if row.get("capacity") is not None:
            existing["capacity"] = row.get("capacity")
        if row.get("current_count") is not None:
            existing["current_count"] = row.get("current_count")

        for alias_place_id in CAPACITY_ALIAS_PLACE_IDS.get(existing["placeId"], ()):
            alias_existing = locations.get(alias_place_id)
            if not alias_existing:
                continue
            alias_existing.update(
                {
                    "percent_full": existing["percent_full"],
                    "is_live": existing["is_live"],
                    "available_seats": existing.get("available_seats"),
                }
            )
            if existing.get("capacity") is not None:
                alias_existing["capacity"] = existing.get("capacity")
            if existing.get("current_count") is not None:
                alias_existing["current_count"] = existing.get("current_count")


def _merge_visitor_parking_counts(
    locations: Dict[str, Dict[str, Any]],
    counts: Dict[str, int],
    fetched_at: str | None,
    source_url: str | None,
) -> None:
    if not counts:
        return
    for place_id, code in VISITOR_GARAGE_CODE_BY_PLACE_ID.items():
        loc = locations.get(place_id)
        if not loc:
            continue
        val = counts.get(code)
        if val is None:
            continue
        loc["visitor_parking_available"] = val
        loc["visitor_parking_code"] = code
        loc["visitor_parking_garage_name"] = VISITOR_GARAGE_FULL_NAME_BY_CODE.get(code)
        loc["visitor_parking_as_of"] = fetched_at
        loc["visitor_parking_source_url"] = source_url


def _annotate_hours_today(locations: Dict[str, Dict[str, Any]]) -> None:
    chi = ZoneInfo("America/Chicago")
    now_chi = datetime.now(chi)
    day_name = now_chi.strftime("%A")
    date_str = now_chi.strftime("%Y-%m-%d")
    notice = holiday_hours_notice_for_date(now_chi.date())

    for loc in locations.values():
        typ = loc.get("type") or "General"
        place_id = loc.get("placeId")

        slot: str | None = None
        if typ == "Rec":
            fac_key = REC_PLACE_ID_TO_FACILITY_KEY.get(place_id or "")
            if fac_key:
                wh = weekly_payload_for_facility_key(fac_key, now_chi)
                slot = wh.get("today_hours") or "Check official facility page"
        elif typ == "Dining":
            weekly_slot = today_hours_for_place(
                place_id=place_id,
                place_type=typ,
                registry_hours=loc.get("hours"),
                now_weekday_name=day_name,
            )
            live = fetch_dining_periods_summary(place_id or "", date_str) if place_id else None
            if live and live.get("line_with_times"):
                slot = live["line_with_times"]
            elif live and live.get("period_names"):
                joined = ", ".join(live["period_names"])
                if weekly_slot:
                    slot = f"{weekly_slot} | Meal periods today: {joined}"
                else:
                    slot = f"Meal periods today: {joined}"
            else:
                slot = weekly_slot
        else:
            slot = today_hours_for_place(
                place_id=place_id,
                place_type=typ,
                registry_hours=loc.get("hours"),
                now_weekday_name=day_name,
            )

        if slot:
            loc["hours_today"] = f"{day_name} (Central Time): {slot}"
        if notice and typ in {"Rec", "Library", "Dining", "Parking", "Hub"}:
            loc["hours_holiday_notice"] = notice


def get_places_map_snapshot() -> Dict[str, Any]:
    cache_key = f"campus:places:map:{PLACE_SNAPSHOT_CACHE_VERSION}"
    cached = cache_service.get_json(cache_key)
    if cached is not None:
        return cached

    locations = _base_locations()
    _merge_operational_state(locations)
    parking_block = parking_realtime_service.snapshot_block()
    _merge_visitor_parking_counts(
        locations,
        parking_block.get("garages") or {},
        parking_block.get("fetched_at"),
        parking_block.get("source_url"),
    )
    _annotate_hours_today(locations)

    ordered_locations: List[Dict[str, Any]] = sorted(
        locations.values(),
        key=lambda location: (
            1 if location.get("searchOnly") else 0,
            0 if location["type"] in {"Hub", "Dining", "Library", "Rec", "Parking"} else 1,
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
