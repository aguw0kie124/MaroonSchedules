"""RevAI campus-assistant agent.

Pattern (reuses the app's existing OpenRouter LLM client — no native tool-calling):

    1. ROUTE  — LLM picks which campus data source answers the question (JSON).
    2. FETCH  — backend pulls real data from existing services and builds the
                structured UI payload (courses list / info card) DETERMINISTICALLY,
                so numbers are never hallucinated.
    3. ANSWER — LLM writes the natural-language summary (plain text) over that data.

Returns the shape the RevAI screen renders: {"text", "card"?, "courses"?}.

Slice 1 supports the "course" source (course difficulty / GPA / best professor /
grade distribution). Dining, events, and clubs are added in later slices.
"""

from __future__ import annotations

import logging
import re
from typing import Any, Dict, List, Optional

from repositories import course_repository
from services import llm_client

logger = logging.getLogger("backend.assistant")

GRADE_POINTS = {"A": 4.0, "B": 3.0, "C": 2.0, "D": 1.0, "F": 0.0}

ROUTE_SYSTEM = (
    "You are RevAI, a Texas A&M (College Station) campus assistant. "
    "Decide which campus data source can answer the user's question. "
    "Reply with ONLY a JSON object, no markdown.\n\n"
    "Sources:\n"
    '- "course": questions about a specific course — difficulty, average GPA, '
    "best/easiest professor, grade distribution, prerequisites, or credits. "
    'args: {"code": "<DEPT NUMBER>"} e.g. {"code": "CSCE 221"}.\n'
    '- "none": greetings, small talk, or anything not about a specific course.\n\n'
    'Respond exactly like: {"source": "course", "args": {"code": "CSCE 221"}} '
    'or {"source": "none", "args": {}}'
)

ANSWER_SYSTEM = (
    "You are RevAI, a friendly Texas A&M campus assistant. "
    "Answer the user's question using ONLY the DATA provided (JSON). "
    "Be concise (1-3 sentences), specific, and warm. "
    "Use **bold** for key names and numbers. "
    "Never invent numbers — if DATA is empty, say you couldn't find that and "
    "mention you can help with courses, professors, and GPAs. "
    "Reply with plain text only (no JSON, no markdown headings)."
)

NO_KEY_FALLBACK = {
    "text": "RevAI isn't fully configured yet (missing model access). "
    "I can still help once that's set up — try asking about a course like CSCE 221."
}


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #

def _normalize_code(value: str) -> str:
    """'CSCE 221' / 'csce-221' -> 'CSCE221'."""
    return re.sub(r"[^A-Za-z0-9]", "", value or "").upper()


def _course_number(code: str) -> str:
    """'CSCE 221' -> '221' (for the course-list badge)."""
    match = re.search(r"(\d+[A-Za-z]?)", code or "")
    return match.group(1) if match else (code or "")[:4]


def _gpa_from_distribution(dist: Optional[Dict[str, Any]]) -> Optional[float]:
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


def _find_course(code: str) -> Optional[dict]:
    """Match a course by normalized id or code from the in-memory catalog.

    The catalog carries course-level facts (avg GPA, difficulty, credits,
    prerequisites). Per-professor grade data comes separately from the grades
    source. Deliberately does NOT call get_course_details, which additionally
    fetches sections we don't need (slow, and can block when the DB is down).
    """
    if not code:
        return None
    normalized = _normalize_code(code)

    for candidate in course_repository.get_all_courses():
        cand_id = _normalize_code(str(candidate.get("id", "")))
        cand_code = _normalize_code(str(candidate.get("code", "")))
        if normalized and normalized in (cand_id, cand_code):
            return candidate
    return None


def _subject_number(code: str) -> tuple[Optional[str], Optional[str]]:
    """'CSCE 221' -> ('CSCE', '221')."""
    match = re.match(r"\s*([A-Za-z]{2,4})\s*0*(\d{2,4}[A-Za-z]?)", code or "")
    if match:
        return match.group(1).upper(), match.group(2)
    return None, None


def _professors_from_grades(subject: str, number: str) -> List[dict]:
    """Aggregate per-instructor grade rows into ranked profs (best GPA first)."""
    try:
        from routers.grades import _load_or_fetch

        rows = _load_or_fetch(subject, number)
    except Exception as exc:  # noqa: BLE001 - grades are best-effort
        logger.warning("grades lookup failed for %s %s: %s", subject, number, exc)
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
        gpa = _gpa_from_distribution(bucket)
        if gpa is None:
            continue
        professors.append({"name": name, "gpa": gpa, "sections": int(bucket["sections"])})

    professors.sort(key=lambda p: p["gpa"], reverse=True)
    return professors


def _build_course_payload(code: str) -> Dict[str, Any]:
    """Build (data_for_llm, structured_courses_list) from catalog + grades."""
    course = _find_course(code)

    display_code = str((course.get("code") if course else None) or code)
    subject, number = _subject_number(display_code)
    if not subject:
        subject, number = _subject_number(code)

    top = _professors_from_grades(subject, number)[:4] if (subject and number) else []
    badge = number or _course_number(display_code)

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


# --------------------------------------------------------------------------- #
# LLM steps
# --------------------------------------------------------------------------- #

def _route(message: str, models: List[str]) -> Dict[str, Any]:
    try:
        result = llm_client.chat_completion(
            [
                {"role": "system", "content": ROUTE_SYSTEM},
                {"role": "user", "content": message},
            ],
            models,
            purpose="assistant_route",
            timeout_seconds=10.0,
            temperature=0.0,
            max_tokens=120,
            retry_on_invalid_json=True,
        )
        parsed = llm_client.parse_json_object(result.content)
        source = parsed.get("source")
        args = parsed.get("args") if isinstance(parsed.get("args"), dict) else {}
        if source in ("course", "none"):
            return {"source": source, "args": args}
    except Exception as exc:  # noqa: BLE001 - routing must never hard-fail
        logger.warning("assistant route failed: %s", exc)
    return {"source": "none", "args": {}}


def _answer_text(message: str, data: Any, models: List[str]) -> str:
    import json

    user_content = f"Question: {message}\n\nDATA:\n{json.dumps(data, default=str)}"
    result = llm_client.chat_completion(
        [
            {"role": "system", "content": ANSWER_SYSTEM},
            {"role": "user", "content": user_content},
        ],
        models,
        purpose="assistant_answer",
        timeout_seconds=18.0,
        temperature=0.3,
        max_tokens=320,
    )
    return llm_client._strip_markdown_fences(result.content).strip()


# --------------------------------------------------------------------------- #
# Public entry point
# --------------------------------------------------------------------------- #

def answer_question(message: str) -> Dict[str, Any]:
    message = (message or "").strip()
    if not message:
        return {"text": "Ask me anything about courses, professors, dining, or events!"}

    import os

    if not (os.getenv("OPENROUTER_API_KEY") or "").strip():
        return dict(NO_KEY_FALLBACK)

    models = llm_client.get_event_classifier_models()

    route = _route(message, models)
    structured: Dict[str, Any] = {}
    data: Any = None

    if route["source"] == "course":
        payload = _build_course_payload(str(route["args"].get("code", "")))
        data = payload["data"]
        if payload.get("courses"):
            structured["courses"] = payload["courses"]

    try:
        text = _answer_text(message, data, models)
    except Exception as exc:  # noqa: BLE001
        logger.warning("assistant answer failed: %s", exc)
        text = (
            "I had trouble reaching campus data just now. "
            "Try again in a moment, or ask about a specific course like CSCE 221."
        )

    return {"text": text, **structured}
