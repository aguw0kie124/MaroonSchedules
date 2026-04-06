import os
from pathlib import Path
from dotenv import load_dotenv


BACKEND_DIR = Path(__file__).resolve().parent
ROOT_DIR = BACKEND_DIR.parent

# Load root env first, then backend env for service secrets.
load_dotenv(ROOT_DIR / ".env", override=False)
load_dotenv(BACKEND_DIR / ".env", override=False)


DB_HOST = os.getenv("DB_HOST")
DB_NAME = os.getenv("DB_NAME", "maroon_schedules")
DB_USER = os.getenv("DB_USER", "dev_rian")
DB_PASS = os.getenv("DB_PASS", "admin")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_CONNECT_TIMEOUT = os.getenv("DB_CONNECT_TIMEOUT", "8")

CONNECTION_PARAMS = (
    f"host={DB_HOST} "
    f"port={DB_PORT} "
    f"dbname={DB_NAME} "
    f"user={DB_USER} "
    f"password={DB_PASS} "
    f"connect_timeout={DB_CONNECT_TIMEOUT} "
    f"options='-c statement_timeout=5000'"
)


def get_db_connection():
    return CONNECTION_PARAMS
