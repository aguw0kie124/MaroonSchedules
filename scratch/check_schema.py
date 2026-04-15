import sqlite3
import os

db_path = "Backend/Data/campus_registry.db"
conn = sqlite3.connect(db_path)
cur = conn.cursor()

cur.execute("PRAGMA table_info(places);")
rows = cur.fetchall()

for row in rows:
    print(row)

conn.close()
