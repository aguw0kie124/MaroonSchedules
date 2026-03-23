import psycopg
from db_config import CONNECTION_PARAMS

def create_reviews_table():
    try:
        with psycopg.connect(CONNECTION_PARAMS) as conn:
            with conn.cursor() as cur:
                print("Connected to PostgreSQL.")

                # Create the campus_reviews table
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS campus_reviews (
                        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        user_id     TEXT NOT NULL,
                        user_name   TEXT,
                        location    TEXT NOT NULL,
                        rating      INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
                        comment     TEXT,
                        created_at  TIMESTAMPTZ DEFAULT NOW()
                    );
                """)
                
                # Index for faster lookup by location
                cur.execute("CREATE INDEX IF NOT EXISTS idx_reviews_location ON campus_reviews(location);")
                
                print("Successfully created 'campus_reviews' table and index.")

            conn.commit()
    except Exception as e:
        print(f"Error creating table: {e}")

if __name__ == "__main__":
    create_reviews_table()
