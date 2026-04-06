from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, Iterable, List

from services import osm_places_service


FRONTEND_BUILDINGS_JSON = (
    Path(__file__).resolve().parents[2]
    / "Frontend"
    / "data"
    / "all_buildings.json"
)


SPECIAL_PLACES: List[Dict[str, Any]] = [
    {
        "place_id": "libr",
        "name": "Sterling C. Evans Library",
        "short_name": "LIBR",
        "type": "Library",
        "lat": 30.616332,
        "lng": -96.338571,
        "aliases": ["Evans Library", "Evans"],
    },
    {
        "place_id": "annex",
        "name": "Evans Library Annex",
        "short_name": "ANNEX",
        "type": "Library",
        "lat": 30.616531,
        "lng": -96.338456,
        "aliases": [],
    },
    {
        "place_id": "wcl",
        "name": "West Campus Library",
        "short_name": "WCL",
        "type": "Library",
        "lat": 30.611581,
        "lng": -96.350275,
        "aliases": ["BLCC"],
    },
    {
        "place_id": "cush",
        "name": "Cushing Memorial Library",
        "short_name": "CUSH",
        "type": "Library",
        "lat": 30.61636,
        "lng": -96.3399,
        "aliases": ["Cushing"],
    },
    {
        "place_id": "srec",
        "name": "Student Recreation Center",
        "short_name": "SREC",
        "type": "Rec",
        "lat": 30.60695,
        "lng": -96.342954,
        "aliases": ["Student Rec Center", "Rec Center", "The Rec", "Rec"],
    },
    {
        "place_id": "southside-rec",
        "name": "Southside Recreation Center",
        "short_name": "SSRC",
        "type": "Rec",
        "lat": 30.615185,
        "lng": -96.334412,
        "aliases": ["Southside Rec Center"],
    },
    {
        "place_id": "polo-rec",
        "name": "Polo Road Recreation Center",
        "short_name": "POLO REC",
        "type": "Rec",
        "lat": 30.622968,
        "lng": -96.340926,
        "aliases": ["Polo Road Rec Center"],
    },
    {
        "place_id": "msc",
        "name": "Memorial Student Center",
        "short_name": "MSC",
        "type": "Hub",
        "lat": 30.61225,
        "lng": -96.341242,
        "aliases": ["Memorial Student Center (MSC)", "MSC"],
    },
    {
        "place_id": "sbisa",
        "name": "Sbisa Dining Hall",
        "short_name": "SBISA",
        "type": "Dining",
        "lat": 30.617135,
        "lng": -96.343777,
        "aliases": ["Sbisa"],
    },
    {
        "place_id": "commons",
        "name": "The Commons Dining Hall",
        "short_name": "COMMONS",
        "type": "Dining",
        "lat": 30.61045,
        "lng": -96.33495,
        "aliases": ["Commons Dining Hall", "The Commons"],
    },
    {
        "place_id": "duncan",
        "name": "Duncan Dining Hall",
        "short_name": "DUNCAN",
        "type": "Dining",
        "lat": 30.612072,
        "lng": -96.335505,
        "aliases": [],
    },
    {
        "place_id": "polo-garage-food",
        "name": "Polo Road Garage Dining",
        "short_name": "POLO DINING",
        "type": "Dining",
        "lat": 30.622723,
        "lng": -96.337939,
        "aliases": ["Polo Road Garage", "Polo Dining", "Polo Road Garage Food"],
    },
    {
        "place_id": "rudder",
        "name": "Rudder Tower",
        "short_name": "RUDDER",
        "type": "Landmark",
        "lat": 30.613251,
        "lng": -96.339957,
        "aliases": [],
    },
]


TYPE_OVERRIDES = {
    "sterling c evans library": "Library",
    "evans library annex": "Library",
    "west campus library": "Library",
    "cushing memorial library": "Library",
    "student recreation center": "Rec",
    "southside recreation center": "Rec",
    "polo road recreation center": "Rec",
    "sbisa dining hall": "Dining",
    "the commons dining hall": "Dining",
    "duncan dining hall": "Dining",
    "polo road garage dining": "Dining",
    "memorial student center": "Hub",
}

NAME_ALIASES = {
    "evans library": "Sterling C. Evans Library",
    "student rec center": "Student Recreation Center",
    "main rec center": "Student Recreation Center",
    "the rec": "Student Recreation Center",
    "rec center": "Student Recreation Center",
    "rec": "Student Recreation Center",
    "southside rec center": "Southside Recreation Center",
    "polo road rec center": "Polo Road Recreation Center",
    "memorial student center msc": "Memorial Student Center",
    "msc": "Memorial Student Center",
    "polo road garage": "Polo Road Garage Dining",
    "polo dining": "Polo Road Garage Dining",
    "commons dining hall": "The Commons Dining Hall",
    "the commons": "The Commons Dining Hall",
    "sbisa": "Sbisa Dining Hall",
    "evans": "Sterling C. Evans Library",
}


def _normalize_key(value: str | None) -> str:
    text = (value or "").strip().lower()
    text = text.replace("&", " and ")
    return re.sub(r"[^a-z0-9]+", " ", text).strip()


def _map_source_type(source_type: str | None, name: str) -> str:
    normalized_name = _normalize_key(name)
    if normalized_name in TYPE_OVERRIDES:
        return TYPE_OVERRIDES[normalized_name]

    lowered_type = (source_type or "").strip().lower()
    if lowered_type == "library":
        return "Library"
    if lowered_type == "recreation":
        return "Rec"
    if lowered_type == "dining":
        return "Dining"
    if lowered_type == "athletics":
        return "Athletics"
    if lowered_type == "housing":
        return "Housing"
    if lowered_type == "landmark":
        return "Landmark"
    return "Academic"


def _load_building_records() -> Iterable[Dict[str, Any]]:
    if not FRONTEND_BUILDINGS_JSON.exists():
        return []

    with FRONTEND_BUILDINGS_JSON.open("r", encoding="utf-8") as file:
        payload = json.load(file)

    records: List[Dict[str, Any]] = []
    for row in payload:
        name = str(row.get("name") or "").strip()
        if not name:
            continue
        records.append(
            {
                "place_id": str(row.get("id") or _normalize_key(name).replace(" ", "-")),
                "name": name,
                "short_name": str(row.get("shortName") or "").strip() or None,
                "type": _map_source_type(row.get("type"), name),
                "lat": float(row.get("latitude")),
                "lng": float(row.get("longitude")),
                "aliases": [],
            }
        )
    return records


def _records_overlap(first: Dict[str, Any], second: Dict[str, Any], max_coord_delta: float = 0.0015) -> bool:
    return (
        abs(float(first["lat"]) - float(second["lat"]))
        + abs(float(first["lng"]) - float(second["lng"]))
        <= max_coord_delta
    )


def _dedupe_preserving_latest(records: Iterable[Dict[str, Any]]) -> List[Dict[str, Any]]:
    deduped: Dict[str, List[Dict[str, Any]]] = {}
    for record in records:
        normalized_name = _normalize_key(record["name"])
        existing_records = deduped.setdefault(normalized_name, [])
        overlapping_index = next(
            (
                index
                for index, existing in enumerate(existing_records)
                if _records_overlap(existing, record)
            ),
            None,
        )
        if overlapping_index is None:
            existing_records.append(record)
        else:
            existing_records[overlapping_index] = record

    flattened: List[Dict[str, Any]] = []
    for records_for_name in deduped.values():
        flattened.extend(records_for_name)
    return flattened


@lru_cache(maxsize=1)
def _build_registry() -> Dict[str, Any]:
    records = _dedupe_preserving_latest(
        [
            *osm_places_service.get_osm_places(),
            *_load_building_records(),
            *SPECIAL_PLACES,
        ]
    )
    by_id: Dict[str, Dict[str, Any]] = {}
    by_name: Dict[str, Dict[str, Any]] = {}
    alias_lookup: Dict[str, Dict[str, Any]] = {}

    for record in records:
        aliases = set(record.get("aliases") or [])
        aliases.update(filter(None, [record["name"], record.get("short_name"), record["place_id"]]))
        record["aliases"] = sorted(aliases)
        by_id[record["place_id"]] = record
        by_name[_normalize_key(record["name"])] = record
        for alias in record["aliases"]:
            alias_lookup[_normalize_key(alias)] = record

    for alias, canonical_name in NAME_ALIASES.items():
        record = by_name.get(_normalize_key(canonical_name))
        if record:
            alias_lookup[_normalize_key(alias)] = record

    return {
        "records": records,
        "by_id": by_id,
        "by_name": by_name,
        "alias_lookup": alias_lookup,
    }


def get_all_places() -> List[Dict[str, Any]]:
    return [serialize_place(place) for place in _build_registry()["records"]]


def get_place_by_id(place_id: str | None) -> Dict[str, Any] | None:
    if not place_id:
        return None
    return _build_registry()["by_id"].get(place_id)


def serialize_place(place: Dict[str, Any] | None) -> Dict[str, Any] | None:
    if not place:
        return None
    excluded_aliases = {
        _normalize_key(place["name"]),
        _normalize_key(place.get("short_name")),
        _normalize_key(place["place_id"]),
    }
    aliases = [
        alias
        for alias in list(place.get("aliases") or [])
        if _normalize_key(alias) not in excluded_aliases
    ]
    return {
        "place_id": place["place_id"],
        "name": place["name"],
        "short_name": place.get("short_name"),
        "type": place["type"],
        "aliases": aliases,
        "coord": {"lat": place["lat"], "lng": place["lng"]},
        "description": place.get("description"),
        "address": place.get("address"),
        "search_only": bool(place.get("search_only")),
        "source": place.get("source"),
    }


def resolve_place(
    location_name: str | None = None,
    lat: float | None = None,
    lng: float | None = None,
    max_coord_delta: float = 0.0015,
) -> Dict[str, Any] | None:
    registry = _build_registry()

    normalized_name = _normalize_key(location_name)
    if normalized_name:
        canonical_name = NAME_ALIASES.get(normalized_name)
        if canonical_name:
            normalized_name = _normalize_key(canonical_name)

        place = registry["alias_lookup"].get(normalized_name) or registry["by_name"].get(normalized_name)
        if place:
            return place

    if lat is None or lng is None:
        return None

    nearest: Dict[str, Any] | None = None
    nearest_delta = 999.0
    for place in registry["records"]:
        delta = abs(place["lat"] - lat) + abs(place["lng"] - lng)
        if delta < nearest_delta:
            nearest = place
            nearest_delta = delta

    if nearest and nearest_delta <= max_coord_delta:
        return nearest
    return None
