import psycopg
from db_config import get_db_connection

def create_table():
    try:
        with psycopg.connect(get_db_connection()) as conn:
            with conn.cursor() as cur:
                print("Connected to PostgreSQL.")

                # Create the campus_posts table
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS campus_posts (
                        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        user_id     TEXT NOT NULL,
                        user_name   TEXT,
                        user_image  TEXT,
                        caption     TEXT,
                        media_url   TEXT,
                        media_type  TEXT CHECK (media_type IN ('image','video')),
                        location_tag TEXT,
                        likes       INTEGER DEFAULT 0,
                        liked_by    TEXT[] DEFAULT '{}',
                        created_at  TIMESTAMPTZ DEFAULT NOW()
                    );
                """)
                print("Successfully created 'campus_posts' table (if it didn't exist).")

            # Commit the transaction
            conn.commit()
    except Exception as e:
        print(f"Error creating table: {e}")

if __name__ == "__main__":
    create_table()
