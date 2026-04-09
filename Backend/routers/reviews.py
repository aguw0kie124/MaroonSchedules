from fastapi import APIRouter, HTTPException, Body, Depends
from pydantic import BaseModel
from auth.clerk_middleware import require_auth, ensure_matching_user
from typing import Optional, List
import uuid
from db_config import get_db_connection

router = APIRouter(prefix="/reviews", tags=["reviews"])

class ReviewCreate(BaseModel):
    user_id: str
    user_name: str
    location: str
    rating: int
    comment: Optional[str] = None

@router.get("/{location}")
def get_reviews(location: str):
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT id, user_id, user_name, location, rating, comment, created_at
                    FROM campus_reviews
                    WHERE location = %s
                    ORDER BY created_at DESC
                """, (location,))
                
                reviews = []
                for row in cur.fetchall():
                    reviews.append({
                        "id": row[0],
                        "user_id": row[1],
                        "user_name": row[2],
                        "location": row[3],
                        "rating": row[4],
                        "comment": row[5],
                        "created_at": row[6]
                    })
                return reviews
    except Exception as e:
        print(f"Error fetching reviews for {location}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/{location}/stats")
def get_review_stats(location: str):
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT 
                        AVG(rating) as average_rating,
                        COUNT(*) as total_reviews
                    FROM campus_reviews
                    WHERE location = %s
                """, (location,))
                row = cur.fetchone()
                
                return {
                    "location": location,
                    "average_rating": float(row[0]) if row[0] is not None else 0,
                    "total_reviews": int(row[1]) if row[1] is not None else 0
                }
    except Exception as e:
        print(f"Error fetching stats for {location}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/")
def create_review(review: ReviewCreate, auth_user_id: str = Depends(require_auth)):
    ensure_matching_user(auth_user_id, review.user_id, detail="Cannot create reviews on behalf of another user")
    if review.rating < 1 or review.rating > 5:
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")
        
    try:
        review_id = str(uuid.uuid4())
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO campus_reviews (id, user_id, user_name, location, rating, comment)
                    VALUES (%s, %s, %s, %s, %s, %s)
                """, (
                    review_id, review.user_id, review.user_name, 
                    review.location, review.rating, review.comment
                ))
            conn.commit()
            return {"status": "success", "review_id": review_id}
    except Exception as e:
        print(f"Error creating review: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
