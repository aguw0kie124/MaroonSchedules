from fastapi import APIRouter, Query
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
from collections import defaultdict

try:
    from perplexity import Perplexity
except ImportError:
    Perplexity = None

# ── Canonical location registry ──────────────────────────────────────────────
# Display names match exactly what the GoBoard FacilityName or Library API key resolves to.
# All coordinates verified via Google Maps.
LOCATION_DATA = {
    # Rec Centers  (matched by GoBoard FacilityName)
    "Student Rec Center":   {"lat": 30.607133, "lng": -96.342862, "type": "Rec"},
    "Southside Rec Center": {"lat": 30.615518, "lng": -96.333422, "type": "Rec"},
    "Polo Road Rec Center": {"lat": 30.623467, "lng": -96.338006, "type": "Rec"},

    # Libraries  (matched by LIBRARY_KEY_MAP below)
    "Evans Library":                          {"lat": 30.616607, "lng": -96.339047, "type": "Library"},
    "Evans Library Annex":                    {"lat": 30.616300, "lng": -96.338340, "type": "Library"},
    "West Campus Library":                    {"lat": 30.611570, "lng": -96.350164, "type": "Library"},
    "Cushing Memorial Library":               {"lat": 30.616360, "lng": -96.339900, "type": "Library"},
    "Medical Sciences Library":               {"lat": 30.61182, "lng": -96.35161, "type": "Library"},
    "Policy Sciences & Economics Library":    {"lat": 30.59744, "lng": -96.35355, "type": "Library"},

    # Dining (AI-estimated, no live API)
    "Sbisa Dining Hall":              {"lat": 30.61700, "lng": -96.34350, "type": "Dining"},
    "The Commons Dining Hall":        {"lat": 30.61534, "lng": -96.33601, "type": "Dining"},
    "Duncan Dining Hall":             {"lat": 30.61180, "lng": -96.33529, "type": "Dining"},
    "West Campus Dining Facility":    {"lat": 30.61020, "lng": -96.34863, "type": "Dining"},
    "Memorial Student Center (MSC)":  {"lat": 30.61223, "lng": -96.34137, "type": "Dining"},
    "Polo Road Garage":               {"lat": 30.62313, "lng": -96.33749, "type": "Dining"},
    "Creekside Market":               {"lat": 30.60756, "lng": -96.35381, "type": "Dining"},
}

# Maps Library API abbreviation keys → canonical display name in LOCATION_DATA
LIBRARY_KEY_MAP: Dict[str, str] = {
    "evans":   "Evans Library",
    "annex":   "Evans Library Annex",
    "blcc":    "West Campus Library",       # API calls it WCL/BLCC
    "cushing": "Cushing Memorial Library",
    "msl":     "Medical Sciences Library",
    "psel":    "Policy Sciences & Economics Library",
}

# GoBoard FacilityName → canonical display name (only needed where they differ)
REC_FACILITY_MAP: Dict[str, str] = {
    "Student Rec Center":   "Student Rec Center",
    "Southside Rec Center": "Southside Rec Center",
    "Polo Road Rec Center": "Polo Road Rec Center",
    # Ignore: Penberthy, PEAP, Aquatics — not in our registry
}

router = APIRouter()


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
                start_time = datetime.fromtimestamp(start_ts).strftime("%Y-%m-%d %I:%M %p") if start_ts else "N/A"
                end_time = datetime.fromtimestamp(end_ts).strftime("%Y-%m-%d %I:%M %p") if end_ts else "N/A"
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
        if "Evans" in loc_name:
            hours = "Open 24 Hours (Mon–Thu)"
        if "Medical" in loc_name:
            hours = "7:30 AM – 6:00 PM"

        review_pool = [
            {"user": "Parin V.",  "rating": 5, "comment": "Great spot, really enjoy the facilities here."},
            {"user": "Asvath M.", "rating": 4, "comment": "Solid choice for studying or grabbing a bite."},
            {"user": "Adhip K.",  "rating": 5, "comment": "One of my favorite places on campus!"},
            {"user": "Parin V.",  "rating": 4, "comment": "Atmosphere is great today."},
            {"user": "Asvath M.", "rating": 3, "comment": "Decent, but can get loud during peak hours."},
            {"user": "Adhip K.",  "rating": 4, "comment": "Highly recommend checking this out."},
        ]
        selected = [
            random.choice([r for r in review_pool if r["user"] == "Parin V."]),
            random.choice([r for r in review_pool if r["user"] == "Asvath M."]),
            random.choice([r for r in review_pool if r["user"] == "Adhip K."]),
        ]
        random.shuffle(selected)
        history = [random.randint(15, 90) for _ in range(8)]
        return {"hours": hours, "reviews": selected, "traffic_history": history}

    def get_all_locations_with_events(self) -> List[Dict[str, Any]]:
        result = []
        live_percents = []

        # ── 1. Rec Centers: aggregate sub-locations by FacilityName ──────────
        rec_raw = self.fetch_rec_data()
        facility_totals: Dict[str, Dict] = defaultdict(lambda: {"count": 0, "capacity": 0})
        for entry in rec_raw:
            fname = entry.get("FacilityName", "")
            if fname not in REC_FACILITY_MAP:
                continue  # skip Penberthy, PEAP, Aquatics
            facility_totals[fname]["count"]    += entry.get("LastCount", 0)
            facility_totals[fname]["capacity"] += entry.get("TotalCapacity", 1)

        for api_name, display_name in REC_FACILITY_MAP.items():
            totals = facility_totals.get(api_name)
            if not totals or totals["capacity"] == 0:
                continue  # no data for this facility
            percent = round((totals["count"] / totals["capacity"]) * 100, 1)
            live_percents.append(percent)
            info = LOCATION_DATA[display_name]
            meta = self.get_mock_metadata(display_name, "Rec")
            result.append({
                "location": display_name,
                "percent_full": percent,
                "type": "Rec",
                "is_live": True,
                "available_seats": totals["capacity"] - totals["count"],
                "coord": info,
                **meta,
            })

        # ── 2. Libraries: use API abbreviation → canonical name map ──────────
        lib_raw = self.fetch_library_data()
        for api_key, display_name in LIBRARY_KEY_MAP.items():
            entry = lib_raw.get(api_key)
            if not entry or api_key == "lastupdate":
                continue
            percent = float(entry.get("percentfull", 0))
            remaining = int(entry.get("remaining", 0))
            live_percents.append(percent)
            info = LOCATION_DATA[display_name]
            meta = self.get_mock_metadata(display_name, "Library")
            result.append({
                "location": display_name,
                "percent_full": percent,
                "type": "Library",
                "is_live": True,
                "available_seats": remaining,
                "coord": info,
                **meta,
            })

        # ── 3. Dining: AI-estimated using live campus average ────────────────
        avg_occupancy = sum(live_percents) / len(live_percents) if live_percents else 42.0
        live_display_names = {r["location"] for r in result}

        for loc_name, info in LOCATION_DATA.items():
            if info["type"] != "Dining":
                continue
            if loc_name in live_display_names:
                continue
            est = round(min(95, max(5, avg_occupancy + random.uniform(-15, 20))), 1)
            meta = self.get_mock_metadata(loc_name, "Dining")
            result.append({
                "location": loc_name,
                "percent_full": est,
                "type": "Dining",
                "is_live": False,
                "available_seats": None,
                "coord": info,
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
        user_message = {"role": "user", "content": f"User Query: {prompt}\nLive Data: {embedded_data}"}
        messages = [{"role": "system", "content": system_prompt}, user_message]
        try:
            client = Perplexity()
            response = client.chat.completions.create(model="sonar", messages=messages)
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
                name = str(item.get("name", "")) if isinstance(item, dict) else ""
                percent = float(item.get("percent_full", 0)) if isinstance(item, dict) else 0.0
                available = int(item.get("available_seats", 0)) if isinstance(item, dict) else 0
                normalized.append({"name": name, "percent_full": percent, "available_seats": available})
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
        self._form_token = None

    def _build_auth_headers(self, force_refresh: bool = False) -> Dict[str, str]:
        with self._lock:
            if self._auth_headers and not force_refresh:
                return self._auth_headers

            response = self.session.get(f"{self.base_url}/RouteMap", timeout=15)
            response.raise_for_status()
            html = response.text

            html_token_match = re.search(r'name="__RequestVerificationToken" type="hidden" value="([^"]+)"', html)
            cookie_token = self.session.cookies.get(".MyRide.RequestVerificationToken")

            if not html_token_match or not cookie_token:
                raise RuntimeError("Could not initialize AggieSpirit verification token")

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
        response = self.session.post(f"{self.base_url}{path}", headers=headers, data=body, timeout=20)
        if response.status_code in (401, 403) and retry:
            headers = self._build_auth_headers(force_refresh=True)
            headers = dict(headers)
            headers["Content-Type"] = content_type
            response = self.session.post(f"{self.base_url}{path}", headers=headers, data=body, timeout=20)
        response.raise_for_status()
        return response.json()

    @staticmethod
    def _route_color(route_key: str) -> str:
        palette = ["#500000", "#7E0000", "#B34100", "#0B6E4F", "#165DFF", "#6B3FA0", "#007A78", "#A63D40"]
        if not route_key:
            return palette[0]
        hash_value = 0
        for char in route_key:
            hash_value = ((hash_value * 31) + ord(char)) & 0xFFFFFFFF
        return palette[hash_value % len(palette)]

    def get_active_routes(self) -> List[str]:
        try:
            routes = self._post("/Home/GetActiveRoutes", "null", content_type="application/json")
            if isinstance(routes, list) and routes:
                self._active_cache = routes
            return routes if isinstance(routes, list) and routes else self._active_cache
        except Exception:
            return self._active_cache

    def get_routes(self) -> List[Dict[str, Any]]:
        try:
            data = self._post("/RouteMap/GetBaseData/", "")
            routes = [{
                "Key": route.get("key") or route.get("Key"),
                "Name": route.get("name") or route.get("Name"),
                "ShortName": route.get("shortName") or route.get("ShortName"),
                "Color": route.get("color") or route.get("Color") or next((
                    direction.get("lineColor")
                    for direction in (route.get("directionList") or [])
                    if direction.get("lineColor")
                ), self._route_color(route.get("key") or route.get("shortName") or route.get("name") or "")),
            } for route in data.get("routes", [])]
            if routes:
                self._route_cache = routes
            return routes if routes else self._route_cache
        except Exception:
            return self._route_cache

    def get_pattern(self, route_key: str) -> Dict[str, Any]:
        try:
            payload = f"routeKeys%5B%5D={quote(route_key)}"
            data = self._post("/RouteMap/GetPatternPaths/", payload)
            points: List[Dict[str, float]] = []
            stops: List[Dict[str, Any]] = []
            seen_stops = set()
            if data:
                for item in data[0].get("patternPaths", []):
                    for point in item.get("patternPoints", []):
                        points.append({
                            "latitude": point.get("latitude"),
                            "longitude": point.get("longitude"),
                        })
                        stop = point.get("stop")
                        if stop and stop.get("stopCode") not in seen_stops:
                            seen_stops.add(stop.get("stopCode"))
                            stops.append({
                                "Name": stop.get("name"),
                                "Latitude": point.get("latitude"),
                                "Longitude": point.get("longitude"),
                                "StopCode": stop.get("stopCode"),
                            })
            snapshot = {"points": points, "stops": stops}
            if points or stops:
                self._pattern_cache[route_key] = snapshot
            return snapshot if points or stops else self._pattern_cache.get(route_key, {"points": [], "stops": []})
        except Exception:
            return self._pattern_cache.get(route_key, {"points": [], "stops": []})

    def get_vehicles(self, route_id: str = "") -> Dict[str, Any]:
        normalized_route_id = (route_id or "").strip().lower()
        try:
            route_keys: List[str] = []
            route_lookup = {route["Key"]: route for route in self.get_routes() if route.get("Key")}
            if route_id:
                route_keys = [route_id]
            else:
                route_keys = list(route_lookup.keys())

            if not route_keys:
                cache_key = normalized_route_id or "__all__"
                cached = self._vehicle_cache.get(cache_key, [])
                return {"vehicles": cached, "live": False, "used_cache": bool(cached)}

            payload = "&".join([f"routeKeys%5B%5D={quote(route_key)}" for route_key in route_keys])
            data = self._post("/RouteMap/GetVehicles/", payload)
            vehicles: List[Dict[str, Any]] = []
            for route in data or []:
                route_meta = route_lookup.get(route.get("routeKey"))
                identifiers = [
                    str(route.get("routeKey") or "").strip().lower(),
                    str(route.get("shortName") or route_meta.get("ShortName") if route_meta else "").strip().lower(),
                    str(route.get("name") or route_meta.get("Name") if route_meta else "").strip().lower(),
                ]
                if normalized_route_id and normalized_route_id not in identifiers:
                    continue
                for direction in route.get("vehiclesByDirections", []) or []:
                    for vehicle in direction.get("vehicles", []) or []:
                        location = vehicle.get("location") or {}
                        vehicles.append({
                            "Key": vehicle.get("key"),
                            "Name": vehicle.get("name"),
                            "Latitude": location.get("latitude"),
                            "Longitude": location.get("longitude"),
                            "Heading": location.get("heading"),
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
                self._vehicle_cache["__all__"] = vehicles if not normalized_route_id else self._vehicle_cache.get("__all__", vehicles)
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
def ask_perplexity(request: QueryRequest):
    result = tracker.ask_perplexity(request.query)
    return {"response": result}


@router.get("/retrieve")
def retrieve_locations():
    return tracker.get_all_locations_with_events()


@router.get("/transit/routes")
def get_transit_routes():
    return {
        "routes": transit_proxy.get_routes(),
        "activeRouteIds": transit_proxy.get_active_routes(),
    }


@router.get("/transit/route/{route_key}")
def get_transit_route(route_key: str):
    return transit_proxy.get_pattern(route_key)


@router.get("/transit/vehicles")
def get_transit_vehicles(route_id: str = Query("")):
    return transit_proxy.get_vehicles(route_id)
@router.post("/create-event")
def create_event(event: EventRequest):
    event_dict = event.dict()
    base_url = "https://calendar.google.com/calendar/r/eventedit?"
    params = (
        f"text={quote(event_dict.get('text', ''))}"
        f"&dates={event_dict.get('start','')}/{event_dict.get('end','')}"
        f"&details={quote(event_dict.get('details',''))}"
        f"&location={quote(event_dict.get('location',''))}"
    )
    return {"message": "Google Calendar link created!", "link": base_url + params}
