import os
from dotenv import load_dotenv
import stream
import json

load_dotenv(override=True)

api_key = os.environ.get("STREAM_FEEDS_API_KEY") or os.environ.get("STREAM_API_KEY", "")
api_secret = os.environ.get("STREAM_FEEDS_API_SECRET") or os.environ.get("STREAM_API_SECRET", "")

if not api_key or not api_secret:
    print("Missing Stream credentials")
    exit(1)

client = stream.connect(api_key, api_secret)
feed = client.feed("flat", "campus_pings")

try:
    response = feed.get(limit=10)
    activities = response.get("results", [])
    print(f"Found {len(activities)} activities in 'campus_pings' feed:")
    for act in activities:
        custom = act.get("custom") or {}
        print(f"ID: {act.get('id')}")
        print(f"  Title: {custom.get('ping_title')}")
        print(f"  Location: {custom.get('location_tag')}")
        print(f"  Place ID: {custom.get('place_id')}")
        print(f"  Time: {act.get('time')}")
        print("-" * 20)
except Exception as e:
    print(f"Error: {e}")
