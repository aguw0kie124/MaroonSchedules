from fastapi import FastAPI, HTTPException, Body, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
from pydantic import BaseModel
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

import test_func
import postgre_test
from chat import router as chat_router
from routers.traffic import router as traffic_router

from services import course_service, schedule_service, user_service
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
app.include_router(traffic_router, prefix="/traffic", tags=["Traffic"])

@app.get("/")
def read_root():
    return {"message": "hi"}

@app.get("/test_func")
def test():
    return test_func.test_func()

@app.get("/test_postgre")
def test_postgre():
    return postgre_test.test_postgre_data()

# ============================================================
# Users
# ============================================================

class SyncUserRequest(BaseModel):
    clerk_id: str
    email: Optional[str] = None
    full_name: Optional[str] = None

@app.post("/users/sync")
def sync_user(req: SyncUserRequest = Body(...)):
    """Create or update a user row when they sign in."""
    return user_service.sync_user(req.clerk_id, req.email, req.full_name)

@app.get("/users/{clerk_id}")
def get_user(clerk_id: str):
    """Return full user record (profile + schedules)."""
    user = user_service.get_profile(clerk_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

class UpdateProfileRequest(BaseModel):
    major: Optional[str] = None
    graduation_year: Optional[str] = None
    preferred_time: Optional[str] = None
    max_credits: Optional[str] = None
    avoid_friday: Optional[bool] = None
    show_online_first: Optional[bool] = None

@app.put("/users/{clerk_id}/profile")
def update_profile(clerk_id: str, req: UpdateProfileRequest = Body(...)):
    """Update profile preferences for a user."""
    fields = {k: v for k, v in req.dict().items() if v is not None}
    result = user_service.update_profile(clerk_id, fields)
    if not result:
        raise HTTPException(status_code=404, detail="User not found")
    return result

# ============================================================
# Course Search
# ============================================================

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

@app.get("/sections/{section_id}")
def get_section(section_id: str):
    """Get single section by ID, including its metadata."""
    from repositories import course_repository
    section = course_repository.get_section_by_id(section_id)
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")
    return section

@app.get("/terms")
def get_terms():
    """Get all available academic terms."""
    return course_service.get_all_terms()

# ============================================================
# Generate Schedules (algorithmic – unchanged)
# ============================================================

@app.get("/schedules/generate")
def generate_schedules(course_ids: List[str] = Query(..., description="List of course IDs to schedule")):
    """Generate schedules with valid permutations for each course the user picked. Limit API calls to top 5 retrievals."""
    return schedule_service.generate_schedules(course_ids, limit=5)

# ============================================================
# User Schedule CRUD  (now backed by PostgreSQL users.schedules JSONB)
# ============================================================

class CreateScheduleRequest(BaseModel):
    user_id: str
    name: str
    term_code: str

@app.post("/schedules")
def create_schedule(req: CreateScheduleRequest = Body(...)):
    """Create a new prospective schedule for a user."""
    try:
        return user_service.create_schedule(req.user_id, req.name, req.term_code)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/schedules/{schedule_id}")
def delete_schedule(schedule_id: str, user_id: str = Query(...)):
    """Delete a user's schedule."""
    try:
        success = user_service.delete_schedule(user_id, schedule_id)
        if not success:
            raise HTTPException(status_code=404, detail="Schedule not found or could not be deleted")
        return {"status": "success"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# --- Adding / removing sections ---

class AddCourseRequest(BaseModel):
    user_id: str
    schedule_id: str
    section_id: str

@app.post("/user/schedule/add")
def add_section(req: AddCourseRequest = Body(...)):
    """Add course to user profile data (update StudentSectionProfessor equivalent)."""
    try:
        return user_service.add_section(req.user_id, req.schedule_id, req.section_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

class RemoveCourseRequest(BaseModel):
    user_id: str
    schedule_id: str
    section_id: str

@app.delete("/user/schedule/remove")
def remove_section(req: RemoveCourseRequest = Body(...)):
    """Remove unwanted courses or specific sections from the user's current schedule."""
    try:
        return user_service.remove_section(req.user_id, req.schedule_id, req.section_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# --- View schedules ---

@app.get("/user/schedule")
def view_courses(user_id: str):
    """Send course data to frontend to be displayed in schedule format. Limit to user's retrieved planners."""
    from repositories import course_repository
    schedules = user_service.get_schedules(user_id)

    # Expand section details for frontend display
    for sched in schedules:
        expanded_sections = []
        for sec_id in sched.get("section_ids", []):
            sec_metadata = course_repository.get_section_by_id(sec_id)
            if sec_metadata:
                expanded_sections.append(sec_metadata)
            else:
                expanded_sections.append({"id": sec_id, "section_id": sec_id})
        sched["sections"] = expanded_sections

    return schedules
