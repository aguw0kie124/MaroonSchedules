import sys
import os
import json
from datetime import datetime, timezone

# Add parent dir to sys.path so we can import services
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from services import campus_events_service, campus_hub_service

def check_events():
    print("--- MAROON SCHEDULES BACKEND DIAGNOSTIC ---")
    
    # 1. Check Crawler File
    from services.campus_events_service import CAMPUS_EVENT_SOURCES
    tamu_config = CAMPUS_EVENT_SOURCES["tamu"]
    file_path = tamu_config["crawler_output"]
    
    print(f"Crawler file: {file_path}")
    if not os.path.exists(file_path):
        print("ERROR: Crawler file does not exist!")
        return
    
    file_size = os.path.getsize(file_path)
    print(f"File size: {file_size / 1024 / 1024:.2f} MB")
    
    # 2. Count raw lines
    line_count = 0
    with open(file_path, "r", encoding="utf-8") as f:
        for line in f:
            if line.strip():
                line_count += 1
    print(f"Raw event count in file: {line_count}")
    
    # 3. Test Service Loading
    print("Loading events via service (with current 72h window)...")
    res = campus_events_service.load_campus_events(force_refresh=True)
    events = res.get("events", [])
    print(f"Events remaining after service filters (72h window): {len(events)}")
    
    if len(events) > 0:
        print(f"Sample event start_time: {events[0]['start_time']}")
    
    # 4. Hub Snapshot test
    print("Testing Hub Snapshot...")
    hub_res = campus_hub_service.get_events_snapshot()
    events = hub_res.get("events", [])
    featured = [e for e in events if e.get("is_admin_event")]
    
    print(f"Total events in Hub Snapshot: {len(events)}")
    print(f"Featured (Admin) events found: {len(featured)}")
    
    if len(events) > 0:
        print(f"First event source: {events[0].get('source_name')}")

if __name__ == "__main__":
    check_events()
