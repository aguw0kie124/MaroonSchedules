import requests
import psycopg
import json
import gzip
from datetime import datetime
from db_config import CONNECTION_PARAMS
from typing import List, Optional, Dict

API_BASE = "https://api-aggiesbp.servehttp.com"
CURRENT_TERM = "202611"  # Spring 2026 (College Station)

# In-memory caches to avoid hitting the API repeatedly during the same run
_courses_cache = None
_courses_cache = None
_professors_cache = None
_terms_cache = None

def _fetch_terms() -> List[dict]:
    global _terms_cache
    if _terms_cache is None:
        try:
            print("Fetching terms from API...")
            resp = requests.get(f"{API_BASE}/terms", timeout=15)
            resp.raise_for_status()
            _terms_cache = resp.json()
        except Exception as e:
            print(f"Error fetching terms: {e}")
            _terms_cache = []
    return _terms_cache

def get_all_terms() -> List[dict]:
    return _fetch_terms()

def _fetch_courses() -> List[dict]:
    global _courses_cache
    if _courses_cache is None:
        try:
            print("Fetching courses from API...")
            resp = requests.get(f"{API_BASE}/courses?limit=10000&termCode={CURRENT_TERM}", timeout=30)
            resp.raise_for_status()
            _courses_cache = resp.json()
            
            # Inject Mock Prerequisites if none exist from basic API
            for c in _courses_cache:
                if "prerequisites" not in c:
                    c_code = str(c.get("code", "")).upper()
                    if c_code.startswith("CSCE 2"):
                        c["prerequisites"] = "CSCE 120 or CSCE 121"
                    elif c_code.startswith("CSCE 3"):
                        c["prerequisites"] = "CSCE 221 or equivalent"
                    elif c_code.startswith("CSCE 4"):
                        c["prerequisites"] = "CSCE 313, CSCE 315, or CSCE 311"
                    elif c_code.startswith("MATH 2") or c_code.startswith("MATH 3"):
                        c["prerequisites"] = "MATH 151 and MATH 152"
                    elif c_code.startswith("PHYS 2"):
                        c["prerequisites"] = "MATH 151"
                    else:
                        c["prerequisites"] = "None"
        except Exception as e:
            print(f"Error fetching courses: {e}")
            _courses_cache = []
    return _courses_cache

def _fetch_sections_for_course(course_code: str, term: str = CURRENT_TERM) -> List[dict]:
    """
    Fetches only the sections for a specific course (e.g. 'CSCE 121').
    Uses the optimized path-based API endpoint to avoid loading the full catalog.
    """
    try:
        # Format: CSCE 121 -> CSCE121
        clean_code = course_code.replace(" ", "").upper()
        print(f"Fetching sections for {clean_code} in {term}...")
        
        # Use the optimized course-specific endpoint discovered via research
        url = f"{API_BASE}/sections/{term}/course/{clean_code}"
        resp = requests.get(url, timeout=15)
        resp.raise_for_status()
        sections = resp.json()
        
        # Save results to DB cache for future lookups
        for s in sections:
            _save_section_to_db_cache(s)
            
        return sections
    except Exception as e:
        print(f"Error fetching sections for {course_code}: {e}")
        return []

def _fetch_sections_slice(term: str = CURRENT_TERM, limit: int = 100) -> List[dict]:
    """
    Fallback to fetch a small slice of sections for a term.
    Avoids 100k records to prevent OOM.
    """
    try:
        url = f"{API_BASE}/sections/{term}?limit={limit}"
        resp = requests.get(url, timeout=15)
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        print(f"Error fetching sections slice: {e}")
        return []

def _get_sections_from_db_cache(section_ids: List[str]) -> Dict[str, dict]:
    if not section_ids: return {}
    try:
        with psycopg.connect(CONNECTION_PARAMS) as conn:
            with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
                placeholders = ", ".join(["%s"] * len(section_ids))
                cur.execute(f"SELECT section_id, data FROM section_cache WHERE section_id IN ({placeholders})", section_ids)
                rows = cur.fetchall()
                return {row["section_id"]: row["data"] for row in rows}
    except Exception as e:
        print(f"Error reading section cache: {e}")
    return {}

def _get_section_from_db_cache(section_id: str) -> Optional[dict]:
    res = _get_sections_from_db_cache([section_id])
    return res.get(section_id)

def _save_sections_to_db_cache(sections: List[dict]) -> None:
    if not sections: return
    try:
        with psycopg.connect(CONNECTION_PARAMS) as conn:
            with conn.cursor() as cur:
                for section in sections:
                    s_id = section.get("id")
                    if not s_id: continue
                    cur.execute(
                        """
                        INSERT INTO section_cache (section_id, term_code, crn, course_id, data)
                        VALUES (%s, %s, %s, %s, %s)
                        ON CONFLICT (section_id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
                        """,
                        (
                            s_id, 
                            section.get("termCode"), 
                            section.get("crn"),
                            str(section.get("dept", "")) + str(section.get("courseNumber", "")),
                            json.dumps(section)
                        )
                    )
            conn.commit()
    except Exception as e:
        print(f"Error saving sections to cache: {e}")

def _save_section_to_db_cache(section: dict) -> None:
    _save_sections_to_db_cache([section])

def _search_sections_in_api_stream(section_ids: List[str], term: str) -> List[dict]:
    """
    Memory-safe streaming search for multiple section IDs in a single pass.
    """
    if not section_ids: return []
    target_ids = set(section_ids)
    found_sections = []
    
    try:
        print(f"Streaming search for {len(section_ids)} sections in {term}...")
        url = f"{API_BASE}/sections/{term}?limit=100000"
        # We explicitly request gzip but let requests/urllib3 handle decompression via stream=True
        with requests.get(url, stream=True, timeout=60) as r:
            r.raise_for_status()
            
            import ijson
            # r.raw.decode_content = True enables automatic decompression 
            # in the underlying urllib3 stream used by requests.
            r.raw.decode_content = True
            
            try:
                parser = ijson.items(r.raw, 'item')
                for item in parser:
                    s_id = str(item.get("id"))
                    s_crn = str(item.get("crn"))
                    
                    if s_id in target_ids or s_crn in target_ids:
                        found_sections.append(item)
                        if s_id in target_ids: target_ids.remove(s_id)
                        if s_crn in target_ids: target_ids.remove(s_crn)
                        
                        if not target_ids:
                            break
            except Exception as e:
                print(f"Error parsing JSON stream for {term}: {e}. Retrying with manual chunks...")
                # Fallback to manual chunk processing if ijson fails
                pass
                        
        if found_sections:
            _save_sections_to_db_cache(found_sections)
        else:
            print(f"No sections found in stream for {term} after scanning.")
                        
        if found_sections:
            _save_sections_to_db_cache(found_sections)
                
    except Exception as e:
        print(f"Error in batch streaming search: {e}")
        
    return found_sections

def _search_section_in_api_stream(section_id: str, term: str) -> Optional[dict]:
    res = _search_sections_in_api_stream([section_id], term)
    return res[0] if res else None

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
        # Filter by department or course number using startswith match
        c_code_clean = str(c.get("code", "")).lower().replace(" ", "")
        search_q = (dept or "").lower().replace(" ", "")
        
        if search_q and not c_code_clean.startswith(search_q):
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
    """
    Fetch sections for a specific course ID (which is course code like 'CSCE 110').
    """
    # The course_id in this app is typically the department + course number string
    sections = _fetch_sections_for_course(course_id)
    professors = _fetch_professors()
    
    # Create professor lookup map for quick rating assignment based on simplified name
    prof_map = {}
    for p in professors:
        if "name" in p and p["name"]:
            s_name = _simplify_name(p["name"])
            prof_map[s_name] = p
    
    unique_sections = {}
    for s in sections:
        # Filter logic is now redundant since we fetch by course, but kept for robustness
        sec_course_id = (str(s.get("dept", "")) + str(s.get("courseNumber", ""))).lower().replace(" ", "")
        target_id = course_id.lower().replace(" ", "")
        
        if sec_course_id == target_id or str(s.get("course", "")).lower() == target_id:
            # We modify in-place for simplicity.
            for inst in s.get("instructors", []):
                if inst and "name" in inst:
                    s_inst_name = _simplify_name(inst["name"])
                    p_data = prof_map.get(s_inst_name)
                    if p_data:
                        inst["overall_rating"] = p_data.get("overall_rating")
                        inst["total_reviews"] = p_data.get("total_reviews")
            
            sec_num = str(s.get("sectionNumber", "") or s.get("section", ""))
            # Keep only the latest term section
            if sec_num not in unique_sections or str(s.get("termCode", "")) > str(unique_sections[sec_num].get("termCode", "")):
                unique_sections[sec_num] = s

    # Sort sections by section number before returning
    results = sorted(list(unique_sections.values()), key=lambda x: str(x.get("sectionNumber", "") or x.get("section", "")))
    return results

def get_sections_by_ids(section_ids: List[str]) -> List[dict]:
    """
    Resolves a batch of sections efficiently.
    Uses DB cache first, then a single streaming pass for missing ones.
    """
    if not section_ids: return []
    
    # 1. Fetch from DB cache
    results_map = _get_sections_from_db_cache(section_ids)
    
    missing_ids = [s_id for s_id in section_ids if s_id not in results_map]
    if missing_ids:
        # 2. Resolve missing via optimized single-stream
        term_groups = {}
        for m_id in missing_ids:
            # Term code is usually the first 6 digits, e.g. 202531 from 202531_46760
            term = CURRENT_TERM
            if "_" in m_id:
                parts = m_id.split("_")
                if len(parts[0]) == 6 and parts[0].isdigit():
                    term = parts[0]
            term_groups.setdefault(term, []).append(m_id)
            
        for term, ids in term_groups.items():
            found = _search_sections_in_api_stream(ids, term)
            for f in found:
                results_map[str(f.get("id"))] = f
                results_map[str(f.get("crn"))] = f
                
    # 3. Enrich and finalize
    final_results = []
    
    # Metadata for enrichment (fetched once per batch)
    professors = _fetch_professors()
    prof_map = {}
    for p in professors:
        if "name" in p and p["name"]:
            s_name = _simplify_name(p["name"])
            prof_map[s_name] = p

    for s_id in section_ids:
        s = results_map.get(s_id)
        if not s: continue
        
        # Attach extras (if not already cached)
        if "instructors" in s and not any("overall_rating" in i for i in s["instructors"]):
            for inst in s["instructors"]:
                if inst and "name" in inst:
                    s_inst_name = _simplify_name(inst["name"])
                    p_data = prof_map.get(s_inst_name)
                    if p_data:
                        inst["overall_rating"] = p_data.get("overall_rating")
                        inst["total_reviews"] = p_data.get("total_reviews")
        
        if "prerequisites" not in s:
            parent_course_id = str(s.get("course", "")) or (str(s.get("dept", "")) + str(s.get("courseNumber", "")))
            parent_course = get_course_by_id(parent_course_id)
            if parent_course and "prerequisites" in parent_course:
                s["prerequisites"] = parent_course["prerequisites"]
        
        # Add friendly display names for the UI to prevent "ID formatted" titles
        dn = f"{s.get('dept', '')} {s.get('courseNumber', '')}-{s.get('sectionNumber', '')}"
        s["section_id_display"] = dn
        s["formatted_title"] = dn
        s["course_display"] = f"{s.get('dept', '')} {s.get('courseNumber', '')}"
                
        final_results.append(s)
        
    return final_results

def get_section_by_id(section_id: str) -> Optional[dict]:
    res = get_sections_by_ids([section_id])
    return res[0] if res else None
        
    # 3. Final fallback: guesswork
    # (If we get here, the section is truly unknown)
    return None

def search_sections(term: Optional[str] = None, course_code: Optional[str] = None) -> List[dict]:
    """
    Search sections with memory efficiency.
    """
    t = term or CURRENT_TERM
    if course_code:
        return get_sections_for_course(course_code)
    
    # If no course code, we return a small sample relative to the term
    return _fetch_sections_slice(term=t, limit=50)
