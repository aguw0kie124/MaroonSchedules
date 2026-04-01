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

STUDENT_ORG_SIGNALS = (
    "student",
    "organization",
    "club",
    "association",
    "society",
    "aggie",
    "msc",
    "reslife",
    "student affairs",
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

    normalized = {
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
        "has_food": bool(raw.get("has_food") or raw.get("food", 0)),
        "food_confidence": float(raw.get("food_confidence") or 0.0),
        "food_type": raw.get("food_type") or "unknown",
        "food_reasons": raw.get("food_reasons") or [],
        "categories": {
            "social": int(raw.get("social", 0)),
            "sports": int(raw.get("sports", 0)),
            "academic": int(raw.get("academic", 0)),
            "food": int(raw.get("food", 0)),
            "advocacy": int(raw.get("advocacy", 1) if raw.get("advocacy") else 0),
            "entertainment": int(raw.get("entertainment", 0)),
            "health_wellness": int(raw.get("health_wellness", 0)),
            "miscellaneous": int(raw.get("miscellaneous", 0) or raw.get("religion", 0) or (
                not any([
                    int(raw.get("social", 0)),
                    int(raw.get("sports", 0)),
                    int(raw.get("academic", 0)),
                    int(raw.get("food", 0)),
                    int(raw.get("advocacy", 0)),
                    int(raw.get("entertainment", 0)),
                    int(raw.get("health_wellness", 0)),
                ])
            )),
            "casual": int(raw.get("casual", 0)),
            "professional": int(raw.get("professional", 0)),
        },
        "map_available": lat is not None and lng is not None,
    }

    score, label, reasons = _score_student_relevance(normalized)
    normalized["campus_interest_score"] = score
    normalized["campus_interest_label"] = label
    normalized["campus_interest_reasons"] = reasons
    return normalized


def _score_student_relevance(event: Dict[str, Any]) -> Tuple[int, str, List[str]]:
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
    score = 35
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

    if any(term in text for term in STUDENT_ORG_SIGNALS):
        score += 10
        reasons.append("student_org_signal")

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

    if not event.get("host_name") and not event.get("tags") and not categories.get("social") and not categories.get("entertainment"):
        score -= 6
        reasons.append("low_context")

    score = max(0, min(100, score))
    if score >= 70:
        label = "high"
    elif score >= 45:
        label = "medium"
    else:
        label = "low"
    return score, label, reasons


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
    events.sort(
        key=lambda event: (
            -int(event.get("campus_interest_score", 0)),
            event["start_time"],
        )
    )

    _EVENT_CACHE = events
    _EVENT_CACHE_MTIME_NS = mtime_ns
    return events
