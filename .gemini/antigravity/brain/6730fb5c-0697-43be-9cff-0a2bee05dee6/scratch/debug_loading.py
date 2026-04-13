import os
import sys
from dotenv import load_dotenv

# Ensure we can import from the Backend directory
sys.path.append(os.getcwd())
load_dotenv(".env")

from services import pulse_service, campus_hub_service
from auth import optional_auth

def test_imports_and_calls():
    print("--- Testing Service Imports ---")
    try:
        from services import pulse_service
        print("pulse_service imported successfully")
    except Exception as e:
        print(f"pulse_service import FAILED: {e}")
        import traceback
        traceback.print_exc()

    try:
        from chat import proxy_get_feed
        print("chat (proxy_get_feed) imported successfully")
    except Exception as e:
        print(f"chat import FAILED: {e}")
        import traceback
        traceback.print_exc()

    print("\n--- Testing get_pulse_map call ---")
    try:
        # Testing with anonymous call (clerk_id=None)
        res = pulse_service.get_pulse_map(limit=60)
        print(f"get_pulse_map successful. Hotspots: {len(res.get('hotspots', []))}")
    except Exception as e:
        print(f"get_pulse_map FAILED: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_imports_and_calls()
