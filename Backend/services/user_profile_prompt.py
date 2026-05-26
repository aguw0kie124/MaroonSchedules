from __future__ import annotations

import json
from typing import Any, Dict, List, Optional


_USER_PROFILE_SYSTEM_PROMPT = """You generate structured user event preference profiles for a university events application.

Return strict JSON only. No markdown, no prose outside JSON.

You must prioritize onboarding survey answers as the primary signal.
Interaction history is secondary and can only refine ranking.
Do not override onboarding intent using sparse behavior data.

The frontend event categories are fixed. Use only these category keys:
- sports
- academic
- food
- social
- health_wellness
- entertainment
- advocacy
- miscellaneous

Output JSON schema:
{
  "top_categories": ["..."],
  "top_interest_tags": ["..."],
  "avoid_tags": ["..."],
  "preferred_time_windows": ["..."],
  "notification_priority_tags": ["..."],
  "notification_frequency": "low | medium | high",
  "profile_summary": "short summary"
}

Constraints:
- top_categories: 1-5 items from fixed category keys above.
- top_interest_tags, avoid_tags, notification_priority_tags: concise lowercase snake_case tags.
- preferred_time_windows: concise windows such as weekday_day, weekday_night, weekend_day, weekend_night, any.
- profile_summary: max 30 words.
"""


def get_user_profile_system_prompt() -> str:
    return _USER_PROFILE_SYSTEM_PROMPT


def _listify(value: Any) -> List[Any]:
    if isinstance(value, list):
        return value
    if value is None:
        return []
    return [value]


def build_user_profile_payload(
    onboarding_answers: Dict[str, Any],
    interaction_summary: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    return {
        "onboarding_answers": onboarding_answers or {},
        "interaction_summary": interaction_summary or {},
    }


def build_user_profile_messages(
    onboarding_answers: Dict[str, Any],
    interaction_summary: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, str]]:
    payload = build_user_profile_payload(onboarding_answers, interaction_summary)
    return [
        {
            "role": "system",
            "content": get_user_profile_system_prompt(),
        },
        {
            "role": "user",
            "content": json.dumps(payload, ensure_ascii=True),
        },
    ]
