from fastapi import APIRouter, HTTPException, Query, Body
from pydantic import BaseModel
from typing import Optional, List
import psycopg
from db_config import CONNECTION_PARAMS

router = APIRouter(prefix="/posts", tags=["posts"])

class CreatePostRequest(BaseModel):
    user_id: str
    user_name: str
    user_image: Optional[str] = None
    caption: Optional[str] = None
    media_url: Optional[str] = None
    media_type: Optional[str] = None
    location_tag: Optional[str] = None

class LikePostRequest(BaseModel):
    user_id: str

@router.get("/")
def get_posts(limit: int = 20, offset: int = 0):
    try:
        with psycopg.connect(CONNECTION_PARAMS) as conn:
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
def create_post(req: CreatePostRequest):
    try:
        with psycopg.connect(CONNECTION_PARAMS) as conn:
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
def toggle_like(post_id: str, req: LikePostRequest):
    try:
        with psycopg.connect(CONNECTION_PARAMS) as conn:
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
def delete_post(post_id: str, user_id: str = Query(...)):
    try:
        with psycopg.connect(CONNECTION_PARAMS) as conn:
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
