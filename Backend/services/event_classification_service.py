from __future__ import annotations

import logging
import re
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Optional, Tuple

from services import llm_client
from services.event_classifier_prompt import build_event_classification_messages

logger = logging.getLogger("backend.event_classification")

CLASSIFIER_VERSION = "event_classifier_v1"

ALLOWED_PRIMARY_CATEGORIES = {
    "sports",
    "academic",
    "food",
    "social",
    "health_wellness",
    "entertainment",
    "advocacy",
    "miscellaneous",
}
ALLOWED_INTEREST_TAGS = {
    "cs",
    "engineering",
    "math",
    "business",
    "premed",
    "law",
    "design",
    "robotics",
    "ai",
    "ml",
    "hackathon",
    "startup",
    "free_food",
    "networking",
    "outdoors",
    "performance",
    "international",
    "graduate",
    "freshman",
    "upperclassman",
    "research",
    "community",
    "volunteering",
    "leadership",
    "career",
    "wellness",
    "fitness",
    "music",
    "art",
    "gaming",
}
ALLOWED_AUDIENCE_TAGS = {
    "undergraduate",
    "graduate",
    "all_students",
    "beginners",
    "advanced",
    "open_to_public",
}
ALLOWED_CONTENT_FLAGS = {
    "requires_registration",
    "paid",
    "limited_capacity",
    "competitive",
    "recurring",
    "late_night",
}

_CATEGORY_ALIASES = {
    "sports": "sports",
    "sport": "sports",
    "athletics": "sports",
    "academic": "academic",
    "education": "academic",
    "educational": "academic",
    "food": "food",
    "social": "social",
    "health & wellness": "health_wellness",
    "health and wellness": "health_wellness",
    "health_wellness": "health_wellness",
    "health wellness": "health_wellness",
    "wellness": "health_wellness",
    "entertainment": "entertainment",
    "advocacy": "advocacy",
    "miscellaneous": "miscellaneous",
    "misc": "miscellaneous",
}

_DEFAULT_CLASSIFICATION = {
    "primary_category": "miscellaneous",
    "secondary_categories": [],
    "interest_tags": [],
    "audience_tags": ["all_students"],
    "content_flags": [],
    "confidence": 0.25,
    "reasoning_summary": "No strong category signal found.",
}


def _to_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    return str(value)


def _normalize_category(value: Any) -> Optional[str]:
    if value is None:
        return None
    token = _to_text(value).strip().lower().replace("_", " ")
    token = re.sub(r"\s+", " ", token)
    canonical = _CATEGORY_ALIASES.get(token)
    if canonical in ALLOWED_PRIMARY_CATEGORIES:
        return canonical
    return None


def _normalize_tag_list(values: Any, allowed: Iterable[str]) -> List[str]:
    allowed_set = set(allowed)
    if not isinstance(values, list):
        return []
    normalized: List[str] = []
    seen: set[str] = set()
    for raw in values:
        item = _to_text(raw).strip().lower().replace("-", "_").replace(" ", "_")
        if item in allowed_set and item not in seen:
            seen.add(item)
            normalized.append(item)
    return normalized


def _normalize_confidence(value: Any, fallback: float) -> float:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return fallback
    if parsed < 0.0:
        return 0.0
    if parsed > 1.0:
        return 1.0
    return parsed


def _normalize_reasoning_summary(value: Any, fallback: str) -> str:
    text = _to_text(value).strip()
    if not text:
        text = fallback
    words = text.split()
    if len(words) > 15:
        text = " ".join(words[:15])
    return text


def _event_blob(event: Dict[str, Any]) -> str:
    parts: List[str] = []
    for key in (
        "title",
        "description",
        "location",
        "host_name",
        "host_type",
        "department_name",
        "registration_status",
        "affiliation",
        "campus",
    ):
        parts.append(_to_text(event.get(key)))
    parts.extend(_to_text(tag) for tag in event.get("tags") or [])
    parts.extend(_to_text(aud) for aud in event.get("audience") or [])
    return " ".join(parts).lower()


def _detect_interest_tags(blob: str, event: Dict[str, Any]) -> List[str]:
    tags: List[str] = []

    keyword_map = {
        "cs": ["computer science", "csce", "coding", "programming"],
        "engineering": ["engineering", "engineer", "mechanical", "electrical", "civil"],
        "math": ["math", "mathematics", "calculus", "algebra", "statistics"],
        "business": ["business", "finance", "accounting", "marketing", "entrepreneur"],
        "premed": ["premed", "medical school", "medicine", "clinical"],
        "law": ["law", "legal", "pre-law", "policy"],
        "design": ["design", "ux", "ui", "creative"],
        "robotics": ["robotics", "robot", "autonomous"],
        "ai": ["artificial intelligence", "ai"],
        "ml": ["machine learning", "ml"],
        "hackathon": ["hackathon", "hack day"],
        "startup": ["startup", "founder", "venture"],
        "free_food": ["free food", "free pizza", "snacks", "refreshments", "meal provided"],
        "networking": ["networking", "meet and greet", "career fair"],
        "outdoors": ["outdoor", "trail", "park", "hike"],
        "performance": ["performance", "show", "theater", "theatre"],
        "international": ["international", "global", "study abroad", "multicultural"],
        "graduate": ["graduate", "grad student", "masters", "phd"],
        "freshman": ["freshman", "first-year"],
        "upperclassman": ["junior", "senior", "upperclass"],
        "research": ["research", "lab", "colloquium", "symposium"],
        "community": ["community", "student life", "campus life"],
        "volunteering": ["volunteer", "service project", "community service"],
        "leadership": ["leadership", "leader", "executive board"],
        "career": ["career", "resume", "interview", "professional development"],
        "wellness": ["wellness", "self-care", "mental health"],
        "fitness": ["fitness", "workout", "yoga", "run"],
        "music": ["music", "concert", "band"],
        "art": ["art", "gallery", "paint", "museum"],
        "gaming": ["gaming", "game night", "esports"],
    }

    for tag, keywords in keyword_map.items():
        if any(keyword in blob for keyword in keywords):
            tags.append(tag)

    source_tags = [str(tag).lower().replace(" ", "_") for tag in event.get("tags") or []]
    for tag in source_tags:
        if tag in ALLOWED_INTEREST_TAGS and tag not in tags:
            tags.append(tag)

    return tags[:8]


def _detect_audience_tags(blob: str, event: Dict[str, Any]) -> List[str]:
    values = [str(item).lower() for item in (event.get("audience") or [])]
    joined = " ".join(values) + " " + blob
    tags: List[str] = []

    if any(token in joined for token in ["undergrad", "undergraduate", "freshman", "sophomore", "junior", "senior"]):
        tags.append("undergraduate")
    if any(token in joined for token in ["graduate", "grad", "masters", "phd"]):
        tags.append("graduate")
    if any(token in joined for token in ["all students", "all student", "all majors", "any student"]):
        tags.append("all_students")
    if any(token in joined for token in ["beginner", "intro", "no experience"]):
        tags.append("beginners")
    if any(token in joined for token in ["advanced", "experienced", "prior experience"]):
        tags.append("advanced")
    if any(token in joined for token in ["open to public", "public", "community members"]):
        tags.append("open_to_public")

    if not tags:
        tags = ["all_students"]

    deduped: List[str] = []
    for tag in tags:
        if tag in ALLOWED_AUDIENCE_TAGS and tag not in deduped:
            deduped.append(tag)
    return deduped


def _detect_content_flags(blob: str, event: Dict[str, Any]) -> List[str]:
    flags: List[str] = []

    registration_status = _to_text(event.get("registration_status")).lower()
    if registration_status in {"open", "required", "available", "registration_required"} or any(
        token in blob for token in ["register", "registration", "rsvp"]
    ):
        flags.append("requires_registration")

    if any(token in blob for token in ["$", "paid", "ticket", "admission fee", "cost:"]):
        flags.append("paid")

    seats_available = event.get("seats_available")
    seats_total = event.get("seats_total")
    if seats_total or seats_available is not None or any(token in blob for token in ["limited seats", "limited capacity", "first "]):
        flags.append("limited_capacity")

    if any(token in blob for token in ["competition", "tournament", "challenge", "tryout", "hackathon"]):
        flags.append("competitive")

    if any(token in blob for token in ["weekly", "monthly", "every week", "every month", "recurring"]):
        flags.append("recurring")

    start_time = _to_text(event.get("start_time"))
    hour_match = re.search(r"T(\d{2}):", start_time)
    if hour_match:
        try:
            hour = int(hour_match.group(1))
            if hour >= 21 or hour <= 2:
                flags.append("late_night")
        except ValueError:
            pass

    deduped = [flag for flag in flags if flag in ALLOWED_CONTENT_FLAGS]
    return list(dict.fromkeys(deduped))


def _keyword_classification(event: Dict[str, Any]) -> Dict[str, Any]:
    blob = _event_blob(event)
    scores = {category: 0 for category in ALLOWED_PRIMARY_CATEGORIES}

    def bump(category: str, points: int, keywords: Iterable[str]) -> None:
        if any(keyword in blob for keyword in keywords):
            scores[category] += points

    # Preserve existing heuristics as a strong prior.
    for category in ("sports", "academic", "food", "social", "health_wellness", "entertainment", "advocacy"):
        if event.get(category):
            scores[category] += 3

    bump("sports", 4, ["sport", "athletic", "intramural", "match", "tournament", "game", "tryout"])
    bump(
        "academic",
        4,
        [
            "seminar",
            "colloquium",
            "lecture",
            "symposium",
            "expo",
            "information session",
            "workshop",
            "career",
            "networking",
            "professional",
            "research",
            "graduate",
            "microteaching",
            "teaching",
            "language proficiency",
            "english language",
        ],
    )

    # Food should only dominate when it is an explicit draw.
    food_major_draw = any(keyword in blob for keyword in ["free food", "free pizza", "dinner", "lunch", "breakfast", "meal", "food"])
    if food_major_draw:
        scores["food"] += 5
    if event.get("has_food") and float(event.get("food_confidence") or 0.0) >= 0.65:
        scores["food"] += 4

    bump("social", 4, ["social", "mixer", "meetup", "community", "hangout", "student life", "welcome event"])
    bump("health_wellness", 4, ["wellness", "therapy", "self-care", "fitness", "mental health", "yoga", "meditation"])
    bump("entertainment", 4, ["concert", "music", "performance", "arts", "game night", "movie", "comedy", "show"])
    bump("advocacy", 4, ["civic", "advocacy", "service", "volunteer", "volunteering", "cause", "awareness", "charity"])

    if event.get("food") and scores["academic"] >= scores["food"] and not food_major_draw:
        scores["food"] = max(0, scores["food"] - 3)

    primary_category = max(scores.items(), key=lambda item: item[1])[0]
    if scores[primary_category] <= 0:
        primary_category = "miscellaneous"

    secondary = [
        cat
        for cat, score in sorted(scores.items(), key=lambda item: item[1], reverse=True)
        if cat != primary_category and score >= 3 and cat != "miscellaneous"
    ][:3]

    confidence = 0.45
    if scores[primary_category] >= 8:
        confidence = 0.9
    elif scores[primary_category] >= 5:
        confidence = 0.75
    elif scores[primary_category] >= 3:
        confidence = 0.6

    reasoning = {
        "sports": "Event emphasizes athletics and competition.",
        "academic": "Event is academic, research, or career oriented.",
        "food": "Food appears to be a primary attendance draw.",
        "social": "Event is community-centered with social interaction.",
        "health_wellness": "Event centers on wellness or fitness.",
        "entertainment": "Event is performance or entertainment focused.",
        "advocacy": "Event focuses on service or civic advocacy.",
        "miscellaneous": "No single category strongly dominates.",
    }[primary_category]

    return {
        "primary_category": primary_category,
        "secondary_categories": secondary,
        "interest_tags": _detect_interest_tags(blob, event),
        "audience_tags": _detect_audience_tags(blob, event),
        "content_flags": _detect_content_flags(blob, event),
        "confidence": confidence,
        "reasoning_summary": _normalize_reasoning_summary(reasoning, _DEFAULT_CLASSIFICATION["reasoning_summary"]),
    }


def _normalize_llm_payload(payload: Dict[str, Any], event: Dict[str, Any]) -> Dict[str, Any]:
    fallback = _keyword_classification(event)

    primary = _normalize_category(payload.get("primary_category")) or fallback["primary_category"]

    secondary_candidates = payload.get("secondary_categories")
    secondary: List[str] = []
    if isinstance(secondary_candidates, list):
        for raw in secondary_candidates:
            category = _normalize_category(raw)
            if category and category != primary and category not in secondary:
                secondary.append(category)

    interest_tags = _normalize_tag_list(payload.get("interest_tags"), ALLOWED_INTEREST_TAGS)
    if not interest_tags:
        interest_tags = fallback["interest_tags"]

    audience_tags = _normalize_tag_list(payload.get("audience_tags"), ALLOWED_AUDIENCE_TAGS)
    if not audience_tags:
        audience_tags = fallback["audience_tags"]

    content_flags = _normalize_tag_list(payload.get("content_flags"), ALLOWED_CONTENT_FLAGS)
    if not content_flags:
        content_flags = fallback["content_flags"]

    reasoning_summary = _normalize_reasoning_summary(payload.get("reasoning_summary"), fallback["reasoning_summary"])
    confidence = _normalize_confidence(payload.get("confidence"), fallback["confidence"])

    return {
        "primary_category": primary,
        "secondary_categories": secondary,
        "interest_tags": interest_tags,
        "audience_tags": audience_tags,
        "content_flags": content_flags,
        "confidence": confidence,
        "reasoning_summary": reasoning_summary,
    }


def _classify_with_llm(event: Dict[str, Any], models: List[str]) -> Tuple[Dict[str, Any], Optional[str]]:
    messages = build_event_classification_messages(event)
    result = llm_client.chat_completion(
        messages,
        models,
        purpose="event_classification",
        timeout_seconds=25.0,
        temperature=0.0,
        max_tokens=700,
        retry_on_invalid_json=True,
    )
    parsed = llm_client.parse_json_object(result.content)
    normalized = _normalize_llm_payload(parsed, event)
    return normalized, result.model


def classify_event(event: Dict[str, Any], allow_llm: bool = True) -> Dict[str, Any]:
    """Classify one normalized event into the fixed frontend taxonomy."""
    result, _ = classify_event_with_metadata(event, allow_llm=allow_llm)
    return result


def classify_event_with_metadata(event: Dict[str, Any], allow_llm: bool = True) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    models = llm_client.get_event_classifier_models()

    if allow_llm:
        start_index = 0
        while start_index < len(models):
            subset = models[start_index:]
            model_used: Optional[str] = None
            try:
                classification, model_used = _classify_with_llm(event, subset)
                metadata = {
                    "classifier_version": CLASSIFIER_VERSION,
                    "classification_model": model_used or subset[0],
                    "classified_at": datetime.now(timezone.utc).isoformat(),
                }
                return classification, metadata
            except Exception as exc:
                logger.warning(
                    "event_classification_llm_failed start_index=%s model_subset=%s error=%s",
                    start_index,
                    subset[:3],
                    exc,
                )
                if model_used and model_used in models:
                    start_index = models.index(model_used) + 1
                else:
                    start_index += 1

    fallback = _keyword_classification(event)
    metadata = {
        "classifier_version": CLASSIFIER_VERSION,
        "classification_model": "deterministic_rules",
        "classified_at": datetime.now(timezone.utc).isoformat(),
    }
    return fallback, metadata
