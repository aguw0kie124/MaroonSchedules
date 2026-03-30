"""Department mapper — infers department_code, department_name, host_type from event context."""

from __future__ import annotations

import logging
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import yaml

logger = logging.getLogger("tamu_crawler.mappers.department")

_DEPTS_PATH = Path(__file__).parent / "departments.yaml"
_DEPTS_CACHE: Dict[str, Any] | None = None


def _load_departments() -> Dict[str, Any]:
    """Load department mappings from YAML (cached)."""
    global _DEPTS_CACHE
    if _DEPTS_CACHE is None:
        with open(_DEPTS_PATH, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f) or {}
        _DEPTS_CACHE = data.get("departments", {})
    return _DEPTS_CACHE


def map_department(
    source_name: str | None = None,
    host_name: str | None = None,
    location: str | None = None,
    title: str | None = None,
    description: str | None = None,
) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """Infer department_code, department_name, and host_type from event context.

    Priority:
        1. source_name → direct source_names mapping
        2. host_name → alias matching
        3. title + description → alias keyword matching
        4. location → alias matching

    Returns:
        (department_code, department_name, host_type) or (None, None, None)
    """
    depts = _load_departments()
    source_lower = (source_name or "").lower()
    host_lower = (host_name or "").lower()
    title_lower = (title or "").lower()
    desc_lower = (description or "").lower()[:1000]
    loc_lower = (location or "").lower()

    # --- Priority 1: Direct source_name match ---
    for code, info in depts.items():
        source_names = info.get("source_names", [])
        for sn in source_names:
            if sn.lower() == source_lower:
                return code, info["name"], info.get("host_type", "department")

    # --- Priority 2: Host name alias match ---
    best_match: Optional[Tuple[str, str, str]] = None
    best_len = 0
    for code, info in depts.items():
        for alias in info.get("aliases", []):
            alias_lower = alias.lower()
            if alias_lower in host_lower and len(alias_lower) > best_len:
                best_match = (code, info["name"], info.get("host_type", "department"))
                best_len = len(alias_lower)

    if best_match:
        return best_match

    # --- Priority 3: Title + description keyword match ---
    combined = f"{title_lower} {desc_lower}"
    best_match = None
    best_len = 0
    for code, info in depts.items():
        for alias in info.get("aliases", []):
            alias_lower = alias.lower()
            # Require word boundary for short aliases to avoid false matches
            if len(alias_lower) <= 4:
                pattern = r"\b" + re.escape(alias_lower) + r"\b"
                if re.search(pattern, combined):
                    if len(alias_lower) > best_len:
                        best_match = (code, info["name"], info.get("host_type", "department"))
                        best_len = len(alias_lower)
            else:
                if alias_lower in combined and len(alias_lower) > best_len:
                    best_match = (code, info["name"], info.get("host_type", "department"))
                    best_len = len(alias_lower)

    if best_match:
        return best_match

    # --- Priority 4: Location match ---
    best_match = None
    best_len = 0
    for code, info in depts.items():
        for alias in info.get("aliases", []):
            alias_lower = alias.lower()
            if alias_lower in loc_lower and len(alias_lower) > best_len:
                best_match = (code, info["name"], info.get("host_type", "department"))
                best_len = len(alias_lower)

    if best_match:
        return best_match

    return None, None, None
