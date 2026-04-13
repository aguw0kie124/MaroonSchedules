import sys
import os
import psycopg

# Add parent dir to sys.path so we can import services
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from services import pulse_service
import db_config

def check_pulse():
    print("--- MAROON SCHEDULES PULSE/PING DIAGNOSTIC ---")
    
    try:
        conn = psycopg.connect(db_config.CONNECTION_PARAMS)
        print("Database connection: SUCCESS")
    except Exception as e:
        print(f"Database connection: FAILED ({e})")
        return

    # 1. Check Tables
    tables = [
        "crowdping_posts", 
        "post_interactions", 
        "campus_event_rsvps", 
        "blocked_users",
        "content_reports"
    ]
    print("\nChecking Tables:")
    for table in tables:
        try:
            with conn.cursor() as cur:
                cur.execute(f"SELECT COUNT(*) FROM {table}")
                count = cur.fetchone()[0]
                print(f"  [OK] {table}: {count} rows")
        except Exception as e:
            print(f"  [ERROR] {table}: {e}")
            conn.rollback()

    # 2. Test pulse map service
    print("\nTesting Pulse Map Service:")
    try:
        res = pulse_service.get_pulse_map()
        hotspots = res.get("hotspots", [])
        
        total_pings = sum(len(h.get("items", [])) for h in hotspots)
        
        print(f"  Hotspots found: {len(hotspots)}")
        print(f"  Total items found (Pings + Events): {total_pings}")
        
        if total_pings > 0:
            # Find the first item to show a sample
            first_item = next((h.get("items", [])[0] for h in hotspots if h.get("items")), None)
            if first_item:
                print(f"  Sample item: '{first_item.get('title')}' at {first_item.get('locationName')}")
    except Exception as e:
        print(f"  [ERROR] pulse_service.get_pulse_map(): {e}")

    conn.close()

if __name__ == "__main__":
    check_pulse()
