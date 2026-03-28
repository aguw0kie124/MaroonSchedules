"""Event deduplicator using title similarity, datetime window, and location fuzzy match."""

from __future__ import annotations

import hashlib
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple

from rapidfuzz import fuzz

from models import Event

logger = logging.getLogger("tamu_crawler.deduper")

# Thresholds
TITLE_SIMILARITY_THRESHOLD = 85  # rapidfuzz ratio
LOCATION_SIMILARITY_THRESHOLD = 70
TIME_WINDOW_HOURS = 2

# Source priority ordering for choosing the "best" version
SOURCE_PRIORITY_ORDER = {
    "high": 3,
    "medium": 2,
    "low": 1,
}

# TAMU venue name normalization — map abbreviations to canonical names
VENUE_ALIASES: Dict[str, str] = {
    "msc": "memorial student center",
    "hrbb": "halbouty building",
    "bloc": "blocker building",
    "zach": "zachry engineering education complex",
    "etb": "engineering technology building",
    "eabc": "emerging technologies building",
    "ilcb": "interdisciplinary life sciences building",
    "hecc": "haynes engineering building",
    "petr": "peterson building",
    "rich": "richardson building",
    "held": "held hall",
    "sbisa": "sbisa dining hall",
    "rudder": "rudder tower",
    "reed": "reed arena",
    "kyle": "kyle field",
    "memorial student center": "memorial student center",
    "student center": "memorial student center",
    "commons": "the commons",
    "12th man": "12th man hall",
    "wehner": "wehner building",
    "harrington": "harrington tower",
}


def _time_close(dt1: datetime, dt2: datetime, hours: int = TIME_WINDOW_HOURS) -> bool:
    """Check if two datetimes are within the given window."""
    # Ensure both are naive for comparison
    d1 = dt1.replace(tzinfo=None) if dt1.tzinfo else dt1
    d2 = dt2.replace(tzinfo=None) if dt2.tzinfo else dt2
    return abs((d1 - d2).total_seconds()) <= hours * 3600


def _title_similar(t1: str, t2: str) -> float:
    """Return title similarity ratio (0-100)."""
    return fuzz.ratio(t1.lower().strip(), t2.lower().strip())


def _normalize_venue(location: str | None) -> str:
    """Normalize venue name using TAMU abbreviation map."""
    if not location:
        return ""
    loc = location.lower().strip()
    # Check if any alias matches the start of the location
    for alias, canonical in VENUE_ALIASES.items():
        if loc == alias or loc.startswith(alias + " ") or loc.startswith(alias + ","):
            return canonical
    return loc


def _location_similar(l1: str | None, l2: str | None) -> float:
    """Return location similarity ratio (0-100). None locations get a pass."""
    if not l1 or not l2:
        return 100.0  # If either is missing, don't penalise
    # Normalize venue names before comparison
    n1 = _normalize_venue(l1)
    n2 = _normalize_venue(l2)
    return fuzz.ratio(n1, n2)


def _generate_group_id(event: Event) -> str:
    """Generate a stable dedup group ID from normalised title + date."""
    key = f"{event.title.lower().strip()}:{event.start_time.date().isoformat()}"
    return hashlib.md5(key.encode()).hexdigest()[:12]


def _is_duplicate(event_a: Event, event_b: Event) -> bool:
    """Check if two events are duplicates based on multi-signal matching."""
    # Same ID is always a duplicate
    if event_a.id == event_b.id:
        return True

    # Same content hash
    if event_a.content_hash and event_a.content_hash == event_b.content_hash:
        return True

    # Multi-signal: title + time + location
    title_sim = _title_similar(event_a.title, event_b.title)
    if title_sim < TITLE_SIMILARITY_THRESHOLD:
        return False

    if not _time_close(event_a.start_time, event_b.start_time):
        return False

    loc_sim = _location_similar(event_a.location, event_b.location)
    if loc_sim < LOCATION_SIMILARITY_THRESHOLD:
        return False

    return True


def _pick_best(events: List[Event]) -> Event:
    """From a group of duplicates, pick the best version.

    Strategy: prefer highest food_confidence, then highest freshness_score,
    then most complete data.
    """
    def score(e: Event) -> Tuple[float, float, int, int]:
        completeness = sum([
            bool(e.description),
            bool(e.location),
            bool(e.event_url),
            bool(e.host_name),
            len(e.tags) > 0,
            bool(e.location_lat),
        ])
        return (
            e.food_confidence,
            e.freshness_score,
            completeness,
            len(e.description or ""),
        )

    return max(events, key=score)


def deduplicate(events: List[Event]) -> List[Event]:
    """Deduplicate a list of events.

    Groups duplicates together, picks the best version of each group,
    and assigns a dedupe_group_id.

    Returns:
        Deduplicated list of events.
    """
    if not events:
        return []

    # Build groups via pairwise comparison
    # For efficiency, group by date first
    by_date: Dict[str, List[Event]] = {}
    for event in events:
        date_key = event.start_time.date().isoformat()
        by_date.setdefault(date_key, []).append(event)

    groups: List[List[Event]] = []
    processed_ids: set = set()

    for date_key, date_events in by_date.items():
        for i, event_a in enumerate(date_events):
            if event_a.id in processed_ids:
                continue

            group = [event_a]
            processed_ids.add(event_a.id)

            for j in range(i + 1, len(date_events)):
                event_b = date_events[j]
                if event_b.id in processed_ids:
                    continue

                if _is_duplicate(event_a, event_b):
                    group.append(event_b)
                    processed_ids.add(event_b.id)

            groups.append(group)

    # Pick best from each group
    result: List[Event] = []
    dup_count = 0

    for group in groups:
        best = _pick_best(group)
        best.dedupe_group_id = _generate_group_id(best)
        best.sources_seen = len({e.source_name for e in group})

        if len(group) > 1:
            dup_count += len(group) - 1
            logger.debug(
                "Dedup group (%d events, %d sources): %s",
                len(group),
                best.sources_seen,
                best.title[:60],
            )

        result.append(best)

    logger.info(
        "Deduplication: %d events → %d unique (%d duplicates removed)",
        len(events),
        len(result),
        dup_count,
    )
    return result
