import psycopg
from db_config import CONNECTION_PARAMS
import json

def debug_db():
    try:
        with psycopg.connect(CONNECTION_PARAMS) as conn:
            with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
                # Check users
                cur.execute("SELECT count(*) FROM users")
                user_count = cur.fetchone()['count']
                
                # Check admin events
                cur.execute("SELECT count(*) FROM admin_events")
                admin_event_count = cur.fetchone()['count']
                
                # Fetch recent admin events
                cur.execute("SELECT id, title, start_time, clerk_id FROM admin_events ORDER BY created_at DESC LIMIT 5")
                recent_events = cur.fetchall()
                
                output = {
                    "user_count": user_count,
                    "admin_event_count": admin_event_count,
                    "recent_events": [{**e, "start_time": e["start_time"].isoformat() if e["start_time"] else None} for e in recent_events]
                }
                
                with open("Backend/db_debug.json", "w") as f:
                    json.dump(output, f, indent=2)
                print(f"Debug info written to Backend/db_debug.json (Admin Events: {admin_event_count})")
    except Exception as e:
        print(f"DB Debug failed: {e}")

if __name__ == "__main__":
    debug_db()
