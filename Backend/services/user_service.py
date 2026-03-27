"""
Business-logic layer for user operations (profile + schedules).
"""
import uuid
from typing import List, Optional
from repositories import user_repository


# ---------------------------------------------------------------------------
# Auth / sync
# ---------------------------------------------------------------------------

def sync_user(clerk_id: str, email: str = None, full_name: str = None, profile_image_url: str = None) -> dict:
    """Called on every sign-in to ensure the user exists in the DB."""
    return user_repository.upsert_user(clerk_id, email, full_name, profile_image_url)


# ---------------------------------------------------------------------------
# Profile
# ---------------------------------------------------------------------------

def get_profile(clerk_id: str) -> dict | None:
    return user_repository.get_user(clerk_id)


def update_profile(clerk_id: str, fields: dict) -> dict | None:
    return user_repository.update_profile(clerk_id, fields)

def save_canvas_tokens(clerk_id: str, access_token: str, refresh_token: str, expires_at, instance_url: str = 'https://canvas.tamu.edu') -> None:
    return user_repository.save_canvas_tokens(clerk_id, access_token, refresh_token, expires_at, instance_url)

# ---------------------------------------------------------------------------
# Schedules  (stored as JSONB array inside the users table)
# ---------------------------------------------------------------------------

def get_schedules(clerk_id: str) -> list:
    return user_repository.get_schedules(clerk_id)


def create_schedule(clerk_id: str, name: str, term_code: str) -> dict:
    if not name or not term_code:
        raise ValueError("Name and term code are required to create a schedule.")
    schedules = user_repository.get_schedules(clerk_id)
    new_schedule = {
        "schedule_id": str(uuid.uuid4()),
        "user_id": clerk_id,
        "name": name,
        "term_code": term_code,
        "section_ids": [],
    }
    schedules.append(new_schedule)
    user_repository.save_schedules(clerk_id, schedules)
    return new_schedule


def delete_schedule(clerk_id: str, schedule_id: str) -> bool:
    schedules = user_repository.get_schedules(clerk_id)
    new_schedules = [s for s in schedules if s.get("schedule_id") != schedule_id]
    if len(new_schedules) == len(schedules):
        return False  # not found
    user_repository.save_schedules(clerk_id, new_schedules)
    return True


def add_section(clerk_id: str, schedule_id: str, section_id: str) -> dict:
    schedules = user_repository.get_schedules(clerk_id)
    target = None
    for s in schedules:
        if s.get("schedule_id") == schedule_id:
            target = s
            break
    if target is None:
        raise ValueError("Schedule not found.")
    if section_id not in target.get("section_ids", []):
        target.setdefault("section_ids", []).append(section_id)
        user_repository.save_schedules(clerk_id, schedules)
    return target


def remove_section(clerk_id: str, schedule_id: str, section_id: str) -> dict:
    schedules = user_repository.get_schedules(clerk_id)
    target = None
    for s in schedules:
        if s.get("schedule_id") == schedule_id:
            target = s
            break
    if target is None:
        raise ValueError("Schedule not found.")
    if section_id in target.get("section_ids", []):
        target["section_ids"].remove(section_id)
        user_repository.save_schedules(clerk_id, schedules)
    return target
