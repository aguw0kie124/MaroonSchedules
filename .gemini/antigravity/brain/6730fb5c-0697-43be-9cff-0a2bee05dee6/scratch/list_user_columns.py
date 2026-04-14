import os
import sys
from dotenv import load_dotenv

sys.path.append(os.getcwd())
load_dotenv(".env")

from db_config import get_pool

def list_columns():
    with get_pool().connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'users'
            """)
            cols = [r[0] for r in cur.fetchall()]
            print("Columns in 'users' table:")
            for c in cols:
                print(f" - {c}")

if __name__ == "__main__":
    list_columns()
