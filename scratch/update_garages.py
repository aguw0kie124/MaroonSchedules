import sqlite3
import os

db_path = "Backend/Data/campus_registry.db"
if not os.path.exists(db_path):
    print(f"DB not found at {db_path}")
    exit(1)

conn = sqlite3.connect(db_path)
cur = conn.cursor()

# 1. Update Central Campus Garage
cur.execute("""
    UPDATE places 
    SET address = '450 Spence St, College Station, TX 77843', 
        search_only = 0 
    WHERE place_id = 'osm:way:91100311'
""")
print(f"Updated Central Campus Garage: {cur.rowcount} rows")

# 2. Update Stallings Blvd Garage
cur.execute("""
    UPDATE places 
    SET name = 'Stallings Blvd Garage',
        address = '500 Gene Stallings Blvd, College Station, TX 77840', 
        search_only = 0 
    WHERE place_id = 'osm:way:450686873'
""")
print(f"Updated Stallings Blvd Garage: {cur.rowcount} rows")

conn.commit()
conn.close()
print("Registry database updated successfully.")
