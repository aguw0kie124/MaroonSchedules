
import psycopg2
import os

DB_HOST = "10.246.145.251"
DB_NAME = "maroon_schedules"
DB_USER = "dev_rian"
DB_PASS = "admin"

def list_locations():
    try:
        conn = psycopg2.connect(
            host=DB_HOST,
            database=DB_NAME,
            user=DB_USER,
            password=DB_PASS
        )
        cur = conn.cursor()
        cur.execute("SELECT DISTINCT location, location_type FROM food_items")
        rows = cur.fetchall()
        print("Locations in food_items:")
        for row in rows:
            print(f"- {row[0]} ({row[1]})")
        
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    list_locations()
