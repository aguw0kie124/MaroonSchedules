import os
import sys
from dotenv import load_dotenv

sys.path.append(os.getcwd())
load_dotenv(".env")

from services import pulse_service, cache_service
from repositories import feed_repository

def debug_pings_metadata():
    print("--- Inspecting Live Pings Metadata ---")
    pings = feed_repository.get_crowdping_feed(post_types=["ping"], limit=10)
    for p in pings:
        p_id = p.get("id")
        custom = pulse_service._get_custom(p)
        lat = p.get("lat") or custom.get("lat") or custom.get("place_lat") or custom.get("location_lat")
        lng = p.get("lng") or custom.get("lng") or custom.get("place_lng") or custom.get("location_lng")
        place_id = p.get("place_id") or custom.get("place_id")
        tag = p.get("location_tag") or custom.get("location_tag")
        
        print(f"Ping {p_id}:")
        print(f"  lat/lng: {lat}, {lng}")
        print(f"  place_id: {place_id}")
        print(f"  tag: {tag}")
        print(f"  is_pulse: {pulse_service._is_pulse_ping_post(p)}")

if __name__ == "__main__":
    debug_pings_metadata()
