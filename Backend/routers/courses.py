from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from auth import require_auth
from services import courses_service

router = APIRouter(tags=["courses-catalog"])


class CourseProgressRequest(BaseModel):
    course_id: str
    status: str = Field(pattern="^(completed|in_progress|planned)$")
    grade: Optional[str] = None
    term: Optional[str] = None


class DegreePlanSelectionRequest(BaseModel):
    plan_id: str
    catalog_year: Optional[str] = None


@router.get("/search")
def search_courses(
    q: str = Query("", alias="q"),
    dept: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    credit_hours: Optional[int] = Query(None, ge=0),
    has_grade_data: Optional[bool] = Query(None),
):
    return courses_service.search_courses(
        query=q,
        department=dept,
        page=page,
        page_size=page_size,
        credit_hours=credit_hours,
        has_grade_data=has_grade_data,
    )


@router.get("/plans")
def list_plans(
    college: Optional[str] = Query(None),
    major: Optional[str] = Query(None),
    year: Optional[str] = Query(None),
):
    return courses_service.list_degree_plans(college=college, major=major, year=year)


@router.get("/plans/{plan_id}")
def get_plan(plan_id: str):
    plan = courses_service.get_degree_plan(plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Degree plan not found")
    return plan


@router.get("/progress")
def get_progress(auth_user_id: str = Depends(require_auth)):
    return courses_service.get_user_progress(auth_user_id)


@router.post("/progress")
def post_progress(payload: CourseProgressRequest = Body(...), auth_user_id: str = Depends(require_auth)):
    return courses_service.set_course_status(
        auth_user_id,
        payload.course_id,
        payload.status,
        grade=payload.grade,
        term=payload.term,
    )


@router.get("/progress/completion")
def get_completion(plan_id: str = Query(...), auth_user_id: str = Depends(require_auth)):
    return courses_service.get_plan_completion(auth_user_id, plan_id)


@router.get("/plan-selection")
def get_plan_selection(auth_user_id: str = Depends(require_auth)):
    return courses_service.get_user_progress(auth_user_id).get("selected_plan")


@router.post("/plan-selection")
def set_plan_selection(payload: DegreePlanSelectionRequest = Body(...), auth_user_id: str = Depends(require_auth)):
    return courses_service.set_degree_plan(auth_user_id, payload.plan_id, payload.catalog_year)


@router.get("/grades/{dept}/{number}")
def get_grades(dept: str, number: str):
    return courses_service.get_grade_distributions(dept, number)


@router.get("/{dept}/{number}")
def get_course_detail(dept: str, number: str):
    course = courses_service.get_course_detail(dept, number)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    return course
