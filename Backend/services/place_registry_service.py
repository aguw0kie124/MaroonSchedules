import sqlite3
import re
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List
import json


BACKEND_DIR = Path(__file__).resolve().parent.parent
DB_PATH = BACKEND_DIR / "Data" / "campus_registry.db"


def _normalize_key(value: str | None) -> str:
    text = (value or "").strip().lower()
    text = text.replace("&", " and ")
    return re.sub(r"[^a-z0-9]+", " ", text).strip()


@lru_cache(maxsize=1)
def _build_registry() -> Dict[str, Any]:
    if not DB_PATH.exists():
        print(f"[place_registry_service] Warning: DB not found at {DB_PATH}")
        return {"records": [], "by_id": {}, "by_name": {}, "alias_lookup": {}}

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    # 1. Load all places
    cur.execute("SELECT * FROM places")
    rows = cur.fetchall()
    
    records = []
    by_id = {}
    by_name = {}
    
    for row in rows:
        record = dict(row)
        # Convert search_only to bool
        record["search_only"] = bool(record["search_only"])
        # Ensure lat/lng are floats
        record["lat"] = float(record["lat"])
        record["lng"] = float(record["lng"])
        record["hours"] = record.get("hours")
        record["features"] = json.loads(record["features"]) if record.get("features") else []
        record["aliases"] = [] # To be filled next
        
        records.append(record)
        by_id[record["place_id"]] = record
        by_name[_normalize_key(record["name"])] = record

    # 2. Load all aliases
    cur.execute("SELECT * FROM aliases")
    alias_rows = cur.fetchall()
    
    alias_lookup = {}
    for row in alias_rows:
        pid = row["place_id"]
        alias = row["alias"]
        if pid in by_id:
            by_id[pid]["aliases"].append(alias)
            alias_lookup[alias] = by_id[pid]

    conn.close()

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
        "hours": place.get("hours"),
        "features": place.get("features") or [],
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
