from __future__ import annotations

from typing import Dict, Iterable, List, Tuple

from models import Course, DegreePlan, GradeDistribution


def dedupe_courses(courses: Iterable[Course]) -> List[Course]:
    latest: Dict[Tuple[str, str], Course] = {}
    for course in courses:
        latest[(course.department.upper(), course.number)] = course
    return sorted(latest.values(), key=lambda item: (item.department, item.number, item.scraped_at), reverse=False)


def dedupe_degree_plans(plans: Iterable[DegreePlan]) -> List[DegreePlan]:
    latest: Dict[str, DegreePlan] = {}
    for plan in plans:
        latest[plan.id] = plan
    return sorted(latest.values(), key=lambda item: (item.department, item.major, item.catalog_year))


def dedupe_grade_distributions(rows: Iterable[GradeDistribution]) -> List[GradeDistribution]:
    latest: Dict[str, GradeDistribution] = {}
    for row in rows:
        latest[row.id] = row
    return sorted(latest.values(), key=lambda item: (item.department, item.course_number, item.term, item.instructor, item.section or ""))
