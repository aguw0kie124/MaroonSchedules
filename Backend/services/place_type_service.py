from typing import Optional


def normalize_place_type(value: Optional[str]) -> str:
    normalized = (value or "").strip().lower()

    if normalized in {"hub"}:
        return "Hub"
    if normalized in {"dining", "coffee", "cafe", "restaurant", "food"}:
        return "Dining"
    if normalized in {"library"}:
        return "Library"
    if normalized in {"rec", "recreation", "gym", "fitness"}:
        return "Rec"
    if normalized in {"academic", "building"}:
        return "Academic"
    if normalized in {"parking", "garage"}:
        return "Parking"
    if normalized in {"landmark"}:
        return "Landmark"
    if normalized in {"housing"}:
        return "Housing"
    if normalized in {"athletics"}:
        return "Athletics"
    if normalized in {"study", "restroom", "general", ""}:
        return "General"

    return value or "General"
