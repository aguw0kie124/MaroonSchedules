import sys
import os
from pathlib import Path

# Add Backend to path
backend_path = Path(__file__).resolve().parent.parent / "Backend"
sys.path.append(str(backend_path))

try:
    from repositories import feed_repository
    posts = feed_repository.get_crowdping_feed(limit=10)
    print(f"Found {len(posts)} posts in crowdping_posts")
    for p in posts:
        print(f"- ID: {p['id']}, Lat: {p['lat']}, Lng: {p['lng']}, Tag: {p['location_tag']}, Type: {p['post_type']}")
except Exception as e:
    print(f"Error checking DB: {e}")
