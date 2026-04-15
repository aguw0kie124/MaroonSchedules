from fastapi import APIRouter, HTTPException, Query, Depends, Request
from pydantic import BaseModel, Field
from typing import Optional
import psycopg
from db_config import CONNECTION_PARAMS, get_pool
from auth.clerk_middleware import require_auth, ensure_matching_user
from models.base import SanitizedBaseModel

from rate_limit import limiter

router = APIRouter(prefix="/posts", tags=["posts"])

class PostCreateRequest(SanitizedBaseModel):
    user_id: str
    text: str
    image_url: str = ""
    is_reel: bool = False
    user_name: str = Field(..., min_length=1, max_length=120)
    user_image: Optional[str] = None
    caption: Optional[str] = Field(default=None, max_length=2000)
    media_url: Optional[str] = None
    media_type: Optional[str] = Field(default=None, max_length=40)
    location_tag: Optional[str] = Field(default=None, max_length=120)

class LikePostRequest(BaseModel):
    user_id: str

@router.get("/")
@limiter.limit("60/minute")
def get_posts(request: Request, limit: int = 20, offset: int = 0):
    try:
        with get_pool().connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT 
                        id, user_id, user_name, user_image, caption, 
                        media_url, media_type, location_tag, likes, liked_by, created_at
                    FROM campus_posts
                    ORDER BY created_at DESC
                    LIMIT %s OFFSET %s
                """, (limit, offset))
                
                posts = []
                for row in cur.fetchall():
                    posts.append({
                        "id": str(row[0]),
                        "user_id": row[1],
                        "user_name": row[2],
                        "user_image": row[3],
                        "caption": row[4],
                        "media_url": row[5],
                        "media_type": row[6],
                        "location_tag": row[7],
                        "likes": row[8],
                        "liked_by": row[9] or [],
                        "created_at": row[10].isoformat() if row[10] else None
                    })
                return posts
    except Exception as e:
        print(f"Error fetching posts: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/")
@limiter.limit("10/minute")
def create_post(request: Request, req: PostCreateRequest, auth_user_id: str = Depends(require_auth)):
    ensure_matching_user(auth_user_id, req.user_id, detail="You can only create posts as yourself")
    try:
        with get_pool().connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO campus_posts 
                    (user_id, user_name, user_image, caption, media_url, media_type, location_tag)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    RETURNING id
                """, (
                    req.user_id, req.user_name, req.user_image, req.caption, 
                    req.media_url, req.media_type, req.location_tag
                ))
                post_id = cur.fetchone()[0]
                conn.commit()
                return {"status": "success", "post_id": str(post_id)}
    except Exception as e:
        print(f"Error creating post: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/{post_id}/like")
@limiter.limit("20/minute")
def toggle_like(request: Request, post_id: str, req: LikePostRequest, auth_user_id: str = Depends(require_auth)):
    ensure_matching_user(auth_user_id, req.user_id, detail="You can only like posts as yourself")
    try:
        with get_pool().connection() as conn:
            with conn.cursor() as cur:
                # First check if user already liked it
                cur.execute("SELECT liked_by FROM campus_posts WHERE id = %s", (post_id,))
                result = cur.fetchone()
                if not result:
                    raise HTTPException(status_code=404, detail="Post not found")
                
                liked_by = set(result[0] or [])
                is_liked = req.user_id in liked_by
                
                if is_liked:
                    # Unlike
                    cur.execute("""
                        UPDATE campus_posts 
                        SET likes = likes - 1, liked_by = array_remove(liked_by, %s)
                        WHERE id = %s
                        RETURNING likes, liked_by
                    """, (req.user_id, post_id))
                else:
                    # Like
                    cur.execute("""
                        UPDATE campus_posts 
                        SET likes = likes + 1, liked_by = array_append(liked_by, %s)
                        WHERE id = %s
                        RETURNING likes, liked_by
                    """, (req.user_id, post_id))
                
                new_data = cur.fetchone()
                conn.commit()
                return {
                    "status": "success", 
                    "liked": not is_liked,
                    "likes": new_data[0],
                    "liked_by": new_data[1]
                }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error toggling like: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.delete("/{post_id}")
def delete_post(post_id: str, user_id: str = Query(...), auth_user_id: str = Depends(require_auth)):
    ensure_matching_user(auth_user_id, user_id, detail="You can only delete your own posts")
    try:
        with get_pool().connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    DELETE FROM campus_posts 
                    WHERE id = %s AND user_id = %s
                    RETURNING id
                """, (post_id, user_id))
                deleted = cur.fetchone()
                if not deleted:
                    raise HTTPException(status_code=404, detail="Post not found or unauthorized")
                conn.commit()
                return {"status": "success"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting post: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


# ─── Reels ──────────────────────────────────────────────────────────────────────

class CreateReelRequest(BaseModel):
    user_id: str
    user_name: str = Field(..., min_length=1, max_length=120)
    user_image: Optional[str] = None
    caption: Optional[str] = Field(default=None, max_length=2000)
    video_url: str = Field(..., min_length=1, max_length=2048)

@router.get("/reels")
def get_reels(limit: int = 30, offset: int = 0):
    try:
        with get_pool().connection() as conn:
            with conn.cursor() as cur:
                # Create table if not exists
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS campus_reels (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        user_id TEXT NOT NULL,
                        user_name TEXT NOT NULL,
                        user_image TEXT,
                        caption TEXT,
                        video_url TEXT NOT NULL,
                        likes INTEGER DEFAULT 0,
                        liked_by TEXT[] DEFAULT '{}',
                        created_at TIMESTAMPTZ DEFAULT NOW()
                    )
                """)
                conn.commit()

                cur.execute("""
                    SELECT id, user_id, user_name, user_image, caption,
                           video_url, likes, liked_by, created_at
                    FROM campus_reels
                    ORDER BY created_at DESC
                    LIMIT %s OFFSET %s
                """, (limit, offset))

                reels = []
                for row in cur.fetchall():
                    reels.append({
                        "id": str(row[0]),
                        "user_id": row[1],
                        "user_name": row[2],
                        "user_image": row[3],
                        "caption": row[4],
                        "video_url": row[5],
                        "likes": row[6],
                        "liked_by": row[7] or [],
                        "created_at": row[8].isoformat() if row[8] else None
                    })
                return reels
    except Exception as e:
        print(f"Error fetching reels: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/reels")
@limiter.limit("10/minute")
def create_reel(request: Request, req: CreateReelRequest, auth_user_id: str = Depends(require_auth)):
    ensure_matching_user(auth_user_id, req.user_id, detail="You can only create reels as yourself")
    try:
        with get_pool().connection() as conn:
            with conn.cursor() as cur:
                # Ensure table exists
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS campus_reels (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        user_id TEXT NOT NULL,
                        user_name TEXT NOT NULL,
                        user_image TEXT,
                        caption TEXT,
                        video_url TEXT NOT NULL,
                        likes INTEGER DEFAULT 0,
                        liked_by TEXT[] DEFAULT '{}',
                        created_at TIMESTAMPTZ DEFAULT NOW()
                    )
                """)
                cur.execute("""
                    INSERT INTO campus_reels
                    (user_id, user_name, user_image, caption, video_url)
                    VALUES (%s, %s, %s, %s, %s)
                    RETURNING id
                """, (req.user_id, req.user_name, req.user_image, req.caption, req.video_url))
                reel_id = cur.fetchone()[0]
                conn.commit()
                return {"status": "success", "reel_id": str(reel_id)}
    except Exception as e:
        print(f"Error creating reel: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
