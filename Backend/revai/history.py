"""
revai/history.py
------------------
Conversation-history helpers shared by the fast lane and the agent lane.

History is client-held (the frontend resends prior turns on every request) —
the backend stays stateless. `clip()` is the single point where an incoming
history payload is bounded before it reaches either lane.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

MAX_TURNS = 8
MAX_HISTORY_CHARS = 4000


def clip(turns: Optional[List[Dict[str, Any]]]) -> List[Dict[str, str]]:
    """Keep the last MAX_TURNS user/assistant turns, then trim from the oldest
    end until the total content length is under MAX_HISTORY_CHARS."""
    cleaned: List[Dict[str, str]] = []
    for turn in turns or []:
        role = turn.get("role")
        content = str(turn.get("content") or "").strip()
        if role not in ("user", "assistant") or not content:
            continue
        cleaned.append({"role": role, "content": content})

    cleaned = cleaned[-MAX_TURNS:]

    total = sum(len(t["content"]) for t in cleaned)
    while cleaned and total > MAX_HISTORY_CHARS:
        total -= len(cleaned[0]["content"])
        cleaned.pop(0)

    return cleaned


def to_model_messages(turns: List[Dict[str, str]]) -> list:
    """Convert clipped {role, content} turns into Pydantic AI message history."""
    from pydantic_ai.messages import ModelRequest, ModelResponse, TextPart, UserPromptPart

    messages = []
    for turn in turns:
        if turn["role"] == "user":
            messages.append(ModelRequest(parts=[UserPromptPart(content=turn["content"])]))
        else:
            messages.append(ModelResponse(parts=[TextPart(content=turn["content"])]))
    return messages
