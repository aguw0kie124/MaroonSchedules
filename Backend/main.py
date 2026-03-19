from fastapi import FastAPI, HTTPException, Body, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
from pydantic import BaseModel

import test_func
import postgre_test
from chat import router as chat_router

from services import course_service, schedule_service
from models.search import CourseSearchRequest

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat_router)

@app.get("/")
def read_root():
    return {"message": "hi"}

@app.get("/test_func")
def test():
    return test_func.test_func()

@app.get("/test_postgre")
def test_postgre():
    return postgre_test.test_postgre_data()

# --- Feature: Searching courses ---

@app.post("/courses/search")
def search_courses(request: CourseSearchRequest = Body(...)):
    """Connect to database to query for courses based on user search. Limit API calls to top 5 retrievals."""
    return course_service.search_courses(request)

@app.get("/courses/{course_id}")
def get_course(course_id: str):
    """Get single course by ID, including its sections."""
    course = course_service.get_course_details(course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    return course

# --- Feature: Generate schedules ---

@app.get("/schedules/generate")
def generate_schedules(course_ids: List[str] = Query(..., description="List of course IDs to schedule")):
    """Generate schedules with valid permutations for each course the user picked. Limit API calls to top 5 retrievals."""
    return schedule_service.generate_schedules(course_ids, limit=5)

# --- Feature: Creating Schedules ---

class CreateScheduleRequest(BaseModel):
    user_id: str
    name: str
    term_code: str

@app.post("/schedules")
def create_schedule(req: CreateScheduleRequest = Body(...)):
    """Create a new prospective schedule for a user."""
    try:
        return schedule_service.create_schedule(req.user_id, req.name, req.term_code)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# --- Feature: Adding courses to User Schedule Profile ---

class AddCourseRequest(BaseModel):
    user_id: str
    schedule_id: str
    section_id: str

@app.post("/user/schedule/add")
def add_section(req: AddCourseRequest = Body(...)):
    """Add course to user profile data (update StudentSectionProfessor equivalent)."""
    try:
        return schedule_service.add_section_to_schedule(req.schedule_id, req.section_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# --- Feature: Remove courses from User Schedule Profile ---

class RemoveCourseRequest(BaseModel):
    user_id: str
    schedule_id: str
    section_id: str

@app.delete("/user/schedule/remove")
def remove_section(req: RemoveCourseRequest = Body(...)):
    """Remove unwanted courses or specific sections from the user's current schedule."""
    try:
        return schedule_service.remove_section_from_schedule(req.schedule_id, req.section_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# --- Feature: View courses / Get User Schedules ---

@app.get("/user/schedule")
def view_courses(user_id: str):
    """Send course data to frontend to be displayed in schedule format. Limit to user's retrieved planners."""
    return schedule_service.get_schedules_for_user(user_id)
