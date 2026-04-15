"""
PostgreSQL-backed repository for user data (profile + schedules).
"""
import json
import threading
from functools import lru_cache
import psycopg
from psycopg.rows import dict_row
from db_config import CONNECTION_PARAMS, get_pool
from typing import Any, Dict, Optional, Tuple, Union
from services import encryption_service

# ---------------------------------------------------------------------------
# Schema init guard – run DDL exactly once per process to avoid table-level
# lock contention when concurrent requests arrive at startup.
# ---------------------------------------------------------------------------
_schema_lock = threading.Lock()
_schema_initialized = False


def _ensure_user_schema_once(conn: psycopg.Connection) -> None:
    """Call _ensure_user_schema only the first time, protected by a lock."""
    global _schema_initialized
    if _schema_initialized:
        return
    with _schema_lock:
        if not _schema_initialized:  # double-checked locking
            _ensure_user_schema(conn)
            _schema_initialized = True

# ---------------------------------------------------------------------------
# User CRUD
# ---------------------------------------------------------------------------

def _safe_decrypt(value: Optional[str]) -> Optional[str]:
    """Decrypt if it's an encrypted payload, otherwise return as is."""
    if not value or not isinstance(value, str):
        return value
    # encryption_service.decrypt_string handling already has some safety, 
    # but we force it here to be explicit about expected payloads.
    return encryption_service.decrypt_string(value)

def _execute_optional_ddl(conn: psycopg.Connection, sql: str) -> None:
    try:
        with conn.transaction():
            with conn.cursor() as cur:
                cur.execute(sql)
    except psycopg.errors.InsufficientPrivilege:
        # Some deployments connect with a role that can read/write rows but cannot
        # alter pre-existing tables. We skip opportunistic schema upgrades there.
        return


@lru_cache(maxsize=8)
def _get_table_columns(table_name: str) -> Tuple[str, ...]:
    with get_pool().connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT column_name
                FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = %s
                ORDER BY ordinal_position
                """,
                (table_name,),
            )
            return tuple(row[0] for row in cur.fetchall())


def _user_columns() -> set[str]:
    return set(_get_table_columns("users"))


def _user_select_clause() -> str:
    desired_columns = [
        "id",
        "clerk_id",
        "email",
        "full_name",
        "profile_image_url",
        "major",
        "graduation_year",
        "preferred_time",
        "preferred_event_categories",
        "preferred_social_mode",
        "event_preferences_completed",
        "max_credits",
        "avoid_friday",
        "show_online_first",
        "schedules",
        "created_at",
        "updated_at",
        "canvas_access_token",
        "canvas_refresh_token",
        "canvas_expires_at",
        "canvas_instance_url",
        "tos_accepted",
        "tour_completed",
        "is_admin",
    ]
    existing = _user_columns()
    return ", ".join(column for column in desired_columns if column in existing)

def _ensure_user_schema(conn: psycopg.Connection) -> None:
    statements = [
        """
        CREATE TABLE IF NOT EXISTS users (
            id BIGSERIAL PRIMARY KEY,
            clerk_id TEXT NOT NULL UNIQUE,
            email TEXT,
            full_name TEXT,
            profile_image_url TEXT,
            major TEXT,
            graduation_year TEXT,
            preferred_time TEXT,
            preferred_event_categories JSONB DEFAULT '[]'::jsonb,
            preferred_social_mode TEXT,
            event_preferences_completed BOOLEAN DEFAULT FALSE,
            max_credits TEXT,
            avoid_friday BOOLEAN DEFAULT FALSE,
            show_online_first BOOLEAN DEFAULT FALSE,
            schedules JSONB DEFAULT '[]'::jsonb,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            canvas_access_token TEXT,
            canvas_refresh_token TEXT,
            canvas_expires_at TIMESTAMPTZ,
            canvas_instance_url TEXT DEFAULT 'https://canvas.tamu.edu',
            tos_accepted BOOLEAN DEFAULT FALSE,
            tour_completed BOOLEAN DEFAULT FALSE
        )
        """,
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name TEXT",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_image_url TEXT",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS major TEXT",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS graduation_year TEXT",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_time TEXT",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_event_categories JSONB DEFAULT '[]'::jsonb",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_social_mode TEXT",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS event_preferences_completed BOOLEAN DEFAULT FALSE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS max_credits TEXT",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS avoid_friday BOOLEAN DEFAULT FALSE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS show_online_first BOOLEAN DEFAULT FALSE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS schedules JSONB DEFAULT '[]'::jsonb",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS canvas_access_token TEXT",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS canvas_refresh_token TEXT",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS canvas_expires_at TIMESTAMPTZ",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS canvas_instance_url TEXT DEFAULT 'https://canvas.tamu.edu'",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS tos_accepted BOOLEAN DEFAULT FALSE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS tour_completed BOOLEAN DEFAULT FALSE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE",
        """
        CREATE TABLE IF NOT EXISTS admin_applications (
            id BIGSERIAL PRIMARY KEY,
            clerk_id TEXT NOT NULL,
            email TEXT NOT NULL,
            organization_name TEXT,
            reason TEXT,
            status TEXT DEFAULT 'pending',
            created_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(clerk_id)
        )
        """,
        "ALTER TABLE admin_applications ADD COLUMN IF NOT EXISTS clerk_id TEXT",
        "ALTER TABLE admin_applications ADD COLUMN IF NOT EXISTS email TEXT",
        "ALTER TABLE admin_applications ADD COLUMN IF NOT EXISTS organization_name TEXT",
        "ALTER TABLE admin_applications ADD COLUMN IF NOT EXISTS reason TEXT",
        "ALTER TABLE admin_applications ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending'",
        "ALTER TABLE admin_applications ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()",
        "CREATE UNIQUE INDEX IF NOT EXISTS admin_applications_clerk_id_uidx ON admin_applications (clerk_id)",
        """
        CREATE TABLE IF NOT EXISTS admin_events (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            clerk_id TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            lat DOUBLE PRECISION,
            lng DOUBLE PRECISION,
            location_name TEXT,
            start_time TIMESTAMPTZ NOT NULL,
            end_time TIMESTAMPTZ,
            shares_count INTEGER DEFAULT 0,
            google_review_url TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
        """,
        "ALTER TABLE admin_events ADD COLUMN IF NOT EXISTS google_review_url TEXT",
        """
        CREATE TABLE IF NOT EXISTS admin_event_reviews (
            id BIGSERIAL PRIMARY KEY,
            event_id UUID REFERENCES admin_events(id) ON DELETE CASCADE,
            clerk_id TEXT NOT NULL,
            rating INTEGER NOT NULL,
            feedback TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(event_id, clerk_id)
        )
        """,
    ]
    for statement in statements:
        _execute_optional_ddl(conn, statement)

def upsert_user(clerk_id: str, email: str = None, full_name: str = None, profile_image_url: str = None) -> dict:
    """Insert a new user row or update email/full_name if the clerk_id already exists."""
    tour_completed_default = True if email and email.endswith("@gmail.com") else False
    columns = _user_columns()
    insert_columns = ["clerk_id"]
    insert_values = [clerk_id]
    if "email" in columns:
        insert_columns.append("email")
        insert_values.append(encryption_service.encrypt_string(email) if email else None)
    if "full_name" in columns:
        insert_columns.append("full_name")
        insert_values.append(encryption_service.encrypt_string(full_name) if full_name else None)
    if "profile_image_url" in columns:
        insert_columns.append("profile_image_url")
        insert_values.append(profile_image_url)
    if "tour_completed" in columns:
        insert_columns.append("tour_completed")
        insert_values.append(tour_completed_default)

    update_fields = []
    if "email" in columns:
        update_fields.append("email = COALESCE(EXCLUDED.email, users.email)")
    if "full_name" in columns:
        update_fields.append("full_name = COALESCE(EXCLUDED.full_name, users.full_name)")
    if "profile_image_url" in columns:
        update_fields.append("profile_image_url = COALESCE(EXCLUDED.profile_image_url, users.profile_image_url)")
    if "updated_at" in columns:
        update_fields.append("updated_at = NOW()")

    select_clause = _user_select_clause()
    placeholders = ", ".join(["%s"] * len(insert_columns))
    with get_pool().connection() as conn:
        _ensure_user_schema_once(conn)
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                f"""
                INSERT INTO users ({", ".join(insert_columns)})
                VALUES ({placeholders})
                ON CONFLICT (clerk_id) DO UPDATE
                    SET {", ".join(update_fields) if update_fields else "clerk_id = users.clerk_id"}
                RETURNING {select_clause}
                """,
                tuple(insert_values),
            )
            row = cur.fetchone()
        conn.commit()
    result = _row_to_dict(row)
    from repositories import tag_repository

    result["tags"] = tag_repository.get_user_tags(clerk_id)
    return result


def get_user(clerk_id: str) -> Optional[dict]:
    """Return full user record by Clerk ID, or None."""
    select_clause = _user_select_clause()
    with get_pool().connection() as conn:
        _ensure_user_schema_once(conn)
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                f"""
                SELECT {select_clause}
                FROM users WHERE clerk_id = %s
                """,
                (clerk_id,),
            )
            row = cur.fetchone()
    if not row:
        return None
    result = _row_to_dict(row)
    from repositories import tag_repository

    result["tags"] = tag_repository.get_user_tags(clerk_id)
    return result


def update_profile(clerk_id: str, fields: dict) -> Optional[dict]:
    """Update only the profile-preference columns for a user."""
    allowed = {
        "major", "graduation_year", "preferred_time",
        "preferred_event_categories", "preferred_social_mode", "event_preferences_completed",
        "max_credits", "avoid_friday", "show_online_first",
        "profile_image_url",
    }
    existing = _user_columns()
    updates = {}
    for k, v in fields.items():
        if k in allowed and k in existing:
            if k in ["email", "full_name"] and v:
                updates[k] = encryption_service.encrypt_string(v)
            else:
                updates[k] = v
                
    if not updates:
        return get_user(clerk_id)

    set_clause = ", ".join(f"{col} = %s" for col in updates)
    values = list(updates.values()) + [clerk_id]
    if "updated_at" in existing:
        set_clause = f"{set_clause}, updated_at = NOW()"
    select_clause = _user_select_clause()

    with get_pool().connection() as conn:
        _ensure_user_schema_once(conn)
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                f"""
                UPDATE users SET {set_clause}
                WHERE clerk_id = %s
                RETURNING {select_clause}
                """,
                values,
            )
            row = cur.fetchone()
        conn.commit()
    if not row:
        return None
    result = _row_to_dict(row)
    from repositories import tag_repository

    result["tags"] = tag_repository.get_user_tags(clerk_id)
    return result


# ---------------------------------------------------------------------------
# Schedule helpers (operate on the JSONB 'schedules' column)
# ---------------------------------------------------------------------------

def get_schedules(clerk_id: str) -> list:
    """Return the schedules JSONB array for a user."""
    if "schedules" not in _user_columns():
        return []
    with get_pool().connection() as conn:
        _ensure_user_schema_once(conn)
        with conn.cursor() as cur:
            cur.execute("SELECT schedules FROM users WHERE clerk_id = %s", (clerk_id,))
            row = cur.fetchone()
    if not row:
        return []
    schedules = row[0]
    if isinstance(schedules, str):
        schedules = json.loads(schedules)
    return schedules or []


def save_schedules(clerk_id: str, schedules: list) -> None:
    """Overwrite the schedules JSONB column for a user (creates row if missing)."""
    columns = _user_columns()
    if "schedules" not in columns:
        return
    with get_pool().connection() as conn:
        _ensure_user_schema_once(conn)
        with conn.cursor() as cur:
            insert_columns = ["clerk_id", "schedules"]
            values = [clerk_id, json.dumps(schedules)]
            if "updated_at" in columns:
                update_set = "schedules = EXCLUDED.schedules, updated_at = NOW()"
            else:
                update_set = "schedules = EXCLUDED.schedules"
            cur.execute(
                f"""
                INSERT INTO users ({", ".join(insert_columns)})
                VALUES (%s, %s::jsonb)
                ON CONFLICT (clerk_id) DO UPDATE
                    SET {update_set}
                """,
                tuple(values),
            )
        conn.commit()


def add_friend(requester_id: str, friend_id: str) -> Dict[str, Any]:
    if not requester_id or not friend_id:
        return {"status": "error", "message": "Missing user id"}
    if requester_id == friend_id:
        return {"status": "error", "message": "Cannot friend yourself"}

    with get_pool().connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                INSERT INTO network_connections (requester_id, recipient_id, status, updated_at)
                VALUES (%s, %s, 'accepted', NOW())
                ON CONFLICT (requester_id, recipient_id)
                DO UPDATE SET status = 'accepted', updated_at = NOW()
                RETURNING requester_id, recipient_id, status, updated_at
                """,
                (requester_id, friend_id),
            )
            row = cur.fetchone()
        conn.commit()
    return dict(row or {})


def remove_friend(user_id: str, friend_id: str) -> bool:
    if not user_id or not friend_id:
        return False

    with get_pool().connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                DELETE FROM network_connections
                WHERE status = 'accepted'
                  AND (
                    (requester_id = %s AND recipient_id = %s)
                    OR (requester_id = %s AND recipient_id = %s)
                  )
                """,
                (user_id, friend_id, friend_id, user_id),
            )
            deleted = cur.rowcount > 0
        conn.commit()
    return deleted


def list_friends(clerk_id: str) -> list[dict]:
    if not clerk_id:
        return []

    with get_pool().connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                SELECT
                    CASE
                        WHEN requester_id = %s THEN recipient_id
                        ELSE requester_id
                    END AS friend_id
                FROM network_connections
                WHERE status = 'accepted'
                  AND (requester_id = %s OR recipient_id = %s)
                ORDER BY updated_at DESC
                """,
                (clerk_id, clerk_id, clerk_id),
            )
            rows = cur.fetchall() or []

    friends: list[dict] = []
    seen_ids: set[str] = set()
    for row in rows:
        friend_id = row.get("friend_id")
        if not friend_id or friend_id in seen_ids:
            continue
        seen_ids.add(friend_id)
        profile = get_user(friend_id)
        if not profile:
            continue
        friends.append(
            {
                "id": profile["clerk_id"],
                "name": profile.get("full_name") or profile.get("email") or "Aggie User",
                "profile_image_url": profile.get("profile_image_url"),
                "major": profile.get("major"),
                "graduation_year": profile.get("graduation_year"),
            }
        )
    return friends


def search_users(searcher_id: str, query: str, limit: int = 10) -> list[dict]:
    normalized_query = (query or "").strip().lower()
    if not normalized_query:
        return []

    blocked_ids: set[str] = set()
    try:
        from repositories import feed_repository

        blocked_ids = set(feed_repository.get_block_relationship_user_ids(searcher_id))
    except Exception:
        blocked_ids = set()

    friends = {friend["id"] for friend in list_friends(searcher_id)}

    with get_pool().connection() as conn:
        _ensure_user_schema_once(conn)
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                SELECT clerk_id, full_name, email, profile_image_url, major, graduation_year, updated_at
                FROM users
                WHERE clerk_id <> %s
                ORDER BY updated_at DESC NULLS LAST
                LIMIT 500
                """,
                (searcher_id,),
            )
            rows = cur.fetchall() or []

    results: list[dict] = []
    for row in rows:
        clerk_id = row.get("clerk_id")
        if not clerk_id or clerk_id in blocked_ids:
            continue

        full_name = _safe_decrypt(row.get("full_name")) or ""
        email = _safe_decrypt(row.get("email")) or ""
        major = row.get("major") or ""
        haystack = " ".join([full_name, email, major]).lower()
        if normalized_query not in haystack:
            continue

        results.append(
            {
                "id": clerk_id,
                "name": full_name or email or "Aggie User",
                "profile_image_url": row.get("profile_image_url"),
                "major": major or None,
                "graduation_year": row.get("graduation_year") or None,
                "is_friend": clerk_id in friends,
            }
        )
        if len(results) >= limit:
            break

    return results


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _row_to_dict(row) -> dict:
    """Map a SELECT row to a dict."""
    if not row:
        return {}
    if isinstance(row, dict):
        schedules = row.get("schedules")
        if isinstance(schedules, str):
            schedules = json.loads(schedules)
        return {
            "id": row.get("id"),
            "clerk_id": row.get("clerk_id"),
            "email": _safe_decrypt(row.get("email")),
            "full_name": _safe_decrypt(row.get("full_name")),
            "profile_image_url": row.get("profile_image_url"),
            "major": row.get("major"),
            "graduation_year": row.get("graduation_year"),
            "preferred_time": row.get("preferred_time"),
            "preferred_event_categories": row.get("preferred_event_categories") or [],
            "preferred_social_mode": row.get("preferred_social_mode"),
            "event_preferences_completed": row.get("event_preferences_completed", False),
            "max_credits": row.get("max_credits"),
            "avoid_friday": row.get("avoid_friday", False),
            "show_online_first": row.get("show_online_first", False),
            "schedules": schedules or [],
            "created_at": str(row.get("created_at")) if row.get("created_at") else None,
            "updated_at": str(row.get("updated_at")) if row.get("updated_at") else None,
            "canvas_access_token": _safe_decrypt(row.get("canvas_access_token")),
            "canvas_refresh_token": _safe_decrypt(row.get("canvas_refresh_token")),
            "canvas_expires_at": str(row.get("canvas_expires_at")) if row.get("canvas_expires_at") else None,
            "canvas_instance_url": row.get("canvas_instance_url"),
            "tos_accepted": row.get("tos_accepted", False),
            "tour_completed": row.get("tour_completed", False),
            "is_admin": row.get("is_admin", False),
            "tags": [],
        }

    schedules = row[14]
    if isinstance(schedules, str):
        schedules = json.loads(schedules)
    return {
        "id": row[0],
        "clerk_id": row[1],
        "email": _safe_decrypt(row[2]),
        "full_name": _safe_decrypt(row[3]),
        "profile_image_url": row[4],
        "major": row[5],
        "graduation_year": row[6],
        "preferred_time": row[7],
        "preferred_event_categories": row[8] or [],
        "preferred_social_mode": row[9],
        "event_preferences_completed": row[10] or False,
        "max_credits": row[11],
        "avoid_friday": row[12],
        "show_online_first": row[13],
        "schedules": schedules or [],
        "created_at": str(row[15]) if row[15] else None,
        "updated_at": str(row[16]) if row[16] else None,
        "canvas_access_token": _safe_decrypt(row[17]),
        "canvas_refresh_token": _safe_decrypt(row[18]),
        "canvas_expires_at": str(row[19]) if row[19] else None,
        "canvas_instance_url": row[20],
        "tos_accepted": row[21],
        "tour_completed": row[22],
        "is_admin": row[23] if len(row) > 23 else False,
        "tags": [],
    }


def save_canvas_tokens(clerk_id: str, access_token: str, refresh_token: str, expires_at, instance_url: str = 'https://canvas.tamu.edu') -> None:
    """Save Canvas OAuth tokens for a user."""
    columns = _user_columns()
    required = {"canvas_access_token", "canvas_refresh_token", "canvas_expires_at", "canvas_instance_url"}
    if not required.issubset(columns):
        return
    with get_pool().connection() as conn:
        _ensure_user_schema_once(conn)
        with conn.cursor() as cur:
            update_clause = "canvas_access_token = %s, canvas_refresh_token = %s, canvas_expires_at = %s, canvas_instance_url = %s"
            if "updated_at" in columns:
                update_clause += ", updated_at = NOW()"
            cur.execute(
                f"""
                UPDATE users
                SET {update_clause}
                WHERE clerk_id = %s
                """,
                (
                    encryption_service.encrypt_string(access_token),
                    encryption_service.encrypt_string(refresh_token),
                    expires_at,
                    instance_url,
                    clerk_id,
                ),
            )
        conn.commit()


def set_tour_completed(clerk_id: str) -> None:
    """Mark that the user has completed the interactive tour."""
    columns = _user_columns()
    if "tour_completed" not in columns:
        return
    with get_pool().connection() as conn:
        _ensure_user_schema_once(conn)
        with conn.cursor() as cur:
            update_clause = "tour_completed = TRUE"
            if "updated_at" in columns:
                update_clause += ", updated_at = NOW()"
            cur.execute(
                f"UPDATE users SET {update_clause} WHERE clerk_id = %s",
                (clerk_id,),
            )
        conn.commit()


def set_tos_accepted(clerk_id: str) -> None:
    """Mark that the user has accepted the Terms of Service."""
    columns = _user_columns()
    if "tos_accepted" not in columns:
        return
    with get_pool().connection() as conn:
        _ensure_user_schema_once(conn)
        with conn.cursor() as cur:
            update_clause = "tos_accepted = TRUE"
            if "updated_at" in columns:
                update_clause += ", updated_at = NOW()"
            cur.execute(
                f"UPDATE users SET {update_clause} WHERE clerk_id = %s",
                (clerk_id,),
            )
        conn.commit()
