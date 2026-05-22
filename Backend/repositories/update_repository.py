from typing import List, Dict, Any
from db_config import get_pool
import psycopg

def get_version_config() -> List[Dict[str, Any]]:
    """
    Fetches the app version configuration from the database.
    """
    pool = get_pool()
    try:
        with pool.connection() as conn:
            with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
                cur.execute("""
                    SELECT platform, latest_version, minimum_supported_version, store_url 
                    FROM app_version_config
                """)
                return cur.fetchall()
    except Exception as e:
        print(f"Error fetching version config from DB: {e}")
        return []
