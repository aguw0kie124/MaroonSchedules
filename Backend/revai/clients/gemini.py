"""Google Gemini chat client for RevAI (fast lane / direct answers).

Uses the official `google-genai` SDK, which is already a dependency via
`pydantic-ai-slim[google]` (the agent lane in revai_agent.py uses the same key).

Config (Backend/.env):
  GEMINI_API_KEY           required to enable this provider (GOOGLE_API_KEY also honored)
  GEMINI_ASSISTANT_MODEL   default: gemini-3.6-flash
  GEMINI_ENABLE_THINKING   "true" to enable reasoning (slower); default off for speed
"""

from __future__ import annotations

import logging
import os
from typing import Dict, List, Optional

logger = logging.getLogger("backend.gemini")

DEFAULT_MODEL = "gemini-3.6-flash"


def api_key() -> str:
    return (os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or "").strip()


def is_configured() -> bool:
    return bool(api_key())


def get_model() -> str:
    return (os.getenv("GEMINI_ASSISTANT_MODEL") or DEFAULT_MODEL).strip()


def thinking_enabled() -> bool:
    return (os.getenv("GEMINI_ENABLE_THINKING") or "false").strip().lower() in ("1", "true", "yes")


def _thinking_config(model_name: str):
    """Minimum-reasoning config for `model_name`, or None when thinking is enabled.

    Gemini 3+ takes a `thinking_level`; 2.5 takes a numeric `thinking_budget`.
    Pro models think unconditionally and reject both, so they get no config.
    """
    from google.genai import types

    if thinking_enabled() or ("pro" in model_name and "flash" not in model_name):
        return None
    if "gemini-3" in model_name:
        return types.ThinkingConfig(thinking_level="MINIMAL")
    return types.ThinkingConfig(thinking_budget=0)


def chat(
    messages: List[Dict[str, str]],
    *,
    model: Optional[str] = None,
    temperature: float = 0.3,
    max_tokens: int = 800,
    timeout_seconds: float = 25.0,
) -> str:
    """Return the assistant's reply text. `messages` uses the OpenAI shape
    ({role, content}); the system message becomes Gemini's system_instruction."""
    from google import genai
    from google.genai import types

    key = api_key()
    if not key:
        raise RuntimeError("GEMINI_API_KEY is not configured")

    system = "\n\n".join(m["content"] for m in messages if m.get("role") == "system")
    contents = [
        types.Content(
            role="model" if m.get("role") == "assistant" else "user",
            parts=[types.Part(text=m.get("content") or "")],
        )
        for m in messages
        if m.get("role") != "system"
    ]

    model_name = model or get_model()
    config = types.GenerateContentConfig(
        system_instruction=system or None,
        temperature=temperature,
        top_p=0.95,
        max_output_tokens=max_tokens,
        # Gemini 2.5+ thinks by default; that costs seconds we don't have on the
        # fast lane, so it's off unless explicitly enabled.
        thinking_config=_thinking_config(model_name),
    )

    client = genai.Client(
        api_key=key,
        http_options=types.HttpOptions(timeout=int(timeout_seconds * 1000)),
    )
    try:
        response = client.models.generate_content(
            model=model_name, contents=contents, config=config
        )
    except Exception as exc:  # noqa: BLE001 - surfaced as reply text by the caller
        raise RuntimeError(f"Gemini error: {exc}") from None

    text = (response.text or "").strip()
    if not text:
        raise RuntimeError("Gemini returned an empty response")
    return text
