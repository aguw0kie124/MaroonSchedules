"""Event normaliser v3 — converts raw parser output into canonical Event models.

Integrates:
- Category classifier (8 binary flags)
- Department mapper (code + name + host_type inference)
- Source traceability (source_links, discovered_via, crawl_path)
- Food detector v3 (two-stage with source priors)
"""

from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import Any, Dict, List, Optional

from dateutil import parser as dtparse

from classifiers.category_classifier import classify_event
from food_detector import detect_food
from mappers.department_mapper import map_department
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
    st_naive = start_time.replace(tzinfo=None) if start_time.tzinfo else start_time
    now_naive = now.replace(tzinfo=None) if now.tzinfo else now
    delta = (st_naive - now_naive).total_seconds()

    if delta > 0:
        days_ahead = delta / 86400
        time_score = max(0.1, 1.0 - (days_ahead / 30.0))
    else:
        days_ago = abs(delta) / 86400
        time_score = max(0.0, 0.5 - (days_ago / 14.0))

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
        match = re.search(pattern, combined)
        if match:
            matched_term = match.group(0).strip()
            # Check if this is a TAMU satellite campus (e.g. "TAMU Galveston", "TAMU Qatar")
            # In that case, do NOT give a TAMU exception — it's a different campus
            context_window = combined[max(0, match.start() - 20):match.end() + 20]
            is_satellite_campus = (
                f"tamu {matched_term}" in context_window
                or f"texas a&m {matched_term}" in context_window
                or f"a&m {matched_term}" in context_window
                or f"tamu at {matched_term}" in context_window
            )
            if is_satellite_campus:
                return False  # Satellite campus → filter out
            # For other uses (e.g. "TAMU professor presents in Houston"), keep
            if "tamu" in combined or "texas a&m" in combined:
                continue
            return False
    return True


def _is_undergrad_relevant(event_dict: Dict[str, Any]) -> bool:
    """Check if event is relevant to undergrads. Lenient — keep most events."""
    title = (event_dict.get("title") or "").lower()
    tags = [t.lower() for t in event_dict.get("tags", [])]
    combined = f"{title} {' '.join(tags)}"

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


def _coerce_str_list(value: Any) -> List[str]:
    """Coerce arbitrary values into a cleaned string list."""
    if not value:
        return []
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str):
        return [value.strip()] if value.strip() else []
    return [str(value).strip()]


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
        if 0 < diff < 86400:
            duration_minutes = int(diff / 60)

    # Determine host_type
    host_type = raw.get("host_type", "unknown")

    # --- Department mapping ---
    dept_code = raw.get("department_code")
    dept_name = raw.get("department_name")
    inferred_host_type = None
    if not dept_code and not dept_name:
        dept_code, dept_name, inferred_host_type = map_department(
            source_name=raw.get("source_name"),
            host_name=raw.get("host_name"),
            location=raw.get("location"),
            title=raw.get("title"),
            description=raw.get("description"),
        )
    # Use inferred host_type if the raw one is unknown
    if host_type == "unknown" and inferred_host_type:
        host_type = inferred_host_type

    # Student org probability heuristic
    student_org_prob = 0.0
    if host_type == "student_org":
        student_org_prob = 0.9
    elif host_type == "center":
        student_org_prob = 0.5
    elif raw.get("source_name", "") in (
        "student_activities", "student_interest", "student_orgs",
        "getinvolved_events", "msc", "getinvolved_student_life",
    ):
        student_org_prob = 0.7
    elif "getinvolved_search" in raw.get("source_name", ""):
        student_org_prob = 0.8

    # --- Food detection v3 (with source priors) ---
    has_food, food_confidence, food_reasons, food_type = detect_food(
        title=raw.get("title", ""),
        description=raw.get("description"),
        host_name=raw.get("host_name"),
        tags=raw.get("tags", []),
        host_type=host_type,
        duration_minutes=duration_minutes,
        source_name=raw.get("source_name"),
    )

    # --- Category classification ---
    categories, category_reasons = classify_event(
        title=raw.get("title", ""),
        description=raw.get("description"),
        host_name=raw.get("host_name"),
        location=raw.get("location"),
        tags=raw.get("tags"),
        source_name=raw.get("source_name"),
    )

    # Sync food category with food detector
    if has_food:
        categories["food"] = 1
        if "food:detector" not in category_reasons:
            category_reasons.append("food:detector")

    # Freshness
    freshness = _compute_freshness(start_time, source_priority)

    # Timestamps
    now = datetime.utcnow()
    first_seen = existing_event.first_seen_at if existing_event else now
    last_seen = now

    # Source traceability
    source_links = raw.get("source_links", [])
    if raw.get("source_url") and raw["source_url"] not in source_links:
        source_links.append(raw["source_url"])
    if raw.get("event_url") and raw["event_url"] not in source_links:
        source_links.append(raw["event_url"])

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
            department_code=dept_code,
            department_name=dept_name,
            source_name=raw.get("source_name", "unknown"),
            source_url=raw.get("source_url", ""),
            source_links=source_links,
            event_url=raw.get("event_url"),
            discovered_via=raw.get("discovered_via"),
            crawl_path=raw.get("crawl_path", []),
            registration_start=_safe_parse_dt(raw.get("registration_start")),
            registration_end=_safe_parse_dt(raw.get("registration_end")),
            registration_status=raw.get("registration_status"),
            seats_available=raw.get("seats_available"),
            seats_total=raw.get("seats_total"),
            prerequisites=_coerce_str_list(raw.get("prerequisites")),
            tags=raw.get("tags", []),
            has_food=has_food,
            food_confidence=food_confidence,
            food_reasons=food_reasons,
            food_type=food_type,
            # Category flags
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
    """Normalise a batch of raw event dicts into Event models."""
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
