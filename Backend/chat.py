from fastapi import APIRouter, Depends, HTTPException, Header, Query, Body
from pydantic import BaseModel
import os
import psycopg
from dotenv import load_dotenv
import requests as http_requests
from typing import Dict, Any, List, Optional
import uuid
import traceback

from services import ping_service, cache_service, pulse_service
from repositories import feed_repository, user_repository
from db_config import CONNECTION_PARAMS
from auth.clerk_middleware import require_auth, optional_auth, ensure_matching_user

# Force reload from the exact .env file
env_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(dotenv_path=env_path, override=True)

router = APIRouter(prefix="/chat", tags=["chat"])

# --- Models ---

class FeedActivity(BaseModel):
    activity: Dict[str, Any]

class ReactionPayload(BaseModel):
    kind: str
    activity_id: str
    user_id: str
    data: Dict[str, Any] | None = None

class BlockRequest(BaseModel):
    target_id: str

class ReportRequest(BaseModel):
    reportee_id: str
    post_type: str
    post_id: str
    reason: str
    comment: Optional[str] = None
    place_id: Optional[str] = None

# --- User Management (Clerk) ---

@router.get("/users")
async def list_users(exclude_id: str = "", _auth_user_id: str = Depends(require_auth)):
    """Returns all Clerk users for messaging. Pass exclude_id to hide the current user."""
    clerk_secret = os.environ.get("CLERK_SECRET_KEY", "")
    if not clerk_secret:
        raise HTTPException(status_code=500, detail="CLERK_SECRET_KEY not configured")

    try:
        resp = http_requests.get(
            "https://api.clerk.com/v1/users?limit=100",
            headers={"Authorization": f"Bearer {clerk_secret}"},
        )
        resp.raise_for_status()
        users = resp.json()
        result = []
        for u in users:
            if u["id"] == exclude_id:
                continue
            email = u.get("email_addresses", [{}])[0].get("email_address", "")
            first = u.get("first_name") or ""
            last = u.get("last_name") or ""
            result.append({
                "id": u["id"],
                "name": f"{first} {last}".strip() or email,
                "email": email,
                "profile_image_url": u.get("image_url"),
            })
        return result
    except Exception as e:
        print(f"Clerk API Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/token")
@router.post("/feeds/token")
async def get_noop_token(body: Dict[str, Any], auth_user_id: str = Depends(require_auth)):
    """Actually sync the user to our DB during the connection phase to fix the Aggie bug."""
    clerk_id = body.get("clerk_user_id") or auth_user_id
    ensure_matching_user(auth_user_id, clerk_id, detail="You can only initialize chat as yourself")
    if clerk_id:
        user_repository.upsert_user(
            clerk_id=clerk_id,
            full_name=body.get("name"),
            profile_image_url=body.get("image")
        )
    
    return {
        "stream_user_id": clerk_id or "native_user",
        "stream_user_token": "native_flow_no_stream_needed",
        "stream_api_key": "native"
    }

# --- Feed Proxy (Now 100% Native) ---

@router.get("/feeds/proxy/{feed_group}/{feed_id}")
async def proxy_get_feed(
    feed_group: str,
    feed_id: str,
    limit: int = 25,
    clerk_id: str = Header(None, alias="X-Clerk-User-Id"),
    auth_user_id: str | None = Depends(optional_auth),
):
    """Fetch feed activities natively (Postgres) with Redis Backbone caching."""
    try:
        if auth_user_id and clerk_id:
            ensure_matching_user(auth_user_id, clerk_id, detail="Feed identity header does not match the signed-in user")
        resolved_user_id = auth_user_id or clerk_id

        # 1. Check Backbone Cache
        cache_key = f"feed:backbone:{feed_group}:{feed_id}"
        backbone = cache_service.get_json(cache_key)
        
        raw_items = []
        if backbone:
            raw_items = backbone[:limit]
        else:
            # Backbone Miss - Fetch from DB (unfiltered by user)
            if feed_group == "flat":
                if feed_id.startswith("place_review_"):
                    place_id = feed_id.replace("place_review_", "")
                    raw_items = feed_repository.get_place_reviews(place_id, limit=limit*2) # Get extra for filtering headroom
                elif feed_id in ["campus_global", "campus_pings", "reels_global"]:
                    post_types = ['post', 'reel', 'ping']
                    if feed_id == "campus_pings": post_types = ['ping']
                    elif feed_id == "reels_global": post_types = ['reel']
                    raw_items = feed_repository.get_crowdping_feed(post_types=post_types, limit=limit*2)
            
            # Store in Backbone Cache (60s TTL for active session freshness)
            if raw_items:
                cache_service.set_json(cache_key, raw_items, ttl_seconds=60)

        # 2. In-Memory Personalization (Filtering & Hydration)
        blocked_ids = _get_blocked_ids_cached(resolved_user_id) if resolved_user_id else []
        
        filtered_items = [item for item in raw_items if item.get("user_id") not in blocked_ids]
        final_list = filtered_items[:limit]
        
        # 3. Hydrate with Scores & Own Reactions
        ids_to_hydrate = [item["id"] for item in final_list]
        interaction_map = feed_repository.get_batch_interaction_counts(ids_to_hydrate)
        
        results = []
        for item in final_list:
            pid = item["id"]
            # Detect own reactions for this specific caller
            own_reactions = {}
            if resolved_user_id:
                post_type = item.get("post_type") or ("review" if feed_id.startswith("place_review_") else "post")
                all_ints = feed_repository.get_post_interactions(pid, post_type)
                own_reactions = {i["interaction_type"]: [True] for i in all_ints if i["user_id"] == resolved_user_id}
            
            if feed_id.startswith("place_review_"):
                results.append(_transform_review_to_activity(item, interaction_map.get(pid, {}), own_reactions))
            else:
                results.append(_transform_post_to_activity(item, interaction_map.get(pid, {}), own_reactions))

        return {"results": results}

    except Exception as e:
        print(f"Native Feed Fetch Error: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))


def _transform_review_to_activity(r: Dict[str, Any], counts: Dict[str, Any], own_reactions: Dict[str, Any] = None) -> Dict[str, Any]:
    return {
        "id": r["id"],
        "actor": {
            "id": f"SU:{r['user_id']}",
            "data": {
                "name": r["user_name"],
                "image": r["user_image"]
            }
        },
        "verb": "review",
        "object": f"place:{r['place_id']}",
        "text": r["body"],
        "time": r["created_at"],
        "custom": {
            "user_name": r["user_name"],
            "user_image": r["user_image"],
            "user_id": r["user_id"],
            "rating": r["rating"],
            "images": r["images"],
            "place_id": r["place_id"]
        },
        "reaction_counts": counts,
        "own_reactions": own_reactions or {}
    }

def _transform_post_to_activity(p: Dict[str, Any], counts: Dict[str, Any], own_reactions: Dict[str, Any] = None) -> Dict[str, Any]:
    attachments = []
    for img in p["images"]:
        attachments.append({
            "type": "video" if p["post_type"] == "reel" else "image",
            "image_url": img if p["post_type"] != "reel" else None,
            "asset_url": img if p["post_type"] == "reel" else None,
        })
    
    activity = {
        "id": p["id"],
        "actor": {
            "id": f"SU:{p['user_id']}",
            "data": {
                "name": p["user_name"],
                "image": p["user_image"]
            }
        },
        "verb": p["post_type"],
        "object": p["id"],
        "text": p["content"],
        "time": p["created_at"],
        "attachments": attachments,
        "custom": {
            **p["custom_data"],
            "user_name": p["user_name"],
            "user_image": p["user_image"],
            "location_tag": p["location_tag"],
            "lat": p["lat"],
            "lng": p["lng"]
        },
        "reaction_counts": counts,
        "own_reactions": own_reactions or {}
    }
    return activity

@router.post("/feeds/proxy/{feed_group}/{feed_id}")
async def proxy_add_activity(feed_group: str, feed_id: str, body: FeedActivity, auth_user_id: str = Depends(require_auth)):
    """Add an activity to the feed (100% Native Postgres)."""
    try:
        activity = body.activity
        user_id = activity["actor"].replace("SU:", "")
        ensure_matching_user(auth_user_id, user_id, detail="You can only create activity as yourself")
        content = activity.get("text", "")
        verb = activity.get("verb", "post")
        custom = activity.get("custom", {})
        
        if feed_group == "flat" and feed_id.startswith("place_review_"):
            feed_repository.add_place_review(
                place_id=custom.get("place_id", ""),
                user_id=user_id,
                rating=custom.get("rating", 0),
                body=content,
                user_name=custom.get("user_name", "Aggie"),
                user_image=custom.get("user_image", ""),
                images=custom.get("images", []),
                is_anonymous=custom.get("is_anonymous", False)
            )
        elif feed_group == "flat" and feed_id in ["campus_global", "campus_pings", "reels_global"]:
            if feed_id == "campus_pings":
                 activity = ping_service.normalize_ping_activity_payload(activity)
                 custom = activity.get("custom", {})
            
            images = custom.get("images", [])
            if not images and "attachments" in activity:
                images = [att.get("image_url") or att.get("asset_url") for att in activity["attachments"] if att.get("image_url") or att.get("asset_url")]

            feed_repository.add_crowdping_post(
                user_id=user_id,
                content=content,
                post_type=verb,
                user_name=custom.get("user_name", "Aggie"),
                user_image=custom.get("user_image", ""),
                lat=custom.get("lat") or custom.get("place_lat"),
                lng=custom.get("lng") or custom.get("place_lng"),
                location_tag=custom.get("location_tag", ""),
                images=images,
                custom_data=custom
            )
        
        cache_service.delete(f"feed:backbone:{feed_group}:{feed_id}")
        if feed_group == "flat" and feed_id == "campus_pings":
            pulse_service.invalidate_pulse_map_cache()
        return {"status": "success", "message": "Activity recorded natively"}
    except Exception as e:
        print(f"Native Write Error: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/feeds/proxy/{feed_group}/{feed_id}/{activity_id}")
async def proxy_delete_activity(
    feed_group: str,
    feed_id: str,
    activity_id: str,
    user_id: str = "",
    clerk_id: str = Header(None, alias="X-Clerk-User-Id"),
    auth_user_id: str = Depends(require_auth),
):
    """Delete activity from native storage (Postgres)."""
    try:
        if clerk_id:
            ensure_matching_user(auth_user_id, clerk_id, detail="Delete identity header does not match the signed-in user")
        if user_id:
            ensure_matching_user(auth_user_id, user_id, detail="You can only delete your own activity")
        final_user_id = auth_user_id

        # Check both tables as the ID could be in either
        deleted = False
        if feed_id.startswith("place_review_"):
            deleted = feed_repository.delete_place_review(activity_id, final_user_id)
        else:
            deleted = feed_repository.delete_crowdping_post(activity_id, final_user_id)
        if deleted:
            cache_service.delete(f"feed:backbone:{feed_group}:{feed_id}")
            if feed_group == "flat" and feed_id == "campus_pings":
                pulse_service.invalidate_pulse_map_cache()
            return {"status": "success"}
        else:
            raise HTTPException(status_code=404, detail="Activity not found or unauthorized")
    except HTTPException:
        raise
    except Exception as e:
        print(f"Delete Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/feeds/proxy/reactions")
async def proxy_add_reaction(body: ReactionPayload, auth_user_id: str = Depends(require_auth)):
    """Add a reaction (Like/Comment/Upvote/Downvote) natively with toggle support."""
    try:
        ensure_matching_user(auth_user_id, body.user_id, detail="You can only react as yourself")
        # 1. Resolve naming/image from DB if possible to fix "Aggie" bug
        user_profile = user_repository.get_user(body.user_id)
        final_name = user_profile.get("full_name") if user_profile else (body.data.get("name") if body.data else "Aggie")
        final_image = user_profile.get("profile_image_url") if user_profile else (body.data.get("image") if body.data else "")

        # 2. Add interaction
        res = feed_repository.add_post_interaction(
            post_id=body.activity_id,
            post_type="crowdping", 
            user_id=body.user_id,
            interaction_type=body.kind,
            comment_text=body.data.get("text") or body.data.get("comment") if body.data else None,
            user_name=final_name,
            user_image=final_image
        )
        pulse_service.invalidate_pulse_map_cache()
        
        if res.get("status") in ["unliked", "removed"]:
            return {"removed": True, "reaction_id": res.get("id") or "toggle"}
            
        return {
            "id": res.get("id", "new"),
            "kind": body.kind,
            "activity_id": body.activity_id,
            "user_id": body.user_id,
            "data": body.data,
            "user": {
                "id": body.user_id,
                "name": res.get("user_name", final_name),
                "image": res.get("user_image", final_image)
            }
        }
    except Exception as e:
        print(f"Native Reaction Error: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/feeds/proxy/reactions/{activity_id}/{kind}")
async def proxy_get_reactions(activity_id: str, kind: str):
    """Fetch reactions natively from Postgres."""
    try:
        interactions = feed_repository.get_post_interactions(activity_id, "crowdping", interaction_type=kind)
        # Transform to Stream reaction format for frontend compatibility
        results = []
        for i in interactions:
            results.append({
                "id": i["id"],
                "kind": i["interaction_type"],
                "user_id": i["user_id"],
                "user": {
                    "id": i["user_id"],
                    "name": i["user_name"],
                    "image": i["user_image"]
                },
                "data": {"text": i["comment_text"]} if i["comment_text"] else {},
                "created_at": i["created_at"]
            })
        return {"results": results}
    except Exception as e:
        print(f"Native Get Reactions Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# --- Block & Report Endpoints ---

@router.post("/users/{clerk_id}/block")
async def proxy_block_user(clerk_id: str, body: BlockRequest = Body(...), auth_user_id: str = Depends(require_auth)):
    """Block another user for the current account only."""
    try:
        ensure_matching_user(auth_user_id, clerk_id, detail="You can only block users from your own account")
        feed_repository.add_block(clerk_id, body.target_id)
        # Invalidate cached blocked list
        cache_service.delete(f"user:blocks:{clerk_id}")
        return {"status": "success"}
    except Exception as e:
        print(f"Block Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/users/{clerk_id}/blocked")
async def get_blocked_users(clerk_id: str, auth_user_id: str = Depends(require_auth)):
    """Return a list of user profiles that the current user has blocked."""
    try:
        ensure_matching_user(auth_user_id, clerk_id, detail="You can only view your own blocked list")
        blocked_ids = feed_repository.get_blocked_user_ids(clerk_id)
        if not blocked_ids:
            return []
            
        profiles = []
        with psycopg.connect(CONNECTION_PARAMS) as conn:
            with conn.cursor() as cur:
                for bid in blocked_ids:
                    profile = user_repository.get_user(bid)
                    if profile:
                        profiles.append({
                            "id": profile["clerk_id"],
                            "name": profile["full_name"] or "Aggie User",
                            "profile_image_url": profile["profile_image_url"]
                        })
                        continue

                    cur.execute(
                        """
                        SELECT organization_name
                        FROM admin_applications
                        WHERE clerk_id = %s
                        """,
                        (bid,),
                    )
                    admin_row = cur.fetchone()
                    if admin_row:
                        profiles.append({
                            "id": bid,
                            "name": admin_row[0] or "Campus organizer",
                            "profile_image_url": None,
                        })
                    else:
                        profiles.append({
                            "id": bid,
                            "name": "Blocked user",
                            "profile_image_url": None,
                        })
        return profiles
    except Exception as e:
        print(f"Get Blocked Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/users/{clerk_id}/block/{target_id}")
async def proxy_unblock_user(clerk_id: str, target_id: str, auth_user_id: str = Depends(require_auth)):
    """Unblock another user."""
    try:
        ensure_matching_user(auth_user_id, clerk_id, detail="You can only unblock users from your own account")
        removed = feed_repository.remove_block(clerk_id, target_id)
        if not removed:
            raise HTTPException(status_code=404, detail="Block record not found")
        cache_service.delete(f"user:blocks:{clerk_id}")
        return {"status": "success"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/reports")
async def proxy_report_content(body: ReportRequest, auth_user_id: str = Depends(require_auth)):
    """Submit a report for content."""
    try:
        report_id = feed_repository.add_content_report(
            reporter_id=auth_user_id,
            reportee_id=body.reportee_id,
            post_type=body.post_type,
            post_id=body.post_id,
            reason=body.reason,
            comment=body.comment,
            place_id=body.place_id
        )
        return {"status": "success", "report_id": report_id}
    except Exception as e:
        print(f"Report Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

def _get_blocked_ids_cached(clerk_id: str) -> List[str]:
    """Helper to fetch blocked IDs with Redis caching."""
    cache_key = f"user:blocks:{clerk_id}"
    cached = cache_service.get_json(cache_key)
    if cached is not None:
        return cached
    
    ids = feed_repository.get_blocked_user_ids(clerk_id)
    cache_service.set_json(cache_key, ids, ttl_seconds=3600)
    return ids
