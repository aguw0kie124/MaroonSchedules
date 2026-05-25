from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from services import recommendation_engine

DEFAULT_NOTIFICATION_SCORE_THRESHOLD = 6.0
DEFAULT_NOTIFICATION_WINDOW_HOURS = 24
DEFAULT_DAILY_NOTIFICATION_CAP = 3


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


def select_notification_candidates(
    events: List[Dict[str, Any]],
    user_profile: Dict[str, Any],
    *,
    interaction_context: Optional[Dict[str, Any]] = None,
    already_notified_event_ids: Optional[List[str]] = None,
    daily_sent_count: int = 0,
    score_threshold: float = DEFAULT_NOTIFICATION_SCORE_THRESHOLD,
    window_hours: int = DEFAULT_NOTIFICATION_WINDOW_HOURS,
    daily_cap: int = DEFAULT_DAILY_NOTIFICATION_CAP,
) -> List[Dict[str, Any]]:
    """Return ranked notification candidates driven by recommendation score."""
    interaction_context = interaction_context or {}
    notified_ids = {str(item) for item in (already_notified_event_ids or [])}
    now = datetime.now(timezone.utc)
    window_end = now + timedelta(hours=window_hours)

    candidates: List[Dict[str, Any]] = []
    remaining = max(0, daily_cap - max(0, daily_sent_count))
    if remaining <= 0:
        return []

    for event in events:
        event_id = str(event.get("event_id") or event.get("id") or "")
        if not event_id or event_id in notified_ids:
            continue

        status = str(event.get("rsvp_status") or "").lower()
        if status in {"hidden", "dismissed", "not_interested", "disliked"}:
            continue

        start = _parse_event_time(event.get("start_time"))
        if not start or start < now or start > window_end:
            continue

        score = recommendation_engine.score_event_for_user(
            event,
            user_profile,
            interaction_context=interaction_context,
            now=now,
        )
        if score < score_threshold:
            continue

        enriched = dict(event)
        enriched["recommendation_score"] = score
        candidates.append(enriched)

    candidates.sort(key=lambda item: item.get("recommendation_score", 0), reverse=True)
    return candidates[:remaining]
