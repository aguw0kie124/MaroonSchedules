import math
import requests
import psycopg2
import psycopg2.extras
from datetime import datetime
from typing import Optional, Dict, List, Any
from pulp import LpMaximize, LpProblem, LpVariable, lpSum, value as pulp_value, PULP_CBC_CMD

# DB Credentials (hardcoded for now to ensure consistency with migration script)
DB_HOST = "10.246.145.251"
DB_NAME = "maroon_schedules"
DB_USER = "dev_rian"
DB_PASS = "admin"

def get_db_conn():
    return psycopg2.connect(host=DB_HOST, database=DB_NAME, user=DB_USER, password=DB_PASS)

RESTAURANTS = {
    'Chick-fil-A': {},
    'Panda Express': {},
    'Shake Smart': {},
    'Houston Street Subs': {},
    'Einstein Bros. Bagels': {},
    'Abu Omar Halal': {},
    'Salata': {},
    '1876 Burgers': {},
    "Rev's American Grill": {},
    'Cabo Grill': {},
    "Spin 'N Stone Pizza": {},
    'Smoothie King': {},
    "Copperhead Jack's": {},
    'Whoop Coop': {},
    'Bagel Block': {}
}

def body_fat_navy(gender: str, waist_in: float, neck_in: float, height_in: float, hip_in: Optional[float] = None) -> Optional[float]:
    if not waist_in or not neck_in or not height_in: return None
    if gender == 'male':
        val = 86.01 * math.log10(waist_in - neck_in) - 70.041 * math.log10(height_in) + 36.76
        return max(2.0, min(60.0, val))
    else:
        if not hip_in: return None
        val = 163.205 * math.log10(waist_in + hip_in - neck_in) - 97.684 * math.log10(height_in) - 78.387
        return max(8.0, min(60.0, val))

def lean_body_mass(weight_lbs: float, bf_pct: float) -> float:
    return weight_lbs * (1 - bf_pct / 100)

def bmr_mifflin(gender: str, weight_lbs: float, height_in: float, age: int) -> float:
    weight_kg = weight_lbs * 0.453592
    height_cm = height_in * 2.54
    base = 10 * weight_kg + 6.25 * height_cm - 5 * age
    return base + 5 if gender == 'male' else base - 161

ACTIVITY_MULTIPLIERS = {'sedentary': 1.2, 'light': 1.375, 'moderate': 1.55, 'active': 1.725, 'very_active': 1.9}

def tdee(gender: str, weight_lbs: float, height_in: float, age: int, activity_level: str) -> float:
    bmr = bmr_mifflin(gender, weight_lbs, height_in, age)
    mult = ACTIVITY_MULTIPLIERS.get(activity_level, 1.55)
    return bmr * mult

def caloric_target(profile: Dict, current_weight_lbs: float) -> Dict:
    gender, height_in, age = profile.get('gender', 'male'), profile.get('height_in', 70), profile.get('age', 18)
    activity_level = profile.get('activity_level', 'moderate')
    goal_weight_lbs, goal_date_str = profile.get('goal_weight_lbs'), profile.get('goal_date')
    tdee_val = tdee(gender, current_weight_lbs, height_in, age, activity_level)
    if not goal_weight_lbs or not goal_date_str:
        return {'targetCalories': round(tdee_val), 'deficitPerDay': 0, 'daysRemaining': None, 'weeklyLoss': 0, 'mode': 'maintain', 'TDEE': round(tdee_val)}
    try:
        goal_date = datetime.strptime(goal_date_str, '%Y-%m-%d')
        days_remaining = max(1, (goal_date - datetime.now()).days)
    except: days_remaining = 1
    weight_diff = current_weight_lbs - goal_weight_lbs
    deficit_per_day = (weight_diff * 3500) / days_remaining
    min_cal = 1500 if gender == 'male' else 1200
    safe_deficit = min(deficit_per_day, min(1000.0, tdee_val - min_cal))
    return {
        'targetCalories': max(min_cal, round(tdee_val - safe_deficit)),
        'TDEE': round(tdee_val), 'deficitPerDay': round(safe_deficit),
        'daysRemaining': days_remaining, 'weeklyLoss': round((safe_deficit * 7) / 3500, 2),
        'mode': 'cut' if weight_diff > 0 else ('bulk' if weight_diff < 0 else 'maintain')
    }

def macro_targets(weight_lbs: float, activity_level: str, target_calories: int) -> Dict:
    prot_mult = 1.0 if activity_level in ['active', 'very_active', 'moderate'] else 0.8
    protein = round(weight_lbs * prot_mult)
    fat = round((target_calories * 0.25) / 9)
    carbs = max(50, round((target_calories - (protein * 4) - (fat * 9)) / 4))
    return {'protein': protein, 'fat': fat, 'carbs': carbs}

def optimize_diet(foods: List[Dict], targets: Dict, options: Dict = {}) -> Dict:
    usable = [f for f in foods if (f.get('calories') or 0) > 0]
    if not usable: return {"success": False, "error": "No data", "items": []}
    cal_tgt, prot_tgt, fat_tgt = targets.get('calories', 2000), targets.get('protein', 150), targets.get('fat', 55)
    budget = targets.get('budget')
    max_serv = 1 if budget else 3
    prob = LpProblem("Diet", LpMaximize)
    vars = [LpVariable(f"x{i}", 0, max_serv, 'Integer') for i in range(len(usable))]
    def score(f):
        return (f.get('protein', 0) or 0) * 5.0 + (f.get('fiber', 0) or 0) * 2.0 + (f.get('vitamin_c', 0) or 0) * 1.0
    prob += lpSum([vars[i] * score(usable[i]) for i in range(len(usable))])
    prob += lpSum([vars[i] * usable[i]['calories'] for i in range(len(usable))]) <= cal_tgt * 1.05
    prob += lpSum([vars[i] * usable[i]['calories'] for i in range(len(usable))]) >= cal_tgt * 0.8
    if budget: prob += lpSum([vars[i] * usable[i].get('cost', 0) for i in range(len(usable))]) <= budget
    try: prob.solve(PULP_CBC_CMD(msg=0))
    except: return {"success": False, "error": "Solver error", "items": []}
    selected = []
    for i in range(len(usable)):
        v = pulp_value(vars[i])
        if v and v >= 0.5:
            item = dict(usable[i]); item['quantity'] = round(v)
            item['scaledNutrients'] = {k: round((item.get(k,0) or 0)*v, 2) for k in ['calories','protein','carbs','fat']}
            selected.append(item)
    if not selected: # Greedy fallback
        for f in sorted(usable, key=score, reverse=True):
            if f['calories'] <= cal_tgt:
                item = dict(f); item['quantity'] = 1; selected.append(item); break
    return {"success": len(selected)>0, "items": selected, "totals": compute_totals(selected)}

def generate_variants(foods: List[Dict], target_cals: float, targets: Dict):
    res = []
    for lbl, emo, mult in [("Balanced", "🍱", 1.0), ("High Protein", "🥩", 1.2), ("Light", "🥗", 0.7)]:
        opt = optimize_diet(foods, {**targets, "calories": target_cals * mult})
        if opt['success']: res.append({**opt, "label": lbl, "emoji": emo})
    return res

def compute_totals(foods: List[Dict]) -> Dict:
    keys = ['calories','protein','carbs','fat','fiber','sodium','potassium','calcium','iron','magnesium','vitamin_c','vitamin_d','cost']
    totals = {k: 0.0 for k in keys}
    for f in foods:
        q = f.get('quantity', 1)
        for k in keys: totals[k] += (f.get(k, 0) or 0) * q
    return {k: round(v, 2) for k, v in totals.items()}

def get_restaurant_plan(location: str, target_cal: float):
    conn = get_db_conn(); cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("SELECT * FROM food_items WHERE location = %s AND location_type = 'restaurant'", (location,))
    foods = cur.fetchall(); cur.close(); conn.close()
    if not foods: return None
    return optimize_diet(foods, {"calories": target_cal, "budget": 11.0})

def fetch_dine_on_campus_menu(location_key: str, date_str: str = None) -> Dict:
    if not date_str: date_str = datetime.now().strftime('%Y-%m-%d')
    IDS = {'Sbisa': '5d113eed4198d40d488a46ee', 'Commons': '5d113eed4198d40d488a46f2', 'Duncan': '5d113eed4198d40d488a46f3'}
    api_id = IDS.get(location_key)
    if not api_id: return {"success": False, "error": "Unknown hall"}
    try:
        data = requests.get(f"https://api.dineoncampus.com/v1/location/{api_id}/menu", params={"platform": 0, "date": date_str}, timeout=10).json()
        items = []
        def extract(obj, mp='all'):
            if isinstance(obj, list):
                for el in obj: extract(el, mp)
            elif isinstance(obj, dict):
                name = obj.get('name') or obj.get('item_name')
                if name and (obj.get('nutrients') or 'calories' in obj):
                    n = obj.get('nutrients', {}) or obj
                    items.append({"name": name.strip(), "meal_period": mp, "calories": float(n.get('calories', 0) or 0), "protein": float(n.get('protein', 0) or 0), "carbs": float(n.get('carbs', 0) or 0), "fat": float(n.get('fat', 0) or 0), "source": "dineoncampus"})
                if 'periods' in obj:
                    for p in obj['periods']:
                        pn = (p.get('name') or '').lower()
                        extract(p, 'breakfast' if 'breakfast' in pn else ('lunch' if 'lunch' in pn else ('dinner' if 'dinner' in pn else 'all')))
                for k in ['categories', 'items', 'menu']:
                    if k in obj: extract(obj[k], mp)
        extract(data.get('menu', {}))
        return {"success": True, "items": items, "location": location_key, "date": date_str}
    except Exception as e: return {"success": False, "error": str(e)}
