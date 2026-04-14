"""
Convert raw scraped menu JSON + Maroon Meals data into a TypeScript static data file.
"""
import json
import os

RAW_PATH = os.path.join(os.path.dirname(__file__), '..', '..', 'Frontend', 'data', 'restaurant_menus_raw.json')
OUT_PATH = os.path.join(os.path.dirname(__file__), '..', '..', 'Frontend', 'data', 'restaurantMenus.ts')

with open(RAW_PATH, 'r', encoding='utf-8') as f:
    raw = json.load(f)

# Maroon Meals data from the official TAMU Dining page
MAROON_MEALS = {
    "1876 Burgers - Sbisa Complex": {
        "note": "All Maroon Meals at 1876 Burgers include original fries and a medium fountain drink! Avoiding Gluten buns available.",
        "combos": [
            {"name": "Double Aggie Classic Burger", "value": 11.98},
            {"name": "Double Patty Melt", "value": 11.98},
            {"name": "Supreme Burger", "value": 11.98},
            {"name": "Yell Burger", "value": 11.98},
            {"name": "Chicken Parm Sandwich", "value": 11.98},
            {"name": "Aggie Chicken Sandwich", "value": 11.98},
            {"name": "1876 Deluxe Chicken Sandwich", "value": 11.98},
            {"name": "Spicy Buffalo Chicken Sandwich", "value": 11.98},
            {"name": "Classic Grilled Chicken Sandwich", "value": 8.98},
            {"name": "Black Bean Burger (Vegetarian)", "value": 11.98},
        ]
    },
    "Azimuth Cafe - Langford": {
        "note": "All Maroon Meals at Azimuth Cafe include a small bag of chips and a medium fountain drink!",
        "combos": [
            {"name": "BBQ Chicken Sandwich", "value": 11.78},
            {"name": "Tex Mex Grilled Cheese", "value": 11.78},
            {"name": "Country Grilled Cheese", "value": 11.78},
            {"name": "Southwest Turkey Sandwich", "value": 11.78},
            {"name": "Chipotle Turkey Melt", "value": 12.18},
            {"name": "Chicken Mediterranean Sandwich", "value": 12.18},
            {"name": "Tuscan Chicken Sandwich", "value": 12.18},
            {"name": "Tasty Turkey Wrap", "value": 11.88},
            {"name": "BBQ Ranch Chicken Sandwich", "value": 11.88},
            {"name": "Turkey Bacon Avocado Sandwich", "value": 12.18},
            {"name": "Turkey Spinach Herb Sandwich", "value": 11.88},
            {"name": "Manzo Sandwich", "value": 12.13},
            {"name": "Chicken Cheesy Jalapeno Sandwich", "value": 11.78},
            {"name": "Uptown Roast Beef", "value": 12.13},
        ]
    },
    "Abu Omar Halal - MSC": {
        "note": "All Maroon Meals at Abu Omar Halal include a medium fountain drink!",
        "combos": [
            {"name": "Rice Bowl Combo", "value": 15.00},
        ]
    },
    "Cabo Grill - MSC": {
        "note": "All Maroon Meals at Cabo Grill include the choice of a 16.9 oz. bottled water or a medium fountain drink! Vegetarian, Avoiding Gluten, and Halal available.",
        "combos": [
            {"name": "Build Your Own Burrito", "value": 11.45},
            {"name": "Build Your Own Bowl", "value": 11.98},
        ]
    },
    "Chick-Fil-A - Sbisa Underground Food Court": {
        "note": "All Maroon Meals at Chick-fil-A include medium waffle fries and choice of a 16.9 oz bottled water or a medium fountain drink!",
        "combos": [
            {"name": "Original Chicken Sandwich", "value": 9.49},
            {"name": "Spicy Chicken Sandwich", "value": 9.79},
            {"name": "8 Piece Chicken Nuggets", "value": 9.59},
            {"name": "Avoiding Gluten - Grilled Chicken Sandwich", "value": 9.49},
        ]
    },
    "Chick-Fil-A - MSC Food Court": {
        "note": "All Maroon Meals at Chick-fil-A include medium waffle fries and choice of a 16.9 oz bottled water or a medium fountain drink!",
        "combos": [
            {"name": "Original Chicken Sandwich", "value": 9.49},
            {"name": "Spicy Chicken Sandwich", "value": 9.79},
            {"name": "8 Piece Chicken Nuggets", "value": 9.59},
            {"name": "Avoiding Gluten - Grilled Chicken Sandwich", "value": 9.49},
        ]
    },
    "Chick-fil-A - West Campus Food Hall": {
        "note": "All Maroon Meals at Chick-fil-A include medium waffle fries and choice of a 16.9 oz bottled water or a medium fountain drink!",
        "combos": [
            {"name": "Original Chicken Sandwich", "value": 9.49},
            {"name": "Spicy Chicken Sandwich", "value": 9.79},
            {"name": "8 Piece Chicken Nuggets", "value": 9.59},
            {"name": "Avoiding Gluten - Grilled Chicken Sandwich", "value": 9.49},
        ]
    },
    "Copperhead Jack's - Sbisa Complex": {
        "note": "All Maroon Meals at Copperhead Jack's include the choice of a 16.9 oz bottled water or a medium fountain drink! Vegetarian, Halal, and Avoiding Gluten Available.",
        "combos": [
            {"name": "Build Your Own Burrito", "value": 11.48},
            {"name": "Build Your Own Bowl", "value": 11.98},
        ]
    },
    "Copperhead Jack's - West Campus Food Hall": {
        "note": "All Maroon Meals at Copperhead Jack's include the choice of a 16.9 oz bottled water or a medium fountain drink! Vegetarian, Halal, and Avoiding Gluten Available.",
        "combos": [
            {"name": "Build Your Own Burrito", "value": 11.48},
            {"name": "Build Your Own Bowl", "value": 11.98},
        ]
    },
    "Houston Street Deli - RELLIS": {
        "note": "Listed Maroon Meals are available at Houston Street Deli on the RELLIS campus.",
        "combos": [
            {"name": "Build Your Own Bagel Sandwich (1 or 2 Eggs) with Piece of Fruit and Choice of Bottled Water or Drip Coffee", "value": 8.97},
            {"name": "Build Your Own Melt with Choice of Chips and Beverage", "value": 10.68},
        ]
    },
    "Houston Street Subs - Underground Food Court": {
        "note": "All Maroon Meals at Houston Street Subs include a small bag of chips and choice of a 16.9 oz. bottled water or a medium fountain drink! Vegetarian, Halal, and Avoiding Gluten Available.",
        "combos": [
            {"name": 'Any 10" Sub Sandwich', "value": 12.78},
            {"name": "Any Chopped Salad", "value": 12.78},
        ]
    },
    "Houston Street Subs - MSC": {
        "note": "All Maroon Meals at Houston Street Subs include a small bag of chips and choice of a 16.9 oz. bottled water or a medium fountain drink! Vegetarian, Halal, and Avoiding Gluten Available.",
        "combos": [
            {"name": 'Any 10" Sub Sandwich', "value": 12.78},
            {"name": "Any Chopped Salad", "value": 12.78},
        ]
    },
    "Houston Street Subs - Southside": {
        "note": "All Maroon Meals at Houston Street Subs include a small bag of chips and choice of a 16.9 oz. bottled water or a medium fountain drink! Vegetarian, Halal, and Avoiding Gluten Available.",
        "combos": [
            {"name": 'Any 10" Sub Sandwich', "value": 12.78},
            {"name": "Any Chopped Salad", "value": 12.78},
        ]
    },
    "Houston Street Subs - Polo Garage": {
        "note": "All Maroon Meals at Houston Street Subs include a small bag of chips and choice of a 16.9 oz. bottled water or a medium fountain drink! Vegetarian, Halal, and Avoiding Gluten Available.",
        "combos": [
            {"name": 'Any 10" Sub Sandwich', "value": 12.78},
            {"name": "Any Chopped Salad", "value": 12.78},
        ]
    },
    "Houston Street Subs - West Campus Food Hall": {
        "note": "All Maroon Meals at Houston Street Subs include a small bag of chips and choice of a 16.9 oz. bottled water or a medium fountain drink! Vegetarian, Halal, and Avoiding Gluten Available.",
        "combos": [
            {"name": 'Any 10" Sub Sandwich', "value": 12.78},
            {"name": "Any Chopped Salad", "value": 12.78},
        ]
    },
    "Panda Express - MSC": {
        "note": "All Maroon Meals at Panda Express include the choice of a 16.9 oz. bottled water or a medium fountain drink!",
        "combos": [
            {"name": "Orange Chicken Bowl", "value": 10.20},
            {"name": "Kung Pao Chicken Bowl", "value": 10.20},
            {"name": "Teriyaki Chicken Bowl", "value": 10.20},
            {"name": "Broccoli Beef Bowl", "value": 10.20},
            {"name": "Beijing Beef Bowl", "value": 10.20},
        ]
    },
    "Panda Express - Polo Garage": {
        "note": "All Maroon Meals at Panda Express include the choice of a 16.9 oz. bottled water or a medium fountain drink!",
        "combos": [
            {"name": "Orange Chicken Bowl", "value": 10.20},
            {"name": "Kung Pao Chicken Bowl", "value": 10.20},
            {"name": "Teriyaki Chicken Bowl", "value": 10.20},
            {"name": "Broccoli Beef Bowl", "value": 10.20},
            {"name": "Beijing Beef Bowl", "value": 10.20},
        ]
    },
    "Pizza @ Underground": {
        "note": "All Maroon Meals at Pizza @ Underground include the choice of a 16.9 oz. bottled water or a medium fountain drink!",
        "combos": [
            {"name": "Personal Cheese Pizza (Vegetarian)", "value": 9.68},
            {"name": "Personal Pepperoni Pizza", "value": 9.68},
            {"name": "Personal Baked Pasta", "value": 8.49},
        ]
    },
    "Rev's American Grill - MSC": {
        "note": "All Maroon Meals at Rev's American Grill include original fries and choice of a 16.9 oz. bottled water or a medium fountain drink! Avoiding Gluten buns available.",
        "combos": [
            {"name": "Classic Hamburger", "value": 10.48},
            {"name": "Classic Cheeseburger", "value": 10.78},
            {"name": "Chicken Tender Basket", "value": 8.49},
            {"name": "Spicy Buffalo Fried Chicken Sandwich", "value": 11.68},
            {"name": "Deluxe Fried Chicken Sandwich", "value": 11.68},
            {"name": "Black Bean Burger (Vegetarian)", "value": 10.58},
        ]
    },
    "Shake Smart - MSC": {
        "note": "Shake Smart Maroon Meal options.",
        "combos": [
            {"name": "Regular Size Shake with Choice of Milk", "value": 8.74},
            {"name": "Scooped or Blended Acai Bowl", "value": 10.27},
            {"name": "Smart Toast", "value": 7.94},
        ]
    },
    "Shake Smart - Polo Garage": {
        "note": "Shake Smart Maroon Meal options.",
        "combos": [
            {"name": "Regular Size Shake with Choice of Milk", "value": 8.74},
            {"name": "Scooped or Blended Acai Bowl", "value": 10.27},
            {"name": "Smart Toast", "value": 7.94},
        ]
    },
    "Shake Smart- Rec Center": {
        "note": "Shake Smart Maroon Meal options.",
        "combos": [
            {"name": "Regular Size Shake with Choice of Milk", "value": 8.74},
            {"name": "Scooped or Blended Acai Bowl", "value": 10.27},
            {"name": "Smart Toast", "value": 7.94},
        ]
    },
    "Spin 'N Stone Pizza - MSC": {
        "note": "All Maroon Meals at Spin 'n Stone Pizza in the MSC include a medium fountain drink!",
        "combos": [
            {"name": "Personal Cheese Pizza (Vegetarian)", "value": 9.48},
            {"name": "Personal Pepperoni Pizza", "value": 10.98},
        ]
    },
    "Whoop Coop": {
        "note": "All Maroon Meals at Whoop Coop include french fries, toast, coleslaw, sauce, and a medium fountain drink!",
        "combos": [
            {"name": "4 Piece Chicken Tender Combo", "value": 9.29},
            {"name": "Chicken Tender Sandwich Combo", "value": 7.99},
            {"name": "6 Piece Fried Cauliflower Nugget Combo (Vegetarian)", "value": 8.99},
            {"name": "6 Piece Fried Zucchini Combo (Vegetarian)", "value": 9.49},
        ]
    },
    "Vet Med Cafe": {
        "note": "All Maroon Meals at Vet Med Cafe include original fries and a medium fountain drink!",
        "combos": [
            {"name": "Bacon Cheeseburger", "value": 11.68},
            {"name": "Original Cheeseburger", "value": 10.68},
            {"name": "Black Bean Burger (Vegetarian)", "value": 10.58},
            {"name": "Spicy Chicken Panini", "value": 11.98},
            {"name": "Turkey Bacon Ranch Panini", "value": 11.98},
            {"name": "3 Piece Chicken Tenders", "value": 8.49},
        ]
    },
}


def escape_ts(s):
    """Escape a string for use inside TypeScript single quotes."""
    if s is None:
        return 'null'
    return s.replace('\\', '\\\\').replace("'", "\\'").replace('\n', ' ').replace('\r', '')


def gen_ts():
    lines = []
    lines.append("// Auto-generated static restaurant menus - scraped from DineOnCampus API")
    lines.append("// and Maroon Meals data from https://dineoncampus.com/tamu/maroon-meals")
    lines.append("// Generated on 2026-04-14")
    lines.append("")
    lines.append("export type StaticMenuItem = {")
    lines.append("  name: string;")
    lines.append("  description?: string | null;")
    lines.append("  portion?: string | null;")
    lines.append("  calories: number;")
    lines.append("  protein: number;")
    lines.append("  carbs: number;")
    lines.append("  fat: number;")
    lines.append("};")
    lines.append("")
    lines.append("export type StaticMenuCategory = {")
    lines.append("  name: string;")
    lines.append("  items: StaticMenuItem[];")
    lines.append("};")
    lines.append("")
    lines.append("export type MaroonMealCombo = {")
    lines.append("  name: string;")
    lines.append("  value: number;")
    lines.append("};")
    lines.append("")
    lines.append("export type StaticRestaurantMenu = {")
    lines.append("  categories: StaticMenuCategory[];")
    lines.append("  maroonMeals?: {")
    lines.append("    note: string;")
    lines.append("    combos: MaroonMealCombo[];")
    lines.append("  };")
    lines.append("};")
    lines.append("")
    lines.append("export const STATIC_RESTAURANT_MENUS: Record<string, StaticRestaurantMenu> = {")

    for name, categories in raw.items():
        mm = MAROON_MEALS.get(name)
        lines.append(f"  '{escape_ts(name)}': {{")
        lines.append(f"    categories: [")
        for cat in categories:
            lines.append(f"      {{")
            lines.append(f"        name: '{escape_ts(cat['name'])}',")
            lines.append(f"        items: [")
            for item in cat['items']:
                desc = f"'{escape_ts(item.get('description'))}'" if item.get('description') else 'null'
                portion = f"'{escape_ts(item.get('portion'))}'" if item.get('portion') else 'null'
                lines.append(f"          {{ name: '{escape_ts(item['name'])}', description: {desc}, portion: {portion}, calories: {item.get('calories',0)}, protein: {item.get('protein',0)}, carbs: {item.get('carbs',0)}, fat: {item.get('fat',0)} }},")
            lines.append(f"        ],")
            lines.append(f"      }},")
        lines.append(f"    ],")
        if mm:
            lines.append(f"    maroonMeals: {{")
            lines.append(f"      note: '{escape_ts(mm['note'])}',")
            lines.append(f"      combos: [")
            for combo in mm['combos']:
                lines.append(f"        {{ name: '{escape_ts(combo['name'])}', value: {combo['value']} }},")
            lines.append(f"      ],")
            lines.append(f"    }},")
        lines.append(f"  }},")

    lines.append("};")
    lines.append("")

    # Helper to look up menu by resolved restaurant name
    lines.append("/**")
    lines.append(" * Look up a static restaurant menu by location name.")
    lines.append(" * Tries exact match first, then case-insensitive partial match.")
    lines.append(" */")
    lines.append("export function getStaticRestaurantMenu(locationName: string): StaticRestaurantMenu | null {")
    lines.append("  if (STATIC_RESTAURANT_MENUS[locationName]) return STATIC_RESTAURANT_MENUS[locationName];")
    lines.append("  const lower = locationName.toLowerCase();")
    lines.append("  for (const [key, menu] of Object.entries(STATIC_RESTAURANT_MENUS)) {")
    lines.append("    if (key.toLowerCase() === lower || key.toLowerCase().includes(lower) || lower.includes(key.toLowerCase())) {")
    lines.append("      return menu;")
    lines.append("    }")
    lines.append("  }")
    lines.append("  return null;")
    lines.append("}")
    lines.append("")

    return '\n'.join(lines)


ts_content = gen_ts()
with open(OUT_PATH, 'w', encoding='utf-8') as f:
    f.write(ts_content)

# Stats
total_items = sum(sum(len(c['items']) for c in cats) for cats in raw.values())
with_menus = sum(1 for v in raw.values() if v)
with_maroon = sum(1 for k in raw if k in MAROON_MEALS)
print(f"Generated {OUT_PATH}")
print(f"  {len(raw)} restaurants, {with_menus} with menus, {total_items} menu items")
print(f"  {with_maroon} restaurants with Maroon Meals data")
