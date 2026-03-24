"""
Migration script: SQLite (Aggie-Diet) -> PostgreSQL (MaroonSchedules)
"""
import sqlite3
import psycopg
import json
from db_config import get_db_connection

SQLITE_PATH = r'C:/ShreyaanDietApp/backend_food/diet.db'

def migrate():
    print(f"Opening SQLite database at {SQLITE_PATH}...")
    sl_conn = sqlite3.connect(SQLITE_PATH)
    sl_conn.row_factory = sqlite3.Row
    sl_cur = sl_conn.cursor()

    print("Connecting to PostgreSQL...")
    with psycopg.connect(get_db_connection()) as pg_conn:
        with pg_conn.cursor() as pg_cur:
            # 1. Get first user in Postgres to map data to
            pg_cur.execute("SELECT clerk_id FROM users LIMIT 1")
            user_row = pg_cur.fetchone()
            if not user_row:
                print("❌ No users found in PostgreSQL. Run App/Sync user first.")
                return
            clerk_id = user_row[0]
            print(f"✓ Mapping data to user: {clerk_id}")

            # 2. Migrate Profile
            sl_cur.execute("SELECT * FROM profile WHERE id = 1")
            p = sl_cur.fetchone()
            if p:
                pg_cur.execute("""
                    INSERT INTO dining_profiles (clerk_id, gender, weight_lbs, height_in, waist_in, neck_in, hip_in, age, activity_level, goal_weight_lbs, goal_date)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (clerk_id) DO UPDATE SET
                    gender = EXCLUDED.gender, weight_lbs = EXCLUDED.weight_lbs, height_in = EXCLUDED.height_in,
                    waist_in = EXCLUDED.waist_in, neck_in = EXCLUDED.neck_in, hip_in = EXCLUDED.hip_in,
                    age = EXCLUDED.age, activity_level = EXCLUDED.activity_level,
                    goal_weight_lbs = EXCLUDED.goal_weight_lbs, goal_date = EXCLUDED.goal_date
                """, (clerk_id, p['gender'], p['weight_lbs'], p['height_in'], p['waist_in'], p['neck_in'], p['hip_in'], p['age'], p['activity_level'], p['goal_weight_lbs'], p['goal_date']))

            # 3. Migrate Weight Log
            sl_cur.execute("SELECT * FROM weight_log")
            for row in sl_cur.fetchall():
                pg_cur.execute("""
                    INSERT INTO weight_log (clerk_id, date, weight_lbs, notes)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (clerk_id, date) DO NOTHING
                """, (clerk_id, row['date'], row['weight_lbs'], row['notes']))

            # 4. Migrate Foods
            sl_cur.execute("SELECT * FROM foods")
            for row in sl_cur.fetchall():
                pg_cur.execute("""
                    INSERT INTO food_items (name, source, usda_fdc_id, location, location_type, meal_period, calories, protein, carbs, fat, fiber, sugar, sodium, potassium, calcium, iron, magnesium, zinc, vitamin_a, vitamin_c, vitamin_d, serving_label, serving_grams, cost, active)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (row['name'], row['source'], row['usda_fdc_id'], row['location'], row['location_type'], row['meal_period'], row['calories'], row['protein'], row['carbs'], row['fat'], row['fiber'], row['sugar'], row['sodium'], row['potassium'], row['calcium'], row['iron'], row['magnesium'], row['zinc'], row['vitamin_a'], row['vitamin_c'], row['vitamin_d'], row['serving_label'], row['serving_grams'], row['cost'], bool(row['active'])))

            # 5. Migrate Swipes
            sl_cur.execute("SELECT * FROM swipe_log")
            for row in sl_cur.fetchall():
                pg_cur.execute("""
                    INSERT INTO swipe_log (clerk_id, date, restaurant, items, total_cost)
                    VALUES (%s, %s, %s, %s, %s)
                """, (clerk_id, row['date'], row['restaurant'], row['items'], row['total_cost']))

            # 6. Migrate Meal Plans
            sl_cur.execute("SELECT * FROM meal_plans")
            for row in sl_cur.fetchall():
                pg_cur.execute("""
                    INSERT INTO meal_plans (clerk_id, date, meal_type, plan_json, total_calories, total_protein, total_carbs, total_fat, notes)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (clerk_id, row['date'], row['meal_type'], row['plan_json'], row['total_calories'], row['total_protein'], row['total_carbs'], row['total_fat'], row['notes']))

            # 7. Migrate Meal Log
            sl_cur.execute("SELECT * FROM meal_log")
            for row in sl_cur.fetchall():
                pg_cur.execute("""
                    INSERT INTO meal_log (clerk_id, date, meal_period, label, foods_json, calories, protein, carbs, fat, fiber, sodium, potassium, calcium, iron, vitamin_c, vitamin_d, magnesium, notes)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (clerk_id, row['date'], row['meal_period'], row['label'], row['foods_json'], row['calories'], row['protein'], row['carbs'], row['fat'], row['fiber'], row['sodium'], row['potassium'], row['calcium'], row['iron'], row['vitamin_c'], row['vitamin_d'], row['magnesium'], row['notes']))

        pg_conn.commit()
    print("✓ Migration complete.")

if __name__ == "__main__":
    migrate()
