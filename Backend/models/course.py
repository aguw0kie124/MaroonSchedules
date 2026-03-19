from pydantic import BaseModel
from typing import List, Optional

class CourseBase(BaseModel):
    id: str
    code: str
    name: str
    credits: Optional[float] = None
    description: Optional[str] = None

class CourseDetail(CourseBase):
    dept_id: Optional[str] = None
    avgGPA: Optional[float] = None
    difficulty: Optional[float] = None
    # Add other fields if necessary
