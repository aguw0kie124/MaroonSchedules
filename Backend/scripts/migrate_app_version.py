import psycopg
import sys
import os

# Add the parent directory (Backend) to sys.path so we can import db_config
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db_config import get_pool

def migrate_app_version():
    pool = get_pool()
    
    try:
        with pool.connection() as conn:
            with conn.cursor() as cur:
                # 1. Create table
                print("Creating app_version_config table...")
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS app_version_config (
                        platform VARCHAR(20) PRIMARY KEY,
                        latest_version VARCHAR(20) NOT NULL,
                        minimum_supported_version VARCHAR(20) NOT NULL,
                        store_url TEXT NOT NULL,
                        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
                    );
                """)
                
                # 2. Seed data for iOS
                print("Seeding iOS config...")
                cur.execute("""
                    INSERT INTO app_version_config 
                    (platform, latest_version, minimum_supported_version, store_url)
                    VALUES 
                    ('ios', '2.0.0', '1.0.0', 'https://apps.apple.com/app/id6761646764')
                    ON CONFLICT (platform) DO UPDATE SET
                        latest_version = EXCLUDED.latest_version,
                        minimum_supported_version = EXCLUDED.minimum_supported_version,
                        store_url = EXCLUDED.store_url,
                        updated_at = NOW();
                """)
                
                # 3. Seed data for Android
                print("Seeding Android config...")
                cur.execute("""
                    INSERT INTO app_version_config 
                    (platform, latest_version, minimum_supported_version, store_url)
                    VALUES 
                    ('android', '2.0.0', '1.0.0', '')
                    ON CONFLICT (platform) DO UPDATE SET
                        latest_version = EXCLUDED.latest_version,
                        minimum_supported_version = EXCLUDED.minimum_supported_version,
                        store_url = EXCLUDED.store_url,
                        updated_at = NOW();
                """)
                
            conn.commit()
            print("Migration completed successfully.")
            
    except Exception as e:
        print(f"Error during migration: {e}")
        raise
    finally:
        pool.close()

if __name__ == "__main__":
    migrate_app_version()
