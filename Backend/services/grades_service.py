"""
services/grades_service.py
---------------------------
Grade-distribution loading: live from anex.us, with a TTL'd file cache.

anex.us is the source of truth — it answers in well under a second with clean
JSON, so there's no reason to treat a file on disk as authoritative. The files
in Backend/Data/grades/ are a latency-and-outage cache only: entries older than
GRADES_CACHE_TTL_HOURS are refetched (so new semesters actually land), and a
stale entry is still served if anex.us is unreachable. The directory is
gitignored and regenerable — scrape_grades.py --catalog warms it in bulk.

The live fetch uses `requests` (already a hard dependency, and what
scrape_grades.py uses against this same endpoint). That matters beyond
consistency: `requests` ships its own certifi CA bundle, whereas stdlib
urllib relies on the interpreter's default trust store — which is empty on
a macOS python.org install that never ran Install Certificates.command, so
every live fetch there failed verification and silently degraded to "no
grade data".

Used by routers/grades.py (the /grades HTTP endpoints) and by revai/data.py
(professor GPA lookups) — a shared, public home so RevAI doesn't reach into
a router's private internals.
"""

from __future__ import annotations

import json
import os
import time
from typing import Any, Dict, List, Optional

import requests
from fastapi import HTTPException

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "Data", "grades")
ANEX_BASE = "https://anex.us/grades/getData/"
# How long a cached file stays authoritative. Grade reports only change when a
# semester closes, so a day is plenty — the point is that entries expire at all.
CACHE_TTL_SECONDS = float(os.getenv("GRADES_CACHE_TTL_HOURS", "24")) * 3600


def _anex_fetch(subject: str, course_number: str) -> List[Dict[str, Any]]:
    """Live POST fetch from anex.us, returns raw rows."""
    resp = requests.post(
        ANEX_BASE,
        data={"dept": subject.upper(), "number": course_number},
        timeout=15,
    )
    # urlopen raised on 4xx/5xx implicitly; requests doesn't, and without this an
    # error page would fall through to the parse below as "class not found".
    resp.raise_for_status()

    try:
        payload = resp.json()
    except ValueError:
        # anex.us may return non-JSON (e.g. HTML) when dept/course is invalid
        raise HTTPException(
            status_code=404,
            detail="Sorry, class not found",
        ) from None
    if isinstance(payload, dict) and "classes" in payload:
        return payload["classes"]
    if isinstance(payload, list):
        return payload
    return []


def _transform_row(
    raw: Dict[str, Any],
    subject: str,
    course_number: str,
) -> Dict[str, Any]:
    """Convert an anex.us row into our canonical GradeRow shape."""

    # anex.us returns lowercase keys: year, semester, prof, gpa, section
    def _int(v: Any) -> int:
        try:
            return int(v) if v != "" else 0
        except Exception:
            return 0

    def _float(v: Any) -> float:
        try:
            return round(float(v), 3)
        except Exception:
            return 0.0

    year = _int(raw.get("year", 0))
    semester = str(raw.get("semester", "")).upper()

    suffix_map = {"SPRING": "1", "SUMMER": "2", "FALL": "3"}
    term_code = f"{year}{suffix_map.get(semester, '0')}"

    return {
        "term_code": term_code,
        "year": year,
        "semester": semester,
        "college_code": "",
        "subject": subject.upper(),
        "course_number": str(course_number),
        "section": str(raw.get("section", "")),
        "instructor": str(raw.get("prof", "STAFF")).strip(),
        "a_count": _int(raw.get("A", 0)),
        "b_count": _int(raw.get("B", 0)),
        "c_count": _int(raw.get("C", 0)),
        "d_count": _int(raw.get("D", 0)),
        "f_count": _int(raw.get("F", 0)),
        "i_count": _int(raw.get("I", 0)),
        "q_count": _int(raw.get("Q", 0)),
        "s_count": _int(raw.get("S", 0)),
        "u_count": _int(raw.get("U", 0)),
        "x_count": _int(raw.get("X", 0)),
        "avg_gpa": _float(raw.get("gpa", 0.0)),
    }


def _read_cache(filepath: str) -> Optional[List[Dict[str, Any]]]:
    """Rows from a cache file, or None if it's missing or unreadable. A corrupt
    file is deleted so the next call re-fetches instead of failing forever."""
    if not os.path.exists(filepath):
        return None
    try:
        with open(filepath, encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        try:
            os.remove(filepath)
        except OSError:
            pass
        return None


def _is_fresh(filepath: str) -> bool:
    try:
        return (time.time() - os.path.getmtime(filepath)) < CACHE_TTL_SECONDS
    except OSError:
        return False


def load_or_fetch(subject: str, course_number: str) -> List[Dict[str, Any]]:
    """Rows for a course: a fresh cache file if one exists, else live from anex.us."""
    filename = f"{subject.upper()}_{course_number}.json"
    filepath = os.path.join(DATA_DIR, filename)

    cached = _read_cache(filepath)
    if cached is not None and _is_fresh(filepath):
        return cached

    try:
        raw_rows = _anex_fetch(subject, course_number)
    except Exception:
        # anex.us unreachable (or a bad status) — a stale cache beats no data.
        if cached is not None:
            return cached
        raise

    rows = [_transform_row(r, subject, course_number) for r in raw_rows]

    # Only persist a real result. Caching an empty list would pin this course to
    # "no grade data" for a full TTL on one bad response.
    if rows:
        os.makedirs(DATA_DIR, exist_ok=True)
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(rows, f, indent=2)

    return rows


def list_cached_subjects() -> List[Dict[str, str]]:
    """Return the list of (subject, course) pairs that are already cached on disk."""
    results: List[Dict[str, str]] = []
    if not os.path.exists(DATA_DIR):
        return results
    for fname in sorted(os.listdir(DATA_DIR)):
        if fname.endswith(".json"):
            parts = fname[:-5].split("_", 1)
            if len(parts) == 2:
                results.append({"subject": parts[0], "course_number": parts[1]})
    return results
