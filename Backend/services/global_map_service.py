from __future__ import annotations

import math
import os
from typing import Any, Dict, Iterable, List

import requests

from services import cache_service


NOMINATIM_BASE_URL = os.environ.get("NOMINATIM_BASE_URL", "https://nominatim.openstreetmap.org").rstrip("/")
OSRM_BASE_URL = os.environ.get("OSRM_BASE_URL", "https://router.project-osrm.org").rstrip("/")
VALHALLA_BASE_URL = os.environ.get("VALHALLA_BASE_URL", "https://valhalla1.openstreetmap.de").rstrip("/")
MAP_REQUEST_TIMEOUT_SECONDS = max(5, int(os.environ.get("MAP_REQUEST_TIMEOUT_SECONDS", "18")))
OSRM_REQUEST_TIMEOUT_SECONDS = max(3, int(os.environ.get("OSRM_REQUEST_TIMEOUT_SECONDS", "8")))
VALHALLA_REQUEST_TIMEOUT_SECONDS = max(5, int(os.environ.get("VALHALLA_REQUEST_TIMEOUT_SECONDS", str(MAP_REQUEST_TIMEOUT_SECONDS))))
MAPS_CONTACT_EMAIL = os.environ.get("MAPS_CONTACT_EMAIL", "").strip()
MAPS_USER_AGENT = os.environ.get(
    "MAPS_USER_AGENT",
    "MaroonSchedules/1.0 (+https://github.com/openai/codex)",
).strip()

SEARCH_CACHE_TTL_SECONDS = max(60, int(os.environ.get("MAP_SEARCH_CACHE_TTL_SECONDS", str(6 * 3600))))
ROUTE_CACHE_TTL_SECONDS = max(60, int(os.environ.get("MAP_ROUTE_CACHE_TTL_SECONDS", str(30 * 60))))


def _normalized_text(value: str | None) -> str:
    return " ".join((value or "").strip().split())


def _cache_key(parts: Iterable[str]) -> str:
    return "global-map:" + "|".join(parts)


def _request_json(
    url: str,
    *,
    method: str = "GET",
    params: Dict[str, Any] | None = None,
    json_body: Dict[str, Any] | None = None,
    timeout: int = MAP_REQUEST_TIMEOUT_SECONDS,
) -> Any:
    headers = {
        "User-Agent": MAPS_USER_AGENT,
        "Accept": "application/json",
        "Accept-Language": "en-US,en;q=0.9",
    }
    response = requests.request(
        method.upper(),
        url,
        params=params,
        json=json_body,
        headers=headers,
        timeout=timeout,
    )
    response.raise_for_status()
    return response.json()


def _coerce_float(value: Any, *, fallback: float = 0.0) -> float:
    try:
        return float(value)
    except Exception:
        return fallback


def _build_address_label(address: Dict[str, Any] | None, display_name: str) -> str | None:
    if not isinstance(address, dict):
        return display_name or None

    parts: List[str] = []
    for key in ("road", "suburb", "city", "town", "village", "county", "state", "country"):
        value = _normalized_text(str(address.get(key) or ""))
        if value and value not in parts:
            parts.append(value)
    return ", ".join(parts) or display_name or None


def _map_location_type(category: str | None, subtype: str | None, addresstype: str | None) -> str:
    normalized_values = {
        _normalized_text(category).lower(),
        _normalized_text(subtype).lower(),
        _normalized_text(addresstype).lower(),
    }
    name = " ".join(sorted(value for value in normalized_values if value))

    if any(value in normalized_values for value in {"restaurant", "fast_food", "cafe", "food_court", "bar", "pub"}):
        return "Dining"
    if "library" in normalized_values:
        return "Library"
    if any(value in normalized_values for value in {"fitness_centre", "sports_centre", "stadium", "park", "pitch"}):
        return "Rec"
    if any(value in normalized_values for value in {"parking", "parking_entrance", "parking_space", "garage"}):
        return "Parking"
    if any(value in normalized_values for value in {"college", "school", "university"}):
        return "Academic"
    if any(value in normalized_values for value in {"museum", "memorial", "monument", "attraction", "viewpoint"}):
        return "Landmark"
    if "residential" in name or "house" in normalized_values or "apartments" in normalized_values:
        return "Housing"
    return "General"


def _ordinal(value: int) -> str:
    if 10 <= value % 100 <= 20:
        suffix = "th"
    else:
        suffix = {1: "st", 2: "nd", 3: "rd"}.get(value % 10, "th")
    return f"{value}{suffix}"


def _format_road_label(step: Dict[str, Any]) -> str:
    road_name = _normalized_text(str(step.get("name") or ""))
    destinations = _normalized_text(str(step.get("destinations") or ""))
    ref_value = _normalized_text(str(step.get("ref") or ""))
    rotary_name = _normalized_text(str(step.get("rotary_name") or ""))

    if rotary_name:
        return rotary_name
    if road_name and ref_value and ref_value.lower() not in road_name.lower():
        return f"{road_name} ({ref_value})"
    if road_name:
        return road_name
    if ref_value:
        return ref_value
    if destinations:
        return destinations
    return ""


def _instruction_for_step(step: Dict[str, Any], destination_name: str) -> str:
    maneuver = step.get("maneuver") or {}
    maneuver_type = _normalized_text(str(maneuver.get("type") or "")).lower()
    modifier = _normalized_text(str(maneuver.get("modifier") or "")).lower()
    road_label = _format_road_label(step)
    destinations = _normalized_text(str(step.get("destinations") or ""))
    exit_number = maneuver.get("exit")

    def with_road(prefix: str) -> str:
        if road_label:
            return f"{prefix} onto {road_label}"
        if destinations:
            return f"{prefix} toward {destinations}"
        return prefix

    if maneuver_type == "depart":
        if modifier:
            return with_road(f"Head {modifier}")
        return with_road("Start out")

    if maneuver_type == "arrive":
        side = _normalized_text(str(maneuver.get("modifier") or "")).lower()
        if side in {"left", "right"}:
            return f"Arrive at {destination_name} on the {side}"
        return f"Arrive at {destination_name}"

    if maneuver_type in {"turn", "new name", "continue", "notification"}:
        action = "Continue"
        if maneuver_type == "turn" and modifier:
            action = f"Turn {modifier}"
        elif maneuver_type == "new name":
            action = "Continue"
        elif maneuver_type == "continue" and modifier:
            action = f"Continue {modifier}"
        return with_road(action)

    if maneuver_type in {"merge", "on ramp", "off ramp", "fork"}:
        action = "Merge"
        if maneuver_type == "on ramp":
            action = "Take the ramp"
        elif maneuver_type == "off ramp":
            action = "Take the exit"
        elif maneuver_type == "fork" and modifier:
            action = f"Keep {modifier}"
        return with_road(action)

    if maneuver_type == "end of road":
        if modifier:
            return with_road(f"At the end of the road, turn {modifier}")
        return with_road("At the end of the road, continue")

    if maneuver_type in {"roundabout", "rotary", "roundabout turn", "exit roundabout", "exit rotary"}:
        if isinstance(exit_number, int) and exit_number > 0:
            return with_road(f"Enter the roundabout and take the {_ordinal(exit_number)} exit")
        return with_road("Continue through the roundabout")

    if maneuver_type == "use lane":
        return with_road("Use the indicated lane")

    if modifier:
        return with_road(f"Continue {modifier}")
    return with_road("Continue")


def _step_icon(step: Dict[str, Any]) -> str:
    maneuver = step.get("maneuver") or {}
    maneuver_type = _normalized_text(str(maneuver.get("type") or "")).lower()
    if maneuver_type == "arrive":
        return "📍"
    if maneuver_type in {"roundabout", "rotary", "roundabout turn", "exit roundabout", "exit rotary"}:
        return "↺"
    if maneuver_type in {"merge", "on ramp", "off ramp", "fork"}:
        return "🛣️"
    return "🧭"


def _build_route_steps(steps: List[Dict[str, Any]], destination_name: str) -> List[Dict[str, Any]]:
    route_steps: List[Dict[str, Any]] = []
    for index, step in enumerate(steps, start=1):
        route_steps.append(
            {
                "id": index,
                "instruction": _instruction_for_step(step, destination_name),
                "icon": _step_icon(step),
                "distance_meters": round(_coerce_float(step.get("distance")), 1),
                "duration_seconds": round(_coerce_float(step.get("duration")), 1),
            }
        )
    return route_steps


def _decode_polyline(shape: str, precision: int = 6) -> List[Dict[str, float]]:
    coordinates: List[Dict[str, float]] = []
    factor = 10 ** precision
    index = 0
    latitude = 0
    longitude = 0

    while index < len(shape):
        result = 0
        shift = 0
        while True:
            value = ord(shape[index]) - 63
            index += 1
            result |= (value & 0x1F) << shift
            shift += 5
            if value < 0x20:
                break
        latitude += ~(result >> 1) if result & 1 else result >> 1

        result = 0
        shift = 0
        while True:
            value = ord(shape[index]) - 63
            index += 1
            result |= (value & 0x1F) << shift
            shift += 5
            if value < 0x20:
                break
        longitude += ~(result >> 1) if result & 1 else result >> 1

        coordinates.append(
            {
                "latitude": latitude / factor,
                "longitude": longitude / factor,
            }
        )

    return coordinates


def _build_valhalla_steps(legs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    route_steps: List[Dict[str, Any]] = []
    next_id = 1
    for leg in legs:
        for maneuver in leg.get("maneuvers") or []:
            instruction = _normalized_text(str(maneuver.get("instruction") or ""))
            if not instruction:
                continue
            instruction_lower = instruction.lower()
            icon = "📍" if "arrive" in instruction_lower or "destination" in instruction_lower else "🧭"
            if "roundabout" in instruction_lower:
                icon = "↺"
            elif any(keyword in instruction_lower for keyword in ("ramp", "merge", "exit")):
                icon = "🛣️"

            route_steps.append(
                {
                    "id": next_id,
                    "instruction": instruction,
                    "icon": icon,
                    "distance_meters": round(_coerce_float(maneuver.get("length")) * 1609.344, 1),
                    "duration_seconds": round(_coerce_float(maneuver.get("time")), 1),
                }
            )
            next_id += 1
    return route_steps


def _route_via_osrm(
    *,
    origin_lat: float,
    origin_lng: float,
    destination_lat: float,
    destination_lng: float,
    normalized_mode: str,
    origin_name: str | None,
    destination_name: str | None,
) -> Dict[str, Any]:
    profile_map = {
        "walk": "foot",
        "walking": "foot",
        "drive": "driving",
        "driving": "driving",
        "bike": "bike",
        "bicycle": "bike",
        "cycling": "bike",
    }
    osrm_profile = profile_map.get(normalized_mode)
    if not osrm_profile:
        raise ValueError(f"Unsupported route mode: {normalized_mode}")

    coordinates = f"{destination_lng},{destination_lat}"
    coordinates = f"{origin_lng},{origin_lat};{coordinates}"
    url = f"{OSRM_BASE_URL}/route/v1/{osrm_profile}/{coordinates}"
    params = {
        "alternatives": "false",
        "overview": "full",
        "steps": "true",
        "geometries": "geojson",
    }

    payload = _request_json(
        url,
        params=params,
        timeout=OSRM_REQUEST_TIMEOUT_SECONDS,
    )
    routes = payload.get("routes") or []
    if not routes:
        raise RuntimeError("No route found from OSRM.")

    route = routes[0]
    geometry = (route.get("geometry") or {}).get("coordinates") or []
    polyline = [
        {
            "latitude": _coerce_float(point[1]),
            "longitude": _coerce_float(point[0]),
        }
        for point in geometry
        if isinstance(point, list) and len(point) >= 2
    ]

    raw_steps: List[Dict[str, Any]] = []
    for leg in route.get("legs") or []:
        raw_steps.extend(leg.get("steps") or [])

    destination_label = _normalized_text(destination_name) or "your destination"
    duration_seconds = _coerce_float(route.get("duration"))
    distance_meters = _coerce_float(route.get("distance"))

    return {
        "provider": "osrm",
        "mode": normalized_mode if normalized_mode in {"walk", "drive", "bike"} else {
            "foot": "walk",
            "driving": "drive",
            "bike": "bike",
        }.get(osrm_profile, normalized_mode),
        "origin_name": _normalized_text(origin_name) or "Origin",
        "destination_name": destination_label,
        "distance_meters": round(distance_meters, 1),
        "duration_seconds": round(duration_seconds, 1),
        "estimated_time_minutes": max(1, int(math.ceil(duration_seconds / 60.0))),
        "polyline": polyline,
        "steps": _build_route_steps(raw_steps, destination_label),
    }


def _route_via_valhalla(
    *,
    origin_lat: float,
    origin_lng: float,
    destination_lat: float,
    destination_lng: float,
    normalized_mode: str,
    origin_name: str | None,
    destination_name: str | None,
) -> Dict[str, Any]:
    costing_map = {
        "walk": "pedestrian",
        "walking": "pedestrian",
        "drive": "auto",
        "driving": "auto",
        "bike": "bicycle",
        "bicycle": "bicycle",
        "cycling": "bicycle",
    }
    costing = costing_map.get(normalized_mode)
    if not costing:
        raise ValueError(f"Unsupported route mode: {normalized_mode}")

    payload = _request_json(
        f"{VALHALLA_BASE_URL}/route",
        method="POST",
        json_body={
            "locations": [
                {"lat": origin_lat, "lon": origin_lng},
                {"lat": destination_lat, "lon": destination_lng},
            ],
            "costing": costing,
            "directions_options": {
                "units": "miles",
            },
        },
        timeout=VALHALLA_REQUEST_TIMEOUT_SECONDS,
    )

    trip = payload.get("trip") or {}
    legs = trip.get("legs") or []
    if not legs:
        raise RuntimeError("No route found from Valhalla.")

    summary = trip.get("summary") or {}
    duration_seconds = _coerce_float(summary.get("time"))
    distance_miles = _coerce_float(summary.get("length"))
    polyline: List[Dict[str, float]] = []
    for leg in legs:
        shape = _normalized_text(str(leg.get("shape") or ""))
        if not shape:
            continue
        decoded = _decode_polyline(shape, precision=6)
        if polyline and decoded:
            polyline.extend(decoded[1:])
        else:
            polyline.extend(decoded)

    destination_label = _normalized_text(destination_name) or "your destination"
    return {
        "provider": "valhalla",
        "mode": normalized_mode if normalized_mode in {"walk", "drive", "bike"} else {
            "pedestrian": "walk",
            "auto": "drive",
            "bicycle": "bike",
        }.get(costing, normalized_mode),
        "origin_name": _normalized_text(origin_name) or "Origin",
        "destination_name": destination_label,
        "distance_meters": round(distance_miles * 1609.344, 1),
        "duration_seconds": round(duration_seconds, 1),
        "estimated_time_minutes": max(1, int(math.ceil(duration_seconds / 60.0))),
        "polyline": polyline,
        "steps": _build_valhalla_steps(legs),
    }


def search_places(query: str, limit: int = 8) -> Dict[str, Any]:
    normalized_query = _normalized_text(query)
    if len(normalized_query) < 2:
        return {"provider": "nominatim", "results": []}

    safe_limit = max(1, min(int(limit or 8), 10))
    cache_key = _cache_key(
        [
            "search",
            normalized_query.lower(),
            str(safe_limit),
        ]
    )
    cached = cache_service.get_json(cache_key)
    if cached is not None:
        return cached

    params: Dict[str, Any] = {
        "q": normalized_query,
        "format": "jsonv2",
        "addressdetails": 1,
        "limit": safe_limit,
        "namedetails": 1,
        "dedupe": 1,
    }
    if MAPS_CONTACT_EMAIL:
        params["email"] = MAPS_CONTACT_EMAIL

    payload = _request_json(f"{NOMINATIM_BASE_URL}/search", params=params)
    results: List[Dict[str, Any]] = []
    for item in payload or []:
        display_name = _normalized_text(str(item.get("display_name") or ""))
        primary_name = _normalized_text(
            str(
                item.get("name")
                or (item.get("namedetails") or {}).get("name")
                or display_name.split(",")[0]
            )
        )
        if not primary_name:
            continue

        category = _normalized_text(str(item.get("category") or ""))
        subtype = _normalized_text(str(item.get("type") or ""))
        addresstype = _normalized_text(str(item.get("addresstype") or ""))
        location_type = _map_location_type(category, subtype, addresstype)
        address = item.get("address") if isinstance(item.get("address"), dict) else {}
        address_label = _build_address_label(address, display_name)

        osm_type = _normalized_text(str(item.get("osm_type") or ""))
        osm_id = _normalized_text(str(item.get("osm_id") or item.get("place_id") or ""))
        result_id = f"nominatim:{osm_type}:{osm_id}" if osm_type and osm_id else f"nominatim:{primary_name.lower()}"

        results.append(
            {
                "id": result_id,
                "name": primary_name,
                "display_name": display_name,
                "short_name": primary_name,
                "lat": _coerce_float(item.get("lat")),
                "lng": _coerce_float(item.get("lon")),
                "location_type": location_type,
                "category": category,
                "subcategory": subtype,
                "address": address_label,
                "country_code": _normalized_text(str(item.get("address", {}).get("country_code") or "")),
                "importance": _coerce_float(item.get("importance")),
                "source": "nominatim",
            }
        )

    response = {
        "provider": "nominatim",
        "results": results,
    }
    cache_service.set_json(cache_key, response, SEARCH_CACHE_TTL_SECONDS)
    return response


def _round_coordinate(value: float) -> str:
    return f"{float(value):.6f}"


def route_between(
    *,
    origin_lat: float,
    origin_lng: float,
    destination_lat: float,
    destination_lng: float,
    mode: str,
    origin_name: str | None = None,
    destination_name: str | None = None,
) -> Dict[str, Any]:
    normalized_mode = _normalized_text(mode).lower()
    if normalized_mode not in {"walk", "walking", "drive", "driving", "bike", "bicycle", "cycling"}:
        raise ValueError(f"Unsupported route mode: {mode}")

    cache_key = _cache_key(
        [
            "route",
            normalized_mode,
            _round_coordinate(origin_lat),
            _round_coordinate(origin_lng),
            _round_coordinate(destination_lat),
            _round_coordinate(destination_lng),
            _normalized_text(origin_name).lower(),
            _normalized_text(destination_name).lower(),
        ]
    )
    cached = cache_service.get_json(cache_key)
    if cached is not None:
        return cached

    providers = (
        _route_via_valhalla,
        _route_via_osrm,
    )
    provider_errors: List[str] = []
    response: Dict[str, Any] | None = None
    for provider in providers:
        try:
            response = provider(
                origin_lat=origin_lat,
                origin_lng=origin_lng,
                destination_lat=destination_lat,
                destination_lng=destination_lng,
                normalized_mode=normalized_mode,
                origin_name=origin_name,
                destination_name=destination_name,
            )
            break
        except Exception as exc:
            provider_errors.append(f"{provider.__name__}: {exc}")

    if response is None:
        raise RuntimeError("No route found for the selected trip. " + " | ".join(provider_errors[:2]))

    cache_service.set_json(cache_key, response, ROUTE_CACHE_TTL_SECONDS)
    return response
