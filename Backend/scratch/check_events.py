import sys
import os
from datetime import datetime

# Add current directory to path
sys.path.append(os.getcwd())

from services import campus_events_service
from db_config import init_pool

# Initialize pool for repositories that might be called
init_pool()

events_data = campus_events_service.load_campus_events(campus='tamu')
events = events_data.get('events', [])

print(f"Total events loaded: {len(events)}")
if events:
    from collections import Counter
    labels = Counter(e.get('campus_interest_label', 'none') for e in events)
    print(f"Label distribution: {dict(labels)}")
    
    for e in events[:3]:
        print(f"Event: {e['title']}")
        print(f"  Score: {e.get('campus_interest_score')} ({e.get('campus_interest_label')})")
else:
    print("No events loaded.")
