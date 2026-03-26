from fastapi import APIRouter, Depends, HTTPException
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from stream_chat import StreamChat
import os
from dotenv import load_dotenv

# Force reload from the exact .env file, overriding any shell-level sticky env vars
env_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(dotenv_path=env_path, override=True)

router = APIRouter(prefix="/chat", tags=["chat"])

STREAM_API_KEY = os.environ.get("STREAM_API_KEY", "")
STREAM_API_SECRET = os.environ.get("STREAM_API_SECRET", "")

class ChatTokenRequest(BaseModel):
    clerk_user_id: str
    other_clerk_user_ids: list[str] | None = None

class ChatTokenResponse(BaseModel):
    stream_user_id: str
    stream_user_token: str
    stream_api_key: str

@router.post("/token", response_model=ChatTokenResponse)
async def get_chat_token(body: ChatTokenRequest):
    # In a real app we'd verify the JWT first
    # For this POC, we trust the body payload
    
    # Use Clerk ID directly — it's already unique and starts with 'user_'
    stream_user_id = body.clerk_user_id

    # Read fresh env each request (supports hot-reload)
    api_key = os.environ.get("STREAM_API_KEY", "")
    api_secret = os.environ.get("STREAM_API_SECRET", "")
    chat_client = StreamChat(api_key=api_key, api_secret=api_secret)

    try:
        # Upsert provided users so Stream knows about them before channel creation
        users_to_upsert = [{"id": stream_user_id}]
        if body.other_clerk_user_ids is not None:
            for other_id in body.other_clerk_user_ids:
                if other_id:
                    users_to_upsert.append({"id": other_id})
        
        chat_client.upsert_users(users_to_upsert)

        # Create a user token for this user
        token = chat_client.create_token(user_id=stream_user_id)

        return ChatTokenResponse(
            stream_user_id=stream_user_id,
            stream_user_token=token,
            stream_api_key=api_key,
        )
    except Exception as e:
        print(f"Stream API Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


import requests as http_requests

@router.get("/users")
async def list_users(exclude_id: str = ""):
    """Returns all Clerk users for messaging. Pass exclude_id to hide the current user."""
    clerk_secret = os.environ.get("CLERK_SECRET_KEY", "")
    if not clerk_secret:
        raise HTTPException(status_code=500, detail="CLERK_SECRET_KEY not configured")

    try:
        resp = http_requests.get(
            "https://api.clerk.com/v1/users?limit=50",
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


# ─── Stream Feeds V3 Token ─────────────────────────────────────────────────────

class FeedsTokenRequest(BaseModel):
    clerk_user_id: str
    name: Optional[str] = None
    image: Optional[str] = None

class FeedsTokenResponse(BaseModel):
    stream_user_id: str
    stream_user_token: str
    stream_api_key: str

@router.post("/feeds/token", response_model=FeedsTokenResponse)
async def get_feeds_token(body: FeedsTokenRequest):
    """Generate a Stream token for Feeds V3 (using dedicated Feeds credentials)."""
    stream_user_id = body.clerk_user_id
    api_key = os.environ.get("STREAM_FEEDS_API_KEY", "")
    api_secret = os.environ.get("STREAM_FEEDS_API_SECRET", "")
    
    if not api_key or not api_secret:
        raise HTTPException(status_code=500, detail="Feeds API keys not configured")
        
    chat_client = StreamChat(api_key=api_key, api_secret=api_secret)

    try:
        user_data = {"id": stream_user_id}
        if body.name: user_data["name"] = body.name
        if body.image: user_data["image"] = body.image
        
        chat_client.upsert_users([user_data])
        token = chat_client.create_token(user_id=stream_user_id)
        return FeedsTokenResponse(
            stream_user_id=stream_user_id,
            stream_user_token=token,
            stream_api_key=api_key,
        )
    except Exception as e:
        print(f"Stream Feeds Token Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

import stream
from typing import Dict, Any

class FeedActivity(BaseModel):
    activity: Dict[str, Any]

class ReactionPayload(BaseModel):
    kind: str
    activity_id: str
    user_id: str
    data: Dict[str, Any] | None = None

@router.get("/feeds/proxy/{feed_group}/{feed_id}")
async def proxy_get_feed(feed_group: str, feed_id: str, limit: int = 25):
    api_key = os.environ.get("STREAM_FEEDS_API_KEY", "")
    api_secret = os.environ.get("STREAM_FEEDS_API_SECRET", "")
    if not api_key or not api_secret:
         raise HTTPException(status_code=500, detail="Feeds API keys not configured")
    
    server_client = stream.connect(api_key, api_secret)
    feed = server_client.feed(feed_group, feed_id)
    try:
        response = feed.get(limit=limit, enrich=True, reactions={"recent": True, "counts": True})
        return response
    except Exception as e:
        # Log to file for developer but return empty results to UI
        with open("stream_errors.log", "a") as f:
            f.write(f"[Proxy GET Fallback] {feed_group}:{feed_id} -> {e}\n")
        return {"results": [], "next": "", "duration": "0ms"}

@router.post("/feeds/proxy/{feed_group}/{feed_id}")
async def proxy_add_activity(feed_group: str, feed_id: str, body: FeedActivity):
    api_key = os.environ.get("STREAM_FEEDS_API_KEY", "")
    api_secret = os.environ.get("STREAM_FEEDS_API_SECRET", "")
    server_client = stream.connect(api_key, api_secret)
    feed = server_client.feed(feed_group, feed_id)
    try:
        print(f"[Stream Proxy] Adding activity to {feed_group}:{feed_id}: {body.activity.get('verb')}")
        response = feed.add_activity(body.activity)
        print(f"[Stream Proxy] Add SUCCESS: {response.get('id')}")
        return response
    except Exception as e:
        print(f"Stream Proxy Add Error: {e}")
        # Log more detail if it's an API conflict or validation error
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/feeds/proxy/{feed_group}/{feed_id}/{activity_id}")
async def proxy_delete_activity(feed_group: str, feed_id: str, activity_id: str):
    api_key = os.environ.get("STREAM_FEEDS_API_KEY", "")
    api_secret = os.environ.get("STREAM_FEEDS_API_SECRET", "")
    server_client = stream.connect(api_key, api_secret)
    feed = server_client.feed(feed_group, feed_id)
    try:
        response = feed.remove_activity(activity_id)
        return response
    except Exception as e:
        print(f"Stream Proxy Delete Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/feeds/proxy/{feed_group}/{feed_id}/{activity_id}")
async def proxy_update_activity(feed_group: str, feed_id: str, activity_id: str, body: FeedActivity):
    api_key = os.environ.get("STREAM_FEEDS_API_KEY", "")
    api_secret = os.environ.get("STREAM_FEEDS_API_SECRET", "")
    server_client = stream.connect(api_key, api_secret)
    try:
        activities = server_client.get_activities(ids=[activity_id])
        if not activities or "results" not in activities or not activities["results"]:
             raise HTTPException(status_code=404, detail="Activity not found")
        
        act = activities["results"][0]
        if "text" in body.activity:
            act["text"] = body.activity["text"]
            
        response = server_client.update_activities([act])
        return response
    except Exception as e:
        print(f"Stream Proxy Update Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/feeds/proxy/reactions")
async def proxy_add_reaction(body: ReactionPayload):
    api_key = os.environ.get("STREAM_FEEDS_API_KEY", "")
    api_secret = os.environ.get("STREAM_FEEDS_API_SECRET", "")
    server_client = stream.connect(api_key, api_secret)
    try:
        # Proactively sync user metadata to Stream's global store if provided in data
        try:
            if body.data and ("name" in body.data or "image" in body.data):
                user_data = {"id": body.user_id}
                if "name" in body.data: user_data["name"] = body.data["name"]
                if "image" in body.data: user_data["image"] = body.data["image"]
                chat_client.upsert_users([user_data])
        except Exception as ue:
            print(f"[Stream Proxy] User sync warning (non-fatal): {ue}")
            
        print(f"[Stream Proxy] Adding reaction {body.kind} to {body.activity_id} for user {body.user_id}")
        response = server_client.reactions.add(
            body.kind, 
            body.activity_id, 
            user_id=body.user_id,
            data=body.data
        )
        print(f"[Stream Proxy] Reaction {body.kind} SUCCESS: {response.get('id')}")
        return response
    except Exception as e:
        print(f"Stream Proxy Reaction Error: {e}")
        # Return the actual error message so the frontend can display it
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/feeds/proxy/reactions/{activity_id}/{kind}")
async def proxy_get_reactions(activity_id: str, kind: str):
    api_key = os.environ.get("STREAM_FEEDS_API_KEY", "")
    api_secret = os.environ.get("STREAM_FEEDS_API_SECRET", "")
    server_client = stream.connect(api_key, api_secret)
    try:
        # Use default sort (newest first for comments usually)
        response = server_client.reactions.filter(activity_id=activity_id, kind=kind, enrich=True)
        return response
    except Exception as e:
        print(f"Stream Proxy GetReactions Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

