from __future__ import annotations
import psycopg
import os
from pathlib import Path
from dotenv import load_dotenv

# Load env
BACKEND_DIR = Path(__file__).resolve().parent.parent
ROOT_DIR = BACKEND_DIR.parent
load_dotenv(ROOT_DIR / ".env")
load_dotenv(BACKEND_DIR / ".env")

DB_HOST = os.getenv("DB_HOST", "127.0.0.1")
DB_NAME = os.getenv("DB_NAME", "maroon_schedules")
DB_USER = os.getenv("DB_USER", "dev_rian")
DB_PASS = os.getenv("DB_PASS", "admin")
DB_PORT = os.getenv("DB_PORT", "5432")

CONNECTION_PARAMS = f"host={DB_HOST} port={DB_PORT} dbname={DB_NAME} user={DB_USER} password={DB_PASS}"

MIGRATION_SQL = """
-- BLOCKED USERS (bidirectional blocking)
CREATE TABLE IF NOT EXISTS blocked_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id TEXT NOT NULL REFERENCES users(clerk_id) ON DELETE CASCADE,
  blocked_id TEXT NOT NULL REFERENCES users(clerk_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(blocker_id, blocked_id)
);

CREATE INDEX IF NOT EXISTS idx_blocked_users_blocker ON blocked_users (blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocked ON blocked_users (blocked_id);

-- REPORTS TABLE (Clerk integration)
CREATE TABLE IF NOT EXISTS content_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_clerk_id VARCHAR(255) NOT NULL,
  reportee_clerk_id VARCHAR(255) NOT NULL,
  post_type VARCHAR(20) NOT NULL, -- 'review' | 'crowdping'
  post_id UUID NOT NULL,
  place_id TEXT, 
  reason VARCHAR(50) NOT NULL, 
  comment TEXT,
  status VARCHAR(20) DEFAULT 'pending', 
  reviewed_by_clerk_id VARCHAR(255),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_reporter ON content_reports (reporter_clerk_id);
CREATE INDEX IF NOT EXISTS idx_reports_post ON content_reports (post_type, post_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON content_reports (status);
CREATE INDEX IF NOT EXISTS idx_reports_pending ON content_reports (status, created_at) WHERE status = 'pending';
"""

def main():
    print(f"Connecting to {DB_NAME} on {DB_HOST}...")
    try:
        with psycopg.connect(CONNECTION_PARAMS) as conn:
            with conn.cursor() as cur:
                cur.execute(MIGRATION_SQL)
            conn.commit()
        print("✅ Compliance tables created successfully.")
    except Exception as e:
        print(f"❌ Migration failed: {e}")

if __name__ == "__main__":
    main()
