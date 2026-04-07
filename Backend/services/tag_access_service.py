from __future__ import annotations

import re
from typing import Any, Dict, Iterable, List, Sequence


def normalize_tag_label(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = re.sub(r"\s+", " ", str(value)).strip()
    if not cleaned:
        return None
    return cleaned


def normalize_tag_slug(value: str | None) -> str | None:
    label = normalize_tag_label(value)
    if not label:
        return None
    slug = re.sub(r"[^a-z0-9]+", "-", label.lower()).strip("-")
    return slug or None


def normalize_tag_list(values: Sequence[str] | None) -> List[str]:
    if not values:
        return []

    normalized: List[str] = []
    seen: set[str] = set()
    for value in values:
        label = normalize_tag_label(value)
        slug = normalize_tag_slug(label)
        if not label or not slug or slug in seen:
            continue
        seen.add(slug)
        normalized.append(label)
    return normalized


def has_matching_access_tag(
    user_tags: Sequence[str] | None,
    access_tags: Sequence[str] | None,
    bypass_restrictions: bool = False,
) -> bool:
    if bypass_restrictions:
        return True

    normalized_event_tags = {
        slug
        for slug in (normalize_tag_slug(tag) for tag in (access_tags or []))
        if slug
    }
    if not normalized_event_tags:
        return True

    normalized_user_tags = {
        slug
        for slug in (normalize_tag_slug(tag) for tag in (user_tags or []))
        if slug
    }
    if not normalized_user_tags:
        return False

    return bool(normalized_user_tags & normalized_event_tags)


def filter_events_for_access_tags(
    events: Sequence[Dict[str, Any]],
    user_tags: Sequence[str] | None,
    bypass_restrictions: bool = False,
) -> List[Dict[str, Any]]:
    return [
        event
        for event in events
        if has_matching_access_tag(
            user_tags=user_tags,
            access_tags=event.get("access_tags") or [],
            bypass_restrictions=bypass_restrictions,
        )
    ]
