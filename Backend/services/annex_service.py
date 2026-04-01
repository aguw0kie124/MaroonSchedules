from __future__ import annotations

import html
import os
import re
from typing import Any
from urllib.parse import parse_qs, urljoin, urlparse

import requests


LIBCAL_SEARCH_URL = os.getenv("TAMU_LIBCAL_SEARCH_URL", "https://tamu.libcal.com/r/search")
LIBCAL_EQUIPMENT_URL = os.getenv("TAMU_LIBCAL_EQUIPMENT_URL", "https://tamu.libcal.com/equipment")
LIBCAL_ITEM_PAGE_ROOT = os.getenv("TAMU_LIBCAL_ITEM_PAGE_ROOT", "https://tamu.libcal.com/equipment/item/")
LIBCAL_CATEGORY_ENDPOINT = os.getenv(
    "TAMU_LIBCAL_CATEGORY_ENDPOINT",
    "https://tamu.libcal.com/process_equip_cat.php",
)

REQUEST_HEADERS = {
    "User-Agent": "MaroonLife-Annex/1.0 (+https://github.com/openai/codex)",
}


def _fetch_html(url: str) -> str:
    response = requests.get(url, headers=REQUEST_HEADERS, timeout=20)
    response.raise_for_status()
    return response.text


def _fetch_json(url: str, params: dict[str, Any]) -> dict[str, Any]:
    response = requests.get(url, params=params, headers=REQUEST_HEADERS, timeout=20)
    response.raise_for_status()
    return response.json()


def _strip_html(value: str | None) -> str:
    if not value:
        return ""
    without_tags = re.sub(r"<br\s*/?>", "\n", value, flags=re.IGNORECASE)
    without_tags = re.sub(r"<[^>]+>", " ", without_tags)
    without_tags = html.unescape(without_tags)
    without_tags = re.sub(r"\s+", " ", without_tags).strip()
    return without_tags


def _slugify(value: str) -> str:
    normalized = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return normalized or "item"


def _absolute_url(url_or_path: str, base_url: str) -> str:
    return urljoin(base_url, html.unescape(url_or_path))


def _build_id_from_url(url_or_path: str, label: str) -> str:
    parsed = urlparse(_absolute_url(html.unescape(url_or_path), LIBCAL_SEARCH_URL))
    path_parts = [part for part in parsed.path.split("/") if part]
    query = parse_qs(parsed.query)
    if "gid" in query:
        return f"gid-{query['gid'][0]}"
    if "lid" in query:
        return f"lid-{query['lid'][0]}"
    if path_parts:
        return _slugify(path_parts[-1])
    return _slugify(label)


def _extract_select_options(html_text: str, select_id: str) -> list[tuple[str, str]]:
    match = re.search(
        rf'<select[^>]+id="{re.escape(select_id)}"[^>]*>(.*?)</select>',
        html_text,
        re.IGNORECASE | re.DOTALL,
    )
    if not match:
        return []
    select_html = match.group(1)
    results: list[tuple[str, str]] = []
    for value, label in re.findall(
        r'<option[^>]+value="([^"]*)"[^>]*>\s*([^<]+?)\s*</option>',
        select_html,
        re.IGNORECASE | re.DOTALL,
    ):
        cleaned_label = _strip_html(label)
        if not value or not cleaned_label:
            continue
        results.append((value, cleaned_label))
    return results


def _parse_libraries_from_search_html(html_text: str) -> list[dict[str, Any]]:
    libraries = []
    for path, label in _extract_select_options(html_text, "location"):
        libraries.append(
            {
                "id": _build_id_from_url(path, label),
                "name": label,
                "search_url": _absolute_url(path, LIBCAL_SEARCH_URL),
                "vendor": "LibCal",
                "booking_mode": "embedded_vendor",
            }
        )
    return libraries


def _extract_room_groups(html_text: str) -> list[dict[str, Any]]:
    seen: set[str] = set()
    groups: list[dict[str, Any]] = []
    for group_id, name in re.findall(
        r'<option value="(\d+)">\s*([^<]+?)\s*</option>',
        html_text,
        re.IGNORECASE | re.DOTALL,
    ):
        clean_name = _strip_html(name)
        if not clean_name or clean_name in seen:
            continue
        if "study" not in clean_name.lower() and "room" not in clean_name.lower() and "pod" not in clean_name.lower():
            continue
        seen.add(clean_name)
        groups.append(
            {
                "id": group_id,
                "name": clean_name,
            }
        )
    return groups


def _extract_booking_rules(html_text: str) -> list[str]:
    description_match = re.search(
        r'<div id="s-lc-location-description".*?>(.*?)</div>',
        html_text,
        re.IGNORECASE | re.DOTALL,
    )
    source = description_match.group(1) if description_match else html_text
    rules: list[str] = []
    for paragraph in re.findall(r"<p>(.*?)</p>", source, re.IGNORECASE | re.DOTALL):
        clean = _strip_html(paragraph)
        if not clean:
            continue
        if any(keyword in clean.lower() for keyword in ("study room", "check in", "book", "reservation", "policy", "quiet", "group")):
            rules.append(clean)
    deduped: list[str] = []
    seen: set[str] = set()
    for rule in rules:
        if rule not in seen:
            seen.add(rule)
            deduped.append(rule)
    return deduped[:6]


def _parse_rental_overview_html(html_text: str) -> dict[str, Any]:
    categories: list[dict[str, Any]] = []
    locations: list[dict[str, Any]] = []
    seen_categories: set[str] = set()
    seen_locations: set[str] = set()

    for href, label in re.findall(
        r'<a class="btn [^"]+" href="([^"]+)" role="button">([^<]+)</a>',
        html_text,
        re.IGNORECASE,
    ):
        clean_label = _strip_html(label)
        full_url = _absolute_url(href, LIBCAL_EQUIPMENT_URL)
        item_id = _build_id_from_url(href, clean_label)
        if "gid=" in href or "/reserve/AdvancedScheduling" in href:
            if item_id in seen_categories:
                continue
            seen_categories.add(item_id)
            categories.append({"id": item_id, "name": clean_label, "browse_url": full_url})
        elif "lid=" in href:
            if item_id in seen_locations:
                continue
            seen_locations.add(item_id)
            locations.append({"id": item_id, "name": clean_label, "browse_url": full_url})

    return {
        "vendor": "LibCal",
        "booking_mode": "embedded_vendor",
        "categories": categories,
        "locations": locations,
    }


def _extract_gid_and_lid(url: str) -> tuple[str | None, str | None]:
    parsed = urlparse(html.unescape(url))
    query = parse_qs(parsed.query)
    lid = query.get("lid", [None])[0]
    gid = query.get("gid", [None])[0]
    return lid, gid


def _parse_equipment_results(payload: dict[str, Any], browse_url: str) -> list[dict[str, Any]]:
    results = payload.get("results") or []
    items: list[dict[str, Any]] = []
    for entry in results:
        item_id = entry.get("ID")
        if not item_id:
            continue
        description = _strip_html(entry.get("DESCRIPTION") or "")
        items.append(
            {
                "id": str(item_id),
                "name": entry.get("NAME") or "Equipment Item",
                "model": _strip_html(entry.get("MODEL") or ""),
                "description": description[:320],
                "image_url": entry.get("IMAGE"),
                "detail_url": urljoin(LIBCAL_ITEM_PAGE_ROOT, str(item_id)),
                "browse_url": browse_url,
                "availability_status": "Check live availability",
                "booking_mode": "embedded_vendor",
            }
        )
    return items


def evaluate_booking_eligibility(email: str | None) -> dict[str, Any]:
    normalized = (email or "").strip().lower()
    if not normalized:
        return {
            "status": "requires_login",
            "message": "Sign in with your Texas A&M account to continue with vendor booking.",
        }
    if normalized.endswith("@tamu.edu"):
        return {
            "status": "eligible",
            "message": "Eligible to continue with Texas A&M Libraries booking flows.",
        }
    return {
        "status": "unauthorized",
        "message": "Texas A&M library reservations may require a tamu.edu account.",
    }


def get_libraries() -> dict[str, Any]:
    html_text = _fetch_html(LIBCAL_SEARCH_URL)
    libraries = _parse_libraries_from_search_html(html_text)
    return {
        "vendor": "LibCal",
        "items": libraries,
    }


def get_library_detail(library_id: str, email: str | None = None) -> dict[str, Any]:
    libraries = get_libraries()["items"]
    library = next((item for item in libraries if item["id"] == library_id), None)
    if not library:
        raise ValueError("Library not found")

    html_text = _fetch_html(library["search_url"])
    return {
        **library,
        "room_groups": _extract_room_groups(html_text),
        "booking_rules": _extract_booking_rules(html_text),
        "eligibility": evaluate_booking_eligibility(email),
        "supports_direct_submission": False,
        "availability_mode": "embedded_live_grid",
        "booking_handoff": {
            "mode": "embedded_vendor",
            "message": "Live availability and booking continue in the embedded Texas A&M Libraries room grid.",
        },
    }


def get_rentals_overview() -> dict[str, Any]:
    html_text = _fetch_html(LIBCAL_EQUIPMENT_URL)
    overview = _parse_rental_overview_html(html_text)
    return overview


def get_rental_detail(rental_id: str, email: str | None = None) -> dict[str, Any]:
    overview = get_rentals_overview()
    target = next((item for item in overview["categories"] if item["id"] == rental_id), None)
    if not target:
        target = next((item for item in overview["locations"] if item["id"] == rental_id), None)
    if not target:
        raise ValueError("Rental category not found")

    lid, gid = _extract_gid_and_lid(target["browse_url"])
    items: list[dict[str, Any]] = []
    if lid and gid:
        payload = _fetch_json(
            LIBCAL_CATEGORY_ENDPOINT,
            {
                "lid": lid,
                "gid": gid,
                "type": 0,
                "perpage": 24,
                "page": 1,
                "q": "",
            },
        )
        items = _parse_equipment_results(payload, target["browse_url"])

    return {
        **target,
        "vendor": "LibCal",
        "eligibility": evaluate_booking_eligibility(email),
        "supports_direct_submission": False,
        "availability_mode": "catalog_api",
        "items": items,
        "booking_handoff": {
            "mode": "embedded_vendor",
            "message": "Checkout continues in the embedded Texas A&M Libraries rentals flow.",
        },
    }
