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

from psycopg_pool import ConnectionPool

CONNECTION_PARAMS = (
    f"host={DB_HOST} "
    f"port={DB_PORT} "
    f"dbname={DB_NAME} "
    f"user={DB_USER} "
    f"password={DB_PASS} "
    f"connect_timeout={DB_CONNECT_TIMEOUT} "
    f"options='-c statement_timeout=5000'"
)

_db_pool: ConnectionPool | None = None

def get_db_connection():
    """Returns the connection string for backward compatibility."""
    return CONNECTION_PARAMS

def init_pool():
    """Initializes the global connection pool."""
    global _db_pool
    if _db_pool is None:
        print("[db_config] Initializing DB connection pool...")
        _db_pool = ConnectionPool(
            CONNECTION_PARAMS,
            min_size=2,      # Keep at least 2 connections alive
            max_size=20,     # Scale up to 20 during bursts
            open=True
        )
    return _db_pool

def get_pool() -> ConnectionPool:
    """Gets the global pool, initializing it if necessary."""
    if _db_pool is None:
        return init_pool()
    return _db_pool

def close_pool():
    """Closes the global connection pool on shutdown."""
    global _db_pool
    if _db_pool is not None:
        print("[db_config] Closing DB connection pool...")
        _db_pool.close()
        _db_pool = None
