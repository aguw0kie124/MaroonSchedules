import math
import re
import requests
import psycopg
import psycopg.rows
from typing import Optional, Dict, List, Any
from pulp import LpMaximize, LpProblem, LpVariable, lpSum, value as pulp_value, PULP_CBC_CMD
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from db_config import get_db_connection, get_pool
from services import cache_service

CENTRAL_TZ = ZoneInfo("America/Chicago")
DINING_MENU_ERROR_TTL_SECONDS = 600

def get_db_conn():
    return get_pool().connection()

def init_db():
    conn = get_db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS food_items (
                    id SERIAL PRIMARY KEY,
                    name TEXT NOT NULL,
                    location TEXT NOT NULL,
                    location_type TEXT NOT NULL,
                    calories FLOAT DEFAULT 0,
                    protein FLOAT DEFAULT 0,
                    fat FLOAT DEFAULT 0,
                    carbs FLOAT DEFAULT 0,
                    usda_calories FLOAT,
                    cost FLOAT DEFAULT 0,
                    meal_period TEXT NOT NULL,
                    date DATE NOT NULL,
                    active BOOLEAN DEFAULT TRUE,
                    UNIQUE(name, location, meal_period, date)
                );
            """)
            conn.commit()
    finally:
        conn.close()

# Full mapping of TAMU DineOnCampus locations to their API IDs
DINING_LOCATIONS = {
    "The Commons Dining Hall (South Campus)": "59972586ee596fe55d2eef75",
    "The Commons Dining Hall": "59972586ee596fe55d2eef75",
    "Sbisa Dining Hall (North Campus)": "587909deee596f31cedc179c",
    "Sbisa Dining Hall": "587909deee596f31cedc179c",
    "Duncan Dining Hall (South Campus/Quad)": "5878eb5cee596f847636f114",
    "Duncan Dining Hall": "5878eb5cee596f847636f114",
    "1876 Burgers - Sbisa Complex": "5873c5f43191a200e44eba43",
    "Chick-Fil-A - Sbisa Underground Food Court": "586d0bf1ee596f6e75049512",
    "Copperhead Jack's - Sbisa Complex": "5c9a291319e02b0c4cd18d87",
    "Einstein Bros. Bagels - Sbisa Complex": "586e7f19ee596f4034e1f5d0",
    "Houston Street Subs - Underground Food Court": "586e7f19ee596f4034e1f5ce",
    "Bagel Block": "5c9a291319e02b0c4cd18d86",
    "Pizza @ Underground": "5873c5f33191a200e44eba3c",
    "Smoothie King - Sbisa Underground Food Court": "5873c5f43191a200e44eba47",
    "Abu Omar Halal - MSC": "5f1700190101560a2e15d9f3",
    "Cabo Grill - MSC": "5873c5f33191a200e44eba41",
    "Chick-Fil-A - MSC Food Court": "5f04e0800101560bba2e7ee1",
    "Houston Street Subs - MSC": "5f04e0800101560bba2e7ee0",
    "ILCB Food Truck": "64f0f349351d530701884ace",
    "Market at Lamar St.": "5f22e7950101560acf6ccd69",
    "Panda Express - MSC": "586d0bf1ee596f6e75049513",
    "Rev's American Grill - MSC": "5873c5f43191a200e44eba45",
    "Starbucks Coffee - Evans Library": "5873c5f43191a200e44eba44",
    "Shake Smart - MSC": "5873c5f33191a200e44eba42",
    "Spin 'N Stone Pizza - MSC": "5f173025bf31720a562fbde4",
    "Whoop Coop": "596f8aecee596f3d85c8afe3",
    "Starbucks Coffee - The Quad": "5873c5f43191a200e44eba4b",
    "Houston Street Subs - Southside": "5a81e92c74cebf0aba555f09",
    "Azimuth Cafe - Langford": "586e7f6fee596f402be1f66f",
    "Houston Street Subs - Polo Garage": "5ff345be5e42ad12fd7ec506",
    "Panda Express - Polo Garage": "5ff34e653a585b113c081c17",
    "Salata": "5ff34f9a3a585b1145e16abd",
    "Shake Smart - Polo Garage": "5fce607131d1ee1d1f856db1",
    "Starbucks Coffee - Zachry": "5b520de41178e90996681ef0",
    "Reynolds and Reynolds Cafe": "677c318cc625af0726676202",
    "ILSQ Food Truck": "6787e0c6e45d4305db9c02ad",
    "Chick-fil-A - West Campus Food Hall": "586d0bf1ee596f6e75049511",
    "Copperhead Jack's - West Campus Food Hall": "61df33dbb63f1e11e3db4c97",
    "Spin n' Stone Pizza - Creekside Market": "69763b88841457a6d573612d",
    "Health Science Center Cafe": "586e9bdaee596f4034e2007a",
    "Houston Street Deli - RELLIS": "62fd0c1fc625af082f64291e",
    "Houston Street Subs - West Campus Food Hall": "5a296153f56b7af7401398be",
    "Shake Smart- Rec Center": "5873c5f43191a200e44eba46",
    "The 41st Club - Bush Library": "58653dc82cc8da820e58aca9",
    "Vet Med Cafe": "591c65b8ee596f0ff3feea1f"
}

# Bundling map for retail restaurants
RESTAURANT_GROUPS = {
    "Chick-fil-A": ["Chick-Fil-A - Sbisa Underground Food Court", "Chick-Fil-A - MSC Food Court", "Chick-fil-A - West Campus Food Hall"],
    "Panda Express": ["Panda Express - MSC", "Panda Express - Polo Garage"],
    "Shake Smart": ["Shake Smart - MSC", "Shake Smart - Polo Garage", "Shake Smart- Rec Center"],
    "Houston Street Subs": ["Houston Street Subs - Underground Food Court", "Houston Street Subs - MSC", "Houston Street Subs - Southside", "Houston Street Subs - Polo Garage", "Houston Street Subs - West Campus Food Hall"],
    "Starbucks": ["Starbucks Coffee - Evans Library", "Starbucks Coffee - The Quad", "Starbucks Coffee - Zachry"],
    "Copperhead Jack's": ["Copperhead Jack's - Sbisa Complex", "Copperhead Jack's - West Campus Food Hall"],
    "Spin 'N Stone Pizza": ["Spin 'N Stone Pizza - MSC", "Spin n' Stone Pizza - Creekside Market"],
    "Abu Omar Halal": ["Abu Omar Halal - MSC"],
    "Cabo Grill": ["Cabo Grill - MSC"],
    "Rev's American Grill": ["Rev's American Grill - MSC"],
    "Whoop Coop": ["Whoop Coop"],
    "1876 Burgers": ["1876 Burgers - Sbisa Complex"],
    "Einstein Bros. Bagels": ["Einstein Bros. Bagels - Sbisa Complex"],
    "Pizza @ Underground": ["Pizza @ Underground"],
    "Smoothie King": ["Smoothie King - Sbisa Underground Food Court"],
    "Bagel Block": ["Bagel Block"],
    "Salata": ["Salata"],
    "Azimuth Cafe": ["Azimuth Cafe - Langford"],
    "Market at Lamar St.": ["Market at Lamar St."],
    "Reynolds and Reynolds Cafe": ["Reynolds and Reynolds Cafe"],
}

MEAT_KWS = ['chicken', 'beef', 'pork', 'turkey', 'fish', 'shrimp', 'salmon', 'ham', 'steak', 'meatball', 'bacon', 'sausage', 'tuna', 'tilapia', 'lamb', 'brisket']

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

# ============ NAME CLEANING ============
# FIX: Previous regex was destroying names. Now we only do safe HTML entity decoding.
def clean_name(raw: str) -> str:
    if not raw:
        return ''
    name = str(raw).replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>').strip()
    return name

def is_vegetarian(name: str) -> bool:
    lo = name.lower()
    return not any(kw in lo for kw in MEAT_KWS)

def apply_heuristic(name: str, cal: float) -> Dict[str, float]:
    if cal <= 0:
        return {'protein': 0.0, 'fat': 0.0, 'carbs': 0.0, 'fiber': 0.0, 'sodium': 0.0}
    lo = name.lower()
    h = next((r for r in HEURISTICS if any(k in lo for k in r['kw'])), None)
    p_ratio = h['p'] if h else 0.08
    f_ratio = h['f'] if h else 0.08
    c_ratio = h['c'] if h else 0.15
    return {
        'protein': round(cal * p_ratio / 4),
        'fat': round(cal * f_ratio / 9),
        'carbs': round(cal * c_ratio / 4),
        'fiber': round(cal * 0.015),
        'sodium': round(cal * 1.2)
    }

def enrich_items(raw_items: List[Dict]) -> List[Dict]:
    """Clean up, deduplicate, and add light heuristics without external nutrition verification."""
    seen = set()
    result = []
    for it in raw_items:
        it['name'] = clean_name(it.get('name', ''))
        if not it['name']:
            continue
        # Deduplicate by name + location (not globally, so same item at different locations is kept)
        dedup_key = (it['name'], it.get('location', ''), it.get('meal_period', ''))
        if dedup_key in seen:
            continue
        seen.add(dedup_key)

        # Fill missing macros with heuristics
        if not it.get('protein') and not it.get('carbs'):
            cal = float(it.get('calories', 0) or 0)
            macros = apply_heuristic(it['name'], cal)
            it.update(macros)
            if 'source' not in it:
                it['source'] = 'heuristic'

        # Price heuristic for retail items
        loc = it.get('location', '')
        if 'Hall' not in loc:
            lo = it['name'].lower()
            if any(k in lo for k in ['sandwich', 'burger', 'sub', 'bowl', 'pizza', 'entree', 'halal', 'burrito', 'taco', 'wrap', 'platter', 'combo', 'meal']):
                it['cost'] = 7.00
            elif any(k in lo for k in ['side', 'fries', 'wedge', 'chips', 'bagel', 'cookie', 'muffin', 'bread', 'salad']):
                it['cost'] = 3.00
            elif any(k in lo for k in ['drink', 'soda', 'tea', 'water', 'shake', 'smoothie', 'coffee', 'espresso', 'lemonade']):
                it['cost'] = 2.00
            else:
                it['cost'] = 3.50
        else:
            it['cost'] = 0  # Dining hall meals are covered by swipe

        result.append(it)
    return result


# ============ OPTIMIZATION ============

def optimize_diet(foods: List[Dict], targets: Dict, options: Dict = {}) -> Dict[str, Any]:
    """Linear programming optimizer for meal selection."""
    usable = list(foods)  # copy
    if options.get('vegetarian'):
        usable = [f for f in usable if is_vegetarian(f['name'])]

    if not usable:
        return {"success": False, "error": "No foods available", "items": [], "totals": {}}

    cal_tgt = targets.get('calories', 700)
    has_budget = bool(targets.get('budget'))
    prob = LpProblem("Diet", LpMaximize)
    max_serv = options.get('max_servings', 1 if has_budget else 2)
    x_vars = [LpVariable(f"x{i}", 0, max_serv, 'Integer') for i in range(len(usable))]

    # Objective: prioritize protein and micronutrients (Vit C, Mag, Pot)
    def get_weight(f):
        cal = f.get('calories', 0) or 0
        if cal < 1:
            return 0.001
            
        prot = f.get('protein', 0) or 0
        fiber = f.get('fiber', 0) or 0
        vit_c = f.get('vitamin_c', 0) or 0
        mag = f.get('magnesium', 0) or 0
        pot = f.get('potassium', 0) or 0
        sodium = f.get('sodium', 0) or 0
        
        # Dynamic protein multiplier based on diet goal
        prot_mult = 10
        if options.get('high_protein'):
            prot_mult = 20
        elif options.get('balanced'):
            prot_mult = 15
        elif options.get('cut'):
            prot_mult = 12
            
        w = prot * prot_mult + fiber * 10
        w += (vit_c / 20) * 40
        w += (mag / 40) * 100   # Balanced Magnesium weighting (supportive, not dominant)
        w += (pot / 500) * 40
        
        # Deduct weight for sodium (soft penalty)
        w -= (sodium / 100) * 10
        
        if options.get('high_protein'):
            w += prot * 10
            
        return w

    prob += lpSum([x_vars[i] * get_weight(usable[i]) for i in range(len(usable))]) - 0.5 * lpSum(x_vars)

    # Calorie constraints
    cal_sum = lpSum([x_vars[i] * (usable[i].get('calories', 0) or 0) for i in range(len(usable))])
    # For retail, allow a much higher ceiling (300%) since they are fixed massive combos
    # For dining halls, keep 110% to ensure sensible portioning
    cal_ceiling = 3.0 if has_budget else 1.10
    prob += cal_sum <= cal_tgt * cal_ceiling

    # FIX: For retail/budget plans, use a much lower floor (10%) since menus are limited under $11
    # For dining halls, keep 80%
    cal_floor = 0.10 if has_budget else 0.80
    prob += cal_sum >= cal_tgt * cal_floor


    # Budget constraint for retail
    if has_budget:
        prob += lpSum([x_vars[i] * (usable[i].get('cost', 0) or 0) for i in range(len(usable))]) <= targets['budget']

    # Max items total for realism (3 for retail, 6 for dining halls)
    max_items = options.get('max_items', 6)
    prob += lpSum(x_vars) <= max_items

    try:
        prob.solve(PULP_CBC_CMD(msg=0))
    except Exception:
        pass

    selected = []
    if prob.status == 1:
        for i in range(len(usable)):
            v = pulp_value(x_vars[i])
            if v and v >= 0.5:
                item = dict(usable[i])
                item['quantity'] = round(v)
                item['scaledNutrients'] = {
                    k: round(float(item.get(k, 0) or 0) * v, 2)
                    for k in ['calories', 'protein', 'carbs', 'fat']
                }
                selected.append(item)

    # GREEDY FALLBACK: If solver failed or returned nothing, pick the best item in budget
    if not selected:
        for f in sorted(usable, key=get_weight, reverse=True):
            # Pick a single item that fits the budget (allow up to 4x calorie target for retail swipes)
            if (not has_budget or (f.get('cost', 0) or 0) <= targets.get('budget', 11)) and f.get('calories', 0) <= cal_tgt * 4.0:
                item = dict(f)
                item['quantity'] = 1
                item['scaledNutrients'] = {k: float(f.get(k, 0) or 0) for k in ['calories','protein','carbs','fat']}
                selected.append(item)
                break

    return {"success": len(selected) > 0, "items": selected, "totals": compute_totals(selected) if selected else {}}


def compute_totals(foods: List[Dict]) -> Dict[str, float]:
    keys = ['calories', 'protein', 'carbs', 'fat', 'cost', 'fiber', 'sodium', 'potassium', 'calcium', 'iron', 'vitamin_c', 'vitamin_d', 'magnesium']
    totals = {k: 0.0 for k in keys}
    for f in foods:
        q = f.get('quantity', 1)
        for k in keys:
            totals[k] += (f.get(k, 0) or 0) * q
    return {k: round(v, 2) for k, v in totals.items()}


# ============ PERIOD MATCHING ============
# Which DB meal_period slugs count for each user-facing meal
PERIOD_ALIASES = {
    'breakfast': ['breakfast', 'every-day', 'everyday', 'all-day', 'standard-breakfast', 'weekday-breakfast', 'weekend-breakfast'],
    'lunch':     ['lunch', 'brunch', 'every-day', 'everyday', 'all-day', 'standard-lunch', 'weekday-lunch', 'weekend-lunch', 'midday'],
    'dinner':    ['dinner', 'every-day', 'everyday', 'all-day', 'standard-dinner', 'weekday-dinner', 'weekend-dinner', 'evening'],
}

SEMANTIC_PERIOD_ALIASES = {
    'breakfast': ['breakfast', 'morning', 'weekday-breakfast'],
    'lunch': ['lunch', 'brunch', 'midday', 'noon', 'weekday-lunch'],
    'dinner': ['dinner', 'supper', 'evening', 'weekday-dinner'],
}

GENERIC_PERIOD_ALIASES = ['every-day', 'everyday', 'all-day']

MENU_CATEGORY_RULES = [
    ('Entrees', ['entree', 'chef', 'grill', 'plate', 'burger', 'sandwich', 'sub', 'wrap', 'pizza', 'bowl', 'quesadilla', 'taco', 'pasta', 'noodle', 'chicken', 'beef', 'pork', 'salmon', 'fish']),
    ('Sides', ['side', 'fries', 'potato', 'rice', 'bean', 'vegetable', 'broccoli', 'corn', 'mac', 'soup']),
    ('Salads', ['salad', 'greens']),
    ('Breakfast', ['breakfast', 'egg', 'omelet', 'omelette', 'pancake', 'waffle', 'biscuit', 'sausage', 'bacon', 'hash']),
    ('Desserts', ['dessert', 'cookie', 'cake', 'brownie', 'ice cream', 'pie', 'muffin']),
    ('Drinks', ['drink', 'coffee', 'tea', 'smoothie', 'soda', 'juice']),
    ('Sauces', ['sauce', 'dressing', 'dip', 'salsa', 'gravy']),
]

def items_for_period(all_items: List[Dict], period: str) -> List[Dict]:
    """Filter items to those available during a given meal period.
    Retail locations only have 'every-day' so they always match every period."""
    aliases = PERIOD_ALIASES.get(period, [period, 'every-day', 'everyday'])
    return [f for f in all_items if (f.get('meal_period') or '').lower() in aliases]


def normalize_period_value(value: Optional[str]) -> str:
    if not value:
        return ''
    normalized = re.sub(r'[^a-z0-9]+', '-', value.strip().lower())
    return normalized.strip('-')


def canonicalize_meal_period(value: Optional[str]) -> Optional[str]:
    normalized = normalize_period_value(value)
    if not normalized:
        return None

    for canonical, aliases in SEMANTIC_PERIOD_ALIASES.items():
        if normalized == canonical or normalized in aliases:
            return canonical
        if any(alias in normalized for alias in aliases):
            return canonical

    return None


def get_period_match_score(period: Dict[str, Any], requested_period: Optional[str]) -> int:
    slug = normalize_period_value(period.get('slug'))
    name = normalize_period_value(period.get('name'))
    requested_value = normalize_period_value(requested_period)
    requested_canonical = canonicalize_meal_period(requested_period)
    semantic_aliases = SEMANTIC_PERIOD_ALIASES.get(requested_canonical or '', [])

    if requested_value:
        if slug == requested_value:
            return 220
        if name == requested_value:
            return 210
        if slug.startswith(requested_value) or slug.endswith(requested_value):
            return 180
        if name.startswith(requested_value) or name.endswith(requested_value):
            return 170

    for alias in semantic_aliases:
        normalized_alias = normalize_period_value(alias)
        if slug == normalized_alias:
            return 200
        if name == normalized_alias:
            return 190
        if slug.startswith(normalized_alias) or slug.endswith(normalized_alias):
            return 165
        if name.startswith(normalized_alias) or name.endswith(normalized_alias):
            return 155
        if normalized_alias and normalized_alias in slug:
            return 145
        if normalized_alias and normalized_alias in name:
            return 135

    for generic_alias in GENERIC_PERIOD_ALIASES:
        normalized_generic = normalize_period_value(generic_alias)
        if slug == normalized_generic or name == normalized_generic:
            return 40

    return 0


def select_requested_period(periods: List[Dict[str, Any]], requested_period: Optional[str]) -> Optional[Dict[str, Any]]:
    if not periods:
        return None

    ranked_periods = sorted(
        periods,
        key=lambda period: (
            get_period_match_score(period, requested_period),
            bool(period.get('id')),
            -(len(str(period.get('name') or ''))),
        ),
        reverse=True,
    )

    best = ranked_periods[0]
    if get_period_match_score(best, requested_period) > 0:
        return best

    return None


def resolve_location_name(location_name: str) -> Optional[str]:
    if not location_name:
        return None
    if location_name in DINING_LOCATIONS:
        return location_name
    lowered = location_name.lower()
    for name in DINING_LOCATIONS:
        if lowered == name.lower() or lowered in name.lower():
            return name
    return None


def infer_menu_category(item: Dict[str, Any], meal_period: Optional[str] = None) -> str:
    explicit = (item.get('category') or '').strip()
    if explicit:
        return explicit

    name = (item.get('name') or '').lower()
    for label, keywords in MENU_CATEGORY_RULES:
        if any(keyword in name for keyword in keywords):
            return label

    period = (meal_period or item.get('meal_period') or '').lower()
    if period == 'breakfast':
        return 'Breakfast'
    if period == 'dinner':
        return 'Dinner Specials'
    return 'Featured Items'


def group_menu_items(items: List[Dict[str, Any]], meal_period: Optional[str] = None) -> List[Dict[str, Any]]:
    grouped: Dict[str, List[Dict[str, Any]]] = {}
    seen = set()

    for raw in items:
        item = dict(raw)
        key = (
            item.get('name', '').strip().lower(),
            item.get('location', '').strip().lower(),
            (item.get('meal_period') or meal_period or '').strip().lower(),
        )
        if key in seen:
            continue
        seen.add(key)

        category = infer_menu_category(item, meal_period)
        grouped.setdefault(category, []).append(item)

    ordered_labels = ['Entrees', 'Sides', 'Salads', 'Breakfast', 'Desserts', 'Drinks', 'Sauces', 'Featured Items', 'Dinner Specials']
    category_names = sorted(grouped.keys(), key=lambda name: (ordered_labels.index(name) if name in ordered_labels else len(ordered_labels), name.lower()))
    result = []
    for category in category_names:
        sorted_items = sorted(grouped[category], key=lambda item: ((item.get('name') or '').lower(), item.get('location') or ''))
        result.append({"name": category, "items": sorted_items})
    return result


def _menu_success_ttl_seconds(date_str: Optional[str] = None) -> int:
    now = datetime.now(CENTRAL_TZ)
    target_date = now.date()

    if date_str:
        try:
            target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        except ValueError:
            target_date = now.date()

    if target_date < now.date():
        return 60 * 60

    next_midnight = datetime(
        target_date.year,
        target_date.month,
        target_date.day,
        0,
        0,
        0,
        0,
        tzinfo=CENTRAL_TZ,
    ) + timedelta(days=1)
    ttl_seconds = int((next_midnight - now).total_seconds())
    return max(60, ttl_seconds)


def get_full_menu(location_name: str, meal_period: str = 'lunch', date_str: str = None) -> Dict[str, Any]:
    cache_key = f"dining:full-menu:v1:{location_name.lower()}:{(meal_period or 'lunch').lower()}:{date_str or datetime.now().strftime('%Y-%m-%d')}"
    cached = cache_service.get_json(cache_key)
    if cached is not None:
        return cached

    period = (meal_period or 'lunch').lower()
    resolved_name = resolve_location_name(location_name) or location_name
    is_dining_hall = 'hall' in resolved_name.lower()
    items: List[Dict[str, Any]] = []
    source = 'database'
    resolved_locations = [resolved_name]

    if is_dining_hall:
        live_result = fetch_dine_on_campus_menu(resolved_name, date_str=date_str, meal_period=period)
        if live_result.get('success') and live_result.get('items'):
            items = live_result['items']
            source = 'live'
        else:
            aliases = PERIOD_ALIASES.get(period, [period, 'every-day', 'everyday', 'all-day'])
            try:
                with get_db_conn() as conn:
                    with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
                        placeholders = ','.join(['%s'] * len(aliases))
                        cur.execute(f"""
                            SELECT * FROM food_items
                            WHERE (location = %s OR location ILIKE %s)
                            AND location_type = 'dining_hall'
                            AND meal_period IN ({placeholders})
                            AND active = TRUE
                        """, [resolved_name, f"%{resolved_name}%"] + aliases)
                        items = [dict(row) for row in cur.fetchall()]
            except Exception:
                items = []
            source = 'database'
    else:
        aliases = PERIOD_ALIASES.get(period, [period, 'every-day', 'everyday', 'all-day'])
        resolved_locations = RESTAURANT_GROUPS.get(location_name, [resolved_name])
        try:
            with get_db_conn() as conn:
                with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
                    placeholders = ','.join(['%s'] * len(aliases))
                    cur.execute(f"""
                        SELECT * FROM food_items
                        WHERE location = ANY(%s)
                        AND location_type = 'restaurant'
                        AND meal_period IN ({placeholders})
                        AND active = TRUE
                    """, [resolved_locations] + aliases)
                    items = [dict(row) for row in cur.fetchall()]
        except Exception:
            items = []

    grouped_items = group_menu_items(items, period)
    payload = {
        "success": len(grouped_items) > 0,
        "location": location_name,
        "resolvedLocation": resolved_name,
        "locations": resolved_locations,
        "mealPeriod": period,
        "source": source,
        "count": len(items),
        "categories": grouped_items,
    }
    ttl_seconds = _menu_success_ttl_seconds(date_str) if payload["success"] else DINING_MENU_ERROR_TTL_SECONDS
    cache_service.set_json(cache_key, payload, ttl_seconds)
    return payload


def optimize_combo(location_name: str, target_cal: float) -> Dict[str, Any]:
    """Optimize a retail swipe meal at a specific location.
    Prefers DB data (already synced and USDA-verified) for speed.
    Falls back to live API only if DB is empty."""
    foods = []

    # DB FIRST — items were synced with USDA verification already
    try:
        with get_db_conn() as conn:
            with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
                cur.execute("""
                    SELECT * FROM food_items 
                    WHERE (location = %s OR location ILIKE %s) 
                    AND location_type = 'restaurant'
                    AND active = TRUE
                """, (location_name, f"%{location_name}%"))
                foods = [dict(r) for r in cur.fetchall()]
    except:
        pass

    # For retail combos, we ONLY use the curated DB items.
    # Do not fallback to the live DineOnCampus API because it triggers
    # slow USDA searches that hit rate limits and returns messy a-la-carte ingredients.

    if not foods:
        return {"success": False, "error": f"No items found for {location_name}", "items": [], "totals": {}}

    # Retail budget is $11, max 3 items (realistic for swipe)
    result = optimize_diet(foods, {"calories": target_cal, "budget": 11.0}, {"max_servings": 1, "max_items": 3})
    return result


def generate_variants(foods: List[Dict], target_cal: float, macros: Dict) -> List[Dict]:
    variants = []
    res_b = optimize_diet(foods, {"calories": target_cal})
    if res_b['success']:
        res_b['label'] = "Balanced"
        variants.append(res_b)
    res_p = optimize_diet(foods, {"calories": target_cal}, {"high_protein": True})
    if res_p['success']:
        res_p['label'] = "High Protein"
        variants.append(res_p)
    res_v = optimize_diet(foods, {"calories": target_cal}, {"vegetarian": True})
    if res_v['success']:
        res_v['label'] = "Vegetarian"
        variants.append(res_v)
    return variants


# ============ DineOnCampus API ============

API_BASE = "https://apiv4.dineoncampus.com"
DINE_API_HOST = "apiv4.dineoncampus.com"
DINE_API_IP_FALLBACK = "206.82.192.172"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Origin": "https://dineoncampus.com",
    "Referer": "https://dineoncampus.com/"
}


def _dine_api_get(path: str, *, timeout: int = 10, params: Optional[Dict[str, Any]] = None):
    """Fetch a DineOnCampus endpoint, falling back to the origin IP when hostname access fails."""
    attempts = [
        (f"{API_BASE}{path}", dict(HEADERS), True),
        (f"https://{DINE_API_IP_FALLBACK}{path}", {**HEADERS, "Host": DINE_API_HOST}, False),
    ]
    last_error = None

    for url, headers, verify in attempts:
        try:
            resp = requests.get(url, headers=headers, params=params, timeout=timeout, verify=verify)
            if resp.status_code == 200:
                return resp, url
            last_error = f"{url} returned HTTP {resp.status_code}"
        except requests.RequestException as exc:
            last_error = str(exc)

    raise requests.RequestException(last_error or "Unable to reach DineOnCampus")


def fetch_dine_on_campus_menu(location_name: str, date_str: str = None, meal_period: str = None) -> Dict[str, Any]:
    cache_key = f"dining:live-menu:v1:{location_name.lower()}:{(meal_period or 'lunch').lower()}:{date_str or datetime.now().strftime('%Y-%m-%d')}"
    cached = cache_service.get_json(cache_key)
    if cached is not None:
        return cached

    if not date_str:
        date_str = datetime.now().strftime('%Y-%m-%d')

    # Resolve location ID — try exact match first, then fuzzy
    location_id = DINING_LOCATIONS.get(location_name)
    if not location_id:
        location_id = next((v for k, v in DINING_LOCATIONS.items() if location_name.lower() in k.lower()), None)
    if not location_id:
        return {"success": False, "error": f"Unknown location: {location_name}", "items": []}

    requested_period = canonicalize_meal_period(meal_period) or normalize_period_value(meal_period) or 'lunch'
    last_error: Optional[str] = None

    try:
        periods_resp, _periods_url = _dine_api_get(
            f"/locations/{location_id}/periods/",
            timeout=10,
            params={"date": date_str},
        )
        periods = periods_resp.json().get('periods', [])
        selected_period = select_requested_period(periods, meal_period)

        if not selected_period or not selected_period.get('id'):
            return {"success": False, "error": f"No periods for {location_name}", "items": []}

        period_id = selected_period['id']
        matched_slug = selected_period.get('slug') or normalize_period_value(selected_period.get('name'))
        resolved_period = canonicalize_meal_period(matched_slug) or requested_period

        menu_resp, menu_url = _dine_api_get(
            f"/locations/{location_id}/menu",
            timeout=15,
            params={"date": date_str, "period": period_id},
        )
        data = menu_resp.json()
        items = []

        period_data = data.get('period', {})
        for cat in period_data.get('categories', []):
            cat_name = cat.get('name', 'General')
            for item in cat.get('items', []):
                nutrients = {}
                for n in item.get('nutrients', []):
                    nutrients[n.get('name', '').lower()] = n.get('valueNumeric', 0)

                def parse_val(v):
                    if v is None or v == '-':
                        return 0.0
                    try:
                        return float(str(v).replace('+', '').replace('<', '').strip())
                    except:
                        return 0.0

                items.append({
                    "name": (item.get('name') or '').strip(),
                    "category": cat_name,
                    "location": location_name,
                    "meal_period": resolved_period or matched_slug or (meal_period or 'every-day'),
                    "calories": parse_val(nutrients.get('calories', item.get('calories', 0))),
                    "protein": parse_val(nutrients.get('protein (g)', 0)),
                    "carbs": parse_val(nutrients.get('total carbohydrates (g)', 0)),
                    "fat": parse_val(nutrients.get('total fat (g)', 0)),
                    "fiber": parse_val(nutrients.get('dietary fiber (g)', 0)),
                    "sodium": parse_val(nutrients.get('sodium (mg)', 0)),
                    "potassium": parse_val(nutrients.get('potassium (mg)', 0)),
                    "calcium": parse_val(nutrients.get('calcium (mg)', 0)),
                    "iron": parse_val(nutrients.get('iron (mg)', 0)),
                    "vitamin_c": parse_val(nutrients.get('vitamin c (mg)', 0)),
                    "vitamin_d": parse_val(nutrients.get('vitamin d (mcg)' ,0)),
                    "magnesium": parse_val(nutrients.get('magnesium (mg)', 0)),
                    "source": f"dineoncampus:{DINE_API_HOST if DINE_API_IP_FALLBACK not in menu_url else DINE_API_IP_FALLBACK}"
                })

        items = enrich_items(items)
        payload = {
            "success": True,
            "items": items,
            "location": location_name,
            "date": date_str,
            "period": matched_slug,
            "resolvedPeriod": resolved_period,
            "apiBase": menu_url.rsplit('/locations/', 1)[0],
        }
        cache_service.set_json(cache_key, payload, _menu_success_ttl_seconds(date_str))
        return payload
    except Exception as e:
        last_error = str(e)

    payload = {"success": False, "error": last_error or "Unable to reach DineOnCampus", "items": []}
    cache_service.set_json(cache_key, payload, DINING_MENU_ERROR_TTL_SECONDS)
    return payload


def sync_all_locations(date_str: str = None):
    if not date_str:
        date_str = datetime.now().strftime('%Y-%m-%d')
    init_db()
    with get_db_conn() as conn:
        with conn.cursor() as cur:
            for name, loc_id in DINING_LOCATIONS.items():
                print(f"Syncing {name}...")
                try:
                    p_url = f"{API_BASE}/locations/{loc_id}/periods/?date={date_str}"
                    p_resp = requests.get(p_url, headers=HEADERS, timeout=10)
                    periods = p_resp.json().get('periods', []) if p_resp.status_code == 200 else []
                    if not periods:
                        periods = [{'id': None, 'name': 'Every Day', 'slug': 'every-day'}]
                except:
                    periods = [{'id': None, 'name': 'Every Day', 'slug': 'every-day'}]

                for p in periods:
                    res = fetch_dine_on_campus_menu(name, date_str, p['slug'])
                    if res.get('success') and res.get('items'):
                        for it in res['items']:
                            cur.execute("""
                                INSERT INTO food_items (name, location, location_type, calories, protein, fat, carbs, fiber, sodium, potassium, calcium, iron, vitamin_c, vitamin_d, magnesium, usda_calories, cost, meal_period, date, active)
                                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, TRUE)
                                ON CONFLICT (name, location, meal_period, date) DO UPDATE SET
                                    calories = EXCLUDED.calories, protein = EXCLUDED.protein, fat = EXCLUDED.fat, carbs = EXCLUDED.carbs,
                                    fiber = EXCLUDED.fiber, sodium = EXCLUDED.sodium, potassium = EXCLUDED.potassium,
                                    calcium = EXCLUDED.calcium, iron = EXCLUDED.iron, vitamin_c = EXCLUDED.vitamin_c,
                                    vitamin_d = EXCLUDED.vitamin_d, magnesium = EXCLUDED.magnesium,
                                    usda_calories = EXCLUDED.usda_calories, cost = EXCLUDED.cost, active = TRUE
                            """, (
                                it['name'], name,
                                'dining_hall' if 'Hall' in name else 'restaurant',
                                it.get('calories', 0), it.get('protein', 0), it.get('fat', 0), it.get('carbs', 0),
                                it.get('fiber', 0), it.get('sodium', 0), it.get('potassium', 0),
                                it.get('calcium', 0), it.get('iron', 0), it.get('vitamin_c', 0),
                                it.get('vitamin_d', 0), it.get('magnesium', 0),
                                it.get('usda_calories'), it.get('cost', 0),
                                p['slug'], date_str
                            ))
                conn.commit()
                print(f"  ✓ Synced {name} ({len(periods)} periods)")


# ============ CALORIC TARGETING ============
# These are used by routers/dining.py

def caloric_target(profile: Dict, current_weight: float) -> Dict:
    """Calculate daily caloric target based on profile."""
    gender = (profile.get('gender') or 'male').lower()
    age = profile.get('age') or 20
    height_in = profile.get('height_in') or 70
    weight_kg = current_weight * 0.453592
    height_cm = height_in * 2.54

    if gender == 'female':
        bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age - 161
    else:
        bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age + 5

    multipliers = {'sedentary': 1.2, 'light': 1.375, 'moderate': 1.55, 'active': 1.725, 'very_active': 1.9}
    tdee = bmr * multipliers.get(profile.get('activity_level', 'moderate'), 1.55)

    goal_weight = profile.get('goal_weight_lbs')
    mode = 'maintain'
    if goal_weight and current_weight:
        if goal_weight < current_weight - 2:
            mode = 'cut'
            tdee -= 500
        elif goal_weight > current_weight + 2:
            mode = 'bulk'
            tdee += 300

    # Body fat estimation (Navy method)
    body_fat = None
    waist = profile.get('waist_in')
    neck = profile.get('neck_in')
    if waist and neck and height_in:
        if gender == 'female':
            hip = profile.get('hip_in') or 36
            body_fat = round(495 / (1.29579 - 0.35004 * math.log10(waist + hip - neck) + 0.22100 * math.log10(height_in)) - 450, 1)
        else:
            body_fat = round(495 / (1.0324 - 0.19077 * math.log10(waist - neck) + 0.15456 * math.log10(height_in)) - 450, 1)

    return {
        'targetCalories': round(tdee),
        'mode': mode,
        'bodyFat': body_fat
    }


def macro_targets(weight_lbs: float, activity_level: str, cal_target: float) -> Dict:
    """Calculate macro targets based on weight and activity."""
    weight_kg = weight_lbs * 0.453592
    protein_mult = {'sedentary': 1.2, 'light': 1.4, 'moderate': 1.6, 'active': 1.8, 'very_active': 2.0}
    protein_g = round(weight_kg * protein_mult.get(activity_level, 1.6))
    fat_g = round(cal_target * 0.25 / 9)
    carbs_g = round((cal_target - protein_g * 4 - fat_g * 9) / 4)
    return {'protein': protein_g, 'fat': fat_g, 'carbs': max(carbs_g, 50)}
