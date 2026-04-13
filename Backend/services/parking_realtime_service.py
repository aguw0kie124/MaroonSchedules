"""Scrape visitor garage availability from Texas A&M Transportation Services."""

from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import requests

REALTIME_URL = "https://transport.tamu.edu/parking/realtime.aspx"
USER_AGENT = "Mozilla/5.0 MaroonSchedules/1.0 (campus maps; +https://github.com/rianp0071/MaroonSchedules)"

# Visitor garages on realtime.aspx — match normalized name fragments to stable codes
_NAME_FRAGMENT_TO_CODE: Dict[str, str] = {
    "central campus garage": "CCG",
    "polo road garage": "PRG",
    "stallings": "SBG",  # Stallings Blvd Garage
    "university center garage": "UCG",
    "west campus garage": "WCG",
}

CODE_TO_NAME: Dict[str, str] = {
    "CCG": "Central Campus Garage",
    "PRG": "Polo Road Garage",
    "SBG": "Gene Stallings Blvd Garage",
    "UCG": "University Center Garage",
    "WCG": "West Campus Garage",
}

# Badge lives in the table row *after* </a> (not inside the anchor).
_GARAGE_ROW_RE = re.compile(
    r'<a\s+class="garage"[^>]*>([\s\S]*?)</a>[\s\S]*?<span\s+class="badge">(\d+)</span>',
    re.IGNORECASE,
)
_SMALL_NAME_RE = re.compile(
    r'<span\s+class="small">\s*([^<]+)</span>', re.IGNORECASE
)
_CODE_TOKEN_RE = re.compile(r"\b([A-Z]{3})\b")


def _normalize_name_blob(blob: str) -> str:
    text = re.sub(r"<[^>]+>", " ", blob)
    text = re.sub(r"\s+", " ", text).strip().lower()
    return text


def _code_from_block(inner_html: str, row_tail: str = "") -> Optional[str]:
    """Infer CCG/PRG/... from acronym in anchor text or from garage name in the row."""
    m = _CODE_TOKEN_RE.search(inner_html)
    if m:
        return m.group(1).upper()
    combined = inner_html + " " + row_tail
    for small in _SMALL_NAME_RE.findall(combined):
        key = _normalize_name_blob(small)
        for frag, code in _NAME_FRAGMENT_TO_CODE.items():
            if frag in key:
                return code
    blob = _normalize_name_blob(combined)
    for frag, code in _NAME_FRAGMENT_TO_CODE.items():
        if frag in blob:
            return code
    return None


def _parse_garage_blocks(html: str) -> List[Tuple[str, int]]:
    out: List[Tuple[str, int]] = []
    for m in _GARAGE_ROW_RE.finditer(html):
        inner, count_s = m.group(1), m.group(2)
        # Include a few chars after the match so <span class="small"> names resolve.
        tail = html[m.end() : m.end() + 400]
        code = _code_from_block(inner, tail)
        if code:
            out.append((code, int(count_s)))
    return out


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
        pairs = _parse_garage_blocks(response.text)
        counts: Dict[str, int] = {}
        for code, raw_count in pairs:
            counts[code.upper()] = raw_count
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
