from fastapi import APIRouter, Depends, HTTPException, Header, Query, Body
from pydantic import BaseModel
import os
import psycopg
from datetime import datetime
import time
import threading
from dotenv import load_dotenv
import requests as http_requests
from typing import Dict, Any, List, Optional
import uuid
import traceback

from services import ping_service, cache_service, campus_hub_service, pulse_service, tag_access_service
from repositories import feed_repository, user_repository, tag_repository
from db_config import CONNECTION_PARAMS, get_pool
from auth.clerk_middleware import require_auth, optional_auth, ensure_matching_user

# Force reload from the exact .env file
env_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(dotenv_path=env_path, override=True)

from models.base import SanitizedBaseModel
from rate_limit import limiter
from fastapi import Request

router = APIRouter(prefix="/chat", tags=["chat"])

ACCESS_SCOPE_CACHE_TTL_SECONDS = 300
BLOCK_IDS_CACHE_TTL_SECONDS = 3600
BLOCK_RELATIONSHIPS_CACHE_TTL_SECONDS = 3600

_ACCESS_SCOPE_CACHE: Dict[str, tuple[float, Dict[str, Any]]] = {}
_BLOCK_IDS_CACHE: Dict[str, tuple[float, List[str]]] = {}
_BLOCK_RELATIONSHIPS_CACHE: Dict[str, tuple[float, List[str]]] = {}
_LOCAL_CACHE_LOCK = threading.Lock()

# --- Models ---

class FeedActivity(SanitizedBaseModel):
    activity: Dict[str, Any]

class ReactionPayload(SanitizedBaseModel):
    kind: str
    activity_id: str
    user_id: str
    data: Optional[Dict[str, Any]] = None
    parent_id: Optional[str] = None

class BlockRequest(SanitizedBaseModel):
    target_id: str

class ReportRequest(SanitizedBaseModel):
    reportee_id: str
    post_type: str
    post_id: str
    reason: str
    comment: Optional[str] = None
    place_id: Optional[str] = None


class FriendRequest(SanitizedBaseModel):
    target_id: str


def _ensure_social_schema() -> None:
    campus_hub_service._ensure_social_tables()


def _local_cache_get(cache_store: Dict[str, tuple[float, Any]], key: str, ttl_seconds: int) -> Any | None:
    with _LOCAL_CACHE_LOCK:
        cached = cache_store.get(key)
        if not cached:
            return None

        cached_at, payload = cached
        if time.time() - cached_at >= ttl_seconds:
            cache_store.pop(key, None)
            return None
        return payload


def _local_cache_set(cache_store: Dict[str, tuple[float, Any]], key: str, payload: Any) -> Any:
    with _LOCAL_CACHE_LOCK:
        cache_store[key] = (time.time(), payload)
    return payload


def _local_cache_delete(cache_store: Dict[str, tuple[float, Any]], key: str) -> None:
    with _LOCAL_CACHE_LOCK:
        cache_store.pop(key, None)


def _invalidate_feed_cache(feed_group: str, feed_id: str) -> None:
    cache_service.delete(f"feed:backbone:{feed_group}:{feed_id}")


def _invalidate_ping_related_caches(feed_group: str, feed_id: str) -> None:
    _invalidate_feed_cache(feed_group, feed_id)
    if feed_group == "flat" and feed_id == "campus_pings":
        _invalidate_feed_cache("flat", "campus_global")
        pulse_service.invalidate_pulse_map_cache()


def _coerce_access_tags(value: Any) -> List[str]:
    if isinstance(value, str):
        return [value]
    if isinstance(value, (list, tuple, set)):
        return [str(entry) for entry in value if entry]
    return []


def _resolve_access_scope(clerk_id: Optional[str]) -> tuple[List[str], bool]:
    if not clerk_id:
        return [], False

    profile = user_repository.get_user(clerk_id) or {}
    try:
        user_tags = tag_repository.get_user_tags(clerk_id)
    except Exception as exc:
        print(f"[chat] failed to load user tags for {clerk_id}: {exc}")
        user_tags = []
    return user_tags, bool(profile.get("is_admin"))


def _passes_access_filter(item: Dict[str, Any], user_tags: List[str], bypass_restrictions: bool) -> bool:
    custom = item.get("custom_data") or {}
    access_tags = _coerce_access_tags(custom.get("access_tags"))
    return tag_access_service.has_matching_access_tag(
        user_tags=user_tags,
        access_tags=access_tags,
        bypass_restrictions=bypass_restrictions,
    )


def _parse_feed_cursor_created_at(value: Optional[str]) -> Optional[str]:
    if not value or not isinstance(value, str):
        return None

    try:
        return datetime.fromisoformat(value).isoformat()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid feed cursor") from exc


def _cursor_from_feed_item(item: Dict[str, Any]) -> Optional[Dict[str, str]]:
    created_at = item.get("created_at")
    item_id = item.get("id")
    if not created_at or not item_id:
        return None
    return {
        "createdAt": str(created_at),
        "id": str(item_id),
    }

# --- User Management (Clerk) ---

@router.get("/users")
@limiter.limit("60/minute")
async def list_users(request: Request, exclude_id: str = "", _auth_user_id: str = Depends(require_auth)):
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

@router.get("/users/{clerk_id}/public")
async def get_public_profile(clerk_id: str, _auth_user_id: Optional[str] = Depends(optional_auth)):
    """Return sanitized profile for public viewing (no sensitive data)."""
    profile = user_repository.get_user(clerk_id)
    if not profile:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "clerk_id": profile["clerk_id"],
        "full_name": profile.get("full_name") or "Aggie User",
        "profile_image_url": profile.get("profile_image_url"),
        "major": profile.get("major"),
        "graduation_year": profile.get("graduation_year"),
        "bio": profile.get("bio"),
        "website": profile.get("website"),
    }

# --- Feed Proxy (Now 100% Native) ---

def _resolve_access_scope_cached(clerk_id: Optional[str]) -> tuple[List[str], bool]:
    """Retrieves user tags and admin status with short-lived local caching."""
    if not clerk_id:
        return [], False
    
    cache_key = f"auth:access_scope:{clerk_id}"
    cached = _local_cache_get(_ACCESS_SCOPE_CACHE, cache_key, ACCESS_SCOPE_CACHE_TTL_SECONDS)
    if cached is not None:
        return cached["tags"], cached["is_admin"]
    
    # Cache miss
    from repositories import tag_repository, user_repository
    profile = user_repository.get_user(clerk_id) or {}
    try:
        user_tags = tag_repository.get_user_tags(clerk_id)
    except Exception as exc:
        print(f"[chat] failed to load user tags for {clerk_id}: {exc}")
        user_tags = []
    
    is_admin = bool(profile.get("is_admin"))
    result = {"tags": user_tags, "is_admin": is_admin}
    _local_cache_set(_ACCESS_SCOPE_CACHE, cache_key, result)
    return user_tags, is_admin


@router.get("/feeds/proxy/{feed_group}/{feed_id}")
@limiter.limit("120/minute")
async def proxy_get_feed(
    request: Request,
    feed_group: str,
    feed_id: str,
    limit: int = Query(25, ge=1, le=100),
    cursor_created_at: Optional[str] = Query(None),
    cursor_id: Optional[str] = Query(None),
    clerk_id: Optional[str] = Query(None),
    refresh: bool = Query(False),
    auth_user_id: Optional[str] = Depends(optional_auth),
):
    """Fetch feed activities natively (Postgres) with Redis Backbone caching."""
    try:
        _ensure_social_schema()
        if auth_user_id and clerk_id:
            ensure_matching_user(auth_user_id, clerk_id, detail="Feed identity header does not match the signed-in user")
        resolved_user_id = auth_user_id or clerk_id
        user_access_tags, bypass_access_restrictions = _resolve_access_scope_cached(resolved_user_id)
        blocked_ids = _get_block_relationship_ids_cached(resolved_user_id) if resolved_user_id else []

        # 1. Check Backbone Cache
        cache_key = f"feed:backbone:{feed_group}:{feed_id}"
        if feed_id == "for_u" and resolved_user_id:
            cache_key = f"feed:backbone:{feed_group}:for_u:{resolved_user_id}"

        raw_cursor_created_at = _parse_feed_cursor_created_at(cursor_created_at)
        raw_cursor_id = cursor_id if isinstance(cursor_id, str) and cursor_id else None
        if bool(raw_cursor_created_at) != bool(raw_cursor_id):
            raise HTTPException(status_code=400, detail="Invalid feed cursor")

        use_backbone_cache = not raw_cursor_created_at and not raw_cursor_id
        supports_cursor_feed = (
            feed_group == "flat"
            and (
                feed_id in ["campus_global", "campus_pings", "reels_global"]
                or (feed_id == "for_u" and not resolved_user_id)
            )
        )

        if refresh and use_backbone_cache:
            cache_service.delete(cache_key)
            backbone = None
        elif use_backbone_cache:
            backbone = cache_service.get_json(cache_key)
        else:
            backbone = None
        
        batch_limit = min(max(limit * 2, 20), 100)
        visible_items: List[Dict[str, Any]] = []
        source_exhausted = False
        pending_cursor_created_at = raw_cursor_created_at
        pending_cursor_id = raw_cursor_id
        cached_first_batch = False

        while len(visible_items) < limit + 1 and not source_exhausted:
            raw_items = []
            batch_supports_cursor = supports_cursor_feed
            if backbone is not None:
                raw_items = list(backbone)
                backbone = None
                cached_first_batch = True
            else:
                # Backbone Miss - Fetch from DB (unfiltered by user)
                if feed_group == "flat":
                    if feed_id == "for_u":
                        if resolved_user_id:
                            raw_items = feed_repository.get_tailored_feed_for_user(resolved_user_id, limit=batch_limit)
                        else:
                            if pending_cursor_created_at and pending_cursor_id:
                                raw_items = feed_repository.get_crowdping_feed(
                                    post_types=['ping', 'post'],
                                    limit=batch_limit,
                                    cursor_created_at=pending_cursor_created_at,
                                    cursor_id=pending_cursor_id,
                                )
                            else:
                                raw_items = feed_repository.get_crowdping_feed(
                                    post_types=['ping', 'post'],
                                    limit=batch_limit,
                                )
                    elif feed_id.startswith("place_review_"):
                        place_id = feed_id.replace("place_review_", "")
                        raw_items = feed_repository.get_place_reviews(place_id, limit=batch_limit)
                    elif feed_id in ["campus_global", "campus_pings", "reels_global"]:
                        post_types = ['post', 'reel', 'ping']
                        if feed_id == "campus_pings":
                            post_types = ['ping', 'post']
                        elif feed_id == "reels_global":
                            post_types = ['reel']

                        if pending_cursor_created_at and pending_cursor_id:
                            raw_items = feed_repository.get_crowdping_feed(
                                post_types=post_types,
                                limit=batch_limit,
                                cursor_created_at=pending_cursor_created_at,
                                cursor_id=pending_cursor_id,
                            )
                        else:
                            raw_items = feed_repository.get_crowdping_feed(
                                post_types=post_types,
                                limit=batch_limit,
                            )
                    elif feed_id.startswith("user_"):
                        target_user_id = feed_id.replace("user_", "")
                        raw_items = feed_repository.get_user_feed(target_user_id, limit=batch_limit)

                # Keep the first uncached page warm, but refresh often enough that recent pings don't disappear.
                if use_backbone_cache and raw_items and not cached_first_batch:
                    cache_service.set_json(cache_key, raw_items, ttl_seconds=60)
                    cached_first_batch = True

            if not raw_items:
                source_exhausted = True
                break

            filtered_items = [
                item
                for item in raw_items
                if item.get("user_id") not in blocked_ids
                and _passes_access_filter(item, user_access_tags, bypass_access_restrictions)
            ]
            visible_items.extend(filtered_items)

            if len(raw_items) < batch_limit or not batch_supports_cursor:
                source_exhausted = True
                break

            last_raw_item = raw_items[-1]
            pending_cursor_created_at = str(last_raw_item.get("created_at") or "")
            pending_cursor_id = str(last_raw_item.get("id") or "")
            if not pending_cursor_created_at or not pending_cursor_id:
                source_exhausted = True
                break

        # 2. In-Memory Personalization (Filtering & Hydration)
        final_list = visible_items[:limit]
        has_more = len(visible_items) > limit or not source_exhausted
        next_cursor = _cursor_from_feed_item(final_list[-1]) if final_list else None
        
        # 3. Hydrate with Scores & Own Reactions
        ids_to_hydrate = [item["id"] for item in final_list]
        interaction_map = feed_repository.get_batch_interaction_counts(ids_to_hydrate)
        
        # Batch fetch own reactions for the user (Fix N+1)
        user_reactions_map = {}
        if resolved_user_id:
            user_reactions_map = feed_repository.get_user_interactions_batch(resolved_user_id, ids_to_hydrate)
        
        results = []
        for item in final_list:
            pid = item["id"]
            # Detect own reactions for this specific caller
            own_reactions = {}
            user_reactions = user_reactions_map.get(pid, {})
            # Format reactions for frontend Stream compatibility
            for r_type in user_reactions:
                own_reactions[r_type] = [True]
            
            if feed_id.startswith("place_review_"):
                results.append(_transform_review_to_activity(item, interaction_map.get(pid, {}), own_reactions))
            else:
                results.append(_transform_post_to_activity(item, interaction_map.get(pid, {}), own_reactions))

        return {
            "results": results,
            "hasMore": has_more,
            "nextCursor": next_cursor,
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Native Feed Fetch Error: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))


def _transform_review_to_activity(r: Dict[str, Any], counts: Dict[str, Any], own_reactions: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
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

def _transform_post_to_activity(p: Dict[str, Any], counts: Dict[str, Any], own_reactions: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
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
@limiter.limit("10/minute")
async def proxy_add_activity(request: Request, feed_group: str, feed_id: str, body: FeedActivity, auth_user_id: str = Depends(require_auth)):
    """Add an activity to the feed (100% Native Postgres)."""
    try:
        _ensure_social_schema()
        activity = body.activity
        user_id = activity["actor"].replace("SU:", "")
        ensure_matching_user(auth_user_id, user_id, detail="You can only create activity as yourself")
        content = activity.get("text", "")
        verb = activity.get("verb", "post")
        custom = activity.get("custom", {})
        
        created_activity: Optional[Dict[str, Any]] = None
        if feed_group == "flat" and feed_id.startswith("place_review_"):
            created_review = feed_repository.add_place_review(
                place_id=custom.get("place_id", ""),
                user_id=user_id,
                rating=custom.get("rating", 0),
                body=content,
                user_name=custom.get("user_name", "Aggie"),
                user_image=custom.get("user_image", ""),
                images=custom.get("images", []),
                is_anonymous=False,
            )
            created_activity = _transform_review_to_activity(
                created_review,
                {"like": 0, "comment": 0, "upvote": 0, "downvote": 0, "score": 0},
                {},
            )
        elif feed_group == "flat" and feed_id in ["campus_global", "campus_pings", "reels_global"]:
            if feed_id == "campus_pings":
                 activity = ping_service.normalize_ping_activity_payload(activity)
                 custom = activity.get("custom", {})

            is_anonymous = bool(custom.get("is_anonymous"))
            
            images = custom.get("images", [])
            if not images and "attachments" in activity:
                images = [att.get("image_url") or att.get("asset_url") for att in activity["attachments"] if att.get("image_url") or att.get("asset_url")]

            lat = custom.get("lat")
            if lat in (None, ""): lat = custom.get("place_lat")
            if lat in (None, ""): lat = custom.get("location_lat")
            
            lng = custom.get("lng")
            if lng in (None, ""): lng = custom.get("place_lng")
            if lng in (None, ""): lng = custom.get("location_lng")

            try:
                fl_lat = float(lat) if lat not in (None, "") else None
            except ValueError:
                fl_lat = None

            try:
                fl_lng = float(lng) if lng not in (None, "") else None
            except ValueError:
                fl_lng = None

            created_post = feed_repository.add_crowdping_post(
                user_id=user_id,
                content=content,
                post_type=verb,
                user_name=custom.get("user_name", "Aggie"),
                user_image=custom.get("user_image", ""),
                lat=fl_lat,
                lng=fl_lng,
                location_tag=custom.get("location_tag", ""),
                images=images,
                is_anonymous=is_anonymous,
                custom_data={**custom, "is_anonymous": is_anonymous},
            )
            created_activity = _transform_post_to_activity(
                created_post,
                {"like": 0, "comment": 0, "upvote": 0, "downvote": 0, "score": 0},
                {},
            )
        
        _invalidate_ping_related_caches(feed_group, feed_id)
        return {
            "status": "success",
            "message": "Activity recorded natively",
            "activity": created_activity,
        }
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
        _ensure_social_schema()
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
            _invalidate_ping_related_caches(feed_group, feed_id)
            return {"status": "success"}
        else:
            raise HTTPException(status_code=404, detail="Activity not found or unauthorized")
    except HTTPException:
        raise
    except Exception as e:
        print(f"Delete Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/feeds/proxy/reactions")
@limiter.limit("20/minute")
async def proxy_add_reaction(request: Request, body: ReactionPayload, auth_user_id: str = Depends(require_auth)):
    """Add a reaction (Like/Comment/Upvote/Downvote) natively with toggle support."""
    try:
        _ensure_social_schema()
        ensure_matching_user(auth_user_id, body.user_id, detail="You can only react as yourself")
        post_owner_id = feed_repository.get_crowdping_post_owner(body.activity_id)
        if post_owner_id and post_owner_id != body.user_id and feed_repository.has_block_relationship(body.user_id, post_owner_id):
            raise HTTPException(status_code=403, detail="You cannot interact with a user you have blocked or who has blocked you")
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
            user_image=final_image,
            parent_id=body.parent_id
        )
        
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
    except HTTPException:
        raise
    except Exception as e:
        print(f"Native Reaction Error: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/feeds/proxy/reactions/{activity_id}/{kind}")
async def proxy_get_reactions(activity_id: str, kind: str, auth_user_id: Optional[str] = Depends(optional_auth)):
    """Fetch reactions natively from Postgres."""
    try:
        _ensure_social_schema()
        exclude_user_ids = _get_block_relationship_ids_cached(auth_user_id) if auth_user_id else None
        interactions = feed_repository.get_post_interactions(
            activity_id,
            "crowdping",
            interaction_type=kind,
            exclude_user_ids=exclude_user_ids,
        )
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
                "created_at": i["created_at"],
                "parent_id": i.get("parent_id")
            })
        return {"results": results}
    except Exception as e:
        print(f"Native Get Reactions Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# --- Block & Report Endpoints ---

@router.post("/users/{clerk_id}/block")
@limiter.limit("10/minute")
async def proxy_block_user(request: Request, clerk_id: str, body: BlockRequest = Body(...), auth_user_id: str = Depends(require_auth)):
    """Block another user for the current account only."""
    try:
        ensure_matching_user(auth_user_id, clerk_id, detail="You can only block users from your own account")
        feed_repository.add_block(clerk_id, body.target_id)
        # Invalidate cached blocked list
        _local_cache_delete(_BLOCK_IDS_CACHE, f"user:blocks:{clerk_id}")
        _local_cache_delete(_BLOCK_RELATIONSHIPS_CACHE, f"user:block-relationships:{clerk_id}")
        _local_cache_delete(_BLOCK_RELATIONSHIPS_CACHE, f"user:block-relationships:{body.target_id}")
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
        with get_pool().connection() as conn:
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

@router.post("/users/{clerk_id}/profile")
async def update_user_profile(clerk_id: str, body: Dict[str, Any] = Body(...), auth_user_id: str = Depends(require_auth)):
    """Update profile metadata for the current user."""
    try:
        ensure_matching_user(auth_user_id, clerk_id)
        updated = user_repository.update_profile(clerk_id, body)
        if not updated:
            raise HTTPException(status_code=404, detail="User not found")
        # Invalidate related caches
        _local_cache_delete(_ACCESS_SCOPE_CACHE, f"auth:access_scope:{clerk_id}")
        return {"status": "success", "profile": updated}
    except Exception as e:
        print(f"Update Profile Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/users/{clerk_id}/block/{target_id}")
async def proxy_unblock_user(clerk_id: str, target_id: str, auth_user_id: str = Depends(require_auth)):
    """Unblock another user."""
    try:
        ensure_matching_user(auth_user_id, clerk_id, detail="You can only unblock users from your own account")
        removed = feed_repository.remove_block(clerk_id, target_id)
        if not removed:
            raise HTTPException(status_code=404, detail="Block record not found")
        _local_cache_delete(_BLOCK_IDS_CACHE, f"user:blocks:{clerk_id}")
        _local_cache_delete(_BLOCK_RELATIONSHIPS_CACHE, f"user:block-relationships:{clerk_id}")
        _local_cache_delete(_BLOCK_RELATIONSHIPS_CACHE, f"user:block-relationships:{target_id}")
        return {"status": "success"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/users/{clerk_id}/friends")
@limiter.limit("20/minute")
async def add_friend_for_user(
    request: Request,
    clerk_id: str,
    body: FriendRequest = Body(...),
    auth_user_id: str = Depends(require_auth),
):
    try:
        _ensure_social_schema()
        ensure_matching_user(auth_user_id, clerk_id, detail="You can only add friends from your own account")
        if feed_repository.has_block_relationship(clerk_id, body.target_id):
            raise HTTPException(status_code=403, detail="You cannot friend a blocked user")
        # Allow establishing connections even if the target hasn't synced their profile yet
        # The connection will be visible once they sync.
        result = user_repository.add_friend(clerk_id, body.target_id)
        if result.get("status") == "error":
             raise HTTPException(status_code=400, detail=result.get("message", "Could not add friend"))
        return {"status": "success", "friendship": result}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/users/{clerk_id}/friends")
async def get_friends_for_user(clerk_id: str, auth_user_id: str = Depends(require_auth)):
    try:
        _ensure_social_schema()
        ensure_matching_user(auth_user_id, clerk_id, detail="You can only view your own friends list")
        return user_repository.list_friends(clerk_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.delete("/users/{clerk_id}/friends/{target_id}")
async def remove_friend_for_user(clerk_id: str, target_id: str, auth_user_id: str = Depends(require_auth)):
    try:
        _ensure_social_schema()
        ensure_matching_user(auth_user_id, clerk_id, detail="You can only remove friends from your own account")
        removed = user_repository.remove_friend(clerk_id, target_id)
        if not removed:
            raise HTTPException(status_code=404, detail="Friendship not found")
        return {"status": "success"}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/users/{clerk_id}/friends/search")
async def search_users_for_friends(
    clerk_id: str,
    query: str = Query(..., min_length=1),
    limit: int = Query(10, ge=1, le=25),
    auth_user_id: str = Depends(require_auth),
):
    try:
        _ensure_social_schema()
        ensure_matching_user(auth_user_id, clerk_id, detail="You can only search friends for your own account")
        return user_repository.search_users(clerk_id, query, limit=limit)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

@router.post("/reports")
@limiter.limit("5/minute")
async def proxy_report_content(request: Request, body: ReportRequest, auth_user_id: str = Depends(require_auth)):
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
    """Helper to fetch blocked IDs with local caching."""
    cache_key = f"user:blocks:{clerk_id}"
    cached = _local_cache_get(_BLOCK_IDS_CACHE, cache_key, BLOCK_IDS_CACHE_TTL_SECONDS)
    if cached is not None:
        return cached
    
    ids = feed_repository.get_blocked_user_ids(clerk_id)
    _local_cache_set(_BLOCK_IDS_CACHE, cache_key, ids)
    return ids


def _get_block_relationship_ids_cached(clerk_id: str) -> List[str]:
    """Users the caller has blocked or who have blocked the caller."""
    cache_key = f"user:block-relationships:{clerk_id}"
    cached = _local_cache_get(
        _BLOCK_RELATIONSHIPS_CACHE,
        cache_key,
        BLOCK_RELATIONSHIPS_CACHE_TTL_SECONDS,
    )
    if cached is not None:
        return cached

    ids = feed_repository.get_block_relationship_user_ids(clerk_id)
    _local_cache_set(_BLOCK_RELATIONSHIPS_CACHE, cache_key, ids)
    return ids
