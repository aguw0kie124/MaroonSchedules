from __future__ import annotations
from fastapi import APIRouter, Query, Request
from pydantic import BaseModel
import requests
from datetime import datetime
from typing import List, Dict, Any
import random
from urllib.parse import quote
import pytz
import json
import re
from threading import Lock

from services import cache_service, place_registry_service

try:
    from perplexity import Perplexity
except ImportError:
    Perplexity = None

from rate_limit import limiter

router = APIRouter()

REC_OCCUPANCY_LOCATION_PREFERENCES: Dict[str, tuple[str, ...]] = {
    "rec": (
        "student rec center strength conditioning",
    ),
    "southside-rec": (
        "southside strength conditioning",
        "southside strength conditioning area",
    ),
    "polo-rec": (
        "polo road strength conditioning",
    ),
}


def _safe_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _normalize_location_name(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", " ", str(value or "").lower()).strip()


def _parse_goboard_timestamp(value: Any) -> datetime:
    raw = str(value or "").strip()
    if not raw:
        return datetime.min
    try:
        return datetime.fromisoformat(raw)
    except ValueError:
        return datetime.min


class TAMUFacilityTracker:
    def __init__(self):
        self.rec_api = (
            "https://goboardapi.azurewebsites.net/api/FacilityCount/"
            "GetCountsByAccount?AccountAPIKey=99563b55-ae4f-4001-b384-648e0ebeaeb5"
        )
        self.library_api = "https://php.library.tamu.edu/utilities/occupancy/index.php"
        self.events_api = (
            "https://calendar.tamu.edu/live/json/events?"
            "user_tz=America/Chicago&group=* Main University Calendar"
        )
        self.data = {}

    def _get_json(self, url: str) -> Any:
        try:
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            print(f"Error fetching data from {url}: {e}")
            return None

    def fetch_rec_data(self) -> List[Dict]:
        """Returns raw sub-location list from GoBoard."""
        return self._get_json(self.rec_api) or []

    def _resolve_rec_place(self, row: Dict[str, Any]) -> Dict[str, Any] | None:
        for candidate in (row.get("FacilityName"), row.get("LocationName")):
            resolved = place_registry_service.resolve_place(candidate)
            if resolved and resolved.get("type") == "Rec":
                return resolved
        return None

    def _pick_rec_display_row(self, place_id: str, rows: List[Dict[str, Any]]) -> Dict[str, Any] | None:
        if not rows:
            return None

        preferred_names = REC_OCCUPANCY_LOCATION_PREFERENCES.get(place_id, ())

        def rank(row: Dict[str, Any]) -> tuple[int, int, int, datetime]:
            location_name = _normalize_location_name(row.get("LocationName"))
            preferred_rank = 0
            for index, preferred_name in enumerate(preferred_names):
                if location_name == preferred_name:
                    preferred_rank = len(preferred_names) - index
                    break
            return (
                preferred_rank,
                1 if ("strength" in location_name and "conditioning" in location_name) else 0,
                0 if row.get("IsClosed") else 1,
                _safe_int(row.get("TotalCapacity")),
                _parse_goboard_timestamp(row.get("LastUpdatedDateAndTime")),
            )

        return max(rows, key=rank)

    def get_rec_center_live_counts(self, rec_rows: List[Dict] | None = None) -> Dict[str, Dict[str, Any]]:
        rows = rec_rows if rec_rows is not None else self.fetch_rec_data()
        grouped: Dict[str, Dict[str, Any]] = {}

        for row in rows:
            place = self._resolve_rec_place(row)
            if not place:
                continue
            grouped.setdefault(place["place_id"], {"place": place, "rows": []})["rows"].append(row)

        summaries: Dict[str, Dict[str, Any]] = {}
        for place_id, payload in grouped.items():
            display_row = self._pick_rec_display_row(place_id, payload["rows"])
            if not display_row:
                continue

            current_count = _safe_int(display_row.get("LastCount"))
            capacity = _safe_int(display_row.get("TotalCapacity"))
            percent_full = round((current_count / capacity) * 100, 1) if capacity > 0 else None

            summaries[place_id] = {
                "place": payload["place"],
                "row": display_row,
                "location_name": display_row.get("LocationName") or payload["place"]["name"],
                "facility_name": display_row.get("FacilityName") or payload["place"]["name"],
                "current_count": current_count,
                "capacity": capacity,
                "percent_full": percent_full,
                "available_seats": max(0, capacity - current_count) if capacity > 0 else None,
                "last_updated": display_row.get("LastUpdatedDateAndTime"),
                "is_closed": bool(display_row.get("IsClosed")),
            }

        return summaries

    def fetch_library_data(self) -> Dict[str, Any]:
        """Returns the full library API dict (keyed by abbreviation)."""
        data = self._get_json(self.library_api)
        if not data or not isinstance(data, dict):
            return {}
        return data

    def fetch_event_data(self, limit: int = 20) -> List[Dict]:
        data = self._get_json(self.events_api)
        if not data:
            return []
        events = []
        if isinstance(data, dict) and "events" in data:
            for day_events in data["events"].values():
                events.extend(day_events)
        elif isinstance(data, list):
            events = data
        else:
            return []

        parsed = []
        for event in events:
            try:
                start_ts = event.get("ts_start")
                end_ts = event.get("ts_end")
                start_time = datetime.fromtimestamp(start_ts).strftime(
                    "%Y-%m-%d %I:%M %p") if start_ts else "N/A"
                end_time = datetime.fromtimestamp(end_ts).strftime(
                    "%Y-%m-%d %I:%M %p") if end_ts else "N/A"
                parsed.append({
                    "title": event.get("title", "Untitled Event"),
                    "location": event.get("location", "Unknown"),
                    "latitude": event.get("latitude", "N/A"),
                    "longitude": event.get("longitude", "N/A"),
                    "start_time": start_time,
                    "end_time": end_time,
                    "link": f"https://calendar.tamu.edu/live/{event.get('href', '')}",
                    "summary": event.get("summary", "").strip(),
                })
            except Exception:
                pass
        return sorted(parsed, key=lambda e: e["start_time"])[:limit]

    def load_all_data(self):
        self.data = {
            "libraries": self.fetch_library_data(),
            "rec": self.fetch_rec_data(),
            "events": self.fetch_event_data(limit=50)
        }

    def get_mock_metadata(self, loc_name: str, loc_type: str):
        hours_map = {
            "Rec": "6:00 AM – 12:00 AM",
            "Library": "8:00 AM – 11:00 PM",
            "Dining": "7:00 AM – 10:00 PM",
        }
        hours = hours_map.get(loc_type, "8:00 AM – 10:00 PM")
        if loc_type == "Rec":
            if "Evans" in loc_name:
                hours = "Open 24 Hours (Mon–Thu)"
            if "Medical" in loc_name:
                hours = "7:30 AM – 6:00 PM"

        review_pool = [
            {"user": "Parin V.",  "rating": 5,
                "comment": "Great spot, really enjoy the facilities here."},
            {"user": "Asvath M.", "rating": 4,
                "comment": "Solid choice for studying or grabbing a bite."},
            {"user": "Adhip K.",  "rating": 5,
                "comment": "One of my favorite places on campus!"},
            {"user": "Parin V.",  "rating": 4,
                "comment": "Atmosphere is great today."},
            {"user": "Asvath M.", "rating": 3,
                "comment": "Decent, but can get loud during peak hours."},
            {"user": "Adhip K.",  "rating": 4,
                "comment": "Highly recommend checking this out."},
        ]
        selected = [
            random.choice([r for r in review_pool if r["user"] == "Parin V."]),
            random.choice(
                [r for r in review_pool if r["user"] == "Asvath M."]),
            random.choice([r for r in review_pool if r["user"] == "Adhip K."]),
        ]
        random.shuffle(selected)
        history = [random.randint(15, 90) for _ in range(8)]
        # Library / Dining hours must not come from mock text — map uses registry, weekly, and DineOnCampus live periods.
        meta: Dict[str, Any] = {"traffic_history": history}
        if loc_type not in ("Library", "Dining"):
            meta["hours"] = hours
        return meta

    def get_all_locations_with_events(self) -> List[Dict[str, Any]]:
        result = []
        live_percents = []
        resolved_ids = set()

        # ── 1. Rec Centers ───────────────────────────────────────────────────
        rec_live_counts = self.get_rec_center_live_counts()
        for live_count in rec_live_counts.values():
            place = live_count["place"]
            percent = live_count.get("percent_full")
            if percent is None:
                cap = _safe_int(live_count.get("capacity") or 0)
                cur = _safe_int(live_count.get("current_count") or 0)
                if cap > 0:
                    percent = round((cur / cap) * 100, 1)
                elif live_count.get("is_closed"):
                    percent = 0.0
                else:
                    continue
            live_percents.append(percent)
            meta = self.get_mock_metadata(place["name"], "Rec")
            resolved_ids.add(place["place_id"])

            result.append({
                "location": place["name"],
                "percent_full": percent,
                "type": "Rec",
                "is_live": True,
                "available_seats": live_count.get("available_seats"),
                "coord": {"lat": place["lat"], "lng": place["lng"]},
                "current_count": live_count.get("current_count"),
                "capacity": live_count.get("capacity"),
                "place_id": place["place_id"],
                "last_updated": live_count.get("last_updated"),
                "occupancy_name": live_count.get("location_name"),
                **meta,
            })

        # ── 2. Libraries ─────────────────────────────────────────────────────
        lib_raw = self.fetch_library_data()
        for api_key, entry in lib_raw.items():
            if api_key == "lastupdate" or not isinstance(entry, dict):
                continue
                
            place = place_registry_service.resolve_place(api_key)
            if not place:
                continue
                
            percent = float(entry.get("percentfull", 0))
            remaining = _safe_int(entry.get("remaining", 0))
            capacity = _safe_int(entry.get("max", 0))
            occupancy = _safe_int(entry.get("occupancy", 0))
            live_percents.append(percent)
            meta = self.get_mock_metadata(place["name"], "Library")
            resolved_ids.add(place["place_id"])
            
            result.append({
                "location": place["name"],
                "percent_full": percent,
                "type": "Library",
                "is_live": True,
                "available_seats": remaining,
                "coord": {"lat": place["lat"], "lng": place["lng"]},
                "capacity": capacity if capacity > 0 else None,
                "current_count": occupancy,
                "place_id": place["place_id"],
                **meta,
            })

        # ── 3. Dining (AI-estimated) ─────────────────────────────────────────
        avg_occupancy = sum(live_percents) / len(live_percents) if live_percents else 42.0
        
        # Pull all Dining locations from global registry
        for place in place_registry_service.get_all_places():
            if place["type"] != "Dining" or place["place_id"] in resolved_ids:
                continue
                
            est = round(min(95, max(5, avg_occupancy + random.uniform(-15, 20))), 1)
            meta = self.get_mock_metadata(place["name"], "Dining")
            
            result.append({
                "location": place["name"],
                "percent_full": est,
                "type": "Dining",
                "is_live": False,
                "available_seats": None,
                "coord": place["coord"],
                "place_id": place["place_id"],
                **meta,
            })

        # ── 4. Events: preserve event markers with explicit coordinates ──────
        for event in self.fetch_event_data(limit=50):
            location_name = event.get("location") or "Unknown Event Location"
            latitude = event.get("latitude")
            longitude = event.get("longitude")
            if latitude in [None, "", "N/A"] or longitude in [None, "", "N/A"]:
                continue
            try:
                lat = float(latitude)
                lng = float(longitude)
            except Exception:
                continue
            result.append({
                "location": location_name,
                "percent_full": 0,
                "type": "General",
                "is_live": False,
                "available_seats": None,
                "coord": {"lat": lat, "lng": lng},
                "current_event": event.get("title"),
            })
        return result

    def ask_perplexity(self, prompt: str) -> str:
        if not Perplexity:
            return json.dumps([{"name": "Error - Perplexity API Missing", "percent_full": 0, "available_seats": 0}])
        system_prompt = "You are a TAMU campus assistant that returns structured JSON arrays only."
        try:
            embedded_data = json.dumps(self.data, default=str)
        except Exception:
            embedded_data = str(self.data)
        user_message = {
            "role": "user", "content": f"User Query: {prompt}\nLive Data: {embedded_data}"}
        messages = [{"role": "system", "content": system_prompt}, user_message]
        try:
            client = Perplexity()
            response = client.chat.completions.create(
                model="sonar", messages=messages)
            resp_text = response.choices[0].message.content.strip()
        except Exception:
            resp_text = ""

        def try_parse_json(s: str):
            try:
                return json.loads(s)
            except Exception:
                m = re.search(r"\[.*\]", s, re.S)
                if m:
                    try:
                        return json.loads(m.group(0))
                    except Exception:
                        return None
                return None

        parsed = try_parse_json(resp_text)
        if parsed is not None and isinstance(parsed, list):
            normalized = []
            for item in parsed[:3]:
                name = str(item.get("name", "")) if isinstance(
                    item, dict) else ""
                percent = float(item.get("percent_full", 0)
                                ) if isinstance(item, dict) else 0.0
                available = int(item.get("available_seats", 0)
                                ) if isinstance(item, dict) else 0
                normalized.append(
                    {"name": name, "percent_full": percent, "available_seats": available})
            return json.dumps(normalized)
        return json.dumps([{"name": "Parsing failed", "percent_full": 0, "available_seats": 0}])


tracker = TAMUFacilityTracker()


class AggieSpiritProxy:
    def __init__(self):
        self.base_url = "https://aggiespirit.ts.tamu.edu"
        self.session = requests.Session()
        self._auth_headers = None
        self._lock = Lock()
        self._vehicle_cache: Dict[str, List[Dict[str, Any]]] = {}
        self._route_cache: List[Dict[str, Any]] = []
        self._active_cache: List[str] = []
        self._pattern_cache: Dict[str, Dict[str, Any]] = {}
        self._direction_cache: Dict[str, str] = {}
        self._form_token = None

    def _build_auth_headers(self, force_refresh: bool = False) -> Dict[str, str]:
        with self._lock:
            if self._auth_headers and not force_refresh:
                return self._auth_headers

            response = self.session.get(
                f"{self.base_url}/RouteMap", timeout=15)
            response.raise_for_status()
            html = response.text

            html_token_match = re.search(
                r'name="__RequestVerificationToken" type="hidden" value="([^"]+)"', html)
            cookie_token = self.session.cookies.get(
                ".MyRide.RequestVerificationToken")

            if not html_token_match or not cookie_token:
                raise RuntimeError(
                    "Could not initialize AggieSpirit verification token")

            self._form_token = html_token_match.group(1)
            self._auth_headers = {
                "requestverificationtoken": f"{cookie_token}:{self._form_token}",
                "X-Requested-With": "XMLHttpRequest",
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                "Origin": self.base_url,
                "Referer": f"{self.base_url}/RouteMap",
            }
            return self._auth_headers

    def _post(self, path: str, body: str = "", retry: bool = True, content_type: str = "application/x-www-form-urlencoded; charset=UTF-8"):
        headers = self._build_auth_headers()
        headers = dict(headers)
        headers["Content-Type"] = content_type
        response = self.session.post(
            f"{self.base_url}{path}", headers=headers, data=body, timeout=20)
        if response.status_code in (401, 403) and retry:
            headers = self._build_auth_headers(force_refresh=True)
            headers = dict(headers)
            headers["Content-Type"] = content_type
            response = self.session.post(
                f"{self.base_url}{path}", headers=headers, data=body, timeout=20)
        response.raise_for_status()
        return response.json()

    @staticmethod
    def _route_color(route_key: str) -> str:
        palette = ["#500000", "#7E0000", "#B34100", "#0B6E4F",
                   "#165DFF", "#6B3FA0", "#007A78", "#A63D40"]
        if not route_key:
            return palette[0]
        hash_value = 0
        for char in route_key:
            hash_value = ((hash_value * 31) + ord(char)) & 0xFFFFFFFF
        return palette[hash_value % len(palette)]

    def get_active_routes(self) -> List[str]:
        try:
            routes = self._post("/Home/GetActiveRoutes",
                                "null", content_type="application/json")
            if isinstance(routes, list) and routes:
                self._active_cache = routes
            return routes if isinstance(routes, list) and routes else self._active_cache
        except Exception:
            return self._active_cache

    def get_routes(self) -> List[Dict[str, Any]]:
        try:
            data = self._post("/RouteMap/GetBaseData/", "")
            routes = []
            for route in data.get("routes", []):
                for direction in route.get("directionList", []):
                    dkey = direction.get("direction", {}).get("key")
                    dname = direction.get("destination") or direction.get(
                        "direction", {}).get("name")
                    if dkey and dname:
                        self._direction_cache[dkey] = dname

                routes.append({
                    "Key": route.get("key") or route.get("Key"),
                    "Name": route.get("name") or route.get("Name"),
                    "ShortName": route.get("shortName") or route.get("ShortName"),
                    "Color": route.get("color") or route.get("Color") or next((
                        direction.get("lineColor")
                        for direction in (route.get("directionList") or [])
                        if direction.get("lineColor")
                    ), self._route_color(route.get("key") or route.get("shortName") or route.get("name") or "")),
                })
            if routes:
                self._route_cache = routes
            return routes if routes else self._route_cache
        except Exception:
            return self._route_cache

    def get_pattern(self, route_key: str) -> Dict[str, Any]:
        try:
            if not self._direction_cache:
                self.get_routes()

            payload = f"routeKeys%5B%5D={quote(route_key)}"
            data = self._post("/RouteMap/GetPatternPaths/", payload)
            points: List[Dict[str, float]] = []
            stops: List[Dict[str, Any]] = []
            paths: List[Dict[str, Any]] = []
            seen_stops = set()
            if data:
                for item in data[0].get("patternPaths", []):
                    # Fallback to parsing the string if directionKey isn't known
                    dkey = item.get("directionKey")
                    direction_name = self._direction_cache.get(dkey) or ""

                    path_points = []
                    for point in item.get("patternPoints", []):
                        pt = {
                            "latitude": point.get("latitude"),
                            "longitude": point.get("longitude"),
                        }
                        points.append(pt)
                        path_points.append(pt)

                        stop = point.get("stop")
                        if stop and stop.get("stopCode") not in seen_stops:
                            stop_name = stop.get("name") or ""
                            # If no directionName from cache, try splitting by " - "
                            resolved_dir = direction_name
                            if not resolved_dir and " - " in stop_name:
                                resolved_dir = stop_name.split(" - ")[-1]

                            seen_stops.add(stop.get("stopCode"))
                            stops.append({
                                "Name": stop_name,
                                "Latitude": point.get("latitude"),
                                "Longitude": point.get("longitude"),
                                "StopCode": stop.get("stopCode"),
                                "DirectionName": resolved_dir,
                            })
                    if path_points:
                        paths.append({
                            "DirectionName": direction_name,
                            "points": path_points
                        })
            snapshot = {"points": points, "stops": stops, "paths": paths}
            if points or stops:
                self._pattern_cache[route_key] = snapshot
            return snapshot if points or stops else self._pattern_cache.get(route_key, {"points": [], "stops": [], "paths": []})
        except Exception:
            return self._pattern_cache.get(route_key, {"points": [], "stops": [], "paths": []})

    def get_vehicles(self, route_id: str = "") -> Dict[str, Any]:
        normalized_route_id = (route_id or "").strip().lower()
        try:
            route_keys: List[str] = []
            route_lookup = {
                route["Key"]: route for route in self.get_routes() if route.get("Key")}
            if route_id:
                route_keys = [route_id]
            else:
                route_keys = list(route_lookup.keys())

            if not route_keys:
                cache_key = normalized_route_id or "__all__"
                cached = self._vehicle_cache.get(cache_key, [])
                return {"vehicles": cached, "live": False, "used_cache": bool(cached)}

            payload = "&".join(
                [f"routeKeys%5B%5D={quote(route_key)}" for route_key in route_keys])
            data = self._post("/RouteMap/GetVehicles/", payload)
            vehicles: List[Dict[str, Any]] = []
            for route in data or []:
                route_meta = route_lookup.get(route.get("routeKey"))
                identifiers = [
                    str(route.get("routeKey") or "").strip().lower(),
                    str(route.get("shortName") or route_meta.get(
                        "ShortName") if route_meta else "").strip().lower(),
                    str(route.get("name") or route_meta.get("Name")
                        if route_meta else "").strip().lower(),
                ]
                if normalized_route_id and normalized_route_id not in identifiers:
                    continue
                for direction in route.get("vehiclesByDirections", []) or []:
                    dir_key = direction.get("directionKey")
                    for vehicle in direction.get("vehicles", []) or []:
                        location = vehicle.get("location") or {}

                        # Prioritize destination cache over raw direction name for consistency
                        v_dir_key = vehicle.get("directionKey") or dir_key
                        v_dir_name = self._direction_cache.get(v_dir_key)

                        if not v_dir_name:
                            v_dir_name = vehicle.get("directionName") or direction.get(
                                "directionName") or direction.get("name") or "Unknown"

                        vehicles.append({
                            "Key": vehicle.get("key"),
                            "Name": vehicle.get("name"),
                            "Latitude": location.get("latitude"),
                            "Longitude": location.get("longitude"),
                            "Heading": location.get("heading") or location.get("direction"),
                            "Speed": location.get("speed") or vehicle.get("speed"),
                            "DirectionName": v_dir_name,
                            "DirectionKey": vehicle.get("directionKey"),
                            "PassengersOnboard": vehicle.get("passengersOnboard"),
                            "Capacity": vehicle.get("passengerCapacity"),
                            "RouteKey": route.get("routeKey"),
                            "RouteShortName": route.get("shortName") or (route_meta.get("ShortName") if route_meta else None),
                            "RouteName": route.get("name") or (route_meta.get("Name") if route_meta else None),
                            "RouteColor": (route_meta.get("Color") if route_meta else None) or self._route_color(route.get("routeKey") or route.get("shortName") or route.get("name") or ""),
                        })

            cache_key = normalized_route_id or "__all__"
            if vehicles:
                self._vehicle_cache[cache_key] = vehicles
                self._vehicle_cache["__all__"] = vehicles if not normalized_route_id else self._vehicle_cache.get(
                    "__all__", vehicles)
            cached = self._vehicle_cache.get(cache_key, [])
            return {"vehicles": vehicles if vehicles else cached, "live": bool(vehicles), "used_cache": not bool(vehicles) and bool(cached)}
        except Exception:
            cache_key = normalized_route_id or "__all__"
            cached = self._vehicle_cache.get(cache_key, [])
            return {"vehicles": cached, "live": False, "used_cache": bool(cached)}


transit_proxy = AggieSpiritProxy()


class QueryRequest(BaseModel):
    query: str


class EventRequest(BaseModel):
    text: str
    start: str
    end: str
    details: str = ""
    location: str = ""


@router.post("/ask")
@limiter.limit("10/minute")
def ask_perplexity(request: Request, body_request: QueryRequest):
    result = tracker.ask_perplexity(body_request.query)
    return {"response": result}


@router.get("/retrieve")
@limiter.limit("60/minute")
def retrieve_locations(request: Request):
    return tracker.get_all_locations_with_events()


@router.get("/transit/routes")
@limiter.limit("120/minute")
def get_transit_routes(request: Request):
    cache_key = "traffic:transit:routes:v1"
    cached = cache_service.get_json(cache_key)
    if cached is not None:
        return cached

    payload = {
        "routes": transit_proxy.get_routes(),
        "activeRouteIds": transit_proxy.get_active_routes(),
    }
    cache_service.set_json(cache_key, payload, 60)
    return payload


@router.get("/transit/route/{route_key}")
@limiter.limit("120/minute")
def get_transit_route(request: Request, route_key: str):
    cache_key = f"traffic:transit:route:v1:{route_key}"
    cached = cache_service.get_json(cache_key)
    if cached is not None:
        return cached

    payload = transit_proxy.get_pattern(route_key)
    cache_service.set_json(cache_key, payload, 120)
    return payload


@router.get("/transit/vehicles")
@limiter.limit("120/minute")
def get_transit_vehicles(request: Request, route_id: str = Query("")):
    cache_key = f"traffic:transit:vehicles:v1:{route_id or '__all__'}"
    cached = cache_service.get_json(cache_key)
    if cached is not None:
        return cached

    payload = transit_proxy.get_vehicles(route_id)
    cache_service.set_json(cache_key, payload, 15)
    return payload


@router.post("/create-event")
@limiter.limit("10/minute")
def create_event(request: Request, event: EventRequest):
    event_dict = event.dict()
    base_url = "https://calendar.google.com/calendar/r/eventedit?"
    params = (
        f"text={quote(event_dict.get('text', ''))}"
        f"&dates={event_dict.get('start', '')}/{event_dict.get('end', '')}"
        f"&details={quote(event_dict.get('details', ''))}"
        f"&location={quote(event_dict.get('location', ''))}"
    )
    return {"message": "Google Calendar link created!", "link": base_url + params}
