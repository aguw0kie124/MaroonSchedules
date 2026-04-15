"""Weekly Rec Sports hours keyed by legacy facility ids (student-rec, etc.)."""

from __future__ import annotations

from typing import Any, Dict

# place_id on the campus registry -> key in FALL_SPRING / SUMMER tables
REC_PLACE_ID_TO_FACILITY_KEY: Dict[str, str] = {
    "rec": "student-rec",
    "southside-rec": "southside-rec",
    "polo-rec": "polo-road-rec",
}

FALL_SPRING_HOURS_BY_FACILITY: Dict[str, Dict[str, str]] = {
    "student-rec": {
        "Sunday": "12:00 PM - 11:59 PM",
        "Monday": "6:00 AM - 11:59 PM",
        "Tuesday": "6:00 AM - 11:59 PM",
        "Wednesday": "6:00 AM - 11:59 PM",
        "Thursday": "6:00 AM - 11:59 PM",
        "Friday": "6:00 AM - 11:00 PM",
        "Saturday": "10:00 AM - 11:00 PM",
    },
    "southside-rec": {
        "Sunday": "12:00 PM - 11:59 PM",
        "Monday": "5:30 AM - 11:59 PM",
        "Tuesday": "5:30 AM - 11:59 PM",
        "Wednesday": "5:30 AM - 11:59 PM",
        "Thursday": "5:30 AM - 11:59 PM",
        "Friday": "5:30 AM - 11:00 PM",
        "Saturday": "10:00 AM - 11:00 PM",
    },
    "polo-road-rec": {
        "Sunday": "Closed",
        "Monday": "6:00 AM - 9:00 PM",
        "Tuesday": "6:00 AM - 9:00 PM",
        "Wednesday": "6:00 AM - 9:00 PM",
        "Thursday": "6:00 AM - 9:00 PM",
        "Friday": "6:00 AM - 9:00 PM",
        "Saturday": "Closed",
    },
    "penberthy": {
        "Sunday": "North: 3:00 PM - 10:00 PM\nSouth: 3:00 PM - 10:00 PM",
        "Monday": "North: 5:00 PM - 10:00 PM\nSouth: 5:00 PM - 10:00 PM",
        "Tuesday": "North: 5:00 PM - 10:00 PM\nSouth: 5:00 PM - 10:00 PM",
        "Wednesday": "North: 5:00 PM - 10:00 PM\nSouth: 5:00 PM - 10:00 PM",
        "Thursday": "North: 5:00 PM - 10:00 PM\nSouth: 5:00 PM - 10:00 PM",
        "Friday": "North: 5:00 PM - 8:00 PM\nSouth: Closed",
        "Saturday": "North: 12:00 PM - 8:00 PM\nSouth: Closed",
    },
    "peap": {
        "Sunday": "6:00 PM - 11:00 PM",
        "Monday": "6:00 PM - 11:00 PM",
        "Tuesday": "6:00 PM - 11:00 PM",
        "Wednesday": "6:00 PM - 11:00 PM",
        "Thursday": "6:00 PM - 11:00 PM",
        "Friday": "Closed",
        "Saturday": "Closed",
    },
    "tennis-center": {
        "Sunday": "3:00 PM - 10:00 PM",
        "Monday": "6:00 PM - 10:00 PM",
        "Tuesday": "6:00 PM - 10:00 PM",
        "Wednesday": "6:00 PM - 10:00 PM",
        "Thursday": "6:00 PM - 10:00 PM",
        "Friday": "5:00 PM - 8:00 PM",
        "Saturday": "5:00 PM - 8:00 PM",
    },
}

SUMMER_HOURS_BY_FACILITY: Dict[str, Dict[str, str]] = {
    "student-rec": {
        "Sunday": "12:00 PM - 10:00 PM",
        "Monday": "6:00 AM - 10:00 PM",
        "Tuesday": "6:00 AM - 10:00 PM",
        "Wednesday": "6:00 AM - 10:00 PM",
        "Thursday": "6:00 AM - 10:00 PM",
        "Friday": "6:00 AM - 10:00 PM",
        "Saturday": "9:00 AM - 10:00 PM",
    },
    "southside-rec": {
        "Sunday": "12:00 PM - 10:00 PM",
        "Monday": "6:00 AM - 10:00 PM",
        "Tuesday": "6:00 AM - 10:00 PM",
        "Wednesday": "6:00 AM - 10:00 PM",
        "Thursday": "6:00 AM - 10:00 PM",
        "Friday": "6:00 AM - 10:00 PM",
        "Saturday": "9:00 AM - 10:00 PM",
    },
    "polo-road-rec": {
        "Sunday": "12:00 PM - 10:00 PM",
        "Monday": "6:00 AM - 10:00 PM",
        "Tuesday": "6:00 AM - 10:00 PM",
        "Wednesday": "6:00 AM - 10:00 PM",
        "Thursday": "6:00 AM - 10:00 PM",
        "Friday": "6:00 AM - 10:00 PM",
        "Saturday": "9:00 AM - 10:00 PM",
    },
    "penberthy": {
        "Sunday": "7:00 PM - 10:00 PM",
        "Monday": "7:00 PM - 10:00 PM",
        "Tuesday": "7:00 PM - 10:00 PM",
        "Wednesday": "7:00 PM - 10:00 PM",
        "Thursday": "7:00 PM - 10:00 PM",
        "Friday": "5:00 PM - 8:00 PM",
        "Saturday": "5:00 PM - 8:00 PM",
    },
    "peap": {
        "Sunday": "4:00 PM - 10:00 PM",
        "Monday": "5:00 PM - 10:00 PM",
        "Tuesday": "5:00 PM - 10:00 PM",
        "Wednesday": "5:00 PM - 10:00 PM",
        "Thursday": "5:00 PM - 10:00 PM",
        "Friday": "Closed",
        "Saturday": "Closed",
    },
    "tennis-center": {
        "Sunday": "7:00 PM - 10:00 PM",
        "Monday": "7:00 PM - 10:00 PM",
        "Tuesday": "7:00 PM - 10:00 PM",
        "Wednesday": "7:00 PM - 10:00 PM",
        "Thursday": "7:00 PM - 10:00 PM",
        "Friday": "5:00 PM - 8:00 PM",
        "Saturday": "5:00 PM - 8:00 PM",
    },
}


def weekly_payload_for_facility_key(facility_key: str, now_chi: Any) -> Dict[str, Any]:
    """Build cached weekly-hours payload (matches campus_hub expectations)."""
    month = now_chi.month
    season = "summer" if month in (5, 6, 7, 8) else "fall_spring"
    lookup = SUMMER_HOURS_BY_FACILITY if season == "summer" else FALL_SPRING_HOURS_BY_FACILITY
    weekly_hours = lookup.get(facility_key) or {}
    day_name = now_chi.strftime("%A")
    today_hours = weekly_hours.get(day_name, "Check official facility page")
    source_note = (
        "Fall/spring operating hours based on official Texas A&M Rec Sports staffing/facility schedules."
        if season == "fall_spring"
        else "Summer operating hours based on official Texas A&M Rec Sports facility schedules."
    )
    return {
        "weekly_hours": [{"day": day, "hours": hours} for day, hours in weekly_hours.items()],
        "today_hours": today_hours,
        "hours_source": source_note,
    }
