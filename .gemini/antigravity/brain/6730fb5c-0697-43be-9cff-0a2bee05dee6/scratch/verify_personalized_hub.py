import requests
import json
import time

BASE_URL = "http://localhost:8000"
CLERK_ID = "user_3BolxFIk4nBJbiXZ37mlpNrbLmb" # Using the user's ID from logs

API_KEY = "ml_app_4f8d2b7c9e1a6f3d8c2b5a9e7f1d4c6b"
HEADERS = {
    "X-API-Key": API_KEY,
    "Content-Type": "application/json"
}

def test_personalized_events():
    print(f"Testing Personalized Events for {CLERK_ID}...")
    
    # SETUP: Mock major for the test user
    from repositories import user_repository
    print(f"MOCKING: Setting major to 'Softball' for {CLERK_ID}")
    user_repository.update_profile(CLERK_ID, {"major": "Softball"})

    # 1. Get events with no category (standard view)
    r = requests.get(f"{BASE_URL}/campus/events", params={"clerk_id": CLERK_ID}, headers=HEADERS)
    if r.status_code == 200:
        events = r.json().get("events", [])
        print(f"Total events found: {len(events)}")
    else:
        print(f"Error fetching events: {r.status_code} {r.text}")
        return

    # 2. Get events with "For U" category
    print("\nRequesting 'For U' recommendations...")
    r = requests.get(f"{BASE_URL}/campus/events", params={"clerk_id": CLERK_ID, "category": "For U"}, headers=HEADERS)
    if r.status_code == 200:
        for_u_events = r.json().get("events", [])
        print(f"Total 'For U' events found: {len(for_u_events)}")
        
        print("\nTop 5 'For U' recommendations:")
        for idx, ev in enumerate(for_u_events[:5]):
            score = ev.get("personalization_score", 0)
            print(f"{idx+1}. {ev['title']} | Score: {score} | Start: {ev['start_time']}")
    else:
        print(f"Error fetching For U events: {r.status_code} {r.text}")

def test_ping_duration():
    print("\nTesting Ping Duration on Pulse Map...")
    r = requests.get(f"{BASE_URL}/campus/pulse/map", params={"clerk_id": CLERK_ID}, headers=HEADERS)
    if r.status_code == 200:
        hotspots = r.json().get("hotspots", [])
        print(f"Found {len(hotspots)} hotspots on the map.")
        for hs in hotspots:
            print(f"- {hs['locationName']} | {hs['pingCount']} pings")
    else:
        print(f"Error fetching pulse map: {r.status_code} {r.text}")

if __name__ == "__main__":
    test_personalized_events()
    test_ping_duration()
