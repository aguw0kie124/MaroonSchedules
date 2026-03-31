"""LiveWhale JSON API parser for TAMU calendars."""

from __future__ import annotations

import json
import logging
import re
from datetime import datetime
from typing import Any, Dict, List, Optional

from dateutil import parser as dtparse

logger = logging.getLogger("tamu_crawler.parsers.livewhale")

# Known group → host-type mapping
HOST_TYPE_MAP: Dict[str, str] = {
    "student activities": "student_org",
    "student interest": "student_org",
    "student organizations": "student_org",
    "msc": "center",
    "career center": "center",
    "rec sports": "department",
    "registrar": "department",
    "engineering": "department",
    "liberal arts": "department",
    "science": "department",
    "bush school": "department",
    "main university calendar": "university",
}

# Patterns for non-College-Station locations
NON_CS_PATTERNS = [
    r"\bgalveston\b",
    r"\bmays\s+in\s+dc\b",
    r"\bqatar\b",
    r"\bhealth\s+science\s+center\b",
    r"\bhouston\b",
    r"\bdallas\b",
    r"\bmcallen\b",
    r"\bonline\s+only\b",
]


def _strip_html(text: str | None) -> str:
    """Strip HTML tags from a string."""
    if not text:
        return ""
    return re.sub(r"<[^>]+>", "", text).strip()


def _is_college_station(event: Dict[str, Any]) -> bool:
    """Check if event is likely a College Station event."""
    location = (event.get("location") or "").lower()
    title = (event.get("title") or "").lower()
    combined = f"{location} {title}"

    for pattern in NON_CS_PATTERNS:
        if re.search(pattern, combined):
            return False
    return True


def _determine_host_type(group_title: str | None) -> str:
    """Map group_title to a host type."""
    if not group_title:
        return "unknown"
    key = group_title.lower().strip()
    for pattern, htype in HOST_TYPE_MAP.items():
        if pattern in key:
            return htype
    return "department"


def _parse_geo(event: Dict[str, Any]) -> tuple[Optional[float], Optional[float]]:
    """Extract lat/lng from event data."""
    lat = event.get("latitude") or event.get("geo", {}).get("latitude") if isinstance(event.get("geo"), dict) else None
    lng = event.get("longitude") or event.get("geo", {}).get("longitude") if isinstance(event.get("geo"), dict) else None
    try:
        return (float(lat), float(lng)) if lat and lng else (None, None)
    except (ValueError, TypeError):
        return None, None


def _parse_tags(event: Dict[str, Any]) -> List[str]:
    """Extract tags from event data."""
    tags = []
    # LiveWhale sometimes has tags as a comma-separated string or a list
    raw_tags = event.get("tags", [])
    if isinstance(raw_tags, str):
        tags = [t.strip() for t in raw_tags.split(",") if t.strip()]
    elif isinstance(raw_tags, list):
        for t in raw_tags:
            if isinstance(t, dict):
                tags.append(t.get("name", str(t)))
            else:
                tags.append(str(t).strip())
    # Also pull from categories
    if cats := event.get("categories"):
        if isinstance(cats, list):
            for c in cats:
                if isinstance(c, dict):
                    tags.append(c.get("name", str(c)))
                else:
                    tags.append(str(c).strip())
    return [t for t in tags if t]


def parse_single_event(
    event: Dict[str, Any], source_name: str, source_url: str
) -> Optional[Dict[str, Any]]:
    """Parse a single LiveWhale JSON event into a normalised dict.

    Returns None if the event should be skipped (e.g. non-CS).
    """
    if not _is_college_station(event):
        return None

    # Parse dates
    try:
        date_str = event.get("date_iso") or event.get("date", "")
        time_str = event.get("date_time") or ""
        # Try date_iso first (most reliable)
        if date_str:
            start_time = dtparse.parse(date_str)
        else:
            start_time = dtparse.parse(time_str) if time_str else None

        if not start_time:
            logger.debug("Skipping event with no date: %s", event.get("title"))
            return None
    except (ValueError, TypeError) as exc:
        logger.debug("Could not parse date for '%s': %s", event.get("title"), exc)
        return None

    # End time
    end_time = None
    if end_str := event.get("date2_iso") or event.get("date_end"):
        try:
            end_time = dtparse.parse(end_str)
        except (ValueError, TypeError):
            pass

    lat, lng = _parse_geo(event)
    eid = event.get("id") or event.get("event_id") or ""
    group_title = event.get("group_title") or event.get("calendar", "")

    return {
        "id": f"tamu:livewhale:{eid}",
        "title": _strip_html(event.get("title", "")).strip(),
        "description": _strip_html(event.get("description", "")),
        "start_time": start_time.isoformat(),
        "end_time": end_time.isoformat() if end_time else None,
        "timezone": "America/Chicago",
        "location": _strip_html(event.get("location", "")),
        "location_lat": lat,
        "location_lng": lng,
        "host_name": group_title or source_name,
        "host_type": _determine_host_type(group_title),
        "source_name": source_name,
        "source_url": source_url,
        "event_url": event.get("url") or event.get("event_url") or None,
        "tags": _parse_tags(event),
        "audience": ["undergrad"],
        "campus": "college_station",
        "raw_payload": event,
    }


async def parse_livewhale(
    body: str | None,
    source_name: str,
    source_url: str,
    **kwargs: Any,
) -> List[Dict[str, Any]]:
    """Parse a LiveWhale JSON API response.

    Args:
        body: Raw response text (JSON array).
        source_name: Name of the source in sources.yaml.
        source_url: URL that was fetched.

    Returns:
        List of normalised event dicts ready for the normaliser.
    """
    if not body:
        return []

    try:
        data = json.loads(body)
    except json.JSONDecodeError as exc:
        logger.error("Invalid JSON from %s: %s", source_url, exc)
        return []

    if not isinstance(data, list):
        logger.warning("Expected JSON array from %s, got %s", source_url, type(data).__name__)
        # Some endpoints wrap in an object
        if isinstance(data, dict) and "events" in data:
            data = data["events"]
        else:
            return []

    events: List[Dict[str, Any]] = []
    for raw_event in data:
        if not isinstance(raw_event, dict):
            continue
        parsed = parse_single_event(raw_event, source_name, source_url)
        if parsed:
            events.append(parsed)

    logger.info("Parsed %d events from %s (of %d raw)", len(events), source_name, len(data))
    return events
