import os
import sys
import psycopg
import csv

CONNECTION_PARAMS = "host=10.246.145.251 dbname=maroon_schedules user=dev_rian password=admin"
OUTPUT_DIR = r"c:\MaroonSchedules\Backend\csv_output"

# Mapping logic for types based on column names
TYPE_MAP = {
    "course_id": "INTEGER",
    "section_id": "INTEGER",
    "subject_id": "INTEGER",
    "student_id": "INTEGER",
    "prof_id": "INTEGER",
    "professor_id": "INTEGER",
    "dept_id": "INTEGER",
    "major_id": "INTEGER",
    "minor_id": "INTEGER",
    "code_id": "INTEGER",
    "row_id": "INTEGER",
    "credit_hours": "INTEGER",
    "seats_open": "INTEGER",
    "semester": "INTEGER",
    "year": "INTEGER",
    "room_number": "INTEGER",
    "honors": "INTEGER",
    "grade": "INTEGER",
    "enrollment_max": "INTEGER",
    "enrollment_count": "INTEGER",
    "wait_list_max": "INTEGER",
    "wait_list_count": "INTEGER",
    "rmp_score": "REAL",
    "rmp_difficulty": "REAL",
    "avg_gpa": "REAL",
    "avgGpa": "REAL",
    "avg_difficulty": "REAL",
    "rating": "REAL",
    "overall_rating": "REAL",
    "difficulty": "REAL",
}

def get_type(col_name):
    for key, val in TYPE_MAP.items():
        if key.lower() in col_name.lower():
            return val
    return "TEXT"

def create_table(cur, table_name, headers):
    cols_sql = []
    for header in headers:
        col_type = get_type(header)
        cols_sql.append(f"\"{header}\" {col_type}")
    
    cols_sql_str = ", ".join(cols_sql)
    ddl = f"DROP TABLE IF EXISTS \"{table_name}\" CASCADE; CREATE TABLE \"{table_name}\" ({cols_sql_str});"
    print(f"Creating table {table_name}...")
    cur.execute(ddl)

def copy_csv_into_table(cur, table_name, filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        reader = csv.reader(f)
        header = next(reader, None)
        if header is None:
            print(f"WARNING: {filepath} is empty, skipping.")
            return

    # Use COPY for speed
    cols_sql = ", ".join([f"\"{h}\"" for h in header])
    copy_sql = f"COPY \"{table_name}\" ({cols_sql}) FROM STDIN WITH (FORMAT csv, HEADER true)"
    print(f"Loading {filepath} into {table_name}...")
    with open(filepath, "r", encoding="utf-8") as f:
        try:
            cur.copy(copy_sql, f)
        except Exception as e:
            print(f"ERROR loading {table_name}: {e}")

def main():
    if not os.path.exists(OUTPUT_DIR):
        print(f"ERROR: {OUTPUT_DIR} not found.")
        return

    csv_files = [f for f in os.listdir(OUTPUT_DIR) if f.endswith(".csv")]
    if not csv_files:
        print("No CSV files found.")
        return

    try:
        with psycopg.connect(CONNECTION_PARAMS) as conn:
            with conn.cursor() as cur:
                for csv_file in csv_files:
                    table_name = os.path.splitext(csv_file)[0]
                    # Table names starting with numbers or having special chars need quotes
                    filepath = os.path.join(OUTPUT_DIR, csv_file)
                    
                    with open(filepath, "r", encoding="utf-8") as f:
                        reader = csv.reader(f)
                        headers = next(reader, None)
                    
                    if headers:
                        create_table(cur, table_name, headers)
                        copy_csv_into_table(cur, table_name, filepath)
                
                conn.commit()
                print("All tables created and data loaded successfully.")
    except Exception as e:
        print(f"ERROR connecting to database: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
