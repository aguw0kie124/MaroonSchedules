import os
import csv

OUTPUT_DIR = r"c:\MaroonSchedules\Backend\csv_output"
FILES = [
    "terms.csv",
    "departments.csv",
    "professors.csv",
    "courses.csv",
    "sections.csv",
    "section_instructors.csv",
    "professor_departments.csv",
    "course_tags.csv"
]

def verify():
    print(f"{'File':<25} | {'Row Count':<10}")
    print("-" * 40)
    for f in FILES:
        path = os.path.join(OUTPUT_DIR, f)
        if os.path.exists(path):
            with open(path, 'r', encoding='utf-8') as f_in:
                reader = csv.reader(f_in)
                header = next(reader, None)
                count = sum(1 for _ in reader)
                print(f"{f:<25} | {count:<10}")
        else:
            print(f"{f:<25} | NOT FOUND")

    # Sample check for sections and courses
    print("\n--- Sample Check ---")
    sections_path = os.path.join(OUTPUT_DIR, "sections.csv")
    courses_path = os.path.join(OUTPUT_DIR, "courses.csv")
    
    if os.path.exists(sections_path) and os.path.exists(courses_path):
        with open(courses_path, 'r', encoding='utf-8') as f:
            course_ids = set(row[0] for row in csv.reader(f))
        
        with open(sections_path, 'r', encoding='utf-8') as f:
            reader = csv.reader(f)
            next(reader) # skip header
            missing_courses = []
            for i, row in enumerate(reader):
                if row[2] not in course_ids:
                    missing_courses.append(row[2])
                if i > 1000: break # sample check
            
            if missing_courses:
                print(f"Sample Warning: {len(set(missing_courses))} course IDs from sections not found in courses.csv (e.g. {list(set(missing_courses))[:5]})")
            else:
                print("Sample Success: All checked sections link to existing course IDs.")

    # Sample check for instructors
    instructors_path = os.path.join(OUTPUT_DIR, "section_instructors.csv")
    professors_path = os.path.join(OUTPUT_DIR, "professors.csv")
    
    if os.path.exists(instructors_path) and os.path.exists(professors_path):
        with open(professors_path, 'r', encoding='utf-8') as f:
            prof_ids = set(row[0] for row in csv.reader(f))
        
        with open(instructors_path, 'r', encoding='utf-8') as f:
            reader = csv.reader(f)
            next(reader)
            missing_profs = []
            for i, row in enumerate(reader):
                if row[2] not in prof_ids:
                    missing_profs.append(row[2])
                if i > 1000: break
            
            if missing_profs:
                print(f"Sample Warning: {len(set(missing_profs))} professor IDs from section_instructors not found in professors.csv")
            else:
                print("Sample Success: All checked section instructors link to existing professor IDs.")

if __name__ == "__main__":
    verify()
