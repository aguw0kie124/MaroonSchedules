"""
Google Places helper functions with lightweight file-based caching.

Used for:
- One-time offline sync of marker coordinates (lat/lng + venue place_id)
- Runtime dining discovery (venue -> restaurants + opening hours)
"""

from __future__ import annotations

import json
import os
import time
from dataclasses import dataclass
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

import requests


GOOGLE_PLACES_API_BASE = "https://maps.googleapis.com/maps/api/place"


def _get_api_key() -> str:
    api_key = os.environ.get("GOOGLE_PLACES_API_KEY") or os.environ.get("GOOGLE_API_KEY") or ""
    return api_key.strip()


def _cache_paths() -> Tuple[Path, Path]:
    # Backend/services/google_places.py -> Backend/
    backend_dir = Path(__file__).resolve().parent.parent
    cache_dir = backend_dir / ".cache"
    cache_file = cache_dir / "google_places_cache.json"
    return cache_dir, cache_file


def _load_cache() -> Dict[str, Any]:
    cache_dir, cache_file = _cache_paths()
    if not cache_file.exists():
        return {}

    try:
        return json.loads(cache_file.read_text("utf-8"))
    except Exception:
        return {}


def _save_cache(cache: Dict[str, Any]) -> None:
    cache_dir, cache_file = _cache_paths()
    cache_dir.mkdir(parents=True, exist_ok=True)
    tmp_file = cache_file.with_suffix(".tmp")
    tmp_file.write_text(json.dumps(cache, indent=2, ensure_ascii=False), "utf-8")
    tmp_file.replace(cache_file)


def _cache_get(key: str, ttl_seconds: int) -> Optional[Any]:
    cache = _load_cache()
    entry = cache.get(key)
    if not entry:
        return None

    try:
        ts = float(entry.get("ts", 0))
        if ttl_seconds <= 0:
            return entry.get("value")
        if time.time() - ts > ttl_seconds:
            return None
        return entry.get("value")
    except Exception:
        return None


def _cache_set(key: str, value: Any) -> None:
    cache = _load_cache()
    cache[key] = {"ts": time.time(), "value": value}
    _save_cache(cache)


def _haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    # Earth radius: ~6371km
    import math

    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return 6371000.0 * c


def _name_similarity(a: str, b: str) -> float:
    return SequenceMatcher(None, (a or "").lower().strip(), (b or "").lower().strip()).ratio()


def _request_json(url: str, params: Dict[str, Any], timeout: int = 20) -> Dict[str, Any]:
    api_key = _get_api_key()
    if not api_key:
        raise RuntimeError(
            "Missing GOOGLE_PLACES_API_KEY. Add it to `Backend/.env` (or your shell env)."
        )

    params = dict(params)
    params["key"] = api_key
    resp = requests.get(url, params=params, timeout=timeout)
    resp.raise_for_status()
    return resp.json()


def nearby_search(
    lat: float,
    lng: float,
    radius_m: int = 500,
    type_filter: Optional[str] = None,
    keyword: Optional[str] = None,
    max_results: int = 10,
    ttl_seconds: int = 24 * 3600,
) -> List[Dict[str, Any]]:
    """
    Returns a list of candidates:
      [{place_id, name, geometry:{location:{lat,lng}}, vicinity, types}, ...]
    """
    cache_key = f"nearby|{lat:.6f},{lng:.6f}|r={radius_m}|type={type_filter or ''}|kw={keyword or ''}"
    cached = _cache_get(cache_key, ttl_seconds=ttl_seconds)
    if cached is not None:
        return cached

    params: Dict[str, Any] = {
        "location": f"{lat},{lng}",
        "radius": radius_m,
    }
    if type_filter:
        params["type"] = type_filter
    if keyword:
        params["keyword"] = keyword

    data = _request_json(f"{GOOGLE_PLACES_API_BASE}/nearbysearch/json", params=params)
    status = data.get("status")
    if status == "ZERO_RESULTS":
        results: List[Dict[str, Any]] = []
    elif status != "OK":
        # Could be OVER_QUERY_LIMIT, REQUEST_DENIED, INVALID_REQUEST, etc.
        raise RuntimeError(f"Google Places nearbysearch failed: status={status}")
    else:
        results = data.get("results", [])[:max_results]

    _cache_set(cache_key, results)
    return results


def place_details(
    place_id: str,
    fields: Iterable[str],
    ttl_seconds: int = 7 * 24 * 3600,
) -> Dict[str, Any]:
    field_key = ",".join(sorted([f.strip() for f in fields if f.strip()]))
    cache_key = f"details|{place_id}|{field_key}"
    cached = _cache_get(cache_key, ttl_seconds=ttl_seconds)
    if cached is not None:
        return cached

    params = {
        "place_id": place_id,
        "fields": field_key,
    }
    data = _request_json(f"{GOOGLE_PLACES_API_BASE}/details/json", params=params)
    status = data.get("status")
    if status != "OK":
        raise RuntimeError(f"Google Places details failed: status={status}")

    result = data.get("result", {}) or {}
    _cache_set(cache_key, result)
    return result


def pick_best_candidate(
    *,
    target_name: str,
    target_lat: float,
    target_lng: float,
    candidates: List[Dict[str, Any]],
) -> Optional[Dict[str, Any]]:
    if not candidates:
        return None

    best = None
    best_score = -1.0
    for c in candidates:
        c_name = c.get("name") or ""
        loc = (c.get("geometry") or {}).get("location") or {}
        c_lat = loc.get("lat")
        c_lng = loc.get("lng")
        if c_lat is None or c_lng is None:
            continue

        dist_m = _haversine_m(target_lat, target_lng, float(c_lat), float(c_lng))
        name_score = _name_similarity(target_name, c_name)
        # Distance score: 1 at 0m, ~0.33 at 1km
        dist_score = 1.0 / (1.0 + dist_m / 500.0)
        score = 0.7 * name_score + 0.3 * dist_score

        if score > best_score:
            best_score = score
            best = c

    # Conservative threshold: avoid obviously wrong matches.
    if best_score < 0.35:
        return None
    return best


def resolve_place_for_location(
    location_name: str,
    location_type: str,
    lat: float,
    lng: float,
    radius_m_candidates: Iterable[int] = (100, 250, 500, 800, 1200),
    max_nearby_results: int = 12,
) -> Dict[str, Any]:
    """
    Returns:
      {place_id, resolved_name, resolved_lat, resolved_lng}
    """
    type_try: List[str]
    if location_type == "Dining":
        type_try = ["restaurant", "food"]
    elif location_type == "Library":
        type_try = ["library"]
    elif location_type == "Rec":
        # gyms and sport/fitness facilities
        type_try = ["gym", "point_of_interest", "park"]
    else:
        type_try = ["point_of_interest"]

    last_candidates: List[Dict[str, Any]] = []
    for radius_m in radius_m_candidates:
        for t in type_try:
            # First try with keyword to bias matching
            cands = nearby_search(
                lat=lat,
                lng=lng,
                radius_m=radius_m,
                type_filter=t,
                keyword=location_name,
                max_results=max_nearby_results,
            )
            if not cands:
                # Retry without keyword if nothing found.
                cands = nearby_search(
                    lat=lat,
                    lng=lng,
                    radius_m=radius_m,
                    type_filter=t,
                    keyword=None,
                    max_results=max_nearby_results,
                )
            last_candidates = cands

            picked = pick_best_candidate(
                target_name=location_name,
                target_lat=lat,
                target_lng=lng,
                candidates=cands,
            )
            if picked:
                place_id = picked.get("place_id")
                if not place_id:
                    continue
                # Resolve geometry from details to get accurate marker coordinate.
                details = place_details(
                    place_id,
                    fields=["place_id", "name", "geometry"],
                    ttl_seconds=30 * 24 * 3600,
                )
                geom = (details.get("geometry") or {}).get("location") or {}
                r_lat = geom.get("lat")
                r_lng = geom.get("lng")
                return {
                    "place_id": place_id,
                    "resolved_name": details.get("name") or picked.get("name"),
                    "resolved_lat": r_lat,
                    "resolved_lng": r_lng,
                }

    raise RuntimeError(
        f"Could not resolve a confident Google Place match for '{location_name}' near ({lat},{lng}). "
        f"Last candidates={len(last_candidates)}"
    )

