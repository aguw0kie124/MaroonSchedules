from fastapi import FastAPI, HTTPException, Body, Query, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
from pydantic import BaseModel, Field
import os
import psycopg
from dotenv import load_dotenv

# Force reload from .env dynamically bypassing terminal memory
load_dotenv(override=True)

from chat import router as chat_router
from routers.traffic import router as traffic_router
from routers.posts import router as posts_router
from routers.dining import router as dining_router
from routers.campus_hub import router as campus_hub_router
from routers.grades import router as grades_router
from routers.annex import router as annex_router
from routers.upload import router as upload_router
from routers.upload import UPLOAD_DIR
from routers.admin import router as admin_router
from routers.clubs import router as clubs_router
from routers.maps import router as maps_router

from services import course_service, schedule_service, user_service
from services import cache_service, snapshot_jobs
from models.search import CourseSearchRequest
from auth.clerk_middleware import require_auth, ensure_matching_user

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

# Global rate limiter setup
limiter = Limiter(key_func=get_remote_address, default_limits=["200 per minute"])
app = FastAPI()
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

raw_cors_origins = os.getenv("CORS_ALLOW_ORIGINS", "")
if raw_cors_origins.strip():
    cors_allow_origins = [origin.strip() for origin in raw_cors_origins.split(",") if origin.strip()]
else:
    cors_allow_origins = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8081",
        "http://127.0.0.1:8081",
        "http://localhost:19006",
        "http://127.0.0.1:19006",
        "https://maroon-life-web-lac.vercel.app",
    ]


@app.on_event("startup")
def log_redis_status():
    cache_service.get_json("__redis_startup_probe__")


@app.on_event("startup")
async def start_background_snapshot_jobs():
    app.state.snapshot_job_tasks = await snapshot_jobs.start_snapshot_jobs()


@app.on_event("shutdown")
async def stop_background_snapshot_jobs():
    await snapshot_jobs.stop_snapshot_jobs(getattr(app.state, "snapshot_job_tasks", []))
    cache_service.close_client()

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_allow_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    return response

app.include_router(chat_router)
app.include_router(traffic_router, prefix="/traffic", tags=["Traffic"])
app.include_router(posts_router)
app.include_router(dining_router)
app.include_router(campus_hub_router)
app.include_router(grades_router)
app.include_router(annex_router)
app.include_router(upload_router)
app.include_router(admin_router)
app.include_router(clubs_router)
app.include_router(maps_router)

from fastapi.staticfiles import StaticFiles
# Ensure uploads directory exists
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

@app.get("/")
def read_root():
    return {"message": "hi"}

# ============================================================
# Users
# ============================================================

import requests as http_requests

@app.delete("/api/account")
def delete_account(user_id: str = Query(...), auth_user_id: str = Depends(require_auth)):
    """Permanently delete user account from Clerk and PostgreSQL."""
    ensure_matching_user(auth_user_id, user_id, detail="You can only delete your own account")
    clerk_secret = os.environ.get("CLERK_SECRET_KEY")
    if not clerk_secret:
        raise HTTPException(status_code=500, detail="Clerk secret key not configured")

    # 1. Delete from Clerk
    try:
        resp = http_requests.delete(
            f"https://api.clerk.com/v1/users/{user_id}",
            headers={"Authorization": f"Bearer {clerk_secret}"}
        )
        # Even if Clerk fails (e.g. user already deleted there), we proceed to DB cleanup 
        # unless it's a critical error.
        if resp.status_code not in [200, 204, 404]:
            print(f"Clerk deletion error: {resp.text}")
    except Exception as e:
        print(f"Clerk API exception: {e}")

    # 2. Delete from PostgreSQL (Cascade)
    from repositories import feed_repository
    feed_repository.delete_user_data_cascade(user_id)
    
    # 3. Clear caches
    from services import cache_service
    cache_service.delete(f"user:blocks:{user_id}")
    
    return {"status": "success", "message": "Account permanently deleted"}

class SyncUserRequest(BaseModel):
    clerk_id: str
    email: Optional[str] = None
    full_name: Optional[str] = None
    profile_image_url: Optional[str] = None

@app.post("/users/sync")
def sync_user(req: SyncUserRequest = Body(...), auth_user_id: str = Depends(require_auth)):
    """Create or update a user row when they sign in."""
    ensure_matching_user(auth_user_id, req.clerk_id, detail="You can only sync your own profile")
    return user_service.sync_user(req.clerk_id, req.email, req.full_name, req.profile_image_url)


@app.post("/users/{clerk_id}/tos/accept/")
def accept_tos(clerk_id: str, auth_user_id: str = Depends(require_auth)):
    """Mark that the user has accepted the Terms of Service."""
    ensure_matching_user(auth_user_id, clerk_id, detail="You can only update your own Terms of Service")
    print(f"DEBUG: accept_tos called for {clerk_id}")
    try:
        user_service.accept_tos(clerk_id)
        return {"status": "success"}
    except psycopg.OperationalError as e:
        print(f"DEBUG: accept_tos db unavailable: {e}")
        raise HTTPException(status_code=503, detail="Database temporarily unavailable")
    except Exception as e:
        print(f"DEBUG: accept_tos error: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/users/{clerk_id}")
def get_user(clerk_id: str, auth_user_id: str = Depends(require_auth)):
    """Return full user record (profile + schedules)."""
    ensure_matching_user(auth_user_id, clerk_id, detail="You can only view your own profile")
    user = user_service.get_profile(clerk_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@app.post("/users/{clerk_id}/tour/complete")
@app.post("/users/{clerk_id}/tour/complete/")
def complete_tour(clerk_id: str, auth_user_id: str = Depends(require_auth)):
    """Mark that the user has completed the interactive tour."""
    ensure_matching_user(auth_user_id, clerk_id, detail="You can only update your own tour state")
    print(f"DEBUG: complete_tour called for {clerk_id}")
    try:
        user_service.complete_tour(clerk_id)
        return {"status": "success"}
    except Exception as e:
        print(f"DEBUG: complete_tour error: {e}")
        raise HTTPException(status_code=400, detail=str(e))


class UpdateProfileRequest(BaseModel):
    major: Optional[str] = None
    graduation_year: Optional[str] = None
    preferred_time: Optional[str] = None
    preferred_event_categories: Optional[list[str]] = None
    preferred_social_mode: Optional[str] = None
    event_preferences_completed: Optional[bool] = None
    max_credits: Optional[str] = None
    avoid_friday: Optional[bool] = None
    show_online_first: Optional[bool] = None

@app.put("/users/{clerk_id}/profile")
def update_profile(clerk_id: str, req: UpdateProfileRequest = Body(...), auth_user_id: str = Depends(require_auth)):
    """Update profile preferences for a user."""
    ensure_matching_user(auth_user_id, clerk_id, detail="You can only update your own profile")
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
    name: str = Field(..., min_length=1, max_length=80)
    term_code: str = Field(..., min_length=4, max_length=16)

@app.post("/schedules")
def create_schedule(req: CreateScheduleRequest = Body(...), auth_user_id: str = Depends(require_auth)):
    """Create a new prospective schedule for a user."""
    ensure_matching_user(auth_user_id, req.user_id, detail="You can only create schedules for your own account")
    try:
        return user_service.create_schedule(req.user_id, req.name, req.term_code)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/schedules/{schedule_id}")
def delete_schedule(schedule_id: str, user_id: str = Query(...), auth_user_id: str = Depends(require_auth)):
    """Delete a user's schedule."""
    ensure_matching_user(auth_user_id, user_id, detail="You can only delete your own schedules")
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
def add_section(req: AddCourseRequest = Body(...), auth_user_id: str = Depends(require_auth)):
    """Add course to user profile data (update StudentSectionProfessor equivalent)."""
    ensure_matching_user(auth_user_id, req.user_id, detail="You can only edit your own schedules")
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
def remove_section(req: RemoveCourseRequest = Body(...), auth_user_id: str = Depends(require_auth)):
    """Remove unwanted courses or specific sections from the user's current schedule."""
    ensure_matching_user(auth_user_id, req.user_id, detail="You can only edit your own schedules")
    try:
        return user_service.remove_section(req.user_id, req.schedule_id, req.section_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# --- View schedules ---

@app.get("/user/schedule")
def view_courses(user_id: str, auth_user_id: str = Depends(require_auth)):
    """Send course data to frontend to be displayed in schedule format. Limit to user's retrieved planners."""
    ensure_matching_user(auth_user_id, user_id, detail="You can only view your own schedules")
    from repositories import course_repository
    schedules = user_service.get_schedules(user_id)

    # 1. Collect all unique section IDs from all schedules
    all_sec_ids = set()
    for sched in schedules:
        for sec_id in sched.get("section_ids", []):
            all_sec_ids.add(sec_id)
            
    # 2. Batch resolve all section metadata in ONE call
    resolved_sections = course_repository.get_sections_by_ids(list(all_sec_ids))
    sec_map = {str(s.get("id")): s for s in resolved_sections}

    # 3. Map metadata back to the schedules
    for sched in schedules:
        expanded_sections = []
        for sec_id in sched.get("section_ids", []):
            sec_metadata = sec_map.get(sec_id)
            if sec_metadata:
                expanded_sections.append(sec_metadata)
            else:
                expanded_sections.append({"id": sec_id, "section_id": sec_id})
        sched["sections"] = expanded_sections

    return schedules
