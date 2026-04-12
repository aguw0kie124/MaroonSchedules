from __future__ import annotations
import psycopg
from db_config import CONNECTION_PARAMS

def check_admin_events():
    try:
        with psycopg.connect(CONNECTION_PARAMS) as conn:
            with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
                # Check table exists
                cur.execute("SELECT count(*) FROM admin_events")
                count = cur.fetchone()['count']
                print(f"Total admin events: {count}")

                # Show latest 5
                cur.execute("SELECT id, title, start_time, clerk_id FROM admin_events ORDER BY created_at DESC LIMIT 5")
                rows = cur.fetchall()
                for row in rows:
                    print(f"Event: {row['title']} | ID: {row['id']} | Start: {row['start_time']} | Clerk: {row['clerk_id']}")

    except Exception as e:
        print(f"Error checking DB: {e}")

if __name__ == "__main__":
    check_admin_events()
