import json
import psycopg
from db_config import CONNECTION_PARAMS, get_pool
from typing import List, Dict, Any, Optional
import uuid
from services import cache_service, encryption_service

def _safe_decrypt_json(data: Any) -> Dict[str, Any]:
    if isinstance(data, dict) and "_enc" in data:
        return encryption_service.decrypt_json(data["_enc"])
    if isinstance(data, str) and data.startswith("{"):
        # Legacy fallback
        try:
            return json.loads(data)
        except Exception:
            pass
    return data if isinstance(data, dict) else {}

def _row_to_review_dict(row) -> Dict[str, Any]:
    if not row: return {}
    return {
        "id": str(row[0]),
        "place_id": row[1],
        "user_id": row[2],
        "user_name": row[3],
        "user_image": row[4],
        "rating": row[5],
        "title": encryption_service.decrypt_string(row[6]) if row[6] else "",
        "body": encryption_service.decrypt_string(row[7]) if row[7] else "",
        "images": row[8] or [],
        "created_at": str(row[9]),
        "updated_at": str(row[10]),
        "is_anonymous": row[11]
    }

def _row_to_post_dict(row) -> Dict[str, Any]:
    if not row: return {}
    return {
        "id": str(row[0]),
        "user_id": row[1],
        "user_name": row[2],
        "user_image": row[3],
        "content": encryption_service.decrypt_string(row[4]) if row[4] else "",
        "lat": row[5],
        "lng": row[6],
        "location_tag": row[7],
        "event_id": str(row[8]) if row[8] else None,
        "images": row[9] or [],
        "is_anonymous": row[10],
        "visibility": row[11],
        "post_type": row[12],
        "custom_data": _safe_decrypt_json(row[13]),
        "created_at": str(row[14])
    }

def _row_to_interaction_dict(row) -> Dict[str, Any]:
    if not row: return {}
    return {
        "id": str(row[0]),
        "post_id": str(row[1]),
        "post_type": row[2],
        "user_id": row[3],
        "interaction_type": row[4],
        "comment_text": encryption_service.decrypt_string(row[5]) if row[5] else None,
        "created_at": str(row[6]),
        "user_name": row[7],
        "user_image": row[8]
    }

# --- Reviews ---

def add_place_review(
    place_id: str,
    user_id: str,
    rating: int,
    body: str,
    user_name: str = "Aggie",
    user_image: str = "",
    title: str = "",
    images: List[str] = None,
    is_anonymous: bool = False
) -> Dict[str, Any]:
    with get_pool().connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO place_reviews (place_id, user_id, user_name, user_image, rating, title, body, images, is_anonymous)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id, place_id, user_id, user_name, user_image, rating, title, body, images, created_at, updated_at, is_anonymous
                """,
                (place_id, user_id, user_name, user_image, rating, encryption_service.encrypt_string(title), encryption_service.encrypt_string(body), images or [], is_anonymous)
            )
            row = cur.fetchone()
        conn.commit()
    return _row_to_review_dict(row)

def get_place_reviews(place_id: str, limit: int = 50, exclude_user_ids: List[str] = None) -> List[Dict[str, Any]]:
    with get_pool().connection() as conn:
        with conn.cursor() as cur:
            sql = """
                SELECT r.id, r.place_id, r.user_id, 
                       COALESCE(u.full_name, r.user_name, 'Aggie User') as user_name, 
                       COALESCE(u.profile_image_url, r.user_image, '') as user_image, 
                       r.rating, r.title, r.body, r.images, r.created_at, r.updated_at, r.is_anonymous
                FROM place_reviews r
                LEFT JOIN users u ON r.user_id = u.clerk_id
                WHERE r.place_id = %s
            """
            params = [place_id]
            if exclude_user_ids:
                sql += " AND r.user_id != ALL(%s)"
                params.append(exclude_user_ids)
            
            sql += " ORDER BY r.created_at DESC LIMIT %s"
            params.append(limit)
            
            cur.execute(sql, tuple(params))
            rows = cur.fetchall()
    return [_row_to_review_dict(r) for r in rows]

# --- Crowdping Posts ---

def add_crowdping_post(
    user_id: str,
    content: str,
    post_type: str = 'post',
    user_name: str = "Aggie",
    user_image: str = "",
    lat: float = None,
    lng: float = None,
    location_tag: str = "",
    event_id: str = None,
    images: List[str] = None,
    is_anonymous: bool = False,
    visibility: str = 'public',
    custom_data: Dict[str, Any] = None
) -> Dict[str, Any]:
    with get_pool().connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO crowdping_posts 
                (user_id, user_name, user_image, content, lat, lng, location_tag, event_id, images, is_anonymous, visibility, post_type, custom_data)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb)
                RETURNING id, user_id, user_name, user_image, content, lat, lng, location_tag, event_id, images, is_anonymous, visibility, post_type, custom_data, created_at
                """,
                (user_id, user_name, user_image, encryption_service.encrypt_string(content), lat, lng, location_tag, event_id, images or [], is_anonymous, visibility, post_type, json.dumps({"_enc": encryption_service.encrypt_json(custom_data or {})}))
            )
            row = cur.fetchone()
        conn.commit()
    return _row_to_post_dict(row)

def get_crowdping_feed(post_types: List[str] = None, limit: int = 40, exclude_user_ids: List[str] = None) -> List[Dict[str, Any]]:
    with get_pool().connection() as conn:
        with conn.cursor() as cur:
            sql = """
                SELECT p.id, p.user_id, 
                       COALESCE(u.full_name, p.user_name, 'Aggie User') as user_name, 
                       COALESCE(u.profile_image_url, p.user_image, '') as user_image, 
                       p.content, p.lat, p.lng, p.location_tag, p.event_id, p.images, p.is_anonymous, p.visibility, p.post_type, p.custom_data, p.created_at
                FROM crowdping_posts p
                LEFT JOIN users u ON p.user_id = u.clerk_id
                WHERE 1=1
            """
            params = []
            if post_types:
                sql += " AND p.post_type = ANY(%s)"
                params.append(post_types)
            
            if exclude_user_ids:
                sql += " AND p.user_id != ALL(%s)"
                params.append(exclude_user_ids)
                
            sql += " ORDER BY p.created_at DESC LIMIT %s"
            params.append(limit)
            
            cur.execute(sql, tuple(params))
            rows = cur.fetchall()
    return [_row_to_post_dict(r) for r in rows]

# --- Interactions ---

def add_post_interaction(
    post_id: str,
    post_type: str,
    user_id: str,
    interaction_type: str,
    comment_text: str = None,
    user_name: str = "Aggie",
    user_image: str = ""
) -> Dict[str, Any]:
    with get_pool().connection() as conn:
        with conn.cursor() as cur:
            # Mutual exclusivity for upvote/downvote
            if interaction_type in ['upvote', 'downvote']:
                opposite = 'downvote' if interaction_type == 'upvote' else 'upvote'
                
                # 1. Remove opposite reaction if it exists
                cur.execute(
                    "DELETE FROM post_interactions WHERE post_id = %s AND user_id = %s AND type = %s",
                    (post_id, user_id, opposite)
                )
                
                # 2. Toggle same reaction if it exists
                cur.execute(
                    "SELECT id FROM post_interactions WHERE post_id = %s AND user_id = %s AND type = %s",
                    (post_id, user_id, interaction_type)
                )
                existing = cur.fetchone()
                if existing:
                    cur.execute("DELETE FROM post_interactions WHERE id = %s", (existing[0],))
                    conn.commit()
                    return {"status": "removed", "type": interaction_type}

            # Original idempotent toggle for likes (optional, but keep for compatibility)
            elif interaction_type == 'like':
                cur.execute(
                    "SELECT id FROM post_interactions WHERE post_id = %s AND user_id = %s AND type = 'like'",
                    (post_id, user_id)
                )
                existing = cur.fetchone()
                if existing:
                    cur.execute("DELETE FROM post_interactions WHERE id = %s", (existing[0],))
                    conn.commit()
                    return {"status": "unliked", "id": str(existing[0])}

            cur.execute(
                """
                INSERT INTO post_interactions (post_id, post_type, user_id, type, comment_text, user_name, user_image)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING id, post_id, post_type, user_id, type, comment_text, created_at, user_name, user_image
                """,
                (post_id, post_type, user_id, interaction_type, encryption_service.encrypt_string(comment_text) if comment_text else None, user_name, user_image)
            )
            row = cur.fetchone()
        conn.commit()
    
    # Invalidate interaction cache for this post
    cache_service.delete(f"post:interactions:{post_id}")
    return _row_to_interaction_dict(row)

def get_post_interactions(post_id: str, post_type: str, interaction_type: str = None) -> List[Dict[str, Any]]:
    with get_pool().connection() as conn:
        with conn.cursor() as cur:
            if interaction_type:
                cur.execute(
                    """
                    SELECT i.id, i.post_id, i.post_type, i.user_id, i.type, i.comment_text, i.created_at, 
                           COALESCE(u.full_name, i.user_name, 'Aggie User') as user_name, 
                           COALESCE(u.profile_image_url, i.user_image, '') as user_image
                    FROM post_interactions i
                    LEFT JOIN users u ON i.user_id = u.clerk_id
                    WHERE i.post_id = %s AND i.post_type = %s AND i.type = %s
                    ORDER BY i.created_at DESC
                    """,
                    (post_id, post_type, interaction_type)
                )
            else:
                cur.execute(
                    """
                    SELECT i.id, i.post_id, i.post_type, i.user_id, i.type, i.comment_text, i.created_at, 
                           COALESCE(u.full_name, i.user_name, 'Aggie User') as user_name, 
                           COALESCE(u.profile_image_url, i.user_image, '') as user_image
                    FROM post_interactions i
                    LEFT JOIN users u ON i.user_id = u.clerk_id
                    WHERE i.post_id = %s AND i.post_type = %s
                    ORDER BY i.created_at DESC
                    """,
                    (post_id, post_type)
                )
            rows = cur.fetchall()
    return [_row_to_interaction_dict(r) for r in rows]

def get_interaction_counts(post_id: str, post_type: str) -> Dict[str, int]:
    with get_pool().connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT type, count(*) 
                FROM post_interactions 
                WHERE post_id = %s AND post_type = %s
                GROUP BY type
                """,
                (post_id, post_type)
            )
            rows = cur.fetchall()
    counts = {"like": 0, "comment": 0}
    for row in rows:
        counts[row[0]] = row[1]
    return counts

def get_batch_interaction_counts(post_ids: List[str]) -> Dict[str, Dict[str, Any]]:
    """Get interaction counts and scores for a list of post IDs with Redis caching."""
    if not post_ids:
        return {}
    
    final_counts = {}
    missing_ids = []
    
    # 1. Try to get from Cache first
    for pid in post_ids:
        cached = cache_service.get_json(f"post:interactions:{pid}")
        if cached:
            final_counts[pid] = cached
        else:
            missing_ids.append(pid)
            
    if not missing_ids:
        return final_counts
        
    # 2. Fetch missing from Postgres
    batch_counts = {pid: {"like": 0, "comment": 0, "upvote": 0, "downvote": 0, "score": 0} for pid in missing_ids}
    try:
        with get_pool().connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT post_id, type, count(*) 
                    FROM post_interactions 
                    WHERE post_id = ANY(%s)
                    GROUP BY post_id, type
                    """,
                    (missing_ids,)
                )
                rows = cur.fetchall()
                for row in rows:
                    pid, itype, count = str(row[0]), row[1], int(row[2])
                    if pid in batch_counts:
                        batch_counts[pid][itype] = count

                # Post-process scores and Cache each result
                for pid in batch_counts:
                    batch_counts[pid]["score"] = batch_counts[pid]["upvote"] - batch_counts[pid]["downvote"]
                    # Cache individual post results (30 min TTL for high-traffic metadata)
                    cache_service.set_json(f"post:interactions:{pid}", batch_counts[pid], ttl_seconds=1800)
                    final_counts[pid] = batch_counts[pid]
                    
    except Exception as e:
        print(f"Error in get_batch_interaction_counts: {e}")
        # Ensure we return at least the initialized map if DB fails
        for pid in missing_ids:
            if pid not in final_counts:
                final_counts[pid] = {"like": 0, "comment": 0, "upvote": 0, "downvote": 0, "score": 0}
        
    return final_counts
# --- Compliance (Blocking & Reporting) ---

def add_block(blocker_id: str, blocked_id: str) -> bool:
    """Creates a one-way block in the database."""
    with get_pool().connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO blocked_users (blocker_id, blocked_id) VALUES (%s, %s) ON CONFLICT DO NOTHING",
                (blocker_id, blocked_id)
            )
        conn.commit()
    return True

def remove_block(blocker_id: str, blocked_id: str) -> bool:
    """Removes a one-way block."""
    with get_pool().connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM blocked_users WHERE blocker_id = %s AND blocked_id = %s",
                (blocker_id, blocked_id)
            )
            deleted = cur.rowcount > 0
        conn.commit()
    return deleted

def get_blocked_user_ids(user_id: str) -> List[str]:
    """Returns a list of clerk_ids that the user has explicitly blocked."""
    with get_pool().connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT blocked_id FROM blocked_users WHERE blocker_id = %s", (user_id,))
            rows = cur.fetchall()
    return [r[0] for r in rows]

def add_content_report(
    reporter_id: str,
    reportee_id: str,
    post_type: str,
    post_id: str,
    reason: str,
    comment: str = None,
    place_id: str = None
) -> str:
    """Inserts a new report into content_reports."""
    with get_pool().connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO content_reports 
                (reporter_clerk_id, reportee_clerk_id, post_type, post_id, reason, comment, place_id)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING id
                """,
                (reporter_id, reportee_id, post_type, post_id, reason, comment, place_id)
            )
            report_id = cur.fetchone()[0]
        conn.commit()
    return str(report_id)

def delete_user_data_cascade(clerk_id: str) -> bool:
    """Permanently deletes all data related to a user (cascade)."""
    with get_pool().connection() as conn:
        with conn.cursor() as cur:
            # Delete from users (will cascade to dining_profiles, campus_connector_snapshots, etc. if ON DELETE CASCADE set)
            # We explicitly handle some social tables just in case
            cur.execute("DELETE FROM place_reviews WHERE user_id = %s", (clerk_id,))
            cur.execute("DELETE FROM crowdping_posts WHERE user_id = %s", (clerk_id,))
            cur.execute("DELETE FROM post_interactions WHERE user_id = %s", (clerk_id,))
            cur.execute("DELETE FROM blocked_users WHERE blocker_id = %s OR blocked_id = %s", (clerk_id, clerk_id))
            cur.execute("DELETE FROM content_reports WHERE reporter_clerk_id = %s OR reportee_clerk_id = %s", (clerk_id, clerk_id))
            cur.execute("DELETE FROM users WHERE clerk_id = %s", (clerk_id,))
        conn.commit()
    return True

def delete_place_review(review_id: str, user_id: str) -> bool:
    with get_pool().connection() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM place_reviews WHERE id = %s AND user_id = %s RETURNING id", (review_id, user_id))
            deleted = cur.fetchone()
        conn.commit()
    return bool(deleted)

def delete_crowdping_post(post_id: str, user_id: str) -> bool:
    with get_pool().connection() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM crowdping_posts WHERE id = %s AND user_id = %s RETURNING id", (post_id, user_id))
            deleted = cur.fetchone()
        conn.commit()
    return bool(deleted)
