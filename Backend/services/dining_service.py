import math
import requests
import psycopg
from typing import Optional, Dict, List, Any
from pulp import LpMaximize, LpProblem, LpVariable, lpSum, value as pulp_value, PULP_CBC_CMD
from datetime import datetime
from db_config import get_db_connection

def get_db_conn():
    return psycopg.connect(get_db_connection())

RESTAURANTS = {
    'Chick-fil-A': {'fullName': 'Chick-Fil-A - MSC Food Court', 'apiId': None},
    'Panda Express': {'fullName': 'Panda Express - MSC', 'apiId': None},
    'Shake Smart': {'fullName': 'Shake Smart - MSC', 'apiId': None},
    'Houston Street Subs': {'fullName': 'Houston Street Subs - MSC', 'apiId': None},
    'Salata': {'fullName': 'Salata', 'apiId': None},
    'Abu Omar Halal': {'fullName': 'Abu Omar Halal - MSC', 'apiId': None},
    '1876 Burgers': {'fullName': '1876 Burgers - Sbisa Complex', 'apiId': None},
    "Rev's American Grill": {'fullName': "Rev's American Grill - MSC", 'apiId': None},
    'Cabo Grill': {'fullName': 'Cabo Grill - MSC', 'apiId': None},
    "Spin 'N Stone Pizza": {'fullName': "Spin 'N Stone Pizza - MSC", 'apiId': None},
    'Smoothie King': {'fullName': 'Smoothie King - Sbisa Underground Food Court', 'apiId': None},
    "Copperhead Jack's": {'fullName': "Copperhead Jack's - Sbisa Complex", 'apiId': None},
    'Whoop Coop': {'fullName': 'Whoop Coop', 'apiId': None},
    'Bagel Block': {'fullName': 'Bagel Block', 'apiId': None},
    'Einstein Bros. Bagels': {'fullName': 'Einstein Bros. Bagels - Sbisa Complex', 'apiId': None}
}

HEURISTICS = [
    {'kw': ['grilled chicken', 'chicken breast', 'roasted chicken', 'baked chicken', 'rotisserie'], 'p': 0.35, 'f': 0.10, 'c': 0.00},
    {'kw': ['chicken', 'turkey', 'tuna', 'salmon', 'tilapia', 'fish', 'beef', 'pork', 'steak', 'shrimp', 'lamb', 'brisket', 'sausage', 'ham', 'meatball'], 'p': 0.25, 'f': 0.15, 'c': 0.05},
    {'kw': ['egg salad', 'tuna salad', 'egg'], 'p': 0.12, 'f': 0.10, 'c': 0.02},
    {'kw': ['rice', 'fried rice'], 'p': 0.04, 'f': 0.02, 'c': 0.22},
    {'kw': ['pasta', 'noodle', 'spaghetti', 'penne', 'lo mein', 'chow mein'], 'p': 0.07, 'f': 0.05, 'c': 0.25},
    {'kw': ['bread', 'toast', 'bagel', 'roll', 'bun', 'croissant', 'tortilla', 'wrap'], 'p': 0.04, 'f': 0.02, 'c': 0.20},
    {'kw': ['salad', 'greens', 'lettuce', 'spinach', 'kale'], 'p': 0.03, 'f': 0.02, 'c': 0.05},
    {'kw': ['broccoli', 'vegetable', 'veggie'], 'p': 0.04, 'f': 0.03, 'c': 0.08},
    {'kw': ['soup', 'chili', 'stew', 'chowder', 'bolognese'], 'p': 0.08, 'f': 0.05, 'c': 0.10},
    {'kw': ['pizza'], 'p': 0.12, 'f': 0.12, 'c': 0.28},
    {'kw': ['burger', 'sandwich', 'club', 'sub', 'taco', 'burrito', 'quesadilla'], 'p': 0.14, 'f': 0.14, 'c': 0.22},
    {'kw': ['yogurt', 'cottage'], 'p': 0.10, 'f': 0.04, 'c': 0.08},
    {'kw': ['milk', 'cheese'], 'p': 0.08, 'f': 0.08, 'c': 0.06},
    {'kw': ['fruit', 'apple', 'orange', 'banana', 'berry', 'melon', 'pear'], 'p': 0.01, 'f': 0.00, 'c': 0.15},
    {'kw': ['potato', 'fries', 'wedges', 'hash'], 'p': 0.02, 'f': 0.08, 'c': 0.20},
    {'kw': ['oatmeal', 'oat', 'granola', 'cereal'], 'p': 0.05, 'f': 0.04, 'c': 0.17},
    {'kw': ['bean', 'lentil', 'chickpea', 'hummus', 'edamame', 'tofu'], 'p': 0.09, 'f': 0.04, 'c': 0.15},
    {'kw': ['cake', 'cookie', 'brownie', 'dessert', 'pie', 'muffin', 'waffle', 'pancake'], 'p': 0.03, 'f': 0.14, 'c': 0.30},
    {'kw': ['dressing', 'mayo', 'aioli', 'alfredo', 'sauce', 'gravy', 'syrup', 'oil', 'vinegar', 'seasoning'], 'p': 0.00, 'f': 0.12, 'c': 0.04},
]

CONDIMENT_KW = [
    'sauce', 'dressing', 'mayo', 'aioli', 'vinegar', 'oil', 'syrup', 'gravy',
    'seasoning', 'relish', 'mustard', 'ketchup', 'salsa', 'pesto', 'sriracha',
    'soy sauce', 'hot sauce', 'buffalo sauce',
    'shredded lettuce', 'sliced tomato', 'sliced pickle', 'sliced onion',
    'diced onion', 'diced pepper', 'chopped jalapeno', 'chopped garlic',
    'sliced mushroom', 'sliced cucumber', 'sliced bell pepper', 'sliced red onion',
    'shredded cabbage', 'shredded carrot', 'julienne', 'crouton', 'cranberries dried',
    'parmesan cheese grated', 'feta crumbled', 'cheddar cheese slice', 'pepper',
    'crushed red pepper', 'celery sticks', 'carrot sticks', 'cauliflower florets',
    'grape tomatoes', 'baby corn', 'fresh ginger', 'ginger root', 'saltine',
]

def clean_name(raw: str) -> str:
    if not raw: return ''
    import re
    name = raw.replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>').strip()
    # Concatenated description heuristic (lowerCase+UpperCase)
    match = re.search(r'([a-z])([A-Z][a-z]{3,})', name)
    if match: name = name[:match.start(1)+1]
    name = re.sub(r'\s*[-–]\s*.+$', '', name)
    name = re.sub(r'\s*\(.+', '', name)
    return name.strip()

def is_condiment(name: str, cal: float) -> bool:
    lo = clean_name(name).lower()
    if cal <= 15 and len(lo) < 30: return True
    return any(k in lo for k in CONDIMENT_KW)

def apply_heuristic(name: str, cal: float) -> Dict:
    if cal <= 0: return {'protein': 0, 'fat': 0, 'carbs': 0, 'fiber': 0, 'sodium': 0}
    lo = name.lower()
    h = next((r for r in HEURISTICS if any(k in lo for k in r['kw'])), None)
    p, f, c = (h['p'], h['f'], h['c']) if h else (0.08, 0.08, 0.15)
    return {
        'protein': round(cal * p / 4),
        'fat': round(cal * f / 9),
        'carbs': round(cal * c / 4),
        'fiber': round(cal * 0.015),
        'sodium': round(cal * 1.2)
    }

def enrich_items(raw_items: List[Dict]) -> List[Dict]:
    seen = set()
    result = []
    for it in raw_items:
        it['name'] = clean_name(it['name'])
        if not it['name'] or it['name'] in seen: continue
        if is_condiment(it['name'], it.get('calories', 0)): continue
        seen.add(it['name'])
        
        if not it.get('protein') and not it.get('carbs'):
            macros = apply_heuristic(it['name'], it.get('calories', 0))
            it.update(macros)
            it['source'] = 'live+heuristic'
        result.append(it)
    return result

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

def bmr_katch_mcardle(weight_lbs: float, bf_pct: float) -> float:
    lbm_kg = weight_lbs * 0.453592 * (1 - bf_pct / 100)
    return 370 + (21.6 * lbm_kg)

def caloric_target(profile: Dict, current_weight_lbs: float) -> Dict:
    gender = profile.get('gender') or 'male'
    height_in = float(profile.get('height_in') or 70)
    age = int(profile.get('age') or 18)
    activity_level = profile.get('activity_level') or 'moderate'
    waist_in = float(profile.get('waist_in') or 0)
    neck_in = float(profile.get('neck_in') or 0)
    hip_in = float(profile.get('hip_in') or 0)
    
    goal_weight_lbs = profile.get('goal_weight_lbs')
    goal_date_str = profile.get('goal_date')
    
    # Calculate Body Fat % if metrics available
    bf_pct = body_fat_navy(gender, waist_in, neck_in, height_in, hip_in)
    
    # Use BF for better TDEE if available (Katch-McArdle)
    if bf_pct:
        bmr = bmr_katch_mcardle(current_weight_lbs, bf_pct)
    else:
        bmr = bmr_mifflin(gender, current_weight_lbs, height_in, age)
        
    mult = ACTIVITY_MULTIPLIERS.get(activity_level, 1.55)
    tdee_val = bmr * mult
    
    # If BF is very high, maybe lower the surplus or increase deficit?
    # Keeping logic simple for now: Mifflin-St Jeor is the base.
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
        'targetCalories': max(min_cal, int(round(tdee_val - safe_deficit))),
        'TDEE': int(round(tdee_val)), 'deficitPerDay': int(round(safe_deficit)),
        'daysRemaining': days_remaining, 'weeklyLoss': round((safe_deficit * 7) / 3500, 2),
        'mode': 'cut' if weight_diff > 0 else ('bulk' if weight_diff < 0 else 'maintain'),
        'bodyFat': round(bf_pct, 1) if bf_pct else None
    }

def macro_targets(weight_lbs: float, activity_level: str, target_calories: int) -> Dict:
    prot_mult = 1.0 if activity_level in ['active', 'very_active', 'moderate'] else 0.8
    protein = round(weight_lbs * prot_mult)
    fat = round((target_calories * 0.25) / 9)
    carbs = max(50, round((target_calories - (protein * 4) - (fat * 9)) / 4))
    return {'protein': protein, 'fat': fat, 'carbs': carbs}

def optimize_diet(foods: List[Dict], targets: Dict, options: Dict = {}) -> Dict:
    usable = [f for f in foods if (f.get('calories') or 0) > 0]
    if not usable: return {"success": False, "error": "No foods with data", "items": []}
    
    cal_tgt = targets.get('calories', 2000)
    prot_tgt = targets.get('protein', 150)
    fat_tgt = targets.get('fat', 55)
    budget = targets.get('budget')
    
    prob = LpProblem("Diet", LpMaximize)
    
    # 0 to 2 servings max for retail/budget, otherwise 3
    max_serv = options.get('max_servings', 2 if budget else 3)
    vars = [LpVariable(f"x{i}", 0, max_serv, 'Integer') for i in range(len(usable))]
    
    # Objective: Maximize Protein + small bonuses for micro-dense items
    def score(f):
        return (f.get('protein', 0) or 0) * 5.0 + \
               (f.get('fiber', 0) or 0) * 2.0 + \
               (f.get('vitamin_c', 0) or 0) * 1.0 + \
               (f.get('calcium', 0) or 0) / 100.0
               
    prob += lpSum([vars[i] * score(usable[i]) for i in range(len(usable))])
    
    # Constraints
    prob += lpSum([vars[i] * usable[i]['calories'] for i in range(len(usable))]) <= cal_tgt * 1.10
    prob += lpSum([vars[i] * usable[i]['calories'] for i in range(len(usable))]) >= cal_tgt * 0.70
    
    if budget:
        prob += lpSum([vars[i] * (usable[i].get('cost', 0) or 0) for i in range(len(usable))]) <= budget
        
    try:
        prob.solve(PULP_CBC_CMD(msg=0))
    except:
        return {"success": False, "error": "Solver error", "items": []}
        
    selected = []
    for i in range(len(usable)):
        v = pulp_value(vars[i])
        if v and v >= 0.5:
            item = dict(usable[i])
            item['quantity'] = round(v)
            # Scale nutrients for display
            item['scaledNutrients'] = {
                k: round((item.get(k, 0) or 0) * v, 2) 
                for k in ['calories','protein','carbs','fat','fiber','sodium','calcium','iron','potassium','magnesium','vitamin_c','vitamin_d']
            }
            selected.append(item)
            
    if not selected:
        # Simple greedy fallback
        for f in sorted(usable, key=score, reverse=True):
            if f['calories'] <= cal_tgt and (not budget or (f.get('cost', 0) or 0) <= budget):
                item = dict(f)
                item['quantity'] = 1
                item['scaledNutrients'] = {
                    k: round((item.get(k, 0) or 0), 2)
                    for k in ['calories','protein','carbs','fat']
                }
                selected.append(item)
                break
                
    return {
        "success": len(selected) > 0, 
        "items": selected, 
        "totals": compute_totals(selected)
    }

def optimize_combo(location: str, target_cal: float, budget: float = 11.0) -> Dict:
    """Specialized optimizer for retail combos like Chick-fil-A."""
    conn = get_db_conn()
    try:
        # Using RealDictRow equivalent for psycopg (v3)
        cur = conn.cursor(row_factory=psycopg.rows.dict_row)
        cur.execute("SELECT * FROM food_items WHERE location = %s AND location_type = 'restaurant'", (location,))
        foods = cur.fetchall()
        if not foods:
            return {"success": False, "error": f"No foods found for {location}", "items": []}
        
        # Retail combos should be simple (max 2 items usually)
        return optimize_diet(foods, {"calories": target_cal, "budget": budget}, {"max_servings": 2})
    finally:
        conn.close()

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
        
        # Apply enrichment (heuristics + cleaning)
        items = enrich_items(items)
        
        return {"success": True, "items": items, "location": location_key, "date": date_str}
    except Exception as e: return {"success": False, "error": str(e)}
