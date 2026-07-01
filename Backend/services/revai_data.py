"""Pure campus-data helpers for RevAI (no LLM, no framework).

Shared by the Pydantic AI agent tools (revai_agent) and the deterministic
fallback (assistant_service). Kept framework-free so both can import it without
circular dependencies.

- Course facts come from the in-memory course catalog (course_repository).
- Professor GPAs come from the PRE-CACHED grades files only (never the grades
  router's live 15s anex fetch).
"""

from __future__ import annotations

import json
import logging
import os
import re
from typing import Any, Dict, List, Optional

from repositories import course_repository

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
    for candidate in course_repository.get_all_courses():
        cand_id = normalize_code(str(candidate.get("id", "")))
        cand_code = normalize_code(str(candidate.get("code", "")))
        if normalized and normalized in (cand_id, cand_code):
            return candidate
    return None


def professors_from_grades(subject: str, number: str) -> List[dict]:
    """Ranked instructors (best GPA first) from the PRE-CACHED grades file only."""
    from routers.grades import DATA_DIR

    path = os.path.join(DATA_DIR, f"{subject.upper()}_{number}.json")
    if not os.path.exists(path):
        return []
    try:
        with open(path, encoding="utf-8") as f:
            rows = json.load(f)
    except Exception as exc:  # noqa: BLE001 - grades are best-effort
        logger.warning("grades read failed for %s %s: %s", subject, number, exc)
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
    for c in course_repository.get_all_courses():
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
