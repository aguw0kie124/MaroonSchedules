"""
scrape_grades_full.py
---------------------
Scrapes EVERY course from anex.us by:
  1. Fetching the list of all departments from anex.us
  2. For each dept, fetching the list of all course numbers
  3. Fetching grade data for every dept+course combo

Output: Backend/Data/grades/<SUBJECT>_<COURSE>.json  (same format as before)

Usage:
    python3 scrape_grades_full.py                  # scrape everything
    python3 scrape_grades_full.py --dept CSCE      # one department only
    python3 scrape_grades_full.py --workers 8      # parallel workers (default 6)
    python3 scrape_grades_full.py --skip-existing  # skip already-cached files

SSL note: anex.us sometimes has cert issues. The script disables SSL verification
as a fallback (same data, just unverified cert — fine for local scraping).
"""

import argparse
import json
import os
import sys
import time
import urllib.parse
import urllib.request
import ssl
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any, Dict, List, Optional, Tuple

# ── Config ──────────────────────────────────────────────────────────────────

ANEX_BASE        = "https://anex.us/grades/getData/"
OUTPUT_DIR       = os.path.join(os.path.dirname(__file__), "Data", "grades")
MASTER_COURSES_FILE = os.path.join(os.path.dirname(__file__), "Data", "Courses", "master_courses.txt")
OUTPUT_DIR       = os.path.join(os.path.dirname(__file__), "Data", "grades")
REQUEST_DELAY    = 0.15   # seconds between requests per worker
MAX_WORKERS      = 6      # parallel threads

# SSL context that skips verification (handles expired cert on anex.us)
SSL_CTX = ssl.create_default_context()
SSL_CTX.check_hostname = False
SSL_CTX.verify_mode = ssl.CERT_NONE

SEMESTER_MAP = {"SPRING": "1", "SUMMER": "2", "FALL": "3"}

# ── HTTP helpers ─────────────────────────────────────────────────────────────

def _post(url: str, fields: Dict[str, str]) -> Any:
    """POST form data, return parsed JSON. Falls back to no-SSL-verify."""
    data = urllib.parse.urlencode(fields).encode("utf-8")
    req  = urllib.request.Request(url, data=data, method="POST")
    req.add_header("Content-Type", "application/x-www-form-urlencoded")
    req.add_header("User-Agent", "Mozilla/5.0 (compatible; TAMUGradeScraper/2.0)")
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return json.loads(r.read().decode("utf-8"))
    except urllib.error.URLError:
        # Retry without SSL verification
        with urllib.request.urlopen(req, timeout=20, context=SSL_CTX) as r:
            return json.loads(r.read().decode("utf-8"))

def get_course_jobs(target_dept: Optional[str] = None) -> List[Tuple[str, str]]:
    """Return a list of (dept, course) tuples from master_courses.txt."""
    if not os.path.exists(MASTER_COURSES_FILE):
        print(f"Error: Could not find {MASTER_COURSES_FILE}")
        return []
    
    with open(MASTER_COURSES_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    jobs = set()
    for item in data:
        code = item.get("code", "")
        parts = code.split()
        if len(parts) >= 2:
            subj = parts[0].upper()
            num = parts[1]
            if target_dept is None or subj == target_dept.upper():
                jobs.add((subj, num))
                
    return sorted(list(jobs))


# ── Transform ────────────────────────────────────────────────────────────────

def _int(v: Any) -> int:
    try:
        return int(v) if v not in ("", None) else 0
    except Exception:
        return 0

def _float(v: Any) -> float:
    try:
        return round(float(v), 3)
    except Exception:
        return 0.0

def transform_row(raw: Dict[str, Any], subject: str, course_number: str) -> Dict[str, Any]:
    year     = _int(raw.get("year", 0))
    semester = str(raw.get("semester", "")).upper()
    term     = f"{year}{SEMESTER_MAP.get(semester, '0')}"
    return {
        "term_code":     term,
        "year":          year,
        "semester":      semester,
        "college_code":  "",
        "subject":       subject.upper(),
        "course_number": str(course_number),
        "section":       str(raw.get("section", "")),
        "instructor":    str(raw.get("prof", "STAFF")).strip(),
        "a_count":       _int(raw.get("A", 0)),
        "b_count":       _int(raw.get("B", 0)),
        "c_count":       _int(raw.get("C", 0)),
        "d_count":       _int(raw.get("D", 0)),
        "f_count":       _int(raw.get("F", 0)),
        "i_count":       _int(raw.get("I", 0)),
        "q_count":       _int(raw.get("Q", 0)),
        "s_count":       _int(raw.get("S", 0)),
        "u_count":       _int(raw.get("U", 0)),
        "x_count":       _int(raw.get("X", 0)),
        "avg_gpa":       _float(raw.get("gpa", 0.0)),
    }


# ── Scrape one course ────────────────────────────────────────────────────────

def scrape_one(subject: str, course_number: str, skip_existing: bool) -> Tuple[str, str, int, Optional[str]]:
    """
    Returns (subject, course_number, row_count, error_or_None).
    Saves JSON to OUTPUT_DIR if successful.
    """
    filepath = os.path.join(OUTPUT_DIR, f"{subject.upper()}_{course_number}.json")

    if skip_existing and os.path.exists(filepath):
        with open(filepath) as f:
            rows = json.load(f)
        return (subject, course_number, len(rows), None)

    time.sleep(REQUEST_DELAY)
    try:
        payload = _post(ANEX_BASE, {"dept": subject.upper(), "number": course_number})
        raw_rows = []
        if isinstance(payload, dict) and "classes" in payload:
            raw_rows = payload["classes"]
        elif isinstance(payload, list):
            raw_rows = payload

        if not raw_rows:
            return (subject, course_number, 0, None)  # no data — not an error

        rows = [transform_row(r, subject, course_number) for r in raw_rows]
        os.makedirs(OUTPUT_DIR, exist_ok=True)
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(rows, f, indent=2)
        return (subject, course_number, len(rows), None)

    except Exception as exc:
        return (subject, course_number, 0, str(exc))


# ── Fallback department list ─────────────────────────────────────────────────

# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Scrape ALL TAMU grade data from anex.us")
    parser.add_argument("--dept",          help="Scrape only this department (e.g. CSCE)")
    parser.add_argument("--workers",       type=int, default=MAX_WORKERS, help="Parallel workers")
    parser.add_argument("--skip-existing", action="store_true", help="Skip already-cached JSON files")
    parser.add_argument("--output-dir",    default=None)
    args = parser.parse_args()

    global OUTPUT_DIR
    if args.output_dir:
        OUTPUT_DIR = args.output_dir

    # 1. Get departments / courses from master_courses.txt
    print("Reading courses from Data/Courses/master_courses.txt...")
    all_jobs = get_course_jobs(args.dept)

    if not all_jobs:
        print("\nWARNING: Course discovery returned 0 results.")
        if args.dept:
            print(f"Could not find any courses for department {args.dept} in master_courses.txt")
        sys.exit(1)

    print(f"\nTotal courses to scrape: {len(all_jobs)}")
    print("Starting parallel scrape...\n")

    # 3. Scrape in parallel
    total_rows  = 0
    errors      = []
    empty       = []
    success     = 0

    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {
            pool.submit(scrape_one, dept, course, args.skip_existing): (dept, course)
            for dept, course in all_jobs
        }
        for i, future in enumerate(as_completed(futures), 1):
            dept, course = futures[future]
            try:
                subj, num, count, err = future.result()
                if err:
                    errors.append(f"{subj} {num}: {err}")
                    print(f"  [{i}/{len(all_jobs)}] ✗ {subj} {num} — {err[:60]}")
                elif count == 0:
                    empty.append(f"{subj} {num}")
                else:
                    total_rows += count
                    success += 1
                    print(f"  [{i}/{len(all_jobs)}] ✓ {subj} {num} — {count} rows")
            except Exception as exc:
                errors.append(f"{dept} {course}: {exc}")
                print(f"  [{i}/{len(all_jobs)}] ✗ {dept} {course} — {exc}")

    # 4. Summary
    print(f"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Done!
  ✓ {success} courses saved  ({total_rows:,} total rows)
  ○ {len(empty)} courses had no data
  ✗ {len(errors)} errors
  Output: {OUTPUT_DIR}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━""")

    if errors:
        print("\nErrors:")
        for e in errors[:20]:
            print(f"  {e}")


if __name__ == "__main__":
    main()
