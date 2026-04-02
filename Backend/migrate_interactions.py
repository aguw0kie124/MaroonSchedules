import psycopg
from db_config import CONNECTION_PARAMS

def migrate():
    print("Migrating post_interactions table...")
    try:
        with psycopg.connect(CONNECTION_PARAMS) as conn:
            with conn.cursor() as cur:
                # Add columns if not exist
                cur.execute("""
                    ALTER TABLE post_interactions 
                    ADD COLUMN IF NOT EXISTS user_name TEXT,
                    ADD COLUMN IF NOT EXISTS user_image TEXT
                """)
                conn.commit()
                print("✅ Migration Successful")
    except Exception as e:
        print(f"❌ Migration Failed: {e}")

if __name__ == "__main__":
    migrate()
