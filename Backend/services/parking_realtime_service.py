"""Scrape visitor garage availability from Texas A&M Transportation Services."""

from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any, Dict, Tuple

import requests

REALTIME_URL = "https://transport.tamu.edu/parking/realtime.aspx"
USER_AGENT = "Mozilla/5.0 MaroonSchedules/1.0 (campus maps; +https://github.com/rianp0071/MaroonSchedules)"

_GARAGE_ROW_RE = re.compile(
    r'class="garage"[^>]*>[\s\S]*?([A-Z]{3})\s*<span class="fas fa-map-marker-alt"[\s\S]*?'
    r'</td><td class="count">[\s\S]*?<span class="badge">(\d+)</span>',
    re.IGNORECASE,
)


def fetch_visitor_garage_availability() -> Tuple[Dict[str, int], str]:
    """
    Returns ({'CCG': n, ...}, fetched_at_iso_utc).
    On failure returns ({}, iso timestamp).
    """
    fetched_at = datetime.now(timezone.utc).isoformat()
    try:
        response = requests.get(
            REALTIME_URL,
            timeout=12,
            headers={"User-Agent": USER_AGENT},
        )
        response.raise_for_status()
        pairs = _GARAGE_ROW_RE.findall(response.text)
        counts: Dict[str, int] = {}
        for code, raw_count in pairs:
            counts[code.upper()] = int(raw_count)
        return counts, fetched_at
    except Exception as exc:
        print(f"[parking_realtime_service] fetch failed: {exc}")
        return {}, fetched_at


def snapshot_block() -> Dict[str, Any]:
    counts, fetched_at = fetch_visitor_garage_availability()
    return {
        "source_url": REALTIME_URL,
        "fetched_at": fetched_at,
        "garages": counts,
    }
