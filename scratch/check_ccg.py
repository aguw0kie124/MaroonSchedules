import sqlite3
import os

db_path = "Backend/Data/campus_registry.db"
conn = sqlite3.connect(db_path)
cur = conn.cursor()

query = "SELECT place_id, name, type, search_only FROM places WHERE name = 'Central Campus Garage';"
cur.execute(query)
print(cur.fetchone())

conn.close()
