"""Event normaliser — converts raw parser output into canonical Event models."""

from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import Any, Dict, List, Optional

from dateutil import parser as dtparse

from food_detector import detect_food
from models import Event, SourcePriority

logger = logging.getLogger("tamu_crawler.normalizer")

# Source-priority weights for freshness score
PRIORITY_WEIGHT = {
    SourcePriority.HIGH: 1.0,
    SourcePriority.MEDIUM: 0.7,
    SourcePriority.LOW: 0.4,
}

# Non-College-Station location patterns
NON_CS_LOCATIONS = [
    r"\bgalveston\b",
    r"\bqatar\b",
    r"\bhouston\b",
    r"\bdallas\b",
    r"\bsan\s+antonio\b",
    r"\baustin\b",
    r"\bmcallen\b",
    r"\bround\s+rock\b",
    r"\bfort\s+worth\b",
    r"\bwashington\s*,?\s*d\.?c\.?\b",
    r"\bonline\s+only\b",
    r"\bvirtual\s+only\b",
]


def _compute_freshness(
    start_time: datetime,
    priority: str,
    now: Optional[datetime] = None,
) -> float:
    """Compute a 0-1 freshness score based on event recency and source quality."""
    now = now or datetime.utcnow()
    # Ensure both are naive for comparison (strip tzinfo)
    st_naive = start_time.replace(tzinfo=None) if start_time.tzinfo else start_time
    now_naive = now.replace(tzinfo=None) if now.tzinfo else now
    delta = (st_naive - now_naive).total_seconds()

    # Future events score higher; past events decay
    if delta > 0:
        # Within next 7 days = 1.0; decays linearly over 30 days
        days_ahead = delta / 86400
        time_score = max(0.1, 1.0 - (days_ahead / 30.0))
    else:
        # Past events decay faster
        days_ago = abs(delta) / 86400
        time_score = max(0.0, 0.5 - (days_ago / 14.0))

    # Weight by source priority
    try:
        priority_enum = SourcePriority(priority)
    except ValueError:
        priority_enum = SourcePriority.MEDIUM
    weight = PRIORITY_WEIGHT.get(priority_enum, 0.5)

    return round(min(1.0, max(0.0, time_score * weight)), 3)


def _is_college_station(event_dict: Dict[str, Any]) -> bool:
    """Filter out non-College Station events."""
    location = (event_dict.get("location") or "").lower()
    title = (event_dict.get("title") or "").lower()
    description = (event_dict.get("description") or "").lower()[:500]
    combined = f"{location} {title} {description}"

    for pattern in NON_CS_LOCATIONS:
        if re.search(pattern, combined):
            # Exception: TAMU buildings that happen to have city names
            if "tamu" in combined or "texas a&m" in combined:
                continue
            return False
    return True


def _is_undergrad_relevant(event_dict: Dict[str, Any]) -> bool:
    """Check if event is relevant to undergrads. Lenient — keep most events."""
    title = (event_dict.get("title") or "").lower()
    tags = [t.lower() for t in event_dict.get("tags", [])]
    combined = f"{title} {' '.join(tags)}"

    # Exclude obviously non-undergrad events
    exclude_patterns = [
        r"\bfaculty\s+only\b",
        r"\bstaff\s+only\b",
        r"\bemployee\s+training\b",
        r"\bhiring\s+committee\b",
        r"\bboard\s+of\s+regents\b",
        r"\bretired\b",
    ]
    for pattern in exclude_patterns:
        if re.search(pattern, combined):
            return False
    return True


def _safe_parse_dt(value: Any) -> Optional[datetime]:
    """Safely parse a datetime from string or return as-is if already datetime."""
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    try:
        return dtparse.parse(str(value))
    except (ValueError, TypeError):
        return None


def normalize_event(
    raw: Dict[str, Any],
    source_priority: str = "medium",
    existing_event: Optional[Event] = None,
) -> Optional[Event]:
    """Convert a raw parser dict into a canonical Event model.

    Returns None if the event should be filtered out.
    """
    # Campus filter
    if not _is_college_station(raw):
        return None

    # Undergrad relevance filter
    if not _is_undergrad_relevant(raw):
        return None

    # Parse dates
    start_time = _safe_parse_dt(raw.get("start_time"))
    if not start_time:
        logger.debug("Skipping event with no start_time: %s", raw.get("title"))
        return None

    end_time = _safe_parse_dt(raw.get("end_time"))

    # Compute duration
    duration_minutes = None
    if start_time and end_time:
        st = start_time.replace(tzinfo=None) if start_time.tzinfo else start_time
        et = end_time.replace(tzinfo=None) if end_time.tzinfo else end_time
        diff = (et - st).total_seconds()
        if 0 < diff < 86400:  # sanity check: less than 24h
            duration_minutes = int(diff / 60)

    # Determine host_type
    host_type = raw.get("host_type", "unknown")

    # Student org probability heuristic
    student_org_prob = 0.0
    if host_type == "student_org":
        student_org_prob = 0.9
    elif host_type == "center":
        student_org_prob = 0.5
    elif raw.get("source_name", "") in (
        "student_activities", "student_interest", "student_orgs",
        "getinvolved_events", "msc",
    ):
        student_org_prob = 0.7
    elif "getinvolved_search" in raw.get("source_name", ""):
        student_org_prob = 0.8

    # Food detection (v2 — 4-tuple with food_type)
    has_food, food_confidence, food_reasons, food_type = detect_food(
        title=raw.get("title", ""),
        description=raw.get("description"),
        host_name=raw.get("host_name"),
        tags=raw.get("tags", []),
        host_type=host_type,
        duration_minutes=duration_minutes,
    )

    # Freshness
    freshness = _compute_freshness(start_time, source_priority)

    # First/last seen
    now = datetime.utcnow()
    first_seen = existing_event.first_seen_at if existing_event else now
    last_seen = now

    try:
        event = Event(
            id=raw.get("id", "tamu:unknown:0"),
            title=raw.get("title", "Untitled Event"),
            description=raw.get("description"),
            start_time=start_time,
            end_time=end_time,
            timezone=raw.get("timezone", "America/Chicago"),
            location=raw.get("location"),
            location_lat=raw.get("location_lat"),
            location_lng=raw.get("location_lng"),
            host_name=raw.get("host_name"),
            host_type=host_type,
            source_name=raw.get("source_name", "unknown"),
            source_url=raw.get("source_url", ""),
            event_url=raw.get("event_url"),
            tags=raw.get("tags", []),
            has_food=has_food,
            food_confidence=food_confidence,
            food_reasons=food_reasons,
            food_type=food_type,
            duration_minutes=duration_minutes,
            student_org_prob=student_org_prob,
            audience=raw.get("audience", ["undergrad"]),
            campus=raw.get("campus", "college_station"),
            affiliation="tamu",
            freshness_score=freshness,
            first_seen_at=first_seen,
            last_seen_at=last_seen,
            raw_payload=raw.get("raw_payload", {}),
        )
        return event
    except Exception as exc:
        logger.warning("Failed to create Event model: %s — %s", raw.get("title"), exc)
        return None


def normalize_batch(
    raw_events: List[Dict[str, Any]],
    source_priority: str = "medium",
    existing_events: Optional[Dict[str, Event]] = None,
) -> List[Event]:
    """Normalise a batch of raw event dicts into Event models.

    Args:
        raw_events: List of dicts from a parser.
        source_priority: Priority string from source config.
        existing_events: Map of event_id → existing Event for first_seen tracking.

    Returns:
        Filtered, normalised list of Event models.
    """
    existing = existing_events or {}
    events: List[Event] = []

    for raw in raw_events:
        existing_evt = existing.get(raw.get("id", ""))
        event = normalize_event(raw, source_priority, existing_evt)
        if event:
            events.append(event)

    logger.info(
        "Normalised %d events from %d raw (filtered %d)",
        len(events),
        len(raw_events),
        len(raw_events) - len(events),
    )
    return events
