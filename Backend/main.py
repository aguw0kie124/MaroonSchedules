import os
from typing import List, Optional

import psycopg
import requests as http_requests
from dotenv import load_dotenv
from fastapi import APIRouter, Body, Depends, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from auth import ensure_matching_user, require_auth
from chat import router as chat_router
from dependencies import require_auth as require_protected_request
from models.search import CourseSearchRequest
from rate_limit import limiter
from routers.admin import router as admin_router
from routers.annex import router as annex_router
from routers.campus_hub import router as campus_hub_router
from routers.clubs import router as clubs_router
from routers.dining import router as dining_router
from routers.grades import router as grades_router
from routers.maps import router as maps_router
from routers.posts import router as posts_router
from routers.traffic import router as traffic_router
from routers.upload import UPLOAD_DIR
from routers.upload import router as upload_router
from services import cache_service, course_service, schedule_service, snapshot_jobs, user_service
from db_config import init_pool, close_pool

load_dotenv(override=True)

app = FastAPI(
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

raw_cors_origins = os.getenv("CORS_ALLOW_ORIGINS", "")
if raw_cors_origins.strip():
    cors_allow_origins = [origin.strip() for origin in raw_cors_origins.split(",") if origin.strip()]
else:
    cors_allow_origins = [
        "http://localhost:8081",
        "http://127.0.0.1:8081",
        "http://localhost:19006",
        "http://127.0.0.1:19006",
        "https://maroonlife-web-private.vercel.app",
        "https://maroon-life-web-private.vercel.app",
    ]

public_router = APIRouter()
protected_router = APIRouter(dependencies=[Depends(require_protected_request)])


@app.on_event("startup")
def log_redis_status():
    init_pool()   # Initialize DB pool
    cache_service.get_json("__redis_startup_probe__")


@app.on_event("startup")
async def start_background_snapshot_jobs():
    app.state.snapshot_job_tasks = await snapshot_jobs.start_snapshot_jobs()


@app.on_event("shutdown")
async def stop_background_snapshot_jobs():
    await snapshot_jobs.stop_snapshot_jobs(getattr(app.state, "snapshot_job_tasks", []))
    cache_service.close_client()
    close_pool()  # Close DB pool


app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_allow_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["Authorization", "Content-Type", "X-API-Key", "X-Clerk-User-Id"],
)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    return response


protected_router.include_router(chat_router)
protected_router.include_router(traffic_router, prefix="/traffic", tags=["Traffic"])
protected_router.include_router(posts_router)
protected_router.include_router(dining_router)
protected_router.include_router(campus_hub_router)
protected_router.include_router(grades_router)
protected_router.include_router(annex_router)
protected_router.include_router(upload_router)
protected_router.include_router(admin_router)
protected_router.include_router(clubs_router)
protected_router.include_router(maps_router)

os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


@public_router.get("/")
def read_root():
    return {"message": "hi"}


@public_router.get("/health")
def health_check():
    return {"status": "ok"}


# ============================================================
# Users
# ============================================================

@protected_router.delete("/api/account")
def delete_account(user_id: str = Query(...), auth_user_id: str = Depends(require_auth)):
    """Permanently delete user account from Clerk and PostgreSQL."""
    ensure_matching_user(auth_user_id, user_id, detail="You can only delete your own account")
    clerk_secret = os.environ.get("CLERK_SECRET_KEY")
    if not clerk_secret:
        raise HTTPException(status_code=500, detail="Clerk secret key not configured")

    try:
        resp = http_requests.delete(
            f"https://api.clerk.com/v1/users/{user_id}",
            headers={"Authorization": f"Bearer {clerk_secret}"},
            timeout=10,
        )
        if resp.status_code not in [200, 204, 404]:
            print(f"Clerk deletion error: {resp.text}")
    except Exception as exc:
        print(f"Clerk API exception: {exc}")

    from repositories import feed_repository

    feed_repository.delete_user_data_cascade(user_id)
    cache_service.delete(f"user:blocks:{user_id}")
    return {"status": "success", "message": "Account permanently deleted"}


class SyncUserRequest(BaseModel):
    clerk_id: str
    email: Optional[str] = None
    full_name: Optional[str] = None
    profile_image_url: Optional[str] = None


@protected_router.post("/users/sync")
def sync_user(req: SyncUserRequest = Body(...), auth_user_id: str = Depends(require_auth)):
    """Create or update a user row when they sign in."""
    ensure_matching_user(auth_user_id, req.clerk_id, detail="You can only sync your own profile")
    return user_service.sync_user(req.clerk_id, req.email, req.full_name, req.profile_image_url)


@protected_router.post("/users/{clerk_id}/tos/accept/")
def accept_tos(clerk_id: str, auth_user_id: str = Depends(require_auth)):
    """Mark that the user has accepted the Terms of Service."""
    ensure_matching_user(auth_user_id, clerk_id, detail="You can only update your own Terms of Service")
    try:
        user_service.accept_tos(clerk_id)
        return {"status": "success"}
    except psycopg.OperationalError as exc:
        print(f"accept_tos db unavailable: {exc}")
        raise HTTPException(status_code=503, detail="Database temporarily unavailable")
    except Exception as exc:
        print(f"accept_tos error: {exc}")
        raise HTTPException(status_code=400, detail=str(exc))


@protected_router.get("/users/{clerk_id}")
def get_user(clerk_id: str, auth_user_id: str = Depends(require_auth)):
    """Return full user record (profile + schedules)."""
    ensure_matching_user(auth_user_id, clerk_id, detail="You can only view your own profile")
    user = user_service.get_profile(clerk_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@protected_router.post("/users/{clerk_id}/tour/complete")
@protected_router.post("/users/{clerk_id}/tour/complete/")
def complete_tour(clerk_id: str, auth_user_id: str = Depends(require_auth)):
    """Mark that the user has completed the interactive tour."""
    ensure_matching_user(auth_user_id, clerk_id, detail="You can only update your own tour state")
    try:
        user_service.complete_tour(clerk_id)
        return {"status": "success"}
    except Exception as exc:
        print(f"complete_tour error: {exc}")
        raise HTTPException(status_code=400, detail=str(exc))


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


@protected_router.put("/users/{clerk_id}/profile")
def update_profile(clerk_id: str, req: UpdateProfileRequest = Body(...), auth_user_id: str = Depends(require_auth)):
    """Update profile preferences for a user."""
    ensure_matching_user(auth_user_id, clerk_id, detail="You can only update your own profile")
    fields = {key: value for key, value in req.dict().items() if value is not None}
    result = user_service.update_profile(clerk_id, fields)
    if not result:
        raise HTTPException(status_code=404, detail="User not found")
    return result


# ============================================================
# Course Search
# ============================================================

@protected_router.post("/courses/search")
def search_courses(request: CourseSearchRequest = Body(...)):
    return course_service.search_courses(request)


@protected_router.get("/courses/{course_id}")
def get_course(course_id: str):
    course = course_service.get_course_details(course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    return course


@protected_router.get("/sections/{section_id}")
def get_section(section_id: str):
    from repositories import course_repository

    section = course_repository.get_section_by_id(section_id)
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")
    return section


@protected_router.get("/terms")
def get_terms():
    return course_service.get_all_terms()


# ============================================================
# Generate Schedules
# ============================================================

@protected_router.get("/schedules/generate")
def generate_schedules(course_ids: List[str] = Query(..., description="List of course IDs to schedule")):
    return schedule_service.generate_schedules(course_ids, limit=5)


# ============================================================
# User Schedule CRUD
# ============================================================

class CreateScheduleRequest(BaseModel):
    user_id: str
    name: str = Field(..., min_length=1, max_length=80)
    term_code: str = Field(..., min_length=4, max_length=16)


@protected_router.post("/schedules")
def create_schedule(req: CreateScheduleRequest = Body(...), auth_user_id: str = Depends(require_auth)):
    ensure_matching_user(auth_user_id, req.user_id, detail="You can only create schedules for your own account")
    try:
        return user_service.create_schedule(req.user_id, req.name, req.term_code)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@protected_router.delete("/schedules/{schedule_id}")
def delete_schedule(schedule_id: str, user_id: str = Query(...), auth_user_id: str = Depends(require_auth)):
    ensure_matching_user(auth_user_id, user_id, detail="You can only delete your own schedules")
    try:
        success = user_service.delete_schedule(user_id, schedule_id)
        if not success:
            raise HTTPException(status_code=404, detail="Schedule not found or could not be deleted")
        return {"status": "success"}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


class AddCourseRequest(BaseModel):
    user_id: str
    schedule_id: str
    section_id: str


@protected_router.post("/user/schedule/add")
def add_section(req: AddCourseRequest = Body(...), auth_user_id: str = Depends(require_auth)):
    ensure_matching_user(auth_user_id, req.user_id, detail="You can only edit your own schedules")
    try:
        return user_service.add_section(req.user_id, req.schedule_id, req.section_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


class RemoveCourseRequest(BaseModel):
    user_id: str
    schedule_id: str
    section_id: str


@protected_router.delete("/user/schedule/remove")
def remove_section(req: RemoveCourseRequest = Body(...), auth_user_id: str = Depends(require_auth)):
    ensure_matching_user(auth_user_id, req.user_id, detail="You can only edit your own schedules")
    try:
        return user_service.remove_section(req.user_id, req.schedule_id, req.section_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@protected_router.get("/user/schedule")
def view_courses(user_id: str, auth_user_id: str = Depends(require_auth)):
    ensure_matching_user(auth_user_id, user_id, detail="You can only view your own schedules")
    from repositories import course_repository

    schedules = user_service.get_schedules(user_id)
    all_section_ids = {section_id for schedule in schedules for section_id in schedule.get("section_ids", [])}
    resolved_sections = course_repository.get_sections_by_ids(list(all_section_ids))
    section_map = {str(section.get("id")): section for section in resolved_sections}

    for schedule in schedules:
        expanded_sections = []
        for section_id in schedule.get("section_ids", []):
            section_metadata = section_map.get(section_id)
            if section_metadata:
                expanded_sections.append(section_metadata)
            else:
                expanded_sections.append({"id": section_id, "section_id": section_id})
        schedule["sections"] = expanded_sections

    return schedules


app.include_router(public_router)
app.include_router(protected_router)
