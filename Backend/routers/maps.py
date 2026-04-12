
from typing import Optional
from fastapi import APIRouter, Body, HTTPException, Query
from pydantic import BaseModel, Field

from services import global_map_service


router = APIRouter(prefix="/maps", tags=["Maps"])


class RouteCoordinate(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)


class RouteRequest(BaseModel):
    origin: RouteCoordinate
    destination: RouteCoordinate
    mode: str = Field("drive")
    origin_name: Optional[str] = None
    destination_name: Optional[str] = None


@router.get("/search")
def search_places(
    query: str = Query(..., min_length=2),
    limit: int = Query(8, ge=1, le=10),
):
    try:
        return global_map_service.search_places(query=query, limit=limit)
    except Exception as exc:
        print(f"Global map search failed: {exc}")
        raise HTTPException(status_code=503, detail="Global map search is unavailable right now.") from exc


@router.post("/route")
def build_route(request: RouteRequest = Body(...)):
    try:
        return global_map_service.route_between(
            origin_lat=request.origin.latitude,
            origin_lng=request.origin.longitude,
            destination_lat=request.destination.latitude,
            destination_lng=request.destination.longitude,
            mode=request.mode,
            origin_name=request.origin_name,
            destination_name=request.destination_name,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        print(f"Global routing failed: {exc}")
        raise HTTPException(status_code=503, detail="Global routing is unavailable right now.") from exc
