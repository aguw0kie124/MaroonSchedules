# RevAI — AI Agent Architecture

RevAI is the in-app AI campus assistant for Texas A&M. A student asks a
free-text question ("best prof for CSCE 221?", "is Sbisa open?", "easy
electives") and RevAI answers from **real campus data** — the course catalog,
professor grade distributions, and the web — rather than from the model's memory
alone.

The design goal, reflected throughout the code, is: **always return a useful
answer quickly, and never hang, 500, or invent numbers.**

---

## High-level flow

```
 React Native app
   AssistantScreen ──askAssistant()──> POST /ai/assistant        (Frontend/services/assistantService.ts)
                                          │
                                          ▼
   routers/ai.py  ── run on dedicated ThreadPoolExecutor, 43s hard cap ──┐
                                          │                              │
                                          ▼                              │
   assistant_service.answer_question(message)                           │
                    │                                                    │
        ┌───────────┴───────────┐                                       │
        ▼                       ▼                                        │
   FAST LANE               AGENT LANE                                    │
   (no tools)              revai_agent.answer()                          │
   one LLM call            Pydantic AI tool loop                         │
        │                       │                                        │
        │              ┌────────┼─────────┬──────────────┐              │
        │              ▼        ▼         ▼              ▼               │
        │      find_courses  get_course  get_best     search_web        │
        │                    _info       _professors                    │
        │              └────────┴────┬────┴──────────────┘              │
        │                            ▼                                   │
        │                     revai_data (catalog + grades + web)        │
        └────────────────────────────┬──────────────────────────────────┘
                                      ▼
                        { text, courses?, card? }  ──> rendered in the chat
```

---

## Request lifecycle

1. **Frontend** — [AssistantScreen.tsx](../Frontend/components/AssistantScreen.tsx)
   holds the chat state and calls `askAssistant(question)` in
   [assistantService.ts](../Frontend/services/assistantService.ts), which
   `POST`s `{ message }` to `/ai/assistant` with a 45s client timeout. The reply
   shape is `{ text, card?, courses? }`; `text` supports lightweight `**bold**`,
   `courses` renders as a professor list, `card` as an inline status card.

2. **Endpoint** — [routers/ai.py](../Backend/routers/ai.py) `POST /ai/assistant`
   (auth-required). The blocking LLM work runs on a **dedicated
   `ThreadPoolExecutor`** so it never competes with — or gets starved by — the
   shared FastAPI request pool (important when other endpoints are blocked on a
   slow database). A **43s hard timeout** (under the app's 45s client timeout)
   guarantees a friendly message instead of a client-side timeout, and the
   endpoint never returns a 500 to the chat UI.

3. **Dispatch** — [assistant_service.py](../Backend/services/assistant_service.py)
   `answer_question()` picks one of two lanes and owns the fallback chain.

---

## The two lanes

RevAI routes each question to the cheapest path that can answer it.

### Fast lane — simple / conversational
`is_simple(message)` returns `True` when the message has **no data signal**
(greetings, chit-chat, general knowledge). Detected by a keyword regex
(`_DATA_SIGNAL_RE`: prof, gpa, grade, hours, dining, event, course code, …).
The fast lane makes **one LLM call, no tools**, with a short prompt and a small
token budget (`FAST_MAX_TOKENS = 220`, `FAST_TIMEOUT_S = 20`). Snappy.

### Agent lane — needs real data
Anything with a data signal goes to
[revai_agent.py](../Backend/services/revai_agent.py) `answer()`, which runs a
**Pydantic AI tool loop**: the model decides which tools to call, can chain
them, and then writes the final answer.

> The regex router is a deliberate cost/latency trade-off, not a classifier.
> Its main weakness: a course question phrased by *name* with no signal word
> (e.g. "who teaches organic chemistry") can slip into the fast lane. See
> [Known limitations](#known-limitations--future-work).

---

## The agent

Built in `revai_agent._build_agent()`:

- **Framework:** Pydantic AI `Agent` with typed dependencies (`RevAIDeps`).
- **Model:** Google Gemini via Pydantic AI's `GoogleModel`/`GoogleProvider` (the
  `google-genai` SDK). The agent defaults to **`gemini-3.5-flash`** because it's
  fast per call — which compounds across a multi-turn tool loop — and reliable at
  function calling. Thinking is disabled by default since Gemini 2.5+ reasons by
  default and that cost is paid on every turn; set `GEMINI_ENABLE_THINKING=true`
  to turn it back on. The agent uses Pydantic AI's portable `thinking` setting,
  which maps to `thinking_level` on Gemini 3+ and `thinking_budget` on 2.5, so
  changing `GEMINI_AGENT_MODEL` across generations needs no code change.
- **Budget:** `AGENT_REQUEST_LIMIT = 4` model turns, `AGENT_HTTP_TIMEOUT = 18s`
  per call. `request_limit × timeout` is kept under the endpoint's 43s guard.
- **System prompt:** tells the model to call tools only for specific/current
  campus data, to resolve course names via `find_courses` first, to never invent
  numbers, and to answer concisely.
- **UI payloads:** tools stash renderable data on `ctx.deps` (`ui_courses`,
  `ui_card`); `answer()` lifts these into the response so the app can render
  cards, not just text.

### Tools

| Tool | Purpose | Data source |
|------|---------|-------------|
| `find_courses(query)` | Resolve a course **name/keyword** → real course codes ("lin alg" → MATH 304). Called first when the user names a subject without a code. | Course catalog |
| `get_course_info(code)` | Avg GPA, difficulty, credits, prerequisites. | Course catalog |
| `get_best_professors(code)` | Instructors ranked by GPA for a course. | Grade distributions |
| `search_web(query)` | Events, dining hours, deadlines, clubs — things the course tools can't answer. Query is biased toward Texas A&M. | Web search |

---

## Data layer

All pure, framework-free data helpers live in
[revai_data.py](../Backend/services/revai_data.py) so both the agent tools and
the deterministic fallback can share them.

### Course catalog
`find_course`, `course_payload`, and `search_courses_by_name` read the in-memory
catalog from [course_repository.py](../Backend/repositories/course_repository.py),
which fetches ~5,650 courses from an external catalog API. `search_courses_by_name`
does substring + token-prefix matching so natural-language names and
abbreviations resolve to codes.

### Professor grade distributions (on demand)
`professors_from_grades` aggregates per-instructor GPAs from grade rows, obtained
via the grades router's **file-first → live fetch → write-through cache** loader
(`routers/grades._load_or_fetch`):

- If `Backend/Data/grades/<SUBJECT>_<NUMBER>.json` exists, it's served instantly.
- If not, the row set is fetched live from **anex.us** (which returns JSON — no
  HTML scraping) and written to the cache, so every later lookup is a fast file
  read.

This means grade/professor answers cover the **whole catalog on demand** — each
course is fetched at most once — rather than being limited to a pre-seeded set.
The same endpoint (`GET /grades/search`) also powers the app's Academics tab, so
RevAI and that tab share one cache. `scrape_grades.py --catalog` is an *optional*
warmer for popular courses (removes the first-hit fetch latency); it is no longer
the data source.

### Web search
[web_search_service.py](../Backend/services/web_search_service.py) tries providers
in quality order and returns the first with results: **Tavily**
(`TAVILY_API_KEY`) → **DuckDuckGo HTML** → **DuckDuckGo Instant Answer**. Always
best-effort — any failure returns `[]` and the model answers from general
knowledge.

### LLM clients
- [gemini_client.py](../Backend/services/gemini_client.py) — the Gemini call used
  by the fast lane, via the `google-genai` SDK.
- The agent lane uses Pydantic AI's `GoogleModel` with the same API key.
- `llm_client` is the OpenRouter fallback when Gemini isn't configured.

---

## Reliability engineering

RevAI runs on a free-tier model with rate limits, so most of the design defends
latency and availability:

- **Dedicated executor** — RevAI's blocking call can't be starved by the shared
  request pool.
- **Layered timeouts** — 45s client → 43s endpoint cap → 18s per model call ×
  4-call budget → 20s fast lane.
- **Graceful fallback chain** — if the agent fails, `answer_question` falls back
  to a **deterministic course summary** built straight from data (works even if
  the LLM is down), and finally to a plain fast answer. Errors surface as friendly
  reply text, never a 500 or a silent timeout.
- **Never invent numbers** — every specific figure comes from a tool; the prompt
  forbids fabricating them.

---

## Configuration (env vars)

| Variable | Default | Purpose |
|----------|---------|---------|
| `GEMINI_API_KEY` | — | Enables the Gemini provider (required for RevAI). `GOOGLE_API_KEY` also works. |
| `GEMINI_ASSISTANT_MODEL` | `gemini-3.5-flash` | Main model (fast lane / direct answers). |
| `GEMINI_AGENT_MODEL` | `gemini-3.5-flash` | Tool-loop model. |
| `GEMINI_FAST_MODEL` | (main) | Optional override for the fast lane. |
| `GEMINI_AGENT_REQUEST_LIMIT` | `4` | Max model turns in the tool loop. |
| `GEMINI_AGENT_TIMEOUT` | `18` | Per-call HTTP timeout (seconds). |
| `GEMINI_ENABLE_THINKING` | `false` | Reasoning mode (slower). |
| `TAVILY_API_KEY` | — | Enables the preferred web-search provider. |

---

## Response contract

```jsonc
{
  "text": "…answer with **bold** highlights…",   // always present
  "courses": [                                     // optional: renders a prof list
    { "code": "221", "name": "Dr. Teresa Leyk", "meta": "3.60 GPA" }
  ],
  "card": {                                         // optional: inline status card
    "name": "Sbisa Dining Hall",
    "detail": "North Campus · Closes 9:00 PM",
    "status": { "label": "Open", "tone": "open" }
  }
}
```

---

## Known limitations & future work

- **Single-turn.** The frontend sends only the current message; no conversation
  history reaches the backend, so follow-ups ("what about its prereqs?") lose
  context. Next: pass recent turns into the agent's `message_history`.
- **No streaming.** The user waits on a spinner for the full answer (up to ~40s
  on the slow tier). Next: stream tokens over SSE.
- **Brittle lane routing.** The keyword regex can misroute course-by-name
  questions into the tool-less fast lane.
- **Thin structured tools.** Dining, events, and parking questions fall to the
  web-search tool even though the app has real services for them
  (`dining_service`, `campus_events_service`, `parking_realtime_service`,
  `tamu_calendar_service`). Wiring these as first-class tools is the highest-value
  next step for usefulness.
- **No eval harness.** There's no automated check that answers/tool choices are
  correct across model or prompt changes.
```
