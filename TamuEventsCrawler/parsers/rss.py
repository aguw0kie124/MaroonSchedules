"""RSS / iCal feed parser and feed-directory discovery."""

from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import Any, Dict, List, Optional
from urllib.parse import urljoin

import feedparser
from bs4 import BeautifulSoup
from dateutil import parser as dtparse

logger = logging.getLogger("tamu_crawler.parsers.rss")


def _clean_html(text: str | None) -> str:
    """Strip HTML tags and normalise whitespace."""
    if not text:
        return ""
    cleaned = re.sub(r"<[^>]+>", "", text)
    return re.sub(r"\s+", " ", cleaned).strip()


def _parse_feed_date(entry: Dict[str, Any]) -> Optional[datetime]:
    """Try multiple date fields from a feed entry."""
    for field in ("published_parsed", "updated_parsed"):
        if tp := entry.get(field):
            try:
                from time import mktime
                return datetime.fromtimestamp(mktime(tp))
            except Exception:
                continue

    for field in ("published", "updated", "dc_date"):
        if ds := entry.get(field):
            try:
                return dtparse.parse(ds)
            except (ValueError, TypeError):
                continue

    return None


def _parse_geo_point(value: Any) -> tuple[Optional[float], Optional[float]]:
    """Extract latitude/longitude from common RSS/GeoRSS point shapes."""
    if value is None:
        return None, None

    if isinstance(value, dict):
        coordinates = value.get("coordinates")
        if isinstance(coordinates, (list, tuple)) and len(coordinates) >= 2:
            try:
                # GeoJSON order is [lng, lat]
                lng = float(coordinates[0])
                lat = float(coordinates[1])
                return lat, lng
            except (TypeError, ValueError):
                return None, None

    text = str(value).strip()
    if not text:
        return None, None

    # GeoRSS point commonly uses "lat lon"
    match = re.match(r"^\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*$", text)
    if match:
        try:
            return float(match.group(1)), float(match.group(2))
        except (TypeError, ValueError):
            return None, None

    # Some feeds expose a dict-like string such as:
    # {'type': 'Point', 'coordinates': (-96.337971, 30.617684)}
    match = re.search(
        r"coordinates['\"]?\s*:\s*\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)",
        text,
    )
    if match:
        try:
            lng = float(match.group(1))
            lat = float(match.group(2))
            return lat, lng
        except (TypeError, ValueError):
            return None, None

    return None, None


def _parse_feed_entry(
    entry: Any,
    source_name: str,
    feed_url: str,
) -> Optional[Dict[str, Any]]:
    """Parse a single feedparser entry into a normalised event dict."""
    title = _clean_html(getattr(entry, "title", ""))
    if not title:
        return None

    start_time = _parse_feed_date(entry)
    if not start_time:
        start_time = datetime.utcnow()

    description = _clean_html(getattr(entry, "summary", "") or getattr(entry, "description", ""))
    link = getattr(entry, "link", "") or ""

    # Extract geo coordinates
    lat, lng = None, None
    if hasattr(entry, "geo_lat") and hasattr(entry, "geo_long"):
        try:
            lat = float(entry.geo_lat)
            lng = float(entry.geo_long)
        except (ValueError, TypeError):
            pass

    # Try to extract location from content or custom fields
    location = None
    if hasattr(entry, "where"):
        where_value = getattr(entry, "where")
        if lat is None or lng is None:
            lat, lng = _parse_geo_point(where_value)
        if not isinstance(where_value, dict):
            location = _clean_html(str(where_value))
    elif hasattr(entry, "georss_point"):
        georss_value = getattr(entry, "georss_point")
        if lat is None or lng is None:
            lat, lng = _parse_geo_point(georss_value)
        if lat is None or lng is None:
          location = str(georss_value)

    # Generate a stable ID
    entry_id = getattr(entry, "id", "") or link or title
    safe_id = re.sub(r"[^a-zA-Z0-9]", "_", entry_id)[:80]

    # Tags / categories
    tags = []
    if hasattr(entry, "tags"):
        for tag in entry.tags:
            if hasattr(tag, "term"):
                tags.append(tag.term)

    return {
        "id": f"tamu:rss:{safe_id}",
        "title": title,
        "description": description[:2000] if description else None,
        "start_time": start_time.isoformat(),
        "end_time": None,
        "timezone": "America/Chicago",
        "location": location,
        "location_lat": lat,
        "location_lng": lng,
        "host_name": source_name,
        "host_type": "department",
        "source_name": source_name,
        "source_url": feed_url,
        "event_url": link or None,
        "tags": tags,
        "audience": ["undergrad"],
        "campus": "college_station",
        "raw_payload": {
            "title": title,
            "link": link,
            "summary": description[:500] if description else "",
        },
    }


async def parse_rss_feed(
    body: str,
    source_name: str,
    feed_url: str,
) -> List[Dict[str, Any]]:
    """Parse a single RSS/Atom feed body into event dicts."""
    feed = feedparser.parse(body)
    events: List[Dict[str, Any]] = []

    for entry in feed.entries:
        event = _parse_feed_entry(entry, source_name, feed_url)
        if event:
            events.append(event)

    logger.info("Parsed %d entries from RSS feed %s", len(events), feed_url)
    return events


async def discover_feed_urls(
    body: str,
    base_url: str,
) -> List[str]:
    """Discover individual feed URLs from the TAMU calendar feeds directory page."""
    soup = BeautifulSoup(body, "lxml")
    feed_urls: List[str] = []

    # Look for links to RSS/Atom/iCal feeds
    for a in soup.find_all("a", href=True):
        href = a["href"]
        lower_href = href.lower()

        # Match common feed extensions and patterns
        if any(
            pattern in lower_href
            for pattern in (".rss", ".xml", ".atom", ".ics", "/rss", "/feed", "format=rss")
        ):
            full_url = urljoin(base_url, href)
            if full_url not in feed_urls:
                feed_urls.append(full_url)

    # Also look for <link> tags with feed types
    for link in soup.find_all("link", type=re.compile(r"rss|atom|xml", re.I)):
        href = link.get("href", "")
        if href:
            full_url = urljoin(base_url, href)
            if full_url not in feed_urls:
                feed_urls.append(full_url)

    logger.info("Discovered %d feed URLs from %s", len(feed_urls), base_url)
    return feed_urls


async def parse_rss_directory(
    body: str | None,
    source_name: str,
    source_url: str,
    *,
    http_client: Any = None,
    **kwargs: Any,
) -> List[Dict[str, Any]]:
    """Parse the TAMU feeds directory page: discover feeds, then parse each.

    This requires the http_client to fetch individual feeds discovered
    from the directory page.
    """
    if not body:
        return []

    # Step 1: Discover feed URLs from the directory page
    feed_urls = await discover_feed_urls(body, source_url)

    if not feed_urls:
        logger.warning("No feed URLs discovered from %s", source_url)
        return []

    if not http_client:
        logger.warning("No HTTP client provided; cannot fetch individual feeds")
        return []

    # Step 2: Fetch and parse each feed (up to 20 to avoid overload)
    all_events: List[Dict[str, Any]] = []
    max_feeds = 20

    for i, feed_url in enumerate(feed_urls[:max_feeds]):
        try:
            feed_body, status, _ = await http_client.fetch(feed_url, use_conditional=True)
            if feed_body and status == 200:
                feed_name = f"{source_name}:feed_{i}"
                events = await parse_rss_feed(feed_body, feed_name, feed_url)
                all_events.extend(events)
        except Exception as exc:
            logger.warning("Failed to fetch/parse feed %s: %s", feed_url, exc)
            continue

    logger.info(
        "Total %d events from %d feeds (of %d discovered) at %s",
        len(all_events),
        min(len(feed_urls), max_feeds),
        len(feed_urls),
        source_url,
    )
    return all_events
