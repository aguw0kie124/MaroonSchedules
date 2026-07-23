from __future__ import annotations
"""
routers/grades.py
-----------------
FastAPI router that serves TAMU grade-distribution data.

The primary data source is the JSON files written by scrape_grades.py
(stored in Backend/Data/grades/).  If a file is not yet on disk the
router falls back to fetching live from anex.us and caches the result.

Loading itself lives in services/grades_service.py — shared with revai/,
which looks up professor GPAs from the same cache.
"""


from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from services import grades_service

router = APIRouter(prefix="/grades", tags=["Grades"])


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/search")
def search_grades(
    subject: str = Query(..., description="Subject code, e.g. CSCE"),
    course: str = Query(..., description="Course number, e.g. 121"),
    instructor: Optional[str] = Query(None, description="Partial instructor name match"),
    semester: Optional[str] = Query(None, description="SPRING | SUMMER | FALL"),
    year: Optional[int] = Query(None, description="e.g. 2024"),
):
    """
    Return grade-distribution rows for a given subject + course number.

    Supports optional filtering by instructor (partial, case-insensitive),
    semester, and year.
    """
    try:
        rows = grades_service.load_or_fetch(subject, course)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    # Apply optional filters
    if instructor:
        q = instructor.upper()
        rows = [r for r in rows if q in r.get("instructor", "").upper()]
    if semester:
        rows = [r for r in rows if r.get("semester", "").upper() == semester.upper()]
    if year is not None:
        rows = [r for r in rows if r.get("year") == year]

    return rows


@router.get("/subjects")
def list_cached_subjects():
    """Return the list of (subject, course) pairs that are already cached on disk."""
    return grades_service.list_cached_subjects()