from typing import List, Optional
from repositories import course_repository
from models.search import CourseSearchRequest

def search_courses(request: CourseSearchRequest) -> List[dict]:
    """
    Service to search for courses based on advanced parameters.
    Delegates to the course_repository, enforcing the max 5 elements logic.
    """
    return course_repository.search_courses(
        dept=request.dept,
        location=request.location,
        course_number=request.course_number,
        section_attribute=request.section_attribute,
        instructor=request.instructor,
        crn=request.crn,
        limit=5
    )

def get_course_details(course_id: str) -> Optional[dict]:
    """
    Service to fetch a course and bundle its related sections.
    """
    course = course_repository.get_course_by_id(course_id)
    if not course:
        return None
        
    # Attach sections to course details, a business logic combination
    sections = course_repository.get_sections_for_course(course_id)
    course["sections"] = sections
    return course

def search_sections(term: Optional[str] = None, course_code: Optional[str] = None) -> List[dict]:
    """
    Service to search sections based on filters.
    """
    return course_repository.search_sections(term=term, course_code=course_code)[:5]
