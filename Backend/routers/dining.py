from fastapi import APIRouter, HTTPException, Body, Query, Depends
from typing import List, Optional, Dict
from pydantic import BaseModel, Field
import psycopg
from db_config import CONNECTION_PARAMS, get_pool
from services import dining_service
from auth.clerk_middleware import require_auth, ensure_matching_user
import json
from datetime import datetime, timedelta

from rate_limit import limiter
from fastapi import Request
from models.base import SanitizedBaseModel

router = APIRouter(prefix="/dining", tags=["Dining"])
public_router = APIRouter(prefix="/dining", tags=["Dining"])

@public_router.get("/health")
def dining_health():
    return {"status": "ok", "message": "Dining router is active"}


# ============================================================
# Models
# ============================================================

class UpdateDiningProfileRequest(SanitizedBaseModel):
    gender: Optional[str] = Field(default=None, max_length=20)
    weight_lbs: Optional[float] = None
    height_in: Optional[float] = None
    waist_in: Optional[float] = None
    neck_in: Optional[float] = None
    hip_in: Optional[float] = None
    age: Optional[int] = None
    activity_level: Optional[str] = Field(default=None, max_length=50)
    goal_weight_lbs: Optional[float] = None
    goal_date: Optional[str] = Field(default=None, max_length=20)
    meal_split: Optional[Dict] = None

class LogMealRequest(SanitizedBaseModel):
    date: str
    meal_period: str
    label: Optional[str] = None
    foods: List[Dict]
    notes: Optional[str] = None


def require_clerk_user(clerk_id: str, user_id: str = Depends(require_auth)) -> str:
    return ensure_matching_user(user_id, clerk_id, detail="You can only access your own dining data")

# ============================================================
# Routes
# ============================================================

@router.get("/profile/{clerk_id}")
@limiter.limit("60/minute")
def get_dining_profile(request: Request, clerk_id: str, _auth_user_id: str = Depends(require_clerk_user)):
    with get_pool().connection() as conn:
        with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
            cur.execute("SELECT * FROM dining_profiles WHERE clerk_id = %s", (clerk_id,))
            profile = cur.fetchone()
            if not profile:
                # Auto-initialize default profile
                cur.execute("""
                    INSERT INTO dining_profiles (clerk_id, gender, weight_lbs, height_in, activity_level, mode, target_calories)
                    VALUES (%s, 'male', 150, 70, 'moderate', 'maintain', 2000)
                    RETURNING *
                """, (clerk_id,))
                profile = cur.fetchone()
                conn.commit()
            
            # Recalculate live macro targets instead of just sending the raw static row
            cur.execute("SELECT weight_lbs FROM weight_log WHERE clerk_id = %s ORDER BY date DESC LIMIT 1", (clerk_id,))
            latest_w = cur.fetchone()
            current_weight = latest_w['weight_lbs'] if latest_w and latest_w['weight_lbs'] else (profile['weight_lbs'] or 150)
            cal_target = dining_service.caloric_target(profile, current_weight)
            macros = dining_service.macro_targets(current_weight, profile['activity_level'], cal_target['targetCalories'])
            
            # Attach live values
            profile['targetCalories'] = cal_target['targetCalories']
            profile['macros'] = macros
            profile['mode'] = cal_target['mode']
            profile['bodyFat'] = cal_target.get('bodyFat')

            return profile

@router.post("/profile/{clerk_id}")
@limiter.limit("10/minute")
def update_dining_profile(request: Request, clerk_id: str, req: UpdateDiningProfileRequest = Body(...), _auth_user_id: str = Depends(require_clerk_user)):
    fields = {k: v for k, v in req.dict().items() if v is not None}
    if not fields:
        return {"status": "no changes"}

    # Handle JSONB for meal_split
    if 'meal_split' in fields:
        fields['meal_split'] = json.dumps(fields['meal_split'])

    cols = ", ".join(fields.keys())
    placeholders = ", ".join(["%s"] * len(fields))
    updates = ", ".join([f"{k} = EXCLUDED.{k}" for k in fields.keys()])

    with get_pool().connection() as conn:
        with conn.cursor() as cur:
            sql = f"""
                INSERT INTO dining_profiles (clerk_id, {cols})
                VALUES (%s, {placeholders})
                ON CONFLICT (clerk_id) DO UPDATE SET {updates}, updated_at = NOW()
            """
            cur.execute(sql, [clerk_id] + list(fields.values()))
        conn.commit()
    return {"status": "success"}


@public_router.get("/full-menu")
@limiter.limit("60/minute")
def get_full_menu(
    request: Request,
    location: str = Query(...),
    meal_period: str = Query("lunch"),
    date: Optional[str] = Query(None),
    force_refresh: bool = Query(False),
):
    result = dining_service.get_full_menu(
        location_name=location,
        meal_period=meal_period,
        date_str=date,
        force_refresh=force_refresh,
    )
    if not result.get("success"):
        return {
            "success": False,
            "location": location,
            "mealPeriod": meal_period,
            "categories": [],
            "count": 0,
            "source": result.get("source", "database"),
            "locations": result.get("locations", []),
            "message": "No menu items available for that selection.",
        }
    return result

@router.post("/optimize/day")
@limiter.limit("5/minute")
def optimize_day(
    request: Request,
    clerk_id: str = Query(...), 
    dining_hall: str = Query("Sbisa"), 
    options: Dict = Body(...),
    _auth_user_id: str = Depends(require_clerk_user),
):
    # 1. Get Profile
    with get_pool().connection() as conn:
        with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
            cur.execute("SELECT * FROM dining_profiles WHERE clerk_id = %s", (clerk_id,))
            profile = cur.fetchone()
            if not profile:
                cur.execute("""
                    INSERT INTO dining_profiles (clerk_id, gender, weight_lbs, height_in, activity_level, mode, target_calories)
                    VALUES (%s, 'male', 150, 70, 'moderate', 'maintain', 2000)
                    RETURNING *
                """, (clerk_id,))
                profile = cur.fetchone()
                conn.commit()

            cur.execute("SELECT weight_lbs FROM weight_log WHERE clerk_id = %s ORDER BY date DESC LIMIT 1", (clerk_id,))
            latest_w = cur.fetchone()
            current_weight = latest_w['weight_lbs'] if latest_w and latest_w['weight_lbs'] else (profile['weight_lbs'] or 150)

    # 2. Calc Targets
    cal_target = dining_service.caloric_target(profile, current_weight)
    macros = dining_service.macro_targets(current_weight, profile['activity_level'], cal_target['targetCalories'])

    # 3. Dynamic Reapportionment Logic
    selected_meals = options.get('selected_meals', ['breakfast', 'lunch', 'dinner'])
    if not selected_meals:
        selected_meals = ['lunch']
    
    # Base split from profile or default
    split = profile.get('meal_split') or {'breakfast': 25, 'lunch': 35, 'dinner': 40}
    if isinstance(split, str):
        split = json.loads(split)
    
    # Calculate absolute daily fractions
    total_split_sum = sum(split.values()) or 100
    meal_fractions = {}
    for m in selected_meals:
        meal_fractions[m] = split.get(m, 33.3) / total_split_sum

    # 4. Fetch ALL foods for this dining hall (all periods)
    all_foods = []
    menu_result = {"success": False}
    
    # Try fetching each period from the live API for dining halls
    is_dining_hall = any(dining_hall.lower() in k.lower() for k in dining_service.DINING_LOCATIONS if 'Hall' in k)
    
    if is_dining_hall:
        # For dining halls, try to get foods for each requested period
        for m in selected_meals:
            res = dining_service.fetch_dine_on_campus_menu(dining_hall, meal_period=m)
            if res.get('success') and res.get('items'):
                menu_result = {"success": True}
                for item in res['items']:
                    item['meal_period'] = m  # tag with actual period
                all_foods.extend(res['items'])
    
    # If live fetch failed or returned nothing, fall back to DB
    if not all_foods:
        with get_pool().connection() as conn:
            with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
                cur.execute("""
                    SELECT * FROM food_items 
                    WHERE (location = %s OR location ILIKE %s) 
                    AND location_type = 'dining'
                    AND active = TRUE
                """, (dining_hall, f"%{dining_hall}%"))
                all_foods = [dict(r) for r in cur.fetchall()]
                if all_foods:
                    menu_result = {"success": True}

    # 5. Generate plans for each selected meal
    include_rest = options.get('include_restaurant_alts', True)
    meal_plans = {}
    
    for m in selected_meals:
        m_target_cals = cal_target['targetCalories'] * meal_fractions[m]
        
        # FIX: Use period-aware filtering that includes every-day items
        m_foods = dining_service.items_for_period(all_foods, m)
        
        # If still no items, try DB with period aliases
        if not m_foods:
            aliases = dining_service.PERIOD_ALIASES.get(m, [m])
            try:
                with get_pool().connection() as conn:
                    with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
                        placeholders = ','.join(['%s'] * len(aliases))
                        cur.execute(f"""
                            SELECT * FROM food_items 
                            WHERE (location = %s OR location ILIKE %s) 
                            AND location_type = 'dining'
                            AND meal_period IN ({placeholders})
                            AND active = TRUE
                        """, [dining_hall, f"%{dining_hall}%"] + aliases)
                        m_foods = [dict(r) for r in cur.fetchall()]
            except:
                pass
        
        variants = []
        if m_foods:
            variants = dining_service.generate_variants(m_foods, m_target_cals, macros)
        
        # Restaurant alternatives
        rest_plans = {}
        if include_rest:
            for brand, locations in dining_service.RESTAURANT_GROUPS.items():
                best_loc_res = None
                best_diff = float('inf')
                for loc in locations:
                    res = dining_service.optimize_combo(loc, m_target_cals)
                    if res.get('success') and res.get('items'):
                        diff = abs(res['totals']['calories'] - m_target_cals)
                        if diff < best_diff:
                            best_diff = diff
                            best_loc_res = res
                            best_loc_res['location'] = loc
                
                if best_loc_res and best_loc_res.get('items'):
                    # Find the highest-calorie item as the "top pick" / what to order
                    top_item = max(best_loc_res['items'], key=lambda x: x.get('calories', 0))
                    rest_plans[brand] = {
                        "success": True,
                        "location": best_loc_res['location'],
                        "locations": locations,  # ALL locations for this brand
                        "topPick": top_item['name'],
                        "totals": best_loc_res['totals'],
                        "items": best_loc_res['items']
                    }
                else:
                    rest_plans[brand] = {"success": False, "error": "No valid combo found", "locations": locations}

        meal_plans[m] = {
            "calories": round(m_target_cals),
            "variants": variants,
            "restaurantPlans": rest_plans
        }

    return {
        "success": True,
        "plan": meal_plans,
        "profile": {
            "targetCalories": cal_target['targetCalories'],
            "macros": macros,
            "mode": cal_target['mode'],
            "meal_split": split
        },
        "liveMenu": {"fetched": menu_result.get('success', False), "count": len(all_foods), "hall": dining_hall}
    }

class OptimizeComboRequest(SanitizedBaseModel):
    meal_period: str = "lunch"

@router.post("/optimize/combo")
@limiter.limit("10/minute")
def optimize_retail_combo(request: Request, req: OptimizeComboRequest, clerk_id: str = Query(...), dining_hall: str = Query(...), _auth_user_id: str = Depends(require_clerk_user)):
    # 1. Get Profile
    with get_pool().connection() as conn:
        with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
            cur.execute("SELECT * FROM dining_profiles WHERE clerk_id = %s", (clerk_id,))
            prof = cur.fetchone()
            if not prof:
                cur.execute("""
                    INSERT INTO dining_profiles (clerk_id, gender, weight_lbs, height_in, activity_level, mode, target_calories)
                    VALUES (%s, 'male', 150, 70, 'moderate', 'maintain', 2000)
                    RETURNING *
                """, (clerk_id,))
                prof = cur.fetchone()
                conn.commit()
            
            # Get latest weight
            cur.execute("SELECT weight_lbs FROM weight_log WHERE clerk_id = %s ORDER BY date DESC LIMIT 1", (clerk_id,))
            latest_w = cur.fetchone()
            current_weight = latest_w['weight_lbs'] if latest_w and latest_w['weight_lbs'] else (prof['weight_lbs'] or 150)
            
            targets = dining_service.caloric_target(prof, current_weight)
            
    # Match logic from optimize_day exactly: use the exact meal split
    split = {"breakfast": 0.25, "lunch": 0.35, "dinner": 0.40}
    m = req.meal_period.lower()
    target_cal = targets['targetCalories'] * split.get(m, 0.35)
    
    brand = dining_hall
    locations = dining_service.RESTAURANT_GROUPS.get(brand, [brand])
    
    best_loc_res = None
    best_diff = float('inf')
    for loc in locations:
        res = dining_service.optimize_combo(loc, target_cal)
        if res.get('success') and res.get('items'):
            diff = abs(res['totals']['calories'] - target_cal)
            if diff < best_diff:
                best_diff = diff
                best_loc_res = res
                best_loc_res['location'] = loc

    if best_loc_res and best_loc_res.get('items'):
        top_item = max(best_loc_res['items'], key=lambda x: x.get('calories', 0))
        final_res = {
            "success": True,
            "location": best_loc_res['location'],
            "locations": locations,
            "topPick": top_item['name'],
            "totals": best_loc_res['totals'],
            "items": best_loc_res['items']
        }
    else:
        final_res = {"success": False, "error": "No valid combo found", "locations": locations}

    return {"status": "success", "result": final_res}


@router.post("/tracker/{clerk_id}")
@limiter.limit("30/minute")
def log_meal(request: Request, clerk_id: str, req: LogMealRequest = Body(...), _auth_user_id: str = Depends(require_clerk_user)):
    print(f"[Dining] Logging meal for {clerk_id} on {req.date}: {req.label}")
    print(f"[Dining] Foods in request: {req.foods}")
    totals = dining_service.compute_totals(req.foods)
    print(f"[Dining] Computed totals: {totals}")
    with get_pool().connection() as conn:
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
@limiter.limit("30/minute")
def delete_meal(request: Request, clerk_id: str, meal_id: int, _auth_user_id: str = Depends(require_clerk_user)):
    with get_pool().connection() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM meal_log WHERE clerk_id = %s AND id = %s", (clerk_id, meal_id))
        conn.commit()
    return {"status": "success"}

@router.get("/foods")
@limiter.limit("60/minute")
def search_foods(request: Request, q: str = Query(""), source: str = Query("all")):
    results = []
    
    # 1. DB Search
    with get_pool().connection() as conn:
        with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
            cur.execute("""
                SELECT * FROM food_items 
                WHERE name ILIKE %s OR location ILIKE %s 
                LIMIT 20
            """, (f"%{q}%", f"%{q}%"))
            results.extend(cur.fetchall())

    return results

@router.get("/swipes/{clerk_id}")
@limiter.limit("60/minute")
def get_swipes(request: Request, clerk_id: str, date: Optional[str] = Query(None), _auth_user_id: str = Depends(require_clerk_user)):
    with get_pool().connection() as conn:
        with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
            cur.execute("SELECT * FROM swipe_log WHERE clerk_id = %s ORDER BY date DESC", (clerk_id,))
            rows = cur.fetchall()
            
            # Simple week calc
            if date:
                try:
                    today = datetime.strptime(date, '%Y-%m-%d').date()
                except:
                    today = datetime.now().date()
            else:
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
def log_swipe(clerk_id: str, entry: Dict = Body(...), _auth_user_id: str = Depends(require_clerk_user)):
    with get_pool().connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO swipe_log (clerk_id, date, restaurant, total_cost) VALUES (%s, %s, %s, %s)",
                (clerk_id, entry['date'], entry['restaurant'], entry.get('total_cost', 0))
            )
        conn.commit()
    return {"status": "success"}

@router.delete("/swipes/{clerk_id}/{swipe_id}")
def delete_swipe(clerk_id: str, swipe_id: int, _auth_user_id: str = Depends(require_clerk_user)):
    with get_pool().connection() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM swipe_log WHERE clerk_id = %s AND id = %s", (clerk_id, swipe_id))
        conn.commit()
    return {"status": "success"}

@router.get("/history/{clerk_id}")
@limiter.limit("60/minute")
def get_history(request: Request, clerk_id: str, days: int = 30, _auth_user_id: str = Depends(require_clerk_user)):
    with get_pool().connection() as conn:
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
@limiter.limit("60/minute")
def get_tracker(request: Request, clerk_id: str, date: str = Query(None), _auth_user_id: str = Depends(require_clerk_user)):
    if not date:
        date = datetime.now().strftime('%Y-%m-%d')

    print(f"[Dining] Fetching tracker for {clerk_id} on {date}")
    with get_pool().connection() as conn:
        with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
            cur.execute("SELECT * FROM meal_log WHERE clerk_id = %s AND date = %s", (clerk_id, date))
            entries = cur.fetchall()
            print(f"[Dining] Found {len(entries)} entries for {date}")

            # Sum totals
            totals = {k: 0.0 for k in ['calories','protein','carbs','fat','fiber','sodium','potassium','calcium','iron','vitamin_c','vitamin_d','magnesium']}
            for e in entries:
                for k in totals:
                    val = e.get(k)
                    if val is not None:
                        totals[k] += float(val)

    print(f"[Dining] Final totals for response: {totals}")
    return {"date": date, "entries": entries, "totals": totals}

@router.get("/weights/{clerk_id}")
@limiter.limit("60/minute")
def get_weights(request: Request, clerk_id: str, _auth_user_id: str = Depends(require_clerk_user)):
    with get_pool().connection() as conn:
        with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
            cur.execute("SELECT date, weight_lbs FROM weight_log WHERE clerk_id = %s ORDER BY date ASC", (clerk_id,))
            rows = cur.fetchall()
            return [{"date": str(r['date']), "weight_lbs": float(r['weight_lbs'])} for r in rows]

@router.post("/weights/{clerk_id}")
@limiter.limit("30/minute")
def log_weight(request: Request, clerk_id: str, entry: Dict = Body(...), _auth_user_id: str = Depends(require_clerk_user)):
    with get_pool().connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO weight_log (clerk_id, date, weight_lbs) VALUES (%s, %s, %s) ON CONFLICT (clerk_id, date) DO UPDATE SET weight_lbs = EXCLUDED.weight_lbs",
                (clerk_id, entry['date'], entry['weight_lbs'])
            )
        conn.commit()
    return {"status": "success"}

@router.delete("/weights/{clerk_id}/{date}")
def delete_weight(clerk_id: str, date: str, _auth_user_id: str = Depends(require_clerk_user)):
    with get_pool().connection() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM weight_log WHERE clerk_id = %s AND date = %s", (clerk_id, date))
        conn.commit()
    return {"status": "success"}

@router.get("/weight-stats/{clerk_id}")
@limiter.limit("60/minute")
def get_weight_stats(request: Request, clerk_id: str, _auth_user_id: str = Depends(require_clerk_user)):
    with get_pool().connection() as conn:
        with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
            cur.execute("SELECT weight_lbs FROM weight_log WHERE clerk_id = %s ORDER BY date DESC LIMIT 2", (clerk_id,))
            rows = cur.fetchall()
            
            # Get goal from profile
            cur.execute("SELECT goal_weight_lbs, goal_date FROM dining_profiles WHERE clerk_id = %s", (clerk_id,))
            prof = cur.fetchone()
            goal = float(prof['goal_weight_lbs']) if prof and prof.get('goal_weight_lbs') else None
            goal_date = prof['goal_date'] if prof else None

            if not rows:
                return {"currentWeight": 0, "goalWeight": goal, "goalDate": goal_date, "totalChange": 0}
            
            current = float(rows[0]['weight_lbs'])
            prev = float(rows[1]['weight_lbs']) if len(rows) > 1 else current
            
            return {
                "currentWeight": current,
                "goalWeight": goal,
                "goalDate": goal_date,
                "totalChange": current - prev
            }

@router.get("/hubs/{location_id}")
@limiter.limit("60/minute")
def get_hub_restaurants(request: Request, location_id: str):
    hubs = {
        "Memorial Student Center": ["Chick-fil-A", "Panda Express", "Rev's American Grill", "Cabo Grill", "Abu Omar Halal", "Spin 'N Stone Pizza", "Houston Street Subs", "Shake Smart"],
        "Polo Road Garage Dining": ["Panda Express", "Houston Street Subs", "Shake Smart", "Salata", "Bagel Block"],
        "Underground Food Court": ["Chick-fil-A", "Houston Street Subs", "Pizza @ Underground", "Smoothie King", "1876 Burgers"],
        "West Campus Food Hall": ["Chick-fil-A", "Houston Street Subs", "Copperhead Jack's"],
        "Sbisa Complex": ["Copperhead Jack's", "1876 Burgers", "Einstein Bros. Bagels"]
    }
    for key, val in hubs.items():
        if location_id.lower() in key.lower():
            return {"restaurants": val}
    
    return {"restaurants": []}

@router.get("/menus/{location_id}")
def get_location_menu(location_id: str):
    return {"items": []}
