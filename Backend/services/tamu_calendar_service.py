"""Lightweight campus calendar hints (holidays / closures) for Places map hours."""

from __future__ import annotations

from datetime import date, datetime
from typing import Optional
from zoneinfo import ZoneInfo

CHICAGO = ZoneInfo("America/Chicago")

# Observed university-wide closure / holiday dates (extend as needed).
# Verify against https://registrar.tamu.edu/ or official calendars.
TAMU_CLOSURE_DATES: frozenset[date] = frozenset(
    {
        date(2026, 1, 1),
        date(2026, 1, 19),  # MLK Day
        date(2026, 3, 16),  # Spring break week (approximate M–F block)
        date(2026, 3, 17),
        date(2026, 3, 18),
        date(2026, 3, 19),
        date(2026, 3, 20),
        date(2026, 5, 25),  # Memorial Day
        date(2026, 7, 3),  # Independence Day observed (Friday)
        date(2026, 7, 4),
        date(2026, 9, 7),  # Labor Day
        date(2026, 11, 26),  # Thanksgiving
        date(2026, 11, 27),
        date(2026, 12, 24),
        date(2026, 12, 25),
        date(2026, 12, 31),
        date(2027, 1, 1),
    }
)

HOLIDAY_HOURS_NOTICE = (
    "Texas A&M may be closed or on a special schedule today — confirm hours on the venue website."
)


def campus_today_chicago() -> date:
    return datetime.now(CHICAGO).date()


def holiday_hours_notice_for_date(day: Optional[date] = None) -> Optional[str]:
    d = day or campus_today_chicago()
    if d in TAMU_CLOSURE_DATES:
        return HOLIDAY_HOURS_NOTICE
    return None
