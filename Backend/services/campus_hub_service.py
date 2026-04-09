from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import html
import json
import re
import time
from typing import Any, Dict, List, Optional, Union
from urllib.request import Request, urlopen

import psycopg

from db_config import CONNECTION_PARAMS
from repositories import course_repository, tag_repository, user_repository
from services import (
    cache_service,
    campus_events_service,
    place_registry_service,
    campus_places_service,
    tag_access_service,
)

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
ACADEMIC_SNAPSHOT_TTL_SECONDS = 120
DINING_SNAPSHOT_TTL_SECONDS = 120
CAREER_SNAPSHOT_TTL_SECONDS = 300
RECREATION_SNAPSHOT_TTL_SECONDS = 120
TRANSIT_SNAPSHOT_TTL_SECONDS = 30
SERVICES_SNAPSHOT_TTL_SECONDS = 86400
PLACE_DETAIL_CACHE_VERSION = "v2"

# (Removed hardcoded REC_FACILITIES and FALL_SPRING_HOURS_BY_FACILITY - now in DB registry)
REC_PAGE_CACHE_TTL_SECONDS = 60 * 60 * 6
REC_PAGE_CACHE: Dict[str, tuple[float, Dict[str, Any]]] = {}
REC_NOTICES_CACHE_TTL_SECONDS = 60 * 30
REC_NOTICES_CACHE: Optional[Union[float, List[Dict[str, Any]]]] = None


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _parse_event_datetime(value: Any) -> Optional[datetime]:
    if value is None:
        return None
    if isinstance(value, datetime):
        parsed = value
    elif isinstance(value, str):
        normalized = value.strip()
        if not normalized:
            return None
        if normalized.endswith("Z"):
            normalized = f"{normalized[:-1]}+00:00"
        try:
            parsed = datetime.fromisoformat(normalized)
        except ValueError:
            return None
    else:
        return None

    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed


def _is_event_upcoming(event: Dict[str, Any], now: Optional[datetime] = None) -> bool:
    reference_time = now or datetime.now(timezone.utc)
    relevant_time = _parse_event_datetime(event.get("end_time")) or _parse_event_datetime(event.get("start_time"))
    if relevant_time is None:
        return True
    return relevant_time >= reference_time


def _event_start_sort_key(event: Dict[str, Any]) -> tuple[int, float]:
    start_time = _parse_event_datetime(event.get("start_time"))
    if start_time is None:
        return (1, float("inf"))
    return (0, start_time.timestamp())


def _safe_db_fetchone(query: str, params: tuple = (), conn: Optional[psycopg.Connection] = None) -> Optional[Dict[str, Any]]:
    try:
        if conn:
            with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
                cur.execute(query, params)
                return cur.fetchone()
        with psycopg.connect(CONNECTION_PARAMS) as new_conn:
            with new_conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
                cur.execute(query, params)
                return cur.fetchone()
    except Exception:
        return None


def _safe_db_fetchall(query: str, params: tuple = (), conn: Optional[psycopg.Connection] = None) -> List[Dict[str, Any]]:
    try:
        if conn:
            with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
                cur.execute(query, params)
                return cur.fetchall() or []
        with psycopg.connect(CONNECTION_PARAMS) as new_conn:
            with new_conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
                cur.execute(query, params)
                return cur.fetchall() or []
    except Exception:
        return []


def _ensure_social_tables(conn: Optional[psycopg.Connection] = None) -> None:
    try:
        def run_schema(c):
            with c.cursor() as cur:
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
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS place_reviews (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        place_id TEXT NOT NULL,
                        user_id TEXT NOT NULL,
                        user_name TEXT,
                        user_image TEXT,
                        rating INTEGER,
                        title TEXT,
                        body TEXT,
                        images TEXT[] DEFAULT '{}',
                        created_at TIMESTAMPTZ DEFAULT NOW(),
                        updated_at TIMESTAMPTZ DEFAULT NOW(),
                        is_anonymous BOOLEAN DEFAULT FALSE
                    )
                    """
                )
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS crowdping_posts (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        user_id TEXT NOT NULL,
                        user_name TEXT,
                        user_image TEXT,
                        content TEXT,
                        lat DOUBLE PRECISION,
                        lng DOUBLE PRECISION,
                        location_tag TEXT,
                        event_id TEXT,
                        images TEXT[] DEFAULT '{}',
                        is_anonymous BOOLEAN DEFAULT FALSE,
                        visibility TEXT DEFAULT 'public',
                        post_type TEXT DEFAULT 'post',
                        custom_data JSONB DEFAULT '{}'::jsonb,
                        created_at TIMESTAMPTZ DEFAULT NOW()
                    )
                    """
                )
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS post_interactions (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        post_id TEXT NOT NULL,
                        post_type TEXT NOT NULL,
                        user_id TEXT NOT NULL,
                        type TEXT NOT NULL,
                        comment_text TEXT,
                        user_name TEXT,
                        user_image TEXT,
                        created_at TIMESTAMPTZ DEFAULT NOW()
                    )
                    """
                )
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS blocked_users (
                        blocker_id TEXT NOT NULL,
                        blocked_id TEXT NOT NULL,
                        created_at TIMESTAMPTZ DEFAULT NOW(),
                        PRIMARY KEY (blocker_id, blocked_id)
                    )
                    """
                )
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS content_reports (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        reporter_clerk_id TEXT NOT NULL,
                        reportee_clerk_id TEXT NOT NULL,
                        post_type TEXT,
                        post_id TEXT,
                        place_id TEXT,
                        reason TEXT,
                        comment TEXT,
                        created_at TIMESTAMPTZ DEFAULT NOW()
                    )
                    """
                )
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS admin_event_subscriptions (
                        user_clerk_id TEXT NOT NULL,
                        admin_clerk_id TEXT NOT NULL,
                        muted BOOLEAN NOT NULL DEFAULT TRUE,
                        updated_at TIMESTAMPTZ DEFAULT NOW(),
                        PRIMARY KEY (user_clerk_id, admin_clerk_id)
                    )
                    """
                )
            c.commit()

        if conn:
            run_schema(conn)
        else:
            with psycopg.connect(CONNECTION_PARAMS) as new_conn:
                run_schema(new_conn)
    except Exception:
        pass


def _extract_money(text: str) -> Optional[str]:
    match = re.search(r"\$[\d,]+(?:\.\d{2})?", text)
    return match.group(0) if match else None


def _extract_value_after_keywords(text: str, keywords: List[str]) -> Optional[str]:
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


def _extract_hours_hint_from_html(source_html: str) -> Optional[str]:
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


def _extract_summary_from_html(source_html: str) -> Optional[str]:
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
    cache_key = f"campus:recreation:weekly-hours:v1:{facility_id}"
    cached = cache_service.get_json(cache_key)
    if cached is not None:
        return cached

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
    payload = {
        "weekly_hours": [{"day": day, "hours": hours} for day, hours in weekly_hours.items()],
        "today_hours": today_hours,
        "hours_source": source_note,
    }
    cache_service.set_json(cache_key, payload, 60 * 60 * 6)
    return payload


def _fetch_rec_facility_page_details(source_url: str) -> Dict[str, Any]:
    cache_key = f"campus:recreation:page:v1:{source_url}"
    cached = cache_service.get_json(cache_key)
    if cached is not None:
        return cached

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
        with urlopen(request, timeout=3) as response:
            source_html = response.read().decode("utf-8", errors="ignore")

        details = {
            "summary": _extract_summary_from_html(source_html),
            "hours_hint": _extract_hours_hint_from_html(source_html),
            "amenities": _extract_amenities_from_html(source_html),
        }
    except Exception:
        pass

    REC_PAGE_CACHE[source_url] = (now, details)
    cache_service.set_json(cache_key, details, REC_PAGE_CACHE_TTL_SECONDS)
    return details


def _extract_notification_window(label: str) -> str:
    cleaned = re.sub(r"\s+", " ", label or "").strip()
    return cleaned or "See official notices"


def _fetch_rec_notices() -> List[Dict[str, Any]]:
    global REC_NOTICES_CACHE
    cache_key = "campus:recreation:notices:v1"
    cached = cache_service.get_json(cache_key)
    if cached is not None:
        return cached
    now = time.time()
    if REC_NOTICES_CACHE and now - REC_NOTICES_CACHE[0] < REC_NOTICES_CACHE_TTL_SECONDS:
        return REC_NOTICES_CACHE[1]

    notices: List[Dict[str, Any]] = []
    try:
        request = Request("https://recsports.tamu.edu/", headers={"User-Agent": "Mozilla/5.0 MaroonSchedules/1.0"})
        with urlopen(request, timeout=4) as response:
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
    cache_service.set_json(cache_key, notices, REC_NOTICES_CACHE_TTL_SECONDS)
    return notices


def _is_likely_authenticated_capture(
    system_id: str,
    source_url: Optional[str],
    page_title: Optional[str],
    page_text: Optional[str],
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


def get_connector_snapshots(clerk_id: str, conn: Optional[psycopg.Connection] = None) -> List[Dict[str, Any]]:
    _ensure_social_tables(conn)
    rows = _safe_db_fetchall(
        """
        SELECT clerk_id, system_id, status, source_url, page_title, cookie_names, captured_at, updated_at
        FROM campus_connector_snapshots
        WHERE clerk_id = %s
        ORDER BY updated_at DESC
        """,
        (clerk_id,),
        conn=conn,
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


def _latest_connector_snapshot(clerk_id: str, system_id: str, conn: Optional[psycopg.Connection] = None) -> Optional[Dict[str, Any]]:
    _ensure_social_tables(conn)
    row = _safe_db_fetchone(
        """
        SELECT clerk_id, system_id, status, source_url, page_title, page_html, page_text, cookie_names, captured_at, updated_at
        FROM campus_connector_snapshots
        WHERE clerk_id = %s AND system_id = %s
        """,
        (clerk_id, system_id),
        conn=conn,
    )
    return row


def capture_connector_snapshot(
    clerk_id: str,
    system_id: str,
    source_url: str,
    page_title: Optional[str],
    page_html: Optional[str],
    page_text: Optional[str],
    cookie_names: Optional[List[str]],
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


def parse_connector_snapshot(clerk_id: str, system_id: str, conn: Optional[psycopg.Connection] = None) -> Dict[str, Any]:
    snapshot = _latest_connector_snapshot(clerk_id, system_id, conn=conn)
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


def _time_to_minutes(time_string: Optional[str]) -> int:
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


def _pick_next_course(courses: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
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


def get_auth_status(clerk_id: str, conn: Optional[psycopg.Connection] = None) -> Dict[str, Any]:
    connector_states = get_connector_snapshots(clerk_id, conn=conn)
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


def get_academic_snapshot(clerk_id: str, conn: Optional[psycopg.Connection] = None) -> Dict[str, Any]:
    profile = user_repository.get_user(clerk_id) or {}
    schedules = user_repository.get_schedules(clerk_id) or []
    primary_schedule = schedules[0] if schedules else {"name": "Schedule unavailable", "section_ids": []}
    howdy_snapshot = parse_connector_snapshot(clerk_id, "howdy", conn=conn)
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
    derived_holds = howdy_snapshot.get("holds") if isinstance(howdy_snapshot.get("holds"), list) else []
    derived_courses = howdy_snapshot.get("course_codes") if isinstance(howdy_snapshot.get("course_codes"), list) else []

    return {
        "generated_at": _utc_now_iso(),
        "stale_after": ACADEMIC_SNAPSHOT_TTL_SECONDS,
        "source_status": "live" if courses or howdy_snapshot else "preview",
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


def get_dining_snapshot(clerk_id: str, conn: Optional[psycopg.Connection] = None) -> Dict[str, Any]:
    profile = _safe_db_fetchone("SELECT * FROM dining_profiles WHERE clerk_id = %s", (clerk_id,), conn=conn)
    transact_snapshot = parse_connector_snapshot(clerk_id, "transact", conn=conn)

    if transact_snapshot:
        return {
            "generated_at": _utc_now_iso(),
            "stale_after": DINING_SNAPSHOT_TTL_SECONDS,
            "source_status": "live",
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
            "generated_at": _utc_now_iso(),
            "stale_after": DINING_SNAPSHOT_TTL_SECONDS,
            "source_status": "preview",
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
        "generated_at": _utc_now_iso(),
        "stale_after": DINING_SNAPSHOT_TTL_SECONDS,
        "source_status": "link",
        "status": "link",
        "planName": "Dining account ready to connect",
        "balanceLabel": "Open Transact eAccounts to view live balances",
        "recentActivityLabel": "Dining balances and transaction history need institution-backed SSO.",
        "resources": [
            {"label": "Transact eAccounts", "url": DINING_URL},
        ],
    }


def discover_network(clerk_id: str, query: Optional[str] = None, major: Optional[str] = None, limit: int = 8, conn: Optional[psycopg.Connection] = None) -> Dict[str, Any]:
    _ensure_social_tables(conn)
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
    rows = _safe_db_fetchall(sql, tuple(params), conn=conn)

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
        conn=conn,
    )

    return {
        "generated_at": _utc_now_iso(),
        "stale_after": 300,
        "source_status": "live" if suggestions else "preview",
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


def get_events_snapshot(
    clerk_id: Optional[str] = None,
    limit: int = 8,
    category: Optional[str] = None,
    student_relevant_only: bool = True,
    conn: Optional[psycopg.Connection] = None,
) -> List[Dict[str, Any]]:
    _ensure_social_tables(conn)
    rsvp_lookup: Dict[str, str] = {}
    blocked_ids: set[str] = set()
    muted_admin_ids: set[str] = set()
    bypass_tag_restrictions = False
    user_access_tags: list[str] = []
    if clerk_id:
        user = user_repository.get_user(clerk_id) or {}
        bypass_tag_restrictions = bool(user.get("is_admin"))
        user_access_tags = tag_repository.get_user_tags(clerk_id)
        rows = _safe_db_fetchall(
            "SELECT event_id, response FROM campus_event_rsvps WHERE clerk_id = %s",
            (clerk_id,),
            conn=conn,
        )
        rsvp_lookup = {row.get("event_id"): row.get("response", "interested") for row in rows}
        blocked_rows = _safe_db_fetchall(
            "SELECT blocked_id FROM blocked_users WHERE blocker_id = %s",
            (clerk_id,),
            conn=conn,
        )
        blocked_ids = {row.get("blocked_id") for row in blocked_rows if row.get("blocked_id")}
        muted_rows = _safe_db_fetchall(
            """
            SELECT admin_clerk_id
            FROM admin_event_subscriptions
            WHERE user_clerk_id = %s AND muted = TRUE
            """,
            (clerk_id,),
            conn=conn,
        )
        muted_admin_ids = {
            row.get("admin_clerk_id")
            for row in muted_rows
            if row.get("admin_clerk_id")
        }

    crawler_events = campus_events_service.load_campus_events()
    events = crawler_events.get("events") if isinstance(crawler_events, dict) else crawler_events
    source_status = crawler_events.get("source_status") if isinstance(crawler_events, dict) else "live"
    events_copy = list(events) if events else []
    admin_events_list = []
    
    # Fetch Admin Events
    admin_events_raw = _safe_db_fetchall(
        """
        SELECT
            e.id,
            e.clerk_id,
            e.title,
            e.description,
            e.lat,
            e.lng,
            e.location_name,
            e.start_time,
            e.end_time,
            e.google_review_url,
            e.image_url,
            COALESCE(
                (
                    SELECT json_agg(t.label ORDER BY t.label)
                    FROM event_tags et
                    JOIN tags t ON t.id = et.tag_id
                    WHERE et.event_id = e.id::TEXT
                ),
                '[]'::json
            ) AS access_tags,
            app.organization_name
        FROM admin_events e
        LEFT JOIN admin_applications app ON app.clerk_id = e.clerk_id
        ORDER BY e.start_time ASC, e.created_at DESC
        """,
        conn=conn,
    )
    for ad_ev in admin_events_raw:
        admin_clerk_id = ad_ev.get("clerk_id")
        if admin_clerk_id and (admin_clerk_id in blocked_ids or admin_clerk_id in muted_admin_ids):
            continue

        organization_name = ad_ev.get("organization_name") or "Campus organizer"
        admin_events_list.append({
            "event_id": str(ad_ev["id"]),
            "title": ad_ev["title"],
            "location": ad_ev["location_name"],
            "location_lat": ad_ev["lat"],
            "location_lng": ad_ev["lng"],
            "start_time": ad_ev["start_time"].isoformat() if ad_ev["start_time"] else None,
            "end_time": ad_ev["end_time"].isoformat() if ad_ev["end_time"] else None,
            "description": ad_ev["description"],
            "google_review_url": ad_ev.get("google_review_url"),
            "image_url": ad_ev.get("image_url"),
            "access_tags": ad_ev.get("access_tags") or [],
            "has_food": False,
            "source_name": "admin_portal",
            "host_name": organization_name,
            "organization_name": organization_name,
            "admin_clerk_id": admin_clerk_id,
            "categories": {"featured": 1},
            "is_admin_event": True
        })

    events = admin_events_list + events_copy
    events = tag_access_service.filter_events_for_access_tags(
        events,
        user_tags=user_access_tags,
        bypass_restrictions=bypass_tag_restrictions,
    )
    events = [event for event in events if _is_event_upcoming(event)]
    events.sort(key=_event_start_sort_key)

    if events:
        if student_relevant_only:
            events = [
                e for e in events
                if e.get("campus_interest_label") != "low" or e.get("is_admin_event")
            ]
        if category:
            events = [
                e for e in events
                if e.get("categories", {}).get(category.lower()) == 1
            ]
        limited = events[:limit] if limit else events
        return {
            "generated_at": _utc_now_iso(),
            "stale_after": 300,
            "source_status": source_status,
            "events": [
                {
                    **event,
                    "rsvp_status": rsvp_lookup.get(event.get("event_id"), "none"),
                }
                for event in limited
            ],
        }

    from routers.traffic import tracker
    raw_events = tracker.fetch_event_data(limit=limit)
    events = []
    for event in raw_events:
        event_id = _event_id_for(event)
        resolved_place = place_registry_service.resolve_place(
            event.get("location"),
            event.get("latitude"),
            event.get("longitude"),
        )
        events.append(
            {
                "event_id": event_id,
                "title": event.get("title", "Campus Event"),
                "location": resolved_place["name"] if resolved_place else event.get("location", "TBA"),
                "place_id": resolved_place["place_id"] if resolved_place else None,
                "start_time": event.get("start_time"),
                "end_time": event.get("end_time"),
                "summary": event.get("summary", ""),
                "description": event.get("summary", ""),
                "link": event.get("link"),
                "source_url": event.get("link"),
                "host_name": None,
                "source_name": "legacy_tracker",
                "tags": [],
                "access_tags": [],
                "has_food": False,
                "food_confidence": 0.0,
                "food_type": "unknown",
                "food_reasons": [],
                "location_lat": resolved_place["lat"] if resolved_place else None,
                "location_lng": resolved_place["lng"] if resolved_place else None,
                "map_available": bool(resolved_place),
                "campus_interest_score": 40,
                "campus_interest_label": "medium",
                "campus_interest_reasons": ["legacy_tracker_fallback"],
                "rsvp_status": rsvp_lookup.get(event_id, "none"),
                "place": place_registry_service.serialize_place(resolved_place),
            }
        )
    events = [event for event in events if _is_event_upcoming(event)]
    events.sort(key=_event_start_sort_key)
    events = events[:limit] if limit else events
    return {
        "generated_at": _utc_now_iso(),
        "stale_after": 300,
        "source_status": "preview",
        "events": events,
    }


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
    cache_key = "campus:recreation:snapshot:v1"
    cached = cache_service.get_json(cache_key)
    if cached is not None:
        return cached

    from routers.traffic import tracker
    occupancy_rows = tracker.fetch_rec_data() or []
    notices = _fetch_rec_notices()
    
    # Map GoBoard "LocationName" or "FacilityName" to Registry Place
    occupancy_by_place_id: Dict[str, Any] = {}
    for row in occupancy_rows:
        # Try both LocationName and FacilityName for matching
        name_to_resolve = row.get("LocationName") or row.get("FacilityName")
        resolved = place_registry_service.resolve_place(name_to_resolve)
        if resolved and resolved.get("type") == "Rec":
            pid = resolved["place_id"]
            if pid not in occupancy_by_place_id:
                occupancy_by_place_id[pid] = row

    facilities = []
    # Major Aggie Rec IDs for the Hub Snapshot
    MAJOR_REC_IDS = ["rec", "southside-rec", "polo-rec"]
    
    # Get Rec places from registry and filter to ONLY the major ones
    rec_places = [
        p for p in place_registry_service.get_all_places() 
        if p["place_id"] in MAJOR_REC_IDS
    ]
    
    # Sort them according to MAJOR_REC_IDS order (Student Rec first)
    rec_places.sort(key=lambda x: MAJOR_REC_IDS.index(x["place_id"]) if x["place_id"] in MAJOR_REC_IDS else 99)
    
    for place in rec_places:
        pid = place["place_id"]
        source_row = occupancy_by_place_id.get(pid)
        
        # Determine source URL (some might have them in features, fallback to Google search or hardcoded common ones)
        source_url = f"https://recsports.tamu.edu/facilities/{pid}/" # Guessing URL pattern
        if pid == "srec":
            source_url = "https://recsports.tamu.edu/facilities/student-rec-center/"
        elif pid == "southside-rec":
            source_url = "https://recsports.tamu.edu/facilities/southside-rec/"
        elif pid == "polo-rec":
            source_url = "https://recsports.tamu.edu/facilities/polo-road-rec/"

        page_details = _fetch_rec_facility_page_details(source_url)
        
        # Notices filter
        facility_notices = [
            {"window": n.get("window"), "detail": n.get("detail")}
            for n in notices if pid in n.get("facility_ids", []) or pid.replace("-rec", "") in n.get("facility_ids", [])
        ]

        current_count = source_row.get("LastCount") if source_row else None
        capacity = source_row.get("TotalCapacity") if source_row else None
        percent_full = None
        if current_count is not None and capacity:
            try:
                percent_full = round((float(current_count) / float(capacity)) * 100, 1)
            except Exception:
                percent_full = None

        facilities.append({
            "id": pid,
            "name": place["name"],
            "summary": place.get("description") or page_details.get("summary"),
            "amenities": place.get("features") or page_details.get("amenities", []),
            "hours_hint": place.get("hours") or page_details.get("hours_hint") or "See official page",
            "notices": facility_notices,
            "percent_full": percent_full,
            "current_count": current_count,
            "capacity": capacity,
            "source_url": source_url
        })

    payload = {
        "generated_at": _utc_now_iso(),
        "stale_after": RECREATION_SNAPSHOT_TTL_SECONDS,
        "source_status": "live" if occupancy_rows else "preview",
        "status": "live" if occupancy_rows else "preview",
        "facilities": facilities,
        "summary": "Recreation merges live counts with details gathered from the official Rec Sports facility pages.",
    }
    cache_service.set_json(cache_key, payload, RECREATION_SNAPSHOT_TTL_SECONDS)
    return payload


def get_place_detail_snapshot(place_id: str) -> Dict[str, Any]:
    cache_key = f"campus:place-detail:{PLACE_DETAIL_CACHE_VERSION}:{place_id}"
    cached = cache_service.get_json(cache_key)
    if cached is not None and (
        cached.get("source_status") == "missing" or cached.get("place") is not None
    ):
        return cached

    place = place_registry_service.get_place_by_id(place_id)
    if not place:
        payload = {
            "generated_at": _utc_now_iso(),
            "stale_after": 60,
            "source_status": "missing",
            "place": None,
        }
        cache_service.set_json(cache_key, payload, 60)
        return payload

    places_snapshot = campus_places_service.get_places_map_snapshot()
    location = next((loc for loc in places_snapshot.get("locations", []) if loc.get("placeId") == place_id), None)
    rec_snapshot = get_recreation_snapshot() if place.get("type") == "Rec" else None
    rec_facility = None
    if rec_snapshot and location:
        rec_facility = next((facility for facility in rec_snapshot.get("facilities", []) if facility.get("name") == location.get("location")), None)

    payload = {
        "generated_at": _utc_now_iso(),
        "stale_after": 60,
        "source_status": "live",
        "place": location or place_registry_service.serialize_place(place),
        "recreation": rec_facility,
        "transport": get_transit_snapshot() if place.get("type") in {"Hub", "Landmark"} else None,
    }
    cache_service.set_json(cache_key, payload, 60)
    return payload


def get_place_detail_snapshot_by_identifier(place_identifier: str) -> Dict[str, Any]:
    place = place_registry_service.get_place_by_id(place_identifier)
    if place:
        return get_place_detail_snapshot(place_identifier)

    resolved = place_registry_service.resolve_place(place_identifier)
    if resolved:
        return get_place_detail_snapshot(resolved["place_id"])

    payload = {
        "generated_at": _utc_now_iso(),
        "stale_after": 60,
        "source_status": "missing",
        "place": None,
    }
    return payload


def get_transit_snapshot() -> Dict[str, Any]:
    return {
        "generated_at": _utc_now_iso(),
        "stale_after": TRANSIT_SNAPSHOT_TTL_SECONDS,
        "source_status": "live",
        "status": "live",
        "summary": "AggieSpirit route mapping and nearest-bus tracking are available in the map experience.",
        "resources": [
            {"label": "AggieSpirit Route Map", "url": AGGIE_SPIRIT_URL},
        ],
    }


def get_services_snapshot() -> Dict[str, Any]:
    return {
        "generated_at": _utc_now_iso(),
        "stale_after": SERVICES_SNAPSHOT_TTL_SECONDS,
        "source_status": "live",
        "services": [
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
        ],
    }


def get_career_snapshot(clerk_id: str, conn: Optional[psycopg.Connection] = None) -> Dict[str, Any]:
    network = discover_network(clerk_id, limit=4, conn=conn)
    alumni_count = len([suggestion for suggestion in network.get("suggestions", []) if suggestion.get("relationship") == "alumni"])
    symplicity_snapshot = parse_connector_snapshot(clerk_id, "symplicity", conn=conn)
    return {
        "generated_at": _utc_now_iso(),
        "stale_after": CAREER_SNAPSHOT_TTL_SECONDS,
        "source_status": "live" if symplicity_snapshot else "preview",
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


def get_notification_hub(
    clerk_id: str,
    academic_data: Optional[Dict[str, Any]] = None,
    dining_data: Optional[Dict[str, Any]] = None,
    events_data: Optional[List[Dict[str, Any]]] = None,
    network_data: Optional[Dict[str, Any]] = None,
    conn: Optional[psycopg.Connection] = None,
) -> List[Dict[str, Any]]:
    academic = academic_data or get_academic_snapshot(clerk_id, conn=conn)
    dining = dining_data or get_dining_snapshot(clerk_id, conn=conn)
    events = events_data or get_events_snapshot(clerk_id, limit=3, conn=conn)
    network = network_data or discover_network(clerk_id, limit=3, conn=conn)

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
    def safe_exec(label: str, loader, fallback):
        try:
            return loader()
        except Exception as exc:
            print(f"[campus_hub] {label} overview step failed for {clerk_id}: {exc}")
            return fallback

    try:
        with psycopg.connect(CONNECTION_PARAMS) as conn:
            # 1. Fetch connectors (needed by auth and academic/dining/career snapshots)
            # Actually snapshots call get_connector_snapshots themselves, but with a shared connection it's efficient.
            
            # 2. Heavy snapshots (using shared connection)
            auth = safe_exec("auth", lambda: get_auth_status(clerk_id, conn=conn), {"status": "preview"})
            academic = safe_exec("academic", lambda: get_academic_snapshot(clerk_id, conn=conn), {"status": "preview", "courses": []})
            dining = safe_exec("dining", lambda: get_dining_snapshot(clerk_id, conn=conn), {"status": "preview"})
            career = safe_exec("career", lambda: get_career_snapshot(clerk_id, conn=conn), {"status": "preview"})
            network = safe_exec("network", lambda: discover_network(clerk_id, limit=6, conn=conn), {"suggestions": []})
            events = safe_exec("events", lambda: get_events_snapshot(clerk_id, limit=6, conn=conn), [])
            
            # 3. Notification hub (Passed pre-loaded data to avoid redundant DB calls)
            notifications = safe_exec("notifications", lambda: get_notification_hub(
                clerk_id,
                academic_data=academic,
                dining_data=dining,
                events_data=events,
                network_data=network,
                conn=conn
            ), [])

            # 4. Other services (Transit/Rec/Connectors)
            transit = safe_exec("transit", get_transit_snapshot, {"status": "live"})
            recreation = safe_exec("recreation", get_recreation_snapshot, {"facilities": []})
            services = safe_exec("services", get_services_snapshot, [])
            connectors = safe_exec("connectors", lambda: get_connector_snapshots(clerk_id, conn=conn), [])

            return {
                "auth": auth,
                "academic": academic,
                "dining": dining,
                "notifications": notifications,
                "career": career,
                "network": network,
                "events": events,
                "transit": transit,
                "recreation": recreation,
                "services": services,
                "connectors": connectors,
                "generatedAt": _utc_now_iso(),
            }
    except Exception as exc:
        print(f"[campus_hub] Critical overview failure for {clerk_id}: {exc}")
        return {"status": "error", "message": "Overview temporarily unavailable"}
