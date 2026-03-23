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

# Centralized coordinate mapping for TAMU Facilities
LOCATION_DATA = {
    # Rec Centers
    "Student Rec": {"lat": 30.6094, "lng": -96.3400, "type": "Rec"},
    "Southside Rec": {"lat": 30.6105, "lng": -96.3364, "type": "Rec"},
    "Polo Rd Rec": {"lat": 30.6225, "lng": -96.3353, "type": "Rec"},

    # Libraries
    "Evans Library": {"lat": 30.6171, "lng": -96.3387, "type": "Library"},
    "Annex Library": {"lat": 30.6171, "lng": -96.3387, "type": "Library"},
    "Cushing Library": {"lat": 30.6166, "lng": -96.3386, "type": "Library"},
    "West Campus Library": {"lat": 30.6146, "lng": -96.3426, "type": "Library"},
    "Medical Science Library": {"lat": 30.6120, "lng": -96.3533, "type": "Library"},
    "PSEL": {"lat": 30.6151, "lng": -96.3510, "type": "Library"},

    # Dining
    "Sbisa Dining Hall": {"lat": 30.6175, "lng": -96.3395, "type": "Dining"},
    "The Commons": {"lat": 30.6102, "lng": -96.3369, "type": "Dining"},
    "MSC Food Court": {"lat": 30.6123, "lng": -96.3415, "type": "Dining"},
    "Polo Road Dining": {"lat": 30.6225, "lng": -96.3353, "type": "Dining"},
    "Pavilion": {"lat": 30.6146, "lng": -96.3418, "type": "Dining"},
    "Duncan Dining Hall": {"lat": 30.6100, "lng": -96.3410, "type": "Dining"},

    # Study/General
    "Zachry Engineering": {"lat": 30.6213, "lng": -96.3403, "type": "Study"},
    "Wisenbaker": {"lat": 30.6202, "lng": -96.3400, "type": "Study"},
    "Rudder Tower": {"lat": 30.6130, "lng": -96.3406, "type": "Study"},
    "Langford Architecture": {"lat": 30.6186, "lng": -96.3381, "type": "Study"},
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

    def get_all_locations_with_events(self) -> List[Dict[str, Any]]:
        result = []
        live_stats = []

        # 1. Fetch live data for averaging/estimation
        rec_data = self.fetch_rec_data()
        lib_data = self.fetch_library_data()

        # Rec Facilities
        for f in rec_data:
            name = f.get("LocationName") or "Unknown"
            current = f.get("LastCount", 0)
            total = f.get("TotalCapacity", 1)
            percent = round((current / total) * 100, 1)
            live_stats.append(percent)
            # Attach coordinates
            coord = next((info for loc, info in LOCATION_DATA.items() if loc.lower() in name.lower() or name.lower() in loc.lower()), None)
            
            result.append({
                "location": name, 
                "percent_full": percent, 
                "type": "Rec", 
                "is_live": True,
                "available_seats": total - current,
                "coord": coord.copy() if coord else None
            })

        # Libraries
        for lib in lib_data:
            name = lib.get("name") or "Unknown"
            max_cap = int(lib.get("max", 1)) or 1
            remaining = int(lib.get("remaining", 0))
            current = max_cap - remaining
            percent = round((current / max_cap) * 100, 1)
            live_stats.append(percent)
            # Attach coordinates
            coord = next((info for loc, info in LOCATION_DATA.items() if loc.lower() in name.lower() or name.lower() in loc.lower()), None)

            result.append({
                "location": name, 
                "percent_full": percent, 
                "type": "Library", 
                "is_live": True,
                "available_seats": remaining,
                "coord": coord.copy() if coord else None
            })

        # Calculate average campus occupancy for "AI Estimation"
        avg_occupancy = sum(live_stats) / len(live_stats) if live_stats else 30.0

        # 2. Add Dining/Study spots with "AI Estimation"
        for loc_name, info in LOCATION_DATA.items():
            # Skip if already added via live data
            if any(r["location"].lower() in loc_name.lower() or loc_name.lower() in r["location"].lower() for r in result):
                continue
            
            # Use average occupancy + some jitter for AI estimation
            est_percent = round(min(95, max(5, avg_occupancy + random.uniform(-10, 15))), 1)
            
            result.append({
                "location": loc_name,
                "percent_full": est_percent,
                "type": info["type"],
                "is_live": False,
                "available_seats": None,
                "coord": info.copy()
            })

        # 3. Events (Filter out generic garbage, no random occupancy)
        for event in self.fetch_event_data(limit=30):
            location_name = event.get("location") or "Unknown Event Location"
            if "online" in location_name.lower() or "zoom" in location_name.lower():
                continue
                
            # If we have coords for this event location, add it as a "Study/General" spot
            coord = None
            for key, val in LOCATION_DATA.items():
                if key.lower() in location_name.lower() or location_name.lower() in key.lower():
                    coord = {"lat": val["lat"], "lng": val["lng"]}
                    break
            
            # Only add if it's a "real" place we can pin
            if coord:
                # Check if we already have this location
                existing = next((r for r in result if r["location"] == location_name), None)
                if not existing:
                    result.append({
                        "location": location_name,
                        "percent_full": round(avg_occupancy, 1),
                        "type": "Study",
                        "is_live": False,
                        "available_seats": None,
                        "coord": coord,
                        "current_event": event.get("title")
                    })
                elif "current_event" not in existing:
                    existing["current_event"] = event.get("title")

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
