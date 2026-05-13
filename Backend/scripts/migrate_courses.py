from __future__ import annotations

import os
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from db_config import get_pool


DDL = """
CREATE TABLE IF NOT EXISTS tamu_courses (
    id              TEXT PRIMARY KEY,
    department      TEXT NOT NULL,
    number          TEXT NOT NULL,
    title           TEXT NOT NULL,
    credit_hours    INT,
    description     TEXT,
    prerequisites   JSONB,
    corequisites    JSONB,
    raw_prereq_text TEXT,
    source_url      TEXT,
    scraped_at      TIMESTAMPTZ,
    UNIQUE(department, number)
);
CREATE INDEX IF NOT EXISTS idx_tamu_courses_dept ON tamu_courses(department);

CREATE TABLE IF NOT EXISTS tamu_degree_plans (
    id              TEXT PRIMARY KEY,
    college         TEXT NOT NULL,
    department      TEXT NOT NULL,
    degree          TEXT NOT NULL,
    major           TEXT NOT NULL,
    catalog_year    TEXT NOT NULL,
    total_hours     INT,
    semesters       JSONB,
    source_url      TEXT,
    scraped_at      TIMESTAMPTZ,
    UNIQUE(major, catalog_year)
);
CREATE INDEX IF NOT EXISTS idx_plans_college ON tamu_degree_plans(college);
CREATE INDEX IF NOT EXISTS idx_plans_major ON tamu_degree_plans(major);

CREATE TABLE IF NOT EXISTS tamu_grade_distributions (
    id              TEXT PRIMARY KEY,
    department      TEXT NOT NULL,
    course_number   TEXT NOT NULL,
    course_title    TEXT,
    instructor      TEXT NOT NULL,
    term            TEXT NOT NULL,
    section         TEXT,
    gpa             FLOAT,
    grades          JSONB,
    total_enrolled  INT,
    source_url      TEXT,
    scraped_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_grades_course ON tamu_grade_distributions(department, course_number);
CREATE INDEX IF NOT EXISTS idx_grades_instructor ON tamu_grade_distributions(instructor);
CREATE INDEX IF NOT EXISTS idx_grades_term ON tamu_grade_distributions(term);

CREATE TABLE IF NOT EXISTS user_course_progress (
    id              SERIAL PRIMARY KEY,
    user_id         TEXT NOT NULL,
    course_id       TEXT NOT NULL REFERENCES tamu_courses(id),
    status          TEXT NOT NULL,
    grade           TEXT,
    term_taken      TEXT,
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, course_id)
);
CREATE INDEX IF NOT EXISTS idx_progress_user ON user_course_progress(user_id);

CREATE TABLE IF NOT EXISTS user_degree_plan (
    user_id         TEXT PRIMARY KEY,
    plan_id         TEXT NOT NULL REFERENCES tamu_degree_plans(id),
    catalog_year    TEXT,
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
"""


def run_migration() -> None:
    statements = [statement.strip() for statement in DDL.split(";") if statement.strip()]
    with get_pool().connection() as conn:
        with conn.cursor() as cur:
            for statement in statements:
                cur.execute(statement)
        conn.commit()


if __name__ == "__main__":
    run_migration()
    print("Course tables migration complete.")
