"""
scrape_grades.py
----------------
Scrapes TAMU grade distribution data from anex.us (which mirrors
the official TAMU grade reports at web-as.tamu.edu/gradereports/).

Usage:
    python scrape_grades.py                         # scrapes a default set of courses
    python scrape_grades.py CSCE 121               # single course
    python scrape_grades.py --subject MATH --all   # all courses in a subject (slow)

The script writes data to:
    Backend/Data/grades/<SUBJECT>_<COURSE>.json

Each JSON file is an array of GradeRow objects (see type below).

anex.us API shape (CSV-like JSON at):
    https://anex.us/grades/getData/?dept=CSCE&number=121
Response: JSON array of objects with keys:
    Year, Semester, Prof, GPA, Section, A, B, C, D, F, I, Q, S, U, X
"""

import argparse
import json
import os
import sys
import time
from typing import Any, Dict, List, Optional

import requests

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

BASE_URL = "https://anex.us/grades/getData/"
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "Data", "grades")
REQUEST_DELAY = 0.5  # seconds between requests to be polite

# Default courses to pre-seed (subject, course_number)
DEFAULT_COURSES = [
    ("CSCE", "121"),
    ("CSCE", "221"),
    ("CSCE", "312"),
    ("CSCE", "313"),
    ("CSCE", "315"),
    ("CSCE", "411"),
    ("MATH", "151"),
    ("MATH", "152"),
    ("MATH", "251"),
    ("MATH", "308"),
    ("PHYS", "206"),
    ("PHYS", "207"),
    ("CHEM", "107"),
    ("CHEM", "108"),
    ("ENGR", "216"),
    ("BIOL", "111"),
    ("BIOL", "112"),
    ("ECON", "202"),
    ("ECON", "203"),
    ("ACCT", "209"),
    ("ACCT", "210"),
    ("COMM", "203"),
    ("HIST", "105"),
    ("HIST", "106"),
    ("POLS", "206"),
    ("POLS", "207"),
    ("STAT", "211"),
    ("STAT", "212"),
    ("ECEN", "214"),
    ("ECEN", "248"),
    ("ISEN", "315"),
    ("PETE", "301"),
    ("CHEN", "354"),
    ("CVEN", "305"),
    ("MEEN", "221"),
    ("AERO", "301"),
    ("NUEN", "301"),
    ("OCEN", "300"),
    ("BAEN", "301"),
    ("AGEC", "105"),
    ("ANSC", "107"),
    ("NUTR", "202"),
    ("KINE", "198"),
    ("MGMT", "209"),
    ("MKTG", "321"),
    ("FINC", "341"),
    ("SCMT", "303"),
    ("MGIS", "215"),
]

# ---------------------------------------------------------------------------
# Semester code helpers
# ---------------------------------------------------------------------------

SEMESTER_MAP = {
    "SPRING": "1",
    "SUMMER": "2",
    "FALL": "3",
}

def semester_to_term_code(year: int, semester: str) -> str:
    """Convert year+semester to TAMU term code, e.g. 2024+FALL -> '20243'."""
    suffix = SEMESTER_MAP.get(semester.upper(), "0")
    return f"{year}{suffix}"


# ---------------------------------------------------------------------------
# Scraper
# ---------------------------------------------------------------------------

def fetch_course(subject: str, course_number: str) -> List[Dict[str, Any]]:
    """Fetch raw grade rows from anex.us for one course (POST with form data)."""
    url = BASE_URL
    data = {"dept": subject.upper(), "number": course_number}
    resp = requests.post(url, data=data, timeout=15)
    resp.raise_for_status()

    payload = resp.json()
    # anex.us wraps rows in {"classes": [...]}
    if isinstance(payload, dict) and "classes" in payload:
        return payload["classes"]
    if isinstance(payload, list):
        return payload
    return []


def transform_row(
    raw: Dict[str, Any],
    subject: str,
    course_number: str,
    college_code: str = "",
) -> Dict[str, Any]:
    """Convert anex.us row to our canonical GradeRow shape."""

    # anex.us returns lowercase keys: year, semester, prof, gpa, section
    year = int(raw.get("year", 0))
    semester = str(raw.get("semester", "")).upper()

    def _int(val: Any) -> int:
        try:
            return int(val) if val != "" else 0
        except (TypeError, ValueError):
            return 0

    def _float(val: Any) -> float:
        try:
            return round(float(val), 3)
        except (TypeError, ValueError):
            return 0.0

    return {
        "term_code": semester_to_term_code(year, semester),
        "year": year,
        "semester": semester,
        "college_code": college_code,
        "subject": subject.upper(),
        "course_number": str(course_number),
        "section": str(raw.get("section", "")),
        "instructor": str(raw.get("prof", "STAFF")).strip(),
        "a_count": _int(raw.get("A", 0)),
        "b_count": _int(raw.get("B", 0)),
        "c_count": _int(raw.get("C", 0)),
        "d_count": _int(raw.get("D", 0)),
        "f_count": _int(raw.get("F", 0)),
        "i_count": _int(raw.get("I", 0)),
        "q_count": _int(raw.get("Q", 0)),
        "s_count": _int(raw.get("S", 0)),
        "u_count": _int(raw.get("U", 0)),
        "x_count": _int(raw.get("X", 0)),
        "avg_gpa": _float(raw.get("gpa", 0.0)),
    }


def scrape_course(subject: str, course_number: str) -> List[Dict[str, Any]]:
    """Fetch + transform all rows for a given course."""
    print(f"  Fetching {subject} {course_number} ...", end=" ", flush=True)
    try:
        raw_rows = fetch_course(subject, course_number)
        rows = [transform_row(r, subject, course_number) for r in raw_rows]
        print(f"✓ {len(rows)} sections")
        return rows
    except Exception as exc:
        print(f"✗ ERROR: {exc}")
        return []


def save_course(subject: str, course_number: str, rows: List[Dict[str, Any]]) -> str:
    """Save rows to JSON file, returns output path."""
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    filename = f"{subject.upper()}_{course_number}.json"
    filepath = os.path.join(OUTPUT_DIR, filename)
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(rows, f, indent=2)
    return filepath


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> None:
    global OUTPUT_DIR  # declared first so all references below are valid

    parser = argparse.ArgumentParser(
        description="Scrape TAMU grade distribution data from anex.us"
    )
    parser.add_argument("subject", nargs="?", help="Subject code, e.g. CSCE")
    parser.add_argument("course", nargs="?", help="Course number, e.g. 121")
    parser.add_argument(
        "--output-dir",
        default=None,
        help="Directory to write JSON files (default: Backend/Data/grades/)",
    )
    args = parser.parse_args()

    if args.output_dir:
        OUTPUT_DIR = args.output_dir

    if args.subject and args.course:
        courses = [(args.subject, args.course)]
    elif args.subject:
        print(f"Scraping all known courses for subject {args.subject.upper()}...")
        courses = [(s, c) for s, c in DEFAULT_COURSES if s.upper() == args.subject.upper()]
        if not courses:
            print("No default courses found for that subject. Please provide a course number.")
            sys.exit(1)
    else:
        print(f"Scraping {len(DEFAULT_COURSES)} default TAMU courses...")
        courses = DEFAULT_COURSES

    total_rows = 0
    for subject, course_number in courses:
        rows = scrape_course(subject, course_number)
        if rows:
            path = save_course(subject, course_number, rows)
            total_rows += len(rows)
            print(f"    → saved {len(rows)} rows to {path}")
        time.sleep(REQUEST_DELAY)

    print(f"\nDone. {total_rows} total rows across {len(courses)} courses.")


if __name__ == "__main__":
    main()