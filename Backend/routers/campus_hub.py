from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Body, Query, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from models.base import SanitizedBaseModel
from rate_limit import limiter

from services import campus_hub_service, campus_places_service, place_registry_service, pulse_service
from auth.clerk_middleware import require_auth, optional_auth, ensure_matching_user

router = APIRouter(prefix="/campus", tags=["Campus Hub"])


class ConnectionRequest(SanitizedBaseModel):
    requester_id: str
    recipient_id: str


class EventRSVPRequest(SanitizedBaseModel):
    clerk_id: str
    event_id: str
    response: str


class ConnectorCaptureRequest(SanitizedBaseModel):
    clerk_id: str
    system_id: str
    source_url: str = Field(..., max_length=2048)
    page_title: Optional[str] = Field(default=None, max_length=500)
    page_html: Optional[str] = None
    page_text: Optional[str] = None
    cookie_names: Optional[List[str]] = None


def require_clerk_user(clerk_id: str, user_id: str = Depends(require_auth)) -> str:
    return ensure_matching_user(user_id, clerk_id, detail="You can only access your own campus data")


@router.get("/health")
def campus_health():
    return {"status": "ok", "message": "Campus hub router is active"}


@router.get("/overview")
@limiter.limit("30/minute")
def get_overview(request: Request, clerk_id: str = Query(...), _auth_user_id: str = Depends(require_clerk_user)):
    return campus_hub_service.get_overview(clerk_id)


@router.get("/auth/status")
@limiter.limit("60/minute")
def get_auth_status(request: Request, clerk_id: str = Query(...), _auth_user_id: str = Depends(require_clerk_user)):
    return campus_hub_service.get_auth_status(clerk_id)


@router.get("/academics")
@limiter.limit("30/minute")
def get_academics(request: Request, clerk_id: str = Query(...), _auth_user_id: str = Depends(require_clerk_user)):
    return campus_hub_service.get_academic_snapshot(clerk_id)


@router.get("/dining/account")
@limiter.limit("30/minute")
def get_dining_account(request: Request, clerk_id: str = Query(...), _auth_user_id: str = Depends(require_clerk_user)):
    return campus_hub_service.get_dining_snapshot(clerk_id)


@router.get("/notifications")
@limiter.limit("120/minute")
def get_notifications(request: Request, clerk_id: str = Query(...), _auth_user_id: str = Depends(require_clerk_user)):
    return campus_hub_service.get_notification_hub(clerk_id)


@router.get("/career")
@limiter.limit("30/minute")
def get_career(request: Request, clerk_id: str = Query(...), _auth_user_id: str = Depends(require_clerk_user)):
    return campus_hub_service.get_career_snapshot(clerk_id)


@router.get("/network/discover")
@limiter.limit("20/minute")
def discover_network(
    request: Request,
    clerk_id: str = Query(...),
    query: Optional[str] = Query(None),
    major: Optional[str] = Query(None),
    limit: int = Query(8, ge=1, le=25),
    _auth_user_id: str = Depends(require_clerk_user),
):
    return campus_hub_service.discover_network(clerk_id, query=query, major=major, limit=limit)


@router.post("/network/request")
@limiter.limit("10/minute")
def create_connection_request(request: Request, connection_req: ConnectionRequest = Body(...), auth_user_id: str = Depends(require_auth)):
    ensure_matching_user(auth_user_id, connection_req.requester_id, detail="You can only create connection requests as yourself")
    return campus_hub_service.create_connection_request(connection_req.requester_id, connection_req.recipient_id)


@router.get("/events")
@limiter.limit("100/minute")
def get_events(
    request: Request,
    clerk_id: Optional[str] = Query(None),
    limit: int = Query(250, ge=1, le=1000),
    category: Optional[str] = Query(None),
    student_relevant_only: bool = Query(True),
    campus: str = Query("tamu"),
    refresh: bool = Query(False),
    auth_user_id: Optional[str] = Depends(optional_auth),
) -> Dict[str, Any]:
    if clerk_id is not None and auth_user_id is None:
        # Gracefully downgrade to anonymous mode if auth failed but clerk_id was requested
        clerk_id = None

    if clerk_id is not None:
        ensure_matching_user(auth_user_id, clerk_id, detail="You can only personalize events for your own account")
    return campus_hub_service.get_events_snapshot(
        clerk_id,
        limit=limit,
        student_relevant_only=student_relevant_only,
        campus=campus,
        force_refresh=refresh,
    )


@router.get("/places/registry")
@limiter.limit("60/minute")
def get_places_registry(request: Request):
    return place_registry_service.get_all_places()


@router.get("/places/map")
@limiter.limit("60/minute")
def get_places_map(request: Request):
    return campus_places_service.get_places_map_snapshot()


@router.get("/places/{place_id}/detail")
@limiter.limit("100/minute")
def get_place_detail(request: Request, place_id: str):
    return campus_hub_service.get_place_detail_snapshot_by_identifier(place_id)


@router.get("/pulse/map")
@limiter.limit("60/minute")
def get_pulse_map(
    request: Request,
    limit: int = Query(60, ge=1, le=100),
    clerk_id: Optional[str] = Query(default=None),
    auth_user_id: Optional[str] = Depends(optional_auth),
):
    if clerk_id:
        if not auth_user_id:
            raise HTTPException(status_code=401, detail="Authentication required")
        ensure_matching_user(
            auth_user_id,
            clerk_id,
            detail="You can only request your own personalized pulse map",
        )
    return pulse_service.get_pulse_map(limit=limit, clerk_id=clerk_id)


@router.post("/events/rsvp")
@limiter.limit("30/minute")
def save_rsvp(request: Request, rsvp_req: EventRSVPRequest = Body(...), auth_user_id: str = Depends(require_auth)):
    ensure_matching_user(auth_user_id, rsvp_req.clerk_id, detail="You can only RSVP as yourself")
    return campus_hub_service.save_event_rsvp(rsvp_req.clerk_id, rsvp_req.event_id, rsvp_req.response)


@router.get("/transit")
@limiter.limit("60/minute")
def get_transit(request: Request):
    return campus_hub_service.get_transit_snapshot()


@router.get("/recreation")
@limiter.limit("60/minute")
def get_recreation(request: Request):
    return campus_hub_service.get_recreation_snapshot()


@router.get("/services")
@limiter.limit("60/minute")
def get_services(request: Request):
    return campus_hub_service.get_services_snapshot()


@router.get("/connectors")
@limiter.limit("60/minute")
def get_connectors(request: Request, clerk_id: str = Query(...), _auth_user_id: str = Depends(require_clerk_user)):
    return campus_hub_service.get_connector_snapshots(clerk_id)


@router.post("/connectors/capture")
@limiter.limit("10/minute")
def capture_connector_snapshot(request: Request, capture_req: ConnectorCaptureRequest = Body(...), auth_user_id: str = Depends(require_auth)):
    ensure_matching_user(auth_user_id, capture_req.clerk_id, detail="You can only modify your own connectors")
    return campus_hub_service.capture_connector_snapshot(
        capture_req.clerk_id,
        capture_req.system_id,
        capture_req.source_url,
        capture_req.page_title,
        capture_req.page_html,
        capture_req.page_text,
        capture_req.cookie_names,
    )


@router.delete("/connectors/{system_id}")
@limiter.limit("30/minute")
def delete_connector_snapshot(request: Request, system_id: str, clerk_id: str = Query(...), _auth_user_id: str = Depends(require_clerk_user)):
    return campus_hub_service.delete_connector_snapshot(clerk_id, system_id)
