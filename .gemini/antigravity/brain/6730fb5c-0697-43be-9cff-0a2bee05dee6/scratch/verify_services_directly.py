import os
import sys

# Ensure we can import from the Backend directory
sys.path.append(os.getcwd())

from services import campus_hub_service, pulse_service
from repositories import user_repository
from datetime import datetime, timezone

CLERK_ID = "user_3BolxFIk4nBJbiXZ37mlpNrbLmb"

def test_service_personalization():
    print(f"--- Testing Event Personalization Service Layer ---")
    
    # SETUP: Mock major for the test user
    print(f"MOCKING: Setting major to 'Softball' for {CLERK_ID}")
    user_repository.update_profile(CLERK_ID, {"major": "Softball"})
    
    # 1. Fetch events
    print("Fetching 'For U' event snapshot...")
    snapshot = campus_hub_service.get_events_snapshot(clerk_id=CLERK_ID, category="For U")
    events = snapshot.get("events", [])
    
    print(f"Total events returned: {len(events)}")
    
    # 2. Verify scores
    top_events = events[:5]
    print("\nTop 5 Recommendation Results:")
    for idx, ev in enumerate(top_events):
        score = ev.get("personalization_score", 0)
        title = ev.get("title")
        print(f"{idx+1}. {title} | Score: {score}")
        
    # Check if a Softball event is at the top
    if any("Softball" in ev.get("title") and ev.get("personalization_score") > 0 for ev in top_events):
        print("\nSUCCESS: Softball events boosted correctly!")
    else:
        print("\nFAILURE: Softball events not boosted or no scores found.")

def test_service_pulse_persistence():
    print(f"\n--- Testing Pulse Persistence Service Layer ---")
    
    # 1. Fetch map
    print("Fetching pulse map snapshot...")
    pulse_map = pulse_service.get_pulse_map(clerk_id=CLERK_ID)
    hotspots = pulse_map.get("hotspots", [])
    
    print(f"Found {len(hotspots)} hotspots on the map.")
    for hs in hotspots[:3]:
        print(f"- {hs['locationName']} | {hs['pingCount']} pings | Score: {hs['score']}")

if __name__ == "__main__":
    try:
        test_service_personalization()
        test_service_pulse_persistence()
    except Exception as e:
        print(f"Test Error: {e}")
        import traceback
        traceback.print_exc()
