import psycopg
from db_config import CONNECTION_PARAMS

conn = psycopg.connect(CONNECTION_PARAMS)
cur = conn.cursor()

# Check users table schema
cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users' ORDER BY ordinal_position")
print("=== USERS TABLE SCHEMA ===")
for r in cur.fetchall():
    print(r)

# Check if profile_image_url column exists
cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'profile_image_url'")
result = cur.fetchone()
print(f"\nprofile_image_url column exists: {result is not None}")

# Try a test upsert
print("\n=== TEST UPSERT ===")
try:
    cur.execute("""
        INSERT INTO users (clerk_id, email, full_name, profile_image_url)
        VALUES ('test_user', 'test@tamu.edu', 'Test User', 'https://example.com/img.jpg')
        ON CONFLICT (clerk_id) DO UPDATE
            SET email = COALESCE(EXCLUDED.email, users.email),
                full_name = COALESCE(EXCLUDED.full_name, users.full_name),
                profile_image_url = COALESCE(EXCLUDED.profile_image_url, users.profile_image_url),
                updated_at = NOW()
        RETURNING id, clerk_id, email, full_name
    """, ('test_user', 'test@tamu.edu', 'Test User', 'https://example.com/img.jpg'))
    print(f"Upsert result: {cur.fetchone()}")
    conn.rollback()  # Don't actually save
except Exception as e:
    print(f"Upsert ERROR: {e}")
    conn.rollback()

conn.close()
