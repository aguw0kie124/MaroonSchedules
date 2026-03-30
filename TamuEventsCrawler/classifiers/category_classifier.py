"""Category classifier — config-driven deterministic event categorisation."""

from __future__ import annotations

import logging
import re
from pathlib import Path
from typing import Any, Dict, List, Tuple

import yaml

logger = logging.getLogger("tamu_crawler.classifiers.category")

_RULES_PATH = Path(__file__).parent / "category_rules.yaml"
_RULES_CACHE: Dict[str, Any] | None = None


def _load_rules() -> Dict[str, Any]:
    """Load category rules from YAML (cached)."""
    global _RULES_CACHE
    if _RULES_CACHE is None:
        with open(_RULES_PATH, "r", encoding="utf-8") as f:
            _RULES_CACHE = yaml.safe_load(f) or {}
    return _RULES_CACHE


def _word_match(keyword: str, text: str) -> bool:
    """Check if keyword appears as a whole word/phrase in text."""
    pattern = r"\b" + re.escape(keyword) + r"\b"
    return bool(re.search(pattern, text, re.IGNORECASE))


def _check_negatives(text: str, negatives: List[str]) -> bool:
    """Return True if any negative pattern matches — should suppress the category."""
    for neg in negatives:
        if neg.lower() in text:
            return True
    return False


def classify_event(
    title: str,
    description: str | None = None,
    host_name: str | None = None,
    location: str | None = None,
    tags: List[str] | None = None,
    source_name: str | None = None,
) -> Tuple[Dict[str, int], List[str]]:
    """Classify an event into binary category flags.

    Returns:
        (categories_dict, reasons_list)
        categories_dict: {"social": 0|1, "sports": 0|1, ...}
        reasons_list: ["social:title:mixer", "academic:host:department", ...]
    """
    rules = _load_rules()

    # Build searchable text fields
    title_lower = (title or "").lower()
    desc_lower = (description or "").lower()[:2000]
    host_lower = (host_name or "").lower()
    loc_lower = (location or "").lower()
    tags_lower = " ".join(t.lower() for t in (tags or []))
    source_lower = (source_name or "").lower()

    # Combined text for broad matching
    combined = f"{title_lower} {desc_lower} {tags_lower}"

    categories: Dict[str, int] = {}
    reasons: List[str] = []

    for category, rule in rules.items():
        if not isinstance(rule, dict):
            continue

        matched = False
        negatives = rule.get("negative_patterns", [])

        # Check negatives first — if the text contains a negative pattern, skip
        if _check_negatives(combined, negatives):
            categories[category] = 0
            continue

        # Title keywords (strongest signal)
        for kw in rule.get("title_keywords", []):
            if _word_match(kw, title_lower):
                matched = True
                reasons.append(f"{category}:title:{kw}")
                break  # one match per field is enough

        # Description keywords
        if not matched:
            for kw in rule.get("description_keywords", []):
                if kw.lower() in desc_lower:
                    matched = True
                    reasons.append(f"{category}:desc:{kw}")
                    break

        # Host patterns
        for hp in rule.get("host_patterns", []):
            if hp.lower() in host_lower or hp.lower() in source_lower:
                matched = True
                reasons.append(f"{category}:host:{hp}")
                break

        # Location patterns
        for lp in rule.get("location_patterns", []):
            if lp.lower() in loc_lower:
                matched = True
                reasons.append(f"{category}:location:{lp}")
                break

        # Tag patterns
        for kw in rule.get("title_keywords", []):
            if _word_match(kw, tags_lower):
                matched = True
                reasons.append(f"{category}:tag:{kw}")
                break

        categories[category] = 1 if matched else 0

    # Business rule for new sub-categories: casual/professional imply social
    if categories.get("casual", 0) == 1 or categories.get("professional", 0) == 1:
        categories["social"] = 1

    # Deduplicate reasons
    reasons = list(dict.fromkeys(reasons))

    return categories, reasons
