import os
import json
import csv
import shutil
from typing import List, Dict, Any

# Paths
BASE_DIR = r"c:\MaroonSchedules\Backend\Data\Base"
COURSES_DIR = r"c:\MaroonSchedules\Backend\Data\Courses"
PROFESSORS_DIR = r"c:\MaroonSchedules\Backend\Data\Professors"
SECTIONS_DIR = r"c:\MaroonSchedules\Backend\Data\Sections"
OUTPUT_DIR = r"c:\MaroonSchedules\Backend\csv_output"

def move_master_files():
    print("Moving master files...")
    moves = [
        ("courses.txt", os.path.join(COURSES_DIR, "master_courses.txt")),
        ("professors.txt", os.path.join(PROFESSORS_DIR, "master_professors.txt")),
        ("professors_search.txt", os.path.join(PROFESSORS_DIR, "professors_search.txt")),
        ("sections.txt", os.path.join(SECTIONS_DIR, "master_sections.txt")),
    ]
    for src_name, dst_path in moves:
        src_path = os.path.join(BASE_DIR, src_name)
        if os.path.exists(src_path):
            # shutil.move might fail if destination exists and is cross-drive, 
            # but here it's likely same drive. Using copy + remove for safety if needed,
            # but move is usually fine.
            shutil.move(src_path, dst_path)
            print(f"Moved {src_name} to {dst_path}")
        else:
            print(f"Source file {src_path} not found, skipping.")

def load_json(path: str) -> Any:
    if not os.path.exists(path):
        return None
    with open(path, 'r', encoding='utf-8') as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return None

def write_csv(filename: str, headers: List[str], rows: List[List[Any]]):
    path = os.path.join(OUTPUT_DIR, filename)
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    with open(path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(headers)
        writer.writerows(rows)
    print(f"Wrote {len(rows)} rows to {filename}")

def main():
    move_master_files()

    # 1. Terms
    terms_data = load_json(os.path.join(BASE_DIR, "terms.txt"))
    if terms_data:
        term_rows = []
        for t in terms_data:
            term_rows.append([
                t.get("termCode"), t.get("termDesc"), 
                t.get("startDate"), t.get("endDate"), 
                t.get("academicYear")
            ])
        write_csv("terms.csv", ["term_code", "term_desc", "start_date", "end_date", "academic_year"], term_rows)

    # 2. Departments
    depts_data = load_json(os.path.join(BASE_DIR, "departments.txt"))
    dept_rows = []
    dept_top_courses = []
    if depts_data:
        for d in depts_data:
            dept_rows.append([
                d.get("id"), d.get("code"), d.get("name"), 
                d.get("description"), d.get("avgGpa"), d.get("rating")
            ])
            # Top courses (many-to-many)
            for tc in d.get("topCourses", []):
                dept_top_courses.append([d.get("id"), tc])
        write_csv("departments.csv", ["id", "code", "name", "description", "avg_gpa", "rating"], dept_rows)
        write_csv("department_top_courses.csv", ["dept_id", "course_id"], dept_top_courses)

    # 3. Professors and Professor-Departments
    profs_data = load_json(os.path.join(PROFESSORS_DIR, "master_professors.txt"))
    prof_rows = []
    prof_depts = []
    prof_name_to_id = {} # Building mapping for sections
    
    if profs_data:
        for p in profs_data:
            p_id = p.get("id")
            p_name = p.get("name")
            if p_id and p_name:
                prof_name_to_id[p_name] = p_id

            prof_rows.append([
                p_id, p_name, 
                p.get("overall_rating"), p.get("total_reviews")
            ])
            # prof departments
            for d in p.get("departments", []):
                if d:
                    if isinstance(d, dict) and d.get("id"):
                        prof_depts.append([p_id, d.get("id")])
                    elif isinstance(d, str):
                        prof_depts.append([p_id, d])
        write_csv("professors.csv", ["id", "name", "overall_rating", "total_reviews"], prof_rows)
        # Unique mapping for prof_depts
        unique_prof_depts = list(set(tuple(x) for x in prof_depts))
        write_csv("professor_departments.csv", ["professor_id", "dept_id"], [list(x) for x in unique_prof_depts])

    # 4. Courses and Course Tags
    courses_data = load_json(os.path.join(COURSES_DIR, "master_courses.txt"))
    course_rows = []
    course_tags = []
    if courses_data:
        for c in courses_data:
            dept_id = c.get("department", {}).get("id") if c.get("department") else None
            course_rows.append([
                c.get("id"), c.get("code"), c.get("name"), dept_id,
                c.get("credits"), c.get("description"), c.get("avgGPA"),
                c.get("difficulty"), c.get("enrollment"), c.get("rating")
            ])
            for tag in c.get("tags", []):
                course_tags.append([c.get("id"), tag])
        write_csv("courses.csv", ["id", "code", "name", "dept_id", "credits", "description", "avg_gpa", "difficulty", "enrollment", "rating"], course_rows)
        write_csv("course_tags.csv", ["course_id", "tag"], course_tags)

    # 5. Sections and Section Instructors
    sections_master = load_json(os.path.join(SECTIONS_DIR, "master_sections.txt"))
    section_rows = []
    section_instructors = []
    if sections_master:
        for s in sections_master:
            crn = s.get("crn")
            term_code = s.get("termCode")
            # Link via dept + courseNumber
            course_id = f"{s.get('dept')}{s.get('courseNumber')}"
            
            section_rows.append([
                crn, term_code, course_id, s.get("sectionNumber"),
                s.get("type"), s.get("instructionMode"),
                s.get("enrollmentMax"), s.get("enrollmentCount"),
                s.get("waitListMax"), s.get("waitListCount"),
                s.get("creditHours"), s.get("avgGpa"),
                s.get("avgDifficulty"), s.get("numReviews")
            ])
            # Instructors - link by name
            for inst in s.get("instructors", []):
                if inst:
                    inst_name = inst.get("name")
                    p_id = prof_name_to_id.get(inst_name)
                    if p_id:
                        section_instructors.append([
                            crn, term_code, p_id, inst.get("isPrimary")
                        ])
                    else:
                        print(f"Warning: Professor '{inst_name}' not found in master list for section {crn}")
                        
        write_csv("sections.csv", ["crn", "term_code", "course_id", "section_number", "type", "instruction_mode", "enrollment_max", "enrollment_count", "wait_list_max", "wait_list_count", "credit_hours", "avg_gpa", "avg_difficulty", "num_reviews"], section_rows)
        write_csv("section_instructors.csv", ["crn", "term_code", "professor_id", "is_primary"], section_instructors)

if __name__ == "__main__":
    main()
