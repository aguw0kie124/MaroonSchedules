"""
Migration script: Add 'profile_image_url' column to the 'users' table.
Run: python Backend/add_profile_image_column.py
"""
import psycopg
from Backend.db_config import CONNECTION_PARAMS

SQL = "ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_image_url TEXT;"

def main():
    print("Connecting to PostgreSQL...")
    try:
        with psycopg.connect(CONNECTION_PARAMS) as conn:
            with conn.cursor() as cur:
                cur.execute(SQL)
            conn.commit()
        print("✓ 'profile_image_url' column added successfully (or already exists).")
    except Exception as e:
        print(f"✗ Error: {e}")
        print("\nMake sure your PostgreSQL server is running and accessible.")

if __name__ == "__main__":
    main()
