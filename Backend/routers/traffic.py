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

try:
    from perplexity import Perplexity
except ImportError:
    Perplexity = None

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
        return self._get_json(self.rec_api) or []

    def fetch_library_data(self) -> List[Dict]:
        data = self._get_json(self.library_api)
        if not data:
            return []
        if isinstance(data, dict):
            return [v for k, v in data.items() if k != "lastupdate" and isinstance(v, dict)]
        return data if isinstance(data, list) else []

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

    def get_all_locations_with_events(self) -> List[Dict[str, float]]:
        result = []
        official_lookup = {
            "Student Rec Center": {"coord": {"lat": 30.607120, "lng": -96.345403}, "type": "Rec", "hours": "6:00 AM – 11:59 PM"},
            "Southside Rec Center": {"coord": {"lat": 30.615185, "lng": -96.334412}, "type": "Rec", "hours": "5:30 AM – 11:59 PM"},
            "Polo Road Rec Center": {"coord": {"lat": 30.622968, "lng": -96.340926}, "type": "Rec", "hours": "6:00 AM – 9:00 PM weekdays"},
            "Sterling C. Evans Library": {"coord": {"lat": 30.616607, "lng": -96.339047}, "type": "Library"},
            "Evans Library Annex": {"coord": {"lat": 30.616300, "lng": -96.338340}, "type": "Library"},
            "West Campus Library": {"coord": {"lat": 30.611570, "lng": -96.350164}, "type": "Library"},
            "Cushing Memorial Library": {"coord": {"lat": 30.616360, "lng": -96.339900}, "type": "Library"},
        }

        # Rec Facilities
        for f in self.fetch_rec_data():
            name = f.get("LocationName") or "Unknown"
            current = f.get("LastCount", 0)
            total = f.get("TotalCapacity", 1)
            percent = round((current / total) * 100, 1)
            lookup = official_lookup.get(name)
            if lookup:
                result.append({
                    "location": name,
                    "percent_full": percent,
                    "type": lookup["type"],
                    "is_live": True,
                    "available_seats": max(total - current, 0),
                    "coord": lookup["coord"],
                    "hours": lookup.get("hours"),
                })
        # Libraries
        for lib in self.fetch_library_data():
            name = lib.get("name") or "Unknown"
            max_cap = int(lib.get("max", 1)) or 1
            remaining = int(lib.get("remaining", 0))
            current = max_cap - remaining
            percent = round((current / max_cap) * 100, 1)
            lookup = official_lookup.get(name)
            if lookup:
                result.append({
                    "location": name,
                    "percent_full": percent,
                    "type": lookup["type"],
                    "is_live": True,
                    "available_seats": remaining,
                    "coord": lookup["coord"],
                    "hours": lookup.get("hours"),
                })
        # Events
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
            
        system_prompt = """You are a TAMU campus assistant that returns structured data only.
        - Output MUST be valid JSON text (a JSON array) and nothing else.
        """
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
        else:
            return json.dumps([{"name": "Parsing failed", "percent_full": 0, "available_seats": 0}])

tracker = TAMUFacilityTracker()
# Wait until called to load to prevent blocking bootup
# tracker.load_all_data()


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

@router.get("/get-event-requests", response_model=List[EventRequest])
def get_event_requests():
    raw_events = tracker.fetch_event_data(limit=10)
    formatted_events = []
    tz = pytz.timezone("America/Chicago")
    for event in raw_events:
        try:
            start_dt = datetime.strptime(event["start_time"], "%Y-%m-%d %I:%M %p")
            end_dt = datetime.strptime(event["end_time"], "%Y-%m-%d %I:%M %p")
            start_str = start_dt.astimezone(tz).strftime("%Y%m%dT%H%M%S%z")
            end_str = end_dt.astimezone(tz).strftime("%Y%m%dT%H%M%S%z")
            formatted_events.append(EventRequest(
                text=event["title"],
                start=start_str,
                end=end_str,
                details=event["summary"],
                location=event["location"]
            ))
        except Exception:
            pass
    return formatted_events
