from __future__ import annotations

from datetime import datetime, timedelta, timezone
import json
import re
from pathlib import Path
from typing import Any, Dict, List, Tuple
from urllib.parse import urljoin
from zoneinfo import ZoneInfo

from services import cache_service


LOCAL_TZ = ZoneInfo("America/Chicago")
BUSINESS_EVENTS_OUTPUT = (
    Path(__file__).resolve().parents[2]
    / "TamuEventsCrawler"
    / "tamu_business_deals"
    / "output"
    / "business_deals.jsonl"
)
BUSINESS_EVENTS_TTL_SECONDS = 300
BUSINESS_EVENTS_CACHE_VERSION = "v1"
_BUSINESS_EVENTS_CACHE: List[Dict[str, Any]] = []
_BUSINESS_EVENTS_CACHE_MTIME_NS: int | None = None

FOOD_TERMS = (
    "happy hour",
    "brunch",
    "dinner",
    "lunch",
    "wings",
    "pizza",
    "taco",
    "beer",
    "wine",
    "cocktail",
    "margarita",
    "drink",
    "food",
    "bites",
)
PROFESSIONAL_TERMS = (
    "networking",
    "panel",
    "professional",
    "career",
    "resume",
    "interview",
)


def _clean_text(value: Any) -> str:
    if value is None:
        return ""
    return re.sub(r"\s+", " ", str(value)).strip()


def _parse_datetime(value: Any) -> datetime | None:
    text = _clean_text(value)
    if not text:
        return None
    normalized = text.replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=LOCAL_TZ)
    return parsed


def _has_food_signal(*parts: Any) -> bool:
    blob = " ".join(_clean_text(part).lower() for part in parts if part)
    return any(term in blob for term in FOOD_TERMS)


def _absolutize_url(source_url: str, value: Any) -> str | None:
    text = _clean_text(value)
    if not text:
        return None
    if text.startswith(("http://", "https://")):
        return text
    return urljoin(source_url, text)


def _categories_for_record(raw: Dict[str, Any], *, has_food: bool) -> Dict[str, int]:
    category = _clean_text(raw.get("category")).lower()
    deal_type = _clean_text(raw.get("deal_type")).lower()
    scope = _clean_text(raw.get("event_scope")).lower()
    text = " ".join(
        [
            category,
            deal_type,
            _clean_text(raw.get("title")).lower(),
            _clean_text(raw.get("description")).lower(),
            _clean_text(raw.get("discount_text")).lower(),
            " ".join(_clean_text(tag).lower() for tag in raw.get("tags") or []),
        ]
    )

    is_promotion = scope == "promotion" or category == "promotions"
    is_social = category == "social" or any(term in text for term in ("trivia", "social", "student night", "open mic"))
    is_entertainment = category == "entertainment" or any(term in text for term in ("music", "concert", "show", "performance", "festival"))
    is_health = category == "health & wellness" or any(term in text for term in ("run club", "yoga", "wellness", "fitness"))
    is_academic = category == "academic" or any(term in text for term in ("lecture", "workshop", "speaker"))
    is_advocacy = category == "advocacy" or any(term in text for term in ("benefit", "fundraiser", "nonprofit", "awareness"))
    is_professional = any(term in text for term in PROFESSIONAL_TERMS)

    categories = {
        "featured": 0,
        "promotions": int(is_promotion),
        "social": int(is_social),
        "sports": 0,
        "academic": int(is_academic),
        "food": int(has_food or category == "food"),
        "advocacy": int(is_advocacy),
        "entertainment": int(is_entertainment),
        "health_wellness": int(is_health),
        "miscellaneous": 0,
        "casual": int(not is_professional),
        "professional": int(is_professional),
    }
    if not any(
        categories[key]
        for key in (
            "promotions",
            "social",
            "sports",
            "academic",
            "food",
            "advocacy",
            "entertainment",
            "health_wellness",
        )
    ):
        categories["miscellaneous"] = 1
    return categories


def _student_relevance(raw: Dict[str, Any], *, has_food: bool) -> Tuple[int, str, List[str]]:
    payload = raw.get("raw_payload") or {}
    score = int(payload.get("student_score") or (55 if raw.get("is_student_friendly") else 35))
    reasons: List[str] = []
    area_label = _clean_text(raw.get("area_label"))
    scope = _clean_text(raw.get("event_scope")).lower()
    text = " ".join(
        [
            _clean_text(raw.get("title")).lower(),
            _clean_text(raw.get("description")).lower(),
            _clean_text(raw.get("discount_text")).lower(),
            area_label.lower(),
            _clean_text(raw.get("deal_type")).lower(),
        ]
    )

    if scope == "promotion":
        score += 8
        reasons.append("promotion")
    if has_food:
        score += 10
        reasons.append("food_signal")
    if area_label in {"Northgate", "Century Square", "Downtown Bryan"}:
        score += 8
        reasons.append("student_hotspot")
    if any(term in text for term in ("student", "happy hour", "trivia", "live music", "discount", "free")):
        score += 8
        reasons.append("student_activity")

    score = max(0, min(100, score))
    if score >= 70:
        label = "high"
    elif score >= 35:
        label = "medium"
    else:
        label = "low"
    return score, label, reasons


def _normalize_record(raw: Dict[str, Any]) -> Dict[str, Any] | None:
    title = _clean_text(raw.get("title"))
    source_url = _clean_text(raw.get("source_url"))
    if not title or not source_url:
        return None

    start_dt = _parse_datetime(raw.get("start_date"))
    if start_dt is None:
        return None
    end_dt = _parse_datetime(raw.get("end_date"))
    if end_dt and end_dt < start_dt:
        end_dt = None

    business_name = _clean_text(raw.get("business_name")) or None
    location_name = _clean_text(raw.get("location_name")) or business_name or _clean_text(raw.get("address")) or None
    area_label = _clean_text(raw.get("area_label")) or _clean_text(raw.get("city")) or "Off Campus"
    city = _clean_text(raw.get("city")) or None
    description = (
        _clean_text(raw.get("description"))
        or _clean_text(raw.get("discount_text"))
        or _clean_text(raw.get("raw_source_text"))[:240]
    )
    has_food = _has_food_signal(
        raw.get("category"),
        raw.get("deal_type"),
        raw.get("discount_text"),
        description,
        *(raw.get("tags") or []),
    )
    categories = _categories_for_record(raw, has_food=has_food)
    score, label, reasons = _student_relevance(raw, has_food=has_food)

    return {
        "event_id": f"business:{_clean_text(raw.get('id')) or title.lower()}",
        "title": title,
        "summary": description,
        "description": description,
        "raw_location": location_name,
        "location": location_name or area_label,
        "place_id": None,
        "location_lat": raw.get("latitude"),
        "location_lng": raw.get("longitude"),
        "start_time": start_dt.isoformat(),
        "end_time": end_dt.isoformat() if end_dt else None,
        "link": source_url,
        "source_url": source_url,
        "host_name": business_name,
        "organization_name": business_name,
        "source_name": _clean_text(raw.get("source_name")) or "tamu_business_deals",
        "tags": list(raw.get("tags") or []),
        "access_tags": [],
        "has_food": has_food,
        "food_confidence": 0.82 if has_food else 0.0,
        "food_type": _clean_text(raw.get("deal_type")) or ("promotion" if categories["promotions"] else "unknown"),
        "food_reasons": ["business_deals_ingest"] if has_food else [],
        "categories": categories,
        "image_url": _absolutize_url(source_url, raw.get("image_url")),
        "map_available": bool(raw.get("latitude") is not None and raw.get("longitude") is not None),
        "campus_interest_score": score,
        "campus_interest_label": label,
        "campus_interest_reasons": reasons or ["business_deals_ingest"],
        "event_scope": _clean_text(raw.get("event_scope")) or "event",
        "area_label": area_label,
        "city": city,
        "business_name": business_name,
        "discount_text": _clean_text(raw.get("discount_text")) or None,
        "recurring_pattern": _clean_text(raw.get("recurring_pattern")) or None,
        "canonical_url": _clean_text(raw.get("canonical_url")) or source_url,
        "is_student_friendly": bool(raw.get("is_student_friendly")),
        "is_off_campus": True,
        "is_promotion": bool(categories["promotions"]),
    }


def load_local_business_events(force_refresh: bool = False) -> Dict[str, Any]:
    global _BUSINESS_EVENTS_CACHE_MTIME_NS

    cache_key = f"campus:events:local_business:{BUSINESS_EVENTS_CACHE_VERSION}"
    if not force_refresh:
        cached = cache_service.get_json(cache_key)
        if cached is not None:
            return cached

    if not BUSINESS_EVENTS_OUTPUT.exists():
        payload = {
            "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "stale_after": 60,
            "source_status": "missing",
            "events": [],
        }
        cache_service.set_json(cache_key, payload, 60)
        return payload

    mtime_ns = BUSINESS_EVENTS_OUTPUT.stat().st_mtime_ns
    if (
        not force_refresh
        and _BUSINESS_EVENTS_CACHE_MTIME_NS == mtime_ns
        and _BUSINESS_EVENTS_CACHE
    ):
        payload = {
            "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "stale_after": BUSINESS_EVENTS_TTL_SECONDS,
            "source_status": "live",
            "events": list(_BUSINESS_EVENTS_CACHE),
        }
        cache_service.set_json(cache_key, payload, BUSINESS_EVENTS_TTL_SECONDS)
        return payload

    cutoff = datetime.now(LOCAL_TZ) - timedelta(days=3)
    events: List[Dict[str, Any]] = []
    with BUSINESS_EVENTS_OUTPUT.open("r", encoding="utf-8") as handle:
        for line in handle:
            if not line.strip():
                continue
            try:
                raw = json.loads(line)
            except json.JSONDecodeError:
                continue
            normalized = _normalize_record(raw)
            if not normalized:
                continue
            start_time = _parse_datetime(normalized.get("start_time"))
            if start_time is None or start_time < cutoff:
                continue
            events.append(normalized)

    events.sort(
        key=lambda event: (
            0 if event.get("is_promotion") else 1,
            -int(event.get("campus_interest_score") or 0),
            event.get("start_time") or "",
        )
    )

    _BUSINESS_EVENTS_CACHE[:] = events
    _BUSINESS_EVENTS_CACHE_MTIME_NS = mtime_ns

    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "stale_after": BUSINESS_EVENTS_TTL_SECONDS,
        "source_status": "live" if events else "preview",
        "events": events,
    }
    cache_service.set_json(cache_key, payload, BUSINESS_EVENTS_TTL_SECONDS)
    return payload
