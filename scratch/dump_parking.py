import sqlite3
import json
import os

db_path = "Backend/Data/campus_registry.db"
if not os.path.exists(db_path):
    print(f"DB not found at {db_path}")
    exit(1)

conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

cur.execute("SELECT * FROM places WHERE type = 'Parking'")
rows = cur.fetchall()

parking_places = []
for row in rows:
    p = dict(row)
    # Get aliases for this place
    cur.execute("SELECT alias FROM aliases WHERE place_id = ?", (p["place_id"],))
    p["aliases"] = [r["alias"] for r in cur.fetchall()]
    parking_places.append(p)

print(json.dumps(parking_places, indent=2))
conn.close()
