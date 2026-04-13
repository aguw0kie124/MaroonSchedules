from __future__ import annotations

from datetime import datetime, timedelta
import json
import re
from pathlib import Path
from typing import Any, Dict, List, Tuple

from services import cache_service, place_registry_service


CAMPUS_EVENT_SOURCES = {
    "tamu": {
        "crawler_output": (
            Path(__file__).resolve().parents[2]
            / "TamuEventsCrawler"
            / "data"
            / "normalized"
            / "events.jsonl"
        ),
        "center_lat": 30.6123,
        "center_lng": -96.3415,
        "lat_window": 0.25,
        "lng_window": 0.35,
        "affiliation": "tamu",
        "label": "college_station",
        "non_local_patterns": (
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
        ),
        "student_signals": (
            "student",
            "organization",
            "club",
            "association",
            "society",
            "aggie",
            "msc",
            "reslife",
            "student affairs",
        ),
        "commuter_signals": (),
    },
    "utd": {
        "crawler_output": (
            Path(__file__).resolve().parents[2]
            / "UtdEventsCrawler"
            / "data"
            / "normalized"
            / "events.jsonl"
        ),
        "center_lat": 32.9858,
        "center_lng": -96.7501,
        "lat_window": 0.45,
        "lng_window": 0.55,
        "affiliation": "utd",
        "label": "richardson",
        "non_local_patterns": (
            "austin",
            "houston",
            "san antonio",
            "galveston",
            "corpus christi",
            "el paso",
            "washington, dc",
            "new york",
            "los angeles",
        ),
        "student_signals": (
            "student",
            "organization",
            "club",
            "association",
            "society",
            "comet",
            "student union",
            "student affairs",
            "utd",
            "ut dallas",
        ),
        "commuter_signals": (
            "commuter",
            "transit",
            "shuttle",
            "cruiser",
            "comet cruiser",
            "dart",
            "parking",
        ),
    },
}

EVENTS_SNAPSHOT_TTL_SECONDS = 300
EVENT_CACHE_VERSION = "v2"
_EVENT_CACHE: Dict[str, List[Dict[str, Any]]] = {}
_EVENT_CACHE_MTIME_NS: Dict[str, int] = {}

HIGH_SIGNAL_TERMS = (
    "concert",
    "festival",
    "showcase",
    "game",
    "match",
    "tournament",
    "tailgate",
    "mixer",
    "social",
    "night",
    "movie",
    "comedy",
    "party",
    "speaker",
    "lecture",
    "panel",
    "workshop",
    "hackathon",
    "show",
    "performance",
    "market",
    "celebration",
    "free food",
    "pizza",
    "lunch",
    "dinner",
    "pop up",
    "wellness",
)

LOW_SIGNAL_TERMS = (
    "tsi",
    "class",
    "section",
    "course",
    "office hour",
    "office hours",
    "advising",
    "training",
    "required",
    "compliance",
    "module",
    "orientation module",
    "faculty senate",
    "staff meeting",
    "employee",
    "workday",
    "canvas",
    "registration deadline",
    "deadline reminder",
    "final exam",
    "midterm",
    "quiz",
    "syllabus",
)


def _campus_key(campus: str | None) -> str:
    key = (campus or "tamu").strip().lower()
    return key if key in CAMPUS_EVENT_SOURCES else "tamu"


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


def _is_campus_event(event: Dict[str, Any], campus: str) -> bool:
    config = CAMPUS_EVENT_SOURCES[_campus_key(campus)]
    lat = event.get("location_lat")
    lng = event.get("location_lng")
    if lat is not None and lng is not None:
        try:
            return (
                abs(float(lat) - float(config["center_lat"])) <= float(config["lat_window"])
                and abs(float(lng) - float(config["center_lng"])) <= float(config["lng_window"])
            )
        except (TypeError, ValueError):
            pass

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
    return not any(pattern in combined for pattern in config["non_local_patterns"])


def _normalize_event_row(raw: Dict[str, Any], campus: str) -> Dict[str, Any] | None:
    campus_key = _campus_key(campus)
    config = CAMPUS_EVENT_SOURCES[campus_key]

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
        # Check raw_payload (common for crawler events)
        payload = raw.get("raw_payload") or {}
        if isinstance(payload, str):
            try:
                import json
                payload = json.loads(payload)
            except:
                payload = {}
        
        lat = lat if lat is not None else payload.get("location_latitude")
        lng = lng if lng is not None else payload.get("location_longitude")

    if lat is None or lng is None:
        fallback_lat, fallback_lng = _parse_coordinate_fallback(raw.get("location"))
        lat = lat if lat is not None else fallback_lat
        lng = lng if lng is not None else fallback_lng

    try:
        lat = float(lat) if lat is not None else None
        lng = float(lng) if lng is not None else None
    except (TypeError, ValueError):
        lat, lng = None, None

    raw_location = raw.get("location")
    if not raw_location and int(raw.get("sports", 0) or 0) == 1:
        title = raw.get("title") or ""
        at_match = re.search(r"\s+at\s+(.+)$", title, re.IGNORECASE)
        if at_match:
            raw_location = at_match.group(1).strip()

    raw_location = _clean_location_label(raw_location, lat, lng)
    resolved_place = (
        place_registry_service.resolve_place(raw_location, lat, lng)
        if campus_key == "tamu"
        else None
    )
    location = resolved_place["name"] if resolved_place else raw_location

    normalized = {
        "event_id": raw.get("id"),
        "title": raw.get("title") or "Campus Event",
        "summary": raw.get("description") or "",
        "description": raw.get("description") or "",
        "raw_location": raw_location,
        "location": location,
        "place_id": resolved_place["place_id"] if resolved_place else None,
        "location_lat": resolved_place["lat"] if resolved_place else lat,
        "location_lng": resolved_place["lng"] if resolved_place else lng,
        "start_time": start_dt.isoformat(),
        "end_time": end_dt.isoformat() if end_dt else None,
        "link": raw.get("event_url") or raw.get("source_url"),
        "source_url": raw.get("source_url"),
        "host_name": raw.get("host_name"),
        "source_name": raw.get("source_name"),
        "tags": raw.get("tags") or [],
        "has_food": bool(raw.get("has_food") or raw.get("food", 0)),
        "food_confidence": float(raw.get("food_confidence") or 0.0),
        "food_type": raw.get("food_type") or "unknown",
        "food_reasons": raw.get("food_reasons") or [],
        "campus": raw.get("campus") or config["label"],
        "affiliation": raw.get("affiliation") or config["affiliation"],
        "categories": {
            "social": int(raw.get("social", 0)),
            "sports": int(raw.get("sports", 0)),
            "academic": int(raw.get("academic", 0)),
            "food": int(raw.get("food", 0)),
            "advocacy": int(raw.get("advocacy", 1) if raw.get("advocacy") else 0),
            "entertainment": int(raw.get("entertainment", 0)),
            "health_wellness": int(raw.get("health_wellness", 0)),
            "miscellaneous": int(
                raw.get("miscellaneous", 0)
                or raw.get("religion", 0)
                or (
                    not any(
                        [
                            int(raw.get("social", 0)),
                            int(raw.get("sports", 0)),
                            int(raw.get("academic", 0)),
                            int(raw.get("food", 0)),
                            int(raw.get("advocacy", 0)),
                            int(raw.get("entertainment", 0)),
                            int(raw.get("health_wellness", 0)),
                        ]
                    )
                )
            ),
            "casual": int(raw.get("casual", 0)),
            "professional": int(raw.get("professional", 0)),
        },
        "map_available": (resolved_place is not None) or (lat is not None and lng is not None),
    }

    if resolved_place:
        normalized["place"] = place_registry_service.serialize_place(resolved_place)

    score, label, reasons = _score_student_relevance(normalized, campus_key)
    normalized["campus_interest_score"] = score
    normalized["campus_interest_label"] = label
    normalized["campus_interest_reasons"] = reasons
    return normalized


def _score_student_relevance(event: Dict[str, Any], campus: str) -> Tuple[int, str, List[str]]:
    config = CAMPUS_EVENT_SOURCES[_campus_key(campus)]
    text_parts = [
        str(event.get("title") or ""),
        str(event.get("summary") or ""),
        str(event.get("description") or ""),
        str(event.get("location") or ""),
        str(event.get("host_name") or ""),
        str(event.get("source_name") or ""),
        " ".join(str(tag) for tag in event.get("tags") or []),
    ]
    text = " ".join(text_parts).lower()
    categories = event.get("categories") or {}
    score = 40
    reasons: List[str] = []

    category_weights = {
        "food": 18,
        "sports": 22,
        "entertainment": 22,
        "social": 16,
        "health_wellness": 12,
        "advocacy": 10,
        "academic": 8,
    }
    for category, weight in category_weights.items():
        if categories.get(category):
            score += weight
            reasons.append(f"{category}_category")

    if event.get("has_food"):
        score += 12
        reasons.append("food_signal")

    if any(term in text for term in HIGH_SIGNAL_TERMS):
        score += 14
        reasons.append("high_signal_keywords")

    if any(term in text for term in config["student_signals"]):
        score += 10
        reasons.append("student_org_signal")

    if any(term in text for term in config["commuter_signals"]):
        score += 8
        reasons.append("commuter_signal")

    if event.get("map_available"):
        score += 4
        reasons.append("mapped_location")

    if any(term in text for term in LOW_SIGNAL_TERMS):
        score -= 38
        reasons.append("low_signal_keywords")

    title = str(event.get("title") or "").lower()
    if re.search(r"\b(class|section|module|training|tsi)\b", title):
        score -= 18
        reasons.append("title_looks_like_admin_or_class")

    if (
        not event.get("host_name")
        and not event.get("tags")
        and not categories.get("social")
        and not categories.get("entertainment")
    ):
        score -= 6
        reasons.append("low_context")

    score = max(0, min(100, score))
    if score >= 70:
        label = "high"
    elif score >= 25:
        label = "medium"
    else:
        label = "low"
    return score, label, reasons


def load_campus_events(force_refresh: bool = False, campus: str = "tamu") -> Dict[str, Any]:
    campus_key = _campus_key(campus)
    config = CAMPUS_EVENT_SOURCES[campus_key]
    cache_key = f"campus:events:normalized:{EVENT_CACHE_VERSION}:{campus_key}"

    if not force_refresh:
        cached = cache_service.get_json(cache_key)
        if cached is not None:
            return cached

    crawler_output = Path(config["crawler_output"])
    if not crawler_output.exists():
        payload = {
            "generated_at": datetime.utcnow().isoformat() + "Z",
            "stale_after": 30,  # [FIX] Short TTL for missing state to allow faster recovery
            "source_status": "missing",
            "campus": campus_key,
            "events": [],
        }
        cache_service.set_json(cache_key, payload, 30)
        return payload

    mtime_ns = crawler_output.stat().st_mtime_ns
    if (
        not force_refresh
        and campus_key in _EVENT_CACHE
        and _EVENT_CACHE_MTIME_NS.get(campus_key) == mtime_ns
    ):
        payload = {
            "generated_at": datetime.utcnow().isoformat() + "Z",
            "stale_after": EVENTS_SNAPSHOT_TTL_SECONDS,
            "source_status": "live",
            "campus": campus_key,
            "events": _EVENT_CACHE[campus_key],
        }
        cache_service.set_json(cache_key, payload, EVENTS_SNAPSHOT_TTL_SECONDS)
        return payload

    events: List[Dict[str, Any]] = []
    with crawler_output.open("r", encoding="utf-8") as handle:
        for line in handle:
            if not line.strip():
                continue
            try:
                raw = json.loads(line)
            except json.JSONDecodeError:
                continue
            normalized = _normalize_event_row(raw, campus_key)
            if normalized:
                events.append(normalized)

    cutoff = datetime.now() - timedelta(days=3)
    events = [
        event
        for event in events
        if (
            datetime.fromisoformat(event["start_time"].replace("Z", "+00:00")).replace(tzinfo=None) >= cutoff
            and _is_campus_event(event, campus_key)
        )
    ]
    events.sort(
        key=lambda event: (
            -int(event.get("campus_interest_score", 0)),
            event["start_time"],
        )
    )

    _EVENT_CACHE[campus_key] = events
    _EVENT_CACHE_MTIME_NS[campus_key] = mtime_ns
    payload = {
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "stale_after": EVENTS_SNAPSHOT_TTL_SECONDS,
        "source_status": "live",
        "campus": campus_key,
        "events": events,
    }
    cache_service.set_json(cache_key, payload, EVENTS_SNAPSHOT_TTL_SECONDS)
    return payload
