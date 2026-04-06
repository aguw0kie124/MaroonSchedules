import sqlite3
import json
from datetime import datetime, timezone
from pathlib import Path

# --- Configuration ---
BACKEND_DIR = Path(__file__).resolve().parents[1]
DB_PATH = BACKEND_DIR / "Data" / "campus_registry.db"
FRONTEND_JSON_PATH = BACKEND_DIR.parent / "Frontend" / "data" / "osm_places_tamu_10mi.json"

def sync():
    if not DB_PATH.exists():
        print(f"Error: Database not found at {DB_PATH}")
        return

    print(f"--- Syncing Registry to Frontend JSON ---")
    
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    # 1. Fetch all places
    cur.execute("SELECT * FROM places")
    rows = cur.fetchall()
    
    places = []
    for row in rows:
        place = dict(row)
        place_id = place["place_id"]
        
        # Fetch aliases for this place
        cur.execute("SELECT alias FROM aliases WHERE place_id = ?", (place_id,))
        aliases = [r["alias"] for r in cur.fetchall()]
        
        # Clean up the dictionary for JSON (remove internal fields if any)
        # The frontend expects 'search_only' as a boolean
        place["search_only"] = bool(place["search_only"])
        place["aliases"] = aliases
        
        places.append(place)

    # 2. Prepare JSON structure
    output = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "count": len(places),
        "attribution": "© OpenStreetMap contributors, MaroonSchedules Registry",
        "places": places
    }

    # 3. Write to Frontend
    with open(FRONTEND_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2)

    conn.close()
    print(f"Successfully synced {len(places)} places to {FRONTEND_JSON_PATH.name}")

if __name__ == "__main__":
    sync()
