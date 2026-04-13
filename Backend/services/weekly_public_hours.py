"""
Typical fall/spring public hours by day of week (America/Chicago).
Curated from official Texas A&M library, dining, and parking guidance; confirm on venue sites for breaks/holidays.
Day keys must match strftime("%A") in en_US: Monday ... Sunday.
"""

from __future__ import annotations

from typing import Dict, Optional

# Visitor garages (Transportation): paid visitor parking generally available around the clock; enforcement varies by permit.
_VISITOR_GARAGE_HOURS = (
    "24/7 card access for permitted parkers; paid visitor parking available (see Transportation Services for rates and restrictions)."
)

# Surface / general permit lots — no per-lot live counts published by TAMU
_SURFACE_LOT_HOURS = (
    "Permit and enforcement rules are posted on signage. Live visitor space counts are published only for the five visitor garages."
)

WEEKLY_HOURS_BY_PLACE_ID: Dict[str, Dict[str, str]] = {
    # ── Libraries (typical academic semester; Evans complex often extends overnight) ──
    "libr": {
        "Sunday": "10:00 AM - 2:00 AM",
        "Monday": "Open 24 hours",
        "Tuesday": "Open 24 hours",
        "Wednesday": "Open 24 hours",
        "Thursday": "Open 24 hours",
        "Friday": "7:30 AM - 9:00 PM",
        "Saturday": "10:00 AM - 9:00 PM",
    },
    "annex": {
        "Sunday": "10:00 AM - 2:00 AM",
        "Monday": "7:30 AM - 2:00 AM",
        "Tuesday": "7:30 AM - 2:00 AM",
        "Wednesday": "7:30 AM - 2:00 AM",
        "Thursday": "7:30 AM - 2:00 AM",
        "Friday": "7:30 AM - 9:00 PM",
        "Saturday": "10:00 AM - 9:00 PM",
    },
    "wcl": {
        "Sunday": "1:00 PM - 10:00 PM",
        "Monday": "7:30 AM - 10:00 PM",
        "Tuesday": "7:30 AM - 10:00 PM",
        "Wednesday": "7:30 AM - 10:00 PM",
        "Thursday": "7:30 AM - 10:00 PM",
        "Friday": "7:30 AM - 6:00 PM",
        "Saturday": "1:00 PM - 6:00 PM",
    },
    "msl": {
        "Sunday": "Closed",
        "Monday": "7:30 AM - 6:00 PM",
        "Tuesday": "7:30 AM - 6:00 PM",
        "Wednesday": "7:30 AM - 6:00 PM",
        "Thursday": "7:30 AM - 6:00 PM",
        "Friday": "7:30 AM - 6:00 PM",
        "Saturday": "Closed",
    },
    "cush": {
        "Sunday": "Closed",
        "Monday": "9:00 AM - 5:00 PM",
        "Tuesday": "9:00 AM - 5:00 PM",
        "Wednesday": "9:00 AM - 5:00 PM",
        "Thursday": "9:00 AM - 5:00 PM",
        "Friday": "9:00 AM - 5:00 PM",
        "Saturday": "Closed",
    },
    "psel": {
        "Sunday": "Closed",
        "Monday": "8:00 AM - 5:00 PM",
        "Tuesday": "8:00 AM - 5:00 PM",
        "Wednesday": "8:00 AM - 5:00 PM",
        "Thursday": "8:00 AM - 5:00 PM",
        "Friday": "8:00 AM - 5:00 PM",
        "Saturday": "Closed",
    },
    "bush-lib": {
        "Sunday": "Closed",
        "Monday": "9:00 AM - 5:00 PM",
        "Tuesday": "9:00 AM - 5:00 PM",
        "Wednesday": "9:00 AM - 5:00 PM",
        "Thursday": "9:00 AM - 5:00 PM",
        "Friday": "9:00 AM - 5:00 PM",
        "Saturday": "Closed",
    },
    # ── Major dining (residential / hubs — typical service windows; meal periods vary) ──
    "sbisa": {
        "Sunday": "10:30 AM - 8:00 PM",
        "Monday": "6:30 AM - 8:00 PM",
        "Tuesday": "6:30 AM - 8:00 PM",
        "Wednesday": "6:30 AM - 8:00 PM",
        "Thursday": "6:30 AM - 8:00 PM",
        "Friday": "6:30 AM - 8:00 PM",
        "Saturday": "10:30 AM - 8:00 PM",
    },
    "commons": {
        "Sunday": "9:00 AM - 8:00 PM",
        "Monday": "6:30 AM - 8:00 PM",
        "Tuesday": "6:30 AM - 8:00 PM",
        "Wednesday": "6:30 AM - 8:00 PM",
        "Thursday": "6:30 AM - 8:00 PM",
        "Friday": "6:30 AM - 8:00 PM",
        "Saturday": "10:30 AM - 8:00 PM",
    },
    "duncan": {
        "Sunday": "10:30 AM - 8:00 PM",
        "Monday": "6:30 AM - 8:00 PM",
        "Tuesday": "6:30 AM - 8:00 PM",
        "Wednesday": "6:30 AM - 8:00 PM",
        "Thursday": "6:30 AM - 8:00 PM",
        "Friday": "6:30 AM - 8:00 PM",
        "Saturday": "10:30 AM - 8:00 PM",
    },
    "west-campus-dining": {
        "Sunday": "10:30 AM - 8:00 PM",
        "Monday": "6:30 AM - 8:00 PM",
        "Tuesday": "6:30 AM - 8:00 PM",
        "Wednesday": "6:30 AM - 8:00 PM",
        "Thursday": "6:30 AM - 8:00 PM",
        "Friday": "6:30 AM - 8:00 PM",
        "Saturday": "10:30 AM - 8:00 PM",
    },
    "msc": {
        "Sunday": "10:00 AM - 10:00 PM",
        "Monday": "6:00 AM - 11:00 PM",
        "Tuesday": "6:00 AM - 11:00 PM",
        "Wednesday": "6:00 AM - 11:00 PM",
        "Thursday": "6:00 AM - 11:00 PM",
        "Friday": "6:00 AM - 11:00 PM",
        "Saturday": "10:00 AM - 11:00 PM",
    },
    "polo-garage-food": {
        "Sunday": "Closed",
        "Monday": "7:00 AM - 10:00 PM",
        "Tuesday": "7:00 AM - 10:00 PM",
        "Wednesday": "7:00 AM - 10:00 PM",
        "Thursday": "7:00 AM - 10:00 PM",
        "Friday": "7:00 AM - 10:00 PM",
        "Saturday": "10:00 AM - 10:00 PM",
    },
    "underground-food": {
        "Sunday": "Closed",
        "Monday": "7:00 AM - 8:00 PM",
        "Tuesday": "7:00 AM - 8:00 PM",
        "Wednesday": "7:00 AM - 8:00 PM",
        "Thursday": "7:00 AM - 8:00 PM",
        "Friday": "7:00 AM - 8:00 PM",
        "Saturday": "Closed",
    },
}

# Five visitor garages with live counts on transport.tamu.edu
VISITOR_GARAGE_PLACE_IDS = frozenset(
    {
        "osm:way:91100311",
        "garage-polo",
        "osm:way:450686873",
        "garage-university-center",
        "garage-west-campus",
    }
)


def today_hours_for_place(
    *,
    place_id: Optional[str],
    place_type: str,
    registry_hours: Optional[str],
    now_weekday_name: str,
) -> Optional[str]:
    """Return human-readable hours line for the given Central Time weekday."""
    if not place_id:
        return None

    weekly = WEEKLY_HOURS_BY_PLACE_ID.get(place_id)
    if weekly:
        slot = weekly.get(now_weekday_name)
        if slot:
            return slot

    if place_type == "Parking":
        if place_id in VISITOR_GARAGE_PLACE_IDS:
            return _VISITOR_GARAGE_HOURS
        return _SURFACE_LOT_HOURS

    if registry_hours:
        return registry_hours

    if place_type == "Dining":
        return "Hours vary - check the venue website or Texas A&M Dining."

    return None
