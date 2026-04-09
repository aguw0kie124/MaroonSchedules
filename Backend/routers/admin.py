from fastapi import APIRouter, HTTPException, Query, Body, Depends
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import psycopg

from db_config import CONNECTION_PARAMS
from auth.clerk_middleware import require_auth, ensure_matching_user
from services import cache_service, encryption_service
from repositories import tag_repository

from models.base import SanitizedBaseModel
from rate_limit import limiter
from fastapi import Request

router = APIRouter(prefix="/admin", tags=["Admin"])


def _ensure_admin_review_schema(conn: psycopg.Connection) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS admin_events (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                clerk_id TEXT NOT NULL,
                title TEXT NOT NULL,
                description TEXT,
                lat DOUBLE PRECISION,
                lng DOUBLE PRECISION,
                location_name TEXT,
                start_time TIMESTAMPTZ NOT NULL,
                end_time TIMESTAMPTZ,
                shares_count INTEGER DEFAULT 0,
                google_review_url TEXT,
                image_url TEXT,
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
            """
        )
        cur.execute("ALTER TABLE admin_events ADD COLUMN IF NOT EXISTS google_review_url TEXT")
        cur.execute("ALTER TABLE admin_events ADD COLUMN IF NOT EXISTS image_url TEXT")
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS admin_event_reviews (
                id BIGSERIAL PRIMARY KEY,
                event_id UUID REFERENCES admin_events(id) ON DELETE CASCADE,
                clerk_id TEXT NOT NULL,
                rating INTEGER NOT NULL,
                feedback TEXT,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE(event_id, clerk_id)
            )
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS admin_event_review_dismissals (
                event_id UUID REFERENCES admin_events(id) ON DELETE CASCADE,
                clerk_id TEXT NOT NULL,
                dismiss_count INTEGER NOT NULL DEFAULT 0,
                suppressed BOOLEAN NOT NULL DEFAULT FALSE,
                updated_at TIMESTAMPTZ DEFAULT NOW(),
                PRIMARY KEY (event_id, clerk_id)
            )
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS campus_event_rsvps (
                clerk_id TEXT NOT NULL,
                event_id TEXT NOT NULL,
                response TEXT NOT NULL,
                updated_at TIMESTAMPTZ DEFAULT NOW(),
                PRIMARY KEY (clerk_id, event_id)
            )
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS admin_event_subscriptions (
                user_clerk_id TEXT NOT NULL,
                admin_clerk_id TEXT NOT NULL,
                muted BOOLEAN NOT NULL DEFAULT TRUE,
                updated_at TIMESTAMPTZ DEFAULT NOW(),
                PRIMARY KEY (user_clerk_id, admin_clerk_id)
            )
            """
        )
    tag_repository._ensure_tag_schema(conn)


class AdminApplicationRequest(SanitizedBaseModel):
    clerk_id: str
    email: Optional[str] = Field(default=None, max_length=320)
    organization_name: Optional[str] = Field(default=None, max_length=120)
    reason: Optional[str] = Field(default=None, max_length=2000)


class AdminEventCreateRequest(SanitizedBaseModel):
    clerk_id: str
    title: str = Field(..., min_length=1, max_length=140)
    description: str = Field(..., max_length=4000)
    lat: Optional[float] = None
    lng: Optional[float] = None
    location_name: str = Field(..., min_length=1, max_length=200)
    start_time: str
    end_time: str
    google_review_url: Optional[str] = Field(default=None, max_length=2048)
    image_url: Optional[str] = Field(default=None, max_length=2048)
    tags: list[str] = Field(default_factory=list)


class AdminEventUpdateRequest(AdminEventCreateRequest):
    pass


class AdminEventReviewRequest(SanitizedBaseModel):
    clerk_id: str
    rating: int = Field(..., ge=1, le=5)
    feedback: Optional[str] = Field(default=None, max_length=2000)


class AdminEventReviewDismissRequest(SanitizedBaseModel):
    clerk_id: str


class AdminOrganizerPreferenceRequest(SanitizedBaseModel):
    clerk_id: str


class AdminUserTagsRequest(SanitizedBaseModel):
    clerk_id: str
    tags: list[str] = Field(default_factory=list)


class AdminClubSettingsRequest(SanitizedBaseModel):
    clerk_id: str
    club_tag: Optional[str] = Field(default=None, max_length=80)
    auto_approve_join_requests: bool = False


class ClubJoinReviewRequest(SanitizedBaseModel):
    clerk_id: str
    assign_club_tag: bool = True


def require_clerk_user(clerk_id: str, user_id: str = Depends(require_auth)) -> str:
    return ensure_matching_user(
        user_id,
        clerk_id,
        detail="You can only access your own admin data",
    )


def _require_admin_user(clerk_id: str):
    from repositories import user_repository

    user = user_repository.get_user(clerk_id)
    if not user or not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Unauthorized")
    return user


def _require_owned_admin_event(cur, event_id: str, clerk_id: str):
    cur.execute("SELECT id, clerk_id FROM admin_events WHERE id = %s", (event_id,))
    event = cur.fetchone()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    owner_id = event["clerk_id"] if isinstance(event, dict) else event[1]
    if owner_id != clerk_id:
        raise HTTPException(status_code=403, detail="Unauthorized")
    return event


def _invalidate_admin_event_caches() -> None:
    for key in [
        "campus:pulse:map:v2:12",
        "campus:pulse:map:v2:25",
        "campus:pulse:map:v2:8",
    ]:
        cache_service.delete(key)


def _ensure_admin_application_schema(conn: psycopg.Connection) -> None:
    tag_repository._ensure_tag_schema(conn)


def _normalize_admin_application(req: AdminApplicationRequest) -> Dict[str, Optional[str]]:
    organization_name = (req.organization_name or "").strip()
    if len(organization_name) < 2:
        raise HTTPException(
            status_code=400,
            detail="Organization name must be at least 2 characters.",
        )

    reason = (req.reason or "").strip()
    if len(reason) < 10:
        raise HTTPException(
            status_code=400,
            detail="Tell us a little more about why you need admin access.",
        )

    email = (req.email or "").strip() or None
    return {
        "email": email,
        "organization_name": organization_name,
        "reason": reason,
    }


@router.get("/status")
@limiter.limit("60/minute")
def get_admin_status(
    request: Request,
    clerk_id: str = Query(...),
    _auth_user_id: str = Depends(require_clerk_user),
):
    from repositories import user_repository

    user = user_repository.get_user(clerk_id) or {"is_admin": False}

    application_status = None
    try:
        with psycopg.connect(CONNECTION_PARAMS) as conn:
            _ensure_admin_application_schema(conn)
            with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
                cur.execute(
                    "SELECT status FROM admin_applications WHERE clerk_id = %s",
                    (clerk_id,),
                )
                row = cur.fetchone()
                if row:
                    application_status = row["status"]
    except Exception as e:
        print(f"Error checking admin application: {e}")

    return {
        "is_admin": user.get("is_admin", False),
        "application_status": application_status,
    }


@router.get("/tags")
@limiter.limit("60/minute")
def get_available_tags(
    request: Request,
    clerk_id: str = Query(...),
    query: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=100),
    _auth_user_id: str = Depends(require_clerk_user),
):
    _require_admin_user(clerk_id)
    return {"tags": tag_repository.list_tags(query=query, limit=limit)}


@router.get("/users")
def get_users_for_tag_management(
    clerk_id: str = Query(...),
    query: Optional[str] = Query(default=None),
    limit: int = Query(default=25, ge=1, le=100),
    _auth_user_id: str = Depends(require_clerk_user),
):
    _require_admin_user(clerk_id)
    return tag_repository.search_users(query=query, limit=limit)


@router.put("/users/{target_clerk_id}/tags")
def update_user_tags(
    target_clerk_id: str,
    req: AdminUserTagsRequest,
    auth_user_id: str = Depends(require_auth),
):
    ensure_matching_user(
        auth_user_id,
        req.clerk_id,
        detail="You can only manage user tags as yourself",
    )
    _require_admin_user(req.clerk_id)
    from repositories import user_repository

    user = user_repository.get_user(target_clerk_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    updated_tags = tag_repository.set_user_tags(target_clerk_id, req.tags)
    user["tags"] = updated_tags
    return user


@router.get("/club/settings")
def get_club_tag_settings(
    clerk_id: str = Query(...),
    _auth_user_id: str = Depends(require_clerk_user),
):
    admin_user = _require_admin_user(clerk_id)
    settings = tag_repository.get_club_settings(clerk_id)
    return {
        "clerk_id": clerk_id,
        "organization_name": settings.get("organization_name") or admin_user.get("full_name") or "Campus organizer",
        "club_tag": settings.get("club_tag"),
        "auto_approve_join_requests": bool(settings.get("auto_approve_join_requests")),
    }


@router.put("/club/settings")
def update_club_tag_settings(
    req: AdminClubSettingsRequest,
    auth_user_id: str = Depends(require_auth),
):
    ensure_matching_user(
        auth_user_id,
        req.clerk_id,
        detail="You can only manage your own club settings",
    )
    admin_user = _require_admin_user(req.clerk_id)
    organization_name = admin_user.get("full_name") or "Campus organizer"
    current = tag_repository.get_club_settings(req.clerk_id)
    if current.get("organization_name"):
        organization_name = current["organization_name"]

    settings = tag_repository.update_club_settings(
        admin_clerk_id=req.clerk_id,
        organization_name=organization_name,
        email=admin_user.get("email") or f"{req.clerk_id}@example.com",
        club_tag=req.club_tag,
        auto_approve_join_requests=req.auto_approve_join_requests,
    )
    return {
        "clerk_id": req.clerk_id,
        "organization_name": settings.get("organization_name") or organization_name,
        "club_tag": settings.get("club_tag"),
        "auto_approve_join_requests": bool(settings.get("auto_approve_join_requests")),
    }


@router.get("/club-join-requests")
def get_club_join_requests(
    clerk_id: str = Query(...),
    status: Optional[str] = Query(default=None),
    _auth_user_id: str = Depends(require_clerk_user),
):
    _require_admin_user(clerk_id)
    return tag_repository.list_club_join_requests(clerk_id, status=status)


@router.post("/club-join-requests/{request_id}/approve")
def approve_club_join_request(
    request_id: str,
    req: ClubJoinReviewRequest,
    auth_user_id: str = Depends(require_auth),
):
    ensure_matching_user(
        auth_user_id,
        req.clerk_id,
        detail="You can only approve club requests as yourself",
    )
    _require_admin_user(req.clerk_id)
    try:
        return tag_repository.review_club_join_request(
            request_id=request_id,
            admin_clerk_id=req.clerk_id,
            approve=True,
            assign_club_tag=req.assign_club_tag,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/club-join-requests/{request_id}/reject")
def reject_club_join_request(
    request_id: str,
    req: ClubJoinReviewRequest,
    auth_user_id: str = Depends(require_auth),
):
    ensure_matching_user(
        auth_user_id,
        req.clerk_id,
        detail="You can only reject club requests as yourself",
    )
    _require_admin_user(req.clerk_id)
    try:
        return tag_repository.review_club_join_request(
            request_id=request_id,
            admin_clerk_id=req.clerk_id,
            approve=False,
            assign_club_tag=False,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/apply")
@limiter.limit("5/minute")
def submit_admin_application(
    request: Request,
    req: AdminApplicationRequest,
    auth_user_id: str = Depends(require_auth),
):
    ensure_matching_user(
        auth_user_id,
        req.clerk_id,
        detail="You can only submit your own admin application",
    )
    normalized = _normalize_admin_application(req)
    try:
        from repositories import user_repository

        existing_user = user_repository.get_user(req.clerk_id) or {}
        application_email = (
            normalized["email"]
            or existing_user.get("email")
            or f"{req.clerk_id}@users.clerk.local"
        )
        user_repository.upsert_user(
            req.clerk_id,
            email=application_email,
            full_name=existing_user.get("full_name"),
            profile_image_url=existing_user.get("profile_image_url"),
        )

        with psycopg.connect(CONNECTION_PARAMS) as conn:
            _ensure_admin_application_schema(conn)
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
                    (
                        req.clerk_id,
                        application_email,
                        normalized["organization_name"],
                        normalized["reason"],
                    ),
                )
                app_id = cur.fetchone()[0]
                conn.commit()
                return {"status": "success", "application_id": app_id}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error applying for admin: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/events")
@limiter.limit("30/minute")
def create_admin_event(
    request: Request,
    req: AdminEventCreateRequest,
    auth_user_id: str = Depends(require_auth),
):
    ensure_matching_user(
        auth_user_id,
        req.clerk_id,
        detail="You can only create admin events as yourself",
    )
    _require_admin_user(req.clerk_id)
    if req.google_review_url and not req.google_review_url.startswith(("http://", "https://")):
        raise HTTPException(
            status_code=400,
            detail="Google review URL must start with http:// or https://",
        )

    try:
        with psycopg.connect(CONNECTION_PARAMS) as conn:
            _ensure_admin_review_schema(conn)
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO admin_events
                    (clerk_id, title, description, lat, lng, location_name, start_time, end_time, google_review_url, image_url)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING id
                    """,
                    (
                        req.clerk_id,
                        encryption_service.encrypt_string(req.title),
                        encryption_service.encrypt_string(req.description),
                        req.lat,
                        req.lng,
                        req.location_name,
                        req.start_time,
                        req.end_time,
                        req.google_review_url,
                        req.image_url,
                    ),
                )
                event_id = cur.fetchone()[0]
                tag_repository.set_event_tags(str(event_id), req.tags, conn=conn)
                conn.commit()
                _invalidate_admin_event_caches()
                print(
                    f"[NOTIFICATION MOCK] Sending notification to users: New admin event '{req.title}' created by {req.clerk_id}!"
                )
                return {"status": "success", "event_id": str(event_id)}
    except Exception as e:
        print(f"Error creating admin event: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.put("/events/{event_id}")
def update_admin_event(
    event_id: str,
    req: AdminEventUpdateRequest,
    auth_user_id: str = Depends(require_auth),
):
    ensure_matching_user(
        auth_user_id,
        req.clerk_id,
        detail="You can only update admin events as yourself",
    )
    _require_admin_user(req.clerk_id)

    try:
        with psycopg.connect(CONNECTION_PARAMS) as conn:
            _ensure_admin_review_schema(conn)
            with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
                _require_owned_admin_event(cur, event_id, req.clerk_id)
                cur.execute(
                    """
                    UPDATE admin_events
                    SET title = %s,
                        description = %s,
                        lat = %s,
                        lng = %s,
                        location_name = %s,
                        start_time = %s,
                        end_time = %s,
                        google_review_url = %s,
                        image_url = %s
                    WHERE id = %s
                    RETURNING id
                    """,
                    (
                        encryption_service.encrypt_string(req.title),
                        encryption_service.encrypt_string(req.description),
                        req.lat,
                        req.lng,
                        req.location_name,
                        req.start_time,
                        req.end_time,
                        req.google_review_url,
                        req.image_url,
                        event_id,
                    ),
                )
                updated = cur.fetchone()
                tag_repository.set_event_tags(str(event_id), req.tags, conn=conn)
                conn.commit()
                _invalidate_admin_event_caches()
                return {"status": "success", "event_id": str(updated["id"])}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating admin event: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.delete("/events/{event_id}")
def delete_admin_event(
    event_id: str,
    clerk_id: str = Query(...),
    _auth_user_id: str = Depends(require_clerk_user),
):
    _require_admin_user(clerk_id)

    try:
        with psycopg.connect(CONNECTION_PARAMS) as conn:
            _ensure_admin_review_schema(conn)
            with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
                _require_owned_admin_event(cur, event_id, clerk_id)
                cur.execute("DELETE FROM campus_event_rsvps WHERE event_id = %s", (event_id,))
                cur.execute("DELETE FROM event_tags WHERE event_id = %s", (event_id,))
                cur.execute("DELETE FROM admin_events WHERE id = %s RETURNING id", (event_id,))
                deleted = cur.fetchone()
                conn.commit()
                _invalidate_admin_event_caches()
                return {"status": "success", "event_id": str(deleted["id"])}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting admin event: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/events/me")
def get_my_admin_events(
    clerk_id: str = Query(...),
    _auth_user_id: str = Depends(require_clerk_user),
):
    _require_admin_user(clerk_id)

    try:
        with psycopg.connect(CONNECTION_PARAMS) as conn:
            _ensure_admin_review_schema(conn)
            with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
                cur.execute(
                    """
                    SELECT e.id, e.title, e.description, e.lat, e.lng, e.location_name,
                           e.start_time, e.end_time, e.shares_count, e.created_at, e.google_review_url, e.image_url,
                           COALESCE(
                               (
                                   SELECT json_agg(t.label ORDER BY t.label)
                                   FROM event_tags et
                                   JOIN tags t ON t.id = et.tag_id
                                   WHERE et.event_id = e.id::TEXT
                               ),
                               '[]'::json
                           ) AS access_tags,
                           (SELECT COUNT(*) FROM campus_event_rsvps r WHERE r.event_id = e.id::TEXT) as rsvp_count,
                           (SELECT COALESCE(AVG(r3.rating), 0) FROM admin_event_reviews r3 WHERE r3.event_id = e.id) as avg_rating,
                           (SELECT json_agg(json_build_object('rating', r2.rating, 'feedback', r2.feedback, 'created_at', r2.created_at)) FROM admin_event_reviews r2 WHERE r2.event_id = e.id AND r2.rating <= 3) as private_feedbacks
                    FROM admin_events e
                    WHERE e.clerk_id = %s
                    ORDER BY e.created_at DESC
                    """,
                    (clerk_id,),
                )
                events = cur.fetchall()
                for event in events:
                    event["id"] = str(event["id"])
                    event["start_time"] = event["start_time"].isoformat() if event["start_time"] else None
                    event["end_time"] = event["end_time"].isoformat() if event["end_time"] else None
                    event["created_at"] = event["created_at"].isoformat() if event["created_at"] else None
                    event["access_tags"] = event.get("access_tags") or []
                    event["private_feedbacks"] = event["private_feedbacks"] or []
                return events
    except Exception as e:
        print(f"Error fetching admin events: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/events/{event_id}/share")
@limiter.limit("5/minute")
def track_admin_event_share(request: Request, event_id: str):
    try:
        with psycopg.connect(CONNECTION_PARAMS) as conn:
            _ensure_admin_review_schema(conn)
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE admin_events
                    SET shares_count = shares_count + 1
                    WHERE id = %s
                    RETURNING shares_count
                    """,
                    (event_id,),
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


@router.get("/events/pending-reviews")
def get_pending_reviews(
    clerk_id: str = Query(...),
    event_id: Optional[str] = Query(default=None),
    _auth_user_id: str = Depends(require_clerk_user),
):
    try:
        with psycopg.connect(CONNECTION_PARAMS) as conn:
            _ensure_admin_review_schema(conn)
            with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
                query = """
                    SELECT e.id, e.title, e.location_name, e.google_review_url
                    FROM admin_events e
                    JOIN campus_event_rsvps r ON r.event_id = e.id::TEXT
                    WHERE r.clerk_id = %s
                    AND (r.response = 'going' OR r.response = 'yes')
                    AND COALESCE(e.end_time, e.start_time + interval '6 hours') < NOW()
                    AND NOT EXISTS (
                        SELECT 1 FROM admin_event_reviews rev
                        WHERE rev.event_id = e.id AND rev.clerk_id = %s
                    )
                    AND NOT EXISTS (
                        SELECT 1 FROM admin_event_review_dismissals dis
                        WHERE dis.event_id = e.id
                        AND dis.clerk_id = %s
                        AND dis.suppressed = TRUE
                    )
                """
                params = [clerk_id, clerk_id, clerk_id]
                if event_id:
                    query += " AND e.id::TEXT = %s"
                    params.append(event_id)
                query += """
                    ORDER BY COALESCE(e.end_time, e.start_time + interval '6 hours') DESC
                    LIMIT 1
                """
                cur.execute(query, tuple(params))
                event = cur.fetchone()
                if event:
                    event["id"] = str(event["id"])
                return event
    except Exception as e:
        print(f"Error checking pending reviews: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/events/{event_id}/reviews")
@limiter.limit("10/minute")
def submit_event_review(
    request: Request,
    event_id: str,
    req: AdminEventReviewRequest,
    auth_user_id: str = Depends(require_auth),
):
    ensure_matching_user(
        auth_user_id,
        req.clerk_id,
        detail="You can only submit reviews as yourself",
    )
    try:
        with psycopg.connect(CONNECTION_PARAMS) as conn:
            _ensure_admin_review_schema(conn)
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT 1
                    FROM admin_events e
                    JOIN campus_event_rsvps r ON r.event_id = e.id::TEXT
                    WHERE e.id = %s
                    AND r.clerk_id = %s
                    AND (r.response = 'going' OR r.response = 'yes')
                    AND COALESCE(e.end_time, e.start_time + interval '6 hours') < NOW()
                    LIMIT 1
                    """,
                    (event_id, req.clerk_id),
                )
                if not cur.fetchone():
                    raise HTTPException(
                        status_code=403,
                        detail="You can only review events you attended after they end",
                    )
                cur.execute(
                    """
                    INSERT INTO admin_event_reviews (event_id, clerk_id, rating, feedback)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (event_id, clerk_id) DO UPDATE SET
                    rating = EXCLUDED.rating,
                    feedback = EXCLUDED.feedback,
                    created_at = NOW()
                    """,
                    (event_id, req.clerk_id, req.rating, req.feedback),
                )
                conn.commit()
                return {"status": "success"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error submitting review: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/events/{event_id}/review-dismiss")
def dismiss_event_review(
    event_id: str,
    req: AdminEventReviewDismissRequest,
    auth_user_id: str = Depends(require_auth),
):
    ensure_matching_user(
        auth_user_id,
        req.clerk_id,
        detail="You can only dismiss your own review prompts",
    )
    try:
        with psycopg.connect(CONNECTION_PARAMS) as conn:
            _ensure_admin_review_schema(conn)
            with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
                cur.execute(
                    """
                    INSERT INTO admin_event_review_dismissals (event_id, clerk_id, dismiss_count, suppressed, updated_at)
                    VALUES (%s, %s, 1, FALSE, NOW())
                    ON CONFLICT (event_id, clerk_id) DO UPDATE SET
                    dismiss_count = admin_event_review_dismissals.dismiss_count + 1,
                    suppressed = (admin_event_review_dismissals.dismiss_count + 1) >= 2,
                    updated_at = NOW()
                    RETURNING dismiss_count, suppressed
                    """,
                    (event_id, req.clerk_id),
                )
                result = cur.fetchone()
                conn.commit()
                return {
                    "status": "success",
                    "dismiss_count": result["dismiss_count"],
                    "suppressed": result["suppressed"],
                }
    except Exception as e:
        print(f"Error dismissing event review prompt: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/admins/{admin_clerk_id}/unsubscribe")
def unsubscribe_from_admin(
    admin_clerk_id: str,
    req: AdminOrganizerPreferenceRequest,
    auth_user_id: str = Depends(require_auth),
):
    ensure_matching_user(
        auth_user_id,
        req.clerk_id,
        detail="You can only update your own organizer preferences",
    )
    if not req.clerk_id:
        raise HTTPException(status_code=400, detail="Missing user id")

    try:
        with psycopg.connect(CONNECTION_PARAMS) as conn:
            _ensure_admin_review_schema(conn)
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO admin_event_subscriptions (user_clerk_id, admin_clerk_id, muted, updated_at)
                    VALUES (%s, %s, TRUE, NOW())
                    ON CONFLICT (user_clerk_id, admin_clerk_id) DO UPDATE SET
                    muted = TRUE,
                    updated_at = NOW()
                    """,
                    (req.clerk_id, admin_clerk_id),
                )
                conn.commit()
                return {
                    "status": "success",
                    "admin_clerk_id": admin_clerk_id,
                    "muted": True,
                }
    except Exception as e:
        print(f"Error muting admin organizer: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
