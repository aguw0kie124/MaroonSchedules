from __future__ import annotations
"""
Business-logic layer for user operations (profile + schedules).
"""
import uuid
import os
from typing import Any, Dict, List, Optional
from repositories import user_repository
from services import user_preference_profile_service


# ---------------------------------------------------------------------------
# Auth / sync
# ---------------------------------------------------------------------------

def sync_user(clerk_id: str, email: str = None, full_name: str = None, profile_image_url: str = None, username: str = None) -> dict:
    """Called on every sign-in to ensure the user exists in the DB."""
    return user_repository.upsert_user(clerk_id, email, full_name, profile_image_url, username=username)


# ---------------------------------------------------------------------------
# Profile
# ---------------------------------------------------------------------------

def get_profile(clerk_id: str) -> dict | None:
    profile = user_repository.get_user(clerk_id)
    if not profile:
        return None
    profile["user_preference_profile"] = user_repository.get_user_preference_profile(clerk_id)
    return profile


def update_profile(clerk_id: str, fields: dict) -> dict | None:
    updates = dict(fields or {})
    preference_keys = {
        "preferred_event_categories",
        "preferred_event_interests",
        "preferred_time",
        "preferred_social_mode",
        "notification_frequency",
        "onboarding_answers",
        "event_preferences_completed",
        "avoid_friday",
    }
    onboarding_related_update = any(key in updates for key in preference_keys)

    if onboarding_related_update and "onboarding_answers" not in updates:
        synthesized_answers: Dict[str, Any] = {}
        if "preferred_event_categories" in updates:
            synthesized_answers["preferred_sections"] = updates.get("preferred_event_categories") or []
        if "preferred_event_interests" in updates:
            synthesized_answers["interest_tags"] = updates.get("preferred_event_interests") or []
        if "preferred_time" in updates and updates.get("preferred_time"):
            synthesized_answers["day_vs_night"] = updates.get("preferred_time")
        if "notification_frequency" in updates and updates.get("notification_frequency"):
            synthesized_answers["notification_frequency"] = updates.get("notification_frequency")
        if synthesized_answers:
            updates["onboarding_answers"] = synthesized_answers

    updated = user_repository.update_profile(clerk_id, updates)
    if not updated:
        return None

    should_generate_profile = onboarding_related_update and bool(updated.get("event_preferences_completed"))
    if should_generate_profile:
        onboarding_answers = updated.get("onboarding_answers") or {}
        generated = user_preference_profile_service.generate_user_preference_profile(
            onboarding_answers=onboarding_answers,
            interaction_history=None,
            allow_llm=os.getenv("USER_PROFILE_ALLOW_LLM", "").strip().lower() in {"1", "true", "yes"},
        )
        user_repository.upsert_user_preference_profile(clerk_id, generated)
        updated["user_preference_profile"] = generated
    else:
        updated["user_preference_profile"] = user_repository.get_user_preference_profile(clerk_id)

    return updated


def accept_tos(clerk_id: str) -> None:
    return user_repository.set_tos_accepted(clerk_id)


def complete_tour(clerk_id: str) -> None:
    return user_repository.set_tour_completed(clerk_id)


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
