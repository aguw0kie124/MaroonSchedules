from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from services import place_registry_service


def _parse_iso(iso_value: Optional[str]) -> Optional[datetime]:
    if not iso_value:
        return None
    try:
        return datetime.fromisoformat(str(iso_value).replace("Z", "+00:00"))
    except ValueError:
        return None


def _coerce_iso(iso_value: Optional[str], fallback: datetime) -> str:
    parsed = _parse_iso(iso_value)
    if parsed:
        return parsed.isoformat()
    return fallback.isoformat()


def normalize_ping_activity_payload(activity: Dict[str, Any]) -> Dict[str, Any]:
    custom = dict(activity.get("custom") or {})
    attachments = list(activity.get("attachments") or [])
    now = datetime.now(timezone.utc)

    resolved_place = place_registry_service.get_place_by_id(custom.get("place_id")) or place_registry_service.resolve_place(
        custom.get("location_tag")
    )

    canonical_location = resolved_place["name"] if resolved_place else str(custom.get("location_tag") or "Campus")
    start_at = _coerce_iso(custom.get("start_at"), now)
    start_dt = _parse_iso(start_at) or now
    end_at = _coerce_iso(custom.get("end_at"), start_dt + timedelta(hours=2))

    normalized_custom = {
        **custom,
        "ping_title": str(custom.get("ping_title") or "Campus Ping"),
        "ping_category": str(custom.get("ping_category") or "Popup"),
        "location_tag": canonical_location,
        "place_id": resolved_place["place_id"] if resolved_place else custom.get("place_id"),
        "place_name": canonical_location,
        "place_lat": resolved_place["lat"] if resolved_place else custom.get("place_lat"),
        "place_lng": resolved_place["lng"] if resolved_place else custom.get("place_lng"),
        "start_at": start_at,
        "end_at": end_at,
        "content_type": "ping",
    }

    return {
        **activity,
        "attachments": attachments,
        "custom": normalized_custom,
    }


def enrich_ping_activity(activity: Dict[str, Any]) -> Dict[str, Any]:
    custom = dict(activity.get("custom") or {})
    resolved_place = (
        place_registry_service.get_place_by_id(custom.get("place_id"))
        or place_registry_service.resolve_place(custom.get("location_tag"), custom.get("place_lat"), custom.get("place_lng"))
    )

    if not resolved_place:
        return activity

    normalized_custom = {
        **custom,
        "location_tag": resolved_place["name"],
        "place_id": resolved_place["place_id"],
        "place_name": resolved_place["name"],
        "place_lat": resolved_place["lat"],
        "place_lng": resolved_place["lng"],
    }
    return {
        **activity,
        "custom": normalized_custom,
        "place": place_registry_service.serialize_place(resolved_place),
    }
