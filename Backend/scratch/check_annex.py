import sqlite3
import os

db_path = 'Backend/Data/campus_registry.db'
conn = sqlite3.connect(db_path)
cur = conn.cursor()

cur.execute("SELECT place_id, name, lat, lng, type, short_name FROM places WHERE place_id='annex' OR place_id LIKE '%307098%'")
rows = cur.fetchall()
for row in rows:
    print(row)

cur.execute("SELECT alias FROM aliases WHERE place_id='annex'")
aliases = cur.fetchall()
print("Aliases for annex:", aliases)

conn.close()
