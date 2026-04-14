import json

d = json.load(open('Frontend/data/osm_places_tamu_10mi.json', 'r'))
places = d.get('places', [])

# Restaurant names from our static menus that should appear as food court children
restaurant_names = {
    # Sbisa Underground Food Court
    "1876 Burgers - Sbisa Complex",
    "Chick-Fil-A - Sbisa Underground Food Court",
    "Copperhead Jack's - Sbisa Complex",
    "Einstein Bros. Bagels - Sbisa Complex",
    "Houston Street Subs - Underground Food Court",
    "Bagel Block",
    "Pizza @ Underground",
    "Smoothie King - Sbisa Underground Food Court",
    # MSC Food Court
    "Abu Omar Halal - MSC",
    "Cabo Grill - MSC",
    "Chick-Fil-A - MSC Food Court",
    "Houston Street Subs - MSC",
    "Panda Express - MSC",
    "Rev's American Grill - MSC",
    "Starbucks Coffee - Evans Library",
    "Shake Smart - MSC",
    "Spin 'N Stone Pizza - MSC",
    # Polo
    "Houston Street Subs - Polo Garage",
    "Panda Express - Polo Garage",
    "Salata",
    "Shake Smart - Polo Garage",
    # West Campus
    "Chick-fil-A - West Campus Food Hall",
    "Copperhead Jack's - West Campus Food Hall",
    "Houston Street Subs - West Campus Food Hall",
}

# Find which Restaurant names have matching OSM entries
found = set()
for name in restaurant_names:
    name_lower = name.lower()
    for p in places:
        p_name = p.get('name', '').lower()
        if name_lower in p_name or p_name in name_lower:
            found.add(name)
            break
        # Check partial match
        short = name.split(' - ')[0].lower()
        if short in p_name:
            found.add(name)
            break

missing = restaurant_names - found
print(f"Found: {len(found)}, Missing: {len(missing)}")
print("\nMISSING (need to be added to OSM/DB):")
for n in sorted(missing):
    print(f"  {n}")
print("\nFOUND (already in data):")
for n in sorted(found):
    print(f"  {n}")
