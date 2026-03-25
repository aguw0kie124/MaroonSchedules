from fastapi import APIRouter
from pydantic import BaseModel
import requests
from datetime import datetime
from typing import List, Dict, Any
import random
from urllib.parse import quote
import pytz
import json
import re
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
    "Student Rec Center":   {"lat": 30.60713, "lng": -96.34283, "type": "Rec"},
    "Southside Rec Center": {"lat": 30.61053, "lng": -96.33649, "type": "Rec"},
    "Polo Road Rec Center": {"lat": 30.62298, "lng": -96.33835, "type": "Rec"},

    # Libraries  (matched by LIBRARY_KEY_MAP below)
    "Evans Library":                          {"lat": 30.61703, "lng": -96.33897, "type": "Library"},
    "Evans Library Annex":                    {"lat": 30.61720, "lng": -96.33870, "type": "Library"},
    "West Campus Library":                    {"lat": 30.61168, "lng": -96.34996, "type": "Library"},
    "Cushing Memorial Library":               {"lat": 30.61638, "lng": -96.33992, "type": "Library"},
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
