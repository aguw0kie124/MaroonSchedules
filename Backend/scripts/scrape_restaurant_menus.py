"""
Scrape all non-dining-hall restaurant menus from DineOnCampus API
using cloudscraper to bypass Cloudflare, then output as static JSON.
"""
import json
import os
import time
import cloudscraper

session = cloudscraper.create_scraper(
    browser={'browser': 'chrome', 'platform': 'windows', 'mobile': False}
)
API_HEADERS = {
    'Origin': 'https://dineoncampus.com',
    'Referer': 'https://dineoncampus.com/',
}
TODAY = '2026-04-14'

RESTAURANT_LOCATIONS = {
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
    "Vet Med Cafe": "591c65b8ee596f0ff3feea1f",
}


def parse_val(v):
    if v is None or v == '-':
        return 0
    try:
        return round(float(str(v).replace('+', '').replace('<', '').strip()))
    except Exception:
        return 0


def fetch_menu(name, loc_id):
    # Get periods
    pr = session.get(
        f'https://apiv4.dineoncampus.com/locations/{loc_id}/periods/',
        params={'date': TODAY},
        headers=API_HEADERS,
        timeout=12,
    )
    if pr.status_code != 200:
        return []

    periods = pr.json().get('periods', [])
    if not periods:
        periods = [{'id': None, 'name': 'Every Day', 'slug': 'every-day'}]

    all_categories = {}

    for period in periods:
        period_id = period.get('id')
        params = {'date': TODAY}
        if period_id:
            params['period'] = period_id

        mr = session.get(
            f'https://apiv4.dineoncampus.com/locations/{loc_id}/menu',
            params=params,
            headers=API_HEADERS,
            timeout=15,
        )
        if mr.status_code != 200:
            continue

        data = mr.json()
        period_data = data.get('period', {})
        for cat in period_data.get('categories', []):
            cat_name = cat.get('name', 'General')
            if cat_name not in all_categories:
                all_categories[cat_name] = []

            for item in cat.get('items', []):
                nutrients = {}
                for n in item.get('nutrients', []):
                    nutrients[n.get('name', '').lower()] = n.get('valueNumeric', 0)

                item_data = {
                    "name": (item.get('name') or '').strip(),
                    "description": (item.get('desc') or '').strip() or None,
                    "portion": (item.get('portion') or '').strip() or None,
                    "calories": parse_val(nutrients.get('calories', item.get('calories', 0))),
                    "protein": parse_val(nutrients.get('protein (g)', 0)),
                    "carbs": parse_val(nutrients.get('total carbohydrates (g)', 0)),
                    "fat": parse_val(nutrients.get('total fat (g)', 0)),
                }
                # Deduplicate
                if not any(e['name'] == item_data['name'] for e in all_categories[cat_name]):
                    all_categories[cat_name].append(item_data)

    return [{"name": k, "items": v} for k, v in all_categories.items() if v]


def main():
    results = {}
    total = len(RESTAURANT_LOCATIONS)

    for i, (name, loc_id) in enumerate(RESTAURANT_LOCATIONS.items()):
        label = f"[{i+1}/{total}] {name}"
        try:
            categories = fetch_menu(name, loc_id)
            item_count = sum(len(c['items']) for c in categories)
            results[name] = categories
            print(f"{label} -> {len(categories)} categories, {item_count} items")
        except Exception as e:
            print(f"{label} -> ERROR: {e}")
            results[name] = []
        time.sleep(0.3)

    output_path = os.path.join(
        os.path.dirname(__file__), '..', '..', 'Frontend', 'data', 'restaurant_menus_raw.json'
    )
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)

    total_items = sum(sum(len(c['items']) for c in cats) for cats in results.values())
    with_data = sum(1 for v in results.values() if v)
    print(f"\nSaved to {output_path}")
    print(f"  Total restaurants: {len(results)}")
    print(f"  Restaurants with data: {with_data}")
    print(f"  Total items: {total_items}")


if __name__ == '__main__':
    main()
