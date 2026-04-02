from __future__ import annotations

import json
import os
import time
from dataclasses import dataclass
from typing import Any, Optional

try:
    import redis
except Exception:  # pragma: no cover - optional dependency
    redis = None


REDIS_URL = os.environ.get("REDIS_URL", "").strip()


@dataclass
class _MemoryEntry:
    value: Any
    expires_at: float | None


_MEMORY_CACHE: dict[str, _MemoryEntry] = {}
_REDIS_CLIENT: redis.Redis | None = None


def _get_client() -> redis.Redis | None:
    global _REDIS_CLIENT
    if not REDIS_URL or redis is None:
        return None
    if _REDIS_CLIENT is None:
        normalized_url = REDIS_URL
        if "://" not in normalized_url:
            normalized_url = f"rediss://{normalized_url}"
        _REDIS_CLIENT = redis.from_url(normalized_url, decode_responses=True)
    return _REDIS_CLIENT


def _memory_get(key: str) -> Any | None:
    entry = _MEMORY_CACHE.get(key)
    if not entry:
        return None
    if entry.expires_at is not None and time.time() > entry.expires_at:
        _MEMORY_CACHE.pop(key, None)
        return None
    return entry.value


def _memory_set(key: str, value: Any, ttl_seconds: int) -> None:
    expires_at = time.time() + ttl_seconds if ttl_seconds > 0 else None
    _MEMORY_CACHE[key] = _MemoryEntry(value=value, expires_at=expires_at)


def get_json(key: str) -> Any | None:
    client = _get_client()
    if client is not None:
        try:
            payload = client.get(key)
            if payload is None:
                return None
            return json.loads(payload)
        except Exception:
            pass
    return _memory_get(key)


def set_json(key: str, value: Any, ttl_seconds: int) -> None:
    client = _get_client()
    if client is not None:
        try:
            client.setex(key, max(1, int(ttl_seconds)), json.dumps(value, ensure_ascii=False))
            return
        except Exception:
            pass
    _memory_set(key, value, ttl_seconds)


def delete(key: str) -> None:
    client = _get_client()
    if client is not None:
        try:
            client.delete(key)
        except Exception:
            pass
    _MEMORY_CACHE.pop(key, None)
