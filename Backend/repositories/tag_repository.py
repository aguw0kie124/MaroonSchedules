from __future__ import annotations

import threading
from typing import Any, Dict, Iterable, List, Optional, Sequence

import psycopg

from db_config import CONNECTION_PARAMS
from services.tag_access_service import normalize_tag_list, normalize_tag_slug

# ---------------------------------------------------------------------------
# Schema init guard – run DDL exactly once per process
# ---------------------------------------------------------------------------
_tag_schema_lock = threading.Lock()
_tag_schema_initialized = False


def _ensure_tag_schema_once(conn: psycopg.Connection) -> None:
    global _tag_schema_initialized
    if _tag_schema_initialized:
        return
    with _tag_schema_lock:
        if not _tag_schema_initialized:
            _ensure_tag_schema(conn)
            _tag_schema_initialized = True


def _ensure_tag_schema(conn: psycopg.Connection) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS tags (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                slug TEXT NOT NULL UNIQUE,
                label TEXT NOT NULL,
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS user_tags (
                clerk_id TEXT NOT NULL,
                tag_id UUID NOT NULL,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                PRIMARY KEY (clerk_id, tag_id)
            )
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS event_tags (
                event_id TEXT NOT NULL,
                tag_id UUID NOT NULL,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                PRIMARY KEY (event_id, tag_id)
            )
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS club_join_requests (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                admin_clerk_id TEXT NOT NULL,
                requester_clerk_id TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                requested_at TIMESTAMPTZ DEFAULT NOW(),
                reviewed_at TIMESTAMPTZ,
                reviewed_by TEXT,
                assigned_tag_on_approval BOOLEAN NOT NULL DEFAULT TRUE,
                UNIQUE (admin_clerk_id, requester_clerk_id)
            )
            """
        )
        cur.execute(
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
            """
        )
        cur.execute("ALTER TABLE admin_applications ADD COLUMN IF NOT EXISTS clerk_id TEXT")
        cur.execute("ALTER TABLE admin_applications ADD COLUMN IF NOT EXISTS email TEXT")
        cur.execute("ALTER TABLE admin_applications ADD COLUMN IF NOT EXISTS organization_name TEXT")
        cur.execute("ALTER TABLE admin_applications ADD COLUMN IF NOT EXISTS reason TEXT")
        cur.execute("ALTER TABLE admin_applications ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending'")
        cur.execute("ALTER TABLE admin_applications ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()")
        cur.execute("ALTER TABLE admin_applications ADD COLUMN IF NOT EXISTS club_tag_id UUID")
        cur.execute(
            "ALTER TABLE admin_applications ADD COLUMN IF NOT EXISTS auto_approve_join_requests BOOLEAN DEFAULT FALSE"
        )
        cur.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS admin_applications_clerk_id_uidx ON admin_applications (clerk_id)"
        )


def _ensure_tags(cur: psycopg.Cursor, labels: Sequence[str]) -> Dict[str, str]:
    tag_ids: Dict[str, str] = {}
    for label in normalize_tag_list(labels):
        slug = normalize_tag_slug(label)
        cur.execute(
            """
            INSERT INTO tags (slug, label)
            VALUES (%s, %s)
            ON CONFLICT (slug) DO UPDATE
            SET label = EXCLUDED.label
            RETURNING id
            """,
            (slug, label),
        )
        row = cur.fetchone()
        if row:
            tag_ids[label] = str(row[0])
    return tag_ids


def _ensure_access_dependencies(conn: psycopg.Connection) -> None:
    _ensure_tag_schema_once(conn)
    from repositories import user_repository

    user_repository._ensure_user_schema_once(conn)


def _run_with_connection(callback):
    with psycopg.connect(CONNECTION_PARAMS) as conn:
        _ensure_access_dependencies(conn)
        result = callback(conn)
        conn.commit()
        return result


def get_user_tags(clerk_id: str, conn: Optional[psycopg.Connection] = None) -> List[str]:
    def _read(active_conn: psycopg.Connection) -> List[str]:
        with active_conn.cursor() as cur:
            cur.execute(
                """
                SELECT t.label
                FROM user_tags ut
                JOIN tags t ON t.id = ut.tag_id
                WHERE ut.clerk_id = %s
                ORDER BY t.label ASC
                """,
                (clerk_id,),
            )
            return [row[0] for row in cur.fetchall() or []]

    if conn is not None:
        _ensure_access_dependencies(conn)
        return _read(conn)
    return _run_with_connection(_read)


def add_user_tags(clerk_id: str, tags: Sequence[str], conn: Optional[psycopg.Connection] = None) -> List[str]:
    normalized = normalize_tag_list(tags)

    def _write(active_conn: psycopg.Connection) -> List[str]:
        with active_conn.cursor() as cur:
            tag_ids = _ensure_tags(cur, normalized)
            for label in normalized:
                tag_id = tag_ids.get(label)
                if not tag_id:
                    continue
                cur.execute(
                    """
                    INSERT INTO user_tags (clerk_id, tag_id)
                    VALUES (%s, %s)
                    ON CONFLICT (clerk_id, tag_id) DO NOTHING
                    """,
                    (clerk_id, tag_id),
                )
        return get_user_tags(clerk_id, conn=active_conn)

    if conn is not None:
        _ensure_access_dependencies(conn)
        return _write(conn)
    return _run_with_connection(_write)


def set_user_tags(clerk_id: str, tags: Sequence[str], conn: Optional[psycopg.Connection] = None) -> List[str]:
    normalized = normalize_tag_list(tags)

    def _write(active_conn: psycopg.Connection) -> List[str]:
        with active_conn.cursor() as cur:
            cur.execute("DELETE FROM user_tags WHERE clerk_id = %s", (clerk_id,))
            tag_ids = _ensure_tags(cur, normalized)
            for label in normalized:
                tag_id = tag_ids.get(label)
                if not tag_id:
                    continue
                cur.execute(
                    "INSERT INTO user_tags (clerk_id, tag_id) VALUES (%s, %s)",
                    (clerk_id, tag_id),
                )
        return normalized

    if conn is not None:
        _ensure_access_dependencies(conn)
        return _write(conn)
    return _run_with_connection(_write)


def get_event_tags(event_id: str, conn: Optional[psycopg.Connection] = None) -> List[str]:
    def _read(active_conn: psycopg.Connection) -> List[str]:
        with active_conn.cursor() as cur:
            cur.execute(
                """
                SELECT t.label
                FROM event_tags et
                JOIN tags t ON t.id = et.tag_id
                WHERE et.event_id = %s
                ORDER BY t.label ASC
                """,
                (event_id,),
            )
            return [row[0] for row in cur.fetchall() or []]

    if conn is not None:
        _ensure_access_dependencies(conn)
        return _read(conn)
    return _run_with_connection(_read)


def set_event_tags(event_id: str, tags: Sequence[str], conn: Optional[psycopg.Connection] = None) -> List[str]:
    normalized = normalize_tag_list(tags)

    def _write(active_conn: psycopg.Connection) -> List[str]:
        with active_conn.cursor() as cur:
            cur.execute("DELETE FROM event_tags WHERE event_id = %s", (event_id,))
            tag_ids = _ensure_tags(cur, normalized)
            for label in normalized:
                tag_id = tag_ids.get(label)
                if not tag_id:
                    continue
                cur.execute(
                    "INSERT INTO event_tags (event_id, tag_id) VALUES (%s, %s)",
                    (event_id, tag_id),
                )
        return normalized

    if conn is not None:
        _ensure_access_dependencies(conn)
        return _write(conn)
    return _run_with_connection(_write)


def list_tags(query: Optional[str] = None, limit: int = 50, conn: Optional[psycopg.Connection] = None) -> List[str]:
    search = f"%{query.strip()}%" if query and query.strip() else None

    def _read(active_conn: psycopg.Connection) -> List[str]:
        with active_conn.cursor() as cur:
            if search:
                cur.execute(
                    """
                    SELECT label
                    FROM tags
                    WHERE label ILIKE %s
                    ORDER BY label ASC
                    LIMIT %s
                    """,
                    (search, limit),
                )
            else:
                cur.execute(
                    """
                    SELECT label
                    FROM tags
                    ORDER BY label ASC
                    LIMIT %s
                    """,
                    (limit,),
                )
            return [row[0] for row in cur.fetchall() or []]

    if conn is not None:
        _ensure_access_dependencies(conn)
        return _read(conn)
    return _run_with_connection(_read)


def get_club_settings(admin_clerk_id: str, conn: Optional[psycopg.Connection] = None) -> Dict[str, Any]:
    def _read(active_conn: psycopg.Connection) -> Dict[str, Any]:
        with active_conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
            cur.execute(
                """
                SELECT
                    app.clerk_id,
                    app.organization_name,
                    app.email,
                    app.auto_approve_join_requests,
                    t.label AS club_tag
                FROM admin_applications app
                LEFT JOIN tags t ON t.id = app.club_tag_id
                WHERE app.clerk_id = %s
                """,
                (admin_clerk_id,),
            )
            return cur.fetchone() or {}

    if conn is not None:
        _ensure_access_dependencies(conn)
        return _read(conn)
    return _run_with_connection(_read)


def update_club_settings(
    admin_clerk_id: str,
    organization_name: str,
    email: str,
    club_tag: Optional[str],
    auto_approve_join_requests: bool,
    conn: Optional[psycopg.Connection] = None,
) -> Dict[str, Any]:
    normalized_tag = normalize_tag_list([club_tag] if club_tag else [])

    def _write(active_conn: psycopg.Connection) -> Dict[str, Any]:
        with active_conn.cursor() as cur:
            club_tag_id = None
            if normalized_tag:
                tag_ids = _ensure_tags(cur, normalized_tag)
                club_tag_id = tag_ids.get(normalized_tag[0])
            cur.execute(
                """
                INSERT INTO admin_applications (
                    clerk_id,
                    email,
                    organization_name,
                    reason,
                    status,
                    club_tag_id,
                    auto_approve_join_requests
                )
                VALUES (%s, %s, %s, '', 'approved', %s, %s)
                ON CONFLICT (clerk_id) DO UPDATE SET
                    email = EXCLUDED.email,
                    organization_name = EXCLUDED.organization_name,
                    club_tag_id = EXCLUDED.club_tag_id,
                    auto_approve_join_requests = EXCLUDED.auto_approve_join_requests
                """,
                (
                    admin_clerk_id,
                    email,
                    organization_name,
                    club_tag_id,
                    auto_approve_join_requests,
                ),
            )
        return get_club_settings(admin_clerk_id, conn=active_conn)

    if conn is not None:
        _ensure_access_dependencies(conn)
        return _write(conn)
    return _run_with_connection(_write)


def list_clubs_for_user(requester_clerk_id: str, conn: Optional[psycopg.Connection] = None) -> List[Dict[str, Any]]:
    def _read(active_conn: psycopg.Connection) -> List[Dict[str, Any]]:
        with active_conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
            cur.execute(
                """
                SELECT
                    users.clerk_id,
                    COALESCE(app.organization_name, users.full_name, 'Campus organizer') AS organization_name,
                    tags.label AS club_tag,
                    app.auto_approve_join_requests,
                    req.status AS join_status,
                    req.requested_at
                FROM users
                LEFT JOIN admin_applications app ON app.clerk_id = users.clerk_id
                LEFT JOIN tags ON tags.id = app.club_tag_id
                LEFT JOIN club_join_requests req
                    ON req.admin_clerk_id = users.clerk_id
                   AND req.requester_clerk_id = %s
                WHERE users.is_admin = TRUE
                  AND app.club_tag_id IS NOT NULL
                ORDER BY organization_name ASC
                """,
                (requester_clerk_id,),
            )
            return cur.fetchall() or []

    if conn is not None:
        _ensure_access_dependencies(conn)
        return _read(conn)
    return _run_with_connection(_read)


def create_club_join_request(
    admin_clerk_id: str,
    requester_clerk_id: str,
    conn: Optional[psycopg.Connection] = None,
) -> Dict[str, Any]:
    def _write(active_conn: psycopg.Connection) -> Dict[str, Any]:
        club_settings = get_club_settings(admin_clerk_id, conn=active_conn)
        if not club_settings or not club_settings.get("club_tag"):
            raise ValueError("This club has not configured a membership tag yet.")

        auto_approve = bool(club_settings.get("auto_approve_join_requests"))
        with active_conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
            cur.execute(
                """
                INSERT INTO club_join_requests (
                    admin_clerk_id,
                    requester_clerk_id,
                    status,
                    reviewed_at,
                    reviewed_by,
                    assigned_tag_on_approval
                )
                VALUES (
                    %s,
                    %s,
                    %s,
                    CASE WHEN %s THEN NOW() ELSE NULL END,
                    CASE WHEN %s THEN %s ELSE NULL END,
                    TRUE
                )
                ON CONFLICT (admin_clerk_id, requester_clerk_id) DO UPDATE SET
                    status = EXCLUDED.status,
                    requested_at = NOW(),
                    reviewed_at = EXCLUDED.reviewed_at,
                    reviewed_by = EXCLUDED.reviewed_by,
                    assigned_tag_on_approval = TRUE
                RETURNING id, admin_clerk_id, requester_clerk_id, status, requested_at, reviewed_at
                """,
                (
                    admin_clerk_id,
                    requester_clerk_id,
                    "approved" if auto_approve else "pending",
                    auto_approve,
                    auto_approve,
                    admin_clerk_id,
                ),
            )
            row = cur.fetchone() or {}

        if auto_approve:
            add_user_tags(requester_clerk_id, [club_settings["club_tag"]], conn=active_conn)

        return {
            **row,
            "club_tag": club_settings.get("club_tag"),
            "auto_approved": auto_approve,
        }

    if conn is not None:
        _ensure_access_dependencies(conn)
        return _write(conn)
    return _run_with_connection(_write)


def list_club_join_requests(
    admin_clerk_id: str,
    status: Optional[str] = None,
    conn: Optional[psycopg.Connection] = None,
) -> List[Dict[str, Any]]:
    def _read(active_conn: psycopg.Connection) -> List[Dict[str, Any]]:
        with active_conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
            params: list[Any] = [admin_clerk_id]
            status_clause = ""
            if status:
                status_clause = "AND req.status = %s"
                params.append(status)
            cur.execute(
                f"""
                SELECT
                    req.id,
                    req.admin_clerk_id,
                    req.requester_clerk_id,
                    req.status,
                    req.requested_at,
                    req.reviewed_at,
                    req.assigned_tag_on_approval,
                    COALESCE(users.full_name, users.email, req.requester_clerk_id) AS requester_name,
                    users.email AS requester_email,
                    tags.label AS club_tag
                FROM club_join_requests req
                LEFT JOIN users ON users.clerk_id = req.requester_clerk_id
                LEFT JOIN admin_applications app ON app.clerk_id = req.admin_clerk_id
                LEFT JOIN tags ON tags.id = app.club_tag_id
                WHERE req.admin_clerk_id = %s
                {status_clause}
                ORDER BY req.requested_at DESC
                """,
                tuple(params),
            )
            return cur.fetchall() or []

    if conn is not None:
        _ensure_access_dependencies(conn)
        return _read(conn)
    return _run_with_connection(_read)


def review_club_join_request(
    request_id: str,
    admin_clerk_id: str,
    approve: bool,
    assign_club_tag: bool = True,
    conn: Optional[psycopg.Connection] = None,
) -> Dict[str, Any]:
    def _write(active_conn: psycopg.Connection) -> Dict[str, Any]:
        club_settings = get_club_settings(admin_clerk_id, conn=active_conn)
        with active_conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
            cur.execute(
                """
                SELECT id, admin_clerk_id, requester_clerk_id
                FROM club_join_requests
                WHERE id = %s
                """,
                (request_id,),
            )
            existing = cur.fetchone()
            if not existing:
                raise ValueError("Join request not found.")
            if existing["admin_clerk_id"] != admin_clerk_id:
                raise ValueError("You can only review requests for your own club.")

            cur.execute(
                """
                UPDATE club_join_requests
                SET status = %s,
                    reviewed_at = NOW(),
                    reviewed_by = %s,
                    assigned_tag_on_approval = %s
                WHERE id = %s
                RETURNING id, admin_clerk_id, requester_clerk_id, status, requested_at, reviewed_at
                """,
                (
                    "approved" if approve else "rejected",
                    admin_clerk_id,
                    bool(assign_club_tag),
                    request_id,
                ),
            )
            updated = cur.fetchone() or {}

        if approve and assign_club_tag and club_settings.get("club_tag"):
            add_user_tags(existing["requester_clerk_id"], [club_settings["club_tag"]], conn=active_conn)

        return {
            **updated,
            "club_tag": club_settings.get("club_tag"),
        }

    if conn is not None:
        _ensure_access_dependencies(conn)
        return _write(conn)
    return _run_with_connection(_write)


def search_users(query: Optional[str] = None, limit: int = 50, conn: Optional[psycopg.Connection] = None) -> List[Dict[str, Any]]:
    search = f"%{query.strip()}%" if query and query.strip() else None

    def _read(active_conn: psycopg.Connection) -> List[Dict[str, Any]]:
        with active_conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
            if search:
                cur.execute(
                    """
                    SELECT
                        users.clerk_id,
                        users.email,
                        users.full_name,
                        users.profile_image_url,
                        users.is_admin,
                        COALESCE(
                            (
                                SELECT json_agg(t.label ORDER BY t.label)
                                FROM user_tags ut
                                JOIN tags t ON t.id = ut.tag_id
                                WHERE ut.clerk_id = users.clerk_id
                            ),
                            '[]'::json
                        ) AS tags
                    FROM users
                    WHERE users.clerk_id ILIKE %s
                       OR users.email ILIKE %s
                       OR users.full_name ILIKE %s
                    ORDER BY users.full_name NULLS LAST, users.email NULLS LAST
                    LIMIT %s
                    """,
                    (search, search, search, limit),
                )
            else:
                cur.execute(
                    """
                    SELECT
                        users.clerk_id,
                        users.email,
                        users.full_name,
                        users.profile_image_url,
                        users.is_admin,
                        COALESCE(
                            (
                                SELECT json_agg(t.label ORDER BY t.label)
                                FROM user_tags ut
                                JOIN tags t ON t.id = ut.tag_id
                                WHERE ut.clerk_id = users.clerk_id
                            ),
                            '[]'::json
                        ) AS tags
                    FROM users
                    ORDER BY users.full_name NULLS LAST, users.email NULLS LAST
                    LIMIT %s
                    """,
                    (limit,),
                )
            rows = cur.fetchall() or []
            for row in rows:
                row["tags"] = row.get("tags") or []
            return rows

    if conn is not None:
        _ensure_access_dependencies(conn)
        return _read(conn)
    return _run_with_connection(_read)
