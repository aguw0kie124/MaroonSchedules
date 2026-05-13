from __future__ import annotations

import html as html_lib
import logging
import re
from datetime import datetime
from typing import Any

from bs4 import BeautifulSoup

from ..date_utils import infer_recurrence_rule, next_window_from_recurrence, parse_event_datetime
from ..models import BusinessRecord
from ..normalizer import normalize_candidate
from ..utils import clean_text
from .shared_parsers import extract_jsonld_objects

logger = logging.getLogger("tamu_crawler.business_deals.century_square")


CENTURY_SQUARE_URL = "https://www.century-square.com/events/"


async def crawl_century_square_events(
    *,
    http_client: Any,
    business_records: list[BusinessRecord],
) -> list[Any]:
    body, status, _ = await http_client.fetch(CENTURY_SQUARE_URL, use_conditional=False)
    if not body or status >= 400:
        return []

    soup = BeautifulSoup(body, "html.parser")
    jsonld_events = [
        item
        for item in extract_jsonld_objects(body)
        if clean_text(str(item.get("@type"))).lower() == "event"
    ]

    normalized_records = []
    for index, card in enumerate(soup.select(".events-item")):
        try:
            title = clean_text(card.select_one("article h2").get_text(" ", strip=True))
            short_description = clean_text(card.select_one("article .content p").get_text(" ", strip=True))
            long_description = clean_text(
                html_lib.unescape(card.select_one(".popup-content .content").get_text(" ", strip=True))
            )
            month = clean_text(card.select_one(".date h5").get_text(" ", strip=True))
            day = clean_text(card.select_one(".date h4").get_text(" ", strip=True))
            year_nodes = card.select(".date h5")
            year = clean_text(year_nodes[-1].get_text(" ", strip=True)) if year_nodes else str(datetime.now().year)
            date_text = f"{month} {day} {year}"
            time_text = clean_text(card.select_one(".popup-content .time h5").get_text(" ", strip=True)) if card.select_one(".popup-content .time h5") else None
            start_date, end_date = parse_event_datetime(date_text, time_text)

            recurrence_rule = infer_recurrence_rule(f"{title} {short_description} {long_description}", time_hint=time_text)
            recurring_pattern = recurrence_rule.pattern if recurrence_rule else None
            if recurrence_rule and start_date is None:
                start_date, end_date = next_window_from_recurrence(recurrence_rule)

            image_style = card.select_one(".image .img-box")
            image_url = None
            if image_style and image_style.get("style"):
                match = re.search(r"url\(([^)]+)\)", image_style["style"])
                if match:
                    image_url = match.group(1).strip("'\"")

            detail_link = card.select_one("a[href*='/events/detail/']")
            jsonld = jsonld_events[index] if index < len(jsonld_events) else {}
            location = jsonld.get("location") if isinstance(jsonld, dict) else {}
            address = location.get("address") if isinstance(location, dict) else {}
            address_text = clean_text(address.get("streetAddress")) if isinstance(address, dict) else None

            candidate = {
                "title": title,
                "description": long_description or short_description,
                "business_name": "Century Square",
                "location_name": clean_text(location.get("name")) if isinstance(location, dict) else "Century Square",
                "address": address_text or "75 Century Square Dr",
                "city": clean_text(address.get("addressLocality")) if isinstance(address, dict) else "College Station",
                "start_date": start_date,
                "end_date": end_date,
                "recurrence_text": f"{short_description} {long_description}",
                "recurring_pattern": recurring_pattern,
                "time_text": time_text,
                "source_url": detail_link["href"] if detail_link else CENTURY_SQUARE_URL,
                "source_name": "century_square_events",
                "canonical_url": detail_link["href"] if detail_link else CENTURY_SQUARE_URL,
                "event_scope": "event",
                "image_url": image_url,
                "raw_source_text": f"{title} {short_description} {long_description}",
                "raw_payload": {"jsonld": jsonld},
                "area_label": "Century Square",
                "tags": ["Century Square", "College Station"],
            }
            normalized = normalize_candidate(candidate, business_records)
            if normalized:
                normalized_records.append(normalized)
        except Exception as exc:
            logger.warning("Failed to parse Century Square card #%d: %s", index, exc)
    return normalized_records
