from __future__ import annotations

import json
import os
import time
from collections import OrderedDict
from dataclasses import dataclass
from typing import Any

try:
    import redis
except Exception:  # pragma: no cover - optional dependency
    redis = None


REDIS_URL = os.environ.get("REDIS_URL", "").strip()
REDIS_HOST = os.environ.get("REDIS_HOST", "").strip()
REDIS_PORT = os.environ.get("REDIS_PORT", "").strip()
REDIS_USERNAME = os.environ.get("REDIS_USERNAME", "default").strip()
REDIS_PASSWORD = os.environ.get("REDIS_PASSWORD", "").strip()
REDIS_SSL = os.environ.get("REDIS_SSL", "true").strip().lower() not in {"0", "false", "no"}
MEMORY_CACHE_MAX_ENTRIES = max(32, int(os.environ.get("MEMORY_CACHE_MAX_ENTRIES", "256")))


@dataclass
class _MemoryEntry:
    value: Any
    expires_at: float | None


_MEMORY_CACHE: OrderedDict[str, _MemoryEntry] = OrderedDict()
_REDIS_CLIENT: redis.Redis | None = None
_REDIS_STATUS_LOGGED = False
_REDIS_CAPACITY_WARNING_LOGGED = False


def _get_client() -> redis.Redis | None:
    global _REDIS_CLIENT
    global _REDIS_STATUS_LOGGED
    if redis is None:
        if not _REDIS_STATUS_LOGGED:
            print("[cache] Redis unavailable: package not installed, using in-memory fallback")
            _REDIS_STATUS_LOGGED = True
        return None
    if _REDIS_CLIENT is None:
        normalized_url = _build_redis_url()
        if not normalized_url:
            if not _REDIS_STATUS_LOGGED:
                print("[cache] Redis unavailable: no REDIS_URL or host credentials, using in-memory fallback")
                _REDIS_STATUS_LOGGED = True
            return None
        try:
            _REDIS_CLIENT = redis.from_url(normalized_url, decode_responses=True)
            _REDIS_CLIENT.ping()
            if not _REDIS_STATUS_LOGGED:
                print("[cache] Redis connected")
                _REDIS_STATUS_LOGGED = True
        except Exception as exc:
            if not _REDIS_STATUS_LOGGED:
                print(f"[cache] Redis unavailable: {exc}; using in-memory fallback")
                _REDIS_STATUS_LOGGED = True
            _REDIS_CLIENT = None
    return _REDIS_CLIENT


def _build_redis_url() -> str | None:
    if REDIS_URL:
        normalized_url = REDIS_URL
        if "://" not in normalized_url:
            normalized_url = f"rediss://{normalized_url}"
        return normalized_url

    if REDIS_HOST and REDIS_PORT and REDIS_PASSWORD:
        scheme = "rediss" if REDIS_SSL else "redis"
        return f"{scheme}://{REDIS_USERNAME}:{REDIS_PASSWORD}@{REDIS_HOST}:{REDIS_PORT}"

    return None


def _memory_get(key: str) -> Any | None:
    entry = _MEMORY_CACHE.get(key)
    if not entry:
        print(f"[cache] miss (memory): {key}")
        return None
    if entry.expires_at is not None and time.time() > entry.expires_at:
        _MEMORY_CACHE.pop(key, None)
        print(f"[cache] expired (memory): {key}")
        return None
    _MEMORY_CACHE.move_to_end(key)
    print(f"[cache] hit (memory): {key}")
    return entry.value


def _memory_set(key: str, value: Any, ttl_seconds: int) -> None:
    expires_at = time.time() + ttl_seconds if ttl_seconds > 0 else None
    _MEMORY_CACHE[key] = _MemoryEntry(value=value, expires_at=expires_at)
    _MEMORY_CACHE.move_to_end(key)
    while len(_MEMORY_CACHE) > MEMORY_CACHE_MAX_ENTRIES:
        evicted_key, _ = _MEMORY_CACHE.popitem(last=False)
        print(f"[cache] evicted (memory): {evicted_key}")


def _redis_write_failed_due_to_capacity(exc: Exception) -> bool:
    message = str(exc).lower()
    return "oom" in message or "maxmemory" in message or "command not allowed when used memory" in message


def get_json(key: str) -> Any | None:
    client = _get_client()
    if client is not None:
        try:
            payload = client.get(key)
            if payload is None:
                print(f"[cache] miss (redis): {key}")
                return _memory_get(key)
            print(f"[cache] hit (redis): {key}")
            decoded = json.loads(payload)
            _memory_set(key, decoded, 30)
            return decoded
        except Exception:
            pass
    return _memory_get(key)


def set_json(key: str, value: Any, ttl_seconds: int) -> None:
    global _REDIS_CAPACITY_WARNING_LOGGED
    _memory_set(key, value, ttl_seconds)
    client = _get_client()
    if client is not None:
        try:
            client.setex(key, max(1, int(ttl_seconds)), json.dumps(value, ensure_ascii=False))
            return
        except Exception as exc:
            if _redis_write_failed_due_to_capacity(exc):
                if not _REDIS_CAPACITY_WARNING_LOGGED:
                    print("[cache] Redis at capacity, continuing with in-memory fallback")
                    _REDIS_CAPACITY_WARNING_LOGGED = True
                return
            pass


def delete(key: str) -> None:
    client = _get_client()
    if client is not None:
        try:
            client.delete(key)
        except Exception:
            pass
    _MEMORY_CACHE.pop(key, None)
