from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path
from typing import Any, Dict, List, Optional

import psycopg

from db_config import get_pool
from scripts.migrate_courses import run_migration

ROOT_DIR = Path(__file__).resolve().parents[2]
COURSES_FILE = ROOT_DIR / "TamuCoursesCrawler" / "data" / "normalized" / "courses.jsonl"
PLANS_FILE = ROOT_DIR / "TamuCoursesCrawler" / "data" / "normalized" / "degree_plans.jsonl"
GRADES_FILE = ROOT_DIR / "TamuCoursesCrawler" / "data" / "normalized" / "grade_distributions.jsonl"

_LAST_INGEST_MTIMES: Dict[str, int] = {}


def _file_mtime_ns(path: Path) -> int:
    return path.stat().st_mtime_ns if path.exists() else -1


def _load_jsonl(path: Path) -> List[Dict[str, Any]]:
    if not path.exists():
        return []
    rows: List[Dict[str, Any]] = []
    with path.open("r", encoding="utf-8") as handle:
        for line in handle:
            if not line.strip():
                continue
            try:
                rows.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    return rows


def _serialize_prerequisites(value: Any) -> str:
    return json.dumps(value or [])


def _serialize_json(value: Any) -> str:
    return json.dumps(value or [])


async def ingest_course_data(force: bool = False) -> Dict[str, int]:
    run_migration()
    current_mtimes = {
        "courses": _file_mtime_ns(COURSES_FILE),
        "plans": _file_mtime_ns(PLANS_FILE),
        "grades": _file_mtime_ns(GRADES_FILE),
    }
    if not force and current_mtimes == _LAST_INGEST_MTIMES:
        return {"courses": 0, "plans": 0, "grades": 0}

    courses = _load_jsonl(COURSES_FILE)
    plans = _load_jsonl(PLANS_FILE)
    grades = _load_jsonl(GRADES_FILE)

    with get_pool().connection() as conn:
        with conn.cursor() as cur:
            for course in courses:
                cur.execute(
                    """
                    INSERT INTO tamu_courses (
                        id, department, number, title, credit_hours, description,
                        prerequisites, corequisites, raw_prereq_text, source_url, scraped_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s::jsonb, %s::jsonb, %s, %s, %s)
                    ON CONFLICT (id) DO UPDATE SET
                        department = EXCLUDED.department,
                        number = EXCLUDED.number,
                        title = EXCLUDED.title,
                        credit_hours = EXCLUDED.credit_hours,
                        description = EXCLUDED.description,
                        prerequisites = EXCLUDED.prerequisites,
                        corequisites = EXCLUDED.corequisites,
                        raw_prereq_text = EXCLUDED.raw_prereq_text,
                        source_url = EXCLUDED.source_url,
                        scraped_at = EXCLUDED.scraped_at
                    """,
                    (
                        course["id"],
                        course["department"],
                        course["number"],
                        course["title"],
                        course.get("credit_hours"),
                        course.get("description"),
                        _serialize_prerequisites(course.get("prerequisites")),
                        _serialize_json(course.get("corequisites")),
                        course.get("raw_prereq_text"),
                        course.get("source_url"),
                        course.get("scraped_at"),
                    ),
                )
            for plan in plans:
                cur.execute(
                    """
                    INSERT INTO tamu_degree_plans (
                        id, college, department, degree, major, catalog_year,
                        total_hours, semesters, source_url, scraped_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s, %s)
                    ON CONFLICT (id) DO UPDATE SET
                        college = EXCLUDED.college,
                        department = EXCLUDED.department,
                        degree = EXCLUDED.degree,
                        major = EXCLUDED.major,
                        catalog_year = EXCLUDED.catalog_year,
                        total_hours = EXCLUDED.total_hours,
                        semesters = EXCLUDED.semesters,
                        source_url = EXCLUDED.source_url,
                        scraped_at = EXCLUDED.scraped_at
                    """,
                    (
                        plan["id"],
                        plan["college"],
                        plan["department"],
                        plan["degree"],
                        plan["major"],
                        plan["catalog_year"],
                        plan.get("total_hours"),
                        _serialize_json(plan.get("semesters")),
                        plan.get("source_url"),
                        plan.get("scraped_at"),
                    ),
                )
            for grade in grades:
                cur.execute(
                    """
                    INSERT INTO tamu_grade_distributions (
                        id, department, course_number, course_title, instructor,
                        term, section, gpa, grades, total_enrolled, source_url, scraped_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s, %s, %s)
                    ON CONFLICT (id) DO UPDATE SET
                        department = EXCLUDED.department,
                        course_number = EXCLUDED.course_number,
                        course_title = EXCLUDED.course_title,
                        instructor = EXCLUDED.instructor,
                        term = EXCLUDED.term,
                        section = EXCLUDED.section,
                        gpa = EXCLUDED.gpa,
                        grades = EXCLUDED.grades,
                        total_enrolled = EXCLUDED.total_enrolled,
                        source_url = EXCLUDED.source_url,
                        scraped_at = EXCLUDED.scraped_at
                    """,
                    (
                        grade["id"],
                        grade["department"],
                        grade["course_number"],
                        grade.get("course_title"),
                        grade["instructor"],
                        grade["term"],
                        grade.get("section"),
                        grade.get("gpa"),
                        _serialize_json(grade.get("grades")),
                        grade.get("total_enrolled"),
                        grade.get("source_url"),
                        grade.get("scraped_at"),
                    ),
                )
        conn.commit()

    _LAST_INGEST_MTIMES.clear()
    _LAST_INGEST_MTIMES.update(current_mtimes)
    return {"courses": len(courses), "plans": len(plans), "grades": len(grades)}


def _dict_rows(cur: psycopg.Cursor) -> List[Dict[str, Any]]:
    columns = [desc[0] for desc in cur.description or []]
    return [dict(zip(columns, row)) for row in cur.fetchall()]


def _term_sort_key(term: str) -> tuple[int, int]:
    if not term:
        return (0, 0)
    year = int(term[:4]) if len(term) >= 4 and term[:4].isdigit() else 0
    suffix = {"F": 3, "U": 2, "S": 1}.get(term[-1], 0)
    return (year, suffix)


def _grade_summary_for_course(cur: psycopg.Cursor, department: str, number: str) -> Dict[str, Any]:
    cur.execute(
        """
        SELECT AVG(gpa) AS avg_gpa, COUNT(*) AS offering_count, COALESCE(SUM(total_enrolled), 0) AS total_enrolled
        FROM tamu_grade_distributions
        WHERE department = %s AND course_number = %s
        """,
        (department, number),
    )
    row = cur.fetchone() or (None, 0, 0)
    return {
        "avg_gpa": float(row[0]) if row[0] is not None else None,
        "offering_count": int(row[1] or 0),
        "total_enrolled": int(row[2] or 0),
    }


def search_courses(
    query: str = "",
    department: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
    credit_hours: Optional[int] = None,
    has_grade_data: Optional[bool] = None,
) -> Dict[str, Any]:
    safe_page = max(1, page)
    safe_page_size = max(1, min(page_size, 100))
    offset = (safe_page - 1) * safe_page_size
    query_like = f"%{query.strip()}%"

    clauses = ["1=1"]
    params: List[Any] = []
    if query.strip():
        clauses.append("(department ILIKE %s OR number ILIKE %s OR title ILIKE %s OR description ILIKE %s)")
        params.extend([query_like, query_like, query_like, query_like])
    if department:
        clauses.append("department = %s")
        params.append(department.upper())
    if credit_hours is not None:
        clauses.append("credit_hours = %s")
        params.append(credit_hours)
    if has_grade_data is True:
        clauses.append("EXISTS (SELECT 1 FROM tamu_grade_distributions gd WHERE gd.department = tamu_courses.department AND gd.course_number = tamu_courses.number)")
    elif has_grade_data is False:
        clauses.append("NOT EXISTS (SELECT 1 FROM tamu_grade_distributions gd WHERE gd.department = tamu_courses.department AND gd.course_number = tamu_courses.number)")

    where_clause = " AND ".join(clauses)
    with get_pool().connection() as conn:
        with conn.cursor() as cur:
            cur.execute(f"SELECT COUNT(*) FROM tamu_courses WHERE {where_clause}", params)
            total = int((cur.fetchone() or [0])[0])
            cur.execute(
                f"""
                SELECT id, department, number, title, credit_hours, description, prerequisites, corequisites,
                       raw_prereq_text, source_url, scraped_at
                FROM tamu_courses
                WHERE {where_clause}
                ORDER BY department, number
                LIMIT %s OFFSET %s
                """,
                [*params, safe_page_size, offset],
            )
            rows = _dict_rows(cur)
            items = []
            for row in rows:
                summary = _grade_summary_for_course(cur, row["department"], row["number"])
                row["grade_summary"] = summary
                items.append(row)
    return {
        "items": items,
        "page": safe_page,
        "page_size": safe_page_size,
        "total": total,
    }


def get_grade_distributions(department: str, number: str) -> Dict[str, Any]:
    with get_pool().connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, department, course_number, course_title, instructor, term, section,
                       gpa, grades, total_enrolled, source_url, scraped_at
                FROM tamu_grade_distributions
                WHERE department = %s AND course_number = %s
                ORDER BY term DESC, instructor ASC, section ASC NULLS LAST
                """,
                (department.upper(), number),
            )
            rows = _dict_rows(cur)
    grouped: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for row in rows:
        grouped[row["instructor"]].append(row)
    for key in grouped:
        grouped[key].sort(key=lambda item: _term_sort_key(str(item.get("term") or "")), reverse=True)
    return {
        "department": department.upper(),
        "number": number,
        "by_instructor": grouped,
        "items": rows,
    }


def get_course_detail(department: str, number: str) -> Optional[Dict[str, Any]]:
    with get_pool().connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, department, number, title, credit_hours, description, prerequisites, corequisites,
                       raw_prereq_text, source_url, scraped_at
                FROM tamu_courses
                WHERE department = %s AND number = %s
                LIMIT 1
                """,
                (department.upper(), number),
            )
            rows = _dict_rows(cur)
            if not rows:
                return None
            course = rows[0]
            course["grade_distributions"] = get_grade_distributions(department, number)
            course["grade_summary"] = _grade_summary_for_course(cur, department.upper(), number)
            return course


def list_degree_plans(
    college: Optional[str] = None,
    major: Optional[str] = None,
    year: Optional[str] = None,
) -> List[Dict[str, Any]]:
    clauses = ["1=1"]
    params: List[Any] = []
    if college:
        clauses.append("college ILIKE %s")
        params.append(f"%{college}%")
    if major:
        clauses.append("major ILIKE %s")
        params.append(f"%{major}%")
    if year:
        clauses.append("catalog_year = %s")
        params.append(year)
    with get_pool().connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT id, college, department, degree, major, catalog_year, total_hours, semesters, source_url, scraped_at
                FROM tamu_degree_plans
                WHERE {' AND '.join(clauses)}
                ORDER BY college, major, catalog_year DESC
                """,
                params,
            )
            return _dict_rows(cur)


def get_degree_plan(plan_id: str) -> Optional[Dict[str, Any]]:
    with get_pool().connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, college, department, degree, major, catalog_year, total_hours, semesters, source_url, scraped_at
                FROM tamu_degree_plans
                WHERE id = %s
                LIMIT 1
                """,
                (plan_id,),
            )
            rows = _dict_rows(cur)
            if not rows:
                return None
            plan = rows[0]
            course_codes = []
            for semester in plan.get("semesters") or []:
                course_codes.extend(semester.get("courses") or [])
            resolved_courses: Dict[str, Dict[str, Any]] = {}
            for code in course_codes:
                parts = str(code).split()
                if len(parts) != 2:
                    continue
                detail = get_course_detail(parts[0], parts[1])
                if detail:
                    resolved_courses[code] = detail
            plan["resolved_courses"] = resolved_courses
            return plan


def get_user_progress(user_id: str) -> Dict[str, Any]:
    with get_pool().connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT p.course_id, p.status, p.grade, p.term_taken, p.updated_at,
                       c.department, c.number, c.title, c.credit_hours
                FROM user_course_progress p
                JOIN tamu_courses c ON c.id = p.course_id
                WHERE p.user_id = %s
                ORDER BY c.department, c.number
                """,
                (user_id,),
            )
            progress_rows = _dict_rows(cur)
            cur.execute(
                """
                SELECT p.user_id, p.plan_id, p.catalog_year, d.major, d.degree, d.college
                FROM user_degree_plan p
                JOIN tamu_degree_plans d ON d.id = p.plan_id
                WHERE p.user_id = %s
                LIMIT 1
                """,
                (user_id,),
            )
            selected_plan = _dict_rows(cur)
    return {
        "items": progress_rows,
        "selected_plan": selected_plan[0] if selected_plan else None,
    }


def set_degree_plan(user_id: str, plan_id: str, catalog_year: Optional[str] = None) -> Dict[str, Any]:
    with get_pool().connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO user_degree_plan (user_id, plan_id, catalog_year, updated_at)
                VALUES (%s, %s, %s, NOW())
                ON CONFLICT (user_id) DO UPDATE SET
                    plan_id = EXCLUDED.plan_id,
                    catalog_year = EXCLUDED.catalog_year,
                    updated_at = NOW()
                """,
                (user_id, plan_id, catalog_year),
            )
        conn.commit()
    return {"status": "success", "plan_id": plan_id, "catalog_year": catalog_year}


def set_course_status(
    user_id: str,
    course_id: str,
    status: str,
    grade: Optional[str] = None,
    term: Optional[str] = None,
) -> Dict[str, Any]:
    with get_pool().connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO user_course_progress (user_id, course_id, status, grade, term_taken, updated_at)
                VALUES (%s, %s, %s, %s, %s, NOW())
                ON CONFLICT (user_id, course_id) DO UPDATE SET
                    status = EXCLUDED.status,
                    grade = EXCLUDED.grade,
                    term_taken = EXCLUDED.term_taken,
                    updated_at = NOW()
                """,
                (user_id, course_id, status, grade, term),
            )
        conn.commit()
    return {"status": "success", "course_id": course_id, "progress_status": status, "grade": grade, "term": term}


_GRADE_POINTS = {
    "A": 4.0,
    "B": 3.0,
    "C": 2.0,
    "D": 1.0,
    "F": 0.0,
}


def get_plan_completion(user_id: str, plan_id: str) -> Dict[str, Any]:
    plan = get_degree_plan(plan_id)
    if not plan:
        return {"status": "missing_plan"}
    progress = get_user_progress(user_id)
    progress_by_course = {row["course_id"]: row for row in progress["items"]}
    completed_hours = 0
    total_hours = int(plan.get("total_hours") or 0)
    semester_statuses = []
    grade_points = 0.0
    grade_hours = 0

    for semester in plan.get("semesters") or []:
        semester_courses = []
        semester_completed = 0
        semester_total = 0
        for course_code in semester.get("courses") or []:
            course = plan.get("resolved_courses", {}).get(course_code)
            if not course:
                semester_courses.append({"code": course_code, "status": "unknown"})
                continue
            course_id = course["id"]
            credit_hours = int(course.get("credit_hours") or 0)
            semester_total += credit_hours
            progress_row = progress_by_course.get(course_id)
            status = progress_row["status"] if progress_row else "remaining"
            if status == "completed":
                semester_completed += credit_hours
                completed_hours += credit_hours
                if progress_row.get("grade") in _GRADE_POINTS:
                    grade_points += _GRADE_POINTS[progress_row["grade"]] * credit_hours
                    grade_hours += credit_hours
            semester_courses.append(
                {
                    "course_id": course_id,
                    "code": course_code,
                    "title": course.get("title"),
                    "credit_hours": credit_hours,
                    "status": status,
                    "grade": progress_row.get("grade") if progress_row else None,
                }
            )
        semester_statuses.append(
            {
                "semester": semester,
                "completed_hours": semester_completed,
                "total_hours": semester_total,
                "courses": semester_courses,
            }
        )

    return {
        "plan_id": plan_id,
        "completed_hours": completed_hours,
        "total_hours": total_hours,
        "remaining_hours": max(total_hours - completed_hours, 0),
        "gpa": round(grade_points / grade_hours, 3) if grade_hours else None,
        "semesters": semester_statuses,
        "selected_plan": progress.get("selected_plan"),
    }
