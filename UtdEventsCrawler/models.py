"""Pydantic models for the UTD Events Crawler."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, model_validator


class SourcePriority(str, Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class HostType(str, Enum):
    STUDENT_ORG = "student_org"
    DEPARTMENT = "department"
    CENTER = "center"
    UNIVERSITY = "university"
    PROGRAM = "program"
    VENUE = "venue"
    UNKNOWN = "unknown"


class SourceConfig(BaseModel):
    name: str
    type: str
    url: Optional[str] = None
    priority: SourcePriority = SourcePriority.MEDIUM
    campus_filter: str = "richardson"
    days: int = 30
    page_size: int = 100
    max_pages: int = 5
    entity_kind: Optional[str] = None
    entity_page_suffix: str = "/calendar"
    extra_tags: List[str] = Field(default_factory=list)
    selection_keywords: List[str] = Field(default_factory=list)
    max_entities: Optional[int] = None


class SourceRegistry(BaseModel):
    sources: List[SourceConfig]


class Event(BaseModel):
    id: str
    title: str
    description: Optional[str] = None

    start_time: datetime
    end_time: Optional[datetime] = None
    timezone: str = "America/Chicago"

    location: Optional[str] = None
    location_lat: Optional[float] = None
    location_lng: Optional[float] = None

    host_name: Optional[str] = None
    host_type: str = HostType.UNKNOWN

    department_code: Optional[str] = None
    department_name: Optional[str] = None

    source_name: str
    source_url: str
    source_links: List[str] = Field(default_factory=list)
    event_url: Optional[str] = None
    discovered_via: Optional[str] = None
    crawl_path: List[str] = Field(default_factory=list)
    registration_start: Optional[datetime] = None
    registration_end: Optional[datetime] = None
    registration_status: Optional[str] = None
    seats_available: Optional[int] = None
    seats_total: Optional[int] = None
    prerequisites: List[str] = Field(default_factory=list)

    tags: List[str] = Field(default_factory=list)
    audience: List[str] = Field(default_factory=lambda: ["undergrad"])
    campus: str = "richardson"
    affiliation: str = "utd"

    social: int = 0
    sports: int = 0
    academic: int = 0
    food: int = 0
    advocacy: int = 0
    entertainment: int = 0
    health_wellness: int = 0
    religion: int = 0
    casual: int = 0
    professional: int = 0
    category_reasons: List[str] = Field(default_factory=list)

    has_food: bool = False
    food_confidence: float = 0.0
    food_reasons: List[str] = Field(default_factory=list)
    food_type: str = "unknown"

    freshness_score: float = 0.5
    duration_minutes: Optional[int] = None
    student_org_prob: float = 0.0
    sources_seen: int = 1

    first_seen_at: datetime = Field(default_factory=datetime.utcnow)
    last_seen_at: datetime = Field(default_factory=datetime.utcnow)

    raw_payload: Dict[str, Any] = Field(default_factory=dict)
    content_hash: str = ""
    dedupe_group_id: Optional[str] = None

    @model_validator(mode="after")
    def _compute_content_hash(self) -> "Event":
        if not self.content_hash:
            blob = json.dumps(
                {
                    "title": self.title,
                    "start_time": self.start_time.isoformat(),
                    "location": self.location or "",
                    "description": (self.description or "")[:500],
                },
                sort_keys=True,
            )
            self.content_hash = hashlib.sha256(blob.encode()).hexdigest()[:16]
        return self

    def to_jsonl(self) -> str:
        return self.model_dump_json()

    @classmethod
    def from_jsonl(cls, line: str) -> "Event":
        return cls.model_validate_json(line)
