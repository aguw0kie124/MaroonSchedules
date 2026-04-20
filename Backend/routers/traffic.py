from fastapi import APIRouter, Query, Request, Body
from zoneinfo import ZoneInfo
from pydantic import BaseModel
import requests
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from typing import List, Dict, Any, Optional
import random
from urllib.parse import quote
import pytz
import json
import re
from threading import Lock
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed

from services import cache_service, place_registry_service

try:
    from perplexity import Perplexity
except ImportError:
    Perplexity = None

from rate_limit import limiter
from repositories.transit_repository import transit_repo

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
    "aquatics": (
        "50 meter",
    ),
    "penberthy": (
        "tennis courts",
        "pickleball courts",
    ),
    "peap": (
        "peap strength conditioning",
    ),
}

REC_FALLBACK_PLACE_BY_ID: Dict[str, Dict[str, Any]] = {
    "rec": {
        "place_id": "rec",
        "name": "Student Recreation Center",
        "short_name": "REC",
        "type": "Rec",
        "lat": 30.6071267,
        "lng": -96.3426842,
    },
    "southside-rec": {
        "place_id": "southside-rec",
        "name": "Southside Recreation Center",
        "short_name": "SSRC",
        "type": "Rec",
        "lat": 30.615858627009548,
        "lng": -96.33350512942744,
    },
    "polo-rec": {
        "place_id": "polo-rec",
        "name": "Polo Road Recreation Center",
        "short_name": "POLO REC",
        "type": "Rec",
        "lat": 30.62322838512405,
        "lng": -96.33752363659374,
    },
    "aquatics": {
        "place_id": "aquatics",
        "name": "Aquatics",
        "short_name": "AQUATICS",
        "type": "Rec",
        "lat": 30.60755,
        "lng": -96.34215,
        "address": "187 Corrington Dr, College Station, TX 77843",
    },
    "peap": {
        "place_id": "peap",
        "name": "PEAP",
        "short_name": "PEAP",
        "type": "Rec",
        "lat": 30.60442587454078,
        "lng": -96.35188398861327,
        "address": "632 Penberthy Blvd, College Station, TX 77843",
    },
    "penberthy": {
        "place_id": "penberthy",
        "name": "Penberthy Rec Sports Complex-Tennis",
        "short_name": "PENBERTHY",
        "type": "Rec",
        "lat": 30.6012303882534,
        "lng": -96.34964369057107,
        "address": "Penberthy Blvd, College Station, TX 77840",
    },
}

REC_PLACE_ID_BY_LOCATION_NAME: Dict[str, str] = {
    "student rec center": "rec",
    "student recreation center": "rec",
    "student rec center strength conditioning": "rec",
    "southside rec center": "southside-rec",
    "southside recreation center": "southside-rec",
    "southside strength conditioning": "southside-rec",
    "southside strength conditioning area": "southside-rec",
    "polo road rec center": "polo-rec",
    "polo road recreation center": "polo-rec",
    "polo road strength conditioning": "polo-rec",
    "aquatics": "aquatics",
    "peap": "peap",
    "physical education activity room": "peap",
    "physical education activity program": "peap",
    "physical education activity program building": "peap",
    "penberthy": "penberthy",
    "penberthy rec sports complex": "penberthy",
    "penberthy rec sports complex tennis": "penberthy",
}

LIBRARY_PLACE_ID_BY_API_KEY: Dict[str, str] = {
    "evans": "libr",
    "libr": "libr",
    "annex": "annex",
    "blcc": "wcl",
    "wcl": "wcl",
    "cushing": "cush",
    "cush": "cush",
    "msl": "msl",
    "psel": "psel",
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
        cache_key = "traffic:capacity:raw_rec:v3"
        cached = cache_service.get_json(cache_key)
        if cached is not None:
            return cached
        data = self._get_json(self.rec_api) or []
        if data:
            cache_service.set_json(cache_key, data, 60)
        return data

    def get_rec_place_catalog(self) -> Dict[str, Dict[str, Any]]:
        catalog: Dict[str, Dict[str, Any]] = {}
        for place_id, fallback in REC_FALLBACK_PLACE_BY_ID.items():
            place = place_registry_service.get_place_by_id(place_id)
            if place:
                catalog[place_id] = place
            else:
                catalog[place_id] = dict(fallback)
        return catalog

    def _get_rec_place_by_id(self, place_id: str) -> Dict[str, Any] | None:
        if not place_id:
            return None
        return self.get_rec_place_catalog().get(place_id)

    def _resolve_rec_place(self, row: Dict[str, Any]) -> Dict[str, Any] | None:
        for candidate in (row.get("FacilityName"), row.get("LocationName")):
            normalized_candidate = _normalize_location_name(candidate)
            explicit_place_id = REC_PLACE_ID_BY_LOCATION_NAME.get(normalized_candidate)
            if explicit_place_id:
                explicit_place = self._get_rec_place_by_id(explicit_place_id)
                if explicit_place:
                    return explicit_place
            resolved = place_registry_service.resolve_place(candidate)
            if resolved and resolved.get("type") == "Rec":
                return resolved
        return None

    def _pick_rec_display_row(self, place_id: str, rows: List[Dict[str, Any]]) -> Dict[str, Any] | None:
        if not rows:
            return None

        preferred_names = REC_OCCUPANCY_LOCATION_PREFERENCES.get(place_id, ())

        def rank(row: Dict[str, Any]) -> tuple[int, int, int, int, int, datetime]:
            location_name = _normalize_location_name(row.get("LocationName"))
            preferred_rank = 0
            for index, preferred_name in enumerate(preferred_names):
                if location_name == preferred_name:
                    preferred_rank = len(preferred_names) - index
                    break
            current_count = _safe_int(row.get("LastCount"))
            return (
                preferred_rank,
                1 if ("strength" in location_name and "conditioning" in location_name) else 0,
                0 if row.get("IsClosed") else 1,
                current_count,
                _safe_int(row.get("TotalCapacity")),
                _parse_goboard_timestamp(row.get("LastUpdatedDateAndTime")),
            )

        return max(rows, key=rank)

    def get_rec_center_live_counts(self, rec_rows: List[Dict] | None = None, include_sub_areas: bool = False) -> Dict[str, Dict[str, Any]]:
        rows = rec_rows if rec_rows is not None else self.fetch_rec_data()
        grouped: Dict[str, Dict[str, Any]] = {}

        for row in rows:
            place = self._resolve_rec_place(row)
            if not place:
                continue
            grouped.setdefault(place["place_id"], {"place": place, "rows": []})["rows"].append(row)

        def _parse_is_closed(row: Dict[str, Any]) -> bool:
            val = row.get("IsClosed")
            if val is None:
                # Heuristic: If capacity is 0 or -1, it's effectively closed or offline
                cap = _safe_int(row.get("TotalCapacity"))
                if cap <= 0:
                    return True
                return False
            if isinstance(val, str):
                return val.lower() in ("true", "1", "yes")
            return bool(val)

        summaries: Dict[str, Dict[str, Any]] = {}
        for place_id, payload in grouped.items():
            display_row = self._pick_rec_display_row(place_id, payload["rows"])
            if not display_row:
                continue

            current_count = _safe_int(display_row.get("LastCount"))
            capacity = _safe_int(display_row.get("TotalCapacity"))
            percent_full = round((current_count / capacity) * 100, 1) if capacity > 0 else None
            facility_counts = []
            if include_sub_areas:
                for row in sorted(
                    payload["rows"],
                    key=lambda candidate: (
                        0 if _parse_is_closed(candidate) else 1,
                        _safe_int(candidate.get("LastCount")),
                        _safe_int(candidate.get("TotalCapacity")),
                        _parse_goboard_timestamp(candidate.get("LastUpdatedDateAndTime")),
                    ),
                    reverse=True,
                ):
                    row_current_count = _safe_int(row.get("LastCount"))
                    row_capacity = _safe_int(row.get("TotalCapacity"))
                    row_percent_full = (
                        round((row_current_count / row_capacity) * 100, 1)
                        if row_capacity > 0
                        else None
                    )
                    facility_counts.append(
                        {
                            "location_name": row.get("LocationName") or payload["place"]["name"],
                            "facility_name": row.get("FacilityName") or payload["place"]["name"],
                            "current_count": row_current_count,
                            "capacity": row_capacity,
                            "percent_full": row_percent_full,
                            "available_seats": max(0, row_capacity - row_current_count) if row_capacity > 0 else None,
                            "last_updated": row.get("LastUpdatedDateAndTime"),
                            "is_closed": _parse_is_closed(row),
                        }
                    )

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
                "is_closed": _parse_is_closed(display_row),
                "facility_counts": facility_counts,
            }

        return summaries

    def fetch_library_data(self) -> Dict[str, Any]:
        """Returns the full library API dict (keyed by abbreviation)."""
        cache_key = "traffic:capacity:raw_libraries:v3"
        cached = cache_service.get_json(cache_key)
        if cached is not None:
            return cached
        data = self._get_json(self.library_api)
        if not data or not isinstance(data, dict):
            return {}
        cache_service.set_json(cache_key, data, 60)
        return data

    def fetch_event_data(self, limit: int = 20) -> List[Dict]:
        cache_key = f"traffic:events:limit_{limit}"
        cached = cache_service.get_json(cache_key)
        if cached is not None:
            return cached
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
        result = sorted(parsed, key=lambda e: e["start_time"])[:limit]
        cache_service.set_json(cache_key, result, 300) # 5 min cache
        return result

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
        meta: Dict[str, Any] = {"reviews": selected, "traffic_history": history}
        if loc_type not in ("Library", "Dining"):
            meta["hours"] = hours
        return meta

    def get_all_locations_with_events(self) -> List[Dict[str, Any]]:
        result = []
        live_percents = []
        resolved_ids = set()

        # ── 1. Rec Centers ───────────────────────────────────────────────────
        rec_live_counts = self.get_rec_center_live_counts(include_sub_areas=False)
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

            place = None
            explicit_place_id = LIBRARY_PLACE_ID_BY_API_KEY.get(str(api_key).strip().lower())
            if explicit_place_id:
                place = place_registry_service.get_place_by_id(explicit_place_id)
            if not place:
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
                "last_updated": lib_raw.get("lastupdate"),
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
            f"{self.base_url}{path}", headers=headers, data=body, timeout=30)
        if response.status_code in (401, 403) and retry:
            headers = self._build_auth_headers(force_refresh=True)
            headers = dict(headers)
            headers["Content-Type"] = content_type
            response = self.session.post(
                f"{self.base_url}{path}", headers=headers, data=body, timeout=30)
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
                direction_names = []
                for direction in route.get("directionList", []):
                    dkey = direction.get("direction", {}).get("key")
                    dname = direction.get("destination") or direction.get(
                        "direction", {}).get("name")
                    if dkey and dname:
                        self._direction_cache[dkey] = dname
                    if dname:
                        direction_names.append(dname)

                routes.append({
                    "Key": route.get("key") or route.get("Key"),
                    "Name": route.get("name") or route.get("Name"),
                    "ShortName": route.get("shortName") or route.get("ShortName"),
                    "DirectionNames": direction_names,
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
                                "StopCode": str(stop.get("stopCode") or ""),
                                "DirectionKey": dkey,
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

    def get_bulk_patterns(self, route_keys: List[str]) -> Dict[str, Any]:
        results = {}
        # Batch these similarly to vehicles to avoid upstream timeouts
        batches = [route_keys[i:i+8] for i in range(0, len(route_keys), 8)]
        for batch in batches:
            try:
                payload = "&".join([f"routeKeys%5B%5D={quote(str(rk))}" for rk in batch])
                data = self._post("/RouteMap/GetPatternPaths/", payload)
                if not data:
                    continue
                
                for route_data in data:
                    rk = route_data.get("routeKey")
                    if not rk:
                        continue
                    
                    points = []
                    stops = []
                    paths = []
                    seen_stops = set()
                    
                    for item in route_data.get("patternPaths", []):
                        dkey = item.get("directionKey")
                        direction_name = self._direction_cache.get(dkey) or ""
                        
                        path_points = []
                        raw_points = item.get("patternPoints", [])
                        
                        # Downsample if too many points for high-perf overview
                        step = 1
                        if len(raw_points) > 300:
                            step = 2 # Skip every other point
                        
                        for i in range(0, len(raw_points), step):
                            point = raw_points[i]
                            pt = {"latitude": point.get("latitude"), "longitude": point.get("longitude")}
                            points.append(pt)
                            path_points.append(pt)
                            
                            stop = point.get("stop")
                            if stop and stop.get("stopCode") not in seen_stops:
                                stop_name = stop.get("name") or ""
                                seen_stops.add(stop.get("stopCode"))
                                stops.append({
                                    "Name": stop_name,
                                    "Latitude": point.get("latitude"),
                                    "Longitude": point.get("longitude"),
                                    "StopCode": str(stop.get("stopCode") or ""),
                                })
                        
                        paths.append({
                            "directionKey": dkey,
                            "directionName": direction_name,
                            "points": path_points
                        })
                    
                    results[rk] = {"points": points, "stops": stops, "paths": paths}
            except Exception as e:
                print(f"[TransitProxy] Bulk pattern error: {e}")
                continue
        return results

    def get_vehicles(self, route_id: str = "") -> Dict[str, Any]:
        normalized_route_id = (route_id or "").strip().lower()
        fetched_at = datetime.now(ZoneInfo("UTC")).isoformat()
        
        # Determine which routes to fetch
        if normalized_route_id and normalized_route_id != "__all__":
            # Single route fetch - direct and efficient
            route_batches = [[route_id]]
            is_bulk = False
        else:
            # Bulk fetch - map active human-readable IDs back to UUIDs
            active_labels = self.get_active_routes()
            full_routes = self.get_routes()
            
            # Map active labels (like '01') back to their UUID keys
            route_keys = []
            active_set = set(active_labels)
            for r in full_routes:
                rk = r.get("Key")
                sn = r.get("ShortName")
                if rk in active_set or sn in active_set:
                    if rk:
                        route_keys.append(rk)
            
            # Fallback if no active routes found
            if not route_keys:
                 route_keys = [r["Key"] for r in full_routes if r.get("Key")][:30]
            
            # Chunk keys into batches of 8 to avoid server-side timeouts or truncation
            route_batches = [route_keys[i:i + 8] for i in range(0, len(route_keys), 8)]
            is_bulk = True

        vehicles: List[Dict[str, Any]] = []
        try:
            # Use a case-insensitive lookup for route metadata to handle UUID case variations
            routes_list = self.get_routes()
            route_lookup = {}
            for r in routes_list:
                k = str(r.get("Key") or "").strip().lower()
                if k:
                    route_lookup[k] = r

            for batch in route_batches:
                if not batch:
                    continue

                payload = "&".join(
                    [f"routeKeys%5B%5D={quote(str(rk))}" for rk in batch])
                
                try:
                    data = self._post("/RouteMap/GetVehicles/", payload)
                    if not data:
                        continue

                    for route_data in data:
                        r_key = str(route_data.get("routeKey") or "").strip().lower()
                        route_meta = route_lookup.get(r_key)
                        
                        # Verify identity matches if not in bulk mode
                        if not is_bulk:
                            identifiers = [
                                r_key,
                                str(route_data.get("shortName") or (route_meta.get("ShortName") if route_meta else "")).strip().lower(),
                                str(route_data.get("name") or (route_meta.get("Name") if route_meta else "")).strip().lower(),
                            ]
                            if normalized_route_id not in identifiers:
                                continue

                        for direction in route_data.get("vehiclesByDirections", []) or []:
                            dir_key = direction.get("directionKey")
                            for vehicle in direction.get("vehicles", []) or []:
                                location = vehicle.get("location") or {}
                                v_dir_key = vehicle.get("directionKey") or dir_key
                                v_dir_name = self._direction_cache.get(v_dir_key)
                                if not v_dir_name:
                                    v_dir_name = vehicle.get("directionName") or direction.get("directionName") or "Unknown"

                                # Clean and coerce numeric fields to prevent frontend crashes
                                try:
                                    lat = location.get("latitude")
                                    lng = location.get("longitude")
                                    if lat is None or lng is None:
                                        continue
                                    v_lat = float(lat)
                                    v_lng = float(lng)
                                    v_heading = float(location.get("heading") or location.get("direction") or 0)
                                    v_speed = float(location.get("speed") or vehicle.get("speed") or 0)
                                except (TypeError, ValueError):
                                    continue

                                vehicles.append({
                                    "Key": vehicle.get("key"),
                                    "Name": vehicle.get("name"),
                                    "Latitude": v_lat,
                                    "Longitude": v_lng,
                                    "Heading": v_heading,
                                    "Speed": v_speed,
                                    "DirectionName": v_dir_name,
                                    "DirectionKey": v_dir_key,
                                    "PassengersOnboard": vehicle.get("passengersOnboard"),
                                    "Capacity": vehicle.get("passengerCapacity"),
                                    "RouteKey": r_key,
                                    "RouteShortName": route_data.get("shortName") or (route_meta.get("ShortName") if route_meta else None),
                                    "RouteName": route_data.get("name") or (route_meta.get("Name") if route_meta else None),
                                    "RouteColor": (route_meta.get("Color") if route_meta else None) or self._route_color(r_key or ""),
                                })
                except Exception as e:
                    print(f"[TransitProxy] Batch fetch error: {e}")
                    continue

            cache_key = f"v2:{normalized_route_id or '__all__'}"
            if vehicles:
                self._vehicle_cache[cache_key] = vehicles
                if is_bulk:
                    self._vehicle_cache["v2:__all__"] = vehicles
            
            cached = self._vehicle_cache.get(cache_key, [])
            using_cache = not bool(vehicles) and bool(cached)
            source = "live" if vehicles else ("stale_cache" if cached else "unavailable")
            return {
                "vehicles": vehicles if vehicles else cached,
                "live": bool(vehicles),
                "used_cache": using_cache,
                "fetched_at": fetched_at,
                "source": source,
            }
        except Exception:
            cache_key = normalized_route_id or "__all__"
            cached = self._vehicle_cache.get(cache_key, [])
            return {
                "vehicles": cached,
                "live": False,
                "used_cache": bool(cached),
                "fetched_at": fetched_at,
                "source": "stale_cache" if cached else "unavailable",
            }

    def get_stop_schedule(
        self,
        route_number: str,
        stop_code: str,
        direction_name: str,
        service_date: str,
    ) -> List[Dict[str, Any]]:
        cache_key = f"traffic:transit:stop_schedule:v2:{route_number}:{stop_code}:{direction_name}:{service_date}"
        cached = cache_service.get_json(cache_key)
        if cached is not None:
            return cached

        try:
            payload = json.dumps({
                "routeNumber": route_number,
                "stopCode": stop_code,
                "directionName": direction_name,
                "date": service_date,
            })
            response = self._post(
                "/Schedule/GetStopSchedules",
                body=payload,
                content_type="application/json",
            )
            schedules = response.get("routeStopSchedules") or []
            if not schedules:
                return []
            merged_times: List[Dict[str, Any]] = []
            for schedule in schedules:
                schedule_direction_name = str(schedule.get("directionName") or "").strip()
                for stop_time in schedule.get("stopTimes") or []:
                    merged_times.append({
                        **stop_time,
                        "sourceDirectionName": schedule_direction_name,
                    })
            if merged_times:
                cache_service.set_json(cache_key, merged_times, 3600)
            return merged_times
        except Exception as exc:
            print(f"[TransitProxy] Stop schedule error for route {route_number} stop {stop_code}: {exc}")
            return []

    def get_route_timetable(self, route_key: str, max_stops: int = 200) -> Dict[str, Any]:
        cache_key = f"traffic:transit:timetable:v3:{route_key}:{max_stops}"
        cached = cache_service.get_json(cache_key)
        if cached is not None:
            return cached

        try:
            route_lookup = {
                route["Key"]: route for route in self.get_routes() if route.get("Key")
            }
            route = route_lookup.get(route_key)
            if not route:
                return {
                    "route": None,
                    "entries": [],
                    "freshness": _build_transit_freshness(source="unavailable"),
                }

            pattern = self.get_pattern(route_key)
            raw_stops = pattern.get("stops") or []
            unique_stops: List[Dict[str, Any]] = []
            seen_pairs = set()
            for stop in raw_stops:
                stop_code = stop.get("StopCode")
                direction_key = stop.get("DirectionKey")
                if not stop_code or not direction_key:
                    continue
                pair = (stop_code, direction_key)
                if pair in seen_pairs:
                    continue
                seen_pairs.add(pair)
                unique_stops.append(stop)
                if len(unique_stops) >= max_stops:
                    break

            if not unique_stops:
                return {
                    "route": route,
                    "entries": [],
                    "freshness": _build_transit_freshness(source="unavailable"),
                }

            payload = {
                "routes": [
                    {
                        "routeKey": route_key,
                        "nearbyStops": [
                            {
                                "stopCode": stop["StopCode"],
                                "directionKey": stop["DirectionKey"],
                            }
                            for stop in unique_stops
                        ],
                    }
                ]
            }

            response = self._post(
                "/Home/GetNextStopTimes",
                body=json.dumps(payload),
                content_type="application/json",
            )
            route_payload = response[0] if isinstance(response, list) and response else {}
            nearby_stops = route_payload.get("nearbyStops") or []
            nearby_stop_by_pair = {
                (item.get("stopCode"), item.get("directionKey")): item
                for item in nearby_stops
            }
            now_utc = datetime.now(ZoneInfo("UTC"))
            service_date = _local_service_date(now_utc)
            entries: List[Optional[Dict[str, Any]]] = [None] * len(unique_stops)

            def fetch_departure_info(idx: int, pattern_stop: Dict[str, Any]) -> None:
                stop_code = pattern_stop.get("StopCode")
                direction_key = pattern_stop.get("DirectionKey")
                direction_name = pattern_stop.get("DirectionName") or ""
                stop_payload = nearby_stop_by_pair.get((stop_code, direction_key)) or {}

                departures: List[Dict[str, Any]] = []
                for departure in stop_payload.get("nextStopTimes") or []:
                    scheduled = departure.get("scheduledDepartTimeUtc")
                    estimated = departure.get("estimatedDepartTimeUtc")
                    departures.append(
                        {
                            "scheduled_depart_time_utc": scheduled,
                            "estimated_depart_time_utc": estimated,
                            "is_realtime": bool(departure.get("isRealtime")),
                            "is_off_route": bool(departure.get("isOffRoute")),
                        }
                    )
                
                if not departures and stop_code and direction_name:
                    exact_times = self.get_stop_schedule(
                        route.get("ShortName"),
                        str(stop_code),
                        str(direction_name),
                        service_date,
                    )
                    seen_departures = set()
                    for departure in exact_times:
                        scheduled = departure.get("scheduledDepartTimeUtc")
                        parsed = _parse_stop_schedule_time(scheduled)
                        if parsed is None or parsed < now_utc:
                            continue
                        if scheduled in seen_departures:
                            continue
                        seen_departures.add(scheduled)
                        departures.append(
                            {
                                "scheduled_depart_time_utc": scheduled,
                                "estimated_depart_time_utc": departure.get("estimatedDepartTimeUtc") or scheduled,
                                "is_realtime": False,
                                "is_off_route": bool(departure.get("isOffRoute")),
                            }
                        )
                        if len(departures) >= 5:
                            break
                            
                deduped_departures = []
                seen_departure_keys = set()
                for departure in departures:
                    departure_key = (
                        departure.get("estimated_depart_time_utc")
                        or departure.get("scheduled_depart_time_utc")
                    )
                    if not departure_key or departure_key in seen_departure_keys:
                        continue
                    seen_departure_keys.add(departure_key)
                    deduped_departures.append(departure)

                deduped_departures.sort(
                    key=lambda item: (
                        item.get("estimated_depart_time_utc")
                        or item.get("scheduled_depart_time_utc")
                        or ""
                    )
                )

                entries[idx] = {
                    "stop": pattern_stop,
                    "sequence": idx + 1,
                    "departures": deduped_departures[:5],
                    "has_live_departures": any(
                        bool(item.get("is_realtime")) for item in deduped_departures
                    ),
                    "used_schedule_fallback": bool(deduped_departures)
                    and not any(bool(item.get("is_realtime")) for item in deduped_departures),
                }

            with ThreadPoolExecutor(max_workers=min(len(unique_stops), 12) or 1) as executor:
                futures = [
                    executor.submit(fetch_departure_info, idx, stop)
                    for idx, stop in enumerate(unique_stops)
                ]
                for future in as_completed(futures):
                    future.result()

            resolved_entries = [entry for entry in entries if entry is not None]
            live_count = sum(
                1 for entry in resolved_entries if entry.get("has_live_departures")
            )
            fallback_count = sum(
                1 for entry in resolved_entries if entry.get("used_schedule_fallback")
            )
            if live_count > 0:
                source = "live"
            elif fallback_count > 0:
                source = "schedule_fallback"
            else:
                source = "unavailable"

            return {
                "route": route,
                "entries": resolved_entries,
                "freshness": _build_transit_freshness(
                    source=source,
                    live=live_count > 0,
                    used_schedule_fallback=fallback_count > 0,
                    realtime_stop_count=live_count,
                    scheduled_stop_count=fallback_count,
                ),
            }
        except Exception as exc:
            print(f"[TransitProxy] Timetable error for route {route_key}: {exc}")
            return {
                "route": None,
                "entries": [],
                "freshness": _build_transit_freshness(source="unavailable"),
            }


transit_proxy = AggieSpiritProxy()
_TRANSIT_LOCKS = defaultdict(Lock)


def _local_service_date(dt: datetime) -> str:
    return dt.astimezone(ZoneInfo("America/Chicago")).date().isoformat()


def _parse_stop_schedule_time(value: Any) -> datetime | None:
    raw = str(value or "").strip()
    if not raw:
        return None
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        return None


def _build_transit_freshness(
    *,
    source: str,
    live: bool = False,
    used_schedule_fallback: bool = False,
    realtime_stop_count: int = 0,
    scheduled_stop_count: int = 0,
) -> Dict[str, Any]:
    fetched_at = datetime.now(ZoneInfo("UTC")).isoformat()
    return {
        "source": source,
        "live": live,
        "used_schedule_fallback": used_schedule_fallback,
        "realtime_stop_count": realtime_stop_count,
        "scheduled_stop_count": scheduled_stop_count,
        "fetched_at": fetched_at,
        "age_seconds": 0,
    }


def _find_live_trip(
    origin_stop_code: str,
    dest_stop_code: str,
    target_time: datetime,
    route_number: str,
    timing_mode: str = "leave_at",
    minimum_travel_minutes: int = 0,
) -> Optional[Dict[str, Any]]:
    route = next(
        (
            item
            for item in transit_proxy.get_routes()
            if item.get("ShortName") == route_number or item.get("Key") == route_number
        ),
        None,
    )
    if not route or not route.get("Key"):
        return None

    pattern = transit_proxy.get_pattern(route["Key"])
    stops = pattern.get("stops") or []
    origin_dirs = {
        str(stop.get("DirectionName") or "").strip()
        for stop in stops
        if str(stop.get("StopCode") or "").strip() == origin_stop_code and str(stop.get("DirectionName") or "").strip()
    }
    dest_dirs = {
        str(stop.get("DirectionName") or "").strip()
        for stop in stops
        if str(stop.get("StopCode") or "").strip() == dest_stop_code and str(stop.get("DirectionName") or "").strip()
    }

    direction_candidates = [name for name in origin_dirs if name in dest_dirs]
    if not direction_candidates:
        route_direction_names = [
            str(name or "").strip()
            for name in (route.get("DirectionNames") or [])
            if str(name or "").strip()
        ]
        direction_candidates = route_direction_names or list(origin_dirs or dest_dirs)

    if not direction_candidates:
        return None

    service_date = _local_service_date(target_time)
    minimum_travel_minutes = max(0, int(minimum_travel_minutes or 0))
    best_plan: Optional[Dict[str, Any]] = None

    for direction_name in direction_candidates:
        origin_schedule = transit_proxy.get_stop_schedule(
            route_number,
            origin_stop_code,
            direction_name,
            service_date,
        )
        dest_schedule = transit_proxy.get_stop_schedule(
            route_number,
            dest_stop_code,
            direction_name,
            service_date,
        )

        origin_by_schedule_direction: Dict[str, List[datetime]] = defaultdict(list)
        dest_by_schedule_direction: Dict[str, List[datetime]] = defaultdict(list)

        for item in origin_schedule:
            parsed = _parse_stop_schedule_time(item.get("scheduledDepartTimeUtc"))
            if parsed is None:
                continue
            origin_by_schedule_direction[str(item.get("sourceDirectionName") or direction_name or "").strip()].append(parsed)

        for item in dest_schedule:
            parsed = _parse_stop_schedule_time(item.get("scheduledDepartTimeUtc"))
            if parsed is None:
                continue
            dest_by_schedule_direction[str(item.get("sourceDirectionName") or direction_name or "").strip()].append(parsed)

        matching_schedule_directions = [
            schedule_direction
            for schedule_direction in origin_by_schedule_direction.keys()
            if schedule_direction in dest_by_schedule_direction
        ]
        if not matching_schedule_directions:
            continue

        candidate: Optional[Dict[str, Any]] = None
        for schedule_direction_name in matching_schedule_directions:
            origin_times = sorted(origin_by_schedule_direction[schedule_direction_name])
            dest_times = sorted(dest_by_schedule_direction[schedule_direction_name])
            if not origin_times or not dest_times:
                continue

            local_candidate: Optional[Dict[str, Any]] = None
            if timing_mode == "arrive_by":
                for dest_time in reversed(dest_times):
                    if dest_time > target_time:
                        continue
                    latest_origin_cutoff = dest_time - timedelta(minutes=minimum_travel_minutes)
                    matching_origins = [origin_time for origin_time in origin_times if origin_time < latest_origin_cutoff]
                    if matching_origins:
                        local_candidate = {
                            "origin_time": matching_origins[-1],
                            "dest_time": dest_time,
                            "direction": schedule_direction_name or direction_name,
                        }
                        break
            else:
                for origin_time in origin_times:
                    if origin_time < target_time:
                        continue
                    earliest_dest_cutoff = origin_time + timedelta(minutes=minimum_travel_minutes)
                    matching_dest = next(
                        (dest_time for dest_time in dest_times if dest_time > earliest_dest_cutoff),
                        None,
                    )
                    if matching_dest is not None:
                        local_candidate = {
                            "origin_time": origin_time,
                            "dest_time": matching_dest,
                            "direction": schedule_direction_name or direction_name,
                        }
                        break

            if local_candidate is None:
                continue

            if candidate is None:
                candidate = local_candidate
                continue

            if timing_mode == "arrive_by":
                if local_candidate["dest_time"] > candidate["dest_time"]:
                    candidate = local_candidate
            else:
                if local_candidate["origin_time"] < candidate["origin_time"]:
                    candidate = local_candidate

        if candidate is None:
            continue

        if best_plan is None:
            best_plan = candidate
            continue

        if timing_mode == "arrive_by":
            if candidate["dest_time"] > best_plan["dest_time"]:
                best_plan = candidate
        else:
            if candidate["origin_time"] < best_plan["origin_time"]:
                best_plan = candidate

    return best_plan


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
    cache_key = "traffic:retrieve:main:v2"
    cached = cache_service.get_json(cache_key)
    if cached is not None:
        return cached
    
    payload = tracker.get_all_locations_with_events()
    cache_service.set_json(cache_key, payload, 30) # 30s cache for heartbeat
    return payload


@router.get("/capacity/facility-counts/{place_id}")
@limiter.limit("120/minute")
def get_detailed_facility_counts(request: Request, place_id: str, sid: Optional[str] = Query(None), refresh: bool = Query(False)):
    """Returns detailed sub-area counts for a specific recreation facility."""
    cache_key = f"traffic:capacity:facility-counts:{sid or 'global'}:{place_id}"
    
    if not refresh:
        cached = cache_service.get_json(cache_key)
        if cached is not None:
            return cached

    # Note: We fetch ALL rec data once and filter, since we likely have it cached.
    rec_live_counts = tracker.get_rec_center_live_counts(include_sub_areas=True)
    if place_id in rec_live_counts:
        payload = {"facility_counts": rec_live_counts[place_id].get("facility_counts", [])}
        cache_service.set_json(cache_key, payload, 120) # 2 min cache
        return payload
    
    return {"facility_counts": []}


@router.get("/transit/routes")
@limiter.limit("60/minute")
def get_transit_routes(request: Request):
    cache_key = "traffic:transit:routes:v3"
    cached = cache_service.get_json(cache_key)
    if cached is not None:
        return cached

    with _TRANSIT_LOCKS[cache_key]:
        cached = cache_service.get_json(cache_key)
        if cached is not None:
            return cached

        payload = {
            "routes": transit_proxy.get_routes(),
            "activeRouteIds": transit_proxy.get_active_routes(),
        }
        cache_service.set_json(cache_key, payload, 300)
        return payload


@router.get("/transit/route/{route_key}")
@limiter.limit("120/minute")
def get_transit_route(request: Request, route_key: str):
    cache_key = f"traffic:transit:route:v2:{route_key}"
    cached = cache_service.get_json(cache_key)
    if cached is not None:
        return cached

    with _TRANSIT_LOCKS[cache_key]:
        cached = cache_service.get_json(cache_key)
        if cached is not None:
            return cached

        payload = transit_proxy.get_pattern(route_key)
        cache_service.set_json(cache_key, payload, 3600)
        return payload


@router.get("/transit/patterns")
@limiter.limit("20/minute")
def get_bulk_transit_patterns(request: Request, ids: str = Query("")):
    if not ids:
        return {}
    
    id_list = [i.strip() for i in ids.split(",") if i.strip()]
    import hashlib
    h = hashlib.md5(",".join(sorted(id_list)).encode()).hexdigest()
    cache_key = f"traffic:transit:patterns:v2:{h}"
    
    cached = cache_service.get_json(cache_key)
    if cached is not None:
        return cached
    
    payload = transit_proxy.get_bulk_patterns(id_list)
    cache_service.set_json(cache_key, payload, 3600)
    return payload



@router.get("/transit/vehicles")
@limiter.limit("120/minute")
def get_transit_vehicles(request: Request, route_id: str = Query("")):
    cache_key = f"traffic:transit:vehicles:v2:{route_id or '__all__'}"
    cached = cache_service.get_json(cache_key)
    if cached is not None:
        return cached

    with _TRANSIT_LOCKS[cache_key]:
        cached = cache_service.get_json(cache_key)
        if cached is not None:
            return cached

        payload = transit_proxy.get_vehicles(route_id)
        
        # Don't aggressively cache empty payloads (which causes buses to flicker off)
        if not payload.get("vehicles") and not payload.get("live"):
            cache_service.set_json(cache_key, payload, 2)
        else:
            ttl_seconds = 2 if route_id else 8
            cache_service.set_json(cache_key, payload, ttl_seconds)
            
        return payload


@router.get("/transit/timetable/{route_key}")
@limiter.limit("120/minute")
def get_transit_timetable(request: Request, route_key: str, max_stops: int = Query(200, ge=1, le=250)):
    cache_key = f"traffic:transit:timetable:v3:{route_key}:{max_stops}"
    cached = cache_service.get_json(cache_key)
    if cached is not None:
        return cached

    with _TRANSIT_LOCKS[cache_key]:
        cached = cache_service.get_json(cache_key)
        if cached is not None:
            return cached

        payload = transit_proxy.get_route_timetable(route_key, max_stops=max_stops)

        freshness = payload.get("freshness") or {}
        source = freshness.get("source")
        if not payload.get("entries") or source == "unavailable":
            ttl_seconds = 8
        elif source == "schedule_fallback":
            ttl_seconds = 45
        else:
            ttl_seconds = 20
        cache_service.set_json(cache_key, payload, ttl_seconds)
            
        return payload


@router.get("/transit/timetable/db/{stop_code}")
@limiter.limit("120/minute")
def get_transit_timetable_db(request: Request, stop_code: str, route_number: str = Query(""), start_time: Optional[str] = Query(None)):
    """Get accurate scheduled stop times from the PostgreSQL cache."""
    if not start_time:
        search_time = datetime.now(ZoneInfo("UTC"))
    else:
        try:
            search_time = datetime.fromisoformat(start_time.replace('Z', '+00:00'))
        except ValueError:
            search_time = datetime.now(ZoneInfo("UTC"))
            
    try:
        times = transit_repo.get_upcoming_stop_times(stop_code, route_number, search_time)
        return {"stop_code": stop_code, "route_number": route_number, "scheduled_times": times}
    except Exception as exc:
        print(f"[traffic] DB timetable lookup failed, falling back live for stop {stop_code}: {exc}")
        if not route_number:
            return {"stop_code": stop_code, "route_number": route_number, "scheduled_times": []}

        route = next(
            (item for item in transit_proxy.get_routes() if item.get("ShortName") == route_number),
            None,
        )
        if not route or not route.get("Key"):
            return {"stop_code": stop_code, "route_number": route_number, "scheduled_times": []}

        pattern = transit_proxy.get_pattern(route["Key"])
        direction_names = [
            str(stop.get("DirectionName") or "").strip()
            for stop in (pattern.get("stops") or [])
            if str(stop.get("StopCode") or "").strip() == stop_code and str(stop.get("DirectionName") or "").strip()
        ]
        seen = set()
        times = []
        for direction_name in direction_names:
            for item in transit_proxy.get_stop_schedule(
                route_number,
                stop_code,
                direction_name,
                _local_service_date(search_time),
            ):
                dt = _parse_stop_schedule_time(item.get("scheduledDepartTimeUtc"))
                if dt is None or dt < search_time:
                    continue
                key = (dt.isoformat(), direction_name)
                if key in seen:
                    continue
                seen.add(key)
                times.append({
                    "scheduled_time": dt.isoformat(),
                    "direction_name": direction_name,
                    "is_departure": True,
                })
        times.sort(key=lambda item: item["scheduled_time"])
        return {"stop_code": stop_code, "route_number": route_number, "scheduled_times": times[:5]}


class TripPlanRequest(BaseModel):
    origin_stop_code: str
    dest_stop_code: str
    route_number: str
    departure_time: str
    timing_mode: str = "leave_at"
    minimum_travel_minutes: int = 0


class BulkTripPlanItem(BaseModel):
    origin_stop_code: str
    dest_stop_code: str
    route_number: str
    departure_time: str
    timing_mode: str = "leave_at"
    minimum_travel_minutes: int = 0


class BulkTripPlanRequest(BaseModel):
    items: List[BulkTripPlanItem]

@router.post("/transit/trip-plan/db")
@limiter.limit("60/minute")
def get_transit_trip_plan_db(request: Request, plan_request: TripPlanRequest = Body(...)):
    """Find the best scheduled trip between two stops using the PostgreSQL cache."""
    print(f"[traffic] Trip plan request: {plan_request.dict()}")
    try:
        dep_time = datetime.fromisoformat(plan_request.departure_time.replace('Z', '+00:00'))
    except ValueError:
        return {"error": "Invalid departure_time format"}

    plan = _find_live_trip(
        plan_request.origin_stop_code,
        plan_request.dest_stop_code,
        dep_time,
        plan_request.route_number,
        plan_request.timing_mode,
        plan_request.minimum_travel_minutes,
    )

    if plan is None:
        try:
            plan = transit_repo.find_best_trip(
                plan_request.origin_stop_code,
                plan_request.dest_stop_code,
                dep_time,
                plan_request.route_number,
                plan_request.timing_mode,
                plan_request.minimum_travel_minutes,
            )
        except Exception as e:
            print(f"[traffic] Trip plan DB lookup failed after live lookup: {e}")
            plan = None

    if plan:
        plan_copy = dict(plan)
        origin_time = plan_copy.get('origin_time')
        dest_time = plan_copy.get('dest_time')
        if isinstance(origin_time, datetime):
            plan_copy['origin_time'] = origin_time.isoformat()
        if isinstance(dest_time, datetime):
            plan_copy['dest_time'] = dest_time.isoformat()
        return {"plan": plan_copy}

    return {"plan": None}


@router.post("/transit/trip-plan/bulk")
@limiter.limit("40/minute")
def get_transit_trip_plan_bulk(request: Request, bulk_request: BulkTripPlanRequest = Body(...)):
    """Find the best scheduled trips for multiple route candidates in parallel."""
    print(f"[traffic] Bulk trip plan request for {len(bulk_request.items)} items")
    
    # 1. Parsing and Metadata Gathering
    requests_to_process = []
    routes_to_lookup = set()
    for item in bulk_request.items:
        try:
            dep_time = datetime.fromisoformat(item.departure_time.replace('Z', '+00:00'))
            requests_to_process.append({
                "origin_stop_code": item.origin_stop_code,
                "dest_stop_code": item.dest_stop_code,
                "route_number": item.route_number,
                "departure_time": dep_time,
                "timing_mode": item.timing_mode,
                "minimum_travel_minutes": item.minimum_travel_minutes,
                "plan": None
            })
            routes_to_lookup.add(item.route_number)
        except ValueError:
            continue

    if not requests_to_process:
        return {"plans": []}

    # 2. Parallel Route & Pattern Resolution
    all_routes = transit_proxy.get_routes()
    route_details = {}
    for r_num in routes_to_lookup:
        route = next((r for r in all_routes if r.get("ShortName") == r_num or r.get("Key") == r_num), None)
        if route and route.get("Key"):
            route_details[r_num] = {
                "key": route["Key"],
                "short_name": route["ShortName"],
                "direction_names": [str(name or "").strip() for name in (route.get("DirectionNames") or []) if str(name or "").strip()],
                "pattern": transit_proxy.get_pattern(route["Key"])
            }

    # 3. Schedule Requirement Identification
    schedule_tasks = []
    seen_schedule_tasks = set()
    
    for req in requests_to_process:
        details = route_details.get(req["route_number"])
        if not details: continue
        
        stops = details["pattern"].get("stops") or []
        origin_code = req["origin_stop_code"]
        dest_code = req["dest_stop_code"]
        
        origin_dirs = {str(s.get("DirectionName") or "").strip() for s in stops if str(s.get("StopCode") or "").strip() == origin_code and str(s.get("DirectionName") or "").strip()}
        dest_dirs = {str(s.get("DirectionName") or "").strip() for s in stops if str(s.get("StopCode") or "").strip() == dest_code and str(s.get("DirectionName") or "").strip()}
        
        candidates = [n for n in origin_dirs if n in dest_dirs]
        if not candidates:
            candidates = details["direction_names"] or list(origin_dirs or dest_dirs)
        
        if not candidates: continue
        req["candidates"] = candidates
        req["service_date"] = _local_service_date(req["departure_time"])
        
        for d_name in candidates:
            for scode in [origin_code, dest_code]:
                task_key = (req["route_number"], scode, d_name, req["service_date"])
                if task_key not in seen_schedule_tasks:
                    seen_schedule_tasks.add(task_key)
                    schedule_tasks.append(task_key)

    # 4. Parallel Schedule Fetching
    schedule_lookup = {}
    with ThreadPoolExecutor(max_workers=min(len(schedule_tasks) or 1, 15)) as executor:
        future_to_task = {
            executor.submit(transit_proxy.get_stop_schedule, r, s, d, dt): (r, s, d, dt)
            for (r, s, d, dt) in schedule_tasks
        }
        for future in as_completed(future_to_task):
            task = future_to_task[future]
            try:
                schedule_lookup[task] = future.result()
            except Exception as e:
                print(f"[traffic] Bulk schedule fetch failed for {task}: {e}")
                schedule_lookup[task] = []

    # 5. Plan Calculation (CPU bound, but fast enough sequentially here)
    final_plans = []
    for req in requests_to_process:
        best_plan = None
        candidates = req.get("candidates") or []
        
        if not candidates:
            # Fallback to DB
            try:
                best_plan = transit_repo.find_best_trip(
                    req["origin_stop_code"], req["dest_stop_code"],
                    req["departure_time"], req["route_number"],
                    req["timing_mode"], req["minimum_travel_minutes"]
                )
            except Exception: pass
        else:
            for direction_name in candidates:
                origin_schedule = schedule_lookup.get((req["route_number"], req["origin_stop_code"], direction_name, req["service_date"]), [])
                dest_schedule = schedule_lookup.get((req["route_number"], req["dest_stop_code"], direction_name, req["service_date"]), [])
                
                # Filter/Parsings identical to _find_live_trip logic
                origin_by_dir = defaultdict(list)
                dest_by_dir = defaultdict(list)
                for item in origin_schedule:
                    parsed = _parse_stop_schedule_time(item.get("scheduledDepartTimeUtc"))
                    if parsed: origin_by_dir[str(item.get("sourceDirectionName") or direction_name or "").strip()].append(parsed)
                for item in dest_schedule:
                    parsed = _parse_stop_schedule_time(item.get("scheduledDepartTimeUtc"))
                    if parsed: dest_by_dir[str(item.get("sourceDirectionName") or direction_name or "").strip()].append(parsed)
                
                matching_dirs = [d for d in origin_by_dir if d in dest_by_dir]
                for s_dir in (matching_dirs or [direction_name]):
                    o_times = sorted(origin_by_dir[s_dir])
                    d_times = sorted(dest_by_dir[s_dir])
                    if not o_times or not d_times: continue
                    
                    candidate = None
                    if req["timing_mode"] == "arrive_by":
                        for d_time in reversed(d_times):
                            if d_time > req["departure_time"]: continue
                            cutoff = d_time - timedelta(minutes=req["minimum_travel_minutes"])
                            matches = [o for o in o_times if o < cutoff]
                            if matches:
                                candidate = {"origin_time": matches[-1], "dest_time": d_time, "direction": s_dir}
                                break
                    else:
                        for o_time in o_times:
                            if o_time < req["departure_time"]: continue
                            cutoff = o_time + timedelta(minutes=req["minimum_travel_minutes"])
                            m_dest = next((d for d in d_times if d > cutoff), None)
                            if m_dest:
                                candidate = {"origin_time": o_time, "dest_time": m_dest, "direction": s_dir}
                                break
                    
                    if candidate:
                        if not best_plan or (req["timing_mode"] == "arrive_by" and candidate["dest_time"] > best_plan["dest_time"]) or (req["timing_mode"] != "arrive_by" and candidate["origin_time"] < best_plan["origin_time"]):
                            best_plan = candidate
        
        # Serialize trip for response
        if best_plan:
            best_plan = dict(best_plan)
            if isinstance(best_plan.get('origin_time'), datetime):
                best_plan['origin_time'] = best_plan['origin_time'].isoformat()
            if isinstance(best_plan.get('dest_time'), datetime):
                best_plan['dest_time'] = best_plan['dest_time'].isoformat()
        
        final_plans.append(best_plan)

    return {"plans": final_plans}


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
