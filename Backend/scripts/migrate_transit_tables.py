import os
import sys
from pathlib import Path

# Add backend to path
sys.path.append(str(Path(__file__).resolve().parent.parent))

from db_config import get_pool

def migrate():
    pool = get_pool()
    with pool.connection() as conn:
        with conn.cursor() as cur:
            print("[migration] Creating transit_stop_schedules table...")
            cur.execute("""
                CREATE TABLE IF NOT EXISTS transit_stop_schedules (
                    id SERIAL PRIMARY KEY,
                    route_number TEXT NOT NULL,
                    stop_code TEXT NOT NULL,
                    direction_name TEXT NOT NULL,
                    scheduled_time TIMESTAMPTZ NOT NULL,
                    is_departure BOOLEAN DEFAULT TRUE,
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    UNIQUE(route_number, stop_code, direction_name, scheduled_time)
                );
            """)
            
            print("[migration] Creating indexes for transit_stop_schedules...")
            cur.execute("ALTER TABLE transit_stop_schedules ADD COLUMN IF NOT EXISTS trip_point_id TEXT;")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_transit_stop_lookup ON transit_stop_schedules (stop_code, route_number, scheduled_time);")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_transit_time_lookup ON transit_stop_schedules (scheduled_time);")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_transit_trip_point ON transit_stop_schedules (trip_point_id);")
            
            conn.commit()
            print("[migration] Success.")

if __name__ == "__main__":
    migrate()
