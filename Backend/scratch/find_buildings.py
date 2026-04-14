import sqlite3

db_path = 'Backend/Data/campus_registry.db'
conn = sqlite3.connect(db_path)
cur = conn.cursor()

# Find buildings that host our markets
searches = {
    'Hullabaloo': "name LIKE '%Hullabaloo%'",
    'Commons': "name LIKE '%Commons%'",
    'Pavilion': "name LIKE '%Pavilion%'",
    'White Creek': "name LIKE '%White Creek%'",
    'Polo Road Garage': "name LIKE '%Polo Road%' OR name LIKE '%Polo%Garage%'",
    'ILCB': "name LIKE '%ILCB%' OR name LIKE '%Innovative Learning%'",
    'AGLS': "name LIKE '%Agriculture and Life%' OR name LIKE '%AGLS%'",
    'BLCC': "name LIKE '%BLCC%' OR name LIKE '%Business Library%' OR name LIKE '%West Campus Library%'",
    'Spence': "name LIKE '%Spence%'",
}

for label, where in searches.items():
    cur.execute(f"SELECT name, place_id, lat, lng, type FROM places WHERE {where}")
    rows = cur.fetchall()
    print(f"\n--- {label} ---")
    for r in rows:
        print(f"  {r[0]} ({r[1]}): {r[2]}, {r[3]} [{r[4]}]")

conn.close()
