import sys
import os
import json
import psycopg
from datetime import datetime
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from db_config import get_db_connection

# Removed hardcoded credentials

def migrate():
    # Enriched seed data from db.js
    seed_foods = [
        # Sbisa
        {"name": "Scrambled Eggs", "source": "manual", "location": "Sbisa", "location_type": "dining", "meal_period": "breakfast", "calories": 140, "protein": 10, "carbs": 2, "fat": 10, "fiber": 0, "sodium": 250, "calcium": 80, "iron": 1.5, "vitamin_c": 0, "cost": 0},
        {"name": "Oatmeal", "source": "manual", "location": "Sbisa", "location_type": "dining", "meal_period": "breakfast", "calories": 150, "protein": 5, "carbs": 27, "fat": 3, "fiber": 4, "sodium": 0, "calcium": 20, "iron": 2, "vitamin_c": 0, "cost": 0},
        {"name": "Grilled Chicken Breast", "source": "manual", "location": "Sbisa", "location_type": "dining", "meal_period": "lunch", "calories": 165, "protein": 31, "carbs": 0, "fat": 3.6, "fiber": 0, "sodium": 74, "calcium": 15, "iron": 1, "vitamin_c": 0, "cost": 0},
        {"name": "Brown Rice", "source": "manual", "location": "Sbisa", "location_type": "dining", "meal_period": "lunch", "calories": 215, "protein": 5, "carbs": 44, "fat": 2, "fiber": 4, "sodium": 10, "calcium": 20, "iron": 1, "vitamin_c": 0, "cost": 0},
        {"name": "Grilled Salmon", "source": "manual", "location": "Sbisa", "location_type": "dining", "meal_period": "dinner", "calories": 208, "protein": 28, "carbs": 0, "fat": 10, "fiber": 0, "sodium": 59, "calcium": 15, "iron": 0.4, "vitamin_c": 0, "cost": 0},
        
        # Retail - Chick-fil-A
        {"name": "Grilled Chicken Sandwich", "source": "manual", "location": "Chick-fil-A", "location_type": "restaurant", "meal_period": "all", "calories": 380, "protein": 28, "carbs": 40, "fat": 7, "fiber": 3, "sodium": 820, "calcium": 60, "iron": 2, "vitamin_c": 2, "cost": 5.49},
        {"name": "8ct Chick-fil-A Nuggets", "source": "manual", "location": "Chick-fil-A", "location_type": "restaurant", "meal_period": "all", "calories": 260, "protein": 26, "carbs": 12, "fat": 12, "fiber": 0, "sodium": 810, "calcium": 20, "iron": 1, "vitamin_c": 0, "cost": 4.49},
        {"name": "Waffle Fries Medium", "source": "manual", "location": "Chick-fil-A", "location_type": "restaurant", "meal_period": "all", "calories": 420, "protein": 5, "carbs": 52, "fat": 21, "fiber": 5, "sodium": 280, "calcium": 30, "iron": 1.5, "vitamin_c": 6, "cost": 3.29},
        
        # Panda Express
        {"name": "Grilled Teriyaki Chicken", "source": "manual", "location": "Panda Express", "location_type": "restaurant", "meal_period": "all", "calories": 275, "protein": 36, "carbs": 8, "fat": 12, "fiber": 0, "sodium": 530, "calcium": 30, "iron": 1.5, "vitamin_c": 2, "cost": 2.50},
        {"name": "Original Orange Chicken", "source": "manual", "location": "Panda Express", "location_type": "restaurant", "meal_period": "all", "calories": 510, "protein": 26, "carbs": 51, "fat": 23, "fiber": 1, "sodium": 820, "calcium": 40, "iron": 2.5, "vitamin_c": 2, "cost": 2.50},
        {"name": "Bowl: Teriyaki Chicken + Chow Mein", "source": "manual", "location": "Panda Express", "location_type": "restaurant", "meal_period": "all", "calories": 875, "protein": 49, "carbs": 95, "fat": 34, "fiber": 6, "sodium": 1390, "calcium": 90, "iron": 4.5, "vitamin_c": 8, "cost": 9.20},
        
        # Shake Smart
        {"name": "Chocolate Frosty", "source": "manual", "location": "Shake Smart", "location_type": "restaurant", "meal_period": "all", "calories": 260, "protein": 30, "carbs": 30, "fat": 2, "fiber": 1, "sodium": 210, "calcium": 380, "iron": 1, "vitamin_c": 0, "cost": 8.50},
        {"name": "BBQ Turkey Wrap", "source": "manual", "location": "Shake Smart", "location_type": "restaurant", "meal_period": "all", "calories": 492, "protein": 35, "carbs": 52, "fat": 14, "fiber": 5, "sodium": 1050, "calcium": 80, "iron": 3, "vitamin_c": 8, "cost": 9.50},
        
        # Houston Street Subs
        {"name": "Aggie Club Sub", "source": "manual", "location": "Houston Street Subs", "location_type": "restaurant", "meal_period": "all", "calories": 550, "protein": 36, "carbs": 50, "fat": 20, "fiber": 3, "sodium": 1550, "calcium": 120, "iron": 3.5, "vitamin_c": 8, "cost": 9.49},
        
        # Abu Omar Halal
        {"name": "Chicken Rice Bowl", "source": "manual", "location": "Abu Omar Halal", "location_type": "restaurant", "meal_period": "all", "calories": 650, "protein": 42, "carbs": 74, "fat": 16, "fiber": 3, "sodium": 980, "calcium": 60, "iron": 3, "vitamin_c": 5, "cost": 9.99},
        
        # Salata
        {"name": "Salata Custom Salad", "source": "manual", "location": "Salata", "location_type": "restaurant", "meal_period": "all", "calories": 380, "protein": 32, "carbs": 20, "fat": 18, "fiber": 8, "sodium": 680, "calcium": 150, "iron": 3, "vitamin_c": 35, "cost": 10.99},
    ]

    # Micronutrients backfill (condensed)
    micros = [
        {"name": "Scrambled Eggs", "potassium": 138, "magnesium": 12, "vitamin_d": 1.1},
        {"name": "Oatmeal", "potassium": 143, "magnesium": 56, "vitamin_d": 0},
        {"name": "Grilled Chicken Breast", "potassium": 358, "magnesium": 29, "vitamin_d": 0.1},
        {"name": "Grilled Salmon", "potassium": 534, "magnesium": 34, "vitamin_d": 11.1},
        {"name": "Grilled Chicken Sandwich", "potassium": 490, "magnesium": 38, "vitamin_d": 0.1},
        {"name": "Grilled Teriyaki Chicken", "potassium": 510, "magnesium": 38, "vitamin_d": 0.1},
    ]

    conn = psycopg.connect(get_db_connection())
    cur = conn.cursor()

    print(f"Migrating {len(seed_foods)} food items...")
    
    for f in seed_foods:
        # Check if exists
        cur.execute("SELECT id FROM food_items WHERE name = %s AND location = %s", (f['name'], f['location']))
        if cur.fetchone():
            continue
            
        cur.execute("""
            INSERT INTO food_items (
                name, source, location, location_type, meal_period, 
                calories, protein, carbs, fat, fiber, sodium, calcium, iron, vitamin_c, cost
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            f['name'], f['source'], f['location'], f['location_type'], f['meal_period'],
            f['calories'], f['protein'], f['carbs'], f['fat'], f.get('fiber', 0), 
            f.get('sodium', 0), f.get('calcium', 0), f.get('iron', 0), f.get('vitamin_c', 0), f['cost']
        ))

    print(f"Applying micronutrients for {len(micros)} items...")
    for m in micros:
        cur.execute("""
            UPDATE food_items 
            SET potassium = %s, magnesium = %s, vitamin_d = %s 
            WHERE name = %s
        """, (m['potassium'], m['magnesium'], m['vitamin_d'], m['name']))

    conn.commit()
    cur.close()
    conn.close()
    print("Migration complete!")

if __name__ == "__main__":
    migrate()
