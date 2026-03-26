from fastapi import APIRouter, HTTPException, Body, Query, Depends
from typing import List, Optional, Dict
from pydantic import BaseModel
import psycopg
from db_config import get_db_connection
from services import dining_service, usda_service
import json
from datetime import datetime, timedelta

router = APIRouter(tags=["Dining"])

@router.get("/health")
def dining_health():
    return {"status": "ok", "message": "Dining router is active"}

@router.get("/hubs/{hub_id}")
def get_hub_dining(hub_id: str):
    # Normalize: "Memorial Student Center (MSC)" -> "msc", "Polo Road Garage & Rec" -> "polo"
    h = hub_id.lower()
    slug = h
    if "memorial student center" in h or "(msc)" in h: slug = "msc"
    elif "polo road" in h: slug = "polo"
    elif "underground" in h: slug = "sbisa" # Map Underground to Sbisa service
    
    data = dining_service.HUB_DATA.get(slug)
    if not data:
        raise HTTPException(status_code=404, detail=f"Hub '{hub_id}' not found (mapped to '{slug}')")
    return data

@router.get("/menus/{location}")
def get_location_menu(location: str):
    # Normalize: "Sbisa Dining Hall" -> "Sbisa"
    l = location.lower()
    hall_map = {"sbisa": "Sbisa", "commons": "Commons", "duncan": "Duncan", "creekside": "Creekside", "west campus": "West Campus", "wcf": "West Campus"}
    
    hall_key = None
    for k, v in hall_map.items():
        if k in l:
            hall_key = v
            break
    
    if not hall_key:
        hall_key = location # Fallback
        
    res = dining_service.fetch_dine_on_campus_menu(hall_key)
    if not res.get('success'):
        # Fallback to DB foods if live fetch fails
        try:
            with psycopg.connect(get_db_connection()) as conn:
                with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
                    # Case-insensitive match for the hall name
                    cur.execute("SELECT * FROM food_items WHERE (location ILIKE %s OR location ILIKE %s) AND active = TRUE", (f"%{hall_key}%", f"%{location}%"))
                    foods = cur.fetchall()
                    if foods:
                        # Clean/Enrich DB foods if they don't have macros
                        enriched = dining_service.enrich_items(foods)
                        return {"success": True, "items": enriched, "location": hall_key, "source": "database_fallback"}
        except Exception as e:
            print(f"Menu fallback error: {e}")
            
    return res


# ============================================================
# Models
# ============================================================

class UpdateDiningProfileRequest(BaseModel):
    gender: Optional[str] = None
    weight_lbs: Optional[float] = None
    height_in: Optional[float] = None
    waist_in: Optional[float] = None
    neck_in: Optional[float] = None
    hip_in: Optional[float] = None
    age: Optional[int] = None
    activity_level: Optional[str] = None
    goal_weight_lbs: Optional[float] = None
    goal_date: Optional[str] = None
    meal_split: Optional[Dict] = None

class LogMealRequest(BaseModel):
    date: str
    meal_period: str
    label: Optional[str] = None
    foods: List[Dict]
    notes: Optional[str] = None

# ============================================================
# Routes
# ============================================================

@router.get("/profile/{clerk_id}")
def get_dining_profile(clerk_id: str):
    with psycopg.connect(get_db_connection()) as conn:
        with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
            cur.execute("SELECT * FROM dining_profiles WHERE clerk_id = %s", (clerk_id,))
            profile = cur.fetchone()
            if not profile:
                raise HTTPException(status_code=404, detail="Dining profile not found")
            return profile

@router.post("/profile/{clerk_id}")
def update_dining_profile(clerk_id: str, req: UpdateDiningProfileRequest = Body(...)):
    fields = {k: v for k, v in req.dict().items() if v is not None}
    if not fields:
        return {"status": "no changes"}

    # Handle JSONB for meal_split
    if 'meal_split' in fields:
        fields['meal_split'] = json.dumps(fields['meal_split'])

    cols = ", ".join(fields.keys())
    placeholders = ", ".join(["%s"] * len(fields))
    updates = ", ".join([f"{k} = EXCLUDED.{k}" for k in fields.keys()])

    with psycopg.connect(get_db_connection()) as conn:
        with conn.cursor() as cur:
            sql = f"""
                INSERT INTO dining_profiles (clerk_id, {cols})
                VALUES (%s, {placeholders})
                ON CONFLICT (clerk_id) DO UPDATE SET {updates}, updated_at = NOW()
            """
            cur.execute(sql, [clerk_id] + list(fields.values()))
        conn.commit()
    return {"status": "success"}

@router.post("/optimize/day")
def optimize_day(
    clerk_id: str = Query(...), 
    dining_hall: str = Query("Sbisa"), 
    options: Dict = Body(...)
):
    # 1. Get Profile
    with psycopg.connect(get_db_connection()) as conn:
        with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
            cur.execute("SELECT * FROM dining_profiles WHERE clerk_id = %s", (clerk_id,))
            profile = cur.fetchone()
            if not profile:
                raise HTTPException(status_code=404, detail="Profile not set up")

            # Get latest weight
            cur.execute("SELECT weight_lbs FROM weight_log WHERE clerk_id = %s ORDER BY date DESC LIMIT 1", (clerk_id,))
            latest_w = cur.fetchone()
            current_weight = latest_w['weight_lbs'] if latest_w else profile['weight_lbs']

    # 2. Calc Targets
    cal_target = dining_service.caloric_target(profile, current_weight)
    macros = dining_service.macro_targets(current_weight, profile['activity_level'], cal_target['targetCalories'])

    # 3. Check if it's a retail location
    retail_restaurants = ["Chick-fil-A", "Panda Express", "Shake Smart", "Houston Street Subs", "Salata", "Abu Omar Halal"]
    if dining_hall in retail_restaurants:
        # For retail, we optimize for a single meal under $11
        m_target_cals = (cal_target['targetCalories'] / 3) + 200
        res = dining_service.optimize_combo(dining_hall, m_target_cals)
        meal = options.get('selected_meals', ['lunch'])[0]
        return {
            "status": "success",
            "plan": {
                meal: {
                    "calories": m_target_cals,
                    "restaurant": dining_hall,
                    "restaurantPlans": {dining_hall: res}
                }
            },
            "profile": {"targetCalories": cal_target['targetCalories'], "macros": macros}
        }

    # 4. Fetch Live Menu or DB foods for Dining Hall
    foods = []
    menu_result = dining_service.fetch_dine_on_campus_menu(dining_hall)
    if not menu_result['success']:
        # Fallback to DB foods
        with psycopg.connect(get_db_connection()) as conn:
            with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
                cur.execute("SELECT * FROM food_items WHERE location = %s AND active = TRUE", (dining_hall,))
                foods = cur.fetchall()
                # Clean/Enrich DB foods if they don't have macros
                foods = dining_service.enrich_items(foods)
    else:
        foods = menu_result['items']

    # 5. Generate plans for each selected meal
    selected_meals = options.get('selected_meals', ['breakfast', 'lunch', 'dinner'])
    include_rest = options.get('include_restaurant_alts', True)
    
    meal_plans = {}
    for m in selected_meals:
        # Split targets
        split = profile.get('meal_split', {'breakfast': 0.25, 'lunch': 0.35, 'dinner': 0.4})
        if isinstance(split, str): split = json.loads(split)
        
        fraction = split.get(m, 0.33)
        m_target_cals = cal_target['targetCalories'] * fraction
        
        # Filter foods by meal period if available
        m_foods = [f for f in foods if f.get('meal_period') in [m, 'all']]
        if not m_foods: m_foods = foods # Fallback
        
        variants = dining_service.generate_variants(m_foods, m_target_cals, macros)
        
        rest_plans = {}
        if include_rest:
            for r_name in dining_service.RESTAURANTS.keys():
                # For alternate restaurants, we also use the optimized combo logic
                # to ensure we give a valid $11 option if possible
                rest_plans[r_name] = dining_service.optimize_combo(r_name, m_target_cals)

        meal_plans[m] = {
            "calories": m_target_cals,
            "variants": variants,
            "restaurantPlans": rest_plans
        }

    return {
        "success": True,
        "plan": meal_plans,
        "profile": {
            "targetCalories": cal_target['targetCalories'],
            "macros": macros,
            "mode": cal_target['mode']
        },
        "liveMenu": {"fetched": menu_result['success'], "count": len(foods), "hall": dining_hall}
    }

@router.post("/optimize/combo")
def optimize_retail_combo(clerk_id: str = Query(...), dining_hall: str = Query(...)):
    # 1. Get Profile
    with psycopg.connect(get_db_connection()) as conn:
        with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
            cur.execute("SELECT * FROM dining_profiles WHERE clerk_id = %s", (clerk_id,))
            prof = cur.fetchone()
            if not prof:
                raise HTTPException(status_code=404, detail="Profile not found")
            
            # Get latest weight
            cur.execute("SELECT weight_lbs FROM weight_log WHERE clerk_id = %s ORDER BY date DESC LIMIT 1", (clerk_id,))
            latest_w = cur.fetchone()
            current_weight = latest_w['weight_lbs'] if latest_w else prof['weight_lbs']
            
            targets = dining_service.caloric_target(prof, current_weight)
            
    # Target 1/3 of daily calories + some buffer
    target_cal = (targets['targetCalories'] / 3) + 200
    res = dining_service.optimize_combo(dining_hall, target_cal)
    return {"status": "success", "result": res}


@router.post("/tracker/{clerk_id}")
def log_meal(clerk_id: str, req: LogMealRequest = Body(...)):
    totals = dining_service.compute_totals(req.foods)
    with psycopg.connect(get_db_connection()) as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO meal_log (clerk_id, date, meal_period, label, foods_json, calories, protein, carbs, fat, fiber, sodium, potassium, calcium, iron, vitamin_c, vitamin_d, magnesium, notes)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                clerk_id, req.date, req.meal_period, req.label, json.dumps(req.foods),
                totals['calories'], totals['protein'], totals['carbs'], totals['fat'], totals['fiber'],
                totals['sodium'], totals['potassium'], totals['calcium'], totals['iron'],
                totals['vitamin_c'], totals['vitamin_d'], totals['magnesium'], req.notes
            ))
        conn.commit()
    return {"status": "success"}

@router.delete("/tracker/{clerk_id}/{meal_id}")
def delete_meal(clerk_id: str, meal_id: int):
    with psycopg.connect(get_db_connection()) as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM meal_log WHERE clerk_id = %s AND id = %s", (clerk_id, meal_id))
        conn.commit()
    return {"status": "success"}

@router.get("/foods")
def search_foods(q: str = Query(""), source: str = Query("all")):
    results = []
    
    # 1. DB Search
    with psycopg.connect(get_db_connection()) as conn:
        with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
            cur.execute("""
                SELECT * FROM food_items 
                WHERE name ILIKE %s OR location ILIKE %s 
                LIMIT 20
            """, (f"%{q}%", f"%{q}%"))
            results.extend(cur.fetchall())

    # 2. USDA search if source is all or usda
    if source in ["all", "usda"] and len(q) > 2:
        usda_results = usda_service.search_usda(q)
        for u in usda_results:
            results.append({
                "id": f"usda-{u['fdcId']}",
                "name": u['name'],
                "location": u.get('brand') or u.get('dataType') or 'USDA',
                "calories": u['nutrients'].get('calories', 0),
                "protein": u['nutrients'].get('protein', 0),
                "carbs": u['nutrients'].get('carbs', 0),
                "fat": u['nutrients'].get('fat', 0),
                "source": "usda"
            })

    return results

@router.get("/swipes/{clerk_id}")
def get_swipes(clerk_id: str):
    with psycopg.connect(get_db_connection()) as conn:
        with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
            cur.execute("SELECT * FROM swipe_log WHERE clerk_id = %s ORDER BY date DESC", (clerk_id,))
            rows = cur.fetchall()
            
            # Simple week calc
            today = datetime.now().date()
            start_of_week = today - timedelta(days=today.weekday())
            used_this_week = sum(1 for r in rows if r['date'] >= start_of_week)
            
            return {
                "swipes": [{"id": r['id'], "date": str(r['date']), "restaurant": r['restaurant'], "total_cost": float(r['total_cost'] or 0)} for r in rows],
                "usedThisWeek": used_this_week,
                "remaining": max(0, 7 - used_this_week),
                "todayUsed": sum(1 for r in rows if r['date'] == today)
            }

@router.post("/swipes/{clerk_id}")
def log_swipe(clerk_id: str, entry: Dict = Body(...)):
    with psycopg.connect(get_db_connection()) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO swipe_log (clerk_id, date, restaurant, total_cost) VALUES (%s, %s, %s, %s)",
                (clerk_id, entry['date'], entry['restaurant'], entry.get('total_cost', 0))
            )
        conn.commit()
    return {"status": "success"}

@router.delete("/swipes/{clerk_id}/{swipe_id}")
def delete_swipe(clerk_id: str, swipe_id: int):
    with psycopg.connect(get_db_connection()) as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM swipe_log WHERE clerk_id = %s AND id = %s", (clerk_id, swipe_id))
        conn.commit()
    return {"status": "success"}

@router.get("/history/{clerk_id}")
def get_history(clerk_id: str, days: int = 30):
    with psycopg.connect(get_db_connection()) as conn:
        with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
            cur.execute("""
                SELECT date, SUM(calories) as calories, SUM(protein) as protein, SUM(carbs) as carbs, SUM(fat) as fat
                FROM meal_log 
                WHERE clerk_id = %s 
                GROUP BY date 
                ORDER BY date DESC 
                LIMIT %s
            """, (clerk_id, days))
            rows = cur.fetchall()
            return [{"date": str(r['date']), "calories": float(r['calories']), "protein": float(r['protein']), "carbs": float(r['carbs']), "fat": float(r['fat'])} for r in rows]

@router.get("/tracker/{clerk_id}")
def get_tracker(clerk_id: str, date: str = Query(None)):
    if not date:
        date = datetime.now().strftime('%Y-%m-%d')

    with psycopg.connect(get_db_connection()) as conn:
        with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
            cur.execute("SELECT * FROM meal_log WHERE clerk_id = %s AND date = %s", (clerk_id, date))
            entries = cur.fetchall()

            # Sum totals
            totals = {k: 0.0 for k in ['calories','protein','carbs','fat','fiber','sodium']}
            for e in entries:
                for k in totals:
                    totals[k] += (float(e.get(k) or 0))
    return {"date": date, "entries": entries, "totals": totals}

@router.get("/weights/{clerk_id}")
def get_weights(clerk_id: str):
    with psycopg.connect(get_db_connection()) as conn:
        with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
            cur.execute("SELECT date, weight_lbs FROM weight_log WHERE clerk_id = %s ORDER BY date ASC", (clerk_id,))
            rows = cur.fetchall()
            return [{"date": str(r['date']), "weight_lbs": float(r['weight_lbs'])} for r in rows]

@router.post("/weights/{clerk_id}")
def log_weight(clerk_id: str, entry: Dict = Body(...)):
    with psycopg.connect(get_db_connection()) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO weight_log (clerk_id, date, weight_lbs) VALUES (%s, %s, %s) ON CONFLICT (clerk_id, date) DO UPDATE SET weight_lbs = EXCLUDED.weight_lbs",
                (clerk_id, entry['date'], entry['weight_lbs'])
            )
        conn.commit()
    return {"status": "success"}

@router.delete("/weights/{clerk_id}/{date}")
def delete_weight(clerk_id: str, date: str):
    with psycopg.connect(get_db_connection()) as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM weight_log WHERE clerk_id = %s AND date = %s", (clerk_id, date))
        conn.commit()
    return {"status": "success"}

@router.get("/weight-stats/{clerk_id}")
def get_weight_stats(clerk_id: str):
    with psycopg.connect(get_db_connection()) as conn:
        with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
            cur.execute("SELECT weight_lbs FROM weight_log WHERE clerk_id = %s ORDER BY date DESC LIMIT 2", (clerk_id,))
            rows = cur.fetchall()
            
            # Get goal from profile
            cur.execute("SELECT weight_lbs as goal FROM dining_profiles WHERE clerk_id = %s", (clerk_id,))
            prof = cur.fetchone()
            goal = float(prof['goal']) if prof else None

            if not rows:
                return {"currentWeight": 0, "goalWeight": goal, "totalChange": 0}
            
            current = float(rows[0]['weight_lbs'])
            prev = float(rows[1]['weight_lbs']) if len(rows) > 1 else current
            
            return {
                "currentWeight": current,
                "goalWeight": goal,
                "totalChange": current - prev
            }
