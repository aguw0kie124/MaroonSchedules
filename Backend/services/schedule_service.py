import itertools
from typing import List, Optional
from repositories import schedule_repository
from repositories import course_repository

def create_schedule(user_id: str, name: str, term_code: str) -> dict:
    if not name or not term_code:
        raise ValueError("Name and term code are required to create a schedule.")
    return schedule_repository.create_schedule(user_id, name, term_code)

def get_schedules_for_user(user_id: str) -> List[dict]:
    # Corresponds to "View courses - GET" in user requirements
    schedules = schedule_repository.get_schedules_for_user(user_id)
    
    # Expand section details if needed for frontend display
    for sched in schedules:
        expanded_sections = []
        for sec_id in sched.get("section_ids", []):
            # Try to grab detailed section metadata if available
            sec_metadata = course_repository.get_section_by_id(sec_id)
            if sec_metadata:
                expanded_sections.append(sec_metadata)
            else:
                expanded_sections.append({"id": sec_id, "section_id": sec_id})
        sched["sections"] = expanded_sections
        
    return schedules

def get_schedule(schedule_id: str) -> dict:
    sched = schedule_repository.get_schedule(schedule_id)
    if not sched:
        raise ValueError("Schedule not found.")
    return sched

def add_section_to_schedule(schedule_id: str, section_id: str) -> dict:
    # Corresponds to "Adding courses - POST" mapping to StudentSectionProfessor
    sched = schedule_repository.get_schedule(schedule_id)
    if not sched:
        raise ValueError("Schedule not found.")
        
    # Prevent duplicate
    if section_id not in sched.get("section_ids", []):
        sched.setdefault("section_ids", []).append(section_id)
        schedule_repository.update_schedule(schedule_id, sched)
        
    return sched

def remove_section_from_schedule(schedule_id: str, section_id: str) -> dict:
    # Corresponds to "Remove courses - DELETE" logic
    sched = schedule_repository.get_schedule(schedule_id)
    if not sched:
        raise ValueError("Schedule not found.")
        
    if section_id in sched.get("section_ids", []):
        sched["section_ids"].remove(section_id)
        schedule_repository.update_schedule(schedule_id, sched)
        
    return sched

def delete_schedule(schedule_id: str) -> bool:
    return schedule_repository.delete_schedule(schedule_id)


def _check_time_conflict(sec_a: dict, sec_b: dict) -> bool:
    """
    Validates if two specific sections possess overlapping time schedules based on 'meetings' list.
    Placeholder constraint checker for permutation builder.
    """
    return False

def generate_schedules(course_ids: List[str], limit: int = 5) -> List[dict]:
    """
    Generate valid schedules (permutations of sections) given an array of desired course IDs.
    Applies Heap's/Cartesian combination checking and filters out conflicts. Limit: 5
    """
    if not course_ids:
        return []
        
    all_sections = []
    for cid in course_ids:
        secs = course_repository.get_sections_for_course(cid)
        if not secs:
            # If any course has no sections offered, impossible schedule
            return []
        all_sections.append(secs)
        
    valid_schedules = []
    
    # Generate permutations picking 1 section from each matched course constraint sequence
    for combo in itertools.product(*all_sections):
        combo_list = list(combo)
        
        is_valid = True
        for i in range(len(combo_list)):
            for j in range(i + 1, len(combo_list)):
                if _check_time_conflict(combo_list[i], combo_list[j]):
                    is_valid = False
                    break
            if not is_valid:
                break
                
        if is_valid:
            valid_schedules.append({
                "sections": combo_list
            })
            if len(valid_schedules) >= limit:
                return valid_schedules
                
    return valid_schedules
