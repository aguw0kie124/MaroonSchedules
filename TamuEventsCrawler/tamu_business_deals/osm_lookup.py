from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, Optional

from rapidfuzz import fuzz

from .constants import OSM_JSON_CANDIDATES
from .utils import normalize_key


def _load_osm_payload(path: Path) -> Dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


@lru_cache(maxsize=1)
def get_osm_places() -> list[dict[str, Any]]:
    for candidate in OSM_JSON_CANDIDATES:
        if candidate.exists():
            payload = _load_osm_payload(candidate)
            return list(payload.get("places") or [])
    return []


def match_place(name: str | None, address: str | None = None) -> Optional[dict[str, Any]]:
    normalized_name = normalize_key(name)
    normalized_address = normalize_key(address)
    if not normalized_name:
        return None

    best_match: dict[str, Any] | None = None
    best_score = 0.0

    for place in get_osm_places():
        names = [place.get("name")] + list(place.get("aliases") or [])
        name_score = max(
            (fuzz.ratio(normalized_name, normalize_key(candidate)) for candidate in names if candidate),
            default=0.0,
        )
        if name_score < 78:
            continue

        address_score = 0.0
        place_address = normalize_key(place.get("address"))
        if normalized_address and place_address:
            address_score = fuzz.partial_ratio(normalized_address, place_address)
        elif normalized_address and not place_address:
            address_score = 35.0
        elif not normalized_address:
            address_score = 20.0

        score = name_score * 0.8 + address_score * 0.2
        if score > best_score:
            best_score = score
            best_match = {
                "place_id": place.get("place_id"),
                "name": place.get("name"),
                "address": place.get("address"),
                "lat": place.get("lat"),
                "lng": place.get("lng"),
                "confidence": round(score / 100.0, 3),
            }

    return best_match if best_score >= 80 else None
