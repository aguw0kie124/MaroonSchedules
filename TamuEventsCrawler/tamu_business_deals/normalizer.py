from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import Any, Iterable, Optional

from rapidfuzz import fuzz

from .business_catalog import infer_area_label
from .date_utils import infer_recurrence_rule, next_window_from_recurrence
from .models import BusinessRecord, DealRecord
from .osm_lookup import match_place
from .utils import canonicalize_url, clean_text, normalize_key, unique_strings

logger = logging.getLogger("tamu_crawler.business_deals.normalizer")

OFF_CAMPUS_POSITIVE_SIGNALS = (
    "northgate",
    "bryan",
    "downtown",
    "century square",
    "lake walk",
    "post oak mall",
    "church ave",
    "main street",
    "main st",
    "university drive",
)

CAMPUS_NEGATIVE_SIGNALS = (
    "memorial student center",
    "msc ",
    "rudder",
    "reed arena",
    "kyle field",
    "blue bell park",
    "texas a&m university",
    "student recreation center",
    "evans library",
    "zachry",
)


def _best_business_match(candidate_name: str | None, records: Iterable[BusinessRecord]) -> Optional[BusinessRecord]:
    normalized = normalize_key(candidate_name)
    if not normalized:
        return None

    best: BusinessRecord | None = None
    best_score = 0.0
    for record in records:
        score = fuzz.ratio(normalized, normalize_key(record.name))
        if score > best_score:
            best_score = score
            best = record
    return best if best_score >= 88 else None


def _infer_deal_type(text: str, event_scope: str) -> str:
    if "happy hour" in text:
        return "happy_hour"
    if "trivia" in text:
        return "trivia"
    if "open mic" in text:
        return "open_mic"
    if "live music" in text or "concert" in text:
        return "live_music"
    if "run club" in text:
        return "fitness"
    if "market" in text:
        return "market"
    if any(term in text for term in ("discount", "off ", "bogo", "half off", "$")):
        return "discount"
    return "event" if event_scope == "event" else "promotion"


def _infer_category(text: str, event_scope: str) -> str:
    if event_scope == "promotion":
        return "Promotions"
    if any(term in text for term in ("live music", "concert", "open mic", "performance", "show")):
        return "Entertainment"
    if any(term in text for term in ("trivia", "mixer", "social", "nightlife", "happy hour")):
        return "Social"
    if any(term in text for term in ("market", "food", "wine", "margarita", "beer", "restaurant")):
        return "Food"
    if any(term in text for term in ("run club", "fitness", "wellness", "yoga")):
        return "Health & Wellness"
    if any(term in text for term in ("art", "museum", "gallery", "exhibit")):
        return "Entertainment"
    return "Miscellaneous"


def _student_friendly_score(
    *,
    title: str,
    description: str,
    business: BusinessRecord | None,
    area_label: str | None,
    event_scope: str,
    deal_type: str,
) -> int:
    text = " ".join(
        part
        for part in [
            title.lower(),
            description.lower(),
            (business.name.lower() if business else ""),
            (business.category.lower() if business and business.category else ""),
            (area_label or "").lower(),
            deal_type.lower(),
        ]
        if part
    )
    score = 10

    if area_label in {"Northgate", "Downtown Bryan", "Century Square"}:
        score += 22
    elif area_label in {"Bryan", "College Station"}:
        score += 12

    if event_scope == "promotion":
        score += 10

    if any(term in text for term in ("happy hour", "trivia", "open mic", "live music", "run club", "student night", "discount", "free")):
        score += 24
    if any(term in text for term in ("beer", "wine", "margarita", "wings", "pizza", "market", "food")):
        score += 12
    if any(term in text for term in OFF_CAMPUS_POSITIVE_SIGNALS):
        score += 12
    if business and business.category:
        if business.category.lower() in {"bar", "pub", "restaurant", "fast food", "cafe", "coffee", "fitness centre", "events venue", "cinema"}:
            score += 10
        if business.category.lower() in {"clothes", "marketplace", "gift"}:
            score += 4

    if any(term in text for term in ("holiday package", "spa package", "wedding", "conference center", "bed & breakfast", "hotel special")):
        score -= 28
    if any(term in text for term in CAMPUS_NEGATIVE_SIGNALS) and not any(signal in text for signal in OFF_CAMPUS_POSITIVE_SIGNALS):
        score -= 40

    return max(0, min(100, score))


def is_off_campus_candidate(title: str, description: str, location_name: str | None, address: str | None) -> bool:
    combined = " ".join(
        part for part in [title, description, location_name or "", address or ""] if part
    ).lower()
    if any(signal in combined for signal in OFF_CAMPUS_POSITIVE_SIGNALS):
        return True
    return not any(signal in combined for signal in CAMPUS_NEGATIVE_SIGNALS)


def normalize_candidate(
    candidate: dict[str, Any],
    business_records: list[BusinessRecord],
) -> Optional[DealRecord]:
    title = clean_text(candidate.get("title"))
    if not title:
        return None

    description = clean_text(candidate.get("description"))
    location_name = clean_text(candidate.get("location_name")) or None
    address = clean_text(candidate.get("address")) or None
    city = clean_text(candidate.get("city")) or None
    event_scope = clean_text(candidate.get("event_scope")) or "event"

    if not is_off_campus_candidate(title, description, location_name, address):
        return None

    business_name = clean_text(candidate.get("business_name")) or None
    business = _best_business_match(business_name or location_name or title, business_records)
    if business:
        business_name = business_name or business.name
        location_name = location_name or business.name
        address = address or business.address
        city = city or business.city

    place_match = match_place(business_name or location_name or title, address)
    area_label = clean_text(candidate.get("area_label")) or infer_area_label(
        f"{business_name or location_name or title} {description}",
        address,
        city,
    )

    start_date = candidate.get("start_date")
    end_date = candidate.get("end_date")
    recurrence_hint = clean_text(candidate.get("recurrence_text") or candidate.get("recurring_pattern"))
    time_hint = clean_text(candidate.get("time_text"))
    recurrence_rule = infer_recurrence_rule(f"{recurrence_hint} {description} {title}", time_hint=time_hint)
    if recurrence_rule and start_date is None:
        start_date, end_date = next_window_from_recurrence(recurrence_rule)

    tags = unique_strings(
        list(candidate.get("tags") or [])
        + [area_label, city, business_name, candidate.get("deal_type")]
    )
    combined_text = " ".join(filter(None, [title, description, " ".join(tags)])).lower()
    deal_type = clean_text(candidate.get("deal_type")) or _infer_deal_type(combined_text, event_scope)
    category = clean_text(candidate.get("category")) or _infer_category(combined_text, event_scope)
    student_score = _student_friendly_score(
        title=title,
        description=description,
        business=business,
        area_label=area_label,
        event_scope=event_scope,
        deal_type=deal_type,
    )
    is_student_friendly = bool(candidate.get("is_student_friendly")) or student_score >= 35

    if not is_student_friendly:
        return None

    recurring_pattern = clean_text(candidate.get("recurring_pattern"))
    if not recurring_pattern and recurrence_rule:
        recurring_pattern = recurrence_rule.pattern

    return DealRecord(
        title=title,
        description=description or None,
        business_name=business_name or location_name or None,
        category=category,
        source_url=clean_text(candidate.get("source_url")),
        source_name=clean_text(candidate.get("source_name")) or "unknown_source",
        location_name=location_name or business_name or None,
        address=address,
        city=city or (business.city if business else None),
        start_date=start_date,
        end_date=end_date,
        recurring_pattern=recurring_pattern or None,
        deal_type=deal_type,
        discount_text=clean_text(candidate.get("discount_text")) or None,
        tags=tags,
        image_url=clean_text(candidate.get("image_url")) or None,
        latitude=(
            candidate.get("latitude")
            or (business.latitude if business else None)
            or (place_match.get("lat") if place_match else None)
        ),
        longitude=(
            candidate.get("longitude")
            or (business.longitude if business else None)
            or (place_match.get("lng") if place_match else None)
        ),
        is_student_friendly=is_student_friendly,
        raw_source_text=clean_text(candidate.get("raw_source_text")) or None,
        canonical_url=canonicalize_url(candidate.get("canonical_url") or candidate.get("source_url")),
        event_scope=event_scope,
        area_label=area_label,
        raw_payload=dict(candidate.get("raw_payload") or {}, student_score=student_score),
        source_links=unique_strings([candidate.get("source_url"), candidate.get("canonical_url")]),
    )
