from __future__ import annotations

from datetime import datetime, timedelta
import json
import re
from pathlib import Path
from typing import Any, Dict, List, Tuple


CRAWLER_OUTPUT = (
    Path(__file__).resolve().parents[2]
    / "TamuEventsCrawler"
    / "data"
    / "normalized"
    / "events.jsonl"
)
_EVENT_CACHE: List[Dict[str, Any]] | None = None
_EVENT_CACHE_MTIME_NS: int | None = None
TAMU_CENTER_LAT = 30.6153
TAMU_CENTER_LNG = -96.3410
NON_CS_PATTERNS = (
    "galveston",
    "qatar",
    "houston",
    "dallas",
    "san antonio",
    "austin",
    "mcallen",
    "round rock",
    "fort worth",
    "corpus christi",
)


def _parse_coordinate_fallback(value: str | None) -> Tuple[float | None, float | None]:
    if not value:
        return None, None

    text = value.strip()
    if not text:
        return None, None

    match = re.search(
        r"coordinates['\"]?\s*:\s*\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)",
        text,
    )
    if match:
        try:
            lng = float(match.group(1))
            lat = float(match.group(2))
            return lat, lng
        except (TypeError, ValueError):
            return None, None

    match = re.match(r"^\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*$", text)
    if match:
        try:
            return float(match.group(1)), float(match.group(2))
        except (TypeError, ValueError):
            return None, None

    return None, None


def _clean_location_label(location: str | None, lat: float | None, lng: float | None) -> str | None:
    if not location:
        return None
    if lat is not None and lng is not None:
        lowered = location.lower()
        if "coordinates" in lowered or lowered.startswith("{'type': 'point'"):
            return None
    return location


def _is_college_station_event(event: Dict[str, Any]) -> bool:
    lat = event.get("location_lat")
    lng = event.get("location_lng")
    if lat is not None and lng is not None:
      return abs(float(lat) - TAMU_CENTER_LAT) <= 0.25 and abs(float(lng) - TAMU_CENTER_LNG) <= 0.35

    combined = " ".join(
        str(part or "").lower()
        for part in (
            event.get("title"),
            event.get("location"),
            event.get("summary"),
            event.get("description"),
            event.get("host_name"),
        )
    )
    return not any(pattern in combined for pattern in NON_CS_PATTERNS)


def _normalize_event_row(raw: Dict[str, Any]) -> Dict[str, Any] | None:
    start_time = raw.get("start_time")
    if not start_time:
        return None

    try:
        start_dt = datetime.fromisoformat(str(start_time).replace("Z", "+00:00"))
    except ValueError:
        return None

    end_time = raw.get("end_time")
    end_dt = None
    if end_time:
        try:
            end_dt = datetime.fromisoformat(str(end_time).replace("Z", "+00:00"))
        except ValueError:
            end_dt = None

    lat = raw.get("location_lat")
    lng = raw.get("location_lng")
    if lat is None or lng is None:
        fallback_lat, fallback_lng = _parse_coordinate_fallback(raw.get("location"))
        lat = lat if lat is not None else fallback_lat
        lng = lng if lng is not None else fallback_lng

    try:
        lat = float(lat) if lat is not None else None
        lng = float(lng) if lng is not None else None
    except (TypeError, ValueError):
        lat, lng = None, None

    location = _clean_location_label(raw.get("location"), lat, lng)

    return {
        "event_id": raw.get("id"),
        "title": raw.get("title") or "Campus Event",
        "summary": raw.get("description") or "",
        "description": raw.get("description") or "",
        "location": location,
        "location_lat": lat,
        "location_lng": lng,
        "start_time": start_dt.isoformat(),
        "end_time": end_dt.isoformat() if end_dt else None,
        "link": raw.get("event_url") or raw.get("source_url"),
        "source_url": raw.get("source_url"),
        "host_name": raw.get("host_name"),
        "source_name": raw.get("source_name"),
        "tags": raw.get("tags") or [],
        "has_food": bool(raw.get("has_food")),
        "food_confidence": float(raw.get("food_confidence") or 0.0),
        "food_type": raw.get("food_type") or "unknown",
        "food_reasons": raw.get("food_reasons") or [],
        "map_available": lat is not None and lng is not None,
    }


def load_campus_events(force_refresh: bool = False) -> List[Dict[str, Any]]:
    global _EVENT_CACHE, _EVENT_CACHE_MTIME_NS

    if not CRAWLER_OUTPUT.exists():
        return []

    mtime_ns = CRAWLER_OUTPUT.stat().st_mtime_ns
    if not force_refresh and _EVENT_CACHE is not None and _EVENT_CACHE_MTIME_NS == mtime_ns:
        return _EVENT_CACHE

    events: List[Dict[str, Any]] = []
    with CRAWLER_OUTPUT.open("r", encoding="utf-8") as handle:
        for line in handle:
            if not line.strip():
                continue
            try:
                raw = json.loads(line)
            except json.JSONDecodeError:
                continue
            normalized = _normalize_event_row(raw)
            if normalized:
                events.append(normalized)

    cutoff = datetime.now() - timedelta(days=1)
    events = [
        event
        for event in events
        if (
            datetime.fromisoformat(event["start_time"].replace("Z", "+00:00")).replace(tzinfo=None) >= cutoff
            and _is_college_station_event(event)
        )
    ]
    events.sort(key=lambda event: event["start_time"])

    _EVENT_CACHE = events
    _EVENT_CACHE_MTIME_NS = mtime_ns
    return events
