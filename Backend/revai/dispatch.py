"""RevAI campus assistant — dispatch layer.

Every question runs the Pydantic AI tool loop (revai/agent.py) and the model
decides whether any tool is needed, so a greeting costs the same single request
as a course lookup — the tool schemas add input tokens, not extra API calls.
This matches /ai/assistant/stream, which has always driven the agent directly.

There used to be a keyword-regex "fast lane" that answered `simple` questions
without offering tools. It was removed: `\\b`-anchored keywords missed every
plural ("electives", "grades", "sections") and every follow-up ("who teaches
it?"), routing exactly the questions that needed data into the lane that
couldn't fetch any — and it made the two endpoints answer the same message
differently.

The single fast LLM call and the deterministic course summary survive as
*fallbacks*: on agent failure we degrade agent -> deterministic summary ->
plain call, surfacing errors as reply text instead of silent timeouts. The
deterministic path needs no LLM at all, so course questions still answer when
the model is rate-limited. Loud [RevAI] logging throughout.
"""

from __future__ import annotations

import logging
import os
import re
import time
from typing import Any, Dict, List, Optional

from services import llm_client

logger = logging.getLogger("backend.assistant")

FAST_SYSTEM_PROMPT = (
    "You are RevAI, a friendly Texas A&M University (College Station) campus assistant. "
    "Reply in one or two short, warm sentences using general knowledge about Texas A&M, "
    "Aggie traditions, and college life. Use **bold** for key names. Plain text only."
)

FAST_MAX_TOKENS = 220
FAST_TIMEOUT_S = 20.0   # fast lane: keep it snappy
LLM_TIMEOUT_S = 38.0    # plain-call fallback: a bit more room

# Used only by the deterministic fallback below to pull a course code out of the
# message — never for routing.
_COURSE_CODE_RE = re.compile(r"\b([A-Za-z]{2,4})\s?(\d{3}[A-Za-z]?)\b")


def _log(msg: str) -> None:
    print(f"[RevAI] {msg}", flush=True)
    logger.info(msg)


def _fast_answer(message: str, history: Optional[List[Dict[str, str]]] = None) -> str:
    """One quick LLM call, no tools — the last-resort fallback when the agent fails.
    Uses GEMINI_FAST_MODEL if set (else the default)."""
    from .clients import gemini as gemini_client

    messages: List[Dict[str, str]] = [{"role": "system", "content": FAST_SYSTEM_PROMPT}]
    messages.extend(history or [])
    messages.append({"role": "user", "content": message})
    if gemini_client.is_configured():
        fast_model = (os.getenv("GEMINI_FAST_MODEL") or "").strip() or None
        _log(f"fast provider=gemini model={fast_model or gemini_client.get_model()}")
        return gemini_client.chat(
            messages, model=fast_model, temperature=0.3,
            max_tokens=FAST_MAX_TOKENS, timeout_seconds=FAST_TIMEOUT_S,
        )
    _log("fast provider=openrouter")
    result = llm_client.chat_completion(
        messages, llm_client.get_assistant_models(), purpose="assistant_fast",
        timeout_seconds=FAST_TIMEOUT_S, temperature=0.3, max_tokens=FAST_MAX_TOKENS,
    )
    return llm_client._strip_markdown_fences(result.content).strip()


def _deterministic_course_summary(message: str) -> Optional[Dict[str, Any]]:
    """Build a course answer from data WITHOUT the LLM (used when the model is down)."""
    from . import data as revai_data

    match = _COURSE_CODE_RE.search(message or "")
    if not match:
        return None
    payload = revai_data.course_payload(f"{match.group(1).upper()} {match.group(2)}")
    data = payload.get("data")
    if not data:
        return None
    facts = []
    if data.get("avgGPA") is not None:
        facts.append(f"an average GPA of {data['avgGPA']}")
    if data.get("difficulty") and data["difficulty"] != "Unknown":
        facts.append(f"a difficulty rating of {data['difficulty']}")
    parts = []
    if facts:
        parts.append(f"{data['code']} has " + " and ".join(facts) + ".")
    courses = payload.get("courses") or []
    if courses:
        names = ", ".join(f"{c['name']} ({c['meta']})" for c in courses[:3])
        parts.append(f"Highest-GPA instructors: {names}.")
    if not parts:
        return None
    out: Dict[str, Any] = {"text": " ".join(parts)}
    if courses:
        out["courses"] = courses
    return out


def answer_question(
    message: str,
    history: Optional[List[Dict[str, Any]]] = None,
    user_id: Optional[str] = None,
) -> Dict[str, Any]:
    message = (message or "").strip()
    _log(f"Q={message!r}")
    if not message:
        return {"text": "Ask me anything about Texas A&M — courses, professors, dining, events, and more!"}

    started = time.time()
    from . import history as history_mod

    clipped = history_mod.clip(history)

    try:
        from . import agent as revai_agent

        _log("agent")
        out = revai_agent.answer(message, history=clipped, user_id=user_id)
        _log(f"agent OK in {time.time() - started:.1f}s courses={'courses' in out}")
        return out
    except Exception as exc:  # noqa: BLE001 - agent unavailable/failed -> graceful fallback
        import traceback

        traceback.print_exc()
        _log(f"agent ERROR in {time.time() - started:.1f}s: {exc!r} -> fallback")

        det = _deterministic_course_summary(message)  # works even if the LLM is down
        if det:
            return det
        try:
            return {"text": _fast_answer(message, history=clipped)}
        except Exception as exc2:  # noqa: BLE001
            return {"text": f"[RevAI error] {exc2}"}
