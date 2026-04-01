import os
import asyncio
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel

from auth.clerk_middleware import require_auth
from services import canvas_service, user_service
from repositories import user_repository

router = APIRouter(prefix="/canvas", tags=["Canvas Connect"])

CANVAS_APP_DEEPLINK = os.getenv("CANVAS_APP_DEEPLINK", "exp://localhost:8081")

@router.get("/auth")
def canvas_auth(user_id: str = Depends(require_auth)):
    """Return the Canvas OAuth URL to redirect the user to."""
    url = canvas_service.get_oauth_url(user_id)
    return {"oauth_url": url}

@router.get("/callback")
def canvas_callback(code: str, state: str, error: str = None):
    """Handle OAuth2 callback from Canvas."""
    if error:
        return RedirectResponse(url=f"{CANVAS_APP_DEEPLINK}/--/canvas/error?error={error}")
    
    user_id = state
    try:
        token_data = canvas_service.exchange_code_for_token(code)
        
        access_token = token_data.get("access_token")
        refresh_token = token_data.get("refresh_token")
        # For simplicity, store some distant future expiration if expires_in is given,
        # but the prompt mentions token expiration (1 hour typically).
        from datetime import datetime, timedelta
        expires_at = datetime.now() + timedelta(seconds=token_data.get("expires_in", 3600))
        
        user_service.save_canvas_tokens(
            clerk_id=user_id,
            access_token=access_token,
            refresh_token=refresh_token,
            expires_at=expires_at,
            instance_url="https://canvas.tamu.edu"
        )

        return RedirectResponse(url=f"{CANVAS_APP_DEEPLINK}/--/canvas/success")
    except Exception as e:
        print(f"Canvas OAuth failed: {e}")
        return RedirectResponse(url=f"{CANVAS_APP_DEEPLINK}/--/canvas/error?error=failed_exchange")

# ==============================================================================
# Me Endpoints (Using dependency injection)
# ==============================================================================

def get_canvas_token(user_id: str):
    profile = user_repository.get_user(user_id)
    if not profile or not profile.get("canvas_access_token"):
        raise HTTPException(status_code=400, detail="User not connected to Canvas")
    
    # Ideally, we should check expires_at and refresh using 'canvas_refresh_token' automatically here,
    # but for this MVP we try using token or expect error.
    return profile["canvas_access_token"], profile.get("canvas_instance_url", "https://canvas.tamu.edu")

@router.get("/me/courses")
def my_courses(user_id: str = Depends(require_auth)):
    access_token, instance_url = get_canvas_token(user_id)
    return canvas_service.get_courses(access_token, instance_url)

@router.get("/me/assignments")
def my_assignments(user_id: str = Depends(require_auth)):
    access_token, instance_url = get_canvas_token(user_id)
    return canvas_service.get_todo_items(access_token, instance_url)

@router.get("/me/schedule")
def my_schedule(user_id: str = Depends(require_auth)):
    access_token, instance_url = get_canvas_token(user_id)
    return canvas_service.get_upcoming_events(access_token, instance_url)

@router.get("/me/grades")
def my_grades(course_id: str, user_id: str = Depends(require_auth)):
    access_token, instance_url = get_canvas_token(user_id)
    return canvas_service.get_grades(access_token, instance_url, course_id)

@router.get("/me/dashboard")
async def my_dashboard(user_id: str = Depends(require_auth)):
    """Fetch all necessary data in parallel."""
    cached = canvas_service.dashboard_cache.get(user_id)
    if cached:
        return cached

    access_token, instance_url = get_canvas_token(user_id)
    
    # Run fetch concurrently 
    try:
        loop = asyncio.get_event_loop()
        courses_def = loop.run_in_executor(None, canvas_service.get_courses, access_token, instance_url)
        todo_def = loop.run_in_executor(None, canvas_service.get_todo_items, access_token, instance_url)
        schedule_def = loop.run_in_executor(None, canvas_service.get_upcoming_events, access_token, instance_url)
        
        courses, todo, schedule = await asyncio.gather(courses_def, todo_def, schedule_def)
        
        # Get announcements based on active courses
        course_ids = [str(c["id"]) for c in courses if "id" in c]
        announcements = canvas_service.get_announcements(access_token, instance_url, course_ids) \
            if course_ids else []

        data = {
            "courses": courses,
            "todo": todo,
            "schedule": schedule,
            "announcements": announcements
        }
        canvas_service.dashboard_cache.set(user_id, data)
        return data

    except Exception as e:
        print(f"Error building dashboard: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch Canvas data")
