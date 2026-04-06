import os
import redis
from pathlib import Path

# Load REDIS_URL from .env
# __file__ is in Backend/scripts/ so we need to go up one Level to Backend/
BACKEND_DIR = Path(__file__).resolve().parents[1]
env_path = BACKEND_DIR / ".env"
url = None
if env_path.exists():
    with open(env_path, "r") as f:
        for line in f:
            if line.startswith("REDIS_URL="):
                url = line.strip().split("=", 1)[1].strip()

if not url:
    print(f"REDIS_URL not found in .env at {env_path}")
    exit(1)

print(f"Connecting to Cloud Redis: {url[:30]}...")
r = redis.from_url(url)
key = "campus:recreation:snapshot:v1"
result = r.delete(key)
if result:
    print(f"Successfully deleted cached key: {key}")
else:
    print(f"Key {key} was not found or already deleted.")
