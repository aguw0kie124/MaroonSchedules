import requests
import time
import json

# Use Nominatim (OpenStreetMap) to geocode the addresses
# Also try direct search for TAMU buildings
locations_by_address = {
    'Aggie Express - Hullabaloo': '306 University Dr, College Station, TX 77840',
    'Aggie Express - Commons': '676 Lubbock St, College Station, TX 77840',
}

locations_by_name = {
    'Aggie Express - Pavilion': 'The Pavilion Texas A&M, College Station, TX',
    'Creekside Market': 'White Creek Community, Texas A&M, College Station, TX',
    'Market @ Polo Garage': 'Polo Road Garage, Texas A&M, College Station, TX',
    'Market @ Lamar St.': 'Innovative Learning Classroom Building ILCB, Texas A&M, College Station, TX',
    'White Creek Market': 'White Creek Community, Texas A&M, College Station, TX',
    'Market - Ag Cafe': 'Agriculture and Life Sciences Building, Texas A&M, College Station, TX',
    'Market Express - Business Library (BLCC)': 'Business Library Collaboration Commons, Texas A&M, College Station, TX',
}

headers = {'User-Agent': 'MaroonLife/1.0 (campus app)'}

print("=== By Address ===")
for name, addr in locations_by_address.items():
    r = requests.get('https://nominatim.openstreetmap.org/search',
                     params={'q': addr, 'format': 'json', 'limit': 1},
                     headers=headers)
    data = r.json()
    if data:
        lat = data[0]['lat']
        lon = data[0]['lon']
        print(f"  {name}: lat={lat}, lon={lon}")
    else:
        print(f"  {name}: NOT FOUND for '{addr}'")
    time.sleep(1.1)  # Nominatim rate limit

print("\n=== By Building Name ===")
for name, query in locations_by_name.items():
    r = requests.get('https://nominatim.openstreetmap.org/search',
                     params={'q': query, 'format': 'json', 'limit': 1},
                     headers=headers)
    data = r.json()
    if data:
        lat = data[0]['lat']
        lon = data[0]['lon']
        display = data[0].get('display_name', '')[:80]
        print(f"  {name}: lat={lat}, lon={lon} ({display})")
    else:
        print(f"  {name}: NOT FOUND for '{query}'")
    time.sleep(1.1)
