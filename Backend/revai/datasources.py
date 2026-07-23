"""
revai/datasources.py
---------------------
Narrow adapter between RevAI and the app's data layer.

Everything RevAI needs from the rest of the backend — the course catalog,
grade-distribution rows, campus places, dining hours, facility capacity,
events, and a user's saved schedule — is routed through this module. Nothing
else under revai/ imports `repositories.*`, `routers.*`, or `services.*`
directly — the app's data layer can change shape without touching RevAI, and
RevAI could be extracted to its own service later by reimplementing just this
file against an internal API.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional


def get_all_courses() -> List[Dict[str, Any]]:
    """The in-memory course catalog (cached; see repositories.course_repository)."""
    from repositories import course_repository

    return course_repository.get_all_courses()


def load_grade_rows(subject: str, course_number: str) -> List[Dict[str, Any]]:
    """Grade-distribution rows for a course: file cache, else live-fetch-and-cache."""
    from services import grades_service

    return grades_service.load_or_fetch(subject, course_number)


def resolve_campus_place(name: str) -> Optional[Dict[str, Any]]:
    """Resolve free-text (e.g. 'the rec', 'sbisa', 'evans library') to a
    campus_registry place dict ({place_id, name, type, ...}). Tries the
    registry's exact/alias lookup first, then a loose fuzzy match over every
    place's name/short_name/aliases so casual phrasing still resolves."""
    from services import place_registry_service

    place = place_registry_service.resolve_place(name)
    if place:
        return place

    import difflib

    labels: Dict[str, Dict[str, Any]] = {}
    for candidate in place_registry_service.get_all_places():
        for label in (candidate.get("name"), candidate.get("short_name"), *(candidate.get("aliases") or [])):
            if label:
                labels[label.lower()] = candidate

    matches = difflib.get_close_matches((name or "").lower(), labels.keys(), n=1, cutoff=0.6)
    return labels.get(matches[0]) if matches else None


def dining_hours_raw(place_id: str) -> Dict[str, Optional[str]]:
    """{'live': str|None, 'static': str|None} hours text for a dining place_id.
    'live' comes from today's actual DineOnCampus meal periods (may be None if
    that call fails); 'static' is the typical weekday hours table."""
    from datetime import datetime

    from services import dineoncampus_hours_service, weekly_public_hours
    from services.dining_service import CENTRAL_TZ

    now = datetime.now(CENTRAL_TZ)
    try:
        live = dineoncampus_hours_service.fetch_hours_line_for_place_id(place_id, now.strftime("%Y-%m-%d"))
    except Exception:  # noqa: BLE001 - best-effort; static hours still apply
        live = None

    static = weekly_public_hours.today_hours_for_place(
        place_id=place_id,
        place_type="Dining",
        registry_hours=None,
        now_weekday_name=now.strftime("%A"),
    )
    return {"live": live, "static": static}


def facility_capacity_raw(place_id: str) -> Dict[str, Any]:
    """Realtime capacity snapshot entry for a rec/library place_id, or {} if
    that place has no live capacity data."""
    from services import campus_places_service

    snapshot = campus_places_service.get_places_capacity_realtime_snapshot()
    return (
        snapshot.get("recreation", {}).get("locations", {}).get(place_id)
        or snapshot.get("libraries", {}).get("locations", {}).get(place_id)
        or {}
    )


def campus_events_raw(category: Optional[str] = None, limit: int = 40) -> List[Dict[str, Any]]:
    """Upcoming campus events (crawler-fed, cached), optionally filtered by
    category. No user context — always called anonymous (clerk_id=None)."""
    from services import campus_hub_service

    snapshot = campus_hub_service.get_events_snapshot(clerk_id=None, limit=limit, category=category)
    return snapshot.get("events") or []


def user_schedule_sections_raw(clerk_id: str) -> List[Dict[str, Any]]:
    """The signed-in user's enrolled sections across all their schedules,
    expanded to full section metadata (mirrors main.py's /user/schedule)."""
    from repositories import course_repository
    from services import user_service

    schedules = user_service.get_schedules(clerk_id)
    all_section_ids = {sid for sched in schedules for sid in sched.get("section_ids", [])}
    sections = course_repository.get_sections_by_ids(list(all_section_ids))
    section_map = {str(s.get("id")): s for s in sections}

    out: List[Dict[str, Any]] = []
    for sched in schedules:
        for section_id in sched.get("section_ids", []):
            section = section_map.get(section_id)
            if section:
                out.append(section)
    return out
