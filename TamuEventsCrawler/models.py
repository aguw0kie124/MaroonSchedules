"""Pydantic models for TAMU Events Crawler."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime
from enum import Enum
from typing import Any, List, Optional

from pydantic import BaseModel, Field, computed_field, model_validator


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------


class SourcePriority(str, Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class HostType(str, Enum):
    STUDENT_ORG = "student_org"
    DEPARTMENT = "department"
    CENTER = "center"
    VENUE = "venue"
    UNIVERSITY = "university"
    UNKNOWN = "unknown"


# ---------------------------------------------------------------------------
# Source configuration (mirrors sources.yaml)
# ---------------------------------------------------------------------------


class SourceConfig(BaseModel):
    name: str
    type: str  # livewhale_json | rss_directory | html | html_pagination | html_search
    url: Optional[str] = None
    urls: List[str] = Field(default_factory=list)  # Multi-URL sources
    queries: List[str] = Field(default_factory=list)  # Search query terms
    base_url: Optional[str] = None
    page_pattern: Optional[str] = None
    max_pages: int = 1
    parser: Optional[str] = None
    priority: SourcePriority = SourcePriority.MEDIUM
    campus_filter: str = "college_station"


class SourceRegistry(BaseModel):
    sources: List[SourceConfig]


# ---------------------------------------------------------------------------
# Event model
# ---------------------------------------------------------------------------


class Event(BaseModel):
    """Canonical normalised event schema."""

    id: str  # tamu:livewhale:12345 or tamu:getinvolved:orgname:123
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
    source_name: str
    source_url: str
    event_url: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    has_food: bool = False
    food_confidence: float = 0.0
    food_reasons: List[str] = Field(default_factory=list)
    food_type: str = "unknown"  # lunch|dinner|snacks|beverage|unknown
    duration_minutes: Optional[int] = None
    student_org_prob: float = 0.0
    sources_seen: int = 1
    audience: List[str] = Field(default_factory=lambda: ["undergrad"])
    campus: str = "college_station"
    affiliation: str = "tamu"
    freshness_score: float = 0.5
    first_seen_at: datetime = Field(default_factory=datetime.utcnow)
    last_seen_at: datetime = Field(default_factory=datetime.utcnow)
    raw_payload: dict = Field(default_factory=dict)
    content_hash: str = ""
    dedupe_group_id: Optional[str] = None

    # ------------------------------------------------------------------
    # Computed hash
    # ------------------------------------------------------------------

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

    # ------------------------------------------------------------------
    # Serialisation helpers
    # ------------------------------------------------------------------

    def to_jsonl(self) -> str:
        """Return a single-line JSON string suitable for appending to JSONL."""
        return self.model_dump_json()

    @classmethod
    def from_jsonl(cls, line: str) -> "Event":
        return cls.model_validate_json(line)
