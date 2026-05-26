from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple


def _parse_event_time(value: Any) -> Optional[datetime]:
    if not value:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    try:
        text = str(value).strip()
        if text.endswith("Z"):
            text = f"{text[:-1]}+00:00"
        parsed = datetime.fromisoformat(text)
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    except Exception:
        return None


def _infer_primary_category(event: Dict[str, Any]) -> str:
    primary = str(event.get("primary_category") or "").strip().lower()
    if primary:
        return primary

    categories = event.get("categories") or {}
    for key in (
        "sports",
        "academic",
        "food",
        "social",
        "health_wellness",
        "entertainment",
        "advocacy",
        "miscellaneous",
    ):
        if categories.get(key):
            return key
    return "miscellaneous"


def _event_interest_tags(event: Dict[str, Any]) -> List[str]:
    values = event.get("interest_tags") or []
    if isinstance(values, list):
        return [str(item).strip().lower() for item in values if str(item).strip()]
    return []


def _event_time_window(event: Dict[str, Any]) -> str:
    start = _parse_event_time(event.get("start_time"))
    if not start:
        return "any"

    local = start.astimezone(timezone.utc)
    weekday = local.weekday() < 5
    is_day = 6 <= local.hour < 18

    if weekday and is_day:
        return "weekday_day"
    if weekday and not is_day:
        return "weekday_night"
    if not weekday and is_day:
        return "weekend_day"
    return "weekend_night"


def _registration_is_open(event: Dict[str, Any]) -> bool:
    status = str(event.get("registration_status") or "").strip().lower()
    if not status:
        return False
    return status in {"open", "available", "active", "ongoing"}


def is_onboarding_aligned(event: Dict[str, Any], user_profile: Dict[str, Any]) -> bool:
    """Primary onboarding alignment gate for For U eligibility."""
    primary_category = _infer_primary_category(event)
    top_categories = {str(item).lower() for item in (user_profile.get("top_categories") or [])}
    if primary_category in top_categories:
        return True

    event_tags = set(_event_interest_tags(event))
    preferred_tags = {str(item).lower() for item in (user_profile.get("top_interest_tags") or [])}
    if event_tags & preferred_tags:
        return True

    return False


def score_event_for_user(
    event: Dict[str, Any],
    user_profile: Dict[str, Any],
    interaction_context: Optional[Dict[str, Any]] = None,
    *,
    now: Optional[datetime] = None,
) -> float:
    """Deterministically score one event for one user profile."""
    interaction_context = interaction_context or {}
    score = 0.0

    primary_category = _infer_primary_category(event)
    top_categories = [str(item).lower() for item in (user_profile.get("top_categories") or [])]
    onboarding_aligned = is_onboarding_aligned(event, user_profile)
    if primary_category in top_categories:
        score += 5.0
    elif top_categories:
        # Keep onboarding as the dominant signal for early personalization quality.
        score -= 2.5

    event_tags = set(_event_interest_tags(event))
    preferred_tags = {str(item).lower() for item in (user_profile.get("top_interest_tags") or [])}
    overlap = event_tags & preferred_tags
    if overlap:
        score += min(6.0, 3.0 * len(overlap))

    avoid_tags = {str(item).lower() for item in (user_profile.get("avoid_tags") or [])}
    if primary_category in avoid_tags:
        score -= 10.0
    avoid_overlap = event_tags & avoid_tags
    if avoid_overlap:
        score -= 10.0

    preferred_windows = {str(item).lower() for item in (user_profile.get("preferred_time_windows") or [])}
    if "any" in preferred_windows or _event_time_window(event) in preferred_windows:
        score += 2.0

    positive_categories = {str(item).lower() for item in (interaction_context.get("positive_categories") or [])}
    positive_tags = {str(item).lower() for item in (interaction_context.get("positive_tags") or [])}
    behavior_bonus = 0.0
    # Behavior is explicitly secondary and should not override onboarding intent.
    if onboarding_aligned:
        if primary_category in positive_categories:
            behavior_bonus += 1.5
        if event_tags & positive_tags:
            behavior_bonus += 1.5
    score += min(3.0, behavior_bonus)

    if _registration_is_open(event):
        score += 1.0

    reference_time = now or datetime.now(timezone.utc)
    start = _parse_event_time(event.get("start_time"))
    if start:
        hours_until = (start - reference_time).total_seconds() / 3600.0
        if hours_until >= 0:
            score += max(0.0, min(1.2, 1.2 - (hours_until / 168.0)))

    hidden_ids = {str(item) for item in (interaction_context.get("hidden_event_ids") or [])}
    dismissed_ids = {str(item) for item in (interaction_context.get("dismissed_event_ids") or [])}
    negative_ids = hidden_ids | dismissed_ids
    event_id = str(event.get("event_id") or event.get("id") or "")
    if event_id and event_id in negative_ids:
        score -= 25.0

    if str(event.get("rsvp_status") or "").lower() in {"hidden", "dismissed", "not_interested", "disliked"}:
        score -= 20.0

    return round(score, 4)


def rank_events_for_user(
    events: List[Dict[str, Any]],
    user_profile: Dict[str, Any],
    interaction_context: Optional[Dict[str, Any]] = None,
    *,
    include_debug: bool = False,
) -> List[Dict[str, Any]]:
    scored: List[Tuple[float, Dict[str, Any]]] = []
    for event in events:
        score = score_event_for_user(event, user_profile, interaction_context)
        if include_debug:
            enriched = dict(event)
            enriched["recommendation_score"] = score
            scored.append((score, enriched))
        else:
            scored.append((score, event))

    scored.sort(key=lambda item: item[0], reverse=True)
    return [item[1] for item in scored]
