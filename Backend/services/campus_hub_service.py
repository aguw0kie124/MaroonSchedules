from __future__ import annotations

from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo
import hashlib
import html
import json
import re
import time
from typing import Any, Dict, List, Optional, Union
from urllib.request import Request, urlopen

import psycopg

from db_config import CONNECTION_PARAMS, get_pool
from repositories import course_repository, tag_repository, user_repository
from services import (
    cache_service,
    campus_events_service,
    place_registry_service,
    campus_places_service,
    local_business_events_service,
    tag_access_service,
    parking_realtime_service,
    recommendation_engine,
    notification_recommendation_service,
)
from services.rec_hours_data import REC_PLACE_ID_TO_FACILITY_KEY, weekly_payload_for_facility_key

HOWDY_URL = "https://howdy.tamu.edu/main/home/card-view"
DINING_URL = "https://eacct-tamu-sp.transactcampus.com/eAccounts/BoardTransaction.aspx"
HIRE_AGGIES_URL = "https://tamu-csm.symplicity.com/students/index.php?signin_tab=0"
AGGIE_SPIRIT_URL = "https://aggiespirit.ts.tamu.edu/RouteMap"

CONNECTOR_SYSTEMS = {
    "howdy": {
        "label": "Howdy Portal",
        "login_url": HOWDY_URL,
        "data_scope": "academics",
    },
    "transact": {
        "label": "Transact eAccounts",
        "login_url": DINING_URL,
        "data_scope": "dining",
    },
    "symplicity": {
        "label": "Hire Aggies / Symplicity",
        "login_url": HIRE_AGGIES_URL,
        "data_scope": "career",
    },
}
ACADEMIC_SNAPSHOT_TTL_SECONDS = 120
DINING_SNAPSHOT_TTL_SECONDS = 120
CAREER_SNAPSHOT_TTL_SECONDS = 300
RECREATION_SNAPSHOT_TTL_SECONDS = 120
TRANSIT_SNAPSHOT_TTL_SECONDS = 30
SERVICES_SNAPSHOT_TTL_SECONDS = 86400
PLACE_DETAIL_CACHE_VERSION = "v2"

# (Removed hardcoded REC_FACILITIES and FALL_SPRING_HOURS_BY_FACILITY - now in DB registry)
REC_PAGE_CACHE_TTL_SECONDS = 60 * 60 * 6
REC_PAGE_CACHE: Dict[str, tuple[float, Dict[str, Any]]] = {}
REC_NOTICES_CACHE_TTL_SECONDS = 60 * 30
REC_NOTICES_CACHE: Optional[Union[float, List[Dict[str, Any]]]] = None
REC_WEEKLY_HOURS_CACHE_TTL_SECONDS = 60 * 60 * 6
REC_WEEKLY_HOURS_CACHE: Dict[str, tuple[float, Dict[str, Any]]] = {}
RECREATION_SNAPSHOT_CACHE: Dict[str, tuple[float, Dict[str, Any]]] = {}
PLACE_DETAIL_CACHE_TTL_SECONDS = 60
PLACE_DETAIL_CACHE: Dict[str, tuple[float, Dict[str, Any]]] = {}


def _local_cache_get(
    cache_store: Dict[str, tuple[float, Any]],
    key: str,
    ttl_seconds: int,
) -> Any | None:
    cached = cache_store.get(key)
    if not cached:
        return None

    cached_at, payload = cached
    if time.time() - cached_at >= ttl_seconds:
        cache_store.pop(key, None)
        return None
    return payload


def _local_cache_set(
    cache_store: Dict[str, tuple[float, Any]],
    key: str,
    payload: Any,
) -> Any:
    cache_store[key] = (time.time(), payload)
    return payload


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _combine_source_status(*statuses: str | None) -> str:
    normalized = [str(status or "").strip().lower() for status in statuses if status]
    if any(status == "live" for status in normalized):
        return "live"
    if any(status == "preview" for status in normalized):
        return "preview"
    if any(status == "missing" for status in normalized):
        return "missing"
    return "preview"


DISPLAY_CATEGORY_TO_KEY = {
    "sports": "sports",
    "academic": "academic",
    "food": "food",
    "social": "social",
    "health & wellness": "health_wellness",
    "health wellness": "health_wellness",
    "health_wellness": "health_wellness",
    "entertainment": "entertainment",
    "advocacy": "advocacy",
    "miscellaneous": "miscellaneous",
}

CLASSIFICATION_CATEGORY_ORDER = (
    "sports",
    "academic",
    "food",
    "social",
    "health_wellness",
    "entertainment",
    "advocacy",
    "miscellaneous",
)

ONBOARDING_INTEREST_TO_PROFILE_TAGS = {
    "fitness": ["fitness", "wellness"],
    "sports": ["fitness"],
    "music": ["music"],
    "gaming": ["gaming"],
    "tech": ["ai", "engineering"],
    "art": ["art", "design"],
    "volunteering": ["volunteering", "community"],
    "startups": ["startup", "career"],
    "food": ["free_food"],
    "outdoors": ["outdoors"],
    "culture": ["international"],
    "faith": ["community"],
    "social": ["community"],
    "wellness": ["wellness"],
}


def _normalize_category_key(value: Any) -> Optional[str]:
    token = str(value or "").strip().lower().replace("_", " ")
    return DISPLAY_CATEGORY_TO_KEY.get(token)


def _infer_event_primary_category(event: Dict[str, Any]) -> str:
    primary = _normalize_category_key(event.get("primary_category"))
    if primary:
        return primary

    categories = event.get("categories") or {}
    if isinstance(categories, dict):
        for key in CLASSIFICATION_CATEGORY_ORDER:
            if categories.get(key):
                return key

    for key in CLASSIFICATION_CATEGORY_ORDER:
        if event.get(key):
            return key

    return "miscellaneous"


def _ensure_event_classification_metadata(event: Dict[str, Any]) -> None:
    primary = _infer_event_primary_category(event)
    event["primary_category"] = primary

    if not isinstance(event.get("secondary_categories"), list):
        categories = event.get("categories") or {}
        secondary: List[str] = []
        if isinstance(categories, dict):
            secondary = [
                key
                for key in CLASSIFICATION_CATEGORY_ORDER
                if key != primary and categories.get(key)
            ][:3]
        event["secondary_categories"] = secondary

    event.setdefault("interest_tags", [])
    event.setdefault("audience_tags", [])
    event.setdefault("content_flags", [])
    if not event.get("classification_confidence"):
        event["classification_confidence"] = 0.55
    if not event.get("classification_reasoning_summary"):
        event["classification_reasoning_summary"] = "inferred_from_existing_category_flags"
    if not event.get("classifier_version"):
        event["classifier_version"] = "event_classifier_v1"
    if not event.get("classification_model"):
        event["classification_model"] = "deterministic_rules"
    if not event.get("classified_at"):
        event["classified_at"] = _utc_now_iso()


def _preferred_time_to_windows(value: Any) -> List[str]:
    token = str(value or "").strip().lower()
    if token == "morning":
        return ["weekday_day", "weekend_day"]
    if token == "afternoon":
        return ["weekday_day", "weekend_day"]
    if token == "evening":
        return ["weekday_night", "weekend_night"]
    return ["any"]


def _build_profile_from_user_row(clerk_id: str, user: Dict[str, Any]) -> Dict[str, Any]:
    top_categories = []
    for category in user.get("preferred_event_categories") or []:
        normalized = _normalize_category_key(category)
        if normalized and normalized not in top_categories:
            top_categories.append(normalized)

    top_interest_tags: List[str] = []
    for tag in user.get("preferred_event_interests") or []:
        token = str(tag).strip().lower().replace(" ", "_")
        if not token:
            continue
        mapped = ONBOARDING_INTEREST_TO_PROFILE_TAGS.get(token, [token])
        for candidate in mapped:
            if candidate not in top_interest_tags:
                top_interest_tags.append(candidate)

    onboarding_answers = user.get("onboarding_answers") or {}
    if not top_categories:
        for category in onboarding_answers.get("preferred_sections", []):
            normalized = _normalize_category_key(category)
            if normalized and normalized not in top_categories:
                top_categories.append(normalized)

    return {
        "user_id": clerk_id,
        "top_categories": top_categories or ["miscellaneous"],
        "top_interest_tags": top_interest_tags,
        "avoid_tags": onboarding_answers.get("avoid_tags") or [],
        "preferred_time_windows": _preferred_time_to_windows(user.get("preferred_time")),
        "notification_priority_tags": onboarding_answers.get("notification_priority_tags") or top_interest_tags[:4],
        "notification_frequency": user.get("notification_frequency") or "medium",
        "profile_summary": "Profile synthesized from onboarding defaults.",
        "profile_model": "profile_fallback_from_user",
        "profile_version": "user_profile_v1",
        "profile_generated_at": _utc_now_iso(),
    }


def _build_interaction_context(clerk_id: str, events: List[Dict[str, Any]], conn: Optional[psycopg.Connection] = None) -> Dict[str, Any]:
    rows = _safe_db_fetchall(
        "SELECT event_id, response FROM campus_event_rsvps WHERE clerk_id = %s",
        (clerk_id,),
        conn=conn,
    )
    if not rows:
        return {}

    events_by_id = {str(event.get("event_id")): event for event in events if event.get("event_id")}
    positive_ids: set[str] = set()
    negative_ids: set[str] = set()
    positive_categories: set[str] = set()
    positive_tags: set[str] = set()
    hidden_ids: set[str] = set()
    dismissed_ids: set[str] = set()

    for row in rows:
        event_id = str(row.get("event_id") or "")
        response = str(row.get("response") or "").lower()
        if not event_id:
            continue
        if response in {"going", "interested", "saved", "liked"}:
            positive_ids.add(event_id)
            event = events_by_id.get(event_id)
            if event:
                primary = _normalize_category_key(event.get("primary_category"))
                if primary:
                    positive_categories.add(primary)
                for tag in event.get("interest_tags") or []:
                    value = str(tag).strip().lower().replace(" ", "_")
                    if value:
                        positive_tags.add(value)
        elif response in {"not_interested", "hidden", "dismissed", "disliked"}:
            negative_ids.add(event_id)
            if response == "hidden":
                hidden_ids.add(event_id)
            if response in {"dismissed", "not_interested", "disliked"}:
                dismissed_ids.add(event_id)

    return {
        "positive_event_ids": list(positive_ids),
        "negative_event_ids": list(negative_ids),
        "positive_categories": list(positive_categories),
        "positive_tags": list(positive_tags),
        "hidden_event_ids": list(hidden_ids),
        "dismissed_event_ids": list(dismissed_ids),
    }


def _attach_recommendation_scores(
    events: List[Dict[str, Any]],
    user_profile: Optional[Dict[str, Any]],
    interaction_context: Optional[Dict[str, Any]] = None,
) -> None:
    if not user_profile:
        return

    for event in events:
        if event.get("is_admin_event"):
            event["recommendation_score"] = 0.0
            event["for_u_match"] = False
            continue
        score = recommendation_engine.score_event_for_user(
            event,
            user_profile,
            interaction_context=interaction_context,
        )
        event["recommendation_score"] = score
        event["for_u_match"] = (
            score >= 4.5
            and recommendation_engine.is_onboarding_aligned(event, user_profile)
        )


def _score_personalized_relevance(event: Dict[str, Any], user: Dict[str, Any]) -> float:
    """Calculate a personalization boost based on user's major and preferences."""
    score = 0.0
    major = user.get("major")
    title = str(event.get("title") or "").lower()
    desc = str(event.get("description") or "").lower()
    summary = str(event.get("summary") or "").lower()
    full_text = f"{title} {desc} {summary}"

    if major:
        major_lower = str(major).lower()
        if major_lower in full_text:
            score += 50.0  # Significant boost for exact major match

        # Common major keyword mappings for tighter matching
        major_map = {
            "computer science": ["coding", "hackathon", "programming", "software", "tech", "developer", "cs"],
            "engineering": ["engineer", "technology", "design", "build", "lab", "robotics"],
            "mechanical": ["mech", "engine", "design", "machine", "manufacture"],
            "business": ["networking", "finance", "mays", "entrepreneurship", "startup", "marketing", "accounting"],
            "communication": ["journalism", "media", "writing", "reporting", "comm", "news"],
            "agriculture": ["agri", "farm", "crop", "animal", "livestock", "soil", "plant"],
            "biology": ["science", "medical", "research", "genetic", "health", "doctor"],
            "nursing": ["nurse", "hospital", "patient", "clinic", "health"],
            "psychology": ["mental health", "wellness", "counseling", "brain", "behavior"],
            "political science": ["government", "policy", "debate", "election", "law"],
            "education": ["teacher", "school", "learning", "classroom", "student"],
        }
        for m_key, keywords in major_map.items():
            if m_key in major_lower:
                if any(kw in full_text for kw in keywords):
                    score += 25.0

    # Boost based on preferred categories saved during onboarding
    prefs = user.get("preferred_event_categories") or []
    event_cats = event.get("categories", {})
    for pref in prefs:
        if event_cats.get(str(pref).lower()):
            score += 35.0

    # Boost based on user interest tags (e.g. 'Sports', 'Food')
    user_tags = set(user.get("tags") or [])
    event_tags = set(event.get("tags") or [])
    matching_tags = user_tags.intersection(event_tags)
    score += len(matching_tags) * 15.0

    return score


def _parse_event_datetime(value: Any) -> Optional[datetime]:
    if value is None:
        return None
    if isinstance(value, datetime):
        parsed = value
    elif isinstance(value, str):
        normalized = value.strip()
        if not normalized:
            return None
        if normalized.endswith("Z"):
            normalized = f"{normalized[:-1]}+00:00"
        try:
            parsed = datetime.fromisoformat(normalized)
        except ValueError:
            return None
    else:
        return None

    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed


def _is_event_upcoming(event: Dict[str, Any], now: Optional[datetime] = None) -> bool:
    reference_time = now or datetime.now(timezone.utc)
    relevant_time = _parse_event_datetime(event.get("end_time")) or _parse_event_datetime(event.get("start_time"))
    if relevant_time is None:
        return True
    # Allow events that started/ended within the last 72 hours for discovery and timezone padding
    return relevant_time >= (reference_time - timedelta(hours=72))


def _is_admin_event_visible(event: Dict[str, Any], now: Optional[datetime] = None) -> bool:
    reference_time = now or datetime.now(timezone.utc)
    end_time = _parse_event_datetime(event.get("end_time"))
    if end_time is not None and end_time >= reference_time:
        return True

    start_time = _parse_event_datetime(event.get("start_time"))
    if start_time is None:
        return True

    # Featured/admin events should stay around briefly after kickoff, but not for multiple days.
    return start_time >= (reference_time - timedelta(hours=24))


def _event_start_sort_key(event: Dict[str, Any]) -> tuple[int, float]:
    start_time = _parse_event_datetime(event.get("start_time"))
    if start_time is None:
        return 0, 0.0
    return 1, start_time.timestamp()


def _get_admin_event_categories(title: str, description: str, tags: List[str]) -> Dict[str, int]:
    """Dynamically assign categories based on content and tags."""
    blob = (title + " " + (description or "") + " " + " ".join(tags)).lower()
    categories = {
        "featured": 1,
        "social": 0,
        "sports": 0,
        "academic": 0,
        "food": 0,
        "advocacy": 0,
        "entertainment": 0,
        "health_wellness": 0,
        "miscellaneous": 0,
    }

    if any(kw in blob for kw in ["sport", "game", "match", "tournament", "athletic", "ncaa", "espn"]):
        categories["sports"] = 1
    if any(kw in blob for kw in ["lecture", "seminar", "research", "study", "academic", "workshop", "colloquium", "thesis", "dissertation"]):
        categories["academic"] = 1
    if any(kw in blob for kw in ["food", "meal", "dinner", "lunch", "breakfast", "pizza", "refreshments", "catering"]):
        categories["food"] = 1
    if any(kw in blob for kw in ["social", "mixer", "meetup", "party", "hangout", "organization fair", "student org"]):
        categories["social"] = 1
    if any(kw in blob for kw in ["concert", "show", "performance", "movie", "film", "theatre", "theater", "dance", "talent"]):
        categories["entertainment"] = 1
    if any(kw in blob for kw in ["wellness", "health", "yoga", "mental", "meditation", "self-care", "therapy"]):
        categories["health_wellness"] = 1
    if any(kw in blob for kw in ["advocacy", "activism", "awareness", "volunteer", "service", "march", "rally"]):
        categories["advocacy"] = 1

    # If no topic assigned, mark as miscellaneous
    if not any(v for k, v in categories.items() if k != "featured"):
        categories["miscellaneous"] = 1

    return categories


def _merge_admin_events_before_limit(events: List[Dict[str, Any]], limit: int) -> List[Dict[str, Any]]:
    """Keep admin portal events in the payload when trimming — plain [:limit] can drop them behind thousands of crawler rows."""
    if not limit or len(events) <= limit:
        return events
    admin_events = [e for e in events if e.get("is_admin_event")]
    regular_events = [e for e in events if not e.get("is_admin_event")]
    if len(admin_events) >= limit:
        return admin_events[:limit]
    return admin_events + regular_events[: limit - len(admin_events)]


def _safe_db_fetchone(query: str, params: tuple = (), conn: Optional[psycopg.Connection] = None) -> Optional[Dict[str, Any]]:
    try:
        if conn:
            with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
                cur.execute(query, params)
                return cur.fetchone()
        with get_pool().connection() as new_conn:
            with new_conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
                cur.execute(query, params)
                return cur.fetchone()
    except Exception:
        return None


def _safe_db_fetchall(query: str, params: tuple = (), conn: Optional[psycopg.Connection] = None) -> List[Dict[str, Any]]:
    try:
        if conn:
            with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
                cur.execute(query, params)
                return cur.fetchall() or []
        with get_pool().connection() as new_conn:
            with new_conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
                cur.execute(query, params)
                return cur.fetchall() or []
    except Exception:
        return []


def _ensure_social_tables(conn: Optional[psycopg.Connection] = None) -> None:
    try:
        def run_schema(c):
            with c.cursor() as cur:
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS network_connections (
                        requester_id TEXT NOT NULL,
                        recipient_id TEXT NOT NULL,
                        status TEXT NOT NULL DEFAULT 'pending',
                        updated_at TIMESTAMPTZ DEFAULT NOW(),
                        PRIMARY KEY (requester_id, recipient_id)
                    )
                    """
                )
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS campus_event_rsvps (
                        clerk_id TEXT NOT NULL,
                        event_id TEXT NOT NULL,
                        response TEXT NOT NULL,
                        updated_at TIMESTAMPTZ DEFAULT NOW(),
                        PRIMARY KEY (clerk_id, event_id)
                    )
                    """
                )
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS campus_connector_snapshots (
                        clerk_id TEXT NOT NULL,
                        system_id TEXT NOT NULL,
                        status TEXT NOT NULL DEFAULT 'connected',
                        source_url TEXT,
                        page_title TEXT,
                        page_html TEXT,
                        page_text TEXT,
                        cookie_names JSONB DEFAULT '[]'::jsonb,
                        captured_at TIMESTAMPTZ DEFAULT NOW(),
                        updated_at TIMESTAMPTZ DEFAULT NOW(),
                        PRIMARY KEY (clerk_id, system_id)
                    )
                    """
                )
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS place_reviews (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        place_id TEXT NOT NULL,
                        user_id TEXT NOT NULL,
                        user_name TEXT,
                        user_image TEXT,
                        rating INTEGER,
                        title TEXT,
                        body TEXT,
                        images TEXT[] DEFAULT '{}',
                        created_at TIMESTAMPTZ DEFAULT NOW(),
                        updated_at TIMESTAMPTZ DEFAULT NOW(),
                        is_anonymous BOOLEAN DEFAULT FALSE
                    )
                    """
                )
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS crowdping_posts (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        user_id TEXT NOT NULL,
                        user_name TEXT,
                        user_image TEXT,
                        content TEXT,
                        lat DOUBLE PRECISION,
                        lng DOUBLE PRECISION,
                        location_tag TEXT,
                        event_id TEXT,
                        images TEXT[] DEFAULT '{}',
                        is_anonymous BOOLEAN DEFAULT FALSE,
                        visibility TEXT DEFAULT 'public',
                        post_type TEXT DEFAULT 'post',
                        custom_data JSONB DEFAULT '{}'::jsonb,
                        created_at TIMESTAMPTZ DEFAULT NOW()
                    )
                    """
                )
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS post_interactions (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        post_id TEXT NOT NULL,
                        post_type TEXT NOT NULL,
                        user_id TEXT NOT NULL,
                        type TEXT NOT NULL,
                        comment_text TEXT,
                        user_name TEXT,
                        user_image TEXT,
                        parent_id UUID REFERENCES post_interactions(id) ON DELETE CASCADE,
                        created_at TIMESTAMPTZ DEFAULT NOW()
                    )
                    """
                )
                cur.execute(
                    "ALTER TABLE post_interactions ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES post_interactions(id) ON DELETE CASCADE"
                )
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS blocked_users (
                        blocker_id TEXT NOT NULL,
                        blocked_id TEXT NOT NULL,
                        created_at TIMESTAMPTZ DEFAULT NOW(),
                        PRIMARY KEY (blocker_id, blocked_id)
                    )
                    """
                )
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS content_reports (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        reporter_clerk_id TEXT NOT NULL,
                        reportee_clerk_id TEXT NOT NULL,
                        post_type TEXT,
                        post_id TEXT,
                        place_id TEXT,
                        reason TEXT,
                        comment TEXT,
                        created_at TIMESTAMPTZ DEFAULT NOW()
                    )
                    """
                )
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS admin_event_subscriptions (
                        user_clerk_id TEXT NOT NULL,
                        admin_clerk_id TEXT NOT NULL,
                        muted BOOLEAN NOT NULL DEFAULT TRUE,
                        updated_at TIMESTAMPTZ DEFAULT NOW(),
                        PRIMARY KEY (user_clerk_id, admin_clerk_id)
                    )
                    """
                )
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS campus_event_notifications (
                        clerk_id TEXT NOT NULL,
                        event_id TEXT NOT NULL,
                        recommendation_score DOUBLE PRECISION,
                        notified_at TIMESTAMPTZ DEFAULT NOW(),
                        PRIMARY KEY (clerk_id, event_id)
                    )
                    """
                )
            c.commit()

        if conn:
            run_schema(conn)
        else:
            with get_pool().connection() as new_conn:
                run_schema(new_conn)
    except Exception:
        pass


def _extract_money(text: str) -> Optional[str]:
    match = re.search(r"\$[\d,]+(?:\.\d{2})?", text)
    return match.group(0) if match else None


def _extract_value_after_keywords(text: str, keywords: List[str]) -> Optional[str]:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    for index, line in enumerate(lines):
        lowered = line.lower()
        if any(keyword.lower() in lowered for keyword in keywords):
            if index + 1 < len(lines):
                next_line = lines[index + 1].strip()
                if next_line:
                    return next_line
            inline_match = re.search(r":\s*(.+)$", line)
            if inline_match:
                return inline_match.group(1).strip()
    return None


def _clean_html_text(value: str) -> str:
    no_tags = re.sub(r"<[^>]+>", " ", value or "", flags=re.IGNORECASE)
    return re.sub(r"\s+", " ", html.unescape(no_tags)).strip()


def _extract_section_html(source_html: str, start_marker: str, end_markers: List[str]) -> str:
    lowered = source_html.lower()
    start_index = lowered.find(start_marker.lower())
    if start_index == -1:
        return ""

    remainder = source_html[start_index:]
    remainder_lower = remainder.lower()
    end_candidates = [
        remainder_lower.find(marker.lower())
        for marker in end_markers
        if remainder_lower.find(marker.lower()) != -1
    ]
    end_index = min(end_candidates) if end_candidates else len(remainder)
    return remainder[:end_index]


def _extract_hours_hint_from_html(source_html: str) -> Optional[str]:
    hours_section = _extract_section_html(
        source_html,
        "Hours of Operation",
        ["Facility Includes", "Facility Rules", "Reservation", "Questions"],
    )
    cleaned = _clean_html_text(hours_section)
    if not cleaned:
        return None

    explicit_ranges = re.findall(
        r"\b\d{1,2}:\d{2}\s*(?:AM|PM)\s*[–-]\s*\d{1,2}:\d{2}\s*(?:AM|PM)\b",
        cleaned,
        flags=re.IGNORECASE,
    )
    if explicit_ranges:
        return "Hours: " + " · ".join(explicit_ranges[:2])

    if "hours of operation" in cleaned.lower():
        return "Hours listed on official facility page"
    return None


def _extract_amenities_from_html(source_html: str) -> List[str]:
    facilities_section = _extract_section_html(
        source_html,
        "Facility Includes",
        ["Facility Rules", "Reservation", "Questions"],
    )
    if not facilities_section:
        return []

    heading_matches = re.findall(r"<h4[^>]*>(.*?)</h4>", facilities_section, flags=re.IGNORECASE | re.DOTALL)
    amenities: List[str] = []
    for match in heading_matches:
        cleaned = _clean_html_text(match)
        if cleaned and cleaned.lower() != "facility includes:" and cleaned not in amenities:
            amenities.append(cleaned)
        if len(amenities) >= 4:
            break

    if amenities:
        return amenities

    bullet_matches = re.findall(r"<li[^>]*>(.*?)</li>", facilities_section, flags=re.IGNORECASE | re.DOTALL)
    for match in bullet_matches:
        cleaned = _clean_html_text(match)
        if cleaned and cleaned not in amenities:
            amenities.append(cleaned)
        if len(amenities) >= 4:
            break
    return amenities


def _extract_summary_from_html(source_html: str) -> Optional[str]:
    paragraphs = re.findall(r"<p[^>]*>(.*?)</p>", source_html, flags=re.IGNORECASE | re.DOTALL)
    for paragraph in paragraphs:
        cleaned = _clean_html_text(paragraph)
        if len(cleaned) >= 60:
            return cleaned
    return None


def _weekly_hours_for_facility(facility_id: str) -> Dict[str, Any]:
    cached = _local_cache_get(REC_WEEKLY_HOURS_CACHE, facility_id, REC_WEEKLY_HOURS_CACHE_TTL_SECONDS)
    if cached is not None:
        return cached

    now_chi = datetime.now(ZoneInfo("America/Chicago"))
    payload = weekly_payload_for_facility_key(facility_id, now_chi)
    return _local_cache_set(REC_WEEKLY_HOURS_CACHE, facility_id, payload)


def _fetch_rec_facility_page_details(source_url: str) -> Dict[str, Any]:
    cached = _local_cache_get(REC_PAGE_CACHE, source_url, REC_PAGE_CACHE_TTL_SECONDS)
    if cached is not None:
        return cached

    details = {
        "summary": None,
        "hours_hint": None,
        "amenities": [],
    }
    try:
        request = Request(source_url, headers={"User-Agent": "Mozilla/5.0 MaroonSchedules/1.0"})
        with urlopen(request, timeout=3) as response:
            source_html = response.read().decode("utf-8", errors="ignore")

        details = {
            "summary": _extract_summary_from_html(source_html),
            "hours_hint": _extract_hours_hint_from_html(source_html),
            "amenities": _extract_amenities_from_html(source_html),
        }
    except Exception:
        pass

    return _local_cache_set(REC_PAGE_CACHE, source_url, details)


def _extract_notification_window(label: str) -> str:
    cleaned = re.sub(r"\s+", " ", label or "").strip()
    return cleaned or "See official notices"


def _fetch_rec_notices() -> List[Dict[str, Any]]:
    global REC_NOTICES_CACHE
    now = time.time()
    if REC_NOTICES_CACHE and now - REC_NOTICES_CACHE[0] < REC_NOTICES_CACHE_TTL_SECONDS:
        return REC_NOTICES_CACHE[1]

    notices: List[Dict[str, Any]] = []
    try:
        request = Request("https://recsports.tamu.edu/", headers={"User-Agent": "Mozilla/5.0 MaroonSchedules/1.0"})
        with urlopen(request, timeout=4) as response:
            source_html = response.read().decode("utf-8", errors="ignore")

        section = _extract_section_html(source_html, "# Notifications", ["# 100 Years of Texas A&M Rec Sports", "# Hours of Operation", "# Rec Sports Programs"])
        headings = re.findall(r"<h2[^>]*>(.*?)</h2>", section, flags=re.IGNORECASE | re.DOTALL)
        paragraphs = re.findall(r"<p[^>]*>(.*?)</p>", section, flags=re.IGNORECASE | re.DOTALL)

        facility_keywords = {
            "student-rec": ["student rec center", "rec center", "the rec"],
            "southside-rec": ["southside rec center"],
            "polo-road-rec": ["polo road rec center", "polo road"],
            "penberthy": ["penberthy"],
            "peap": ["peap", "physical education academic building"],
            "tennis-center": ["tennis center", "omar smith"],
        }

        for index, paragraph in enumerate(paragraphs):
            cleaned = _clean_html_text(paragraph)
            lowered = cleaned.lower()
            if len(cleaned) < 24:
                continue

            impacted = [
                facility_id
                for facility_id, keywords in facility_keywords.items()
                if any(keyword in lowered for keyword in keywords)
            ]
            if "football" in lowered or "home game" in lowered:
                impacted = list(facility_keywords.keys())

            if not impacted:
                continue

            notices.append(
                {
                    "window": _extract_notification_window(headings[index] if index < len(headings) else ""),
                    "detail": cleaned,
                    "facility_ids": impacted,
                }
            )
    except Exception:
        notices = []

    REC_NOTICES_CACHE = (now, notices)
    return notices


def _is_likely_authenticated_capture(
    system_id: str,
    source_url: Optional[str],
    page_title: Optional[str],
    page_text: Optional[str],
) -> bool:
    connector = CONNECTOR_SYSTEMS.get(system_id) or {}
    login_url = (connector.get("login_url") or "").rstrip("/")
    current_url = (source_url or "").rstrip("/")
    haystack = " ".join([source_url or "", page_title or "", page_text or ""]).lower()

    positive_terms = {
        "howdy": ["gpa", "gpr", "registration", "holds", "schedule", "class", "course"],
        "transact": ["dining dollars", "meal plan", "board plan", "transaction", "balance"],
        "symplicity": ["jobs", "applications", "employers", "career fair", "recommended jobs", "interviews"],
    }.get(system_id, [])
    negative_terms = ["sign in", "signin", "log in", "login", "password", "netid", "username"]

    has_positive_signal = any(term in haystack for term in positive_terms)
    looks_like_login = any(term in haystack for term in negative_terms)
    url_changed = bool(current_url and login_url and current_url != login_url)

    if has_positive_signal:
        return True
    if looks_like_login and not url_changed:
        return False
    return url_changed and len(page_text or "") > 500


def _connector_row_to_dict(row: Dict[str, Any]) -> Dict[str, Any]:
    cookie_names = row.get("cookie_names")
    if isinstance(cookie_names, str):
        try:
            cookie_names = json.loads(cookie_names)
        except Exception:
            cookie_names = []

    base = CONNECTOR_SYSTEMS.get(row.get("system_id"), {})
    return {
        "system_id": row.get("system_id"),
        "label": base.get("label", row.get("system_id")),
        "status": row.get("status", "connected"),
        "login_url": base.get("login_url"),
        "data_scope": base.get("data_scope"),
        "source_url": row.get("source_url"),
        "page_title": row.get("page_title"),
        "cookie_names": cookie_names or [],
        "captured_at": row.get("captured_at").isoformat() if row.get("captured_at") else None,
        "updated_at": row.get("updated_at").isoformat() if row.get("updated_at") else None,
    }


def get_connector_snapshots(clerk_id: str, conn: Optional[psycopg.Connection] = None) -> List[Dict[str, Any]]:
    _ensure_social_tables(conn)
    rows = _safe_db_fetchall(
        """
        SELECT clerk_id, system_id, status, source_url, page_title, cookie_names, captured_at, updated_at
        FROM campus_connector_snapshots
        WHERE clerk_id = %s
        ORDER BY updated_at DESC
        """,
        (clerk_id,),
        conn=conn,
    )
    snapshots = [_connector_row_to_dict(row) for row in rows]
    known = {snapshot["system_id"] for snapshot in snapshots}
    for system_id, config in CONNECTOR_SYSTEMS.items():
        if system_id not in known:
            snapshots.append(
                {
                    "system_id": system_id,
                    "label": config["label"],
                    "status": "disconnected",
                    "login_url": config["login_url"],
                    "data_scope": config["data_scope"],
                    "source_url": None,
                    "page_title": None,
                    "cookie_names": [],
                    "captured_at": None,
                    "updated_at": None,
                }
            )
    return snapshots


def _latest_connector_snapshot(clerk_id: str, system_id: str, conn: Optional[psycopg.Connection] = None) -> Optional[Dict[str, Any]]:
    _ensure_social_tables(conn)
    row = _safe_db_fetchone(
        """
        SELECT clerk_id, system_id, status, source_url, page_title, page_html, page_text, cookie_names, captured_at, updated_at
        FROM campus_connector_snapshots
        WHERE clerk_id = %s AND system_id = %s
        """,
        (clerk_id, system_id),
        conn=conn,
    )
    return row


def capture_connector_snapshot(
    clerk_id: str,
    system_id: str,
    source_url: str,
    page_title: Optional[str],
    page_html: Optional[str],
    page_text: Optional[str],
    cookie_names: Optional[List[str]],
) -> Dict[str, Any]:
    _ensure_social_tables()
    if system_id not in CONNECTOR_SYSTEMS:
        return {"status": "error", "message": "Unknown connector system"}

    status_value = (
        "connected"
        if _is_likely_authenticated_capture(system_id, source_url, page_title, page_text)
        else "awaiting_login"
    )

    try:
        with get_pool().connection() as conn:
            with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
                cur.execute(
                    """
                    INSERT INTO campus_connector_snapshots
                    (clerk_id, system_id, status, source_url, page_title, page_html, page_text, cookie_names, captured_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s::jsonb, NOW(), NOW())
                    ON CONFLICT (clerk_id, system_id) DO UPDATE SET
                        status = EXCLUDED.status,
                        source_url = EXCLUDED.source_url,
                        page_title = EXCLUDED.page_title,
                        page_html = EXCLUDED.page_html,
                        page_text = EXCLUDED.page_text,
                        cookie_names = EXCLUDED.cookie_names,
                        captured_at = NOW(),
                        updated_at = NOW()
                    RETURNING clerk_id, system_id, status, source_url, page_title, cookie_names, captured_at, updated_at
                    """,
                    (
                        clerk_id,
                        system_id,
                        status_value,
                        source_url,
                        page_title,
                        page_html,
                        page_text,
                        json.dumps(cookie_names or []),
                    ),
                )
                row = cur.fetchone()
            conn.commit()
        payload = _connector_row_to_dict(row)
        if status_value == "connected":
            payload["parsed_preview"] = parse_connector_snapshot(clerk_id, system_id)
        else:
            payload["message"] = "Login is still in progress. Keep going until your campus data page is visible."
        return payload
    except Exception as exc:
        return {"status": "error", "message": str(exc)}


def delete_connector_snapshot(clerk_id: str, system_id: str) -> Dict[str, Any]:
    _ensure_social_tables()
    try:
        with get_pool().connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "DELETE FROM campus_connector_snapshots WHERE clerk_id = %s AND system_id = %s",
                    (clerk_id, system_id),
                )
            conn.commit()
        return {"status": "success", "clerk_id": clerk_id, "system_id": system_id}
    except Exception as exc:
        return {"status": "error", "message": str(exc)}


def _parse_howdy_snapshot(snapshot: Dict[str, Any]) -> Dict[str, Any]:
    text = snapshot.get("page_text") or ""
    gpa_match = re.search(r"(?:GPA|GPR)\s*[: ]\s*([0-4]\.\d{1,2})", text, re.IGNORECASE)
    holds = []
    for line in text.splitlines():
        if "hold" in line.lower() and len(line.strip()) < 120:
            holds.append(line.strip())
    course_codes = re.findall(r"\b[A-Z]{2,5}\s?\d{3}\b", text)
    unique_courses = []
    seen = set()
    for code in course_codes:
        normalized = " ".join(code.split())
        if normalized not in seen:
            seen.add(normalized)
            unique_courses.append(normalized)
        if len(unique_courses) >= 6:
            break
    return {
        "gpa": gpa_match.group(1) if gpa_match else None,
        "holds": holds[:5],
        "course_codes": unique_courses,
        "page_title": snapshot.get("page_title"),
    }


def _parse_transact_snapshot(snapshot: Dict[str, Any]) -> Dict[str, Any]:
    text = snapshot.get("page_text") or ""
    plan_name = _extract_value_after_keywords(text, ["Meal Plan", "Plan", "Board Plan"])
    dining_dollars = None
    for line in text.splitlines():
        lowered = line.lower()
        if "dining dollars" in lowered or "balance" in lowered:
            dining_dollars = _extract_money(line)
            if dining_dollars:
                break
    recent_transaction = _extract_value_after_keywords(text, ["Recent Transactions", "Transaction History", "Last Transaction"])
    return {
        "plan_name": plan_name,
        "balance": dining_dollars,
        "recent_transaction": recent_transaction,
        "page_title": snapshot.get("page_title"),
    }


def _parse_symplicity_snapshot(snapshot: Dict[str, Any]) -> Dict[str, Any]:
    text = snapshot.get("page_text") or ""
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    job_titles: List[str] = []
    capture = False
    for line in lines:
        lowered = line.lower()
        if any(keyword in lowered for keyword in ["jobs", "recommended jobs", "opportunities"]):
            capture = True
            continue
        if capture:
            if len(line) > 4 and len(line) < 90 and not any(stop in lowered for stop in ["employers", "career fair", "events", "filters"]):
                job_titles.append(line)
            if len(job_titles) >= 5:
                break
    return {
        "job_titles": job_titles,
        "event_hint": _extract_value_after_keywords(text, ["Upcoming Events", "Career Events", "Events"]),
        "page_title": snapshot.get("page_title"),
    }


def parse_connector_snapshot(clerk_id: str, system_id: str, conn: Optional[psycopg.Connection] = None) -> Dict[str, Any]:
    snapshot = _latest_connector_snapshot(clerk_id, system_id, conn=conn)
    if not snapshot or snapshot.get("status") != "connected":
        return {}
    if system_id == "howdy":
        return _parse_howdy_snapshot(snapshot)
    if system_id == "transact":
        return _parse_transact_snapshot(snapshot)
    if system_id == "symplicity":
        return _parse_symplicity_snapshot(snapshot)
    return {}


def _event_id_for(event: Dict[str, Any]) -> str:
    seed = f"{event.get('title', '')}|{event.get('start_time', '')}|{event.get('location', '')}|{event.get('link', '')}"
    return hashlib.sha1(seed.encode("utf-8")).hexdigest()[:16]


def _time_to_minutes(time_string: Optional[str]) -> int:
    if not time_string or " " not in time_string:
        return 10**9
    clock, period = time_string.split(" ", 1)
    try:
        hours, minutes = [int(part) for part in clock.split(":")]
    except Exception:
        return 10**9
    if period.upper() == "PM" and hours != 12:
        hours += 12
    if period.upper() == "AM" and hours == 12:
        hours = 0
    return hours * 60 + minutes


def _today_code() -> str:
    return ["U", "M", "T", "W", "R", "F", "S"][datetime.now().weekday() + 1 if datetime.now().weekday() < 6 else 0]


def _expand_schedule_sections(schedule: Dict[str, Any]) -> List[Dict[str, Any]]:
    expanded_sections: List[Dict[str, Any]] = []
    for section_id in schedule.get("section_ids", []):
        section = course_repository.get_section_by_id(section_id)
        if section:
            expanded_sections.append(section)
    return expanded_sections


def _normalize_academic_courses(sections: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    courses: List[Dict[str, Any]] = []
    for section in sections:
        meeting = (section.get("meetings") or [{}])[0]
        instructor = ((section.get("instructors") or [{}])[0] or {}).get("name", "Instructor TBA")
        courses.append(
            {
                "id": str(section.get("id") or section.get("section_id") or section.get("sectionNumber") or ""),
                "code": f"{section.get('dept', '')} {section.get('courseNumber', '')}".strip() or f"Section {section.get('sectionNumber', 'TBA')}",
                "name": section.get("courseTitle") or "Untitled Course",
                "time": f"{meeting.get('beginTime', 'TBA')}-{meeting.get('endTime', 'TBA')}",
                "beginTime": meeting.get("beginTime"),
                "endTime": meeting.get("endTime"),
                "days": meeting.get("daysOfWeek") or [],
                "location": f"{meeting.get('building', '')} {meeting.get('room', '')}".strip() or "Location TBA",
                "instructor": instructor,
                "credits": float(section.get("credit_hours") or section.get("creditHours") or 3),
                "resources": [
                    {"label": "Course Details", "path": f"/courses/{section.get('course') or section.get('dept', '') + str(section.get('courseNumber', ''))}"},
                ],
            }
        )
    return courses


def _pick_next_course(courses: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    today = ["U", "M", "T", "W", "R", "F", "S"][datetime.now().weekday() + 1 if datetime.now().weekday() < 6 else 0]
    now_minutes = datetime.now().hour * 60 + datetime.now().minute
    sorted_courses = sorted(
        [course for course in courses if today in course.get("days", [])],
        key=lambda course: _time_to_minutes(course.get("beginTime")),
    )
    for course in sorted_courses:
        if _time_to_minutes(course.get("beginTime")) > now_minutes:
            return course
    return None


def get_auth_status(clerk_id: str, conn: Optional[psycopg.Connection] = None) -> Dict[str, Any]:
    connector_states = get_connector_snapshots(clerk_id, conn=conn)
    return {
        "status": "app_authenticated",
        "primary_auth": "Clerk",
        "institution_sso": {
            "provider": "Howdy / NetID",
            "status": "connected" if any(item["status"] == "connected" for item in connector_states) else "connector_required",
            "note": "Institution-owned credentials are handled through the in-app connector browser and captured session state.",
            "resource_url": HOWDY_URL,
        },
        "user_id": clerk_id,
        "connectors": connector_states,
    }


def get_academic_snapshot(clerk_id: str, conn: Optional[psycopg.Connection] = None) -> Dict[str, Any]:
    profile = user_repository.get_user(clerk_id) or {}
    schedules = user_repository.get_schedules(clerk_id) or []
    primary_schedule = schedules[0] if schedules else {"name": "Schedule unavailable", "section_ids": []}
    howdy_snapshot = parse_connector_snapshot(clerk_id, "howdy", conn=conn)
    sections = _expand_schedule_sections(primary_schedule)
    courses = _normalize_academic_courses(sections)
    next_course = _pick_next_course(courses)

    avg_gpa_values = [
        float(section.get("avg_gpa"))
        for section in sections
        if section.get("avg_gpa") not in (None, "")
    ]
    gpa_indicator = round(sum(avg_gpa_values) / len(avg_gpa_values), 2) if avg_gpa_values else None
    holds = profile.get("holds") if isinstance(profile.get("holds"), list) else []
    derived_holds = howdy_snapshot.get("holds") if isinstance(howdy_snapshot.get("holds"), list) else []
    derived_courses = howdy_snapshot.get("course_codes") if isinstance(howdy_snapshot.get("course_codes"), list) else []

    return {
        "generated_at": _utc_now_iso(),
        "stale_after": ACADEMIC_SNAPSHOT_TTL_SECONDS,
        "source_status": "live" if courses or howdy_snapshot else "preview",
        "status": "live" if courses or howdy_snapshot else "preview",
        "sourceLabel": "Primary schedule loaded from MaroonSchedules storage" if courses else ("Captured from connected Howdy session" if howdy_snapshot else "Connect Howdy to load registrar details directly"),
        "scheduleName": primary_schedule.get("name", "Schedule unavailable"),
        "courses": courses,
        "totalCredits": round(sum(course.get("credits", 0) for course in courses), 1),
        "nextCourse": next_course,
        "gpa": howdy_snapshot.get("gpa") or (str(gpa_indicator) if gpa_indicator is not None else "Connect Howdy"),
        "gpaIndicatorType": "captured_howdy_session" if howdy_snapshot.get("gpa") else ("section_avg_projection" if gpa_indicator is not None else "external_connector_required"),
        "gradesStatus": "captured_from_howdy" if howdy_snapshot else "available_from_howdy_connector",
        "registrationReady": len(holds or derived_holds) == 0,
        "activeHolds": holds or derived_holds,
        "capturedCourseCodes": derived_courses,
        "resources": [
            {"label": "Howdy Portal", "url": HOWDY_URL},
        ],
    }


def get_dining_snapshot(clerk_id: str, conn: Optional[psycopg.Connection] = None) -> Dict[str, Any]:
    profile = _safe_db_fetchone("SELECT * FROM dining_profiles WHERE clerk_id = %s", (clerk_id,), conn=conn)
    transact_snapshot = parse_connector_snapshot(clerk_id, "transact", conn=conn)

    if transact_snapshot:
        return {
            "generated_at": _utc_now_iso(),
            "stale_after": DINING_SNAPSHOT_TTL_SECONDS,
            "source_status": "live",
            "status": "live",
            "planName": transact_snapshot.get("plan_name") or "Captured from Transact eAccounts",
            "balanceLabel": transact_snapshot.get("balance") or "Balance not detected on the captured page yet",
            "recentActivityLabel": transact_snapshot.get("recent_transaction") or "Open your transaction history in Transact and refresh this connector to capture the latest activity.",
            "profile": {
                "targetCalories": profile.get("target_calories") if profile else None,
                "goalWeight": profile.get("goal_weight_lbs") if profile else None,
                "activityLevel": profile.get("activity_level") if profile else None,
            },
            "resources": [
                {"label": "Transact eAccounts", "url": DINING_URL},
            ],
        }

    if profile:
        return {
            "generated_at": _utc_now_iso(),
            "stale_after": DINING_SNAPSHOT_TTL_SECONDS,
            "source_status": "preview",
            "status": "preview",
            "planName": "Dining profile loaded",
            "balanceLabel": "Live meal-plan balances still require Transact eAccounts connection",
            "recentActivityLabel": f"Nutrition mode: {profile.get('mode', 'maintain')} · Activity level: {profile.get('activity_level', 'moderate')}",
            "profile": {
                "targetCalories": profile.get("target_calories"),
                "goalWeight": profile.get("goal_weight_lbs"),
                "activityLevel": profile.get("activity_level"),
            },
            "resources": [
                {"label": "Transact eAccounts", "url": DINING_URL},
            ],
        }

    return {
        "generated_at": _utc_now_iso(),
        "stale_after": DINING_SNAPSHOT_TTL_SECONDS,
        "source_status": "link",
        "status": "link",
        "planName": "Dining account ready to connect",
        "balanceLabel": "Open Transact eAccounts to view live balances",
        "recentActivityLabel": "Dining balances and transaction history need institution-backed SSO.",
        "resources": [
            {"label": "Transact eAccounts", "url": DINING_URL},
        ],
    }


def discover_network(clerk_id: str, query: Optional[str] = None, major: Optional[str] = None, limit: int = 8, conn: Optional[psycopg.Connection] = None) -> Dict[str, Any]:
    _ensure_social_tables(conn)
    profile = user_repository.get_user(clerk_id) or {}
    query_text = f"%{(query or '').strip()}%"
    profile_major = major or profile.get("major") or ""
    current_year = datetime.now().year

    where_parts = ["clerk_id <> %s"]
    params: List[Any] = [clerk_id]
    if profile_major:
        where_parts.append("(major ILIKE %s OR %s = '')")
        params.extend([f"%{profile_major}%", profile_major])
    if query:
        where_parts.append("(full_name ILIKE %s OR email ILIKE %s OR major ILIKE %s)")
        params.extend([query_text, query_text, query_text])

    sql = f"""
        SELECT clerk_id, full_name, email, profile_image_url, major, graduation_year
        FROM users
        WHERE {' AND '.join(where_parts)}
        ORDER BY updated_at DESC
        LIMIT %s
    """
    params.append(limit)
    rows = _safe_db_fetchall(sql, tuple(params), conn=conn)

    suggestions = []
    for row in rows:
        graduation_year = row.get("graduation_year") or ""
        is_alumni = graduation_year.isdigit() and int(graduation_year) < current_year
        suggestions.append(
            {
                "clerk_id": row.get("clerk_id"),
                "name": row.get("full_name") or row.get("email") or "Aggie",
                "major": row.get("major") or "Major not set",
                "graduation_year": graduation_year or "N/A",
                "image_url": row.get("profile_image_url"),
                "relationship": "alumni" if is_alumni else "peer",
            }
        )

    pending_requests = _safe_db_fetchall(
        "SELECT requester_id, recipient_id, status FROM network_connections WHERE (requester_id = %s OR recipient_id = %s) AND status = 'pending'",
        (clerk_id, clerk_id),
        conn=conn,
    )

    return {
        "generated_at": _utc_now_iso(),
        "stale_after": 300,
        "source_status": "live" if suggestions else "preview",
        "status": "live" if suggestions else "preview",
        "chatStatus": "stream_messaging_available",
        "summary": "Discover peers and alumni from the shared campus profile layer.",
        "pendingRequests": len(pending_requests),
        "suggestions": suggestions,
        "resources": [
            {"label": "Social Hub", "path": "/social"},
            {"label": "Hire Aggies", "url": HIRE_AGGIES_URL},
        ],
    }


def create_connection_request(requester_id: str, recipient_id: str) -> Dict[str, Any]:
    _ensure_social_tables()
    if requester_id == recipient_id:
        return {"status": "error", "message": "Cannot connect to yourself"}

    try:
        with get_pool().connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO network_connections (requester_id, recipient_id, status, updated_at)
                    VALUES (%s, %s, 'pending', NOW())
                    ON CONFLICT (requester_id, recipient_id) DO UPDATE SET status = 'pending', updated_at = NOW()
                    """,
                    (requester_id, recipient_id),
                )
            conn.commit()
        return {"status": "success", "requester_id": requester_id, "recipient_id": recipient_id}
    except Exception as exc:
        return {"status": "error", "message": str(exc)}


def get_events_snapshot(
    clerk_id: Optional[str] = None,
    limit: int = 100,
    category: Optional[str] = None,
    student_relevant_only: bool = False,
    campus: str = "tamu",
    include_off_campus: bool = False,
    conn: Optional[psycopg.Connection] = None,
    force_refresh: bool = False,
) -> Dict[str, Any]:
    _ensure_social_tables(conn)
    rsvp_lookup: Dict[str, str] = {}
    blocked_ids: set[str] = set()
    muted_admin_ids: set[str] = set()
    bypass_tag_restrictions = False
    user_access_tags: list[str] = []
    user: Dict[str, Any] = {}
    user_preference_profile: Optional[Dict[str, Any]] = None
    if clerk_id:
        user = user_repository.get_user(clerk_id) or {}
        user_preference_profile = user_repository.get_user_preference_profile(clerk_id)
        if not user_preference_profile and user:
            user_preference_profile = _build_profile_from_user_row(clerk_id, user)
        bypass_tag_restrictions = bool(user.get("is_admin"))
        user_access_tags = tag_repository.get_user_tags(clerk_id)
        rows = _safe_db_fetchall(
            "SELECT event_id, response FROM campus_event_rsvps WHERE clerk_id = %s",
            (clerk_id,),
            conn=conn,
        )
        rsvp_lookup = {row.get("event_id"): row.get("response", "interested") for row in rows}
        blocked_rows = _safe_db_fetchall(
            "SELECT blocked_id FROM blocked_users WHERE blocker_id = %s",
            (clerk_id,),
            conn=conn,
        )
        blocked_ids = {row.get("blocked_id") for row in blocked_rows if row.get("blocked_id")}
        muted_rows = _safe_db_fetchall(
            """
            SELECT admin_clerk_id
            FROM admin_event_subscriptions
            WHERE user_clerk_id = %s AND muted = TRUE
            """,
            (clerk_id,),
            conn=conn,
        )
        muted_admin_ids = {
            row.get("admin_clerk_id")
            for row in muted_rows
            if row.get("admin_clerk_id")
        }

    crawler_events = campus_events_service.load_campus_events(campus=campus, force_refresh=force_refresh)
    campus_feed = crawler_events.get("events") if isinstance(crawler_events, dict) else crawler_events
    campus_source_status = crawler_events.get("source_status") if isinstance(crawler_events, dict) else "live"

    business_feed_payload: Dict[str, Any] = {"events": [], "source_status": "missing"}
    if include_off_campus and campus == "tamu":
        business_feed_payload = local_business_events_service.load_local_business_events(force_refresh=force_refresh)
    business_events = business_feed_payload.get("events") if isinstance(business_feed_payload, dict) else []
    business_source_status = business_feed_payload.get("source_status") if isinstance(business_feed_payload, dict) else "missing"

    source_status = _combine_source_status(campus_source_status, business_source_status)
    source_statuses = {
        "campus": campus_source_status,
        "off_campus": business_source_status if include_off_campus and campus == "tamu" else "disabled",
    }
    events_copy = list(campus_feed) if campus_feed else []
    off_campus_events = list(business_events) if business_events else []
    print(
        f"[EVENTS_DEBUG] crawler events: {len(events_copy)} campus + {len(off_campus_events)} off-campus, "
        f"source: {source_statuses}"
    )
    admin_events_list = []
    
    # Fetch Admin Events
    admin_events_raw = _safe_db_fetchall(
        """
        SELECT
            e.id,
            e.clerk_id,
            e.title,
            e.description,
            e.lat,
            e.lng,
            e.location_name,
            e.start_time,
            e.end_time,
            e.google_review_url,
            e.image_url,
            COALESCE(
                (
                    SELECT json_agg(t.label ORDER BY t.label)
                    FROM event_tags et
                    JOIN tags t ON t.id = et.tag_id
                    WHERE et.event_id = e.id::TEXT
                ),
                '[]'::json
            ) AS access_tags,
            app.organization_name
        FROM admin_events e
        LEFT JOIN admin_applications app ON app.clerk_id = e.clerk_id
        ORDER BY e.start_time ASC, e.created_at DESC
        """,
        conn=conn,
    )
    print(f"[EVENTS_DEBUG] admin_events_raw from DB: {len(admin_events_raw)}")
    for ad_ev in admin_events_raw:
        admin_clerk_id = ad_ev.get("clerk_id")
        if admin_clerk_id and (admin_clerk_id in blocked_ids or admin_clerk_id in muted_admin_ids):
            continue

        try:
            organization_name = ad_ev.get("organization_name") or "Campus organizer"
            title = ad_ev["title"]
            description = ad_ev["description"] or ""
            tags = ad_ev.get("access_tags") or []
            location_name = ad_ev["location_name"] or "Campus"
            
            admin_events_list.append({
                "event_id": str(ad_ev["id"]),
                "title": title,
                "location": location_name,
                "location_lat": ad_ev["lat"],
                "location_lng": ad_ev["lng"],
                "start_time": ad_ev["start_time"].isoformat() if ad_ev["start_time"] else None,
                "end_time": ad_ev["end_time"].isoformat() if ad_ev["end_time"] else None,
                "date_ts": int(ad_ev["start_time"].timestamp()) if ad_ev["start_time"] else 0,
                "date2_ts": int(ad_ev["end_time"].timestamp()) if ad_ev["end_time"] else None,
                "description": description,
                "google_review_url": ad_ev.get("google_review_url"),
                "image_url": ad_ev.get("image_url"),
                "access_tags": tags,
                "has_food": False,
                "source_name": "admin_portal",
                "host_name": organization_name,
                "organization_name": organization_name,
                "admin_clerk_id": admin_clerk_id,
                "categories": _get_admin_event_categories(title, description, tags),
                "is_admin_event": True,
                "campus_interest_score": 100,
                "campus_interest_label": "high",
                "campus_interest_reasons": ["Administrative Event", "Official"],
            })
        except Exception as e:
            print(f"Error processing admin event {ad_ev.get('id')}: {e}")
            continue

    print(f"[EVENTS_DEBUG] admin_events_list after build: {len(admin_events_list)}")
    for ae in admin_events_list:
        print(f"[EVENTS_DEBUG]   admin event: {ae.get('title')} | date_ts={ae.get('date_ts')} | start={ae.get('start_time')}")
    
    # Re-verify decryption for all admin events
    for ae in admin_events_list:
        if 'title' in ae and ae['title'] is None:
             print(f"[EVENTS_DEBUG] ERROR: Admin event {ae.get('event_id')} has null title after decryption")

    events = tag_access_service.filter_events_for_access_tags(
        events_copy,
        user_tags=user_access_tags,
        bypass_restrictions=bypass_tag_restrictions,
    )
    has_modern_events = bool(events_copy or off_campus_events)
    # Re-integrate admin events AFTER tag filtering to ensure they bypass it entirely
    events = admin_events_list + off_campus_events + events
    for event in events:
        _ensure_event_classification_metadata(event)
    print(f"[EVENTS_DEBUG] after merge: {len(events)} total events (has_modern_events={has_modern_events})")
    # Filter for upcoming events, while keeping featured/admin events on their own shorter window.
    events = [
        event for event in events 
        if (_is_admin_event_visible(event) if event.get("is_admin_event") else _is_event_upcoming(event))
    ]
    admin_after_upcoming = [e for e in events if e.get('is_admin_event')]
    print(f"[EVENTS_DEBUG] after upcoming filter: {len(events)} total, {len(admin_after_upcoming)} admin")

    interaction_context = _build_interaction_context(clerk_id, events, conn=conn) if clerk_id else {}
    _attach_recommendation_scores(events, user_preference_profile, interaction_context)

    events.sort(key=_event_start_sort_key)

    if has_modern_events or admin_events_list:
        if student_relevant_only:
            # Ensure label check is robust and includes unknown/missing labels by default
            events = [
                e for e in events
                if e.get("campus_interest_label", "high") != "low" or e.get("is_admin_event")
            ]
        if category:
            category_normalized = _normalize_category_key(category) or str(category).strip().lower().replace(" ", "_")
            if str(category).strip().lower() == "for u":
                if user_preference_profile:
                    events = [e for e in events if not e.get("is_admin_event")]
                    events = [e for e in events if e.get("for_u_match") or (e.get("recommendation_score") or 0.0) > 0.0]
                    events.sort(key=lambda e: (-(e.get("recommendation_score") or 0.0), _event_start_sort_key(e)))
                elif clerk_id and user:
                    # Legacy fallback when no generated profile exists yet.
                    for event in events:
                        event["personalization_score"] = _score_personalized_relevance(event, user)
                    events = [e for e in events if not e.get("is_admin_event")]
                    events.sort(key=lambda e: (-e.get("personalization_score", 0), _event_start_sort_key(e)))
                else:
                    events = [e for e in events if not e.get("is_admin_event")]
            else:
                if category_normalized == "featured":
                    events = [e for e in events if e.get("is_admin_event")]
                else:
                    events = [
                        e for e in events
                        if e.get("primary_category") == category_normalized
                        or e.get("categories", {}).get(category_normalized) == 1
                        or (category_normalized == "promotions" and (e.get("is_promotion") or e.get("categories", {}).get("promotions") == 1))
                    ]
        limited = _merge_admin_events_before_limit(events, limit) if limit else events
        return {
            "generated_at": _utc_now_iso(),
            "stale_after": 300,
            "source_status": source_status,
            "source_statuses": source_statuses,
            "events": [
                {
                    **event,
                    "rsvp_status": rsvp_lookup.get(event.get("event_id"), "none"),
                }
                for event in limited
            ],
        }

    # Fallback to legacy tracker events if modern sources return absolutely nothing
    # but still keep whatever admin events we fetched
    from routers.traffic import tracker
    raw_events = tracker.fetch_event_data(limit=limit)
    fallback_events = []
    for event in raw_events:
        event_id = _event_id_for(event)
        resolved_place = place_registry_service.resolve_place(
            event.get("location"),
            event.get("latitude"),
            event.get("longitude"),
        )
        fallback_events.append(
            {
                "event_id": event_id,
                "title": event.get("title", "Campus Event"),
                "location": resolved_place["name"] if resolved_place else event.get("location", "TBA"),
                "place_id": resolved_place["place_id"] if resolved_place else None,
                "start_time": event.get("start_time"),
                "end_time": event.get("end_time"),
                "date_ts": int(_parse_event_datetime(event.get("start_time")).timestamp()) if _parse_event_datetime(event.get("start_time")) else 0,
                "date2_ts": int(_parse_event_datetime(event.get("end_time")).timestamp()) if _parse_event_datetime(event.get("end_time")) else None,
                "summary": event.get("summary", ""),
                "description": event.get("summary", ""),
                "link": event.get("link"),
                "source_url": event.get("link"),
                "host_name": None,
                "source_name": "legacy_tracker",
                "tags": [],
                "access_tags": [],
                "has_food": False,
                "food_confidence": 0.0,
                "food_type": "unknown",
                "food_reasons": [],
                "location_lat": resolved_place["lat"] if resolved_place else None,
                "location_lng": resolved_place["lng"] if resolved_place else None,
                "map_available": bool(resolved_place),
                "campus_interest_score": 40,
                "campus_interest_label": "medium",
                "campus_interest_reasons": ["legacy_tracker_fallback"],
                "rsvp_status": rsvp_lookup.get(event_id, "none"),
                "place": place_registry_service.serialize_place(resolved_place),
            }
        )
    
    # Merge admin events with fallback events
    events = admin_events_list + fallback_events
    for event in events:
        _ensure_event_classification_metadata(event)
    
    # Final filter and sort
    events = [
        event for event in events 
        if (_is_admin_event_visible(event) if event.get("is_admin_event") else _is_event_upcoming(event))
    ]
    fallback_interaction_context = _build_interaction_context(clerk_id, events, conn=conn) if clerk_id else {}
    _attach_recommendation_scores(events, user_preference_profile, fallback_interaction_context)
    events.sort(key=_event_start_sort_key)
    limited = _merge_admin_events_before_limit(events, limit) if limit else events
    
    return {
        "generated_at": _utc_now_iso(),
        "stale_after": 300,
        "source_status": "preview",
        "source_statuses": source_statuses,
        "events": limited,
    }


def _notification_delivery_state(clerk_id: str, conn: Optional[psycopg.Connection] = None) -> Dict[str, Any]:
    rows = _safe_db_fetchall(
        """
        SELECT event_id, notified_at
        FROM campus_event_notifications
        WHERE clerk_id = %s
        ORDER BY notified_at DESC
        LIMIT 500
        """,
        (clerk_id,),
        conn=conn,
    )
    already_notified_ids = [str(row.get("event_id")) for row in rows if row.get("event_id")]

    day_count_row = _safe_db_fetchone(
        """
        SELECT COUNT(*) AS sent_count
        FROM campus_event_notifications
        WHERE clerk_id = %s
          AND notified_at >= date_trunc('day', NOW())
        """,
        (clerk_id,),
        conn=conn,
    )
    sent_count = int(day_count_row.get("sent_count") or 0) if day_count_row else 0
    return {"already_notified_event_ids": already_notified_ids, "daily_sent_count": sent_count}


def _record_notification_deliveries(
    clerk_id: str,
    events: List[Dict[str, Any]],
    conn: Optional[psycopg.Connection] = None,
) -> None:
    if not events:
        return

    rows = []
    for event in events:
        event_id = str(event.get("event_id") or event.get("id") or "").strip()
        if not event_id:
            continue
        rows.append((clerk_id, event_id, float(event.get("recommendation_score") or 0.0)))

    if not rows:
        return

    query = """
        INSERT INTO campus_event_notifications (clerk_id, event_id, recommendation_score, notified_at)
        VALUES (%s, %s, %s, NOW())
        ON CONFLICT (clerk_id, event_id) DO UPDATE
        SET recommendation_score = EXCLUDED.recommendation_score,
            notified_at = NOW()
    """

    try:
        if conn:
            with conn.cursor() as cur:
                cur.executemany(query, rows)
            conn.commit()
            return
        with get_pool().connection() as new_conn:
            with new_conn.cursor() as cur:
                cur.executemany(query, rows)
            new_conn.commit()
    except Exception:
        pass


def get_recommended_events(
    clerk_id: Optional[str],
    limit: int = 50,
    campus: str = "tamu",
    conn: Optional[psycopg.Connection] = None,
    force_refresh: bool = False,
) -> Dict[str, Any]:
    snapshot = get_events_snapshot(
        clerk_id=clerk_id,
        limit=max(limit * 6, 300),
        category=None,
        student_relevant_only=False,
        campus=campus,
        conn=conn,
        force_refresh=force_refresh,
    )
    events = snapshot.get("events", []) if isinstance(snapshot, dict) else []
    events = [event for event in events if not event.get("is_admin_event")]

    user_profile: Optional[Dict[str, Any]] = None
    interaction_context: Dict[str, Any] = {}
    if clerk_id:
        user_profile = user_repository.get_user_preference_profile(clerk_id)
        if not user_profile:
            user = user_repository.get_user(clerk_id) or {}
            if user:
                user_profile = _build_profile_from_user_row(clerk_id, user)
        if user_profile:
            interaction_context = _build_interaction_context(clerk_id, events, conn=conn)
            ranked = recommendation_engine.rank_events_for_user(
                events,
                user_profile,
                interaction_context=interaction_context,
                include_debug=True,
            )
        else:
            ranked = sorted(
                events,
                key=lambda event: (
                    -(event.get("campus_interest_score") or 0),
                    _event_start_sort_key(event),
                ),
            )
    else:
        ranked = sorted(
            events,
            key=lambda event: (
                -(event.get("campus_interest_score") or 0),
                _event_start_sort_key(event),
            ),
        )

    return {
        "generated_at": _utc_now_iso(),
        "stale_after": 300,
        "source_status": snapshot.get("source_status", "live") if isinstance(snapshot, dict) else "live",
        "events": ranked[:limit],
    }


def save_event_rsvp(clerk_id: str, event_id: str, response: str) -> Dict[str, Any]:
    _ensure_social_tables()
    try:
        with get_pool().connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO campus_event_rsvps (clerk_id, event_id, response, updated_at)
                    VALUES (%s, %s, %s, NOW())
                    ON CONFLICT (clerk_id, event_id) DO UPDATE SET response = EXCLUDED.response, updated_at = NOW()
                    """,
                    (clerk_id, event_id, response),
                )
            conn.commit()
        return {"status": "success", "clerk_id": clerk_id, "event_id": event_id, "response": response}
    except Exception as exc:
        return {"status": "error", "message": str(exc)}


def get_recreation_snapshot() -> Dict[str, Any]:
    cache_key = "campus:recreation:snapshot:v1"
    cached = _local_cache_get(RECREATION_SNAPSHOT_CACHE, cache_key, RECREATION_SNAPSHOT_TTL_SECONDS)
    if cached is not None:
        return cached

    from routers.traffic import tracker
    occupancy_rows = tracker.fetch_rec_data() or []
    live_counts_by_place_id = tracker.get_rec_center_live_counts(occupancy_rows)
    notices = _fetch_rec_notices()

    facilities = []
    rec_place_ids = ["rec", "southside-rec", "polo-rec", "aquatics", "peap", "penberthy"]
    rec_places_by_id = {
        place["place_id"]: place
        for place in place_registry_service.get_all_places()
        if place["place_id"] in rec_place_ids
    }
    rec_places_by_id.update(
        {
            place_id: dict(place)
            for place_id, place in tracker.get_rec_place_catalog().items()
            if place_id in rec_place_ids and place_id not in rec_places_by_id
        }
    )
    source_url_by_place_id = {
        "rec": "https://recsports.tamu.edu/facilities/student-rec-center/",
        "southside-rec": "https://recsports.tamu.edu/facilities/southside-rec/",
        "polo-rec": "https://recsports.tamu.edu/facilities/polo-road-rec/",
        "aquatics": "https://recsports.tamu.edu/programs/aquatics/",
        "peap": "https://recsports.tamu.edu/facilities/peap/",
        "penberthy": "https://recsports.tamu.edu/facilities/penberthy-rec-sports-complex/",
    }

    for pid in rec_place_ids:
        place = rec_places_by_id.get(pid)
        if not place:
            continue
        pid = place["place_id"]
        live_count = live_counts_by_place_id.get(pid)
        source_url = source_url_by_place_id.get(pid) or f"https://recsports.tamu.edu/facilities/{pid}/"

        page_details = _fetch_rec_facility_page_details(source_url)
        
        # Notices filter
        facility_notices = [
            {"window": n.get("window"), "detail": n.get("detail")}
            for n in notices if pid in n.get("facility_ids", []) or pid.replace("-rec", "") in n.get("facility_ids", [])
        ]

        current_count = live_count.get("current_count") if live_count else None
        capacity = live_count.get("capacity") if live_count else None
        percent_full = live_count.get("percent_full") if live_count else None

        hours_facility_key = REC_PLACE_ID_TO_FACILITY_KEY.get(pid)
        weekly_hours_payload = _weekly_hours_for_facility(hours_facility_key) if hours_facility_key else {}

        facilities.append({
            "id": pid,
            "name": place["name"],
            "summary": place.get("description") or page_details.get("summary"),
            "amenities": place.get("features") or page_details.get("amenities", []),
            "hours_hint": place.get("hours") or page_details.get("hours_hint") or "See official page",
            "notices": facility_notices,
            "percent_full": percent_full,
            "current_count": current_count,
            "capacity": capacity,
            "occupancy_name": live_count.get("location_name") if live_count else None,
            "last_updated": live_count.get("last_updated") if live_count else None,
            "facility_counts": live_count.get("facility_counts") if live_count else [],
            "source_url": source_url,
            "today_hours": weekly_hours_payload.get("today_hours"),
            "hours_weekly": weekly_hours_payload.get("weekly_hours"),
            "hours_source": weekly_hours_payload.get("hours_source"),
        })

    payload = {
        "generated_at": _utc_now_iso(),
        "stale_after": RECREATION_SNAPSHOT_TTL_SECONDS,
        "source_status": "live" if occupancy_rows else "preview",
        "status": "live" if occupancy_rows else "preview",
        "facilities": facilities,
        "summary": "Recreation merges live counts with details gathered from the official Rec Sports facility pages.",
    }
    return _local_cache_set(RECREATION_SNAPSHOT_CACHE, cache_key, payload)


def get_place_detail_snapshot(place_id: str) -> Dict[str, Any]:
    cache_key = f"{PLACE_DETAIL_CACHE_VERSION}:{place_id}"
    cached = _local_cache_get(PLACE_DETAIL_CACHE, cache_key, PLACE_DETAIL_CACHE_TTL_SECONDS)
    if cached is not None and (
        cached.get("source_status") == "missing" or cached.get("place") is not None
    ):
        return cached

    place = place_registry_service.get_place_by_id(place_id)
    if not place:
        payload = {
            "generated_at": _utc_now_iso(),
            "stale_after": PLACE_DETAIL_CACHE_TTL_SECONDS,
            "source_status": "missing",
            "place": None,
        }
        return _local_cache_set(PLACE_DETAIL_CACHE, cache_key, payload)

    places_snapshot = campus_places_service.get_places_map_snapshot()
    location = next((loc for loc in places_snapshot.get("locations", []) if loc.get("placeId") == place_id), None)
    
    # Dynamic parking data for Garage icons
    if place.get("type") == "Parking" and location:
        # Check if this place_id is one of our known visitor garages
        from services.campus_places_service import VISITOR_GARAGE_CODE_BY_PLACE_ID, VISITOR_GARAGE_FULL_NAME_BY_CODE
        code = VISITOR_GARAGE_CODE_BY_PLACE_ID.get(place_id)
        if code:
            parking_data = parking_realtime_service.snapshot_block()
            count = parking_data.get("garages", {}).get(code)
            if count is not None:
                # Ensure we have a fresh copy of the location to avoid polluting the cache
                location = dict(location)
                location["visitor_parking_available"] = count
                location["visitor_parking_code"] = code
                location["visitor_parking_garage_name"] = VISITOR_GARAGE_FULL_NAME_BY_CODE.get(code)
                location["visitor_parking_as_of"] = parking_data.get("fetched_at")
                location["visitor_parking_source_url"] = parking_data.get("source_url")

    if place.get("type") in {"Rec", "Library"} and location:
        capacity_snapshot = campus_places_service.get_places_capacity_realtime_snapshot()
        section_key = "recreation" if place.get("type") == "Rec" else "libraries"
        live_capacity = (
            capacity_snapshot.get(section_key, {})
            .get("locations", {})
            .get(place_id)
        )
        if live_capacity:
            location = dict(location)
            for key in (
                "percent_full",
                "available_seats",
                "capacity",
                "current_count",
                "occupancy_name",
                "facility_counts",
                "capacity_last_updated",
                "capacity_source_url",
                "capacity_as_of",
                "is_live",
            ):
                if live_capacity.get(key) is not None:
                    location[key] = live_capacity.get(key)

    payload = {
        "generated_at": _utc_now_iso(),
        "stale_after": PLACE_DETAIL_CACHE_TTL_SECONDS,
        "source_status": "live",
        "place": location or place_registry_service.serialize_place(place),
    }
    return _local_cache_set(PLACE_DETAIL_CACHE, cache_key, payload)


def get_place_detail_snapshot_by_identifier(place_identifier: str) -> Dict[str, Any]:
    place = place_registry_service.get_place_by_id(place_identifier)
    if place:
        return get_place_detail_snapshot(place_identifier)

    resolved = place_registry_service.resolve_place(place_identifier)
    if resolved:
        return get_place_detail_snapshot(resolved["place_id"])

    payload = {
        "generated_at": _utc_now_iso(),
        "stale_after": 60,
        "source_status": "missing",
        "place": None,
    }
    return payload


def get_transit_snapshot() -> Dict[str, Any]:
    return {
        "generated_at": _utc_now_iso(),
        "stale_after": TRANSIT_SNAPSHOT_TTL_SECONDS,
        "source_status": "live",
        "status": "live",
        "summary": "AggieSpirit route mapping and nearest-bus tracking are available in the map experience.",
        "resources": [
            {"label": "AggieSpirit Route Map", "url": AGGIE_SPIRIT_URL},
        ],
    }


def get_services_snapshot() -> Dict[str, Any]:
    return {
        "generated_at": _utc_now_iso(),
        "stale_after": SERVICES_SNAPSHOT_TTL_SECONDS,
        "source_status": "live",
        "services": [
        {
            "id": "howdy",
            "title": "Howdy Portal",
            "summary": "Single sign-on launch point for academic systems and institutional services.",
            "url": HOWDY_URL,
        },
        {
            "id": "transact",
            "title": "Dining Accounts",
            "summary": "Meal plans, balances, and dining transactions via Transact eAccounts.",
            "url": DINING_URL,
        },
        {
            "id": "hire-aggies",
            "title": "Hire Aggies",
            "summary": "Jobs, career fairs, employer interactions, and Symplicity workflows.",
            "url": HIRE_AGGIES_URL,
        },
        {
            "id": "annex",
            "title": "The Annex",
            "summary": "Library and study support surfaced alongside the campus map and academic context.",
            "url": "https://www.library.tamu.edu/",
        },
        ],
    }


def get_career_snapshot(clerk_id: str, conn: Optional[psycopg.Connection] = None) -> Dict[str, Any]:
    network = discover_network(clerk_id, limit=4, conn=conn)
    alumni_count = len([suggestion for suggestion in network.get("suggestions", []) if suggestion.get("relationship") == "alumni"])
    symplicity_snapshot = parse_connector_snapshot(clerk_id, "symplicity", conn=conn)
    return {
        "generated_at": _utc_now_iso(),
        "stale_after": CAREER_SNAPSHOT_TTL_SECONDS,
        "source_status": "live" if symplicity_snapshot else "preview",
        "status": "live" if symplicity_snapshot else "link",
        "summary": (
            f"Captured jobs: {', '.join(symplicity_snapshot.get('job_titles', [])[:3])}"
            if symplicity_snapshot.get("job_titles")
            else "Hire Aggies jobs and employer activity can be launched from one career module."
        ),
        "alumniPreviewCount": alumni_count,
        "capturedJobs": symplicity_snapshot.get("job_titles", []),
        "capturedEventHint": symplicity_snapshot.get("event_hint"),
        "resources": [
            {"label": "Hire Aggies", "url": HIRE_AGGIES_URL},
        ],
    }


def get_notification_hub(
    clerk_id: str,
    academic_data: Optional[Dict[str, Any]] = None,
    dining_data: Optional[Dict[str, Any]] = None,
    events_data: Optional[Any] = None,
    network_data: Optional[Dict[str, Any]] = None,
    conn: Optional[psycopg.Connection] = None,
) -> List[Dict[str, Any]]:
    academic = academic_data or get_academic_snapshot(clerk_id, conn=conn)
    dining = dining_data or get_dining_snapshot(clerk_id, conn=conn)
    events_snapshot = events_data or get_events_snapshot(
        clerk_id,
        limit=40,
        include_off_campus=False,
        conn=conn,
    )
    if isinstance(events_snapshot, dict):
        events = events_snapshot.get("events", []) or []
    elif isinstance(events_snapshot, list):
        events = events_snapshot
    else:
        events = []
    network = network_data or discover_network(clerk_id, limit=3, conn=conn)

    notifications: List[Dict[str, Any]] = []
    if academic.get("nextCourse"):
        notifications.append(
            {
                "id": "next-course",
                "title": f"Next class: {academic['nextCourse']['code']}",
                "detail": f"{academic['nextCourse']['time']} · {academic['nextCourse']['location']}",
                "category": "academic",
                "urgency": "high",
            }
        )

    notifications.append(
        {
            "id": "dining-connector",
            "title": dining.get("planName", "Dining module"),
            "detail": dining.get("balanceLabel", ""),
            "category": "administrative",
            "urgency": "medium",
        }
    )

    user = user_repository.get_user(clerk_id) or {}
    user_profile = user_repository.get_user_preference_profile(clerk_id)
    if not user_profile and user:
        user_profile = _build_profile_from_user_row(clerk_id, user)

    interaction_context = _build_interaction_context(clerk_id, events, conn=conn)
    delivery_state = _notification_delivery_state(clerk_id, conn=conn)
    candidate_events = notification_recommendation_service.select_notification_candidates(
        [event for event in events if not event.get("is_admin_event")],
        user_profile or _build_profile_from_user_row(clerk_id, user),
        interaction_context=interaction_context,
        already_notified_event_ids=delivery_state.get("already_notified_event_ids", []),
        daily_sent_count=delivery_state.get("daily_sent_count", 0),
    )

    selected_candidates = candidate_events[:2]
    _record_notification_deliveries(clerk_id, selected_candidates, conn=conn)

    for event in selected_candidates:
        notifications.append(
            {
                "id": f"event-{event['event_id']}",
                "title": event.get("title", "Campus Event"),
                "detail": f"{event.get('start_time', 'TBA')} · {event.get('location', 'TBA')}",
                "category": "social",
                "urgency": "medium" if (event.get("recommendation_score") or 0) < 8 else "high",
            }
        )

    if network.get("pendingRequests", 0) > 0:
        notifications.append(
            {
                "id": "network-pending",
                "title": "Connection requests pending",
                "detail": f"{network['pendingRequests']} connection request(s) need attention.",
                "category": "career",
                "urgency": "medium",
            }
        )

    return notifications


def get_overview(clerk_id: str) -> Dict[str, Any]:
    def safe_exec(label: str, loader, fallback):
        try:
            return loader()
        except Exception as exc:
            print(f"[campus_hub] {label} overview step failed for {clerk_id}: {exc}")
            return fallback

    try:
        with get_pool().connection() as conn:
            # 1. Fetch connectors (needed by auth and academic/dining/career snapshots)
            # Actually snapshots call get_connector_snapshots themselves, but with a shared connection it's efficient.
            
            # 2. Heavy snapshots (using shared connection)
            auth = safe_exec("auth", lambda: get_auth_status(clerk_id, conn=conn), {"status": "preview"})
            academic = safe_exec("academic", lambda: get_academic_snapshot(clerk_id, conn=conn), {"status": "preview", "courses": []})
            dining = safe_exec("dining", lambda: get_dining_snapshot(clerk_id, conn=conn), {"status": "preview"})
            career = safe_exec("career", lambda: get_career_snapshot(clerk_id, conn=conn), {"status": "preview"})
            network = safe_exec("network", lambda: discover_network(clerk_id, limit=6, conn=conn), {"suggestions": []})
            events = safe_exec(
                "events",
                lambda: get_events_snapshot(clerk_id, limit=6, include_off_campus=False, conn=conn),
                [],
            )
            
            # 3. Notification hub (Passed pre-loaded data to avoid redundant DB calls)
            notifications = safe_exec("notifications", lambda: get_notification_hub(
                clerk_id,
                academic_data=academic,
                dining_data=dining,
                events_data=events,
                network_data=network,
                conn=conn
            ), [])

            # 4. Other services (Transit/Rec/Connectors)
            transit = safe_exec("transit", get_transit_snapshot, {"status": "live"})
            recreation = safe_exec("recreation", get_recreation_snapshot, {"facilities": []})
            services = safe_exec("services", get_services_snapshot, [])
            connectors = safe_exec("connectors", lambda: get_connector_snapshots(clerk_id, conn=conn), [])

            return {
                "auth": auth,
                "academic": academic,
                "dining": dining,
                "notifications": notifications,
                "career": career,
                "network": network,
                "events": events,
                "transit": transit,
                "recreation": recreation,
                "services": services,
                "connectors": connectors,
                "generatedAt": _utc_now_iso(),
            }
    except Exception as exc:
        print(f"[campus_hub] Critical overview failure for {clerk_id}: {exc}")
        return {"status": "error", "message": "Overview temporarily unavailable"}
