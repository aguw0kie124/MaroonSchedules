"""Generic HTML event parser for TAMU department/program pages.

Handles:
- McFerrin programs and events pages
- Mays undergraduate events
- Career Center events
- SEC home page
- Any TAMU page with event cards, listings, or program detail pages

Link-following discipline:
- MAX_DEPTH = 2 from seed URLs
- Only follows links containing event-related keywords
- Stops at PDFs, images, login pages, external domains
"""

from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import Any, Dict, List, Optional, Set
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup, Tag
from dateutil import parser as dtparse

logger = logging.getLogger("tamu_crawler.parsers.html_generic")

# Link-following keywords — only follow links containing these
FOLLOW_KEYWORDS = {
    "event", "events", "calendar", "program", "programs",
    "seminar", "seminars", "colloquium", "colloquia",
    "speaker", "speakers", "competition", "pitch",
    "fair", "fairs", "reception", "lunch", "mixer",
    "social", "rsvp", "register", "registration",
    "workshop", "workshops", "lecture", "lectures",
    "schedule", "upcoming", "news",
}

# Blocked extensions and paths
BLOCKED_EXTENSIONS = {".pdf", ".docx", ".doc", ".xlsx", ".pptx", ".jpg", ".jpeg",
                      ".png", ".gif", ".svg", ".zip", ".mp4", ".mp3", ".wav"}
BLOCKED_PATHS = {"login", "signin", "sign-in", "authenticate", "admin",
                 "wp-admin", "cart", "checkout"}


def _clean_text(text: str | None) -> str:
    """Normalise whitespace and strip."""
    if not text:
        return ""
    return re.sub(r"\s+", " ", text).strip()


def _strip_html(html: str | None) -> str:
    """Remove HTML tags."""
    if not html:
        return ""
    return re.sub(r"<[^>]+>", "", html).strip()


def _is_valid_follow_url(url: str, base_domain: str) -> bool:
    """Check if a URL is valid to follow (same domain, not blocked)."""
    parsed = urlparse(url)
    # Must be same domain or tamu.edu subdomain
    if not parsed.netloc:
        return True  # relative URL
    if "tamu.edu" not in parsed.netloc:
        return False
    # Check blocked extensions
    path_lower = parsed.path.lower()
    for ext in BLOCKED_EXTENSIONS:
        if path_lower.endswith(ext):
            return False
    # Check blocked paths
    for bp in BLOCKED_PATHS:
        if bp in path_lower:
            return False
    return True


def _url_has_event_keyword(url: str) -> bool:
    """Check if URL path contains an event-related keyword."""
    path = urlparse(url).path.lower()
    return any(kw in path for kw in FOLLOW_KEYWORDS)


def _extract_dates_from_text(text: str) -> Optional[datetime]:
    """Try to extract a date from free-form text."""
    if not text:
        return None
    # Clean common noise
    cleaned = re.sub(r"\s+", " ", text.strip())
    if len(cleaned) < 4 or len(cleaned) > 200:
        return None
    try:
        return dtparse.parse(cleaned, fuzzy=True)
    except (ValueError, TypeError, OverflowError):
        return None


def _parse_event_from_card(
    element: Tag,
    source_name: str,
    source_url: str,
    base_url: str,
) -> Optional[Dict[str, Any]]:
    """Extract an event from a card/list-item element."""
    # Title
    title_el = (
        element.find(["h1", "h2", "h3", "h4", "h5"], class_=re.compile(r"title|name|heading", re.I))
        or element.find(["h1", "h2", "h3", "h4", "h5"])
    )
    if not title_el:
        # Try strong, span, or link text
        title_el = element.find(["strong", "a"])
    title = _clean_text(title_el.get_text() if title_el else "")
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
        link = urljoin(base_url, link)

    # Date
    date_el = element.find(
        ["time", "span", "div", "p"],
        class_=re.compile(r"date|time|when|schedule", re.I),
    )
    start_time = None
    if date_el:
        dt_attr = date_el.get("datetime")
        if dt_attr:
            try:
                start_time = dtparse.parse(dt_attr)
            except (ValueError, TypeError):
                pass
        if not start_time:
            start_time = _extract_dates_from_text(_clean_text(date_el.get_text()))

    # Also check for datetime attribute on any child
    if not start_time:
        for tag in element.find_all("time"):
            dt = tag.get("datetime")
            if dt:
                try:
                    start_time = dtparse.parse(dt)
                    break
                except (ValueError, TypeError):
                    continue

    # Location
    loc_el = element.find(
        ["span", "div", "p"],
        class_=re.compile(r"location|place|venue|where|address", re.I),
    )
    location = _clean_text(loc_el.get_text()) if loc_el else None

    # Description
    desc_el = element.find(
        ["p", "div", "span"],
        class_=re.compile(r"desc|summary|body|detail|excerpt|content", re.I),
    )
    description = _clean_text(desc_el.get_text()) if desc_el else None

    # If no description found, use first <p> child
    if not description:
        p_tag = element.find("p")
        if p_tag:
            description = _clean_text(p_tag.get_text())

    # Generate ID
    safe_title = re.sub(r"[^a-z0-9]", "_", title.lower())[:50]
    event_id = f"tamu:html:{source_name}:{safe_title}"

    return {
        "id": event_id,
        "title": title,
        "description": description,
        "start_time": start_time.isoformat() if start_time else None,
        "end_time": None,
        "timezone": "America/Chicago",
        "location": location,
        "location_lat": None,
        "location_lng": None,
        "host_name": source_name,
        "host_type": "department",
        "source_name": source_name,
        "source_url": source_url,
        "source_links": [source_url],
        "event_url": link,
        "discovered_via": source_url,
        "crawl_path": [source_url],
        "tags": [],
        "audience": ["undergrad"],
        "campus": "college_station",
        "raw_payload": {"html_text": element.get_text()[:1500]},
    }


def _extract_program_as_event(
    element: Tag,
    source_name: str,
    source_url: str,
    base_url: str,
) -> Optional[Dict[str, Any]]:
    """Extract a program/initiative as a discoverable event (McFerrin-style)."""
    # Title
    title_el = element.find(["h1", "h2", "h3", "h4", "h5", "a", "strong"])
    title = _clean_text(title_el.get_text() if title_el else "")
    if not title or len(title) < 3:
        return None

    # Link
    link = None
    a_tag = element.find("a", href=True)
    if a_tag:
        link = a_tag.get("href", "")
    if element.name == "a":
        link = element.get("href", "")
    if link and not link.startswith("http"):
        link = urljoin(base_url, link)

    # Description
    desc_el = element.find(["p", "div"], class_=re.compile(r"desc|excerpt|summary|text|content", re.I))
    if not desc_el:
        desc_el = element.find("p")
    description = _clean_text(desc_el.get_text())[:2000] if desc_el else None

    safe_title = re.sub(r"[^a-z0-9]", "_", title.lower())[:50]
    event_id = f"tamu:program:{source_name}:{safe_title}"

    return {
        "id": event_id,
        "title": title,
        "description": description,
        "start_time": None,  # Programs may not have specific dates on listing pages
        "end_time": None,
        "timezone": "America/Chicago",
        "location": None,
        "location_lat": None,
        "location_lng": None,
        "host_name": source_name,
        "host_type": "program",
        "source_name": source_name,
        "source_url": source_url,
        "source_links": [source_url],
        "event_url": link,
        "discovered_via": source_url,
        "crawl_path": [source_url],
        "tags": ["program"],
        "audience": ["undergrad"],
        "campus": "college_station",
        "raw_payload": {"html_text": element.get_text()[:1500]},
    }


def _extract_discoverable_links(soup: BeautifulSoup, base_url: str) -> List[str]:
    """Extract links worth following for event discovery (depth 1→2)."""
    links: List[str] = []
    base_domain = urlparse(base_url).netloc

    for a in soup.find_all("a", href=True):
        href = a["href"]
        full_url = urljoin(base_url, href) if not href.startswith("http") else href

        if not _is_valid_follow_url(full_url, base_domain):
            continue

        # Check link text and URL for event keywords
        link_text = _clean_text(a.get_text()).lower()
        if _url_has_event_keyword(full_url) or any(kw in link_text for kw in FOLLOW_KEYWORDS):
            if full_url not in links:
                links.append(full_url)

    return links


def _parse_detail_page(
    soup: BeautifulSoup,
    source_name: str,
    source_url: str,
    parent_url: str,
) -> List[Dict[str, Any]]:
    """Parse a detail/program page for event info (dates, descriptions, etc)."""
    events: List[Dict[str, Any]] = []

    # Try to get the main title
    title_el = soup.find("h1") or soup.find("h2")
    title = _clean_text(title_el.get_text()) if title_el else ""
    if not title:
        return []

    # Try to get description from main content
    main_content = (
        soup.find("main")
        or soup.find("article")
        or soup.find("div", class_=re.compile(r"content|main|body|entry", re.I))
        or soup.find("div", id=re.compile(r"content|main", re.I))
    )
    description = ""
    if main_content:
        paragraphs = main_content.find_all("p")
        description = " ".join(_clean_text(p.get_text()) for p in paragraphs[:10])

    # Look for dates on the page
    dates_found: List[datetime] = []

    # Check for structured date elements
    for time_el in soup.find_all("time"):
        dt = time_el.get("datetime")
        if dt:
            try:
                dates_found.append(dtparse.parse(dt))
            except (ValueError, TypeError):
                pass

    # Check for date-like elements
    for el in soup.find_all(["span", "div", "p"], class_=re.compile(r"date|when|time|schedule", re.I)):
        dt = _extract_dates_from_text(_clean_text(el.get_text()))
        if dt:
            dates_found.append(dt)

    # If no structured dates, try to find dates in the text
    if not dates_found and description:
        # Look for common date patterns
        date_patterns = [
            r"(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s*\d{4}",
            r"\d{1,2}/\d{1,2}/\d{2,4}",
        ]
        for pattern in date_patterns:
            matches = re.findall(pattern, description, re.I)
            for match in matches[:3]:  # Limit to first 3 dates
                try:
                    dates_found.append(dtparse.parse(match))
                except (ValueError, TypeError):
                    continue

    # Location
    loc_el = soup.find(["span", "div", "p"], class_=re.compile(r"location|venue|where|address", re.I))
    location = _clean_text(loc_el.get_text()) if loc_el else None

    safe_title = re.sub(r"[^a-z0-9]", "_", title.lower())[:50]

    if dates_found:
        # Create an event for each date found
        for i, dt in enumerate(dates_found[:5]):
            event_id = f"tamu:detail:{source_name}:{safe_title}:{i}"
            events.append({
                "id": event_id,
                "title": title,
                "description": description[:2000] if description else None,
                "start_time": dt.isoformat(),
                "end_time": None,
                "timezone": "America/Chicago",
                "location": location,
                "location_lat": None,
                "location_lng": None,
                "host_name": source_name,
                "host_type": "program",
                "source_name": source_name,
                "source_url": source_url,
                "source_links": [parent_url, source_url],
                "event_url": source_url,
                "discovered_via": parent_url,
                "crawl_path": [parent_url, source_url],
                "tags": ["program"],
                "audience": ["undergrad"],
                "campus": "college_station",
                "raw_payload": {"title": title, "description": description[:500] if description else ""},
            })
    else:
        # No dates found — still record as a program/event placeholder
        events.append({
            "id": f"tamu:detail:{source_name}:{safe_title}",
            "title": title,
            "description": description[:2000] if description else None,
            "start_time": None,
            "end_time": None,
            "timezone": "America/Chicago",
            "location": location,
            "location_lat": None,
            "location_lng": None,
            "host_name": source_name,
            "host_type": "program",
            "source_name": source_name,
            "source_url": source_url,
            "source_links": [parent_url, source_url],
            "event_url": source_url,
            "discovered_via": parent_url,
            "crawl_path": [parent_url, source_url],
            "tags": ["program"],
            "audience": ["undergrad"],
            "campus": "college_station",
            "raw_payload": {"title": title, "description": description[:500] if description else ""},
        })

    return events


async def parse_html_events(
    body: str | None,
    source_name: str,
    source_url: str,
    **kwargs: Any,
) -> List[Dict[str, Any]]:
    """Parse a single HTML events page for event cards/listings.

    Also extracts JSON-LD structured data if present.
    """
    if not body:
        return []

    soup = BeautifulSoup(body, "lxml")
    events: List[Dict[str, Any]] = []
    base_url = source_url

    # --- Strategy 1: JSON-LD structured data ---
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            import json
            data = json.loads(script.string or "")
            items = data if isinstance(data, list) else [data]
            for item in items:
                if isinstance(item, dict) and item.get("@type") == "Event":
                    event = _parse_jsonld(item, source_name, source_url)
                    if event:
                        events.append(event)
        except Exception:
            continue

    # --- Strategy 2: Event cards / list items ---
    card_selectors = [
        "div[class*='event']", "article[class*='event']",
        "li[class*='event']", "div[class*='program']",
        "article[class*='program']", "div[class*='card']",
        "article", "div.entry", "div.post",
        "div[class*='listing']", "li[class*='listing']",
    ]
    seen_titles: Set[str] = set()

    for selector in card_selectors:
        cards = soup.select(selector)
        for card in cards:
            event = _parse_event_from_card(card, source_name, source_url, base_url)
            if event and event["title"] not in seen_titles:
                seen_titles.add(event["title"])
                events.append(event)

    # --- Strategy 2.5: Table-based events (Department Seminars) ---
    for table in soup.find_all("table"):
        # Check if table has a Date, Speaker, or Title column
        headers = [th.get_text().strip().lower() for th in table.find_all(["th", "td"])[:10]]
        has_date = any(h for h in headers if "date" in h or "time" in h)
        has_title_or_speaker = any(h for h in headers if "title" in h or "speaker" in h or "event" in h)
        
        if not (has_date and has_title_or_speaker):
            # Also try if the table is just rows of dates without headers
            continue
            
        for row in table.find_all("tr"):
            cells = row.find_all(["td", "th"])
            if not cells or len(cells) < 2:
                continue
                
            cell_texts = [_clean_text(c.get_text()) for c in cells]
            
            # Heuristic: Find the first cell that parses as a date
            start_time = None
            date_text = ""
            for text in cell_texts[:3]:
                dt = _extract_dates_from_text(text)
                if dt:
                    start_time = dt
                    date_text = text
                    break
                    
            if not start_time:
                continue
                
            # If the row is just a calendar date without content, skip
            content = [t for t in cell_texts if t != date_text and len(t) > 3]
            if not content:
                continue
                
            title = content[0]
            description = " | ".join(content[1:]) if len(content) > 1 else None
            
            # Look for links in the row
            link = None
            a_tag = row.find("a", href=True)
            if a_tag:
                link = a_tag["href"]
                if not link.startswith("http"):
                    link = urljoin(base_url, link)
                    
            safe_title = re.sub(r"[^a-z0-9]", "_", title.lower())[:50]
            event_id = f"tamu:table:{source_name}:{safe_title}"
            
            if title not in seen_titles:
                seen_titles.add(title)
                events.append({
                    "id": event_id,
                    "title": title,
                    "description": description,
                    "start_time": start_time.isoformat(),
                    "end_time": None,
                    "timezone": "America/Chicago",
                    "location": None,
                    "location_lat": None,
                    "location_lng": None,
                    "host_name": source_name,
                    "host_type": "department",
                    "source_name": source_name,
                    "source_url": source_url,
                    "source_links": [source_url],
                    "event_url": link or source_url,
                    "discovered_via": source_url,
                    "crawl_path": [source_url],
                    "tags": [],
                    "audience": ["undergrad"],
                    "campus": "college_station",
                    "raw_payload": {"html_text": " | ".join(cell_texts)},
                })

    # --- Strategy 3: Program / initiative listings (McFerrin-style) ---
    program_selectors = [
        "div[class*='program']", "div[class*='initiative']",
        "article[class*='program']", "div[class*='feature']",
        "div[class*='card']",
    ]
    for selector in program_selectors:
        cards = soup.select(selector)
        for card in cards:
            event = _extract_program_as_event(card, source_name, source_url, base_url)
            if event and event["title"] not in seen_titles:
                seen_titles.add(event["title"])
                events.append(event)

    # --- Strategy 4: Main content parsing (detail page) ---
    # If no events found, or only 1 generic event was found (e.g. the whole page was treating as a single card by Strategy 3) and it had a short description.
    if not events or (len(events) == 1 and len(events[0].get("description") or "") < 100):
        detail_events = _parse_detail_page(soup, source_name, source_url, source_url)
        if detail_events:
            # Prefer the detail parser's output over the generic card parser
            if events:
                events.clear()
            events.extend(detail_events)

    logger.info("Parsed %d events from HTML page %s", len(events), source_url[:80])
    return events


async def parse_multi_url_events(
    body: str | None,
    source_name: str,
    source_url: str,
    *,
    http_client: Any = None,
    urls: List[str] | None = None,
    **kwargs: Any,
) -> List[Dict[str, Any]]:
    """Parse multiple URLs for events (e.g., McFerrin program pages).

    First parses the body (if given), then follows discovered links
    and explicit URLs, respecting MAX_DEPTH = 2.
    """
    all_events: List[Dict[str, Any]] = []
    visited: Set[str] = set()

    # Parse the initial body
    if body:
        events = await parse_html_events(body, source_name, source_url)
        all_events.extend(events)
        visited.add(source_url)

        # Discover followable links (depth 1)
        soup = BeautifulSoup(body, "lxml")
        discovered = _extract_discoverable_links(soup, source_url)
        logger.info("Discovered %d followable links from %s", len(discovered), source_url[:60])

    # Explicit URL list (from source config)
    explicit_urls = urls or []

    # Combine discovered + explicit, avoiding duplicates
    urls_to_crawl = list(dict.fromkeys(explicit_urls + (discovered if body else [])))

    if not http_client:
        logger.warning("No HTTP client for multi-URL source %s", source_name)
        return all_events

    # Crawl each URL (depth 1 from seed)
    for url in urls_to_crawl:
        if url in visited:
            continue
        visited.add(url)

        try:
            sub_body, status, _ = await http_client.fetch(url)
            if not sub_body or status == 304:
                continue

            sub_events = await parse_html_events(sub_body, source_name, url)

            # Update crawl_path for discovered events
            for evt in sub_events:
                evt["discovered_via"] = source_url
                evt["crawl_path"] = [source_url, url]
                if url not in evt.get("source_links", []):
                    evt.setdefault("source_links", []).append(url)

            all_events.extend(sub_events)

            # Depth 2: discover links from this page too
            sub_soup = BeautifulSoup(sub_body, "lxml")
            depth2_links = _extract_discoverable_links(sub_soup, url)

            for d2_url in depth2_links[:10]:  # Cap depth-2 follows
                if d2_url in visited:
                    continue
                visited.add(d2_url)

                try:
                    d2_body, d2_status, _ = await http_client.fetch(d2_url)
                    if not d2_body or d2_status == 304:
                        continue
                    d2_events = await parse_html_events(d2_body, source_name, d2_url)
                    for evt in d2_events:
                        evt["discovered_via"] = url
                        evt["crawl_path"] = [source_url, url, d2_url]
                        evt.setdefault("source_links", []).extend([url, d2_url])
                    all_events.extend(d2_events)
                except Exception as exc:
                    logger.debug("Depth-2 fetch error %s: %s", d2_url[:60], exc)

        except Exception as exc:
            logger.warning("Error fetching %s for %s: %s", url[:60], source_name, exc)

    logger.info(
        "Multi-URL source %s: %d total events from %d pages",
        source_name, len(all_events), len(visited),
    )
    return all_events


def _parse_jsonld(data: Dict[str, Any], source_name: str, source_url: str) -> Optional[Dict[str, Any]]:
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

    safe_title = re.sub(r"[^a-z0-9]", "_", title.lower())[:50]

    return {
        "id": f"tamu:jsonld:{source_name}:{safe_title}",
        "title": title,
        "description": data.get("description"),
        "start_time": start_time.isoformat() if start_time else None,
        "end_time": end_time.isoformat() if end_time else None,
        "timezone": "America/Chicago",
        "location": location,
        "location_lat": None,
        "location_lng": None,
        "host_name": data.get("organizer", {}).get("name") if isinstance(data.get("organizer"), dict) else source_name,
        "host_type": "department",
        "source_name": source_name,
        "source_url": source_url,
        "source_links": [source_url],
        "event_url": data.get("url"),
        "discovered_via": source_url,
        "crawl_path": [source_url],
        "tags": [],
        "audience": ["undergrad"],
        "campus": "college_station",
        "raw_payload": data,
    }
