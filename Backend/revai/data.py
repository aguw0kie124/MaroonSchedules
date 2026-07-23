"""Pure campus-data helpers for RevAI (no LLM, no framework).

Shared by the Pydantic AI agent tools (revai/agent.py) and the deterministic
fallback (revai/dispatch.py). Kept framework-free so both can import it
without circular dependencies.

- Course facts come from the in-memory course catalog (datasources.get_all_courses).
- Professor GPAs come from the grades file-first-then-live loader
  (datasources.load_grade_rows): a course we've never seen is fetched from
  anex.us on demand and written through to the Data/grades cache, so coverage
  is the whole catalog (not just a seeded handful) and every later lookup is a
  fast file read.
"""

from __future__ import annotations

import logging
import re
from typing import Any, Dict, List, Optional

from . import datasources

logger = logging.getLogger("backend.revai_data")

GRADE_POINTS = {"A": 4.0, "B": 3.0, "C": 2.0, "D": 1.0, "F": 0.0}


def normalize_code(value: str) -> str:
    """'CSCE 221' / 'csce-221' -> 'CSCE221'."""
    return re.sub(r"[^A-Za-z0-9]", "", value or "").upper()


def course_number(code: str) -> str:
    """'CSCE 221' -> '221' (for the course-list badge)."""
    match = re.search(r"(\d+[A-Za-z]?)", code or "")
    return match.group(1) if match else (code or "")[:4]


def subject_number(code: str) -> "tuple[Optional[str], Optional[str]]":
    """'CSCE 221' -> ('CSCE', '221')."""
    match = re.match(r"\s*([A-Za-z]{2,4})\s*0*(\d{2,4}[A-Za-z]?)", code or "")
    if match:
        return match.group(1).upper(), match.group(2)
    return None, None


def gpa_from_distribution(dist: Optional[Dict[str, Any]]) -> Optional[float]:
    if not isinstance(dist, dict):
        return None
    total = 0.0
    points = 0.0
    for letter, weight in GRADE_POINTS.items():
        count = dist.get(letter)
        if isinstance(count, (int, float)):
            total += count
            points += weight * count
    if total <= 0:
        return None
    return round(points / total, 2)


def find_course(code: str) -> Optional[dict]:
    """Match a course by normalized id or code from the in-memory catalog.

    Course-level facts only (avg GPA, difficulty, credits, prerequisites).
    Deliberately does NOT call get_course_details, which fetches sections we
    don't need (slow, and blocks when the DB is down).
    """
    if not code:
        return None
    normalized = normalize_code(code)
    for candidate in datasources.get_all_courses():
        cand_id = normalize_code(str(candidate.get("id", "")))
        cand_code = normalize_code(str(candidate.get("code", "")))
        if normalized and normalized in (cand_id, cand_code):
            return candidate
    return None


def professors_from_grades(subject: str, number: str) -> List[dict]:
    """Ranked instructors (best GPA first) for a course.

    Uses the grades file-first-then-live-anex loader: a course we've never
    seen is fetched from anex.us on demand and written through to the
    Data/grades cache, so coverage is the whole catalog and every later lookup
    is a fast file read. Any failure (anex down, course not found) degrades to
    an empty list — the caller then says grade data isn't available.
    """
    try:
        rows = datasources.load_grade_rows(subject.upper(), str(number))
    except Exception as exc:  # noqa: BLE001 - grades are best-effort
        logger.warning("grades load failed for %s %s: %s", subject, number, exc)
        return []

    totals: Dict[str, Dict[str, float]] = {}
    for row in rows or []:
        name = str(row.get("instructor") or "").strip()
        if not name or name.upper() in ("STAFF", "TBA"):
            continue
        bucket = totals.setdefault(name, {"A": 0, "B": 0, "C": 0, "D": 0, "F": 0, "sections": 0})
        bucket["A"] += row.get("a_count", 0) or 0
        bucket["B"] += row.get("b_count", 0) or 0
        bucket["C"] += row.get("c_count", 0) or 0
        bucket["D"] += row.get("d_count", 0) or 0
        bucket["F"] += row.get("f_count", 0) or 0
        bucket["sections"] += 1

    professors: List[dict] = []
    for name, bucket in totals.items():
        gpa = gpa_from_distribution(bucket)
        if gpa is None:
            continue
        professors.append({"name": name, "gpa": gpa, "sections": int(bucket["sections"])})

    professors.sort(key=lambda p: p["gpa"], reverse=True)
    return professors


def course_payload(code: str) -> Dict[str, Any]:
    """Build {data, courses} from catalog facts + cached grades.

    `data` is the compact dict handed to the model; `courses` is the structured
    professor list the RevAI screen renders (code/name/meta).
    """
    course = find_course(code)

    display_code = str((course.get("code") if course else None) or code)
    subject, number = subject_number(display_code)
    if not subject:
        subject, number = subject_number(code)

    top = professors_from_grades(subject, number)[:4] if (subject and number) else []
    badge = number or course_number(display_code)

    courses_list = [
        {"code": badge, "name": prof["name"], "meta": f"{prof['gpa']:.2f} GPA"} for prof in top
    ]

    if not course and not top:
        return {"data": None, "courses": None}

    data = {
        "code": display_code,
        "name": course.get("name") if course else None,
        "avgGPA": (course.get("avgGPA") if course and course.get("avgGPA") not in (None, -1) else None),
        "difficulty": course.get("difficulty") if course else None,
        "credits": course.get("credits") if course else None,
        "prerequisites": course.get("prerequisites") if course else None,
        "professors": top,
    }
    return {"data": data, "courses": courses_list or None}


def search_courses_by_name(query: str, limit: int = 6) -> List[dict]:
    """Resolve a course NAME/keyword to real course codes from the catalog.

    Handles natural-language and abbreviations ('linear algebra', 'lin alg',
    'organic chem') via substring + token-prefix matching. Returns the best
    matches as {code, name, avgGPA, difficulty} so the agent can then call the
    code-based tools (get_course_info / get_best_professors).
    """
    q = (query or "").strip().lower()
    if not q:
        return []
    tokens = [t for t in re.split(r"[^a-z0-9]+", q) if t]

    scored: List[tuple] = []
    for c in datasources.get_all_courses():
        name = str(c.get("name") or "").lower()
        code = str(c.get("code") or "").lower()
        if not name and not code:
            continue
        words = [w for w in re.split(r"[^a-z0-9]+", f"{code} {name}") if w]
        if q and (q in name or q in code):
            score = 100
        elif tokens and all(any(w.startswith(t) for w in words) for t in tokens):
            score = 60  # every query token is a prefix of some word ('lin' -> 'linear')
        else:
            continue
        gpa = c.get("avgGPA") if c.get("avgGPA") not in (None, -1) else None
        scored.append((score, gpa or 0.0, c))

    scored.sort(key=lambda x: (-x[0], -x[1]))
    out: List[dict] = []
    for _, _, c in scored[:limit]:
        out.append({
            "code": c.get("code"),
            "name": c.get("name"),
            "avgGPA": c.get("avgGPA") if c.get("avgGPA") not in (None, -1) else None,
            "difficulty": c.get("difficulty"),
        })
    return out


def tamu_query(message: str) -> str:
    """Bias a web-search query toward Texas A&M unless it already mentions it."""
    low = (message or "").lower()
    if any(t in low for t in ("tamu", "texas a&m", "a&m", "aggie")):
        return message
    return f"Texas A&M {message}"


_TIME_RANGE_RE = re.compile(
    r"(\d{1,2}:\d{2}\s*[AaPp][Mm])\s*[-–—]\s*(\d{1,2}:\d{2}\s*[AaPp][Mm])"
)


def _parse_open_now(hours_text: Optional[str]) -> Optional[bool]:
    """Best-effort 'is it open right now' from an hours string like
    'Breakfast: 7:00 AM – 2:30 PM; Lunch: 11:00 AM – 2:00 PM' or
    '7:00 AM - 8:00 PM' or 'Closed'. Returns None if the text doesn't contain
    a recognizable range (caller should omit the status pill in that case)."""
    from datetime import datetime

    from services.dining_service import CENTRAL_TZ

    if not hours_text:
        return None
    if "closed" in hours_text.lower() and not _TIME_RANGE_RE.search(hours_text):
        return False

    ranges = _TIME_RANGE_RE.findall(hours_text)
    if not ranges:
        return None

    now = datetime.now(CENTRAL_TZ)
    for start_str, end_str in ranges:
        try:
            start = datetime.strptime(start_str.strip().upper(), "%I:%M %p").replace(
                year=now.year, month=now.month, day=now.day, tzinfo=now.tzinfo
            )
            end = datetime.strptime(end_str.strip().upper(), "%I:%M %p").replace(
                year=now.year, month=now.month, day=now.day, tzinfo=now.tzinfo
            )
        except ValueError:
            continue
        if start <= now <= end:
            return True
    return False


def dining_hours(hall_name: str) -> Optional[Dict[str, Any]]:
    """{name, detail, status?} for a dining hall/eatery, or None if `hall_name`
    doesn't resolve to a known dining location. `detail` prefers today's live
    meal-period breakdown, falling back to the typical weekday hours."""
    place = datasources.resolve_campus_place(hall_name)
    if not place or place.get("type") != "Dining":
        return None

    try:
        hours = datasources.dining_hours_raw(place["place_id"])
    except Exception as exc:  # noqa: BLE001 - best-effort
        logger.warning("dining hours lookup failed for %s: %s", place["place_id"], exc)
        hours = {"live": None, "static": None}

    detail = hours.get("live") or hours.get("static") or "Hours unavailable right now."
    card: Dict[str, Any] = {"name": place["name"], "detail": detail}

    is_open = _parse_open_now(hours.get("live") or hours.get("static"))
    if is_open is not None:
        card["status"] = {
            "label": "Open now" if is_open else "Closed now",
            "tone": "open" if is_open else "closed",
        }
    return card


def facility_busyness(name: str) -> Optional[Dict[str, Any]]:
    """{name, percent_full, available_seats, capacity} for a gym/library, or
    None if `name` doesn't resolve to a place with live capacity data."""
    place = datasources.resolve_campus_place(name)
    if not place:
        return None

    try:
        capacity = datasources.facility_capacity_raw(place["place_id"])
    except Exception as exc:  # noqa: BLE001 - best-effort
        logger.warning("facility capacity lookup failed for %s: %s", place["place_id"], exc)
        return None

    if not capacity:
        return None

    return {
        "name": place["name"],
        "percent_full": capacity.get("percent_full"),
        "available_seats": capacity.get("available_seats"),
        "capacity": capacity.get("capacity"),
        "current_count": capacity.get("current_count"),
    }


_WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]


def campus_events(day: Optional[str] = None, category: Optional[str] = None, limit: int = 8) -> List[Dict[str, Any]]:
    """Upcoming campus events, each shaped as {title, start, location, category}.
    `day` is a loose free-text hint: 'today', 'tomorrow', a weekday name, or
    None for no extra date filtering beyond what's already upcoming."""
    from datetime import datetime, timedelta

    from services.dining_service import CENTRAL_TZ

    try:
        events = datasources.campus_events_raw(category=category, limit=max(limit * 4, 40))
    except Exception as exc:  # noqa: BLE001 - best-effort
        logger.warning("campus events lookup failed: %s", exc)
        return []

    now = datetime.now(CENTRAL_TZ)
    target_date = None
    day_norm = (day or "").strip().lower()
    if day_norm == "today":
        target_date = now.date()
    elif day_norm == "tomorrow":
        target_date = (now + timedelta(days=1)).date()
    elif day_norm in _WEEKDAYS:
        offset = (_WEEKDAYS.index(day_norm) - now.weekday()) % 7
        target_date = (now + timedelta(days=offset)).date()

    out: List[Dict[str, Any]] = []
    for event in events:
        start_raw = event.get("start_time")
        start_dt = None
        if start_raw:
            try:
                start_dt = datetime.fromisoformat(str(start_raw).replace("Z", "+00:00")).astimezone(CENTRAL_TZ)
            except ValueError:
                start_dt = None

        if target_date is not None:
            if not start_dt or start_dt.date() != target_date:
                continue

        out.append({
            "title": event.get("title"),
            "start": start_dt.strftime("%a %I:%M %p").replace(" 0", " ") if start_dt else None,
            "location": event.get("location"),
            "category": event.get("primary_category"),
        })
        if len(out) >= limit:
            break

    return out


def my_schedule(clerk_id: str) -> List[Dict[str, Any]]:
    """The signed-in user's enrolled sections, each shaped as
    {code, name, section, instructor, days, time}."""
    try:
        sections = datasources.user_schedule_sections_raw(clerk_id)
    except Exception as exc:  # noqa: BLE001 - best-effort
        logger.warning("schedule lookup failed for %s: %s", clerk_id, exc)
        return []

    out: List[Dict[str, Any]] = []
    for s in sections:
        meeting = (s.get("meetings") or [{}])[0]
        days = "".join(meeting.get("daysOfWeek") or []) or None
        begin, end = meeting.get("beginTime"), meeting.get("endTime")
        time_label = f"{begin}-{end}" if begin and end else None
        instructors = s.get("instructors") or []
        instructor = instructors[0].get("name") if instructors and instructors[0].get("name") else None

        out.append({
            "code": s.get("course_display") or f"{s.get('dept', '')} {s.get('courseNumber', '')}".strip(),
            "name": s.get("name") or s.get("title"),
            "section": s.get("sectionNumber"),
            "instructor": instructor,
            "days": days,
            "time": time_label,
        })
    return out
