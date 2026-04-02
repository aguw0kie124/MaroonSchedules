"""
PostgreSQL-backed repository for user data (profile + schedules).
"""
import json
import psycopg
from db_config import CONNECTION_PARAMS


# ---------------------------------------------------------------------------
# User CRUD
# ---------------------------------------------------------------------------

def upsert_user(clerk_id: str, email: str = None, full_name: str = None, profile_image_url: str = None) -> dict:
    """Insert a new user row or update email/full_name if the clerk_id already exists."""
    with psycopg.connect(CONNECTION_PARAMS) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO users (clerk_id, email, full_name, profile_image_url)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (clerk_id) DO UPDATE
                    SET email             = COALESCE(EXCLUDED.email, users.email),
                        full_name         = COALESCE(EXCLUDED.full_name, users.full_name),
                        profile_image_url = COALESCE(EXCLUDED.profile_image_url, users.profile_image_url),
                        updated_at        = NOW()
                RETURNING id, clerk_id, email, full_name, profile_image_url, major, graduation_year, preferred_time, max_credits, avoid_friday, show_online_first, schedules, created_at, updated_at, canvas_access_token, canvas_refresh_token, canvas_expires_at, canvas_instance_url, tos_accepted, tour_completed
                """,
                (clerk_id, email, full_name, profile_image_url),
            )
            row = cur.fetchone()
        conn.commit()
    return _row_to_dict(row)


def get_user(clerk_id: str) -> dict | None:
    """Return full user record by Clerk ID, or None."""
    with psycopg.connect(CONNECTION_PARAMS) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, clerk_id, email, full_name, profile_image_url, major, graduation_year, preferred_time, max_credits, avoid_friday, show_online_first, schedules, created_at, updated_at, canvas_access_token, canvas_refresh_token, canvas_expires_at, canvas_instance_url, tos_accepted, tour_completed
                FROM users WHERE clerk_id = %s
                """,
                (clerk_id,),
            )
            row = cur.fetchone()
    if not row:
        return None
    return _row_to_dict(row)


def update_profile(clerk_id: str, fields: dict) -> dict | None:
    """Update only the profile-preference columns for a user."""
    allowed = {
        "major", "graduation_year", "preferred_time",
        "max_credits", "avoid_friday", "show_online_first",
        "profile_image_url",
    }
    updates = {k: v for k, v in fields.items() if k in allowed}
    if not updates:
        return get_user(clerk_id)

    set_clause = ", ".join(f"{col} = %s" for col in updates)
    values = list(updates.values()) + [clerk_id]

    with psycopg.connect(CONNECTION_PARAMS) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                UPDATE users SET {set_clause}, updated_at = NOW()
                WHERE clerk_id = %s
                RETURNING id, clerk_id, email, full_name, profile_image_url, major, graduation_year,
                          preferred_time, max_credits, avoid_friday, show_online_first,
                          schedules, created_at, updated_at,
                          canvas_access_token, canvas_refresh_token,
                          canvas_expires_at, canvas_instance_url, tos_accepted, tour_completed
                """,
                values,
            )
            row = cur.fetchone()
        conn.commit()
    if not row:
        return None
    return _row_to_dict(row)


# ---------------------------------------------------------------------------
# Schedule helpers (operate on the JSONB 'schedules' column)
# ---------------------------------------------------------------------------

def get_schedules(clerk_id: str) -> list:
    """Return the schedules JSONB array for a user."""
    with psycopg.connect(CONNECTION_PARAMS) as conn:
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
    with psycopg.connect(CONNECTION_PARAMS) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO users (clerk_id, schedules)
                VALUES (%s, %s::jsonb)
                ON CONFLICT (clerk_id) DO UPDATE
                    SET schedules = EXCLUDED.schedules, updated_at = NOW()
                """,
                (clerk_id, json.dumps(schedules)),
            )
        conn.commit()


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _row_to_dict(row) -> dict:
    """Map a SELECT row tuple to a dict."""
    if not row:
        return {}
    schedules = row[11]
    if isinstance(schedules, str):
        schedules = json.loads(schedules)
    return {
        "id": row[0],
        "clerk_id": row[1],
        "email": row[2],
        "full_name": row[3],
        "profile_image_url": row[4],
        "major": row[5],
        "graduation_year": row[6],
        "preferred_time": row[7],
        "max_credits": row[8],
        "avoid_friday": row[9],
        "show_online_first": row[10],
        "schedules": schedules or [],
        "created_at": str(row[12]) if row[12] else None,
        "updated_at": str(row[13]) if row[13] else None,
        "canvas_access_token": row[14],
        "canvas_refresh_token": row[15],
        "canvas_expires_at": str(row[16]) if row[16] else None,
        "canvas_instance_url": row[17],
        "tos_accepted": row[18],
        "tour_completed": row[19],
    }


def save_canvas_tokens(clerk_id: str, access_token: str, refresh_token: str, expires_at, instance_url: str = 'https://canvas.tamu.edu') -> None:
    """Save Canvas OAuth tokens for a user."""
    with psycopg.connect(CONNECTION_PARAMS) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE users
                SET canvas_access_token = %s, canvas_refresh_token = %s, canvas_expires_at = %s, canvas_instance_url = %s, updated_at = NOW()
                WHERE clerk_id = %s
                """,
                (access_token, refresh_token, expires_at, instance_url, clerk_id),
            )
        conn.commit()


def set_tour_completed(clerk_id: str) -> None:
    """Mark that the user has completed the interactive tour."""
    with psycopg.connect(CONNECTION_PARAMS) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE users SET tour_completed = TRUE, updated_at = NOW() WHERE clerk_id = %s",
                (clerk_id,),
            )
        conn.commit()


def set_tos_accepted(clerk_id: str) -> None:
    """Mark that the user has accepted the Terms of Service."""
    with psycopg.connect(CONNECTION_PARAMS) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE users SET tos_accepted = TRUE, updated_at = NOW() WHERE clerk_id = %s",
                (clerk_id,),
            )
        conn.commit()
