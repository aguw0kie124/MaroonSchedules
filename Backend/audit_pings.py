import psycopg
from db_config import CONNECTION_PARAMS
import json

def audit():
    try:
        with psycopg.connect(CONNECTION_PARAMS) as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT COUNT(*) FROM crowdping_posts")
                count = cur.fetchone()[0]
                print(f"Total pings in DB: {count}")
                
                cur.execute("SELECT id, post_type, lat, lng, location_tag FROM crowdping_posts ORDER BY created_at DESC LIMIT 5")
                rows = cur.fetchall()
                for r in rows:
                    print(f"Ping {r[0]}: type={r[1]}, lat={r[2]}, lng={r[3]}, tag={r[4]}")
    except Exception as e:
        print(f"Audit failed: {e}")

if __name__ == "__main__":
    audit()
