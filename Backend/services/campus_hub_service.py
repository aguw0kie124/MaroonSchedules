from __future__ import annotations

from datetime import datetime
import hashlib
import html
import json
import re
import time
from typing import Any, Dict, List
from urllib.request import Request, urlopen

import psycopg

from db_config import CONNECTION_PARAMS
from repositories import course_repository, user_repository
from routers.traffic import tracker

HOWDY_URL = "https://howdy.tamu.edu/main/home/card-view"
DINING_URL = "https://eacct-tamu-sp.transactcampus.com/eAccounts/BoardTransaction.aspx"
HIRE_AGGIES_URL = "https://tamu-csm.symplicity.com/students/index.php?signin_tab=0"
AGGIE_SPIRIT_URL = "https://aggiespirit.ts.tamu.edu/RouteMap"

CONNECTOR_SYSTEMS = {
    "howdy": {
        "label": "Howdy Portal",
        "login_url": HOWDY_URL,
        "data_scope": "academics",
    },
    "transact": {
        "label": "Transact eAccounts",
        "login_url": DINING_URL,
        "data_scope": "dining",
    },
    "symplicity": {
        "label": "Hire Aggies / Symplicity",
        "login_url": HIRE_AGGIES_URL,
        "data_scope": "career",
    },
}

REC_FACILITIES = [
    {
        "id": "student-rec",
        "name": "Student Recreation Center",
        "source_url": "https://recsports.tamu.edu/facilities/student-rec-center/",
        "hours_hint": "See official facility page for current hours",
    },
    {
        "id": "southside-rec",
        "name": "Southside Recreation Center",
        "source_url": "https://recsports.tamu.edu/facilities/southside-rec/",
        "hours_hint": "See official facility page for current hours",
    },
    {
        "id": "polo-road-rec",
        "name": "Polo Road Recreation Center",
        "source_url": "https://recsports.tamu.edu/facilities/polo-road-rec/",
        "hours_hint": "See official facility page for current hours",
    },
    {
        "id": "penberthy",
        "name": "Penberthy Rec Sports Complex",
        "source_url": "https://recsports.tamu.edu/facilities/penberthy-rec-sports-complex/",
        "hours_hint": "See official facility page for current hours",
    },
    {
        "id": "peap",
        "name": "PEAP",
        "source_url": "https://recsports.tamu.edu/facilities/peap/",
        "hours_hint": "See official facility page for current hours",
    },
    {
        "id": "tennis-center",
        "name": "Tennis Center",
        "source_url": "https://recsports.tamu.edu/facilities/tennis-center/",
        "hours_hint": "See official facility page for current hours",
    },
]
FALL_SPRING_HOURS_BY_FACILITY = {
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
SUMMER_HOURS_BY_FACILITY = {
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
REC_PAGE_CACHE_TTL_SECONDS = 60 * 60 * 6
REC_PAGE_CACHE: Dict[str, tuple[float, Dict[str, Any]]] = {}
REC_NOTICES_CACHE_TTL_SECONDS = 60 * 30
REC_NOTICES_CACHE: tuple[float, List[Dict[str, Any]]] | None = None


def _safe_db_fetchone(query: str, params: tuple = ()) -> Dict[str, Any] | None:
    try:
        with psycopg.connect(CONNECTION_PARAMS) as conn:
            with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
                cur.execute(query, params)
                return cur.fetchone()
    except Exception:
        return None


def _safe_db_fetchall(query: str, params: tuple = ()) -> List[Dict[str, Any]]:
    try:
        with psycopg.connect(CONNECTION_PARAMS) as conn:
            with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
                cur.execute(query, params)
                return cur.fetchall() or []
    except Exception:
        return []


def _ensure_social_tables() -> None:
    try:
        with psycopg.connect(CONNECTION_PARAMS) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS network_connections (
                        requester_id TEXT NOT NULL,
                        recipient_id TEXT NOT NULL,
                        status TEXT NOT NULL DEFAULT 'pending',
                        updated_at TIMESTAMPTZ DEFAULT NOW(),
                        PRIMARY KEY (requester_id, recipient_id)
                    )
                    """
                )
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS campus_event_rsvps (
                        clerk_id TEXT NOT NULL,
                        event_id TEXT NOT NULL,
                        response TEXT NOT NULL,
                        updated_at TIMESTAMPTZ DEFAULT NOW(),
                        PRIMARY KEY (clerk_id, event_id)
                    )
                    """
                )
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS campus_connector_snapshots (
                        clerk_id TEXT NOT NULL,
                        system_id TEXT NOT NULL,
                        status TEXT NOT NULL DEFAULT 'connected',
                        source_url TEXT,
                        page_title TEXT,
                        page_html TEXT,
                        page_text TEXT,
                        cookie_names JSONB DEFAULT '[]'::jsonb,
                        captured_at TIMESTAMPTZ DEFAULT NOW(),
                        updated_at TIMESTAMPTZ DEFAULT NOW(),
                        PRIMARY KEY (clerk_id, system_id)
                    )
                    """
                )
            conn.commit()
    except Exception:
        pass


def _extract_money(text: str) -> str | None:
    match = re.search(r"\$[\d,]+(?:\.\d{2})?", text)
    return match.group(0) if match else None


def _extract_value_after_keywords(text: str, keywords: List[str]) -> str | None:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    for index, line in enumerate(lines):
        lowered = line.lower()
        if any(keyword.lower() in lowered for keyword in keywords):
            if index + 1 < len(lines):
                next_line = lines[index + 1].strip()
                if next_line:
                    return next_line
            inline_match = re.search(r":\s*(.+)$", line)
            if inline_match:
                return inline_match.group(1).strip()
    return None


def _clean_html_text(value: str) -> str:
    no_tags = re.sub(r"<[^>]+>", " ", value or "", flags=re.IGNORECASE)
    return re.sub(r"\s+", " ", html.unescape(no_tags)).strip()


def _extract_section_html(source_html: str, start_marker: str, end_markers: List[str]) -> str:
    lowered = source_html.lower()
    start_index = lowered.find(start_marker.lower())
    if start_index == -1:
        return ""

    remainder = source_html[start_index:]
    remainder_lower = remainder.lower()
    end_candidates = [
        remainder_lower.find(marker.lower())
        for marker in end_markers
        if remainder_lower.find(marker.lower()) != -1
    ]
    end_index = min(end_candidates) if end_candidates else len(remainder)
    return remainder[:end_index]


def _extract_hours_hint_from_html(source_html: str) -> str | None:
    hours_section = _extract_section_html(
        source_html,
        "Hours of Operation",
        ["Facility Includes", "Facility Rules", "Reservation", "Questions"],
    )
    cleaned = _clean_html_text(hours_section)
    if not cleaned:
        return None

    explicit_ranges = re.findall(
        r"\b\d{1,2}:\d{2}\s*(?:AM|PM)\s*[–-]\s*\d{1,2}:\d{2}\s*(?:AM|PM)\b",
        cleaned,
        flags=re.IGNORECASE,
    )
    if explicit_ranges:
        return "Hours: " + " · ".join(explicit_ranges[:2])

    if "hours of operation" in cleaned.lower():
        return "Hours listed on official facility page"
    return None


def _extract_amenities_from_html(source_html: str) -> List[str]:
    facilities_section = _extract_section_html(
        source_html,
        "Facility Includes",
        ["Facility Rules", "Reservation", "Questions"],
    )
    if not facilities_section:
        return []

    heading_matches = re.findall(r"<h4[^>]*>(.*?)</h4>", facilities_section, flags=re.IGNORECASE | re.DOTALL)
    amenities: List[str] = []
    for match in heading_matches:
        cleaned = _clean_html_text(match)
        if cleaned and cleaned.lower() != "facility includes:" and cleaned not in amenities:
            amenities.append(cleaned)
        if len(amenities) >= 4:
            break

    if amenities:
        return amenities

    bullet_matches = re.findall(r"<li[^>]*>(.*?)</li>", facilities_section, flags=re.IGNORECASE | re.DOTALL)
    for match in bullet_matches:
        cleaned = _clean_html_text(match)
        if cleaned and cleaned not in amenities:
            amenities.append(cleaned)
        if len(amenities) >= 4:
            break
    return amenities


def _extract_summary_from_html(source_html: str) -> str | None:
    paragraphs = re.findall(r"<p[^>]*>(.*?)</p>", source_html, flags=re.IGNORECASE | re.DOTALL)
    for paragraph in paragraphs:
        cleaned = _clean_html_text(paragraph)
        if len(cleaned) >= 60:
            return cleaned
    return None


def _active_rec_hours_source() -> str:
    month = datetime.now().month
    if month in (5, 6, 7, 8):
        return "summer"
    return "fall_spring"


def _weekly_hours_for_facility(facility_id: str) -> Dict[str, Any]:
    season = _active_rec_hours_source()
    lookup = SUMMER_HOURS_BY_FACILITY if season == "summer" else FALL_SPRING_HOURS_BY_FACILITY
    weekly_hours = lookup.get(facility_id) or {}
    day_name = datetime.now().strftime("%A")
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


def _fetch_rec_facility_page_details(source_url: str) -> Dict[str, Any]:
    now = time.time()
    cached = REC_PAGE_CACHE.get(source_url)
    if cached and now - cached[0] < REC_PAGE_CACHE_TTL_SECONDS:
        return cached[1]

    details = {
        "summary": None,
        "hours_hint": None,
        "amenities": [],
    }
    try:
        request = Request(source_url, headers={"User-Agent": "Mozilla/5.0 MaroonSchedules/1.0"})
        with urlopen(request, timeout=8) as response:
            source_html = response.read().decode("utf-8", errors="ignore")

        details = {
            "summary": _extract_summary_from_html(source_html),
            "hours_hint": _extract_hours_hint_from_html(source_html),
            "amenities": _extract_amenities_from_html(source_html),
        }
    except Exception:
        pass

    REC_PAGE_CACHE[source_url] = (now, details)
    return details


def _extract_notification_window(label: str) -> str:
    cleaned = re.sub(r"\s+", " ", label or "").strip()
    return cleaned or "See official notices"


def _fetch_rec_notices() -> List[Dict[str, Any]]:
    global REC_NOTICES_CACHE
    now = time.time()
    if REC_NOTICES_CACHE and now - REC_NOTICES_CACHE[0] < REC_NOTICES_CACHE_TTL_SECONDS:
        return REC_NOTICES_CACHE[1]

    notices: List[Dict[str, Any]] = []
    try:
        request = Request("https://recsports.tamu.edu/", headers={"User-Agent": "Mozilla/5.0 MaroonSchedules/1.0"})
        with urlopen(request, timeout=8) as response:
            source_html = response.read().decode("utf-8", errors="ignore")

        section = _extract_section_html(source_html, "# Notifications", ["# 100 Years of Texas A&M Rec Sports", "# Hours of Operation", "# Rec Sports Programs"])
        headings = re.findall(r"<h2[^>]*>(.*?)</h2>", section, flags=re.IGNORECASE | re.DOTALL)
        paragraphs = re.findall(r"<p[^>]*>(.*?)</p>", section, flags=re.IGNORECASE | re.DOTALL)

        facility_keywords = {
            "student-rec": ["student rec center", "rec center", "the rec"],
            "southside-rec": ["southside rec center"],
            "polo-road-rec": ["polo road rec center", "polo road"],
            "penberthy": ["penberthy"],
            "peap": ["peap", "physical education academic building"],
            "tennis-center": ["tennis center", "omar smith"],
        }

        for index, paragraph in enumerate(paragraphs):
            cleaned = _clean_html_text(paragraph)
            lowered = cleaned.lower()
            if len(cleaned) < 24:
                continue

            impacted = [
                facility_id
                for facility_id, keywords in facility_keywords.items()
                if any(keyword in lowered for keyword in keywords)
            ]
            if "football" in lowered or "home game" in lowered:
                impacted = list(facility_keywords.keys())

            if not impacted:
                continue

            notices.append(
                {
                    "window": _extract_notification_window(headings[index] if index < len(headings) else ""),
                    "detail": cleaned,
                    "facility_ids": impacted,
                }
            )
    except Exception:
        notices = []

    REC_NOTICES_CACHE = (now, notices)
    return notices


def _is_likely_authenticated_capture(
    system_id: str,
    source_url: str | None,
    page_title: str | None,
    page_text: str | None,
) -> bool:
    connector = CONNECTOR_SYSTEMS.get(system_id) or {}
    login_url = (connector.get("login_url") or "").rstrip("/")
    current_url = (source_url or "").rstrip("/")
    haystack = " ".join([source_url or "", page_title or "", page_text or ""]).lower()

    positive_terms = {
        "howdy": ["gpa", "gpr", "registration", "holds", "schedule", "class", "course"],
        "transact": ["dining dollars", "meal plan", "board plan", "transaction", "balance"],
        "symplicity": ["jobs", "applications", "employers", "career fair", "recommended jobs", "interviews"],
    }.get(system_id, [])
    negative_terms = ["sign in", "signin", "log in", "login", "password", "netid", "username"]

    has_positive_signal = any(term in haystack for term in positive_terms)
    looks_like_login = any(term in haystack for term in negative_terms)
    url_changed = bool(current_url and login_url and current_url != login_url)

    if has_positive_signal:
        return True
    if looks_like_login and not url_changed:
        return False
    return url_changed and len(page_text or "") > 500


def _connector_row_to_dict(row: Dict[str, Any]) -> Dict[str, Any]:
    cookie_names = row.get("cookie_names")
    if isinstance(cookie_names, str):
        try:
            cookie_names = json.loads(cookie_names)
        except Exception:
            cookie_names = []

    base = CONNECTOR_SYSTEMS.get(row.get("system_id"), {})
    return {
        "system_id": row.get("system_id"),
        "label": base.get("label", row.get("system_id")),
        "status": row.get("status", "connected"),
        "login_url": base.get("login_url"),
        "data_scope": base.get("data_scope"),
        "source_url": row.get("source_url"),
        "page_title": row.get("page_title"),
        "cookie_names": cookie_names or [],
        "captured_at": row.get("captured_at").isoformat() if row.get("captured_at") else None,
        "updated_at": row.get("updated_at").isoformat() if row.get("updated_at") else None,
    }


def get_connector_snapshots(clerk_id: str) -> List[Dict[str, Any]]:
    _ensure_social_tables()
    rows = _safe_db_fetchall(
        """
        SELECT clerk_id, system_id, status, source_url, page_title, cookie_names, captured_at, updated_at
        FROM campus_connector_snapshots
        WHERE clerk_id = %s
        ORDER BY updated_at DESC
        """,
        (clerk_id,),
    )
    snapshots = [_connector_row_to_dict(row) for row in rows]
    known = {snapshot["system_id"] for snapshot in snapshots}
    for system_id, config in CONNECTOR_SYSTEMS.items():
        if system_id not in known:
            snapshots.append(
                {
                    "system_id": system_id,
                    "label": config["label"],
                    "status": "disconnected",
                    "login_url": config["login_url"],
                    "data_scope": config["data_scope"],
                    "source_url": None,
                    "page_title": None,
                    "cookie_names": [],
                    "captured_at": None,
                    "updated_at": None,
                }
            )
    return snapshots


def _latest_connector_snapshot(clerk_id: str, system_id: str) -> Dict[str, Any] | None:
    _ensure_social_tables()
    row = _safe_db_fetchone(
        """
        SELECT clerk_id, system_id, status, source_url, page_title, page_html, page_text, cookie_names, captured_at, updated_at
        FROM campus_connector_snapshots
        WHERE clerk_id = %s AND system_id = %s
        """,
        (clerk_id, system_id),
    )
    return row


def capture_connector_snapshot(
    clerk_id: str,
    system_id: str,
    source_url: str,
    page_title: str | None,
    page_html: str | None,
    page_text: str | None,
    cookie_names: List[str] | None,
) -> Dict[str, Any]:
    _ensure_social_tables()
    if system_id not in CONNECTOR_SYSTEMS:
        return {"status": "error", "message": "Unknown connector system"}

    status_value = (
        "connected"
        if _is_likely_authenticated_capture(system_id, source_url, page_title, page_text)
        else "awaiting_login"
    )

    try:
        with psycopg.connect(CONNECTION_PARAMS) as conn:
            with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
                cur.execute(
                    """
                    INSERT INTO campus_connector_snapshots
                    (clerk_id, system_id, status, source_url, page_title, page_html, page_text, cookie_names, captured_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s::jsonb, NOW(), NOW())
                    ON CONFLICT (clerk_id, system_id) DO UPDATE SET
                        status = EXCLUDED.status,
                        source_url = EXCLUDED.source_url,
                        page_title = EXCLUDED.page_title,
                        page_html = EXCLUDED.page_html,
                        page_text = EXCLUDED.page_text,
                        cookie_names = EXCLUDED.cookie_names,
                        captured_at = NOW(),
                        updated_at = NOW()
                    RETURNING clerk_id, system_id, status, source_url, page_title, cookie_names, captured_at, updated_at
                    """,
                    (
                        clerk_id,
                        system_id,
                        status_value,
                        source_url,
                        page_title,
                        page_html,
                        page_text,
                        json.dumps(cookie_names or []),
                    ),
                )
                row = cur.fetchone()
            conn.commit()
        payload = _connector_row_to_dict(row)
        if status_value == "connected":
            payload["parsed_preview"] = parse_connector_snapshot(clerk_id, system_id)
        else:
            payload["message"] = "Login is still in progress. Keep going until your campus data page is visible."
        return payload
    except Exception as exc:
        return {"status": "error", "message": str(exc)}


def delete_connector_snapshot(clerk_id: str, system_id: str) -> Dict[str, Any]:
    _ensure_social_tables()
    try:
        with psycopg.connect(CONNECTION_PARAMS) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "DELETE FROM campus_connector_snapshots WHERE clerk_id = %s AND system_id = %s",
                    (clerk_id, system_id),
                )
            conn.commit()
        return {"status": "success", "clerk_id": clerk_id, "system_id": system_id}
    except Exception as exc:
        return {"status": "error", "message": str(exc)}


def _parse_howdy_snapshot(snapshot: Dict[str, Any]) -> Dict[str, Any]:
    text = snapshot.get("page_text") or ""
    gpa_match = re.search(r"(?:GPA|GPR)\s*[: ]\s*([0-4]\.\d{1,2})", text, re.IGNORECASE)
    holds = []
    for line in text.splitlines():
        if "hold" in line.lower() and len(line.strip()) < 120:
            holds.append(line.strip())
    course_codes = re.findall(r"\b[A-Z]{2,5}\s?\d{3}\b", text)
    unique_courses = []
    seen = set()
    for code in course_codes:
        normalized = " ".join(code.split())
        if normalized not in seen:
            seen.add(normalized)
            unique_courses.append(normalized)
        if len(unique_courses) >= 6:
            break
    return {
        "gpa": gpa_match.group(1) if gpa_match else None,
        "holds": holds[:5],
        "course_codes": unique_courses,
        "page_title": snapshot.get("page_title"),
    }


def _parse_transact_snapshot(snapshot: Dict[str, Any]) -> Dict[str, Any]:
    text = snapshot.get("page_text") or ""
    plan_name = _extract_value_after_keywords(text, ["Meal Plan", "Plan", "Board Plan"])
    dining_dollars = None
    for line in text.splitlines():
        lowered = line.lower()
        if "dining dollars" in lowered or "balance" in lowered:
            dining_dollars = _extract_money(line)
            if dining_dollars:
                break
    recent_transaction = _extract_value_after_keywords(text, ["Recent Transactions", "Transaction History", "Last Transaction"])
    return {
        "plan_name": plan_name,
        "balance": dining_dollars,
        "recent_transaction": recent_transaction,
        "page_title": snapshot.get("page_title"),
    }


def _parse_symplicity_snapshot(snapshot: Dict[str, Any]) -> Dict[str, Any]:
    text = snapshot.get("page_text") or ""
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    job_titles: List[str] = []
    capture = False
    for line in lines:
        lowered = line.lower()
        if any(keyword in lowered for keyword in ["jobs", "recommended jobs", "opportunities"]):
            capture = True
            continue
        if capture:
            if len(line) > 4 and len(line) < 90 and not any(stop in lowered for stop in ["employers", "career fair", "events", "filters"]):
                job_titles.append(line)
            if len(job_titles) >= 5:
                break
    return {
        "job_titles": job_titles,
        "event_hint": _extract_value_after_keywords(text, ["Upcoming Events", "Career Events", "Events"]),
        "page_title": snapshot.get("page_title"),
    }


def parse_connector_snapshot(clerk_id: str, system_id: str) -> Dict[str, Any]:
    snapshot = _latest_connector_snapshot(clerk_id, system_id)
    if not snapshot or snapshot.get("status") != "connected":
        return {}
    if system_id == "howdy":
        return _parse_howdy_snapshot(snapshot)
    if system_id == "transact":
        return _parse_transact_snapshot(snapshot)
    if system_id == "symplicity":
        return _parse_symplicity_snapshot(snapshot)
    return {}


def _event_id_for(event: Dict[str, Any]) -> str:
    seed = f"{event.get('title', '')}|{event.get('start_time', '')}|{event.get('location', '')}|{event.get('link', '')}"
    return hashlib.sha1(seed.encode("utf-8")).hexdigest()[:16]


def _time_to_minutes(time_string: str | None) -> int:
    if not time_string or " " not in time_string:
        return 10**9
    clock, period = time_string.split(" ", 1)
    try:
        hours, minutes = [int(part) for part in clock.split(":")]
    except Exception:
        return 10**9
    if period.upper() == "PM" and hours != 12:
        hours += 12
    if period.upper() == "AM" and hours == 12:
        hours = 0
    return hours * 60 + minutes


def _today_code() -> str:
    return ["U", "M", "T", "W", "R", "F", "S"][datetime.now().weekday() + 1 if datetime.now().weekday() < 6 else 0]


def _expand_schedule_sections(schedule: Dict[str, Any]) -> List[Dict[str, Any]]:
    expanded_sections: List[Dict[str, Any]] = []
    for section_id in schedule.get("section_ids", []):
        section = course_repository.get_section_by_id(section_id)
        if section:
            expanded_sections.append(section)
    return expanded_sections


def _normalize_academic_courses(sections: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    courses: List[Dict[str, Any]] = []
    for section in sections:
        meeting = (section.get("meetings") or [{}])[0]
        instructor = ((section.get("instructors") or [{}])[0] or {}).get("name", "Instructor TBA")
        courses.append(
            {
                "id": str(section.get("id") or section.get("section_id") or section.get("sectionNumber") or ""),
                "code": f"{section.get('dept', '')} {section.get('courseNumber', '')}".strip() or f"Section {section.get('sectionNumber', 'TBA')}",
                "name": section.get("courseTitle") or "Untitled Course",
                "time": f"{meeting.get('beginTime', 'TBA')}-{meeting.get('endTime', 'TBA')}",
                "beginTime": meeting.get("beginTime"),
                "endTime": meeting.get("endTime"),
                "days": meeting.get("daysOfWeek") or [],
                "location": f"{meeting.get('building', '')} {meeting.get('room', '')}".strip() or "Location TBA",
                "instructor": instructor,
                "credits": float(section.get("credit_hours") or section.get("creditHours") or 3),
                "resources": [
                    {"label": "Course Details", "path": f"/courses/{section.get('course') or section.get('dept', '') + str(section.get('courseNumber', ''))}"},
                ],
            }
        )
    return courses


def _pick_next_course(courses: List[Dict[str, Any]]) -> Dict[str, Any] | None:
    today = ["U", "M", "T", "W", "R", "F", "S"][datetime.now().weekday() + 1 if datetime.now().weekday() < 6 else 0]
    now_minutes = datetime.now().hour * 60 + datetime.now().minute
    sorted_courses = sorted(
        [course for course in courses if today in course.get("days", [])],
        key=lambda course: _time_to_minutes(course.get("beginTime")),
    )
    for course in sorted_courses:
        if _time_to_minutes(course.get("beginTime")) > now_minutes:
            return course
    return None


def get_auth_status(clerk_id: str) -> Dict[str, Any]:
    connector_states = get_connector_snapshots(clerk_id)
    return {
        "status": "app_authenticated",
        "primary_auth": "Clerk",
        "institution_sso": {
            "provider": "Howdy / NetID",
            "status": "connected" if any(item["status"] == "connected" for item in connector_states) else "connector_required",
            "note": "Institution-owned credentials are handled through the in-app connector browser and captured session state.",
            "resource_url": HOWDY_URL,
        },
        "user_id": clerk_id,
        "connectors": connector_states,
    }


def get_academic_snapshot(clerk_id: str) -> Dict[str, Any]:
    profile = user_repository.get_user(clerk_id) or {}
    schedules = user_repository.get_schedules(clerk_id) or []
    primary_schedule = schedules[0] if schedules else {"name": "Schedule unavailable", "section_ids": []}
    sections = _expand_schedule_sections(primary_schedule)
    courses = _normalize_academic_courses(sections)
    next_course = _pick_next_course(courses)

    avg_gpa_values = [
        float(section.get("avg_gpa"))
        for section in sections
        if section.get("avg_gpa") not in (None, "")
    ]
    gpa_indicator = round(sum(avg_gpa_values) / len(avg_gpa_values), 2) if avg_gpa_values else None
    holds = profile.get("holds") if isinstance(profile.get("holds"), list) else []
    howdy_snapshot = parse_connector_snapshot(clerk_id, "howdy")
    derived_holds = howdy_snapshot.get("holds") if isinstance(howdy_snapshot.get("holds"), list) else []
    derived_courses = howdy_snapshot.get("course_codes") if isinstance(howdy_snapshot.get("course_codes"), list) else []

    return {
        "status": "live" if courses or howdy_snapshot else "preview",
        "sourceLabel": "Primary schedule loaded from MaroonSchedules storage" if courses else ("Captured from connected Howdy session" if howdy_snapshot else "Connect Howdy to load registrar details directly"),
        "scheduleName": primary_schedule.get("name", "Schedule unavailable"),
        "courses": courses,
        "totalCredits": round(sum(course.get("credits", 0) for course in courses), 1),
        "nextCourse": next_course,
        "gpa": howdy_snapshot.get("gpa") or (str(gpa_indicator) if gpa_indicator is not None else "Connect Howdy"),
        "gpaIndicatorType": "captured_howdy_session" if howdy_snapshot.get("gpa") else ("section_avg_projection" if gpa_indicator is not None else "external_connector_required"),
        "gradesStatus": "captured_from_howdy" if howdy_snapshot else "available_from_howdy_connector",
        "registrationReady": len(holds or derived_holds) == 0,
        "activeHolds": holds or derived_holds,
        "capturedCourseCodes": derived_courses,
        "resources": [
            {"label": "Howdy Portal", "url": HOWDY_URL},
        ],
    }


def get_dining_snapshot(clerk_id: str) -> Dict[str, Any]:
    profile = _safe_db_fetchone("SELECT * FROM dining_profiles WHERE clerk_id = %s", (clerk_id,))
    transact_snapshot = parse_connector_snapshot(clerk_id, "transact")

    if transact_snapshot:
        return {
            "status": "live",
            "planName": transact_snapshot.get("plan_name") or "Captured from Transact eAccounts",
            "balanceLabel": transact_snapshot.get("balance") or "Balance not detected on the captured page yet",
            "recentActivityLabel": transact_snapshot.get("recent_transaction") or "Open your transaction history in Transact and refresh this connector to capture the latest activity.",
            "profile": {
                "targetCalories": profile.get("target_calories") if profile else None,
                "goalWeight": profile.get("goal_weight_lbs") if profile else None,
                "activityLevel": profile.get("activity_level") if profile else None,
            },
            "resources": [
                {"label": "Transact eAccounts", "url": DINING_URL},
            ],
        }

    if profile:
        return {
            "status": "preview",
            "planName": "Dining profile loaded",
            "balanceLabel": "Live meal-plan balances still require Transact eAccounts connection",
            "recentActivityLabel": f"Nutrition mode: {profile.get('mode', 'maintain')} · Activity level: {profile.get('activity_level', 'moderate')}",
            "profile": {
                "targetCalories": profile.get("target_calories"),
                "goalWeight": profile.get("goal_weight_lbs"),
                "activityLevel": profile.get("activity_level"),
            },
            "resources": [
                {"label": "Transact eAccounts", "url": DINING_URL},
            ],
        }

    return {
        "status": "link",
        "planName": "Dining account ready to connect",
        "balanceLabel": "Open Transact eAccounts to view live balances",
        "recentActivityLabel": "Dining balances and transaction history need institution-backed SSO.",
        "resources": [
            {"label": "Transact eAccounts", "url": DINING_URL},
        ],
    }


def discover_network(clerk_id: str, query: str | None = None, major: str | None = None, limit: int = 8) -> Dict[str, Any]:
    _ensure_social_tables()
    profile = user_repository.get_user(clerk_id) or {}
    query_text = f"%{(query or '').strip()}%"
    profile_major = major or profile.get("major") or ""
    current_year = datetime.now().year

    where_parts = ["clerk_id <> %s"]
    params: List[Any] = [clerk_id]
    if profile_major:
        where_parts.append("(major ILIKE %s OR %s = '')")
        params.extend([f"%{profile_major}%", profile_major])
    if query:
        where_parts.append("(full_name ILIKE %s OR email ILIKE %s OR major ILIKE %s)")
        params.extend([query_text, query_text, query_text])

    sql = f"""
        SELECT clerk_id, full_name, email, profile_image_url, major, graduation_year
        FROM users
        WHERE {' AND '.join(where_parts)}
        ORDER BY updated_at DESC
        LIMIT %s
    """
    params.append(limit)
    rows = _safe_db_fetchall(sql, tuple(params))

    suggestions = []
    for row in rows:
        graduation_year = row.get("graduation_year") or ""
        is_alumni = graduation_year.isdigit() and int(graduation_year) < current_year
        suggestions.append(
            {
                "clerk_id": row.get("clerk_id"),
                "name": row.get("full_name") or row.get("email") or "Aggie",
                "major": row.get("major") or "Major not set",
                "graduation_year": graduation_year or "N/A",
                "image_url": row.get("profile_image_url"),
                "relationship": "alumni" if is_alumni else "peer",
            }
        )

    pending_requests = _safe_db_fetchall(
        "SELECT requester_id, recipient_id, status FROM network_connections WHERE (requester_id = %s OR recipient_id = %s) AND status = 'pending'",
        (clerk_id, clerk_id),
    )

    return {
        "status": "live" if suggestions else "preview",
        "chatStatus": "stream_messaging_available",
        "summary": "Discover peers and alumni from the shared campus profile layer.",
        "pendingRequests": len(pending_requests),
        "suggestions": suggestions,
        "resources": [
            {"label": "Social Hub", "path": "/social"},
            {"label": "Hire Aggies", "url": HIRE_AGGIES_URL},
        ],
    }


def create_connection_request(requester_id: str, recipient_id: str) -> Dict[str, Any]:
    _ensure_social_tables()
    if requester_id == recipient_id:
        return {"status": "error", "message": "Cannot connect to yourself"}

    try:
        with psycopg.connect(CONNECTION_PARAMS) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO network_connections (requester_id, recipient_id, status, updated_at)
                    VALUES (%s, %s, 'pending', NOW())
                    ON CONFLICT (requester_id, recipient_id) DO UPDATE SET status = 'pending', updated_at = NOW()
                    """,
                    (requester_id, recipient_id),
                )
            conn.commit()
        return {"status": "success", "requester_id": requester_id, "recipient_id": recipient_id}
    except Exception as exc:
        return {"status": "error", "message": str(exc)}


def get_events_snapshot(clerk_id: str | None = None, limit: int = 8) -> List[Dict[str, Any]]:
    _ensure_social_tables()
    raw_events = tracker.fetch_event_data(limit=limit)
    rsvp_lookup: Dict[str, str] = {}
    if clerk_id:
        rows = _safe_db_fetchall(
            "SELECT event_id, response FROM campus_event_rsvps WHERE clerk_id = %s",
            (clerk_id,),
        )
        rsvp_lookup = {row.get("event_id"): row.get("response", "interested") for row in rows}

    events = []
    for event in raw_events:
        event_id = _event_id_for(event)
        events.append(
            {
                "event_id": event_id,
                "title": event.get("title", "Campus Event"),
                "location": event.get("location", "TBA"),
                "start_time": event.get("start_time"),
                "end_time": event.get("end_time"),
                "summary": event.get("summary", ""),
                "link": event.get("link"),
                "rsvp_status": rsvp_lookup.get(event_id, "none"),
            }
        )
    return events


def save_event_rsvp(clerk_id: str, event_id: str, response: str) -> Dict[str, Any]:
    _ensure_social_tables()
    try:
        with psycopg.connect(CONNECTION_PARAMS) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO campus_event_rsvps (clerk_id, event_id, response, updated_at)
                    VALUES (%s, %s, %s, NOW())
                    ON CONFLICT (clerk_id, event_id) DO UPDATE SET response = EXCLUDED.response, updated_at = NOW()
                    """,
                    (clerk_id, event_id, response),
                )
            conn.commit()
        return {"status": "success", "clerk_id": clerk_id, "event_id": event_id, "response": response}
    except Exception as exc:
        return {"status": "error", "message": str(exc)}


def get_recreation_snapshot() -> Dict[str, Any]:
    occupancy_rows = tracker.fetch_rec_data() or []
    notices = _fetch_rec_notices()
    occupancy_by_name = {
        row.get("LocationName", "").strip().lower(): row for row in occupancy_rows
    }

    facilities = []
    for facility in REC_FACILITIES:
        source_row = occupancy_by_name.get(facility["name"].strip().lower())
        page_details = _fetch_rec_facility_page_details(facility["source_url"])
        schedule_details = _weekly_hours_for_facility(facility["id"])
        facility_notices = [
            {
                "window": notice.get("window"),
                "detail": notice.get("detail"),
            }
            for notice in notices
            if facility["id"] in notice.get("facility_ids", [])
        ]
        current_count = source_row.get("LastCount") if source_row else None
        capacity = source_row.get("TotalCapacity") if source_row else None
        percent_full = None
        if current_count is not None and capacity:
            try:
                percent_full = round((float(current_count) / float(capacity)) * 100, 1)
            except Exception:
                percent_full = None

        facilities.append(
            {
                **facility,
                "summary": page_details.get("summary"),
                "amenities": page_details.get("amenities", []),
                "hours_hint": schedule_details.get("today_hours") or page_details.get("hours_hint") or facility["hours_hint"],
                "today_hours": schedule_details.get("today_hours"),
                "weekly_hours": schedule_details.get("weekly_hours", []),
                "hours_source": schedule_details.get("hours_source"),
                "notices": facility_notices,
                "percent_full": percent_full,
                "current_count": current_count,
                "capacity": capacity,
            }
        )

    return {
        "status": "live" if occupancy_rows else "preview",
        "facilities": facilities,
        "summary": "Recreation merges live counts with details gathered from the official Rec Sports facility pages.",
    }


def get_transit_snapshot() -> Dict[str, Any]:
    return {
        "status": "live",
        "summary": "AggieSpirit route mapping and nearest-bus tracking are available in the map experience.",
        "resources": [
            {"label": "AggieSpirit Route Map", "url": AGGIE_SPIRIT_URL},
        ],
    }


def get_services_snapshot() -> List[Dict[str, Any]]:
    return [
        {
            "id": "howdy",
            "title": "Howdy Portal",
            "summary": "Single sign-on launch point for academic systems and institutional services.",
            "url": HOWDY_URL,
        },
        {
            "id": "transact",
            "title": "Dining Accounts",
            "summary": "Meal plans, balances, and dining transactions via Transact eAccounts.",
            "url": DINING_URL,
        },
        {
            "id": "hire-aggies",
            "title": "Hire Aggies",
            "summary": "Jobs, career fairs, employer interactions, and Symplicity workflows.",
            "url": HIRE_AGGIES_URL,
        },
        {
            "id": "annex",
            "title": "The Annex",
            "summary": "Library and study support surfaced alongside the campus map and academic context.",
            "url": "https://www.library.tamu.edu/",
        },
    ]


def get_career_snapshot(clerk_id: str) -> Dict[str, Any]:
    network = discover_network(clerk_id, limit=4)
    alumni_count = len([suggestion for suggestion in network.get("suggestions", []) if suggestion.get("relationship") == "alumni"])
    symplicity_snapshot = parse_connector_snapshot(clerk_id, "symplicity")
    return {
        "status": "live" if symplicity_snapshot else "link",
        "summary": (
            f"Captured jobs: {', '.join(symplicity_snapshot.get('job_titles', [])[:3])}"
            if symplicity_snapshot.get("job_titles")
            else "Hire Aggies jobs and employer activity can be launched from one career module."
        ),
        "alumniPreviewCount": alumni_count,
        "capturedJobs": symplicity_snapshot.get("job_titles", []),
        "capturedEventHint": symplicity_snapshot.get("event_hint"),
        "resources": [
            {"label": "Hire Aggies", "url": HIRE_AGGIES_URL},
        ],
    }


def get_notification_hub(clerk_id: str) -> List[Dict[str, Any]]:
    academic = get_academic_snapshot(clerk_id)
    dining = get_dining_snapshot(clerk_id)
    events = get_events_snapshot(clerk_id, limit=3)
    network = discover_network(clerk_id, limit=3)

    notifications: List[Dict[str, Any]] = []
    if academic.get("nextCourse"):
        notifications.append(
            {
                "id": "next-course",
                "title": f"Next class: {academic['nextCourse']['code']}",
                "detail": f"{academic['nextCourse']['time']} · {academic['nextCourse']['location']}",
                "category": "academic",
                "urgency": "high",
            }
        )

    notifications.append(
        {
            "id": "dining-connector",
            "title": dining.get("planName", "Dining module"),
            "detail": dining.get("balanceLabel", ""),
            "category": "administrative",
            "urgency": "medium",
        }
    )

    for event in events[:2]:
        notifications.append(
            {
                "id": f"event-{event['event_id']}",
                "title": event.get("title", "Campus Event"),
                "detail": f"{event.get('start_time', 'TBA')} · {event.get('location', 'TBA')}",
                "category": "social",
                "urgency": "medium",
            }
        )

    if network.get("pendingRequests", 0) > 0:
        notifications.append(
            {
                "id": "network-pending",
                "title": "Connection requests pending",
                "detail": f"{network['pendingRequests']} connection request(s) need attention.",
                "category": "career",
                "urgency": "medium",
            }
        )

    return notifications


def get_overview(clerk_id: str) -> Dict[str, Any]:
    return {
        "auth": get_auth_status(clerk_id),
        "academic": get_academic_snapshot(clerk_id),
        "dining": get_dining_snapshot(clerk_id),
        "notifications": get_notification_hub(clerk_id),
        "career": get_career_snapshot(clerk_id),
        "network": discover_network(clerk_id, limit=6),
        "events": get_events_snapshot(clerk_id, limit=6),
        "transit": get_transit_snapshot(),
        "recreation": get_recreation_snapshot(),
        "services": get_services_snapshot(),
        "connectors": get_connector_snapshots(clerk_id),
        "generatedAt": datetime.utcnow().isoformat() + "Z",
    }
