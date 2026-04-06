from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel

from auth.clerk_middleware import ensure_matching_user, require_auth
from repositories import tag_repository

router = APIRouter(prefix="/clubs", tags=["Clubs"])


class ClubJoinRequestCreate(BaseModel):
    clerk_id: str


@router.get("")
def list_clubs(clerk_id: str = Query(...), auth_user_id: str = Depends(require_auth)):
    ensure_matching_user(auth_user_id, clerk_id, detail="You can only view club access for your own account")
    return tag_repository.list_clubs_for_user(requester_clerk_id=clerk_id)


@router.post("/{admin_clerk_id}/join-requests")
def request_club_join(
    admin_clerk_id: str,
    req: ClubJoinRequestCreate = Body(...),
    auth_user_id: str = Depends(require_auth),
):
    ensure_matching_user(auth_user_id, req.clerk_id, detail="You can only request club access as yourself")
    try:
        return tag_repository.create_club_join_request(
            admin_clerk_id=admin_clerk_id,
            requester_clerk_id=req.clerk_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
