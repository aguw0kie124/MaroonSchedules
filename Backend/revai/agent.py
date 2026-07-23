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
from typing import Any, AsyncIterator, Dict, List, Optional

from pydantic_ai import Agent, RunContext
from pydantic_ai.models.google import GoogleModel, GoogleModelSettings
from pydantic_ai.providers.google import GoogleProvider
from pydantic_ai.usage import UsageLimits

from . import data as revai_data
from . import history as history_mod
from .clients import gemini as gemini_client
from .clients import web_search as web_search_service

logger = logging.getLogger("backend.revai_agent")

# Friendly status text shown to the client (via the streaming endpoint) while
# a tool call is in flight, keyed by tool name.
_TOOL_STATUS = {
    "find_courses": "Looking up the course…",
    "get_course_info": "Pulling course info…",
    "get_best_professors": "Checking grade data…",
    "get_dining_hours": "Checking dining hours…",
    "get_campus_events": "Looking up events…",
    "get_facility_busyness": "Checking how busy it is…",
    "get_my_schedule": "Pulling up your schedule…",
    "search_web": "Searching the web…",
}

SYSTEM_PROMPT = (
    "You are RevAI, a friendly, knowledgeable Texas A&M University (College Station) "
    "campus assistant. Answer concisely (1-4 sentences), warmly, with **bold** for key "
    "names and numbers.\n\n"
    "Call a tool ONLY when you need specific or current campus data. Prefer these native "
    "tools over search_web whenever one of them fits — they're faster and more accurate:\n"
    "- find_courses(query): resolve a course NAME or keyword to real course codes "
    "(e.g. 'linear algebra' / 'lin alg' -> MATH 304). Use this FIRST whenever the user "
    "names a subject or course but does not give an explicit code.\n"
    "- get_course_info(course_code): a course's average GPA, difficulty, credits, prerequisites.\n"
    "- get_best_professors(course_code): which instructors have the highest GPA for a course.\n"
    "- get_dining_hours(hall_name): today's hours and open/closed status for a dining hall or "
    "eatery (e.g. 'Sbisa', 'Commons', 'Duncan').\n"
    "- get_campus_events(day, category): what's happening on campus. `day` is optional free text "
    "('today', 'tomorrow', a weekday name, or omit for upcoming). `category` is optional "
    "(e.g. 'sports', 'academic', 'social', 'food').\n"
    "- get_facility_busyness(name): current occupancy for a gym or library (e.g. 'the rec', "
    "'Evans Library').\n"
    "- get_my_schedule(): the signed-in user's own enrolled courses/sections. Use for 'my "
    "schedule', 'when's my next class', 'what classes do I have'. Takes no arguments — it "
    "always looks up the current user, never a name from the message.\n"
    "- search_web(query): only for things none of the above can answer — clubs, deadlines, "
    "news, how-to, anything not covered by a native tool.\n\n"
    "For ANY question about a course or its professors, ALWAYS use the course tools. If you "
    "don't have the exact code, call find_courses first to get it, then get_course_info / "
    "get_best_professors. Do NOT use search_web for course or professor questions, dining "
    "hours, events, or facility busyness — use the matching native tool instead.\n"
    "For greetings and general knowledge, answer directly and do NOT call tools. "
    "Never invent specific numbers — get them from a tool. Course codes look like 'CSCE 221'.\n"
    "Be efficient: use as few tool calls as needed, then give your answer."
)

# Request budget for the tool loop (each model turn = 1 request); bounds latency.
# 5 (not 4) leaves room for one extra chained call now that there are more tools
# (e.g. find_courses -> get_best_professors, or resolve a place -> read busyness).
AGENT_REQUEST_LIMIT = int(os.getenv("GEMINI_AGENT_REQUEST_LIMIT", "5"))
# Per-HTTP-request timeout to the model (seconds). Keep request_limit * this under
# the endpoint's 43s guard.
AGENT_HTTP_TIMEOUT = float(os.getenv("GEMINI_AGENT_TIMEOUT", "18"))


@dataclass
class RevAIDeps:
    """Injected into every tool; tools stash renderable UI payloads here.

    `user_id` is the authenticated Clerk id from the endpoint (never from
    message text) — the only thing a personalized tool (get_my_schedule) is
    allowed to key off of.
    """
    user_id: Optional[str] = None
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
    def get_dining_hours(ctx: RunContext[RevAIDeps], hall_name: str) -> dict:
        """Today's hours and open/closed status for a dining hall or eatery
        (e.g. 'Sbisa', 'Commons', 'Duncan'). Returns {name, detail, status?}."""
        card = revai_data.dining_hours(hall_name)
        if not card:
            return {"note": f"Couldn't find a dining location matching '{hall_name}'."}
        ctx.deps.ui_card = card  # renders as a status card in the app
        return card

    @agent.tool
    def get_campus_events(
        ctx: RunContext[RevAIDeps], day: str = "", category: str = ""
    ) -> list:
        """What's happening on campus. `day` is optional free text ('today', 'tomorrow',
        a weekday name, or '' for upcoming). `category` is optional (e.g. 'sports',
        'academic', 'social', 'food'). Returns [{title, start, location, category}]."""
        events = revai_data.campus_events(day=day or None, category=category or None, limit=8)
        return events or [{"note": "No matching events found."}]

    @agent.tool
    def get_facility_busyness(ctx: RunContext[RevAIDeps], name: str) -> dict:
        """Current occupancy for a gym or library (e.g. 'the rec', 'Evans Library').
        Returns {name, percent_full, available_seats, capacity, current_count}."""
        busyness = revai_data.facility_busyness(name)
        if not busyness:
            return {"note": f"No live busyness data available for '{name}'."}
        return busyness

    @agent.tool
    def get_my_schedule(ctx: RunContext[RevAIDeps]) -> list:
        """The signed-in user's own enrolled courses/sections. Takes no arguments —
        always looks up the current authenticated user. Returns
        [{code, name, section, instructor, days, time}]."""
        if not ctx.deps.user_id:
            return [{"note": "No signed-in user available for this request."}]
        sections = revai_data.my_schedule(ctx.deps.user_id)
        return sections or [{"note": "No saved schedule found for this user."}]

    @agent.tool
    def search_web(ctx: RunContext[RevAIDeps], query: str) -> list:
        """Search the web (biased to Texas A&M) for current/local info — only when no
        other tool fits. Returns title/snippet/url."""
        return web_search_service.search(revai_data.tamu_query(query), max_results=5)

    return agent


def _get_agent():
    global _agent
    if _agent is None:
        _agent = _build_agent()
    return _agent


def answer(
    message: str, history: Optional[List[Dict[str, str]]] = None, user_id: Optional[str] = None
) -> Dict[str, Any]:
    """Run the agent loop and return {text, courses?, card?}."""
    deps = RevAIDeps(user_id=user_id)
    message_history = history_mod.to_model_messages(history) if history else None
    result = _get_agent().run_sync(
        message,
        deps=deps,
        message_history=message_history,
        usage_limits=UsageLimits(request_limit=AGENT_REQUEST_LIMIT),
    )
    out: Dict[str, Any] = {"text": (result.output or "").strip()}
    if deps.ui_courses:
        out["courses"] = deps.ui_courses
    if deps.ui_card:
        out["card"] = deps.ui_card
    return out


async def answer_stream(
    message: str,
    history: Optional[List[Dict[str, str]]] = None,
    user_id: Optional[str] = None,
) -> AsyncIterator[Dict[str, Any]]:
    """Run the agent loop, yielding {"type": "status"|"delta"|"done", ...} events
    as they happen — tool calls become status updates, text becomes deltas, and
    the final event carries the full text plus any UI payload."""
    from pydantic_ai import AgentRunResultEvent
    from pydantic_ai.messages import FunctionToolCallEvent, PartDeltaEvent, TextPartDelta

    deps = RevAIDeps(user_id=user_id)
    message_history = history_mod.to_model_messages(history) if history else None
    agent = _get_agent()
    async with agent.run_stream_events(
        message,
        deps=deps,
        message_history=message_history,
        usage_limits=UsageLimits(request_limit=AGENT_REQUEST_LIMIT),
    ) as events:
        async for event in events:
            if isinstance(event, FunctionToolCallEvent):
                yield {"type": "status", "text": _TOOL_STATUS.get(event.part.tool_name, "Working on it…")}
            elif isinstance(event, PartDeltaEvent) and isinstance(event.delta, TextPartDelta):
                if event.delta.content_delta:
                    yield {"type": "delta", "text": event.delta.content_delta}
            elif isinstance(event, AgentRunResultEvent):
                out: Dict[str, Any] = {"type": "done", "text": (event.result.output or "").strip()}
                if deps.ui_courses:
                    out["courses"] = deps.ui_courses
                if deps.ui_card:
                    out["card"] = deps.ui_card
                yield out
