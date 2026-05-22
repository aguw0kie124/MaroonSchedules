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
        "username",
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
        "bio",
        "website",
        "expo_push_token",
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
            tour_completed BOOLEAN DEFAULT FALSE,
            bio TEXT,
            website TEXT
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
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS website TEXT",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS expo_push_token TEXT",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT",
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

def upsert_user(clerk_id: str, email: str = None, full_name: str = None, profile_image_url: str = None, username: str = None) -> dict:
    """Insert a new user row or update email/full_name/username if the clerk_id already exists."""
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
    if "username" in columns:
        insert_columns.append("username")
        insert_values.append(username or None)
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
    if "username" in columns:
        update_fields.append("username = COALESCE(EXCLUDED.username, users.username)")
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
        "profile_image_url", "full_name",
        "bio", "website",
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
                SELECT requester_id, recipient_id, status
                FROM network_connections
                WHERE
                    (requester_id = %s AND recipient_id = %s)
                    OR
                    (requester_id = %s AND recipient_id = %s)
                """,
                (requester_id, friend_id, friend_id, requester_id),
            )
            existing_rows = cur.fetchall() or []
            accepted_row = next((row for row in existing_rows if row.get("status") == "accepted"), None)
            if accepted_row:
                row = dict(accepted_row)
                row["action"] = "already_connected"
                return row

            reverse_pending = next(
                (
                    row
                    for row in existing_rows
                    if row.get("status") == "pending"
                    and row.get("requester_id") == friend_id
                    and row.get("recipient_id") == requester_id
                ),
                None,
            )

            if reverse_pending:
                cur.execute(
                    """
                    DELETE FROM network_connections
                    WHERE
                        (requester_id = %s AND recipient_id = %s)
                        OR
                        (requester_id = %s AND recipient_id = %s)
                    """,
                    (requester_id, friend_id, friend_id, requester_id),
                )
                cur.execute(
                    """
                    INSERT INTO network_connections (requester_id, recipient_id, status, updated_at)
                    VALUES (%s, %s, 'accepted', NOW())
                    RETURNING requester_id, recipient_id, status, updated_at
                    """,
                    (requester_id, friend_id),
                )
                row = dict(cur.fetchone() or {})
                row["action"] = "accepted"
                conn.commit()
                return row

            same_direction_pending = next(
                (
                    row
                    for row in existing_rows
                    if row.get("status") == "pending"
                    and row.get("requester_id") == requester_id
                    and row.get("recipient_id") == friend_id
                ),
                None,
            )
            if same_direction_pending:
                row = dict(same_direction_pending)
                row["action"] = "request_pending"
                return row

            cur.execute(
                """
                INSERT INTO network_connections (requester_id, recipient_id, status, updated_at)
                VALUES (%s, %s, 'pending', NOW())
                ON CONFLICT (requester_id, recipient_id)
                DO UPDATE SET status = 'pending', updated_at = NOW()
                RETURNING requester_id, recipient_id, status, updated_at
                """,
                (requester_id, friend_id),
            )
            row = dict(cur.fetchone() or {})
        conn.commit()
    row["action"] = "requested"
    return row


def remove_friend(user_id: str, friend_id: str) -> bool:
    if not user_id or not friend_id:
        return False

    with get_pool().connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                DELETE FROM network_connections
                WHERE (
                    (requester_id = %s AND recipient_id = %s)
                    OR (requester_id = %s AND recipient_id = %s)
                  )
                """,
                (user_id, friend_id, friend_id, user_id),
            )
            deleted = cur.rowcount > 0
        conn.commit()
    return deleted


def get_connection_relationship(clerk_id: str, other_id: str) -> str:
    if not clerk_id or not other_id:
        return "none"
    if clerk_id == other_id:
        return "self"
    return get_connection_relationships(clerk_id).get(other_id, "none")


def get_connection_relationships(clerk_id: str) -> dict[str, str]:
    if not clerk_id:
        return {}

    with get_pool().connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                SELECT requester_id, recipient_id, status
                FROM network_connections
                WHERE requester_id = %s OR recipient_id = %s
                ORDER BY updated_at DESC
                """,
                (clerk_id, clerk_id),
            )
            rows = cur.fetchall() or []

    relationships: dict[str, str] = {}
    for row in rows:
        requester_id = row.get("requester_id")
        recipient_id = row.get("recipient_id")
        if not requester_id or not recipient_id:
            continue

        other_id = recipient_id if requester_id == clerk_id else requester_id
        if not other_id:
            continue

        status = row.get("status") or "pending"
        if status == "accepted":
            relationships[other_id] = "accepted"
            continue
        if other_id in relationships and relationships[other_id] == "accepted":
            continue
        relationships[other_id] = "outgoing_pending" if requester_id == clerk_id else "incoming_pending"

    return relationships


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
        username = profile.get("username") or ""
        full_name = profile.get("full_name") or ""
        friends.append(
            {
                "id": profile["clerk_id"],
                "full_name": full_name or None,
                "username": username or None,
                "name": full_name or username or "Aggie User",
                "profile_image_url": profile.get("profile_image_url"),
                "major": profile.get("major"),
                "graduation_year": profile.get("graduation_year"),
                "relationship_status": "accepted",
            }
        )
    return friends


def list_friend_requests(clerk_id: str) -> dict[str, list[dict]]:
    if not clerk_id:
        return {"incoming": [], "outgoing": []}

    with get_pool().connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                SELECT requester_id, recipient_id, updated_at
                FROM network_connections
                WHERE status = 'pending'
                  AND (requester_id = %s OR recipient_id = %s)
                ORDER BY updated_at DESC
                """,
                (clerk_id, clerk_id),
            )
            rows = cur.fetchall() or []

    incoming: list[dict] = []
    outgoing: list[dict] = []

    for row in rows:
        requester_id = row.get("requester_id")
        recipient_id = row.get("recipient_id")
        if not requester_id or not recipient_id:
            continue

        other_id = requester_id if recipient_id == clerk_id else recipient_id
        profile = get_user(other_id)
        if not profile:
            continue

        username = profile.get("username") or ""
        full_name = profile.get("full_name") or ""
        payload = {
            "id": profile["clerk_id"],
            "full_name": full_name or None,
            "username": username or None,
            "name": full_name or username or "Aggie User",
            "profile_image_url": profile.get("profile_image_url"),
            "major": profile.get("major"),
            "graduation_year": profile.get("graduation_year"),
            "requested_at": str(row.get("updated_at")) if row.get("updated_at") else None,
            "relationship_status": "incoming_pending" if recipient_id == clerk_id else "outgoing_pending",
        }

        if recipient_id == clerk_id:
            incoming.append(payload)
        else:
            outgoing.append(payload)

    return {
        "incoming": incoming,
        "outgoing": outgoing,
    }


def get_mutual_friend_counts(searcher_id: str, candidate_ids: list[str]) -> dict[str, int]:
    """Return how many accepted friends searcher shares with each candidate."""
    if not searcher_id or not candidate_ids:
        return {}

    unique_candidates = list({cid for cid in candidate_ids if cid and cid != searcher_id})
    if not unique_candidates:
        return {}

    with get_pool().connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                WITH searcher_friends AS (
                    SELECT CASE
                        WHEN requester_id = %s THEN recipient_id
                        ELSE requester_id
                    END AS friend_id
                    FROM network_connections
                    WHERE status = 'accepted'
                      AND (requester_id = %s OR recipient_id = %s)
                ),
                candidate_edges AS (
                    SELECT
                        CASE
                            WHEN nc.requester_id = ANY(%s) THEN nc.requester_id
                            ELSE nc.recipient_id
                        END AS candidate_id,
                        CASE
                            WHEN nc.requester_id = ANY(%s) THEN nc.recipient_id
                            ELSE nc.requester_id
                        END AS friend_id
                    FROM network_connections nc
                    WHERE nc.status = 'accepted'
                      AND (nc.requester_id = ANY(%s) OR nc.recipient_id = ANY(%s))
                )
                SELECT ce.candidate_id, COUNT(DISTINCT ce.friend_id)::int AS mutual_count
                FROM candidate_edges ce
                INNER JOIN searcher_friends sf ON ce.friend_id = sf.friend_id
                WHERE ce.candidate_id = ANY(%s)
                  AND ce.friend_id <> ce.candidate_id
                  AND ce.friend_id <> %s
                GROUP BY ce.candidate_id
                """,
                (
                    searcher_id,
                    searcher_id,
                    searcher_id,
                    unique_candidates,
                    unique_candidates,
                    unique_candidates,
                    unique_candidates,
                    unique_candidates,
                    searcher_id,
                ),
            )
            rows = cur.fetchall() or []

    return {row["candidate_id"]: int(row.get("mutual_count") or 0) for row in rows if row.get("candidate_id")}


def list_mutual_friends(searcher_id: str, target_id: str, limit: int = 50) -> list[dict]:
    """Return user profiles for the friends shared between searcher and target."""
    if not searcher_id or not target_id or searcher_id == target_id:
        return []

    blocked_ids: set[str] = set()
    try:
        from repositories import feed_repository

        blocked_ids = set(feed_repository.get_block_relationship_user_ids(searcher_id))
    except Exception:
        blocked_ids = set()

    with get_pool().connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                WITH searcher_friends AS (
                    SELECT CASE
                        WHEN requester_id = %s THEN recipient_id
                        ELSE requester_id
                    END AS friend_id
                    FROM network_connections
                    WHERE status = 'accepted'
                      AND (requester_id = %s OR recipient_id = %s)
                ),
                target_friends AS (
                    SELECT CASE
                        WHEN requester_id = %s THEN recipient_id
                        ELSE requester_id
                    END AS friend_id
                    FROM network_connections
                    WHERE status = 'accepted'
                      AND (requester_id = %s OR recipient_id = %s)
                )
                SELECT u.clerk_id, u.full_name, u.username, u.profile_image_url
                FROM searcher_friends sf
                INNER JOIN target_friends tf ON sf.friend_id = tf.friend_id
                INNER JOIN users u ON u.clerk_id = sf.friend_id
                WHERE sf.friend_id NOT IN (%s, %s)
                LIMIT %s
                """,
                (
                    searcher_id,
                    searcher_id,
                    searcher_id,
                    target_id,
                    target_id,
                    target_id,
                    searcher_id,
                    target_id,
                    limit,
                ),
            )
            rows = cur.fetchall() or []

    results: list[dict] = []
    for row in rows:
        clerk_id = row.get("clerk_id")
        if not clerk_id or clerk_id in blocked_ids:
            continue
        full_name = _safe_decrypt(row.get("full_name")) or ""
        username = row.get("username") or ""
        display_name = full_name or username or "Aggie User"
        results.append(
            {
                "id": clerk_id,
                "full_name": full_name or None,
                "username": username or None,
                "name": display_name,
                "profile_image_url": row.get("profile_image_url"),
            }
        )

    results.sort(key=lambda r: (r.get("full_name") or r.get("name") or "").lower())
    return results


def search_users(searcher_id: str, query: str, limit: int = 30) -> list[dict]:
    """Search users by name/email/major. Returns all users when query is empty
    so the UI can show suggestions immediately (Instagram-style autofill)."""
    normalized_query = (query or "").strip().lower()
    # NOTE: we intentionally do NOT return early on empty query — empty query
    # returns all users (filtered by blocked list) for autofill UX.

    blocked_ids: set[str] = set()
    try:
        from repositories import feed_repository

        blocked_ids = set(feed_repository.get_block_relationship_user_ids(searcher_id))
    except Exception:
        blocked_ids = set()

    relationships = get_connection_relationships(searcher_id)

    # Fetch all non-self users; limit raised so small deployments see everyone.
    # Encrypted full_name/email are filtered in Python after decryption.
    with get_pool().connection() as conn:
        _ensure_user_schema_once(conn)
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                SELECT clerk_id, full_name, email, username, profile_image_url, major, graduation_year, updated_at
                FROM users
                WHERE clerk_id <> %s
                ORDER BY updated_at DESC NULLS LAST
                LIMIT 1000
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
        raw_email = _safe_decrypt(row.get("email")) or ""
        # Use only the local-part of the email (before @) for display-safe matching
        email_local = raw_email.split("@")[0] if "@" in raw_email else raw_email
        username = row.get("username") or ""
        major = row.get("major") or ""
        # Also include the last 8 chars of clerk_id so dev/test accounts are findable
        clerk_tail = clerk_id[-8:] if len(clerk_id) >= 8 else clerk_id

        # When no query, include everyone; otherwise filter by haystack
        if normalized_query:
            haystack = " ".join([full_name, username, email_local, raw_email, major, clerk_tail]).lower()
            if normalized_query not in haystack:
                continue

        display_name = full_name or username or email_local or "Aggie User"
        results.append(
            {
                "id": clerk_id,
                "full_name": full_name or None,
                "username": username or None,
                "name": display_name,
                "profile_image_url": row.get("profile_image_url"),
                "major": major or None,
                "graduation_year": row.get("graduation_year") or None,
                "relationship_status": relationships.get(clerk_id, "none"),
                "is_friend": relationships.get(clerk_id) == "accepted",
                "request_sent": relationships.get(clerk_id) == "outgoing_pending",
                "request_received": relationships.get(clerk_id) == "incoming_pending",
            }
        )
        if len(results) >= limit:
            break

    if results:
        mutual_counts = get_mutual_friend_counts(searcher_id, [r["id"] for r in results])
        for entry in results:
            entry["mutual_count"] = mutual_counts.get(entry["id"], 0)

        results.sort(
            key=lambda r: (
                -(r.get("mutual_count") or 0),
                r.get("full_name") or r.get("name") or "",
            ),
        )

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
            "bio": row.get("bio"),
            "website": row.get("website"),
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
        "bio": row[24] if len(row) > 24 else None,
        "website": row[25] if len(row) > 25 else None,
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


def save_push_token(clerk_id: str, token: str | None) -> None:
    """Store (or clear) the Expo push token for a user so the backend can deliver
    background notifications when the app is not running."""
    columns = _user_columns()
    if "expo_push_token" not in columns:
        return
    update_clause = "expo_push_token = %s"
    if "updated_at" in columns:
        update_clause += ", updated_at = NOW()"
    with get_pool().connection() as conn:
        _ensure_user_schema_once(conn)
        with conn.cursor() as cur:
            cur.execute(
                f"UPDATE users SET {update_clause} WHERE clerk_id = %s",
                (token, clerk_id),
            )
        conn.commit()


def get_push_tokens_for_users(clerk_ids: list[str]) -> dict[str, str]:
    """Return a mapping of clerk_id -> expo_push_token for the provided IDs.
    Only entries that have a non-null token are included."""
    if not clerk_ids:
        return {}
    columns = _user_columns()
    if "expo_push_token" not in columns:
        return {}
    with get_pool().connection() as conn:
        _ensure_user_schema_once(conn)
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT clerk_id, expo_push_token
                FROM users
                WHERE clerk_id = ANY(%s)
                  AND expo_push_token IS NOT NULL
                  AND expo_push_token <> ''
                """,
                (clerk_ids,),
            )
            rows = cur.fetchall() or []
    return {row[0]: row[1] for row in rows if row[0] and row[1]}

