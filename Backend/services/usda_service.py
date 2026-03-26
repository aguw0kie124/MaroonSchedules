import requests
import os
from typing import List, Dict, Optional

USDA_BASE = 'https://api.nal.usda.gov/fdc/v1'
# Using the key from the source app as a fallback
API_KEY = os.getenv('USDA_API_KEY', '2cudCt5WK4tFAmxhHZYoQGmOXvidmHVnnkPZdg0Z')

NUTRIENT_MAP = {
    'calories':   {'fdcId': 1008, 'srNum': '208'},
    'protein':    {'fdcId': 1003, 'srNum': '203'},
    'fat':        {'fdcId': 1004, 'srNum': '204'},
    'carbs':      {'fdcId': 1005, 'srNum': '205'},
    'fiber':      {'fdcId': 1079, 'srNum': '291'},
    'sugar':      {'fdcId': 2000, 'srNum': '269'},
    'sodium':     {'fdcId': 1093, 'srNum': '307'},
    'potassium':  {'fdcId': 1092, 'srNum': '306'},
    'calcium':    {'fdcId': 1087, 'srNum': '301'},
    'iron':       {'fdcId': 1089, 'srNum': '303'},
    'magnesium':  {'fdcId': 1090, 'srNum': '304'},
    'zinc':       {'fdcId': 1095, 'srNum': '309'},
    'vitamin_a':  {'fdcId': 1106, 'srNum': '318'},
    'vitamin_c':  {'fdcId': 1162, 'srNum': '401'},
    'vitamin_d':  {'fdcId': 1114, 'srNum': '328'},
}

def get_nutrient(nutrients: List[Dict], key: str) -> float:
    if not nutrients:
        return 0.0
    mapping = NUTRIENT_MAP[key]
    fdc_id = mapping['fdcId']
    sr_num = mapping['srNum']
    
    for n in nutrients:
        nid = n.get('nutrientId')
        nnum = str(n.get('nutrientNumber', ''))
        if nid == fdc_id or nid == int(sr_num) or nnum == sr_num or nnum == str(fdc_id):
            return float(n.get('value', 0.0))
    return 0.0

def extract_nutrients(raw_nutrients: List[Dict]) -> Dict[str, float]:
    return {key: get_nutrient(raw_nutrients, key) for key in NUTRIENT_MAP}

def search_usda(query: str, page_size: int = 10) -> List[Dict]:
    if not query or not query.strip():
        return []
        
    url = f"{USDA_BASE}/foods/search"
    params = {
        'query': query.strip(),
        'pageSize': page_size,
        'api_key': API_KEY
    }
    
    try:
        resp = requests.get(url, params=params, timeout=3)
        if resp.status_code != 200:
            return []
        data = resp.json()
        foods = data.get('foods', [])
        
        return [{
            'fdcId': f['fdcId'],
            'name': f['description'],
            'brand': f.get('brandOwner') or f.get('brandName'),
            'category': f.get('foodCategory'),
            'dataType': f.get('dataType'),
            'nutrients': extract_nutrients(f.get('foodNutrients', [])),
            'servingSize': f.get('servingSize'),
            'servingSizeUnit': f.get('servingSizeUnit'),
        } for f in foods]
    except Exception as e:
        print(f"USDA search error: {e}")
        return []

def get_food_by_id(fdc_id: int) -> Optional[Dict]:
    url = f"{USDA_BASE}/food/{fdc_id}"
    params = {'api_key': API_KEY}
    
    try:
        resp = requests.get(url, params=params, timeout=3)
        data = resp.json()
        return {
            'fdcId': data['fdcId'],
            'name': data['description'],
            'nutrients': extract_nutrients(data.get('foodNutrients', [])),
            'servingSize': data.get('servingSize'),
            'servingSizeUnit': data.get('servingSizeUnit'),
        }
    except Exception as e:
        print(f"USDA getById error: {e}")
        return None
