import requests
from typing import List, Optional

API_BASE = "https://api-aggiesbp.servehttp.com"

# In-memory caches to avoid hitting the API repeatedly during the same run
_courses_cache = None
_sections_cache = None
_professors_cache = None

def _fetch_courses() -> List[dict]:
    global _courses_cache
    if _courses_cache is None:
        try:
            print("Fetching courses from API...")
            resp = requests.get(f"{API_BASE}/courses?limit=10000", timeout=30)
            resp.raise_for_status()
            _courses_cache = resp.json()
        except Exception as e:
            print(f"Error fetching courses: {e}")
            _courses_cache = []
    return _courses_cache

def _fetch_sections() -> List[dict]:
    global _sections_cache
    if _sections_cache is None:
        try:
            print("Fetching sections from API...")
            resp = requests.get(f"{API_BASE}/sections?limit=100000", timeout=60)
            resp.raise_for_status()
            _sections_cache = resp.json()
        except Exception as e:
            print(f"Error fetching sections: {e}")
            _sections_cache = []
    return _sections_cache

def _fetch_professors() -> List[dict]:
    global _professors_cache
    if _professors_cache is None:
        try:
            print("Fetching professors from API...")
            resp = requests.get(f"{API_BASE}/professors?limit=10000", timeout=30)
            resp.raise_for_status()
            _professors_cache = resp.json()
        except Exception as e:
            print(f"Error fetching professors: {e}")
            _professors_cache = []
    return _professors_cache

def get_all_courses() -> List[dict]:
    return _fetch_courses()

def get_course_by_id(course_id: str) -> Optional[dict]:
    courses = _fetch_courses()
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
    courses = _fetch_courses()
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
                
                sec_match = True
                break
            
            if not sec_match:
                continue
                
        results.append(c)
        if len(results) >= limit:
            break
            
    return results

def _simplify_name(name: str) -> str:
    if not name: return ""
    import re
    parts = re.sub(r'[^a-zA-Z\s]', '', name.lower()).split()
    if len(parts) >= 2:
        return f"{parts[0]} {parts[-1]}"
    return parts[0] if parts else ""

def get_sections_for_course(course_id: str) -> List[dict]:
    sections = _fetch_sections()
    professors = _fetch_professors()
    
    # Create professor lookup map for quick rating assignment based on simplified name
    prof_map = {}
    for p in professors:
        if "name" in p and p["name"]:
            s_name = _simplify_name(p["name"])
            prof_map[s_name] = p
    
    results = []
    for s in sections:
        # Reconstruct course ID as mapped earlier: dept + courseNumber
        sec_course_id = str(s.get("dept", "")) + str(s.get("courseNumber", ""))
        sec_course_key = str(s.get("course", ""))
        if sec_course_id == course_id or sec_course_key == course_id:
            # We modify in-place for simplicity. Real implementation might deepcopy.
            for inst in s.get("instructors", []):
                if inst and "name" in inst:
                    s_inst_name = _simplify_name(inst["name"])
                    p_data = prof_map.get(s_inst_name)
                    if p_data:
                        inst["overall_rating"] = p_data.get("overall_rating")
                        inst["total_reviews"] = p_data.get("total_reviews")
            results.append(s)
    return results

def get_section_by_id(section_id: str) -> Optional[dict]:
    sections = _fetch_sections()
    professors = _fetch_professors()
    
    prof_map = {}
    for p in professors:
        if "name" in p and p["name"]:
            s_name = _simplify_name(p["name"])
            prof_map[s_name] = p
            
    for s in sections:
        if str(s.get("id")) == section_id:
            # Attach professor ratings
            for inst in s.get("instructors", []):
                if inst and "name" in inst:
                    s_inst_name = _simplify_name(inst["name"])
                    p_data = prof_map.get(s_inst_name)
                    if p_data:
                        inst["overall_rating"] = p_data.get("overall_rating")
                        inst["total_reviews"] = p_data.get("total_reviews")
            return s
            
    return None

def search_sections(term: Optional[str] = None, course_code: Optional[str] = None) -> List[dict]:
    sections = _fetch_sections()
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
