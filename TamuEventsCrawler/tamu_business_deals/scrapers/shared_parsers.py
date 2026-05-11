from __future__ import annotations

import json
import re
from typing import Any, Iterable

from bs4 import BeautifulSoup
from dateutil import parser as dtparse

from ..date_utils import parse_event_datetime
from ..utils import clean_text, unique_strings


def extract_jsonld_objects(html: str) -> list[dict[str, Any]]:
    soup = BeautifulSoup(html, "html.parser")
    extracted: list[dict[str, Any]] = []

    def walk(node: Any) -> None:
        if isinstance(node, dict):
            if "@type" in node:
                extracted.append(node)
            if "@graph" in node and isinstance(node["@graph"], list):
                for item in node["@graph"]:
                    walk(item)
            for value in node.values():
                if isinstance(value, (dict, list)):
                    walk(value)
        elif isinstance(node, list):
            for item in node:
                walk(item)

    for script in soup.find_all("script", type="application/ld+json"):
        text = script.get_text(strip=True)
        if not text:
            continue
        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            continue
        walk(data)
    return extracted


def page_text(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    return clean_text(soup.get_text(" ", strip=True))


def _content_slice(text: str, title: str) -> str:
    content = text
    if title:
        matches = [match.start() for match in re.finditer(re.escape(title), content)]
        start = matches[1] if len(matches) >= 2 else (matches[0] if matches else -1)
        if start >= 0:
            content = content[start:]
    for marker in ("About Us Partners Blog", "Things to Do Spring Summer", "Quick Search Search"):
        marker_idx = content.find(marker)
        if marker_idx > 0:
            content = content[:marker_idx]
            break
    return clean_text(content)


def parse_simpleview_event_page(
    html: str,
    url: str,
    *,
    source_name: str,
    city: str,
    area_label: str | None = None,
) -> dict[str, Any] | None:
    objects = extract_jsonld_objects(html)
    event = next(
        (
            item
            for item in objects
            if clean_text(str(item.get("@type"))).lower() == "event"
        ),
        None,
    )
    if not event:
        return None

    body_text = page_text(html)
    content_text = _content_slice(body_text, clean_text(event.get("name")))
    description = clean_text(event.get("description")) or content_text
    location = event.get("location") or {}
    address = location.get("address") if isinstance(location, dict) else {}
    if isinstance(address, str):
        address_text = clean_text(address)
        city_value = city
    else:
        address_text = clean_text(address.get("streetAddress"))
        city_value = clean_text(address.get("addressLocality")) or city

    start_date = None
    end_date = None
    local_match = re.search(
        r"(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+"
        r"(?P<date>[A-Za-z]+\s+\d{1,2},\s+\d{4})\s+"
        r"(?P<time>\d{1,2}(?::\d{2})?\s*[AP]M(?:\s*[–-]\s*\d{1,2}(?::\d{2})?\s*[AP]M)?)",
        content_text,
        flags=re.IGNORECASE,
    )
    if local_match:
        start_date, end_date = parse_event_datetime(local_match.group("date"), local_match.group("time"))

    if start_date is None:
        try:
            if event.get("startDate"):
                start_date = dtparse.parse(str(event["startDate"]))
            if event.get("endDate"):
                end_date = dtparse.parse(str(event["endDate"]))
        except (ValueError, TypeError, OverflowError):
            start_date, end_date = None, None

    address_match = re.search(
        r"(\d{2,5}[^,]+,\s*(?:Bryan|College Station)\s*,?\s*TX\s*\d{5})",
        content_text,
        flags=re.IGNORECASE,
    )
    if address_match:
        address_text = clean_text(address_match.group(1))
        if "college station" in address_text.lower():
            city_value = "College Station"
        elif "bryan" in address_text.lower():
            city_value = "Bryan"

    if isinstance(location, dict):
        current_location_name = clean_text(location.get("name"))
    else:
        current_location_name = ""
    if not current_location_name or current_location_name == clean_text(event.get("name")):
        venue_match = re.search(
            rf"{re.escape(clean_text(event.get('name')))}\s+([A-Za-z0-9&'.,\- ]+?)\s+\d{{2,5}}",
            content_text,
        )
        if venue_match:
            current_location_name = clean_text(venue_match.group(1))
    if current_location_name and (
        "go to website save" in current_location_name.lower()
        or re.search(r"\d{3,}", current_location_name)
    ):
        current_location_name = ""

    detected_area = area_label
    lowered = content_text.lower()
    if "northgate" in lowered:
        detected_area = "Northgate"
    elif "historic downtown bryan" in lowered or "downtown bryan" in lowered:
        detected_area = "Downtown Bryan"
    elif "century square" in lowered:
        detected_area = "Century Square"

    recurrence_match = re.search(
        r"(every [^.]+|Recurring Dates[^.]+|Every Saturday rain or shine)",
        body_text,
        flags=re.IGNORECASE,
    )

    return {
        "title": clean_text(event.get("name")),
        "description": description,
        "business_name": current_location_name or None,
        "location_name": current_location_name or None,
        "address": address_text or None,
        "city": city_value or None,
        "start_date": start_date,
        "end_date": end_date,
        "recurrence_text": clean_text(recurrence_match.group(1)) if recurrence_match else None,
        "time_text": clean_text(body_text),
        "source_url": url,
        "source_name": source_name,
        "canonical_url": url,
        "event_scope": "event",
        "image_url": (
            clean_text(event.get("image", {}).get("url"))
            if isinstance(event.get("image"), dict)
            else clean_text(event.get("image"))
        ) or None,
        "raw_source_text": content_text,
        "raw_payload": {"jsonld_event": event},
        "tags": unique_strings([city_value, detected_area, current_location_name]),
        "area_label": detected_area,
    }


def parse_simpleview_offer_page(
    html: str,
    url: str,
    *,
    source_name: str,
    city: str,
    area_label: str | None = None,
) -> dict[str, Any] | None:
    objects = extract_jsonld_objects(html)
    offer = next(
        (
            item
            for item in objects
            if clean_text(str(item.get("@type"))).lower() == "offer"
        ),
        None,
    )
    if not offer:
        return None

    title = clean_text(offer.get("name"))
    business_name = None
    discount_text = None
    if ":" in title:
        left, right = [clean_text(part) for part in title.split(":", 1)]
        business_name = left or None
        discount_text = right or None

    body_text = page_text(html)
    content_text = _content_slice(body_text, title)
    address_match = re.search(
        r"(\d{2,5}[^,]+,\s*(?:College Station|Bryan),\s*Texas(?:\s+\d{5})?)",
        content_text,
        flags=re.IGNORECASE,
    )
    return {
        "title": title,
        "description": content_text,
        "business_name": business_name,
        "location_name": business_name,
        "address": clean_text(address_match.group(1)) if address_match else None,
        "city": city,
        "source_url": url,
        "source_name": source_name,
        "canonical_url": url,
        "event_scope": "promotion",
        "deal_type": "discount",
        "discount_text": discount_text,
        "raw_source_text": content_text,
        "raw_payload": {"jsonld_offer": offer},
        "area_label": area_label,
        "tags": unique_strings([city, area_label]),
    }
