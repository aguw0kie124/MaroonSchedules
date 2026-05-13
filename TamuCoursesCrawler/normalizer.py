from __future__ import annotations

from typing import Iterable, List

from models import Course, DegreePlan, GradeDistribution


def normalize_courses(courses: Iterable[Course]) -> List[Course]:
    return [course for course in courses if course.department and course.number]


def normalize_degree_plans(plans: Iterable[DegreePlan]) -> List[DegreePlan]:
    return [plan for plan in plans if plan.major and plan.semesters]


def normalize_grade_distributions(rows: Iterable[GradeDistribution]) -> List[GradeDistribution]:
    return [row for row in rows if row.department and row.course_number]
