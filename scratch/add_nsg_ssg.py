import sqlite3
import os

db_path = "Backend/Data/campus_registry.db"
if not os.path.exists(db_path):
    print(f"DB not found at {db_path}")
    exit(1)

conn = sqlite3.connect(db_path)
cur = conn.cursor()

# 1. Update Northside Garage
cur.execute("""
    UPDATE places 
    SET name = 'Northside Garage (NSG)',
        address = '104 Ireland St, College Station, TX 77843', 
        search_only = 0,
        hours = 'Typically open 24 hours for permitted access; visitor availability varies. See Texas A&M Transportation Services for rules and rates.'
    WHERE place_id = 'osm:way:155052665'
""")
print(f"Updated Northside Garage: {cur.rowcount} rows")

# 2. Update Southside Garage
cur.execute("""
    UPDATE places 
    SET name = 'Southside Garage (SSG)',
        address = '750 Bizzell St, College Station, TX 77843', 
        search_only = 0,
        hours = 'Typically open 24 hours for permitted access; visitor availability varies. See Texas A&M Transportation Services for rules and rates.'
    WHERE place_id = 'osm:way:168585553'
""")
print(f"Updated Southside Garage: {cur.rowcount} rows")

conn.commit()
conn.close()
print("Registry database updated for NSG and SSG.")
