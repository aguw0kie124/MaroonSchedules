"""Parsers for UTD's Localist-backed Comet Calendar."""

from __future__ import annotations

import json
import logging
import re
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup
from dateutil import parser as dtparse

logger = logging.getLogger("utd_crawler.parsers.localist")


def _clean_text(value: Any) -> str:
    if value is None:
        return ""
    return re.sub(r"\s+", " ", str(value)).strip()


def _parse_datetime(value: Any) -> Optional[datetime]:
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    try:
        return dtparse.parse(str(value))
    except (TypeError, ValueError):
        return None


def _dedupe_tags(values: List[str]) -> List[str]:
    seen: set[str] = set()
    ordered: List[str] = []
    for value in values:
        cleaned = _clean_text(value)
        if not cleaned:
            continue
        key = cleaned.lower()
        if key in seen:
            continue
        seen.add(key)
        ordered.append(cleaned)
    return ordered


def _extract_location_name(event: Dict[str, Any]) -> str | None:
    location_name = _clean_text(event.get("location_name"))
    room_number = _clean_text(event.get("room_number"))
    address = _clean_text(event.get("address"))

    if location_name and room_number and room_number.lower() not in location_name.lower():
        return f"{location_name} ({room_number})"
    if location_name:
        return location_name
    if room_number:
        return room_number
    if address:
        return address
    return None


def _extract_geo(event: Dict[str, Any]) -> tuple[float | None, float | None]:
    geo = event.get("geo") or {}
    lat = geo.get("latitude")
    lng = geo.get("longitude")
    try:
        return (
            float(lat) if lat is not None else None,
            float(lng) if lng is not None else None,
        )
    except (TypeError, ValueError):
        return None, None


def _event_tags(event: Dict[str, Any], extra_tags: List[str]) -> List[str]:
    tags: List[str] = list(event.get("tags") or [])
    hashtag = _clean_text(event.get("hashtag")).lstrip("#")
    if hashtag:
        tags.append(hashtag)

    filters = event.get("filters") or {}
    for filter_name in ("event_topic", "event_types", "event_target_audience"):
        for entry in filters.get(filter_name) or []:
            if isinstance(entry, dict):
                tags.append(entry.get("name", ""))

    return _dedupe_tags(tags + list(extra_tags))


def _event_audience(event: Dict[str, Any]) -> List[str]:
    filters = event.get("filters") or {}
    audience = [
        _clean_text(entry.get("name"))
        for entry in filters.get("event_target_audience") or []
        if isinstance(entry, dict)
    ]
    return audience or ["undergrad"]


def _first_department(event: Dict[str, Any]) -> tuple[str | None, str | None]:
    departments = event.get("departments") or []
    if not departments:
        return None, None
    first = departments[0] or {}
    if not isinstance(first, dict):
        return None, None
    return None, _clean_text(first.get("name")) or None


def _instance_payload(event: Dict[str, Any]) -> Dict[str, Any]:
    instances = event.get("event_instances") or []
    for wrapper in instances:
        if isinstance(wrapper, dict) and isinstance(wrapper.get("event_instance"), dict):
            return wrapper["event_instance"]
    return {}


def _stable_slug(url: str, fallback: str) -> str:
    parsed = urlparse(url)
    slug = parsed.path.rstrip("/").split("/")[-1]
    slug = slug or fallback
    return re.sub(r"[^a-z0-9]+", "_", slug.lower()).strip("_") or "event"


def _build_api_event(
    event: Dict[str, Any],
    source_name: str,
    source_url: str,
    *,
    extra_tags: Optional[List[str]] = None,
    host_name: Optional[str] = None,
    host_type: Optional[str] = None,
    discovered_via: Optional[str] = None,
    crawl_path: Optional[List[str]] = None,
) -> Optional[Dict[str, Any]]:
    instance = _instance_payload(event)
    start_time = _parse_datetime(instance.get("start")) or _parse_datetime(event.get("first_date"))
    if not start_time:
        return None
    end_time = _parse_datetime(instance.get("end"))

    lat, lng = _extract_geo(event)
    department_code, department_name = _first_department(event)
    resolved_host_name = host_name or department_name or _clean_text(source_name)
    resolved_host_type = host_type or ("student_org" if source_name.startswith("groups:") else "department")

    localist_url = _clean_text(event.get("localist_url")) or _clean_text(event.get("url"))
    external_url = _clean_text(event.get("url"))
    event_id = event.get("id")
    instance_id = instance.get("id")
    canonical_id = f"utd:localist:{event_id}:{instance_id or start_time.isoformat()}"

    source_links = [
        link
        for link in (
            localist_url,
            _clean_text(event.get("localist_ics_url")),
            _clean_text(event.get("venue_url")),
            external_url if external_url and external_url != localist_url else None,
        )
        if link
    ]

    return {
        "id": canonical_id,
        "title": _clean_text(event.get("title")) or "UTD Event",
        "description": event.get("description") or event.get("description_text") or "",
        "start_time": start_time.isoformat(),
        "end_time": end_time.isoformat() if end_time else None,
        "timezone": "America/Chicago",
        "location": _extract_location_name(event),
        "location_lat": lat,
        "location_lng": lng,
        "host_name": resolved_host_name,
        "host_type": resolved_host_type,
        "department_code": department_code,
        "department_name": department_name,
        "source_name": source_name,
        "source_url": source_url,
        "source_links": source_links,
        "event_url": localist_url or None,
        "discovered_via": discovered_via,
        "crawl_path": crawl_path or [source_url],
        "registration_status": "available" if event.get("has_register") else None,
        "tags": _event_tags(event, extra_tags or []),
        "audience": _event_audience(event),
        "campus": "richardson",
        "affiliation": "utd",
        "raw_payload": event,
    }


async def parse_localist_api(
    body: str | None,
    source_name: str,
    source_url: str,
    **kwargs: Any,
) -> List[Dict[str, Any]]:
    if not body:
        return []
    try:
        payload = json.loads(body)
    except json.JSONDecodeError as exc:
        logger.warning("Invalid Localist JSON from %s: %s", source_url, exc)
        return []

    results: List[Dict[str, Any]] = []
    for wrapper in payload.get("events", []):
        event = wrapper.get("event") if isinstance(wrapper, dict) else None
        if not isinstance(event, dict):
            continue
        normalized = _build_api_event(
            event,
            source_name,
            source_url,
            extra_tags=kwargs.get("extra_tags"),
            host_name=kwargs.get("host_name"),
            host_type=kwargs.get("host_type"),
            discovered_via=kwargs.get("discovered_via"),
            crawl_path=kwargs.get("crawl_path"),
        )
        if normalized:
            results.append(normalized)

    logger.info("Parsed %d Localist API events from %s", len(results), source_name)
    return results


def _page_id_lookup(soup: BeautifulSoup, base_url: str) -> Dict[str, tuple[str, str | None]]:
    lookup: Dict[str, tuple[str, str | None]] = {}
    for node in soup.select("[data-event-id]"):
        event_id = _clean_text(node.get("data-event-id"))
        instance_id = _clean_text(node.get("data-event-instance-id")) or None
        href = node.get("href")
        if not href:
            continue
        lookup[urljoin(base_url, href)] = (event_id, instance_id)
    return lookup


async def parse_localist_html(
    body: str | None,
    source_name: str,
    source_url: str,
    **kwargs: Any,
) -> List[Dict[str, Any]]:
    if not body:
        return []

    soup = BeautifulSoup(body, "lxml")
    id_lookup = _page_id_lookup(soup, source_url)
    header = soup.select_one(".em-header-card_title")
    page_host = _clean_text(kwargs.get("host_name")) or _clean_text(header.get_text() if header else source_name)
    host_type = kwargs.get("host_type") or ("student_org" if source_name.startswith("groups:") else "department")
    cutoff = datetime.now(timezone.utc) - timedelta(days=1)

    events: List[Dict[str, Any]] = []
    for script in soup.find_all("script", type="application/ld+json"):
        raw_text = script.string or script.get_text()
        if not raw_text or "@type" not in raw_text:
            continue
        try:
            payload = json.loads(raw_text)
        except json.JSONDecodeError:
            continue
        entries = payload if isinstance(payload, list) else [payload]
        for entry in entries:
            if not isinstance(entry, dict) or entry.get("@type") != "Event":
                continue
            start_time = _parse_datetime(entry.get("startDate"))
            if not start_time:
                continue
            start_utc = start_time.astimezone(timezone.utc) if start_time.tzinfo else start_time.replace(tzinfo=timezone.utc)
            if start_utc < cutoff:
                continue

            end_time = _parse_datetime(entry.get("endDate"))
            location = entry.get("location") if isinstance(entry.get("location"), dict) else {}
            geo = location.get("geo") if isinstance(location, dict) else {}
            url = _clean_text(entry.get("url"))
            event_id, instance_id = id_lookup.get(url, ("", None))
            stable_id = event_id or _stable_slug(url, _clean_text(entry.get("name")))
            tags = list(kwargs.get("extra_tags") or [])
            if source_name.startswith("groups:"):
                tags.append("student_org")
            if source_name.startswith("departments:"):
                tags.append("department_event")

            events.append(
                {
                    "id": f"utd:localist_html:{stable_id}:{instance_id or start_time.isoformat()}",
                    "title": _clean_text(entry.get("name")) or "UTD Event",
                    "description": _clean_text(entry.get("description")),
                    "start_time": start_time.isoformat(),
                    "end_time": end_time.isoformat() if end_time else None,
                    "timezone": "America/Chicago",
                    "location": _clean_text(location.get("name")) or _clean_text(location.get("address")),
                    "location_lat": float(geo.get("latitude")) if geo.get("latitude") else None,
                    "location_lng": float(geo.get("longitude")) if geo.get("longitude") else None,
                    "host_name": page_host,
                    "host_type": host_type,
                    "department_name": page_host if host_type == "department" else None,
                    "source_name": source_name,
                    "source_url": source_url,
                    "source_links": [url] if url else [],
                    "event_url": url or None,
                    "discovered_via": kwargs.get("discovered_via"),
                    "crawl_path": kwargs.get("crawl_path") or [source_url],
                    "tags": _dedupe_tags(tags),
                    "audience": ["undergrad"],
                    "campus": "richardson",
                    "affiliation": "utd",
                    "raw_payload": entry,
                }
            )

    logger.info("Parsed %d Localist HTML events from %s", len(events), source_name)
    return events


async def select_localist_entities(
    body: str | None,
    source_name: str,
    source_url: str,
    *,
    entity_kind: str,
    page_suffix: str = "/calendar",
    extra_tags: Optional[List[str]] = None,
    selection_keywords: Optional[List[str]] = None,
    max_entities: Optional[int] = None,
) -> List[Dict[str, Any]]:
    if not body:
        return []
    try:
        payload = json.loads(body)
    except json.JSONDecodeError as exc:
        logger.warning("Invalid Localist directory JSON from %s: %s", source_url, exc)
        return []

    plural_key = "groups" if entity_kind == "group" else "departments"
    host_type = "student_org" if entity_kind == "group" else "department"
    keywords = [keyword.lower() for keyword in (selection_keywords or []) if keyword.strip()]
    entities: List[Dict[str, Any]] = []
    for wrapper in payload.get(plural_key, []):
        entity = wrapper.get(entity_kind) if isinstance(wrapper, dict) else None
        if not isinstance(entity, dict):
            continue
        searchable = " ".join(
            [
                _clean_text(entity.get("name")),
                _clean_text(entity.get("urlname")),
                _clean_text(entity.get("description_text")),
                " ".join(_clean_text(tag) for tag in entity.get("tags") or []),
            ]
        ).lower()
        if keywords and not any(keyword in searchable for keyword in keywords):
            continue
        localist_url = _clean_text(entity.get("localist_url"))
        if not localist_url:
            continue
        inferred_tags = list(extra_tags or [])
        if "auxiliary services" in searchable or "services" == _clean_text(entity.get("urlname")).lower():
            inferred_tags.extend(["commuter", "transit", "comet cruiser", "parking", "dining"])
        entities.append(
            {
                "name": _clean_text(entity.get("name")) or "UTD Entity",
                "slug": _clean_text(entity.get("urlname")),
                "calendar_url": localist_url.rstrip("/") + page_suffix,
                "host_type": host_type,
                "extra_tags": _dedupe_tags(
                    inferred_tags
                    + [entity_kind, f"{entity_kind}:{_clean_text(entity.get('urlname'))}"]
                ),
            }
        )
        if max_entities is not None and len(entities) >= max_entities:
            break
    logger.info("Selected %d Localist %ss from %s", len(entities), entity_kind, source_name)
    return entities
