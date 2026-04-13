import os
import sys
from dotenv import load_dotenv

sys.path.append(os.getcwd())
load_dotenv(".env")

from services import pulse_service

def test_user_pulse():
    clerk_id = "user_3BolxFIk4nBJbiXZ37mlpNrbLmb"
    print(f"--- Testing Pulse Map for User {clerk_id} ---")
    try:
        res = pulse_service.get_pulse_map(limit=60, clerk_id=clerk_id)
        hotspots = res.get("hotspots", [])
        print(f"Success! Found {len(hotspots)} hotspots.")
        if hotspots:
            print(f"Sample Hotspot: {hotspots[0]['locationName']} ({hotspots[0]['score']} score)")
        else:
            print("Warning: No hotspots found even for this specific user.")
    except Exception as e:
        print(f"FAILED: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_user_pulse()
