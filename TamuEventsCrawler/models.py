"""Pydantic models for TAMU Events Crawler v3."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

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
    COLLEGE = "college"
    PROGRAM = "program"
    UNKNOWN = "unknown"


# ---------------------------------------------------------------------------
# Source configuration (mirrors sources.yaml)
# ---------------------------------------------------------------------------


class SourceConfig(BaseModel):
    name: str
    type: str  # livewhale_json | rss_directory | html | html_pagination | html_search | html_events | html_multi_url
    url: Optional[str] = None
    urls: List[str] = Field(default_factory=list)  # Multi-URL sources
    queries: List[str] = Field(default_factory=list)  # Search query terms
    base_urls: List[str] = Field(default_factory=list)
    base_url: Optional[str] = None
    page_pattern: Optional[str] = None
    max_pages: int = 1
    parser: Optional[str] = None
    detail_pattern: Optional[str] = None
    detail_parser: Optional[str] = None
    filters: Dict[str, Any] = Field(default_factory=dict)
    department_map: Dict[str, str] = Field(default_factory=dict)
    priority: SourcePriority = SourcePriority.MEDIUM
    campus_filter: str = "college_station"
    max_depth: int = 2  # Link-following depth from this source


class SourceRegistry(BaseModel):
    sources: List[SourceConfig]


# ---------------------------------------------------------------------------
# Event model
# ---------------------------------------------------------------------------


class Event(BaseModel):
    """Canonical normalised event schema — v3 with categories & traceability."""

    # --- Identity ---
    id: str  # tamu:livewhale:12345 or tamu:getinvolved:orgname:123
    title: str
    description: Optional[str] = None

    # --- Temporal ---
    start_time: datetime
    end_time: Optional[datetime] = None
    timezone: str = "America/Chicago"

    # --- Spatial ---
    location: Optional[str] = None
    location_lat: Optional[float] = None
    location_lng: Optional[float] = None

    # --- Organisational ---
    host_name: Optional[str] = None
    host_type: str = HostType.UNKNOWN

    # --- Department / School ---
    department_code: Optional[str] = None
    department_name: Optional[str] = None

    # --- Source traceability ---
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

    # --- Tags & audience ---
    tags: List[str] = Field(default_factory=list)
    audience: List[str] = Field(default_factory=lambda: ["undergrad"])
    campus: str = "college_station"
    affiliation: str = "tamu"

    # --- Binary category flags (0 or 1) ---
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

    # --- Food detection ---
    has_food: bool = False
    food_confidence: float = 0.0
    food_reasons: List[str] = Field(default_factory=list)
    food_type: str = "unknown"  # lunch|dinner|breakfast|snacks|beverage|reception|unknown

    # --- Scoring & freshness ---
    freshness_score: float = 0.5
    duration_minutes: Optional[int] = None
    student_org_prob: float = 0.0
    sources_seen: int = 1

    # --- Timestamps ---
    first_seen_at: datetime = Field(default_factory=datetime.utcnow)
    last_seen_at: datetime = Field(default_factory=datetime.utcnow)

    # --- Raw / dedup ---
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
