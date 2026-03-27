import psycopg
from db_config import get_db_connection

SQL = """
ALTER TABLE users ADD COLUMN IF NOT EXISTS canvas_access_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS canvas_refresh_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS canvas_expires_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS canvas_instance_url TEXT DEFAULT 'https://canvas.tamu.edu';
"""

def main():
    print("Connecting to PostgreSQL to add canvas columns...")
    with psycopg.connect(get_db_connection()) as conn:
        with conn.cursor() as cur:
            cur.execute(SQL)
        conn.commit()
    print("✓ Canvas columns added to 'users' table.")

if __name__ == "__main__":
    main()
