from fastapi import APIRouter, Body, Query
from pydantic import BaseModel

from services import campus_hub_service, campus_places_service, place_registry_service, pulse_service

router = APIRouter(prefix="/campus", tags=["Campus Hub"])


class ConnectionRequest(BaseModel):
    requester_id: str
    recipient_id: str


class EventRSVPRequest(BaseModel):
    clerk_id: str
    event_id: str
    response: str


class ConnectorCaptureRequest(BaseModel):
    clerk_id: str
    system_id: str
    source_url: str
    page_title: str | None = None
    page_html: str | None = None
    page_text: str | None = None
    cookie_names: list[str] | None = None


@router.get("/health")
def campus_health():
    return {"status": "ok", "message": "Campus hub router is active"}


@router.get("/overview")
def get_overview(clerk_id: str = Query(...)):
    return campus_hub_service.get_overview(clerk_id)


@router.get("/auth/status")
def get_auth_status(clerk_id: str = Query(...)):
    return campus_hub_service.get_auth_status(clerk_id)


@router.get("/academics")
def get_academics(clerk_id: str = Query(...)):
    return campus_hub_service.get_academic_snapshot(clerk_id)


@router.get("/dining/account")
def get_dining_account(clerk_id: str = Query(...)):
    return campus_hub_service.get_dining_snapshot(clerk_id)


@router.get("/notifications")
def get_notifications(clerk_id: str = Query(...)):
    return campus_hub_service.get_notification_hub(clerk_id)


@router.get("/career")
def get_career(clerk_id: str = Query(...)):
    return campus_hub_service.get_career_snapshot(clerk_id)


@router.get("/network/discover")
def discover_network(
    clerk_id: str = Query(...),
    query: str | None = Query(None),
    major: str | None = Query(None),
    limit: int = Query(8, ge=1, le=25),
):
    return campus_hub_service.discover_network(clerk_id, query=query, major=major, limit=limit)


@router.post("/network/request")
def create_connection_request(request: ConnectionRequest = Body(...)):
    return campus_hub_service.create_connection_request(request.requester_id, request.recipient_id)


@router.get("/events")
def get_events(
    clerk_id: str | None = Query(None),
    limit: int = Query(250, ge=1, le=1000),
    category: str | None = Query(None),
    student_relevant_only: bool = Query(True),
):
    return campus_hub_service.get_events_snapshot(
        clerk_id,
        limit=limit,
        category=category,
        student_relevant_only=student_relevant_only,
    )


@router.get("/places/registry")
def get_places_registry():
    return place_registry_service.get_all_places()


@router.get("/places/map")
def get_places_map():
    return campus_places_service.get_places_map_snapshot()


@router.get("/places/{place_id}/detail")
def get_place_detail(place_id: str):
    return campus_hub_service.get_place_detail_snapshot_by_identifier(place_id)


@router.get("/pulse/map")
def get_pulse_map(limit: int = Query(12, ge=1, le=25)):
    return pulse_service.get_pulse_map(limit=limit)


@router.post("/events/rsvp")
def save_rsvp(request: EventRSVPRequest = Body(...)):
    return campus_hub_service.save_event_rsvp(request.clerk_id, request.event_id, request.response)


@router.get("/transit")
def get_transit():
    return campus_hub_service.get_transit_snapshot()


@router.get("/recreation")
def get_recreation():
    return campus_hub_service.get_recreation_snapshot()


@router.get("/services")
def get_services():
    return campus_hub_service.get_services_snapshot()


@router.get("/connectors")
def get_connectors(clerk_id: str = Query(...)):
    return campus_hub_service.get_connector_snapshots(clerk_id)


@router.post("/connectors/capture")
def capture_connector_snapshot(request: ConnectorCaptureRequest = Body(...)):
    return campus_hub_service.capture_connector_snapshot(
        request.clerk_id,
        request.system_id,
        request.source_url,
        request.page_title,
        request.page_html,
        request.page_text,
        request.cookie_names,
    )


@router.delete("/connectors/{system_id}")
def delete_connector_snapshot(system_id: str, clerk_id: str = Query(...)):
    return campus_hub_service.delete_connector_snapshot(clerk_id, system_id)
