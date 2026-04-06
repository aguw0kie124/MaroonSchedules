import sqlite3
import json
import os
import re
from pathlib import Path

# --- Configuration ---
BACKEND_DIR = Path(__file__).resolve().parents[1]
OSM_DATA_PATH = BACKEND_DIR / "Data" / "osm_places_tamu_10mi.json"
DB_PATH = BACKEND_DIR / "Data" / "campus_registry.db"

# --- Source Data (Unified from all locations) ---

# 1. Specialty Overrides (High priority name/alias mapping + Metadata)
SPECIAL_PLACES = [
    {
        "place_id": "libr", "name": "Sterling C. Evans Library", "short_name": "LIBR", "type": "Library", "lat": 30.616332, "lng": -96.338571, 
        "aliases": ["Evans Library", "Evans"],
        "hours": "Open daily · check library schedule",
        "description": "Main research library near the Academic Plaza."
    },
    {
        "place_id": "annex", "name": "Evans Library Annex", "short_name": "ANNEX", "type": "Library", "lat": 30.616531, "lng": -96.338456, "aliases": [],
        "hours": "Open daily · check library schedule",
        "description": "Annex study and overflow library space."
    },
    {
        "place_id": "psel", "name": "Policy Sciences & Economics Library", "short_name": "PSEL", "type": "Library", "lat": 30.59744, "lng": -96.35355, 
        "aliases": ["Policy Sciences and Economics Library", "PSEL"],
        "description": "Library specializing in government, economics, and policy resources."
    },
    {
        "place_id": "bush-lib", "name": "George H.W. Bush Presidential Library", "short_name": "BUSH", "type": "Library", "lat": 30.5966, "lng": -96.3533, 
        "aliases": ["George Bush Library", "Bush Library", "Bush School"],
        "description": "Presidential library and museum dedicated to George H.W. Bush."
    },
    {
        "place_id": "msl", "name": "Medical Sciences Library", "short_name": "MSL", "type": "Library", "lat": 30.61182, "lng": -96.35161, 
        "aliases": ["Medical Sciences Library", "MSL"],
        "description": "Primary library for medical and veterinary sciences."
    },
    {
        "place_id": "wcl", "name": "West Campus Library", "short_name": "WCL", "type": "Library", "lat": 30.611581, "lng": -96.350275, 
        "aliases": ["BLCC", "West Campus Library and Business Learning Complex"],
        "hours": "Open daily · check library schedule",
        "description": "Business and west campus study hub."
    },
    {
        "place_id": "cush", "name": "Cushing Memorial Library", "short_name": "CUSH", "type": "Library", "lat": 30.61636, "lng": -96.3399, "aliases": ["Cushing"],
        "description": "Historical and special collections library."
    },
    {
        "place_id": "rec", "name": "Student Recreation Center", "short_name": "REC", "type": "Rec", "lat": 30.607369543290172, "lng": -96.34287943254921, 
        "aliases": ["Student Rec Center", "Rec Center", "The Rec", "Rec", "osm:way:206530669", "srec"],
        "hours": "6:00 AM – 11:45 PM",
        "description": "Primary rec center with fitness, courts, pools, and climbing.",
        "features": ["Strength & Conditioning", "Indoor Track", "Pools", "Climbing Wall"]
    },
    {
        "place_id": "southside-rec", "name": "Southside Recreation Center", "short_name": "SSRC", "type": "Rec", "lat": 30.6157837, "lng": -96.3335135, 
        "aliases": ["Southside Rec Center", "osm:way:1367436238"],
        "hours": "5:30 AM – 11:59 PM",
        "description": "Southside rec center near the Commons with indoor and outdoor space.",
        "features": ["Strength & Conditioning", "Cardio Equipment", "Locker Rooms", "Sand Volleyball"]
    },
    {
        "place_id": "polo-rec", "name": "Polo Road Recreation Center", "short_name": "POLO REC", "type": "Rec", "lat": 30.6229681, "lng": -96.3383515, 
        "aliases": ["Polo Road Rec Center", "osm:way:904033099"],
        "hours": "6:00 AM – 10:00 PM",
        "description": "North campus rec center focused on cardio and strength training.",
        "features": ["Strength & Conditioning", "Cardio Equipment", "Indoor Track"]
    },
    {
        "place_id": "msc", "name": "Memorial Student Center", "short_name": "MSC", "type": "Hub", "lat": 30.61225, "lng": -96.341242, 
        "aliases": ["Memorial Student Center (MSC)", "MSC", "Memorial Student Center"],
        "hours": "Open daily",
        "description": "Central student hub, dining, lounges, and events."
    },
    {
        "place_id": "sbisa", "name": "Sbisa Dining Hall", "short_name": "SBISA", "type": "Dining", "lat": 30.617135, "lng": -96.343777, 
        "aliases": ["Sbisa Dining Hall", "Sbisa", "osm:way:720954602"],
        "hours": "Breakfast, lunch, and dinner service",
        "description": "Northside all-you-care-to-eat dining hall."
    },
    {
        "place_id": "commons", "name": "The Commons Dining Hall", "short_name": "COMMONS", "type": "Dining", "lat": 30.6156816097444, "lng": -96.3362674766492, 
        "aliases": ["The Commons", "Commons Dining Hall", "Commons", "osm:node:8223259463"],
        "hours": "Breakfast, lunch, and dinner service",
        "description": "Southside dining hall near the Commons."
    },
    {
        "place_id": "west-campus-dining", "name": "West Campus Dining Facility", "short_name": "WCD", "type": "Dining", "lat": 30.61020, "lng": -96.34863, 
        "aliases": ["West Campus Dining", "WCD"],
        "hours": "Check dining schedule",
        "description": "Modern dining facility located on West Campus."
    },
    {
        "place_id": "duncan", "name": "Duncan Dining Hall", "short_name": "DUNCAN", "type": "Dining", "lat": 30.612072, "lng": -96.335505, "aliases": [],
        "hours": "Check dining schedule",
        "description": "Dining hall near the Corps Quad."
    },
    {
        "place_id": "polo-garage-food", "name": "Polo Road Garage Dining", "short_name": "POLO DINING", "type": "Dining", "lat": 30.622723, "lng": -96.337939, 
        "aliases": ["Polo Road Garage", "Polo Dining", "Polo Road Garage Food"],
        "hours": "Check dining schedule",
        "description": "Dining hub inside the Polo Road Garage complex."
    },
    {
        "place_id": "rudder", "name": "Rudder Tower", "short_name": "RUDDER", "type": "Landmark", "lat": 30.613251, "lng": -96.339957, "aliases": ["Rudder"],
        "hours": "Open daily",
        "description": "Event and campus activity landmark adjacent to the MSC."
    },
]

# 2. Frontend Primary Overrides (from campus.ts hardcoded lists)
FRONTEND_PRIMARY = [
    { "id": 'zach', "name": 'Zachry Engineering Education Complex', "shortName": 'ZACH', "latitude": 30.621252, "longitude": -96.340241, "type": 'academic' },
    { "id": 'bloc', "name": 'Blocker Building', "shortName": 'BLOC', "latitude": 30.619539, "longitude": -96.342120, "type": 'academic' },
    { "id": 'hrbb', "name": 'Harrington Tower', "shortName": 'HRBB', "latitude": 30.616554, "longitude": -96.340897, "type": 'academic' },
    { "id": 'etb', "name": 'Engineering Technology Building', "shortName": 'ETB', "latitude": 30.622698, "longitude": -96.339186, "type": 'academic' },
    { "id": 'wisn', "name": 'Wisenbaker Engineering Research Center', "shortName": 'WERC', "latitude": 30.620765, "longitude": -96.338940, "type": 'academic' },
    { "id": 'lang', "name": 'Langford Architecture Center', "shortName": 'LANG', "latitude": 30.618798, "longitude": -96.337631, "type": 'academic' },
    { "id": 'held', "name": 'Heldenfels Hall', "shortName": 'HELD', "latitude": 30.615123, "longitude": -96.338690, "type": 'academic' },
    { "id": 'mphy', "name": 'Mitchell Physics Building', "shortName": 'MPHY', "latitude": 30.620257, "longitude": -96.342438, "type": 'academic' },
    { "id": 'acad', "name": 'Academic Building', "shortName": 'ACAD', "latitude": 30.615774, "longitude": -96.340765, "type": 'academic' },
    { "id": 'wehner', "name": 'Mays Business School (Wehner)', "shortName": 'WEHNER', "latitude": 30.610607, "longitude": -96.350805, "type": 'academic' },
    { "id": 'oam', "name": 'Oceanography & Meteorology Building', "shortName": 'O&M', "latitude": 30.617721, "longitude": -96.336654, "type": 'academic' },
    { "id": 'bsbe', "name": 'Biological Sciences Building East', "shortName": 'BSBE', "latitude": 30.615807, "longitude": -96.339324, "type": 'academic' },
    { "id": 'hecl', "name": 'Harrington Education Center', "shortName": 'HECC', "latitude": 30.616879, "longitude": -96.340422, "type": 'academic' },
    { "id": 'petr', "name": 'Peterson Building', "shortName": 'PETR', "latitude": 30.615977, "longitude": -96.338580, "type": 'academic' },
    { "id": 'rich', "name": 'Richardson Building', "shortName": 'RICH', "latitude": 30.619482, "longitude": -96.339362, "type": 'academic' },
    { "id": 'thom', "name": 'Thompson Hall', "shortName": 'THOM', "latitude": 30.617234, "longitude": -96.341263, "type": 'academic' },
    { "id": 'bright', "name": 'Bright Building', "shortName": 'BRGT', "latitude": 30.618997, "longitude": -96.338799, "type": 'academic' },
    { "id": 'kleb', "name": 'Kleberg Center', "shortName": 'KLEB', "latitude": 30.610608, "longitude": -96.347359, "type": 'academic' },
    { "id": 'coke', "name": 'Coke Building', "shortName": 'COKE', "latitude": 30.614612, "longitude": -96.341710, "type": 'academic' },
    { "id": 'chem', "name": 'Chemistry Building', "shortName": 'CHEM', "latitude": 30.617993, "longitude": -96.339923, "type": 'academic' },
    { "id": 'butler', "name": 'Butler Hall', "shortName": 'BLHR', "latitude": 30.614837, "longitude": -96.338930, "type": 'academic' },
    { "id": 'scc', "name": 'Student Computing Center', "shortName": 'SCC', "latitude": 30.615940, "longitude": -96.338020, "type": 'academic' },
    { "id": 'ilsb', "name": 'Interdisciplinary Life Sciences Building', "shortName": 'ILSB', "latitude": 30.614294, "longitude": -96.343648, "type": 'academic' },
    { "id": 'lassb', "name": 'Liberal Arts and Social Sciences Building', "shortName": 'LASB', "latitude": 30.617678, "longitude": -96.337963, "type": 'academic' },
    { "id": 'john-koldus', "name": 'John J. Koldus Building', "shortName": 'KOLDUS', "latitude": 30.612192, "longitude": -96.339285, "type": 'academic' },
    { "id": 'bush-lib', "name": 'George H.W. Bush Presidential Library', "shortName": 'BUSH', "latitude": 30.596584, "longitude": -96.353922, "type": 'library' },
    { "id": 'century', "name": 'Century Tree', "shortName": 'CENTURY', "latitude": 30.615915, "longitude": -96.341415, "type": 'landmark' },
    { "id": 'bonfire', "name": 'Bonfire Memorial', "shortName": 'BONFIRE', "latitude": 30.622430, "longitude": -96.334618, "type": 'landmark' },
    { "id": 'sdf', "name": 'Simpson Drill Field', "shortName": 'SDF', "latitude": 30.613446, "longitude": -96.342869, "type": 'landmark' },
    { "id": 'albritton', "name": 'Albritton Bell Tower', "shortName": 'ALBRITTON', "latitude": 30.613110, "longitude": -96.344661, "type": 'landmark' },
    { "id": 'aggie-park', "name": 'Aggie Park', "shortName": 'AGGIE PARK', "latitude": 30.610474, "longitude": -96.337630, "type": 'landmark' },
    { "id": 'academic-plaza', "name": 'Academic Plaza', "shortName": 'PLAZA', "latitude": 30.6154, "longitude": -96.3409, "type": 'landmark' },
    { "id": 'kyle', "name": 'Kyle Field', "shortName": 'KYLE', "latitude": 30.609936, "longitude": -96.340453, "type": 'athletics' },
    { "id": 'reed', "name": 'Reed Arena', "shortName": 'REED', "latitude": 30.605848, "longitude": -96.346208, "type": 'athletics' },
    { "id": 'olsen', "name": 'Olsen Field (Blue Bell Park)', "shortName": 'OLSEN', "latitude": 30.605389, "longitude": -96.341526, "type": 'athletics' },
    { "id": 'rec', "name": 'Student Recreation Center', "shortName": 'REC', "latitude": 30.607120, "longitude": -96.345403, "type": 'recreation' },
    { "id": 'polo', "name": 'Polo Road Rec Fields', "shortName": 'POLO', "latitude": 30.624960, "longitude": -96.335857, "type": 'athletics' },
    { "id": 'hulla', "name": 'Hullabaloo Hall', "shortName": 'HULLA', "latitude": 30.616460, "longitude": -96.346322, "type": 'housing' },
    { "id": 'corps', "name": 'Corps of Cadets Quad', "shortName": 'CORPS', "latitude": 30.618159, "longitude": -96.337195, "type": 'housing' },
    { "id": 'white', "name": 'White Creek Apartments', "shortName": 'WCREEK', "latitude": 30.607633, "longitude": -96.356167, "type": 'housing' },
    { "id": 'neeley', "name": 'Neeley Hall', "shortName": 'NEELEY', "latitude": 30.617973, "longitude": -96.344396, "type": 'housing' },
    { "id": 'mosher', "name": 'Mosher Hall', "shortName": 'MOSHER', "latitude": 30.615450, "longitude": -96.335169, "type": 'housing' },
    { "id": 'aston', "name": 'Aston Hall', "shortName": 'ASTON', "latitude": 30.614675, "longitude": -96.336307, "type": 'housing' },
    { "id": 'krueger', "name": 'Krueger Hall', "shortName": 'KRUEGER', "latitude": 30.615948, "longitude": -96.335541, "type": 'housing' },
    { "id": 'davis-gary', "name": 'Davis-Gary Hall', "shortName": 'DAVIS-GARY', "latitude": 30.615533, "longitude": -96.346435, "type": 'housing' },
]

# 3. Frontend Amenities (from campus.ts hardcoded lists)
FRONTEND_AMENITIES = [
    { "id": 'starbucks-msc', "name": 'Starbucks (MSC)', "latitude": 30.612309, "longitude": -96.341378, "type": 'coffee' },
    { "id": 'underground-food', "name": 'Underground Food Court', "latitude": 30.617020, "longitude": -96.343250, "type": 'dining' },
    { "id": 'cfa', "name": 'Chick-fil-A (MSC)', "latitude": 30.611881, "longitude": -96.341541, "type": 'dining' },
    { "id": 'panda-msc', "name": 'Panda Express (MSC)', "latitude": 30.612020, "longitude": -96.341180, "type": 'dining' },
    { "id": 'revs-msc-food', "name": "Rev's American Grill (MSC)", "latitude": 30.612180, "longitude": -96.341020, "type": 'dining' },
    { "id": 'houston-msc', "name": 'Houston Street Subs (MSC)', "latitude": 30.612110, "longitude": -96.341240, "type": 'dining' },
    { "id": 'abu-omar-msc', "name": 'Abu Omar Halal (MSC)', "latitude": 30.612310, "longitude": -96.341060, "type": 'dining' },
    { "id": 'panda-polo', "name": 'Panda Express (Polo)', "latitude": 30.622780, "longitude": -96.337860, "type": 'dining' },
    { "id": 'salata-polo', "name": 'Salata (Polo)', "latitude": 30.622640, "longitude": -96.337820, "type": 'dining' },
    { "id": 'shake-polo', "name": 'Shake Smart (Polo)', "latitude": 30.622590, "longitude": -96.337980, "type": 'dining' },
    { "id": 'rr-msc', "name": 'Restroom (MSC 1st Floor)', "latitude": 30.612309, "longitude": -96.341378, "type": 'restroom' },
    { "id": 'rr-evans', "name": 'Restroom (Evans Library)', "latitude": 30.616607, "longitude": -96.339047, "type": 'restroom' },
    { "id": 'rr-blocker', "name": 'Restroom (Blocker 1st Floor)', "latitude": 30.619539, "longitude": -96.342120, "type": 'restroom' },
    { "id": 'rr-zach', "name": 'Restroom (Zachry 1st Floor)', "latitude": 30.621252, "longitude": -96.340241, "type": 'restroom' },
    { "id": 'rr-rudder', "name": 'Restroom (Rudder Tower)', "latitude": 30.613251, "longitude": -96.339957, "type": 'restroom' },
    { "id": 'rr-rec', "name": 'Restroom (Rec Center)', "latitude": 30.607120, "longitude": -96.345403, "type": 'restroom' },
    { "id": 'study-annex', "name": 'Study Room (Annex)', "latitude": 30.616300, "longitude": -96.338340, "type": 'study' },
    { "id": 'study-wcl', "name": 'Study Room (West Campus Library)', "latitude": 30.611570, "longitude": -96.350164, "type": 'study' },
    { "id": 'study-bloc', "name": 'Study Lounge (Blocker)', "latitude": 30.619539, "longitude": -96.342120, "type": 'study' },
    { "id": 'study-zach', "name": 'Study Area (Zachry)', "latitude": 30.621252, "longitude": -96.340241, "type": 'study' },
    { "id": 'lot30', "name": 'Parking Lot 30', "latitude": 30.6190, "longitude": -96.3360, "type": 'parking' },
    { "id": 'lot50', "name": 'Parking Lot 50', "latitude": 30.624159, "longitude": -96.336872, "type": 'parking' },
    { "id": 'garage-cain', "name": 'Cain Parking Garage', "latitude": 30.616487, "longitude": -96.337744, "type": 'parking' },
    { "id": 'garage-polo', "name": 'Polo Road Garage', "latitude": 30.623512, "longitude": -96.338044, "type": 'parking' },
    { "id": 'garage-west-campus', "name": 'West Campus Garage', "latitude": 30.608453, "longitude": -96.344415, "type": 'parking' },
    { "id": 'garage-university-center', "name": 'University Center Garage', "latitude": 30.612052, "longitude": -96.338745, "type": 'parking' },
    { "id": 'lot100', "name": 'Parking Lot 100', "latitude": 30.604888, "longitude": -96.341547, "type": 'parking' },
    { "id": 'lot61', "name": 'Parking Lot 61', "latitude": 30.6088, "longitude": -96.3348, "type": 'parking' },
    { "id": 'lot74', "name": 'Parking Lot 74', "latitude": 30.608658, "longitude": -96.347988, "type": 'parking' },
]

# 4. Traffic Overrides (from traffic.py)
TRAFFIC_DATA = {
    "Sbisa Dining Hall":              {"lat": 30.617135, "lng": -96.343777, "type": "Dining"},
    "Duncan Dining Hall":             {"lat": 30.612072, "lng": -96.335505, "type": "Dining"},
    "West Campus Dining Facility":    {"lat": 30.61020, "lng": -96.34863, "type": "Dining"},
    "Memorial Student Center (MSC)":  {"lat": 30.61223, "lng": -96.34137, "type": "Dining"},
    "Polo Road Garage":               {"lat": 30.62313, "lng": -96.33749, "type": "Dining"},
    "Creekside Market":               {"lat": 30.60756, "lng": -96.35381, "type": "Dining"},
}

def normalize_key(value: str) -> str:
    text = (value or "").strip().lower()
    text = text.replace("&", " and ")
    return re.sub(r"[^a-z0-9]+", " ", text).strip()

EXCLUDED_PLACE_NAMES = {
    normalize_key("Sweet Eugene's Coffee"),
    normalize_key("Sweet Eugene's Java House"),
}

def run_migration():
    print(f"--- Starting Full Consolidation to {DB_PATH.name} ---")
    
    if DB_PATH.exists():
        os.remove(DB_PATH)
        print("Removed existing database.")

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    # Create Schema
    cur.execute("""
        CREATE TABLE places (
            place_id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            short_name TEXT,
            type TEXT,
            lat REAL NOT NULL,
            lng REAL NOT NULL,
            description TEXT,
            hours TEXT,
            features TEXT,
            address TEXT,
            search_only INTEGER DEFAULT 0,
            source TEXT
        )
    """)
    cur.execute("""
        CREATE TABLE aliases (
            place_id TEXT,
            alias TEXT,
            PRIMARY KEY (place_id, alias),
            FOREIGN KEY (place_id) REFERENCES places(place_id)
        )
    """)
    
    # --- PHASE 0: Collect all "Premium" names to block OSM/Legacy duplicates ---
    PREMIUM_NAMES = set()
    for sp in SPECIAL_PLACES:
        PREMIUM_NAMES.add(normalize_key(sp["name"]))
        for alias in sp.get("aliases", []):
            PREMIUM_NAMES.add(normalize_key(alias))
    for b in FRONTEND_PRIMARY:
        PREMIUM_NAMES.add(normalize_key(b["name"]))
        if b["shortName"]:
            PREMIUM_NAMES.add(normalize_key(b["shortName"]))
    for a in FRONTEND_AMENITIES:
        PREMIUM_NAMES.add(normalize_key(a["name"]))

    print(f"Blocking {len(PREMIUM_NAMES)} unique premium locations from OSM/Legacy source records...")

    # 1. Load Base OSM Data (with Duplicate Blocking)
    if OSM_DATA_PATH.exists():
        with open(OSM_DATA_PATH, "r", encoding="utf-8") as f:
            osm_root = json.load(f)
        osm_data = osm_root.get("places", [])
        print(f"Checking {len(osm_data)} OSM points for premium conflicts...")
        skipped = 0
        for row in osm_data:
            nk = normalize_key(row["name"])
            if nk in EXCLUDED_PLACE_NAMES:
                skipped += 1
                continue
            if nk in PREMIUM_NAMES:
                skipped += 1
                continue
            
            cur.execute(
                "INSERT INTO places (place_id, name, short_name, type, lat, lng, search_only, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (row["place_id"], row["name"], row.get("short_name"), row["type"], row["lat"], row["lng"], 1 if row.get("search_only") else 0, "osm")
            )
            cur.execute("INSERT OR IGNORE INTO aliases (place_id, alias) VALUES (?, ?)", (row["place_id"], nk))
            if row.get("short_name"):
                 cur.execute("INSERT OR IGNORE INTO aliases (place_id, alias) VALUES (?, ?)", (row["place_id"], normalize_key(row["short_name"])))
        print(f"Skipped {skipped} conflicting OSM records.")

    # 3. Apply Frontend Primary Overrides (Academic, Housing, Landmark, etc)
    print(f"Applying {len(FRONTEND_PRIMARY)} Frontend Buildings (WINS)...")
    for b in FRONTEND_PRIMARY:
        cur.execute("""
            INSERT INTO places (place_id, name, short_name, type, lat, lng, source)
            VALUES (?, ?, ?, ?, ?, ?, 'frontend')
            ON CONFLICT(place_id) DO UPDATE SET
                name=excluded.name, short_name=excluded.short_name, type=excluded.type, lat=excluded.lat, lng=excluded.lng, source='frontend'
        """, (b["id"], b["name"], b["shortName"], b["type"], b["latitude"], b["longitude"]))
        cur.execute("INSERT OR IGNORE INTO aliases (place_id, alias) VALUES (?, ?)", (b["id"], normalize_key(b["name"])))
        if b["shortName"]:
             cur.execute("INSERT OR IGNORE INTO aliases (place_id, alias) VALUES (?, ?)", (b["id"], normalize_key(b["shortName"])))

    # 4. Apply Frontend Amenities
    print(f"Applying {len(FRONTEND_AMENITIES)} Frontend Amenities (WINS)...")
    for a in FRONTEND_AMENITIES:
        cur.execute("""
            INSERT INTO places (place_id, name, type, lat, lng, source)
            VALUES (?, ?, ?, ?, ?, 'amenity')
            ON CONFLICT(place_id) DO UPDATE SET
                name=excluded.name, type=excluded.type, lat=excluded.lat, lng=excluded.lng, source='amenity'
        """, (a["id"], a["name"], a["type"], a["latitude"], a["longitude"]))
        cur.execute("INSERT OR IGNORE INTO aliases (place_id, alias) VALUES (?, ?)", (a["id"], normalize_key(a["name"])))

    # 5. Apply Specialty Overrides (High priority aliases + Metadata)
    print(f"Applying {len(SPECIAL_PLACES)} Specialty Aliases (WINS)...")
    for sp in SPECIAL_PLACES:
        features_json = json.dumps(sp.get("features", [])) if sp.get("features") else None
        cur.execute("""
            INSERT INTO places (place_id, name, short_name, type, lat, lng, description, hours, features, source)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'special')
            ON CONFLICT(place_id) DO UPDATE SET
                name=excluded.name, short_name=excluded.short_name, type=excluded.type, 
                lat=excluded.lat, lng=excluded.lng, 
                description=excluded.description, hours=excluded.hours, features=excluded.features,
                source='special'
        """, (sp["place_id"], sp["name"], sp["short_name"], sp["type"], sp["lat"], sp["lng"], sp.get("description"), sp.get("hours"), features_json))
        cur.execute("INSERT OR IGNORE INTO aliases (place_id, alias) VALUES (?, ?)", (sp["place_id"], normalize_key(sp["name"])))
        for alias in sp.get("aliases", []):
            cur.execute("INSERT OR IGNORE INTO aliases (place_id, alias) VALUES (?, ?)", (sp["place_id"], normalize_key(alias)))

    # 6. Apply Traffic Sync (Last word on Coordinates)
    print(f"Applying {len(TRAFFIC_DATA)} Traffic Coordinate Syncs (MASTER COORDS)...")
    for name, data in TRAFFIC_DATA.items():
        # Update EVERY record that matches this alias (broad update)
        cur.execute("SELECT DISTINCT place_id FROM aliases WHERE alias = ?", (normalize_key(name),))
        ids = cur.fetchall()
        for res in ids:
            cur.execute("UPDATE places SET lat=?, lng=?, type=COALESCE(?, type) WHERE place_id=?", (data["lat"], data["lng"], data.get("type"), res[0]))

    conn.commit()
    conn.close()
    print("--- Canonical Deduplication Migration Complete ---")

if __name__ == "__main__":
    run_migration()
