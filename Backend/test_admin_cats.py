import json
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import List, Dict

def _get_admin_event_categories(title: str, description: str, tags: List[str]) -> Dict[str, int]:
    """Dynamically assign categories based on content and tags."""
    blob = (title + " " + (description or "") + " " + " ".join(tags)).lower()
    categories = {
        "featured": 1,
        "social": 0,
        "sports": 0,
        "academic": 0,
        "food": 0,
        "advocacy": 0,
        "entertainment": 0,
        "health_wellness": 0,
        "miscellaneous": 0,
    }

    if any(kw in blob for kw in ["sport", "game", "match", "tournament", "athletic", "ncaa", "espn"]):
        categories["sports"] = 1
    if any(kw in blob for kw in ["lecture", "seminar", "research", "study", "academic", "workshop", "colloquium", "thesis", "dissertation"]):
        categories["academic"] = 1
    if any(kw in blob for kw in ["food", "meal", "dinner", "lunch", "breakfast", "pizza", "refreshments", "catering"]):
        categories["food"] = 1
    if any(kw in blob for kw in ["social", "mixer", "meetup", "party", "hangout", "organization fair", "student org"]):
        categories["social"] = 1
    if any(kw in blob for kw in ["concert", "show", "performance", "movie", "film", "theatre", "theater", "dance", "talent"]):
        categories["entertainment"] = 1
    if any(kw in blob for kw in ["wellness", "health", "yoga", "mental", "meditation", "self-care", "therapy"]):
        categories["health_wellness"] = 1
    if any(kw in blob for kw in ["advocacy", "activism", "awareness", "volunteer", "service", "march", "rally"]):
        categories["advocacy"] = 1

    if not any(v for k, v in categories.items() if k != "featured"):
        categories["miscellaneous"] = 1

    return categories

def test_categorization():
    test_cases = [
        ("Aggie Football Game", "Come watch the game at Kyle Field", [], "sports"),
        ("Physics Lecture", "A deep dive into quantum mechanics", ["academic"], "academic"),
        ("Pizza Social", "Free pizza for all students", ["social"], "food"),
        ("Yoga in the Park", "Relax and unwind", ["wellness"], "health_wellness"),
        ("Misc Admin Post", "Don't forget to pay your fees", [], "miscellaneous")
    ]
    
    for title, desc, tags, expected in test_cases:
        cats = _get_admin_event_categories(title, desc, tags)
        print(f"Testing: {title} -> {cats}")
        if cats.get(expected) == 1 or (expected == "food" and cats.get("food") == 1):
            print(f"  PASS: {expected} found")
        elif expected == "miscellaneous" and cats.get("miscellaneous") == 1:
            print(f"  PASS: miscellaneous found")
        else:
            print(f"  FAIL: {expected} NOT found")

if __name__ == "__main__":
    test_categorization()
