from fastapi import APIRouter, HTTPException, Query, Body, Depends
from pydantic import BaseModel
from typing import Optional, List
import psycopg
import json
from db_config import CONNECTION_PARAMS
import datetime

router = APIRouter(prefix="/admin", tags=["Admin"])


class AdminApplicationRequest(BaseModel):
    clerk_id: str
    email: str
    organization_name: str
    reason: str


class AdminEventCreateRequest(BaseModel):
    clerk_id: str
    title: str
    description: str
    lat: float
    lng: float
    location_name: str
    start_time: str
    end_time: str


@router.get("/status")
def get_admin_status(clerk_id: str = Query(...)):
    """Check if a user is an admin or has a pending application."""
    from repositories import user_repository
    user = user_repository.get_user(clerk_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    is_admin = user.get("is_admin", False)
    
    # Check application status
    application_status = None
    try:
        with psycopg.connect(CONNECTION_PARAMS) as conn:
            with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
                cur.execute(
                    "SELECT status FROM admin_applications WHERE clerk_id = %s",
                    (clerk_id,)
                )
                row = cur.fetchone()
                if row:
                    application_status = row["status"]
    except Exception as e:
        print(f"Error checking admin application: {e}")
        
    return {
        "is_admin": is_admin,
        "application_status": application_status
    }


@router.post("/apply")
def submit_admin_application(req: AdminApplicationRequest):
    try:
        with psycopg.connect(CONNECTION_PARAMS) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO admin_applications (clerk_id, email, organization_name, reason, status)
                    VALUES (%s, %s, %s, %s, 'pending')
                    ON CONFLICT(clerk_id) DO UPDATE SET
                    organization_name = EXCLUDED.organization_name,
                    reason = EXCLUDED.reason,
                    status = 'pending',
                    created_at = NOW()
                    RETURNING id
                    """,
                    (req.clerk_id, req.email, req.organization_name, req.reason)
                )
                app_id = cur.fetchone()[0]
                conn.commit()
                return {"status": "success", "application_id": app_id}
    except Exception as e:
        print(f"Error applying for admin: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/events")
def create_admin_event(req: AdminEventCreateRequest):
    from repositories import user_repository
    user = user_repository.get_user(req.clerk_id)
    if not user or not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Unauthorized")
        
    try:
        with psycopg.connect(CONNECTION_PARAMS) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO admin_events
                    (clerk_id, title, description, lat, lng, location_name, start_time, end_time)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING id
                    """,
                    (req.clerk_id, req.title, req.description, req.lat, req.lng, req.location_name, req.start_time, req.end_time)
                )
                event_id = cur.fetchone()[0]
                conn.commit()
                
                # Mock notification feature
                print(f"[NOTIFICATION MOCK] Sending notification to users: New admin event '{req.title}' created by {req.clerk_id}!")
                
                return {"status": "success", "event_id": str(event_id)}
    except Exception as e:
        print(f"Error creating admin event: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/events/me")
def get_my_admin_events(clerk_id: str = Query(...)):
    """Fetch events created by this admin, along with share counts and RSVP counts."""
    from repositories import user_repository
    user = user_repository.get_user(clerk_id)
    if not user or not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Unauthorized")
        
    try:
        with psycopg.connect(CONNECTION_PARAMS) as conn:
            with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
                cur.execute(
                    """
                    SELECT e.id, e.title, e.description, e.lat, e.lng, e.location_name, 
                           e.start_time, e.end_time, e.shares_count, e.created_at,
                           (SELECT COUNT(*) FROM campus_event_rsvps r WHERE r.event_id = e.id::TEXT) as rsvp_count
                    FROM admin_events e
                    WHERE e.clerk_id = %s
                    ORDER BY e.created_at DESC
                    """,
                    (clerk_id,)
                )
                events = cur.fetchall()
                # Parse times correctly for JSON
                for event in events:
                    event['id'] = str(event['id'])
                    event['start_time'] = event['start_time'].isoformat() if event['start_time'] else None
                    event['end_time'] = event['end_time'].isoformat() if event['end_time'] else None
                    event['created_at'] = event['created_at'].isoformat() if event['created_at'] else None
                return events
    except Exception as e:
        print(f"Error fetching admin events: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/events/{event_id}/share")
def track_admin_event_share(event_id: str):
    """Track an admin event share."""
    try:
        with psycopg.connect(CONNECTION_PARAMS) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE admin_events
                    SET shares_count = shares_count + 1
                    WHERE id = %s
                    RETURNING shares_count
                    """,
                    (event_id,)
                )
                res = cur.fetchone()
                conn.commit()
                if not res:
                    raise HTTPException(status_code=404, detail="Event not found")
                return {"status": "success", "shares_count": res[0]}
    except HTTPException:
         raise
    except Exception as e:
        print(f"Error tracking share count: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
