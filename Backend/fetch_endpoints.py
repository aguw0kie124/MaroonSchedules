import os
import json
import time
from urllib.parse import urlencode, urljoin, urlparse, parse_qs, urlunparse
import requests

BASE_URL = "https://api-aggiesbp.servehttp.com"
LIMIT_VALUE = "10000000000000000"
TIMEOUT = 300

# Sampling limits to avoid excessive runtime
COURSE_SAMPLE_LIMIT = 50
PROFESSOR_SAMPLE_LIMIT = 50

# All GET endpoints requested by user
STATIC_GET_PATHS = [
    "/",
    "/health",
    "/db-status",
    "/data_stats",
    "/terms",
    "/sections",
    "/departments_info",
    "/departments",
    "/courses",
    "/professors",
    "/professor/find",
    "/professors/search",
    "/professors/compare",
]

def with_limit(url: str) -> str:
    parsed = urlparse(url)
    qs = parse_qs(parsed.query)
    if "limit" not in qs:
        qs["limit"] = [LIMIT_VALUE]
    new_query = urlencode(qs, doseq=True)
    return urlunparse(parsed._replace(query=new_query))

def build_url(path: str) -> str:
    url = urljoin(BASE_URL + "/", path.lstrip("/"))
    return with_limit(url)

def safe_filename_from_path(path: str) -> str:
    if path == "/":
        return "root.txt"
    name = path.strip("/")
    name = name.replace("/", "_")
    if not name:
        name = "root"
    return f"{name}.txt"

def fetch_and_write(path: str):
    url = build_url(path)
    filename = safe_filename_from_path(path)
    
    print(f"Fetching {url} -> {filename}")
    try:
        resp = requests.get(url, timeout=TIMEOUT)
        resp.raise_for_status()
        with open(filename, "w", encoding="utf-8") as f:
            f.write(resp.text)
    except Exception as e:
        print(f"Failed to fetch {path}: {e}")

def load_json_file(filename):
    if not os.path.exists(filename):
        print(f"Warning: {filename} not found.")
        return []
    with open(filename, "r", encoding="utf-8") as f:
        try:
            return json.load(f)
        except Exception as e:
            print(f"Error parsing {filename}: {e}")
            return []

def main():
    os.makedirs(".", exist_ok=True)
    
    # 1. Fetch Static Endpoints
    print("--- Fetching Static Endpoints ---")
    for path in STATIC_GET_PATHS:
        fetch_and_write(path)

    # 2. Load parameters
    print("--- Loading Parameters ---")
    terms = load_json_file("terms.txt")
    courses = load_json_file("courses.txt")
    professors = load_json_file("professors.txt")
    departments = load_json_file("departments.txt")

    term_codes = [t.get("termCode") for t in terms if t.get("termCode")]
    course_data = [{"id": c.get("id"), "code": c.get("code")} for c in courses if c.get("id") and c.get("code")]
    professor_ids = [p.get("id") for p in professors if p.get("id")]
    dept_codes = [d.get("code") for d in departments if d.get("code")]

    print(f"Extracted: {len(term_codes)} terms, {len(course_data)} courses, {len(professor_ids)} professors, {len(dept_codes)} departments")

    # 3. Dynamic Endpoints
    
    # Term-based
    print("--- Fetching Term-based Endpoints ---")
    for tc in term_codes:
        # Sections per term
        fetch_and_write(f"/sections/{tc}")
        # Discover per term
        fetch_and_write(f"/discover/{tc}/departments")
        fetch_and_write(f"/discover/{tc}/ucc")
        # Discover per term and department
        for dc in dept_codes:
            fetch_and_write(f"/discover/{tc}/{dc}")

    # Course-based (Sampled)
    print(f"--- Fetching Course-based Endpoints (Sampled to {COURSE_SAMPLE_LIMIT}) ---")
    sampled_courses = course_data[:COURSE_SAMPLE_LIMIT]
    for c in sampled_courses:
        cid = c["id"]
        ccode = c["code"]
        fetch_and_write(f"/course/{cid}")
        fetch_and_write(f"/course/{cid}/professors") #still continuing
        
        # Term + Course combo (Using most recent term for efficiency)
        if term_codes:
            tc = term_codes[0]
            fetch_and_write(f"/sections/{tc}/course/{ccode}")
            fetch_and_write(f"/sections/{tc}/course/{ccode}/professors")
            fetch_and_write(f"/sections/{tc}/course/{ccode}/professors/details")

    # Professor-based (Sampled)
    print(f"--- Fetching Professor-based Endpoints (Sampled to {PROFESSOR_SAMPLE_LIMIT}) ---")
    sampled_professors = professor_ids[:PROFESSOR_SAMPLE_LIMIT]
    for pid in sampled_professors:
        fetch_and_write(f"/professor/{pid}")
        fetch_and_write(f"/professor/{pid}/reviews")
        
        # Course + Professor Review combo
        if sampled_courses:
            cid = sampled_courses[0]["id"]
            fetch_and_write(f"/course/{cid}/reviews/{pid}")

    print("--- All requested endpoints processed ---")

if __name__ == "__main__":
    main()
