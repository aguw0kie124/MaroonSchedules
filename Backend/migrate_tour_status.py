import psycopg
from db_config import CONNECTION_PARAMS

def run_migration():
    print(f"Connecting to {CONNECTION_PARAMS}...")
    try:
        with psycopg.connect(CONNECTION_PARAMS) as conn:
            with conn.cursor() as cur:
                print("Adding tour_completed column...")
                cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS tour_completed BOOLEAN DEFAULT FALSE;")
            conn.commit()
            print("Migration successful.")
    except Exception as e:
        print(f"Migration failed: {e}")

if __name__ == "__main__":
    run_migration()
