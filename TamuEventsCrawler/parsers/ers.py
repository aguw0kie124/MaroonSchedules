"""ERS (Event Registration System) HTML parsers."""

from __future__ import annotations

import asyncio
import logging
import re
from datetime import datetime
from typing import Any, Dict, List, Optional
from urllib.parse import urljoin
from zoneinfo import ZoneInfo

from bs4 import BeautifulSoup, Tag
from dateutil import parser as dtparse

logger = logging.getLogger("tamu_crawler.parsers.ers")

BASE_URL = "https://ers.tamu.edu/"
CHICAGO_TZ = ZoneInfo("America/Chicago")
ELIGIBILITY_VALUES = {
    "faculty": "faculty",
    "staff": "staff",
    "undergrad": "undergrad",
    "graduate": "graduate",
    "tamu guest": "tamu_guest",
}


def _clean_text(text: str | None) -> str:
    if not text:
        return ""
    return re.sub(r"\s+", " ", text.replace("\xa0", " ")).strip()


def _parse_dt(text: str | None) -> Optional[datetime]:
    cleaned = _clean_text(text)
    if not cleaned:
        return None
    try:
        parsed = dtparse.parse(cleaned, fuzzy=True)
    except (ValueError, TypeError):
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=CHICAGO_TZ)
    return parsed


def _extract_schedule_id(url: str | None) -> Optional[str]:
    if not url:
        return None
    match = re.search(r"ScheduleId=(\d+)", url, re.IGNORECASE)
    return match.group(1) if match else None


def _extract_label_value(cell: Tag, label: str) -> str:
    full_text = cell.get_text("\n", strip=True)
    match = re.search(rf"{re.escape(label)}\s*:?\s*(.+)", full_text, re.IGNORECASE | re.DOTALL)
    if match:
        return _clean_text(match.group(1))
    return ""


def _parse_seat_counts(text: str | None) -> tuple[Optional[int], Optional[int]]:
    cleaned = _clean_text(text)
    if not cleaned:
        return None, None
    match = re.search(r"(\d+)\s+out\s+of\s+(\d+)", cleaned, re.IGNORECASE)
    if not match:
        return None, None
    return int(match.group(1)), int(match.group(2))


def _build_department_mapping(source_config: Any) -> Dict[str, str]:
    raw_map = getattr(source_config, "department_map", {}) or {}
    return {str(key).strip(): str(value).strip() for key, value in raw_map.items()}


def _map_department(host_name: str, source_config: Any) -> tuple[Optional[str], Optional[str]]:
    mapping = _build_department_mapping(source_config)
    code = mapping.get(host_name)
    if not code:
        return None, None
    return code, host_name


def _row_to_event(
    row: Tag,
    source_name: str,
    source_url: str,
    source_config: Any,
) -> Optional[Dict[str, Any]]:
    cells = row.find_all("td", recursive=False)
    if len(cells) < 4:
        return None

    event_cell, eligibility_cell, event_date_cell, registration_cell = cells[:4]
    link = event_cell.find("a", href=re.compile(r"register\.aspx\?ScheduleId=\d+", re.I))
    if not link:
        return None

    event_url = urljoin(BASE_URL, link.get("href", ""))
    schedule_id = _extract_schedule_id(event_url)
    title = _clean_text(link.get_text())
    if not schedule_id or not title:
        return None

    host_name = _extract_label_value(event_cell, "Hosted By")
    exclude_hosts = [h.lower() for h in (getattr(source_config, "filters", {}) or {}).get("exclude_hosts", [])]
    if host_name and any(excluded in host_name.lower() for excluded in exclude_hosts):
        return None

    audience: List[str] = []
    for line in eligibility_cell.get_text("\n", strip=True).splitlines():
        normalized = ELIGIBILITY_VALUES.get(_clean_text(line).lower())
        if normalized:
            audience.append(normalized)
    audience = audience or ["undergrad"]

    start_time = _parse_dt(_extract_label_value(event_date_cell, "Starts"))
    end_time = _parse_dt(_extract_label_value(event_date_cell, "Ends"))
    has_other_dates = bool(event_date_cell.find("a", string=re.compile(r"Other Dates/Times", re.I)))

    registration_start = _parse_dt(_extract_label_value(registration_cell, "Starts"))
    registration_end = _parse_dt(_extract_label_value(registration_cell, "Ends"))
    seats_available, seats_total = _parse_seat_counts(_extract_label_value(registration_cell, "Seats Available"))
    department_code, department_name = _map_department(host_name, source_config)

    return {
        "id": f"tamu:ers:schedule-{schedule_id}",
        "title": title,
        "description": None,
        "start_time": start_time.isoformat() if start_time else None,
        "end_time": end_time.isoformat() if end_time else None,
        "timezone": "America/Chicago",
        "location": None,
        "host_name": host_name,
        "host_type": "department",
        "department_code": department_code,
        "department_name": department_name,
        "source_name": source_name,
        "source_url": source_url,
        "event_url": event_url,
        "source_links": [source_url, event_url],
        "audience": audience,
        "campus": (getattr(source_config, "filters", {}) or {}).get("campus", "college_station"),
        "affiliation": "tamu",
        "registration_start": registration_start.isoformat() if registration_start else None,
        "registration_end": registration_end.isoformat() if registration_end else None,
        "registration_status": "open",
        "seats_available": seats_available,
        "seats_total": seats_total,
        "tags": [],
        "raw_payload": {
            "schedule_id": schedule_id,
            "has_other_dates": has_other_dates,
            "eligibility": audience,
        },
    }


def parse_ers_detail(body: str, schedule_id: str) -> Dict[str, Any]:
    soup = BeautifulSoup(body, "lxml")
    details: Dict[str, Any] = {
        "schedule_id": schedule_id,
        "prerequisites": [],
        "alternative_sessions": [],
    }

    event_details = soup.find("h2", string=re.compile(r"Event Details", re.I))
    details_table = event_details.find_next("table") if event_details else None
    if details_table:
        for row in details_table.find_all("tr"):
            cells = row.find_all("td", recursive=False)
            if len(cells) < 2:
                continue
            label = _clean_text(cells[0].get_text()).rstrip(":").lower()
            value = cells[1]
            text = _clean_text(value.get_text("\n", strip=True))
            if label == "description":
                details["description"] = text
            elif label == "location":
                details["location"] = text
            elif label == "hosted by":
                details["host_name"] = text
            elif label == "starts":
                parsed = _parse_dt(text)
                if parsed:
                    details["start_time"] = parsed.isoformat()
            elif label == "ends":
                parsed = _parse_dt(text)
                if parsed:
                    details["end_time"] = parsed.isoformat()
            elif label == "prerequisites":
                details["prerequisites"] = [part.strip() for part in text.split(";") if part.strip()]

    registration_heading = soup.find("h2", string=re.compile(r"Registration", re.I))
    registration_table = registration_heading.find_next("table") if registration_heading else None
    if registration_table:
        for row in registration_table.find_all("tr"):
            cells = row.find_all("td", recursive=False)
            if len(cells) < 2:
                continue
            label = _clean_text(cells[0].get_text()).rstrip(":").lower()
            text = _clean_text(cells[1].get_text("\n", strip=True))
            if label == "open to":
                audience = []
                for line in cells[1].get_text("\n", strip=True).splitlines():
                    normalized = ELIGIBILITY_VALUES.get(_clean_text(line).lower())
                    if normalized:
                        audience.append(normalized)
                if audience:
                    details["audience"] = audience
            elif label == "registration starts":
                parsed = _parse_dt(text)
                if parsed:
                    details["registration_start"] = parsed.isoformat()
            elif label == "registration ends":
                parsed = _parse_dt(text)
                if parsed:
                    details["registration_end"] = parsed.isoformat()
            elif label == "seats available":
                seats_available, seats_total = _parse_seat_counts(text.replace(" of ", " out of "))
                details["seats_available"] = seats_available
                details["seats_total"] = seats_total
            elif label == "registration status":
                lowered = text.lower()
                if "cancel" in lowered:
                    details["registration_status"] = "canceled"
                elif "closed" in lowered or "full" in lowered:
                    details["registration_status"] = "closed"
                elif "login" in lowered or "register" in lowered:
                    details["registration_status"] = "open"
                else:
                    details["registration_status"] = text

    alt_heading = soup.find("h2", string=re.compile(r"Alternative Sessions", re.I))
    if alt_heading:
        alt_table = alt_heading.find_next("table")
        current_date_label = ""
        if alt_table:
            for row in alt_table.find_all("tr"):
                cells = row.find_all("td", recursive=False)
                if not cells:
                    continue
                if len(cells) >= 2 and cells[0].find("input", {"type": "hidden"}):
                    current_date_label = _clean_text(cells[0].get_text())
                    continue
                if len(cells) >= 5 and _clean_text(cells[1].get_text()):
                    details["alternative_sessions"].append(
                        {
                            "date": current_date_label,
                            "time": _clean_text(cells[1].get_text()),
                            "available_seats": _clean_text(cells[2].get_text()),
                            "location": _clean_text(cells[3].get_text()),
                        }
                    )

    return details


async def _fetch_detail(
    event: Dict[str, Any],
    http_client: Any,
) -> Dict[str, Any]:
    event_url = event.get("event_url")
    schedule_id = event.get("raw_payload", {}).get("schedule_id") or _extract_schedule_id(event_url)
    if not event_url or not schedule_id:
        return event

    try:
        body, status, _ = await http_client.fetch(event_url, use_conditional=False)
        if not body or status == 304:
            return event
        detail = parse_ers_detail(body, schedule_id)
        event.update(
            {
                "description": detail.get("description") or event.get("description"),
                "location": detail.get("location") or event.get("location"),
                "host_name": detail.get("host_name") or event.get("host_name"),
                "start_time": detail.get("start_time") or event.get("start_time"),
                "end_time": detail.get("end_time") or event.get("end_time"),
                "registration_start": detail.get("registration_start") or event.get("registration_start"),
                "registration_end": detail.get("registration_end") or event.get("registration_end"),
                "registration_status": detail.get("registration_status") or event.get("registration_status"),
                "seats_available": detail.get("seats_available", event.get("seats_available")),
                "seats_total": detail.get("seats_total", event.get("seats_total")),
                "audience": detail.get("audience") or event.get("audience"),
                "prerequisites": detail.get("prerequisites", []),
            }
        )
        raw_payload = dict(event.get("raw_payload", {}))
        raw_payload["alternative_sessions"] = detail.get("alternative_sessions", [])
        event["raw_payload"] = raw_payload
        return event
    except Exception as exc:
        logger.debug("Failed to fetch ERS detail for %s: %s", event_url, exc)
        return event


async def parse_ers_events_list(
    body: str | None,
    source_name: str,
    source_url: str,
    **kwargs: Any,
) -> List[Dict[str, Any]]:
    """Parse the ERS events list table and enrich rows from detail pages."""
    if not body:
        return []

    soup = BeautifulSoup(body, "lxml")
    rows = soup.select("td[data-label='Event']")
    events: List[Dict[str, Any]] = []
    source_config = kwargs.get("source_config")
    http_client = kwargs.get("http_client")

    for event_cell in rows:
        row = event_cell.parent
        if not isinstance(row, Tag):
            continue
        event = _row_to_event(row, source_name, source_url, source_config)
        if event:
            events.append(event)

    if http_client and events:
        events = await asyncio.gather(*[_fetch_detail(event, http_client) for event in events])

    logger.info("Parsed %d ERS events from %s", len(events), source_name)
    return list(events)
