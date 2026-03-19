from pydantic import BaseModel, Field
from typing import Optional

class CourseSearchRequest(BaseModel):
    dept: Optional[str] = Field(None, description="Department code, e.g., CSCE")
    location: Optional[str] = Field(None, description="Campus location, e.g., CSTAT")
    course_number: Optional[str] = Field(None, description="Course number, e.g., 110")
    section_attribute: Optional[str] = Field(None, description="Section attribute")
    instructor: Optional[str] = Field(None, description="Professor name")
    crn: Optional[str] = Field(None, description="Course Registration Number")
    
class ScheduleGenerateRequest(BaseModel):
    # Expecting a comma-separated string or a list? GET request, so we will handle it as Query in main.py
    # But for cleaner design if they change to POST, keeping this model around.
    pass
