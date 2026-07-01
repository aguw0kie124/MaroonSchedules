"""NVIDIA NIM chat client (OpenAI-compatible) for RevAI.

Uses stdlib urllib (no `openai` package dependency) to call
https://integrate.api.nvidia.com/v1/chat/completions.

Config (Backend/.env):
  NVIDIA_API_KEY           required to enable this provider
  NVIDIA_ASSISTANT_MODEL   default: nvidia/nemotron-3-ultra-550b-a55b
  NVIDIA_ENABLE_THINKING   "true" to enable reasoning (slower); default off for speed
"""

from __future__ import annotations

import json
import logging
import os
import re
from typing import Dict, List, Optional
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

logger = logging.getLogger("backend.nvidia")

NVIDIA_URL = "https://integrate.api.nvidia.com/v1/chat/completions"
DEFAULT_MODEL = "nvidia/nemotron-3-ultra-550b-a55b"
_THINK_RE = re.compile(r"<think>.*?</think>", re.S)


def is_configured() -> bool:
    return bool((os.getenv("NVIDIA_API_KEY") or "").strip())


def get_model() -> str:
    return (os.getenv("NVIDIA_ASSISTANT_MODEL") or DEFAULT_MODEL).strip()


def _thinking_enabled() -> bool:
    return (os.getenv("NVIDIA_ENABLE_THINKING") or "false").strip().lower() in ("1", "true", "yes")


def chat(
    messages: List[Dict[str, str]],
    *,
    model: Optional[str] = None,
    temperature: float = 0.3,
    max_tokens: int = 800,
    timeout_seconds: float = 25.0,
) -> str:
    """Return the assistant's reply text (reasoning stripped). `model` overrides
    the default (e.g. a faster model for the fast lane)."""
    key = (os.getenv("NVIDIA_API_KEY") or "").strip()
    if not key:
        raise RuntimeError("NVIDIA_API_KEY is not configured")

    thinking = _thinking_enabled()
    # Reasoning needs headroom or the final answer gets truncated by the budget.
    effective_max = max(max_tokens, 4096) if thinking else max_tokens

    body: Dict[str, object] = {
        "model": (model or get_model()),
        "messages": messages,
        "temperature": temperature,
        "top_p": 0.95,
        "max_tokens": effective_max,
        "stream": False,
        "chat_template_kwargs": {"enable_thinking": thinking},
    }
    if thinking:
        body["reasoning_budget"] = min(effective_max - 512, 8192)

    data = json.dumps(body).encode("utf-8")
    request = Request(
        NVIDIA_URL,
        data=data,
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urlopen(request, timeout=timeout_seconds) as response:
            payload = json.loads(response.read().decode("utf-8", errors="replace"))
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:300] if hasattr(exc, "read") else ""
        raise RuntimeError(f"NVIDIA HTTP {exc.code}: {detail}") from None
    except URLError as exc:
        raise RuntimeError(f"NVIDIA connection error: {exc.reason}") from None

    choices = payload.get("choices") or []
    if not choices:
        raise RuntimeError("NVIDIA returned no choices")
    content = (choices[0].get("message") or {}).get("content") or ""
    return _THINK_RE.sub("", content).strip()
