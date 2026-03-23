"""
Migration script: Create the 'users' table in PostgreSQL.
Run once:  python create_users_table.py
"""
import psycopg
from db_config import get_db_connection

SQL = """
CREATE TABLE IF NOT EXISTS users (
    id                SERIAL PRIMARY KEY,
    clerk_id          TEXT UNIQUE NOT NULL,
    email             TEXT,
    full_name         TEXT,
    major             TEXT DEFAULT '',
    graduation_year   TEXT DEFAULT '',
    preferred_time    TEXT DEFAULT 'Morning',
    max_credits       TEXT DEFAULT '15',
    avoid_friday      BOOLEAN DEFAULT FALSE,
    show_online_first BOOLEAN DEFAULT TRUE,
    schedules         JSONB DEFAULT '[]'::jsonb,
    created_at        TIMESTAMP DEFAULT NOW(),
    updated_at        TIMESTAMP DEFAULT NOW()
);
"""

def main():
    print("Connecting to PostgreSQL...")
    with psycopg.connect(get_db_connection()) as conn:
        with conn.cursor() as cur:
            cur.execute(SQL)
        conn.commit()
    print("✓ 'users' table created (or already exists).")

if __name__ == "__main__":
    main()
