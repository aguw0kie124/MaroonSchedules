from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Optional
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

logger = logging.getLogger("backend.llm_client")

DEFAULT_OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
DEFAULT_EVENT_CLASSIFIER_MODELS: List[str] = [
    "nvidia/nemotron-3-super-120b-a12b:free",
    "google/gemma-4-31b-it:free",
    "qwen/qwen3-next-80b-a3b-instruct:free",
    "meta-llama/llama-3.3-70b-instruct:free",
    "google/gemma-4-26b-a4b-it:free",
    "openai/gpt-oss-20b:free",
    "nvidia/nemotron-nano-9b-v2:free",
    "meta-llama/llama-3.2-3b-instruct:free",
]
DEFAULT_USER_PROFILE_MODELS: List[str] = [
    "nvidia/nemotron-3-super-120b-a12b:free",
    "google/gemma-4-31b-it:free",
    "qwen/qwen3-next-80b-a3b-instruct:free",
    "meta-llama/llama-3.3-70b-instruct:free",
]


class LLMClientError(RuntimeError):
    """Raised when a model request fails before producing usable content."""


class InvalidJSONResponse(LLMClientError):
    """Raised when the model response is not valid JSON after repair attempts."""


@dataclass
class LLMChatResult:
    content: str
    model: Optional[str]
    raw: Dict[str, Any]


def _parse_models(value: Optional[str], fallback: Iterable[str]) -> List[str]:
    if not value:
        return list(fallback)
    parsed = [entry.strip() for entry in value.split(",") if entry.strip()]
    return parsed or list(fallback)


def get_event_classifier_models() -> List[str]:
    return _parse_models(
        os.getenv("OPENROUTER_EVENT_CLASSIFIER_MODELS"),
        DEFAULT_EVENT_CLASSIFIER_MODELS,
    )


def get_user_profile_models() -> List[str]:
    return _parse_models(
        os.getenv("OPENROUTER_USER_PROFILE_MODELS"),
        DEFAULT_USER_PROFILE_MODELS,
    )


def _chat_completions_url() -> str:
    base = (os.getenv("OPENROUTER_BASE_URL") or DEFAULT_OPENROUTER_BASE_URL).strip().rstrip("/")
    return f"{base}/chat/completions"


def _extract_message_content(choice_message: Any) -> str:
    content = choice_message.get("content") if isinstance(choice_message, dict) else ""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        chunks: List[str] = []
        for item in content:
            if isinstance(item, dict):
                text = item.get("text")
                if isinstance(text, str):
                    chunks.append(text)
        return "\n".join(chunks).strip()
    return ""


def _do_chat_request(
    messages: List[Dict[str, str]],
    models: List[str],
    *,
    purpose: str,
    timeout_seconds: float,
    temperature: float,
    max_tokens: int,
) -> LLMChatResult:
    api_key = (os.getenv("OPENROUTER_API_KEY") or "").strip()
    if not api_key:
        raise LLMClientError("OPENROUTER_API_KEY is not configured")
    if not models:
        raise LLMClientError("No models configured for OpenRouter request")

    # OpenRouter currently enforces a small limit for fallback routing lists.
    # Keep provider-side model routing to at most three candidates per request.
    requested_models = list(models[:3])
    payload: Dict[str, Any] = {
        "model": requested_models[0],
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    # OpenRouter can route across model lists; we send the full priority list first.
    if len(requested_models) > 1:
        payload["models"] = requested_models

    data = json.dumps(payload).encode("utf-8")
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    referer = os.getenv("OPENROUTER_HTTP_REFERER")
    if referer is not None:
        headers["HTTP-Referer"] = referer
    x_title = os.getenv("OPENROUTER_X_TITLE")
    if x_title is not None:
        headers["X-Title"] = x_title

    request = Request(_chat_completions_url(), data=data, headers=headers, method="POST")

    try:
        with urlopen(request, timeout=timeout_seconds) as response:
            raw_text = response.read().decode("utf-8", errors="replace")
    except HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace") if hasattr(exc, "read") else ""
        logger.warning(
            "openrouter_http_error purpose=%s status=%s body=%s",
            purpose,
            exc.code,
            body[:500],
        )
        raise LLMClientError(f"OpenRouter HTTP {exc.code}: {body[:240]}") from exc
    except URLError as exc:
        raise LLMClientError(f"OpenRouter connection error: {exc}") from exc

    try:
        payload_json = json.loads(raw_text)
    except json.JSONDecodeError as exc:
        raise LLMClientError(f"OpenRouter returned invalid JSON payload: {raw_text[:240]}") from exc

    choices = payload_json.get("choices")
    if not isinstance(choices, list) or not choices:
        raise LLMClientError("OpenRouter response missing choices")

    first_choice = choices[0] if isinstance(choices[0], dict) else {}
    message = first_choice.get("message") if isinstance(first_choice, dict) else {}
    content = _extract_message_content(message)
    model_used = payload_json.get("model")

    logger.info(
        "openrouter_chat_success purpose=%s requested_model=%s chosen_model=%s",
        purpose,
        requested_models[0],
        model_used,
    )

    return LLMChatResult(content=content, model=model_used if isinstance(model_used, str) else None, raw=payload_json)


def _strip_markdown_fences(text: str) -> str:
    stripped = text.strip()
    if stripped.startswith("```"):
        stripped = stripped[3:]
        newline = stripped.find("\n")
        if newline != -1:
            stripped = stripped[newline + 1 :]
        if stripped.endswith("```"):
            stripped = stripped[:-3]
    return stripped.strip()


def parse_json_object(text: str) -> Dict[str, Any]:
    candidate = _strip_markdown_fences(text)
    try:
        parsed = json.loads(candidate)
    except json.JSONDecodeError:
        start = candidate.find("{")
        end = candidate.rfind("}")
        if start != -1 and end != -1 and end > start:
            parsed = json.loads(candidate[start : end + 1])
        else:
            raise

    if not isinstance(parsed, dict):
        raise InvalidJSONResponse("Model output was not a JSON object")
    return parsed


def chat_completion(
    messages: List[Dict[str, str]],
    models: List[str],
    *,
    purpose: str,
    timeout_seconds: float = 25.0,
    temperature: float = 0.0,
    max_tokens: int = 700,
    retry_on_invalid_json: bool = False,
) -> LLMChatResult:
    result = _do_chat_request(
        messages,
        models,
        purpose=purpose,
        timeout_seconds=timeout_seconds,
        temperature=temperature,
        max_tokens=max_tokens,
    )

    if not retry_on_invalid_json:
        return result

    try:
        parse_json_object(result.content)
        return result
    except Exception:
        repair_messages = list(messages)
        repair_messages.append(
            {
                "role": "user",
                "content": "Return only a valid JSON object. No markdown or additional text.",
            }
        )
        preferred_model = [result.model] if result.model else models
        repaired = _do_chat_request(
            repair_messages,
            preferred_model,
            purpose=f"{purpose}:json_repair",
            timeout_seconds=timeout_seconds,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        # Raise if still invalid.
        parse_json_object(repaired.content)
        return repaired
