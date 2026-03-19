from pydantic import BaseModel
from typing import List, Optional

class SectionBase(BaseModel):
    id: str
    termCode: str
    courseNumber: str
    dept: str

class SectionDetail(SectionBase):
    section: Optional[str] = None
    honors: Optional[bool] = None
    openSeats: Optional[int] = None
    maxSeats: Optional[int] = None
    meetings: Optional[List[dict]] = None
    instructors: Optional[List[dict]] = None
