"""
services/grades_service.py
---------------------------
Grade-distribution loading: file-first, live-fetch-and-cache fallback.

The primary data source is the JSON files written by scrape_grades.py
(stored in Backend/Data/grades/). If a file is not yet on disk this fetches
live from anex.us and caches the result.

Uses only stdlib (urllib) for the live fetch so we don't add a hard
dependency on the `requests` package at server startup.

Used by routers/grades.py (the /grades HTTP endpoints) and by revai/data.py
(professor GPA lookups) — a shared, public home so RevAI doesn't reach into
a router's private internals.
"""

from __future__ import annotations

import json
import os
import urllib.parse
import urllib.request
from typing import Any, Dict, List

from fastapi import HTTPException

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "Data", "grades")
ANEX_BASE = "https://anex.us/grades/getData/"
REQUEST_DELAY = 0.3  # seconds


def _anex_fetch(subject: str, course_number: str) -> List[Dict[str, Any]]:
    """Live POST fetch from anex.us using stdlib urllib, returns raw rows."""
    form_data = urllib.parse.urlencode({
        "dept": subject.upper(),
        "number": course_number,
    }).encode("utf-8")

    req = urllib.request.Request(ANEX_BASE, data=form_data, method="POST")
    req.add_header("Content-Type", "application/x-www-form-urlencoded")

    with urllib.request.urlopen(req, timeout=15) as resp:
        body = resp.read().decode("utf-8")

    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
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


def load_or_fetch(subject: str, course_number: str) -> List[Dict[str, Any]]:
    """Return rows from cache file, or fetch + cache from anex.us."""
    filename = f"{subject.upper()}_{course_number}.json"
    filepath = os.path.join(DATA_DIR, filename)

    if os.path.exists(filepath):
        try:
            with open(filepath, encoding="utf-8") as f:
                return json.load(f)
        except json.JSONDecodeError:
            try:
                os.remove(filepath)
            except OSError:
                pass

    # Not cached — fetch live
    raw_rows = _anex_fetch(subject, course_number)
    rows = [_transform_row(r, subject, course_number) for r in raw_rows]

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
