import psycopg
from db_config import CONNECTION_PARAMS

def migrate():
    print("Cleaning duplicates correctly for UUIDs and Migrating post_interactions...")
    try:
        with psycopg.connect(CONNECTION_PARAMS) as conn:
            with conn.cursor() as cur:
                # 1. Clean duplicates: keep only the latest like per user per post (UUID safe)
                cur.execute("""
                    DELETE FROM post_interactions 
                    WHERE id IN (
                        SELECT id FROM (
                            SELECT id, ROW_NUMBER() OVER (
                                PARTITION BY post_id, user_id, type 
                                ORDER BY created_at DESC
                            ) as row_num
                            FROM post_interactions 
                            WHERE type = 'like'
                        ) t
                        WHERE t.row_num > 1
                    )
                """)
                rows_deleted = cur.rowcount
                print(f"✅ Cleaned {rows_deleted} duplicate likes")
                
                # 2. Add unique constraint for likes
                cur.execute("""
                    CREATE UNIQUE INDEX IF NOT EXISTS unique_user_likes_idx 
                    ON post_interactions (post_id, user_id, type) 
                    WHERE type = 'like'
                """)
                conn.commit()
                print("✅ UNIQUE Likes Migration Successful")
    except Exception as e:
        print(f"❌ Migration Failed: {e}")

if __name__ == "__main__":
    migrate()
