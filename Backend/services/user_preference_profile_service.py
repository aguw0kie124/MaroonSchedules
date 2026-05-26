from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Optional, Tuple

from services import llm_client
from services.event_classification_service import ALLOWED_INTEREST_TAGS
from services.user_profile_prompt import build_user_profile_messages

logger = logging.getLogger("backend.user_profile")

PROFILE_VERSION = "user_profile_v1"

ALLOWED_CATEGORY_KEYS = {
    "sports",
    "academic",
    "food",
    "social",
    "health_wellness",
    "entertainment",
    "advocacy",
    "miscellaneous",
}

CATEGORY_DISPLAY_TO_KEY = {
    "sports": "sports",
    "academic": "academic",
    "food": "food",
    "social": "social",
    "health & wellness": "health_wellness",
    "health_wellness": "health_wellness",
    "entertainment": "entertainment",
    "advocacy": "advocacy",
    "miscellaneous": "miscellaneous",
}

ALLOWED_NOTIFICATION_FREQUENCIES = {"low", "medium", "high"}
ALLOWED_TIME_WINDOWS = {"weekday_day", "weekday_night", "weekend_day", "weekend_night", "any"}


def _normalize_category(value: Any) -> Optional[str]:
    if value is None:
        return None
    token = str(value).strip().lower().replace("_", " ")
    return CATEGORY_DISPLAY_TO_KEY.get(token)


def _normalize_string_list(values: Any) -> List[str]:
    if not isinstance(values, list):
        return []
    normalized: List[str] = []
    seen: set[str] = set()
    for value in values:
        item = str(value).strip().lower().replace(" ", "_")
        if not item or item in seen:
            continue
        seen.add(item)
        normalized.append(item)
    return normalized


def _extract_interaction_summary(interactions: Optional[List[Dict[str, Any]]]) -> Dict[str, Any]:
    if not interactions:
        return {}

    category_counts: Dict[str, int] = {}
    positive_tags: Dict[str, int] = {}
    negative_tags: Dict[str, int] = {}

    for interaction in interactions:
        response = str(interaction.get("response") or "").lower()
        category = _normalize_category(interaction.get("primary_category"))
        tags = _normalize_string_list(interaction.get("interest_tags") or [])

        if response in {"going", "interested", "saved", "liked"}:
            if category:
                category_counts[category] = category_counts.get(category, 0) + 1
            for tag in tags:
                positive_tags[tag] = positive_tags.get(tag, 0) + 1
        elif response in {"not_interested", "dismissed", "hidden", "disliked"}:
            for tag in tags:
                negative_tags[tag] = negative_tags.get(tag, 0) + 1

    top_categories = [
        category
        for category, _ in sorted(category_counts.items(), key=lambda item: item[1], reverse=True)
        if category in ALLOWED_CATEGORY_KEYS
    ][:4]

    top_positive_tags = [
        tag
        for tag, _ in sorted(positive_tags.items(), key=lambda item: item[1], reverse=True)
    ][:8]
    top_negative_tags = [
        tag
        for tag, _ in sorted(negative_tags.items(), key=lambda item: item[1], reverse=True)
    ][:5]

    return {
        "top_categories": top_categories,
        "positive_interest_tags": top_positive_tags,
        "negative_interest_tags": top_negative_tags,
    }


def _deterministic_profile(
    onboarding_answers: Dict[str, Any],
    interaction_summary: Dict[str, Any],
) -> Dict[str, Any]:
    selected_sections = [_normalize_category(item) for item in onboarding_answers.get("preferred_sections", [])]
    top_categories = [category for category in selected_sections if category in ALLOWED_CATEGORY_KEYS]

    if not top_categories:
        legacy = [_normalize_category(item) for item in onboarding_answers.get("preferred_event_categories", [])]
        top_categories = [category for category in legacy if category in ALLOWED_CATEGORY_KEYS]

    for category in interaction_summary.get("top_categories", []):
        if category in ALLOWED_CATEGORY_KEYS and category not in top_categories and len(top_categories) < 5:
            top_categories.append(category)

    if not top_categories:
        top_categories = ["miscellaneous"]

    top_interest_tags = _normalize_string_list(onboarding_answers.get("interest_tags") or onboarding_answers.get("preferred_event_interests") or [])
    top_interest_tags = [tag for tag in top_interest_tags if tag in ALLOWED_INTEREST_TAGS]

    for tag in interaction_summary.get("positive_interest_tags", []):
        if tag in ALLOWED_INTEREST_TAGS and tag not in top_interest_tags and len(top_interest_tags) < 10:
            top_interest_tags.append(tag)

    avoid_tags = _normalize_string_list(onboarding_answers.get("avoid_tags") or [])
    if onboarding_answers.get("free_vs_paid") == "free":
        avoid_tags.append("paid")
    for tag in interaction_summary.get("negative_interest_tags", []):
        if tag not in avoid_tags:
            avoid_tags.append(tag)

    preferred_time_windows: List[str] = []
    weekday_weekend = str(onboarding_answers.get("weekday_vs_weekend") or "").lower()
    day_night = str(onboarding_answers.get("day_vs_night") or "").lower()

    if weekday_weekend in {"weekday", "weekdays"}:
        preferred_time_windows.append("weekday_day" if day_night in {"day", "morning", "afternoon"} else "weekday_night")
    elif weekday_weekend in {"weekend", "weekends"}:
        preferred_time_windows.append("weekend_day" if day_night in {"day", "morning", "afternoon"} else "weekend_night")
    elif day_night in {"day", "morning", "afternoon"}:
        preferred_time_windows.extend(["weekday_day", "weekend_day"])
    elif day_night in {"night", "evening"}:
        preferred_time_windows.extend(["weekday_night", "weekend_night"])

    if not preferred_time_windows:
        preferred_time_windows = ["any"]

    notification_priority_tags = list(top_interest_tags[:4])
    if onboarding_answers.get("food_centered_interest"):
        notification_priority_tags.append("free_food")
    if onboarding_answers.get("wellness_fitness_interest"):
        notification_priority_tags.append("wellness")
    if onboarding_answers.get("social_community_interest"):
        notification_priority_tags.append("community")
    if onboarding_answers.get("entertainment_music_art_interest"):
        notification_priority_tags.append("music")
    if onboarding_answers.get("advocacy_service_civic_interest"):
        notification_priority_tags.append("volunteering")

    # Deduplicate while preserving order.
    deduped_priority: List[str] = []
    for tag in notification_priority_tags:
        normalized = str(tag).strip().lower().replace(" ", "_")
        if normalized and normalized not in deduped_priority:
            deduped_priority.append(normalized)

    notification_frequency = str(onboarding_answers.get("notification_frequency") or "medium").lower()
    if notification_frequency not in ALLOWED_NOTIFICATION_FREQUENCIES:
        notification_frequency = "medium"

    summary_parts = [
        f"Prefers {', '.join(top_categories[:3])} events",
        f"with {notification_frequency} notifications",
    ]
    if top_interest_tags:
        summary_parts.append(f"and interests in {', '.join(top_interest_tags[:3])}")

    return {
        "top_categories": top_categories[:5],
        "top_interest_tags": top_interest_tags[:12],
        "avoid_tags": avoid_tags[:12],
        "preferred_time_windows": [window for window in preferred_time_windows if window in ALLOWED_TIME_WINDOWS][:4] or ["any"],
        "notification_priority_tags": deduped_priority[:8],
        "notification_frequency": notification_frequency,
        "profile_summary": " ".join(summary_parts)[:220],
    }


def _normalize_profile_payload(payload: Dict[str, Any], fallback: Dict[str, Any]) -> Dict[str, Any]:
    top_categories = [_normalize_category(item) for item in payload.get("top_categories", [])]
    top_categories = [item for item in top_categories if item in ALLOWED_CATEGORY_KEYS]
    if not top_categories:
        top_categories = fallback["top_categories"]

    top_interest_tags = _normalize_string_list(payload.get("top_interest_tags", []))
    top_interest_tags = [tag for tag in top_interest_tags if tag in ALLOWED_INTEREST_TAGS]
    if not top_interest_tags:
        top_interest_tags = fallback["top_interest_tags"]

    avoid_tags = _normalize_string_list(payload.get("avoid_tags", [])) or fallback["avoid_tags"]

    preferred_time_windows = _normalize_string_list(payload.get("preferred_time_windows", []))
    preferred_time_windows = [window for window in preferred_time_windows if window in ALLOWED_TIME_WINDOWS]
    if not preferred_time_windows:
        preferred_time_windows = fallback["preferred_time_windows"]

    notification_priority_tags = _normalize_string_list(payload.get("notification_priority_tags", []))
    if not notification_priority_tags:
        notification_priority_tags = fallback["notification_priority_tags"]

    notification_frequency = str(payload.get("notification_frequency") or fallback["notification_frequency"]).lower()
    if notification_frequency not in ALLOWED_NOTIFICATION_FREQUENCIES:
        notification_frequency = fallback["notification_frequency"]

    profile_summary = str(payload.get("profile_summary") or fallback["profile_summary"]).strip()
    if not profile_summary:
        profile_summary = fallback["profile_summary"]

    return {
        "top_categories": top_categories[:5],
        "top_interest_tags": top_interest_tags[:12],
        "avoid_tags": avoid_tags[:12],
        "preferred_time_windows": preferred_time_windows[:4],
        "notification_priority_tags": notification_priority_tags[:8],
        "notification_frequency": notification_frequency,
        "profile_summary": profile_summary[:220],
    }


def generate_user_preference_profile(
    onboarding_answers: Dict[str, Any],
    interaction_history: Optional[List[Dict[str, Any]]] = None,
    *,
    allow_llm: bool = True,
) -> Dict[str, Any]:
    """Create a stored user preference profile, prioritizing onboarding data."""
    interaction_summary = _extract_interaction_summary(interaction_history)
    fallback = _deterministic_profile(onboarding_answers or {}, interaction_summary)

    if allow_llm:
        models = llm_client.get_user_profile_models()
        start_index = 0
        while start_index < len(models):
            subset = models[start_index:]
            model_used: Optional[str] = None
            try:
                messages = build_user_profile_messages(onboarding_answers or {}, interaction_summary)
                response = llm_client.chat_completion(
                    messages,
                    subset,
                    purpose="user_preference_profile",
                    timeout_seconds=25.0,
                    temperature=0.0,
                    max_tokens=650,
                    retry_on_invalid_json=True,
                )
                model_used = response.model
                parsed = llm_client.parse_json_object(response.content)
                normalized = _normalize_profile_payload(parsed, fallback)
                return {
                    **normalized,
                    "profile_model": model_used or subset[0],
                    "profile_version": PROFILE_VERSION,
                    "profile_generated_at": datetime.now(timezone.utc).isoformat(),
                }
            except Exception as exc:
                logger.warning(
                    "user_profile_llm_failed start_index=%s subset=%s error=%s",
                    start_index,
                    subset[:3],
                    exc,
                )
                if model_used and model_used in models:
                    start_index = models.index(model_used) + 1
                else:
                    start_index += 1

    return {
        **fallback,
        "profile_model": "deterministic_rules",
        "profile_version": PROFILE_VERSION,
        "profile_generated_at": datetime.now(timezone.utc).isoformat(),
    }
