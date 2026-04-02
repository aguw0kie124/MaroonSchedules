import psycopg
from db_config import CONNECTION_PARAMS

def migrate():
    print("Connecting to database...")
    with psycopg.connect(CONNECTION_PARAMS) as conn:
        with conn.cursor() as cur:
            # Check for existing columns
            cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'users'")
            columns = [row[0] for row in cur.fetchall()]
            
            # Add tos_accepted if missing
            if 'tos_accepted' not in columns:
                print("Adding column 'tos_accepted'...")
                cur.execute("ALTER TABLE users ADD COLUMN tos_accepted BOOLEAN DEFAULT FALSE")
            else:
                print("Column 'tos_accepted' already exists.")
                
            # Add tour_completed if missing
            if 'tour_completed' not in columns:
                print("Adding column 'tour_completed'...")
                cur.execute("ALTER TABLE users ADD COLUMN tour_completed BOOLEAN DEFAULT FALSE")
            else:
                print("Column 'tour_completed' already exists.")
                
            conn.commit()
            print("Migration complete!")

if __name__ == "__main__":
    try:
        migrate()
    except Exception as e:
        print(f"Error during migration: {e}")
