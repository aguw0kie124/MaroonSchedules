from __future__ import annotations
"""
Migration script: Create dining-related tables in PostgreSQL.
Linked to 'users' table via clerk_id.
"""
import psycopg
from db_config import get_db_connection

TABLES_SQL = """
-- Dining specific profile data
CREATE TABLE IF NOT EXISTS dining_profiles (
    clerk_id         TEXT PRIMARY KEY REFERENCES users(clerk_id) ON DELETE CASCADE,
    gender           TEXT DEFAULT 'male',
    weight_lbs       REAL DEFAULT 155,
    height_in        REAL DEFAULT 70,
    waist_in         REAL DEFAULT 34,
    neck_in          REAL DEFAULT 15,
    hip_in           REAL,
    age              INTEGER DEFAULT 18,
    activity_level   TEXT DEFAULT 'moderate',
    goal_weight_lbs  REAL,
    goal_date        TEXT,
    meal_split       JSONB DEFAULT '{"breakfast": 25, "lunch": 35, "dinner": 40}'::jsonb,
    updated_at       TIMESTAMP DEFAULT NOW()
);

-- Daily weight log
CREATE TABLE IF NOT EXISTS weight_log (
    id               SERIAL PRIMARY KEY,
    clerk_id         TEXT REFERENCES users(clerk_id) ON DELETE CASCADE,
    date             DATE NOT NULL,
    weight_lbs       REAL NOT NULL,
    notes            TEXT,
    created_at       TIMESTAMP DEFAULT NOW(),
    UNIQUE(clerk_id, date)
);

-- Food/ingredient database
CREATE TABLE IF NOT EXISTS food_items (
    id               SERIAL PRIMARY KEY,
    name             TEXT NOT NULL,
    source           TEXT DEFAULT 'manual',   -- 'manual','usda','dining','restaurant'
    usda_fdc_id      INTEGER,
    location         TEXT,                    -- dining hall or restaurant name
    location_type    TEXT DEFAULT 'dining',   -- 'dining' | 'restaurant'
    meal_period      TEXT DEFAULT 'all',      -- 'breakfast','lunch','dinner','all'
    calories         REAL DEFAULT 0,
    protein          REAL DEFAULT 0,
    carbs            REAL DEFAULT 0,
    fat              REAL DEFAULT 0,
    fiber            REAL DEFAULT 0,
    sugar            REAL DEFAULT 0,
    sodium           REAL DEFAULT 0,
    potassium        REAL DEFAULT 0,
    calcium          REAL DEFAULT 0,
    iron             REAL DEFAULT 0,
    magnesium        REAL DEFAULT 0,
    zinc             REAL DEFAULT 0,
    vitamin_a        REAL DEFAULT 0,
    vitamin_c        REAL DEFAULT 0,
    vitamin_d        REAL DEFAULT 0,
    serving_label    TEXT DEFAULT '1 serving',
    serving_grams    REAL DEFAULT 100,
    cost             REAL DEFAULT 0,
    active           BOOLEAN DEFAULT TRUE,
    created_at       TIMESTAMP DEFAULT NOW()
);

-- Retail swipe usage log
CREATE TABLE IF NOT EXISTS swipe_log (
    id               SERIAL PRIMARY KEY,
    clerk_id         TEXT REFERENCES users(clerk_id) ON DELETE CASCADE,
    date             DATE NOT NULL,
    restaurant       TEXT NOT NULL,
    items            JSONB DEFAULT '[]'::jsonb, -- Array of {name, cost}
    total_cost       REAL,
    created_at       TIMESTAMP DEFAULT NOW()
);

-- Saved meal plans
CREATE TABLE IF NOT EXISTS meal_plans (
    id               SERIAL PRIMARY KEY,
    clerk_id         TEXT REFERENCES users(clerk_id) ON DELETE CASCADE,
    date             DATE NOT NULL,
    meal_type        TEXT NOT NULL, -- e.g. 'full_day'
    plan_json        JSONB NOT NULL,
    total_calories   REAL,
    total_protein    REAL,
    total_carbs      REAL,
    total_fat        REAL,
    notes            TEXT,
    created_at       TIMESTAMP DEFAULT NOW()
);

-- Meal tracker log (what was actually eaten)
CREATE TABLE IF NOT EXISTS meal_log (
    id               SERIAL PRIMARY KEY,
    clerk_id         TEXT REFERENCES users(clerk_id) ON DELETE CASCADE,
    date             DATE NOT NULL,
    meal_period      TEXT NOT NULL DEFAULT 'other',
    label            TEXT,
    foods_json       JSONB NOT NULL DEFAULT '[]'::jsonb,
    calories         REAL DEFAULT 0,
    protein          REAL DEFAULT 0,
    carbs            REAL DEFAULT 0,
    fat              REAL DEFAULT 0,
    fiber            REAL DEFAULT 0,
    sodium           REAL DEFAULT 0,
    potassium        REAL DEFAULT 0,
    calcium          REAL DEFAULT 0,
    iron             REAL DEFAULT 0,
    vitamin_c        REAL DEFAULT 0,
    vitamin_d        REAL DEFAULT 0,
    magnesium        REAL DEFAULT 0,
    notes            TEXT,
    created_at       TIMESTAMP DEFAULT NOW()
);
"""

def main():
    print("Connecting to PostgreSQL to create dining tables...")
    try:
        with psycopg.connect(get_db_connection()) as conn:
            with conn.cursor() as cur:
                cur.execute(TABLES_SQL)
            conn.commit()
        print("✓ Dining tables created successfully.")
    except Exception as e:
        print(f"❌ Error creating tables: {e}")

if __name__ == "__main__":
    main()
