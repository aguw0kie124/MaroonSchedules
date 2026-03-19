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
        # Rec Facilities
        for f in self.fetch_rec_data():
            name = f.get("LocationName") or "Unknown"
            current = f.get("LastCount", 0)
            total = f.get("TotalCapacity", 1)
            percent = round((current / total) * 100, 1)
            result.append({"location": name, "percent_full": percent})
        # Libraries
        for lib in self.fetch_library_data():
            name = lib.get("name") or "Unknown"
            max_cap = int(lib.get("max", 1)) or 1
            remaining = int(lib.get("remaining", 0))
            current = max_cap - remaining
            percent = round((current / max_cap) * 100, 1)
            result.append({"location": name, "percent_full": percent})
        # Events
        for event in self.fetch_event_data(limit=50):
            location_name = event.get("location") or "Unknown Event Location"
            percent = round(random.uniform(10, 100), 1)
            result.append({"location": location_name, "percent_full": percent})
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
