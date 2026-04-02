from repositories import course_repository
import json

# Test fetching a known section ID from a historical term (2025)
# This will test the GZIP decompression and multi-term logic.
section_id = "202531_46760"
section = course_repository.get_section_by_id(section_id)

if section:
    print(f"SUCCESS: Found section {section.get('dept')} {section.get('courseNumber')}-{section.get('sectionNumber')}")
    print(f"Title: {section.get('courseTitle')}")
    print(f"Meetings: {len(section.get('meetings', []))} sessions")
else:
    print(f"FAILURE: Could not find section {section_id}")