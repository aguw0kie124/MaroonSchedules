import sys
import os
import json
from datetime import datetime, timezone

# Add current directory to path
sys.path.append(os.getcwd())

from services import campus_hub_service
from db_config import init_pool

# Initialize pool
init_pool()

# Simulate the exact call the frontend makes
# limit=1000, student_relevant_only=false, category=None, clerk_id=None
response = campus_hub_service.get_events_snapshot(
    clerk_id=None,
    limit=1000,
    category=None,
    student_relevant_only=False,
    campus='tamu'
)

events = response.get('events', [])
print(f"API returned {len(events)} events")

if events:
    # Check the first few events for category structure and dates
    for i, e in enumerate(events[:10]):
        print(f"Event {i}: {e['title']}")
        print(f"  Categories: {e.get('categories')}")
        print(f"  Start Time: {e.get('start_time')}")
        print(f"  Is Admin: {e.get('is_admin_event')}")
        
    # Count how many have categories
    with_categories = [e for e in events if e.get('categories')]
    print(f"Events with categories dict: {len(with_categories)}")
    
    # Check if any match common categories
    sports = [e for e in events if e.get('categories', {}).get('sports')]
    academic = [e for e in events if e.get('categories', {}).get('academic')]
    print(f"Sports count: {len(sports)}")
    print(f"Academic count: {len(academic)}")
else:
    print("No events in response.")
