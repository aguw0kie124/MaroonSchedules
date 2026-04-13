import os
import sys

# Ensure we can import from the Backend directory
sys.path.append(os.getcwd())

from services import pulse_service, cache_service
from repositories import feed_repository
from dotenv import load_dotenv

# Load env variables
load_dotenv(".env")

CLERK_ID = "user_3BolxFIk4nBJbiXZ37mlpNrbLmb"

def test_cache_miss_fallback():
    print("--- Testing Pulse Cache Fallback ---")
    
    # 1. Clear campus_pings cache
    cache_service.delete("feed:backbone:flat:campus_pings")
    print("Cleared feed:backbone:flat:campus_pings")
    
    # 2. Set an artificial campus_global cache (simulating an active but incomplete cache)
    dummy_global = [{"id": "post-999", "post_type": "post", "user_id": "none", "custom": {"content_type": "post"}}]
    cache_service.set_json("feed:backbone:flat:campus_global", dummy_global, ttl_seconds=60)
    print("Set feed:backbone:flat:campus_global with dummy post.")
    
    # 3. Call get_pulse_map
    print("Fetching pulse map...")
    pulse_map = pulse_service.get_pulse_map(clerk_id=CLERK_ID)
    hotspots = pulse_map.get("hotspots", [])
    
    print(f"Result: Found {len(hotspots)} hotspots.")
    
    # If hotspots > 0, it means it fetched pings from the DB (since our dummy cache had 0 pings)
    if len(hotspots) > 0:
        print("SUCCESS: Database pings were correctly merged despite having dummy global cache.")
    else:
        # Check if there are actually pings in the DB to fetch
        db_pings = feed_repository.get_crowdping_feed(post_types=["ping"], limit=10)
        if len(db_pings) > 0:
            print("FAILURE: No hotspots found despite having pings in the database.")
        else:
            print("NO DATA: Cannot verify fallback because the database is empty of pings.")

if __name__ == "__main__":
    try:
        test_cache_miss_fallback()
    except Exception as e:
        print(f"Test Error: {e}")
        import traceback
        traceback.print_exc()
