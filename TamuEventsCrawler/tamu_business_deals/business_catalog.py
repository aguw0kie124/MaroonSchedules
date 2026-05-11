from __future__ import annotations

import csv
import json
import logging
from pathlib import Path
from typing import Iterable, List

from bs4 import BeautifulSoup

from .constants import CATALOG_OUTPUT_CSV, CATALOG_OUTPUT_JSON
from .models import BusinessRecord
from .osm_lookup import match_place
from .utils import clean_text, canonicalize_url, normalize_key

logger = logging.getLogger("tamu_crawler.business_catalog")


def infer_area_label(name: str | None, address: str | None, city: str | None) -> str:
    combined = " ".join(part for part in [name, address, city] if part).lower()
    if "century square" in combined or "century ct" in combined or "century square dr" in combined:
        return "Century Square"
    if any(
        token in combined
        for token in (
            "northgate",
            "boyett",
            "college main",
            "church ave",
            "church avenue",
            "patricia",
            "university dr",
        )
    ):
        return "Northgate"
    if city and city.lower() == "bryan":
        if any(token in combined for token in ("main st", "main street", "26th", "queen theatre", "downtown", "north main")):
            return "Downtown Bryan"
        return "Bryan"
    if city and city.lower() == "college station":
        return "College Station"
    return city or "College Station"


def _parse_distance(value: str | None) -> float | None:
    cleaned = clean_text(value)
    if not cleaned:
        return None
    try:
        return float(cleaned)
    except ValueError:
        return None


def parse_sheet_html(html: str) -> list[BusinessRecord]:
    soup = BeautifulSoup(html, "html.parser")
    table = soup.find("table")
    if table is None:
        raise ValueError("Google Sheet HTML did not contain a table")

    rows = table.find_all("tr")
    if len(rows) < 2:
        return []

    header_cells = [clean_text(cell.get_text(" ", strip=True)) for cell in rows[1].find_all(["th", "td"])]
    headers = header_cells[1:]
    records: list[BusinessRecord] = []

    for row in rows[2:]:
        cells = [clean_text(cell.get_text(" ", strip=True)) for cell in row.find_all(["th", "td"])]
        values = cells[1 : 1 + len(headers)]
        if not values or not any(values):
            continue
        raw = dict(zip(headers, values))
        name = clean_text(raw.get("name"))
        if not name:
            continue
        website = canonicalize_url(raw.get("website"))
        address = clean_text(raw.get("address")) or None
        city = clean_text(raw.get("city")) or None
        matched_place = match_place(name, address)
        records.append(
            BusinessRecord(
                name=name,
                category=clean_text(raw.get("category")) or None,
                address=address,
                city=city,
                state=clean_text(raw.get("state")) or None,
                zip_code=clean_text(raw.get("zip_code")) or None,
                phone=clean_text(raw.get("phone")) or None,
                website=website or None,
                email=clean_text(raw.get("email")) or None,
                distance_miles=_parse_distance(raw.get("distance_miles")),
                business_size=clean_text(raw.get("business_size")) or None,
                source=clean_text(raw.get("source")) or None,
                area_label=infer_area_label(name, address, city),
                latitude=matched_place.get("lat") if matched_place else None,
                longitude=matched_place.get("lng") if matched_place else None,
                matched_place_id=matched_place.get("place_id") if matched_place else None,
                matched_place_confidence=matched_place.get("confidence") if matched_place else None,
            )
        )
    return records


def write_business_catalog(records: Iterable[BusinessRecord]) -> tuple[Path, Path]:
    rows = [record.model_dump() | {"slug": record.slug} for record in records]
    CATALOG_OUTPUT_CSV.parent.mkdir(parents=True, exist_ok=True)

    with CATALOG_OUTPUT_CSV.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()) if rows else [])
        if rows:
            writer.writeheader()
            writer.writerows(rows)

    CATALOG_OUTPUT_JSON.write_text(json.dumps(rows, indent=2, default=str), encoding="utf-8")
    logger.info("Wrote %d business rows to %s", len(rows), CATALOG_OUTPUT_CSV)
    return CATALOG_OUTPUT_CSV, CATALOG_OUTPUT_JSON


def build_business_lookup(records: Iterable[BusinessRecord]) -> dict[str, BusinessRecord]:
    lookup: dict[str, BusinessRecord] = {}
    for record in records:
        lookup[normalize_key(record.name)] = record
        if record.website:
            lookup[normalize_key(record.website)] = record
    return lookup
