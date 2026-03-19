import json
import os
from typing import List, Optional

# Constants for file paths to make transition easier
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "Data")
COURSES_FILE = os.path.join(DATA_DIR, "Courses", "master_courses.txt")
SECTIONS_FILE = os.path.join(DATA_DIR, "Sections", "master_sections.txt")

# In-memory caches
_courses_cache = None
_sections_cache = None

def _load_courses() -> List[dict]:
    global _courses_cache
    if _courses_cache is None:
        try:
            with open(COURSES_FILE, "r", encoding="utf-8") as f:
                _courses_cache = json.load(f)
        except FileNotFoundError:
            _courses_cache = []
    return _courses_cache

def _load_sections() -> List[dict]:
    global _sections_cache
    if _sections_cache is None:
        try:
            with open(SECTIONS_FILE, "r", encoding="utf-8") as f:
                _sections_cache = json.load(f)
        except FileNotFoundError:
            _sections_cache = []
    return _sections_cache

def get_all_courses() -> List[dict]:
    """
    TODO: Replace with PostgreSQL query: `SELECT * FROM courses`
    """
    return _load_courses()

def get_course_by_id(course_id: str) -> Optional[dict]:
    """
    TODO: Replace with PostgreSQL query: `SELECT * FROM courses WHERE id = %s`
    """
    courses = _load_courses()
    for c in courses:
        if str(c.get("id")) == course_id:
            return c
    return None

def search_courses(
    dept: Optional[str] = None,
    location: Optional[str] = None,
    course_number: Optional[str] = None,
    section_attribute: Optional[str] = None,
    instructor: Optional[str] = None,
    crn: Optional[str] = None,
    limit: int = 5
) -> List[dict]:
    """
    TODO: Replace with Postgres queries: SELECT * FROM courses c JOIN sections s ... LIMIT 5
    """
    courses = _load_courses()
    sections = _load_sections()
    results = []
    
    for c in courses:
        # Filter by department or course number
        c_code = str(c.get("code", "")).lower()
        if dept and dept.lower() not in c_code:
            continue
        if course_number and course_number.lower() not in c_code:
            continue
            
        # Match section-specific criteria if provided
        if location or section_attribute or instructor or crn:
            c_sections = get_sections_for_course(str(c.get("id", "")))
            sec_match = False
            for s in c_sections:
                s_id = str(s.get("id", ""))
                s_crn = str(s.get("crn", ""))
                if crn and (crn.lower() not in s_id.lower() and crn.lower() not in s_crn.lower()):
                    continue
                
                if instructor:
                    insts = s.get("instructors", [])
                    has_inst = any(instructor.lower() in str(i.get("name", "")).lower() for i in insts)
                    if not has_inst:
                        continue
                
                # Assume location and attribute match (JSON files may lack this strictly)
                sec_match = True
                break
            
            if not sec_match:
                continue
                
        results.append(c)
        if len(results) >= limit:
            break
            
    return results

def get_sections_for_course(course_id: str) -> List[dict]:
    """
    TODO: Replace with PostgreSQL query: `SELECT * FROM sections WHERE course_id = %s`
    """
    sections = _load_sections()
    results = []
    for s in sections:
        # Reconstruct course ID as mapped earlier: dept + courseNumber
        sec_course_id = str(s.get("dept", "")) + str(s.get("courseNumber", ""))
        sec_course_key = str(s.get("course", ""))
        if sec_course_id == course_id or sec_course_key == course_id:
            results.append(s)
    return results

def search_sections(term: Optional[str] = None, course_code: Optional[str] = None) -> List[dict]:
    """
    TODO: Replace with PostgreSQL query filtering sections table
    """
    sections = _load_sections()
    results = sections
    if term:
        results = [s for s in results if str(s.get("termCode")) == term]
    if course_code:
        # Course code might be "CSCE 110"
        parts = course_code.split()
        if len(parts) >= 2:
            d, n = parts[0], parts[1]
            results = [s for s in results if str(s.get("dept", "")).lower() == d.lower() and str(s.get("courseNumber", "")).lower() == n.lower()]
    return results
