"""UTD event normaliser."""

from __future__ import annotations

import logging
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from dateutil import parser as dtparse

BASE_DIR = Path(__file__).resolve().parent
SHARED_TAMU_DIR = BASE_DIR.parent / "TamuEventsCrawler"
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))
if str(SHARED_TAMU_DIR) not in sys.path:
    sys.path.insert(1, str(SHARED_TAMU_DIR))

from classifiers.category_classifier import classify_event
from food_detector import detect_food
from models import Event, SourcePriority

logger = logging.getLogger("utd_crawler.normalizer")

UTD_CENTER_LAT = 32.9858
UTD_CENTER_LNG = -96.7501
UTD_LAT_WINDOW = 0.45
UTD_LNG_WINDOW = 0.55

PRIORITY_WEIGHT = {
    SourcePriority.HIGH: 1.0,
    SourcePriority.MEDIUM: 0.7,
    SourcePriority.LOW: 0.4,
}

NON_DFW_PATTERNS = [
    r"\baustin\b",
    r"\bhouston\b",
    r"\bsan\s+antonio\b",
    r"\bgalveston\b",
    r"\bcorpus\s+christi\b",
    r"\bel\s+paso\b",
    r"\bwashington\s*,?\s*d\.?c\.?\b",
    r"\bnew\s+york\b",
    r"\blos\s+angeles\b",
]

DFW_SIGNALS = [
    "ut dallas",
    "utd",
    "richardson",
    "plano",
    "dallas",
    "addison",
    "carrollton",
    "garland",
    "frisco",
    "irving",
    "campbell road",
    "loop road",
    "student union",
    "activity center",
    "science learning center",
    "student services building",
    "comet cruiser",
    "dart",
]


def _safe_parse_dt(value: Any) -> Optional[datetime]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    try:
        return dtparse.parse(str(value))
    except (TypeError, ValueError):
        return None


def _compute_freshness(
    start_time: datetime,
    priority: str,
    now: Optional[datetime] = None,
) -> float:
    now = now or datetime.utcnow()
    st_naive = start_time.replace(tzinfo=None) if start_time.tzinfo else start_time
    now_naive = now.replace(tzinfo=None) if now.tzinfo else now
    delta = (st_naive - now_naive).total_seconds()

    if delta > 0:
        days_ahead = delta / 86400
        time_score = max(0.1, 1.0 - (days_ahead / 45.0))
    else:
        days_ago = abs(delta) / 86400
        time_score = max(0.0, 0.5 - (days_ago / 14.0))

    try:
        priority_enum = SourcePriority(priority)
    except ValueError:
        priority_enum = SourcePriority.MEDIUM

    return round(
        min(1.0, max(0.0, time_score * PRIORITY_WEIGHT.get(priority_enum, 0.5))),
        3,
    )


def _is_utd_region(raw: Dict[str, Any]) -> bool:
    lat = raw.get("location_lat")
    lng = raw.get("location_lng")
    if lat is not None and lng is not None:
        try:
            return (
                abs(float(lat) - UTD_CENTER_LAT) <= UTD_LAT_WINDOW
                and abs(float(lng) - UTD_CENTER_LNG) <= UTD_LNG_WINDOW
            )
        except (TypeError, ValueError):
            pass

    combined = " ".join(
        str(part or "").lower()
        for part in (
            raw.get("title"),
            raw.get("location"),
            raw.get("description"),
            raw.get("host_name"),
        )
    )
    if any(signal in combined for signal in DFW_SIGNALS):
        return True
    return not any(re.search(pattern, combined) for pattern in NON_DFW_PATTERNS)


def _is_undergrad_relevant(raw: Dict[str, Any]) -> bool:
    combined = " ".join(
        [
            (raw.get("title") or "").lower(),
            (raw.get("description") or "").lower()[:1000],
            " ".join(tag.lower() for tag in raw.get("tags", [])),
        ]
    )
    exclude_patterns = [
        r"\bfaculty\s+only\b",
        r"\bstaff\s+only\b",
        r"\bemployee\s+only\b",
        r"\bfaculty\s+senate\b",
        r"\bstaff\s+meeting\b",
        r"\bboard\s+meeting\b",
        r"\bmandatory\s+training\b",
        r"\bcompliance\s+training\b",
    ]
    return not any(re.search(pattern, combined) for pattern in exclude_patterns)


def _student_org_probability(raw: Dict[str, Any], host_type: str) -> float:
    source_name = (raw.get("source_name") or "").lower()
    if host_type == "student_org":
        return 0.92
    if source_name.startswith("groups:"):
        return 0.85
    if "auxiliary_services" in source_name:
        return 0.45
    if source_name.startswith("departments:"):
        return 0.35
    return 0.15


def normalize_event(
    raw: Dict[str, Any],
    source_priority: str = "medium",
    existing_event: Optional[Event] = None,
) -> Optional[Event]:
    if not _is_utd_region(raw):
        return None
    if not _is_undergrad_relevant(raw):
        return None

    start_time = _safe_parse_dt(raw.get("start_time"))
    if not start_time:
        return None
    end_time = _safe_parse_dt(raw.get("end_time"))

    duration_minutes = None
    if start_time and end_time:
        st = start_time.replace(tzinfo=None) if start_time.tzinfo else start_time
        et = end_time.replace(tzinfo=None) if end_time.tzinfo else end_time
        diff = (et - st).total_seconds()
        if 0 < diff < 86400:
            duration_minutes = int(diff / 60)

    host_type = raw.get("host_type", "unknown")

    has_food, food_confidence, food_reasons, food_type = detect_food(
        title=raw.get("title", ""),
        description=raw.get("description"),
        host_name=raw.get("host_name"),
        tags=raw.get("tags", []),
        host_type=host_type,
        duration_minutes=duration_minutes,
        source_name=raw.get("source_name"),
    )

    categories, category_reasons = classify_event(
        title=raw.get("title", ""),
        description=raw.get("description"),
        host_name=raw.get("host_name"),
        location=raw.get("location"),
        tags=raw.get("tags"),
        source_name=raw.get("source_name"),
    )

    if has_food:
        categories["food"] = 1
        if "food:detector" not in category_reasons:
            category_reasons.append("food:detector")

    freshness = _compute_freshness(start_time, source_priority)
    now = datetime.utcnow()

    source_links = list(raw.get("source_links", []))
    for candidate in (raw.get("source_url"), raw.get("event_url")):
        if candidate and candidate not in source_links:
            source_links.append(candidate)

    try:
        return Event(
            id=raw.get("id", "utd:unknown:0"),
            title=raw.get("title", "UTD Event"),
            description=raw.get("description"),
            start_time=start_time,
            end_time=end_time,
            timezone=raw.get("timezone", "America/Chicago"),
            location=raw.get("location"),
            location_lat=raw.get("location_lat"),
            location_lng=raw.get("location_lng"),
            host_name=raw.get("host_name"),
            host_type=host_type,
            department_code=raw.get("department_code"),
            department_name=raw.get("department_name"),
            source_name=raw.get("source_name", "unknown"),
            source_url=raw.get("source_url", ""),
            source_links=source_links,
            event_url=raw.get("event_url"),
            discovered_via=raw.get("discovered_via"),
            crawl_path=raw.get("crawl_path", []),
            registration_status=raw.get("registration_status"),
            tags=raw.get("tags", []),
            audience=raw.get("audience", ["undergrad"]),
            campus="richardson",
            affiliation="utd",
            has_food=has_food,
            food_confidence=food_confidence,
            food_reasons=food_reasons,
            food_type=food_type,
            social=categories.get("social", 0),
            sports=categories.get("sports", 0),
            academic=categories.get("academic", 0),
            food=categories.get("food", 0),
            advocacy=categories.get("advocacy", 0),
            entertainment=categories.get("entertainment", 0),
            health_wellness=categories.get("health_wellness", 0),
            religion=categories.get("religion", 0),
            casual=categories.get("casual", 0),
            professional=categories.get("professional", 0),
            category_reasons=category_reasons,
            duration_minutes=duration_minutes,
            student_org_prob=_student_org_probability(raw, host_type),
            freshness_score=freshness,
            first_seen_at=existing_event.first_seen_at if existing_event else now,
            last_seen_at=now,
            raw_payload=raw.get("raw_payload", {}),
        )
    except Exception as exc:
        logger.warning("Failed to normalize %s: %s", raw.get("title"), exc)
        return None


def normalize_batch(
    raw_events: List[Dict[str, Any]],
    source_priority: str = "medium",
    existing_events: Optional[Dict[str, Event]] = None,
) -> List[Event]:
    existing = existing_events or {}
    normalized: List[Event] = []
    for raw in raw_events:
        event = normalize_event(raw, source_priority, existing.get(raw.get("id", "")))
        if event:
            normalized.append(event)
    logger.info(
        "Normalized %d events from %d raw (filtered %d)",
        len(normalized),
        len(raw_events),
        len(raw_events) - len(normalized),
    )
    return normalized
