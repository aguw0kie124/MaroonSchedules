import sqlite3
import os

db_path = "Backend/Data/campus_registry.db"
conn = sqlite3.connect(db_path)
cur = conn.cursor()

query = "SELECT place_id, name, type, search_only FROM places WHERE name LIKE '%Garage%';"
cur.execute(query)
rows = cur.fetchall()

for row in rows:
    print(row)

conn.close()
