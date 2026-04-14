import sqlite3
import os

db_path = "Backend/Data/campus_registry.db"
conn = sqlite3.connect(db_path)
cur = conn.cursor()

# Update Northside Garage
cur.execute("""
    UPDATE places 
    SET name = 'Northside Garage (NSG)',
        short_name = 'NSG',
        address = '104 Ireland St, College Station, TX 77843', 
        search_only = 0,
        type = 'Parking'
    WHERE place_id = 'osm:way:155052665'
""")

# Update Southside Garage
cur.execute("""
    UPDATE places 
    SET name = 'Southside Garage (SSG)',
        short_name = 'SSG',
        address = '750 Bizzell St, College Station, TX 77843', 
        search_only = 0,
        type = 'Parking'
    WHERE place_id = 'osm:way:168585553'
""")

conn.commit()
conn.close()
print("Registry database updated for NSG and SSG.")
