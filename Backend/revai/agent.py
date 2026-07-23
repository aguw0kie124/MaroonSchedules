"""RevAI agentic assistant (Pydantic AI).

The model decides which tools to call over real TAMU data — course facts,
professor grade distributions, and web search — and can chain them. Used only
for substantive questions; simple/conversational questions take the fast lane in
assistant_service.

Model: Google Gemini. The agent model can be overridden with GEMINI_AGENT_MODEL
(defaults to Flash, which is fast and tool-capable).
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from pydantic_ai import Agent, RunContext
from pydantic_ai.models.google import GoogleModel, GoogleModelSettings
from pydantic_ai.providers.google import GoogleProvider
from pydantic_ai.usage import UsageLimits

from services import gemini_client, revai_data, web_search_service

logger = logging.getLogger("backend.revai_agent")

SYSTEM_PROMPT = (
    "You are RevAI, a friendly, knowledgeable Texas A&M University (College Station) "
    "campus assistant. Answer concisely (1-4 sentences), warmly, with **bold** for key "
    "names and numbers.\n\n"
    "Call a tool ONLY when you need specific or current campus data:\n"
    "- find_courses(query): resolve a course NAME or keyword to real course codes "
    "(e.g. 'linear algebra' / 'lin alg' -> MATH 304). Use this FIRST whenever the user "
    "names a subject or course but does not give an explicit code.\n"
    "- get_course_info(course_code): a course's average GPA, difficulty, credits, prerequisites.\n"
    "- get_best_professors(course_code): which instructors have the highest GPA for a course.\n"
    "- search_web(query): things the course tools can't answer — events, dining hours, clubs, "
    "deadlines, news, how-to.\n\n"
    "For ANY question about a course or its professors, ALWAYS use the course tools. If you "
    "don't have the exact code, call find_courses first to get it, then get_course_info / "
    "get_best_professors. Do NOT use search_web for course or professor questions.\n"
    "For greetings and general knowledge, answer directly and do NOT call tools. "
    "Never invent specific numbers — get them from a tool. Course codes look like 'CSCE 221'.\n"
    "Be efficient: use as few tool calls as needed, then give your answer."
)

# Request budget for the tool loop (each model turn = 1 request); bounds latency.
AGENT_REQUEST_LIMIT = int(os.getenv("GEMINI_AGENT_REQUEST_LIMIT", "4"))
# Per-HTTP-request timeout to the model (seconds). Keep request_limit * this under
# the endpoint's 43s guard.
AGENT_HTTP_TIMEOUT = float(os.getenv("GEMINI_AGENT_TIMEOUT", "18"))


@dataclass
class RevAIDeps:
    """Injected into every tool; tools stash renderable UI payloads here."""
    ui_courses: Optional[List[dict]] = None
    ui_card: Optional[dict] = None


# Flash is the agent default: fast per call (which matters in a multi-turn tool
# loop) and reliable at function calling. Point GEMINI_AGENT_MODEL at a Pro model
# if answer quality ever matters more than latency.
DEFAULT_AGENT_MODEL = "gemini-3.5-flash"


def _agent_model_name() -> str:
    return (os.getenv("GEMINI_AGENT_MODEL") or "").strip() or DEFAULT_AGENT_MODEL


_agent = None  # built lazily so import never requires the key / never breaks startup


def _build_agent():
    provider = GoogleProvider(api_key=gemini_client.api_key() or "missing")
    settings = GoogleModelSettings(
        timeout=AGENT_HTTP_TIMEOUT,
        # Gemini 2.5+ thinks by default; in a tool loop that cost is paid on every
        # turn, so it's off unless GEMINI_ENABLE_THINKING says otherwise. The portable
        # `thinking` flag maps to thinking_level on Gemini 3+ and thinking_budget on
        # 2.5 (and is ignored by always-thinking Pro models), so this survives a
        # GEMINI_AGENT_MODEL swap in either direction.
        thinking=gemini_client.thinking_enabled(),
    )
    model = GoogleModel(_agent_model_name(), provider=provider, settings=settings)
    agent = Agent(model, deps_type=RevAIDeps, system_prompt=SYSTEM_PROMPT, retries=1)

    @agent.tool
    def find_courses(ctx: RunContext[RevAIDeps], query: str) -> list:
        """Resolve a course NAME or keyword to real course codes. Use this FIRST when the
        user names a subject/course without a code (e.g. 'linear algebra', 'lin alg',
        'organic chem'). Returns matches as {code, name, avgGPA, difficulty}."""
        return revai_data.search_courses_by_name(query, limit=6)

    @agent.tool
    def get_course_info(ctx: RunContext[RevAIDeps], course_code: str) -> dict:
        """Average GPA, difficulty, credits, and prerequisites for a course. course_code like 'CSCE 221'."""
        payload = revai_data.course_payload(course_code)
        return payload["data"] or {"note": f"No catalog entry found for {course_code}."}

    @agent.tool
    def get_best_professors(ctx: RunContext[RevAIDeps], course_code: str) -> dict:
        """Professors ranked by GPA for a course, from grade distributions. course_code like 'CSCE 221'."""
        payload = revai_data.course_payload(course_code)
        if payload.get("courses"):
            ctx.deps.ui_courses = payload["courses"]  # renders as a card in the app
            return {"professors": payload["courses"]}
        return {"note": f"No grade data available for {course_code}; course-level info is still available."}

    @agent.tool
    def search_web(ctx: RunContext[RevAIDeps], query: str) -> list:
        """Search the web (biased to Texas A&M) for current/local info. Returns title/snippet/url."""
        return web_search_service.search(revai_data.tamu_query(query), max_results=5)

    return agent


def _get_agent():
    global _agent
    if _agent is None:
        _agent = _build_agent()
    return _agent


def answer(message: str) -> Dict[str, Any]:
    """Run the agent loop and return {text, courses?, card?}."""
    deps = RevAIDeps()
    result = _get_agent().run_sync(
        message,
        deps=deps,
        usage_limits=UsageLimits(request_limit=AGENT_REQUEST_LIMIT),
    )
    out: Dict[str, Any] = {"text": (result.output or "").strip()}
    if deps.ui_courses:
        out["courses"] = deps.ui_courses
    if deps.ui_card:
        out["card"] = deps.ui_card
    return out
