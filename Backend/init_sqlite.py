import sqlite3
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "campus_posts.db")

def init_db():
    print(f"Initializing SQLite database at {DB_PATH}...")
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    # 1. Users table
    cur.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id                INTEGER PRIMARY KEY AUTOINCREMENT,
        clerk_id          TEXT UNIQUE NOT NULL,
        email             TEXT,
        full_name         TEXT,
        profile_image_url TEXT,
        major             TEXT DEFAULT '',
        graduation_year   TEXT DEFAULT '',
        preferred_time    TEXT DEFAULT 'Morning',
        max_credits       TEXT DEFAULT '15',
        avoid_friday      BOOLEAN DEFAULT 0,
        show_online_first BOOLEAN DEFAULT 1,
        schedules         TEXT DEFAULT '[]', -- SQLite handles JSON as text
        created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 2. Campus Posts table
    cur.execute("""
    CREATE TABLE IF NOT EXISTS campus_posts (
        id           TEXT PRIMARY KEY, -- Use UUID-like strings
        user_id      TEXT NOT NULL,
        user_name    TEXT,
        user_image   TEXT,
        caption      TEXT,
        media_url    TEXT,
        media_type   TEXT CHECK (media_type IN ('image','video')),
        location_tag TEXT,
        likes        INTEGER DEFAULT 0,
        liked_by     TEXT DEFAULT '[]', -- Store as JSON array of IDs
        created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 3. Campus Reviews table
    cur.execute("""
    CREATE TABLE IF NOT EXISTS campus_reviews (
        id          TEXT PRIMARY KEY,
        user_id     TEXT NOT NULL,
        user_name   TEXT,
        location    TEXT NOT NULL,
        rating      INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
        comment     TEXT,
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)
    cur.execute("CREATE INDEX IF NOT EXISTS idx_reviews_location ON campus_reviews(location);")

    conn.commit()
    conn.close()
    print("✓ SQLite database initialized successfully.")

if __name__ == "__main__":
    init_db()
