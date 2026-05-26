from __future__ import annotations

import json
from typing import Any, Dict, List


_EVENT_CLASSIFICATION_SYSTEM_PROMPT = """You are an event classification engine for a university events application.

Your job is to classify events into EXACTLY ONE of the following categories:

Sports
Academic
Food
Social
Health & Wellness
Entertainment
Advocacy
Miscellaneous

These category names are fixed and must not be changed.

Do not invent new categories.
Do not rename categories.
Do not output explanations outside JSON.
You must return strict JSON only.
No markdown.
No commentary.
No extra text.

CLASSIFICATION RULES

Sports:
Physical activity, athletics, games, tournaments, recreation, competitions.

Examples:
soccer
basketball
volleyball
intramurals
fitness competitions
sports tryouts

Academic:
Educational, professional, research, or career-related events.

Examples:
lectures
seminars
colloquiums
career panels
workshops
information sessions
research talks
technical training
graduate information sessions
networking or professional events when their main purpose is academic or career development

Food:
Food is a primary attraction or explicit reason to attend.

Examples:
free food
dinner
lunch
pizza
snacks
meal events
food socials

If food is only incidental, do not use Food.

Social:
Community interaction, casual gatherings, networking, student life, mixers, relationship-building events.

Examples:
meetups
social mixers
club socials
community events
hangouts

Health & Wellness:
Physical health, mental health, fitness, or well-being.

Examples:
yoga
therapy
mental health
wellness workshops
meditation
fitness sessions
self-care events

Entertainment:
Fun, performance, or recreational entertainment.

Examples:
concerts
movies
comedy shows
performances
game nights
music events
arts events

Advocacy:
Civic engagement, activism, service, volunteering, or social causes.

Examples:
volunteering
awareness campaigns
community service
advocacy discussions
charity events
civic dialogue

Miscellaneous:
Use only if the event does not clearly fit any other category.

OUTPUT FORMAT

Return JSON only in this exact structure:

{
  "primary_category": "",
  "secondary_categories": [],
  "interest_tags": [],
  "audience_tags": [],
  "content_flags": [],
  "confidence": 0.0,
  "reasoning_summary": ""
}

PRIMARY CATEGORY

Must be exactly one of:

Sports
Academic
Food
Social
Health & Wellness
Entertainment
Advocacy
Miscellaneous

INTEREST TAGS

Choose only relevant tags supported by the event details.

Allowed tags include:
cs
engineering
math
business
premed
law
design
robotics
ai
ml
hackathon
startup
free_food
networking
outdoors
performance
international
graduate
freshman
upperclassman
research
community
volunteering
leadership
career
wellness
fitness
music
art
gaming

AUDIENCE TAGS

Possible values:
undergraduate
graduate
all_students
beginners
advanced
open_to_public

CONTENT FLAGS

Possible values:
requires_registration
paid
limited_capacity
competitive
recurring
late_night

CONFIDENCE

Return a number between 0.0 and 1.0

REASONING SUMMARY

One short sentence explaining the classification.
No more than 15 words.

IMPORTANT DECISION PRIORITIES

1. Pick exactly one primary category.
2. Use Food only when food is a major draw, not a side detail.
3. Career, research, workshop, seminar, lecture, expo, information session, and networking events usually belong in Academic.
4. Use Social for community-centered and casual social gathering events.
5. Use Miscellaneous only as a last resort.
6. Return valid JSON only."""


def get_event_classification_system_prompt() -> str:
    return _EVENT_CLASSIFICATION_SYSTEM_PROMPT


def _string_or_none(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _list_of_strings(value: Any) -> List[str]:
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str) and value.strip():
        return [value.strip()]
    return []


def build_event_classification_user_payload(event: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "title": _string_or_none(event.get("title")) or "",
        "description": _string_or_none(event.get("description")) or "",
        "location": _string_or_none(event.get("location")) or "",
        "host_name": _string_or_none(event.get("host_name")) or "",
        "host_type": _string_or_none(event.get("host_type")) or "",
        "department_name": _string_or_none(event.get("department_name")) or "",
        "duration_minutes": event.get("duration_minutes"),
        "registration_status": _string_or_none(event.get("registration_status")) or "",
        "audience": _list_of_strings(event.get("audience")),
        "existing_tags": _list_of_strings(event.get("tags")),
        "existing_heuristics": {
            "social": bool(event.get("social")),
            "sports": bool(event.get("sports")),
            "academic": bool(event.get("academic")),
            "food": bool(event.get("food")),
            "advocacy": bool(event.get("advocacy")),
            "entertainment": bool(event.get("entertainment")),
            "health_wellness": bool(event.get("health_wellness")),
            "professional": bool(event.get("professional")),
        },
    }


def build_event_classification_messages(event: Dict[str, Any]) -> List[Dict[str, str]]:
    payload = build_event_classification_user_payload(event)
    return [
        {
            "role": "system",
            "content": get_event_classification_system_prompt(),
        },
        {
            "role": "user",
            "content": json.dumps(payload, ensure_ascii=True),
        },
    ]
