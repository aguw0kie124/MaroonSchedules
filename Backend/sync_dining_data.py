import os
from datetime import datetime
from services.dining_service import init_db, sync_all_locations
from dotenv import load_dotenv

# Load env from Backend/.env
load_dotenv()

def sync_main():
    date_str = datetime.now().strftime('%Y-%m-%d')
    print(f"Starting in-depth dining data sync for {date_str} (including USDA verification and cost)...")
    
    # Ensure tables and columns exist
    init_db()
    
    # Optional: Run the migration here again just in case init_db missed something
    from services.dining_service import get_db_conn
    conn = get_db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("ALTER TABLE food_items ADD COLUMN IF NOT EXISTS usda_calories FLOAT; ALTER TABLE food_items ADD COLUMN IF NOT EXISTS cost FLOAT DEFAULT 0;")
            conn.commit()
    finally:
        conn.close()

    sync_all_locations(date_str)
    print("Sync complete.")

if __name__ == "__main__":
    sync_main()
