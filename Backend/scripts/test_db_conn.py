import psycopg
import os
from dotenv import load_dotenv

load_dotenv("Backend/.env")

DB_HOST = os.getenv("DB_HOST")
DB_NAME = os.getenv("DB_NAME", "maroon_schedules")
DB_USER = os.getenv("DB_USER", "dev_rian")
DB_PASS = os.getenv("DB_PASS", "admin")
DB_PORT = os.getenv("DB_PORT", "5432")

CONNECTION_PARAMS = (
    f"host={DB_HOST} "
    f"port={DB_PORT} "
    f"dbname={DB_NAME} "
    f"user={DB_USER} "
    f"password={DB_PASS} "
    f"connect_timeout=3"
)

print(f"Attempting to connect to {DB_HOST}...")
try:
    with psycopg.connect(CONNECTION_PARAMS) as conn:
        print("Success!")
except Exception as e:
    print(f"Failed: {e}")

print("\nAttempting to connect to localhost...")
LOCALHOST_PARAMS = CONNECTION_PARAMS.replace(f"host={DB_HOST}", "host=localhost")
try:
    with psycopg.connect(LOCALHOST_PARAMS) as conn:
        print("Success on localhost!")
except Exception as e:
    print(f"Failed on localhost: {e}")
