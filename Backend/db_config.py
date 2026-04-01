import os
from pathlib import Path
from dotenv import load_dotenv


BACKEND_DIR = Path(__file__).resolve().parent
ROOT_DIR = BACKEND_DIR.parent

# Load root env first, then backend env for service secrets.
load_dotenv(ROOT_DIR / ".env", override=False)
load_dotenv(BACKEND_DIR / ".env", override=False)


def _resolve_db_host() -> str:
    configured = os.getenv("DB_HOST")
    if configured:
        # The checked-in backend env points at an old remote DB that is timing out in local dev.
        # Prefer the local Postgres instance unless the developer explicitly overrides the host.
        if configured == "10.246.145.251" and os.getenv("MAROON_USE_REMOTE_DB", "").lower() not in {"1", "true", "yes"}:
            return "127.0.0.1"
        return configured
    return "127.0.0.1"


DB_HOST = _resolve_db_host()
DB_NAME = os.getenv("DB_NAME", "maroon_schedules")
DB_USER = os.getenv("DB_USER", "dev_rian")
DB_PASS = os.getenv("DB_PASS", "admin")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_CONNECT_TIMEOUT = os.getenv("DB_CONNECT_TIMEOUT", "3")

CONNECTION_PARAMS = (
    f"host={DB_HOST} "
    f"port={DB_PORT} "
    f"dbname={DB_NAME} "
    f"user={DB_USER} "
    f"password={DB_PASS} "
    f"connect_timeout={DB_CONNECT_TIMEOUT}"
)


def get_db_connection():
    return CONNECTION_PARAMS
