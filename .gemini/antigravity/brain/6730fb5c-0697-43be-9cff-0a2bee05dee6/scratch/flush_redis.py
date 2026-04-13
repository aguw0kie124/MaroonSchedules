import redis
import os
from dotenv import load_dotenv

load_dotenv(".env")

def flush_redis():
    host = os.environ.get("REDIS_HOST", "localhost")
    port = int(os.environ.get("REDIS_PORT", 6379))
    try:
        r = redis.Redis(host=host, port=port)
        r.flushall()
        print(f"Redis at {host}:{port} flushed successfully.")
    except Exception as e:
        print(f"Failed to flush Redis: {e}")

if __name__ == "__main__":
    flush_redis()
