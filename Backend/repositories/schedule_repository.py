import json
import os
import uuid
from typing import List, Optional

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "Data")
SCHEDULES_FILE = os.path.join(DATA_DIR, "schedules_state.json")

def _load_schedules() -> dict:
    if not os.path.exists(SCHEDULES_FILE):
        return {}
    with open(SCHEDULES_FILE, "r", encoding="utf-8") as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return {}

def _save_schedules(schedules: dict):
    with open(SCHEDULES_FILE, "w", encoding="utf-8") as f:
        json.dump(schedules, f, indent=4)

def create_schedule(user_id: str, name: str, term_code: str) -> dict:
    """
    TODO: Replace with PostgreSQL INSERT into schedules table
    """
    schedules = _load_schedules()
    schedule_id = str(uuid.uuid4())
    new_schedule = {
        "schedule_id": schedule_id,
        "user_id": user_id,
        "name": name,
        "term_code": term_code,
        "section_ids": []
    }
    schedules[schedule_id] = new_schedule
    _save_schedules(schedules)
    return new_schedule

def get_schedules_for_user(user_id: str) -> List[dict]:
    """
    TODO: Replace with PostgreSQL SELECT FROM schedules WHERE user_id = %s
    """
    schedules = _load_schedules()
    return [s for s in schedules.values() if str(s.get("user_id")) == str(user_id)]

def get_schedule(schedule_id: str) -> Optional[dict]:
    """
    TODO: Replace with PostgreSQL SELECT FROM schedules WHERE schedule_id = %s
    """
    schedules = _load_schedules()
    return schedules.get(schedule_id)

def update_schedule(schedule_id: str, schedule_data: dict) -> None:
    """
    TODO: Replace with PostgreSQL UPDATE schedules SET ...
    """
    schedules = _load_schedules()
    if schedule_id in schedules:
        schedules[schedule_id] = schedule_data
        _save_schedules(schedules)

def delete_schedule(schedule_id: str) -> bool:
    """
    TODO: Replace with PostgreSQL DELETE FROM schedules
    """
    schedules = _load_schedules()
    if schedule_id in schedules:
        del schedules[schedule_id]
        _save_schedules(schedules)
        return True
    return False
