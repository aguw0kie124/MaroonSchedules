import psycopg
from db_config import get_db_connection

def main():
    try:
        conn = psycopg.connect(get_db_connection())
        cur = conn.cursor()
        cur.execute("SELECT location, location_type, COUNT(*) FROM food_items GROUP BY location, location_type ORDER BY location_type, location;")
        locs = cur.fetchall()
        print("Available Locations:")
        for l in locs:
            print(f"- {l[0]} ({l[1]}): {l[2]} items")
            
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()
