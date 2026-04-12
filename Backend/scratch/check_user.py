from __future__ import annotations
import psycopg
from db_config import CONNECTION_PARAMS

def check_user_admin(clerk_id):
    try:
        with psycopg.connect(CONNECTION_PARAMS) as conn:
            with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
                cur.execute("SELECT clerk_id, email, is_admin FROM users WHERE clerk_id = %s", (clerk_id,))
                row = cur.fetchone()
                if row:
                    print(f"User: {row['clerk_id']} | Email: {row['email']} | Is Admin: {row['is_admin']}")
                else:
                    print(f"User {clerk_id} not found in DB.")
    except Exception as e:
        print(f"Error checking DB: {e}")

if __name__ == "__main__":
    check_user_admin("user_3C9dY3jYG20CbqsOOuTGdni9PCe")
