import os
import requests
import json
import time
from dotenv import load_dotenv

# Load env variables from root .env 
env_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(dotenv_path=env_path)

API_URL = "http://localhost:8000/campus/events"
HEADERS = {"x-api-key": os.getenv("API_KEY", "your_api_key_here")}

def test_api():
    print("Fetching events from API...")
    try:
        # First call without clerk_id
        r1 = requests.get(f"{API_URL}?limit=1000&student_relevant_only=false", headers=HEADERS)
        print(f"Call 1 (No clerk_id) status: {r1.status_code}")
        data1 = r1.json()
        events1 = data1.get("events", []) if isinstance(data1, dict) else data1
        print(f"Call 1 returned {len(events1)} events.")

        # Second call with a clerk_id but NO auth token (should now return anonymous events instead of 401)
        clerk_id = "user_3C9dY3jYG20CbqsOOuTGdni9PCe"
        r2 = requests.get(f"{API_URL}?clerk_id={clerk_id}&limit=1000&student_relevant_only=false", headers=HEADERS)
        print(f"Call 2 (With clerk_id={clerk_id}, NO AUTH) status: {r2.status_code}")
        data2 = r2.json()
        events2 = data2.get("events", []) if isinstance(data2, dict) else data2
        print(f"Call 2 returned {len(events2)} events.")

        if r2.status_code == 200:
            print("SUCCESS: Backend gracefully downgraded to anonymous mode.")
        else:
            print(f"FAILURE: Backend still returned {r2.status_code}")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_api()
