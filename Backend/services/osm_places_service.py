from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, Iterable, List, Tuple

import requests


OVERPASS_API_URL = "https://overpass-api.de/api/interpreter"
TAMU_CENTER = {"lat": 30.6123, "lng": -96.3415}
SEARCH_RADIUS_MILES = 10
SEARCH_RADIUS_METERS = 16093
OSM_PLACE_DATA_PATH = Path(__file__).resolve().parents[1] / "Data" / "osm_places_tamu_10mi.json"

TAG_PRIORITY = ("amenity", "shop", "office", "tourism", "leisure", "craft", "building")

DINING_VALUES = {
    "bar",
    "bbq",
    "bakery",
    "beverages",
    "biergarten",
    "brewery",
    "cafe",
    "coffee",
    "coffee_shop",
    "confectionery",
    "deli",
    "doityourself",
    "fast_food",
    "food_court",
    "ice_cream",
    "pub",
    "restaurant",
    "tea",
}
REC_VALUES = {
    "bowling_alley",
    "fitness_centre",
    "gym",
    "ice_rink",
    "park",
    "pitch",
    "playground",
    "recreation_ground",
    "sports_centre",
    "stadium",
    "swimming_pool",
    "track",
}
ACADEMIC_VALUES = {"college", "school", "university"}
PARKING_VALUES = {"parking", "parking_entrance", "parking_space", "garage"}
LANDMARK_VALUES = {"attraction", "gallery", "memorial", "museum", "theme_park", "viewpoint", "zoo"}

OVERPASS_QUERY = f"""
[out:json][timeout:120];
(
  nwr(around:{SEARCH_RADIUS_METERS},{TAMU_CENTER["lat"]},{TAMU_CENTER["lng"]})[name][amenity];
  nwr(around:{SEARCH_RADIUS_METERS},{TAMU_CENTER["lat"]},{TAMU_CENTER["lng"]})[name][shop];
  nwr(around:{SEARCH_RADIUS_METERS},{TAMU_CENTER["lat"]},{TAMU_CENTER["lng"]})[name][office];
  nwr(around:{SEARCH_RADIUS_METERS},{TAMU_CENTER["lat"]},{TAMU_CENTER["lng"]})[name][tourism];
  nwr(around:{SEARCH_RADIUS_METERS},{TAMU_CENTER["lat"]},{TAMU_CENTER["lng"]})[name][leisure];
  nwr(around:{SEARCH_RADIUS_METERS},{TAMU_CENTER["lat"]},{TAMU_CENTER["lng"]})[name][craft];
  nwr(around:{SEARCH_RADIUS_METERS},{TAMU_CENTER["lat"]},{TAMU_CENTER["lng"]})[name][building];
);
out center tags;
""".strip()


def _clean_text(value: str | None) -> str:
    return re.sub(r"\s+", " ", (value or "").strip())


def _normalize_key(value: str | None) -> str:
    text = _clean_text(value).lower()
    text = text.replace("&", " and ")
    return re.sub(r"[^a-z0-9]+", " ", text).strip()


def _humanize_tag(value: str | None) -> str:
    text = _clean_text(value).replace("_", " ").replace("-", " ")
    return text.title()


def _split_aliases(value: str | None) -> List[str]:
    if not value:
        return []
    return [_clean_text(part) for part in re.split(r"[;|/]", value) if _clean_text(part)]


def _get_primary_tag(tags: Dict[str, Any]) -> Tuple[str | None, str | None]:
    for key in TAG_PRIORITY:
        value = tags.get(key)
        if value:
            return key, _clean_text(str(value))
    return None, None


def _extract_coord(element: Dict[str, Any]) -> Tuple[float, float] | None:
    if element.get("lat") is not None and element.get("lon") is not None:
        return float(element["lat"]), float(element["lon"])

    center = element.get("center") or {}
    if center.get("lat") is not None and center.get("lon") is not None:
        return float(center["lat"]), float(center["lon"])

    return None


def _map_osm_type(tags: Dict[str, Any]) -> str:
    primary_key, primary_value = _get_primary_tag(tags)
    lower_value = (primary_value or "").lower()
    lower_name = _clean_text(str(tags.get("name") or "")).lower()

    if lower_value in PARKING_VALUES or "parking" in lower_name or "garage" in lower_name:
        return "Parking"
    if lower_value == "library":
        return "Library"
    if lower_value in DINING_VALUES:
        return "Dining"
    if lower_value in REC_VALUES:
        return "Rec"
    if lower_value in LANDMARK_VALUES or primary_key == "tourism":
        return "Landmark"
    if lower_value in ACADEMIC_VALUES:
        return "Academic"
    if primary_key == "building" and lower_value in ACADEMIC_VALUES:
        return "Academic"
    return "General"


def _build_aliases(tags: Dict[str, Any]) -> List[str]:
    aliases: List[str] = []
    for key in ("alt_name", "short_name", "official_name", "old_name", "brand", "operator"):
        aliases.extend(_split_aliases(tags.get(key)))

    name = _clean_text(str(tags.get("name") or ""))
    brand = _clean_text(str(tags.get("brand") or ""))
    if brand and brand != name:
        aliases.append(brand)

    deduped: Dict[str, str] = {}
    for alias in aliases:
        normalized = _normalize_key(alias)
        if normalized and normalized not in deduped:
            deduped[normalized] = alias
    return sorted(deduped.values())


def _build_address(tags: Dict[str, Any]) -> str | None:
    if tags.get("addr:full"):
        return _clean_text(str(tags["addr:full"]))

    street = _clean_text(str(tags.get("addr:street") or ""))
    number = _clean_text(str(tags.get("addr:housenumber") or ""))
    unit = _clean_text(str(tags.get("addr:unit") or ""))
    city = _clean_text(str(tags.get("addr:city") or ""))

    line = " ".join(part for part in [number, street] if part)
    if unit:
        line = f"{line}, Unit {unit}" if line else f"Unit {unit}"
    if city and city.lower() not in line.lower():
        line = f"{line}, {city}" if line else city
    return line or None


def _build_description(tags: Dict[str, Any], subtype_label: str) -> str | None:
    explicit_description = _clean_text(str(tags.get("description") or ""))
    if explicit_description and len(explicit_description) <= 160:
        return explicit_description

    address = _build_address(tags)
    if address:
        return f"{subtype_label} • {address}"
    return f"{subtype_label} within {SEARCH_RADIUS_MILES} miles of Texas A&M"


def _record_sort_key(record: Dict[str, Any]) -> Tuple[int, int, str]:
    type_priority = {
        "Dining": 0,
        "Library": 1,
        "Rec": 2,
        "Parking": 3,
        "Academic": 4,
        "Landmark": 5,
        "General": 6,
    }
    primary_tag = record.get("primary_tag") or ""
    is_building_only = 1 if primary_tag == "building" else 0
    return (
        is_building_only,
        type_priority.get(record.get("type") or "General", 99),
        _normalize_key(record.get("name")),
    )


def _record_from_element(element: Dict[str, Any]) -> Dict[str, Any] | None:
    tags = element.get("tags") or {}
    name = _clean_text(str(tags.get("name") or ""))
    if not name:
        return None

    coord = _extract_coord(element)
    if coord is None:
        return None

    primary_key, primary_value = _get_primary_tag(tags)
    subtype_label = _humanize_tag(primary_value or primary_key or "Place")
    place_type = _map_osm_type(tags)
    osm_type = _clean_text(str(element.get("type") or ""))
    osm_id = element.get("id")
    if osm_id is None or not osm_type:
        return None

    return {
        "place_id": f"osm:{osm_type}:{osm_id}",
        "name": name,
        "short_name": subtype_label,
        "type": place_type,
        "lat": coord[0],
        "lng": coord[1],
        "aliases": _build_aliases(tags),
        "search_only": True,
        "source": "osm",
        "description": _build_description(tags, subtype_label),
        "address": _build_address(tags),
        "primary_tag": primary_key,
        "primary_value": primary_value,
        "attribution": "© OpenStreetMap contributors",
    }


def _dedupe_records(records: Iterable[Dict[str, Any]]) -> List[Dict[str, Any]]:
    deduped: Dict[str, Dict[str, Any]] = {}
    for record in records:
        signature = f"{_normalize_key(record.get('name'))}|{round(float(record['lat']), 4)}|{round(float(record['lng']), 4)}"
        existing = deduped.get(signature)
        if not existing or _record_sort_key(record) < _record_sort_key(existing):
            deduped[signature] = record

    ordered = list(deduped.values())
    ordered.sort(key=_record_sort_key)
    return ordered


def fetch_places_payload() -> Dict[str, Any]:
    response = requests.post(
        OVERPASS_API_URL,
        data=OVERPASS_QUERY,
        headers={"User-Agent": "MaroonSchedules/1.0 (Texas A&M place sync)"},
        timeout=180,
    )
    response.raise_for_status()
    payload = response.json()
    elements = payload.get("elements") or []
    records = [record for record in (_record_from_element(element) for element in elements) if record]
    records = _dedupe_records(records)

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "center": TAMU_CENTER,
        "radius_miles": SEARCH_RADIUS_MILES,
        "radius_meters": SEARCH_RADIUS_METERS,
        "count": len(records),
        "attribution": "© OpenStreetMap contributors",
        "source": "OpenStreetMap Overpass API",
        "places": records,
    }


def write_places_payload(payload: Dict[str, Any]) -> Path:
    OSM_PLACE_DATA_PATH.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = OSM_PLACE_DATA_PATH.with_suffix(".tmp")
    tmp_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    tmp_path.replace(OSM_PLACE_DATA_PATH)
    load_places_payload.cache_clear()
    return OSM_PLACE_DATA_PATH


def sync_places_payload() -> Dict[str, Any]:
    payload = fetch_places_payload()
    write_places_payload(payload)
    return payload


@lru_cache(maxsize=1)
def load_places_payload() -> Dict[str, Any]:
    if not OSM_PLACE_DATA_PATH.exists():
        return {
            "generated_at": None,
            "center": TAMU_CENTER,
            "radius_miles": SEARCH_RADIUS_MILES,
            "radius_meters": SEARCH_RADIUS_METERS,
            "count": 0,
            "attribution": "© OpenStreetMap contributors",
            "source": "OpenStreetMap Overpass API",
            "places": [],
        }

    try:
        return json.loads(OSM_PLACE_DATA_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {
            "generated_at": None,
            "center": TAMU_CENTER,
            "radius_miles": SEARCH_RADIUS_MILES,
            "radius_meters": SEARCH_RADIUS_METERS,
            "count": 0,
            "attribution": "© OpenStreetMap contributors",
            "source": "OpenStreetMap Overpass API",
            "places": [],
        }


def get_osm_places() -> List[Dict[str, Any]]:
    payload = load_places_payload()
    return [dict(place) for place in payload.get("places") or []]
