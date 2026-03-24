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

try:
    from perplexity import Perplexity
except ImportError:
    Perplexity = None

# STRICT LIST: Only locations provided by the user (Final 15)
# Coordinates verified via Bing/Google Maps
LOCATION_DATA = {
    # Rec Centers
    "Student Rec Center": {"lat": 30.60713, "lng": -96.34283, "type": "Rec"},
    "Southside Rec Center": {"lat": 30.61053, "lng": -96.33649, "type": "Rec"},
    "Polo Road Rec Center": {"lat": 30.62298, "lng": -96.33835, "type": "Rec"},

    # Libraries
    "Sterling C. Evans Library & Annex": {"lat": 30.61703, "lng": -96.33897, "type": "Library"},
    "Cushing Memorial Library & Archives": {"lat": 30.61638, "lng": -96.33992, "type": "Library"},
    "West Campus Library": {"lat": 30.61168, "lng": -96.34996, "type": "Library"},
    "Policy Sciences & Economics Library (PSEL)": {"lat": 30.59744, "lng": -96.35355, "type": "Library"},
    "Medical Sciences Library": {"lat": 30.61182, "lng": -96.35161, "type": "Library"},

    # Dining
    "Sbisa Dining Hall": {"lat": 30.61700, "lng": -96.34350, "type": "Dining"},
    "The Commons Dining Hall": {"lat": 30.61534, "lng": -96.33601, "type": "Dining"},
    "Duncan Dining Hall": {"lat": 30.61180, "lng": -96.33529, "type": "Dining"},
    "West Campus Dining Facility": {"lat": 30.61020, "lng": -96.34863, "type": "Dining"},
    "Memorial Student Center (MSC)": {"lat": 30.61223, "lng": -96.34137, "type": "Dining"},
    "Polo Road Garage": {"lat": 30.62313, "lng": -96.33749, "type": "Dining"},
    "Creekside Market": {"lat": 30.60756, "lng": -96.35381, "type": "Dining"},
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

    def get_mock_metadata(self, loc_name: str, loc_type: str):
        # Operating hours
        hours = "6:00 AM - 12:00 AM" if loc_type == "Rec" else "8:00 AM - 11:00 PM"
        if "Evans" in loc_name or "Annex" in loc_name: 
            hours = "24 Hours (Mon-Thu)"
        
        # Custom naming for mock reviews as requested (Ensure unique names)
        review_pool = [
            {"user": "Parin V.", "rating": 5, "comment": "Great spot, really enjoy the facilities here."},
            {"user": "Asvath M.", "rating": 4, "comment": "Solid choice for studying or grabbing a bite."},
            {"user": "Adhip K.", "rating": 5, "comment": "One of my favorite places on campus!"},
            {"user": "Parin V.", "rating": 4, "comment": "Atmosphere is great today."},
            {"user": "Asvath M.", "rating": 3, "comment": "Decent, but can get a bit loud during peak hours."},
            {"user": "Adhip K.", "rating": 4, "comment": "Highly recommend checking this out."}
        ]
        
        parin_revs = [r for r in review_pool if r["user"] == "Parin V."]
        asvath_revs = [r for r in review_pool if r["user"] == "Asvath M."]
        adhip_revs = [r for r in review_pool if r["user"] == "Adhip K."]
        
        selected_reviews = [
            random.choice(parin_revs),
            random.choice(asvath_revs),
            random.choice(adhip_revs)
        ]
        random.shuffle(selected_reviews)
        
        # Mock Traffic History (last 8 hours)
        history = [random.randint(15, 90) for _ in range(8)]
        
        return {
            "hours": hours,
            "reviews": selected_reviews,
            "traffic_history": history
        }

    def get_all_locations_with_events(self) -> List[Dict[str, Any]]:
        result = []
        live_stats = []

        # 1. Fetch live data
        rec_data = self.fetch_rec_data()
        lib_data = self.fetch_library_data()

        # Rec Facilities
        for f in rec_data:
            name = f.get("LocationName") or "Unknown"
            current = f.get("LastCount", 0)
            total = f.get("TotalCapacity", 1)
            percent = round((current / total) * 100, 1) if total > 0 else 0
            live_stats.append(percent)
            
            coord = next((info for loc, info in LOCATION_DATA.items() if loc.lower() in name.lower() or name.lower() in loc.lower()), None)
            meta = self.get_mock_metadata(name, "Rec")
            
            result.append({
                "location": name, 
                "percent_full": percent, 
                "type": "Rec", 
                "is_live": True,
                "available_seats": total - current,
                "coord": coord,
                **meta
            })

        # Libraries
        for lib in lib_data:
            name = lib.get("name") or "Unknown"
            max_cap = int(lib.get("max", 1)) or 1
            remaining = int(lib.get("remaining", 0))
            current = max_cap - remaining
            percent = round((current / max_cap) * 100, 1)
            live_stats.append(percent)
            
            coord = next((info for loc, info in LOCATION_DATA.items() if loc.lower() in name.lower() or name.lower() in loc.lower()), None)
            meta = self.get_mock_metadata(name, "Library")

            result.append({
                "location": name, 
                "percent_full": percent, 
                "type": "Library", 
                "is_live": True,
                "available_seats": remaining,
                "coord": coord,
                **meta
            })

        # Calculate average campus occupancy
        avg_occupancy = sum(live_stats) / len(live_stats) if live_stats else 42.0

        # 2. Add Dining/Other spots from strict list (AI Estimation)
        for loc_name, info in LOCATION_DATA.items():
            # Skip if already added via live data
            if any(r["location"].lower() in loc_name.lower() or loc_name.lower() in r["location"].lower() for r in result):
                continue
            
            est_percent = round(min(95, max(5, avg_occupancy + random.uniform(-15, 20))), 1)
            meta = self.get_mock_metadata(loc_name, info["type"])
            
            result.append({
                "location": loc_name,
                "percent_full": est_percent,
                "type": info["type"],
                "is_live": False,
                "available_seats": None,
                "coord": info,
                **meta
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
        else:
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
