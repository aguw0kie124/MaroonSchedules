from pydantic import BaseModel
from typing import List, Optional

class ScheduleBase(BaseModel):
    user_id: str
    name: str # e.g. "Fall 2026 Primary"
    term_code: str

class ScheduleDetail(ScheduleBase):
    schedule_id: str
    section_ids: List[str] = []
