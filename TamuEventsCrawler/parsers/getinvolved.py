"""GetInvolved HTML parsers for events and organisation listings."""

from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import Any, Dict, List, Optional
from urllib.parse import urljoin

from bs4 import BeautifulSoup
from dateutil import parser as dtparse

logger = logging.getLogger("tamu_crawler.parsers.getinvolved")

BASE_URL = "https://getinvolved.tamu.edu"


def _clean_text(text: str | None) -> str:
    """Normalise whitespace and strip."""
    if not text:
        return ""
    return re.sub(r"\s+", " ", text).strip()


# ---------------------------------------------------------------------------
# Events parser
# ---------------------------------------------------------------------------


async def parse_getinvolved_events(
    body: str | None,
    source_name: str,
    source_url: str,
    **kwargs: Any,
) -> List[Dict[str, Any]]:
    """Parse the GetInvolved events page HTML.

    The page uses CampusLabs Engage; events are typically rendered as cards
    or list items. We attempt multiple selector strategies.
    """
    if not body:
        return []

    soup = BeautifulSoup(body, "lxml")
    events: List[Dict[str, Any]] = []

    # Strategy 1: Look for event card divs (common Engage pattern)
    cards = soup.select(
        "div[class*='event'], article[class*='event'], "
        "div[data-testid*='event'], div.MuiCard-root, "
        "a[href*='/event/'], div[class*='EventCard']"
    )

    if not cards:
        # Strategy 2: Look for any links containing /event/ paths
        cards = soup.find_all("a", href=re.compile(r"/event/\d+"))

    for card in cards:
        try:
            event = _parse_event_card(card, source_name, source_url)
            if event:
                events.append(event)
        except Exception as exc:
            logger.debug("Error parsing event card: %s", exc)
            continue

    # Strategy 3: Try JSON-LD structured data
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            import json
            data = json.loads(script.string or "")
            if isinstance(data, list):
                for item in data:
                    if item.get("@type") == "Event":
                        event = _parse_jsonld_event(item, source_name, source_url)
                        if event:
                            events.append(event)
            elif isinstance(data, dict) and data.get("@type") == "Event":
                event = _parse_jsonld_event(data, source_name, source_url)
                if event:
                    events.append(event)
        except Exception:
            continue

    logger.info(
        "Parsed %d events from GetInvolved events page", len(events)
    )
    return events


def _parse_event_card(
    element: Any, source_name: str, source_url: str
) -> Optional[Dict[str, Any]]:
    """Extract event data from an HTML card element."""
    # Title
    title_el = (
        element.find(["h2", "h3", "h4", "span"], class_=re.compile(r"title|name|heading", re.I))
        or element.find(["h2", "h3", "h4"])
    )
    title = _clean_text(title_el.get_text() if title_el else element.get_text())
    if not title or len(title) < 3:
        return None

    # Link
    link = None
    if element.name == "a":
        link = element.get("href", "")
    else:
        a_tag = element.find("a", href=True)
        if a_tag:
            link = a_tag["href"]
    if link and not link.startswith("http"):
        link = urljoin(BASE_URL, link)

    # Extract event ID from URL
    event_id = ""
    if link:
        id_match = re.search(r"/event/(\d+)", link)
        if id_match:
            event_id = id_match.group(1)
    if not event_id:
        event_id = re.sub(r"\W+", "_", title.lower())[:50]

    # Date
    date_el = element.find(
        ["time", "span", "div", "p"],
        class_=re.compile(r"date|time|when", re.I),
    )
    start_time = None
    if date_el:
        date_text = date_el.get("datetime") or _clean_text(date_el.get_text())
        try:
            start_time = dtparse.parse(date_text, fuzzy=True)
        except (ValueError, TypeError):
            pass

    if not start_time:
        # Try to find any datetime-ish text
        for tag in element.find_all(["time", "span"]):
            dt_attr = tag.get("datetime")
            if dt_attr:
                try:
                    start_time = dtparse.parse(dt_attr)
                    break
                except (ValueError, TypeError):
                    continue

    if not start_time:
        start_time = datetime.utcnow()  # fallback

    # Location
    loc_el = element.find(
        ["span", "div", "p"],
        class_=re.compile(r"location|place|venue|where", re.I),
    )
    location = _clean_text(loc_el.get_text()) if loc_el else None

    # Description
    desc_el = element.find(
        ["p", "div", "span"],
        class_=re.compile(r"desc|summary|body|detail", re.I),
    )
    description = _clean_text(desc_el.get_text()) if desc_el else None

    # Host / org
    host_el = element.find(
        ["span", "div", "p", "a"],
        class_=re.compile(r"org|host|author|group", re.I),
    )
    host_name = _clean_text(host_el.get_text()) if host_el else None

    return {
        "id": f"tamu:getinvolved:event:{event_id}",
        "title": title,
        "description": description,
        "start_time": start_time.isoformat(),
        "end_time": None,
        "timezone": "America/Chicago",
        "location": location,
        "location_lat": None,
        "location_lng": None,
        "host_name": host_name,
        "host_type": "student_org",
        "source_name": source_name,
        "source_url": source_url,
        "event_url": link,
        "tags": [],
        "audience": ["undergrad"],
        "campus": "college_station",
        "raw_payload": {"html_text": element.get_text()[:1000]},
    }


def _parse_jsonld_event(
    data: Dict[str, Any], source_name: str, source_url: str
) -> Optional[Dict[str, Any]]:
    """Parse a JSON-LD Event object."""
    title = data.get("name", "")
    if not title:
        return None

    start_time = None
    if sd := data.get("startDate"):
        try:
            start_time = dtparse.parse(sd)
        except (ValueError, TypeError):
            pass

    end_time = None
    if ed := data.get("endDate"):
        try:
            end_time = dtparse.parse(ed)
        except (ValueError, TypeError):
            pass

    location = None
    if loc := data.get("location"):
        if isinstance(loc, dict):
            location = loc.get("name") or loc.get("address", {}).get("streetAddress")
        elif isinstance(loc, str):
            location = loc

    return {
        "id": f"tamu:getinvolved:jsonld:{re.sub(r'[^a-z0-9]', '_', title.lower())[:50]}",
        "title": title,
        "description": data.get("description"),
        "start_time": start_time.isoformat() if start_time else datetime.utcnow().isoformat(),
        "end_time": end_time.isoformat() if end_time else None,
        "timezone": "America/Chicago",
        "location": location,
        "location_lat": None,
        "location_lng": None,
        "host_name": data.get("organizer", {}).get("name") if isinstance(data.get("organizer"), dict) else None,
        "host_type": "student_org",
        "source_name": source_name,
        "source_url": source_url,
        "event_url": data.get("url"),
        "tags": [],
        "audience": ["undergrad"],
        "campus": "college_station",
        "raw_payload": data,
    }


# ---------------------------------------------------------------------------
# Organizations parser (paginated)
# ---------------------------------------------------------------------------


async def parse_getinvolved_orgs(
    body: str | None,
    source_name: str,
    source_url: str,
    **kwargs: Any,
) -> List[Dict[str, Any]]:
    """Parse the GetInvolved organisations listing page.

    Extracts org names, profile URLs, and categories. These aren't events
    themselves but are stored as discovery metadata for future crawling.
    """
    if not body:
        return []

    soup = BeautifulSoup(body, "lxml")
    orgs: List[Dict[str, Any]] = []

    # CampusLabs Engage org cards
    cards = soup.select(
        "div[class*='org'], div[class*='Organization'], "
        "a[href*='/organization/'], div.MuiCard-root"
    )

    if not cards:
        # Fallback: any link to /organization/
        cards = soup.find_all("a", href=re.compile(r"/organization/"))

    seen_names = set()
    for card in cards:
        try:
            name_el = (
                card.find(["h2", "h3", "h4", "span"], class_=re.compile(r"name|title", re.I))
                or card.find(["h2", "h3", "h4"])
            )
            name = _clean_text(name_el.get_text() if name_el else card.get_text())
            if not name or name in seen_names or len(name) < 2:
                continue
            seen_names.add(name)

            link = None
            if card.name == "a":
                link = card.get("href", "")
            else:
                a_tag = card.find("a", href=True)
                if a_tag:
                    link = a_tag["href"]
            if link and not link.startswith("http"):
                link = urljoin(BASE_URL, link)

            # Category / type
            cat_el = card.find(
                ["span", "div", "p"],
                class_=re.compile(r"category|type|tag", re.I),
            )
            category = _clean_text(cat_el.get_text()) if cat_el else ""

            orgs.append({
                "org_name": name,
                "org_url": link,
                "category": category,
                "source_name": source_name,
            })
        except Exception as exc:
            logger.debug("Error parsing org card: %s", exc)
            continue

    logger.info(
        "Parsed %d organisations from GetInvolved page", len(orgs)
    )
    return orgs


# ---------------------------------------------------------------------------
# Search parser (reuses event card parsing on search result pages)
# ---------------------------------------------------------------------------


async def parse_getinvolved_search(
    body: str | None,
    source_name: str,
    source_url: str,
    **kwargs: Any,
) -> List[Dict[str, Any]]:
    """Parse GetInvolved search results page for events.

    This reuses the same event card extraction logic from the events parser,
    but is designed to work on search result pages (e.g. ?query=SEC).
    """
    if not body:
        return []

    # Reuse the same parsing logic as the events page
    events = await parse_getinvolved_events(body, source_name, source_url, **kwargs)

    # Tag events found via search with the search context
    query = kwargs.get("query", "")
    for event in events:
        if query:
            event.setdefault("tags", []).append(f"search:{query}")

    logger.info(
        "Search parser found %d events for source %s (url: %s)",
        len(events), source_name, source_url[:80],
    )
    return events
