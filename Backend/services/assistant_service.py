"""RevAI campus assistant — minimal, debuggable version.

Deliberately simple so failures are obvious:

    message  ->  ONE LLM call (NVIDIA if configured, else OpenRouter)  ->  text

- Every step prints a loud [RevAI] line (flushed) to the uvicorn console.
- Any error is returned AS the reply text, so problems show up in the app
  instead of as a silent client timeout.

(Course-data and web-search layers were removed to isolate the LLM call; they
can be layered back on once this basic pipe is confirmed working end to end.)
"""

from __future__ import annotations

import logging
import time
from typing import Any, Dict, List

from services import llm_client

logger = logging.getLogger("backend.assistant")

SYSTEM_PROMPT = (
    "You are RevAI, a friendly, knowledgeable Texas A&M University "
    "(College Station) campus assistant. Answer the student's question helpfully "
    "and concisely (1-4 sentences) using what you know about Texas A&M, Aggie "
    "traditions, courses, dining, and college life. If you're unsure, say so briefly. "
    "Use **bold** for key names. Plain text only."
)

# Kept below the app's 45s client timeout so a slow model returns an error we can
# see, rather than the client giving up first.
LLM_TIMEOUT_S = 38.0


def _log(msg: str) -> None:
    print(f"[RevAI] {msg}", flush=True)
    logger.info(msg)


def _call_llm(message: str) -> str:
    from services import nvidia_client

    messages: List[Dict[str, str]] = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": message},
    ]

    if nvidia_client.is_configured():
        _log(f"provider=nvidia model={nvidia_client.get_model()}")
        return nvidia_client.chat(
            messages, temperature=0.3, max_tokens=800, timeout_seconds=LLM_TIMEOUT_S
        )

    _log("provider=openrouter")
    result = llm_client.chat_completion(
        messages,
        llm_client.get_assistant_models(),
        purpose="assistant",
        timeout_seconds=LLM_TIMEOUT_S,
        temperature=0.3,
        max_tokens=400,
    )
    return llm_client._strip_markdown_fences(result.content).strip()


def answer_question(message: str) -> Dict[str, Any]:
    message = (message or "").strip()
    _log(f"Q={message!r}")
    if not message:
        return {"text": "Ask me anything about Texas A&M!"}

    started = time.time()
    try:
        text = _call_llm(message)
        _log(f"OK in {time.time() - started:.1f}s: {text[:90]!r}")
        return {"text": text}
    except Exception as exc:  # noqa: BLE001 - surface the real error to the app
        import traceback

        traceback.print_exc()
        _log(f"ERROR in {time.time() - started:.1f}s: {exc!r}")
        return {"text": f"[RevAI error] {exc}"}
