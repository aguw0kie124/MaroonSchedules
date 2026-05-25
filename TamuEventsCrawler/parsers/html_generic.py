"""Generic HTML event parsers for non-LiveWhale TAMU sources."""

from __future__ import annotations

import hashlib
import json
import logging
import re
from datetime import datetime
from typing import Any, Dict, Iterable, List, Optional

from bs4 import BeautifulSoup, Tag
from dateutil import parser as dtparse

logger = logging.getLogger("tamu_crawler.parsers.html_generic")


def _safe_iso(value: Any) -> Optional[str]:
    if not value:
        return None
    try:
        if isinstance(value, datetime):
            return value.isoformat()
        parsed = dtparse.parse(str(value), fuzzy=True)
        return parsed.isoformat()
    except Exception:
        return None


def _clean(text: Any) -> str:
    return re.sub(r"\s+", " ", str(text or "")).strip()


def _event_id(source_name: str, title: str, start_time: str, event_url: str) -> str:
    digest = hashlib.sha1(f"{source_name}|{title}|{start_time}|{event_url}".encode("utf-8")).hexdigest()[:16]
    return f"tamu:html:{digest}"


def _to_event(
    *,
    source_name: str,
    source_url: str,
    title: str,
    start_time: str,
    event_url: Optional[str] = None,
    end_time: Optional[str] = None,
    description: Optional[str] = None,
    location: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    title = _clean(title)
    if not title:
        return None
    if not start_time:
        return None

    event_url = _clean(event_url) or source_url
    return {
        "id": _event_id(source_name, title, start_time, event_url),
        "title": title,
        "description": _clean(description),
        "start_time": start_time,
        "end_time": end_time,
        "timezone": "America/Chicago",
        "location": _clean(location),
        "location_lat": None,
        "location_lng": None,
        "host_name": source_name.replace("_", " ").title(),
        "host_type": "department",
        "source_name": source_name,
        "source_url": source_url,
        "event_url": event_url,
        "tags": [],
        "audience": ["undergrad"],
        "campus": "college_station",
        "raw_payload": {},
    }


def _iter_jsonld_events(raw: Any) -> Iterable[Dict[str, Any]]:
    if isinstance(raw, dict):
        typ = raw.get("@type")
        if typ == "Event" or (isinstance(typ, list) and "Event" in typ):
            yield raw
        if isinstance(raw.get("@graph"), list):
            for item in raw["@graph"]:
                yield from _iter_jsonld_events(item)
    elif isinstance(raw, list):
        for item in raw:
            yield from _iter_jsonld_events(item)


def _extract_jsonld_events(soup: BeautifulSoup, source_name: str, source_url: str) -> List[Dict[str, Any]]:
    events: List[Dict[str, Any]] = []
    for script in soup.select('script[type="application/ld+json"]'):
        content = script.string or script.get_text(" ", strip=True)
        if not content:
            continue
        try:
            payload = json.loads(content)
        except Exception:
            continue

        for item in _iter_jsonld_events(payload):
            start_time = _safe_iso(item.get("startDate"))
            if not start_time:
                continue
            end_time = _safe_iso(item.get("endDate"))
            location = ""
            raw_location = item.get("location")
            if isinstance(raw_location, dict):
                location = raw_location.get("name") or raw_location.get("address") or ""
            elif raw_location:
                location = str(raw_location)

            event = _to_event(
                source_name=source_name,
                source_url=source_url,
                title=str(item.get("name") or ""),
                start_time=start_time,
                end_time=end_time,
                description=str(item.get("description") or ""),
                location=location,
                event_url=str(item.get("url") or source_url),
            )
            if event:
                events.append(event)
    return events


def _nearest_title(node: Tag) -> str:
    # Try heading in current container first, then parent container.
    heading = node.find(["h1", "h2", "h3", "h4"])
    if heading:
        return _clean(heading.get_text(" ", strip=True))
    for parent in node.parents:
        if not isinstance(parent, Tag):
            continue
        heading = parent.find(["h1", "h2", "h3", "h4"])
        if heading:
            return _clean(heading.get_text(" ", strip=True))
    link = node.find("a")
    if link:
        return _clean(link.get_text(" ", strip=True))
    return ""


def _extract_time_tag_events(soup: BeautifulSoup, source_name: str, source_url: str) -> List[Dict[str, Any]]:
    events: List[Dict[str, Any]] = []
    for time_node in soup.find_all("time"):
        if not isinstance(time_node, Tag):
            continue
        dt_text = time_node.get("datetime") or time_node.get_text(" ", strip=True)
        start_time = _safe_iso(dt_text)
        if not start_time:
            continue

        container = time_node.parent if isinstance(time_node.parent, Tag) else time_node
        title = _nearest_title(container)
        if not title:
            continue
        description = _clean(container.get_text(" ", strip=True))

        link = container.find("a")
        href = link.get("href") if isinstance(link, Tag) else None
        event_url = href if isinstance(href, str) and href else source_url

        event = _to_event(
            source_name=source_name,
            source_url=source_url,
            title=title,
            start_time=start_time,
            description=description,
            event_url=event_url,
        )
        if event:
            events.append(event)
    return events


def _dedupe(events: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    seen: set[str] = set()
    output: List[Dict[str, Any]] = []
    for event in events:
        key = str(event.get("id") or "")
        if not key:
            continue
        if key in seen:
            continue
        seen.add(key)
        output.append(event)
    return output


async def parse_html_events(
    body: str | None,
    source_name: str,
    source_url: str,
    **kwargs: Any,
) -> List[Dict[str, Any]]:
    """Parse events from a general HTML page using JSON-LD/time-tag fallbacks."""
    if not body:
        return []

    soup = BeautifulSoup(body, "lxml")
    events: List[Dict[str, Any]] = []
    events.extend(_extract_jsonld_events(soup, source_name, source_url))
    events.extend(_extract_time_tag_events(soup, source_name, source_url))
    deduped = _dedupe(events)
    logger.info("Parsed %d events from generic HTML source %s", len(deduped), source_name)
    return deduped


async def parse_html_multi_url(
    body: str | None,
    source_name: str,
    source_url: str,
    **kwargs: Any,
) -> List[Dict[str, Any]]:
    """Parse events from a seed page and optional list of additional URLs."""
    events: List[Dict[str, Any]] = []
    if body:
        events.extend(await parse_html_events(body, source_name, source_url))

    http_client = kwargs.get("http_client")
    urls = kwargs.get("urls") or []
    for url in urls:
        if not http_client:
            break
        try:
            page_body, status, _ = await http_client.fetch(url)
            if not page_body or status == 304:
                continue
            events.extend(await parse_html_events(page_body, source_name, url))
        except Exception as exc:
            logger.debug("Failed to parse supplemental URL %s (%s): %s", source_name, url, exc)

    deduped = _dedupe(events)
    logger.info("Parsed %d events from multi-url HTML source %s", len(deduped), source_name)
    return deduped
