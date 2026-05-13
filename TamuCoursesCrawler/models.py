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


class SourceConfig(BaseModel):
    name: str
    type: str
    url: str
    college: Optional[str] = None
    priority: SourcePriority = SourcePriority.MEDIUM


class SourceRegistry(BaseModel):
    sources: List[SourceConfig]


class PrereqGroup(BaseModel):
    operator: str
    courses: List[str]


class Course(BaseModel):
    id: str
    department: str
    number: str
    title: str
    credit_hours: int
    description: Optional[str] = None
    prerequisites: List[PrereqGroup] = Field(default_factory=list)
    corequisites: List[str] = Field(default_factory=list)
    raw_prereq_text: Optional[str] = None
    source_url: str
    scraped_at: str
    content_hash: str = ""

    @model_validator(mode="after")
    def compute_hash(self) -> "Course":
        if not self.content_hash:
            blob = json.dumps(
                {
                    "department": self.department,
                    "number": self.number,
                    "title": self.title,
                    "description": self.description,
                    "raw_prereq_text": self.raw_prereq_text,
                },
                sort_keys=True,
            )
            self.content_hash = hashlib.sha256(blob.encode("utf-8")).hexdigest()[:16]
        return self

    def to_jsonl(self) -> str:
        return self.model_dump_json()


class SemesterSlot(BaseModel):
    semester: int
    year_label: str
    season: str
    courses: List[str] = Field(default_factory=list)


class DegreePlan(BaseModel):
    id: str
    college: str
    department: str
    degree: str
    major: str
    catalog_year: str
    total_hours: int
    semesters: List[SemesterSlot] = Field(default_factory=list)
    source_url: str
    scraped_at: str

    def to_jsonl(self) -> str:
        return self.model_dump_json()


class GradeDistribution(BaseModel):
    id: str
    department: str
    course_number: str
    course_title: Optional[str] = None
    instructor: str
    term: str
    section: Optional[str] = None
    gpa: Optional[float] = None
    grades: Dict[str, int] = Field(default_factory=dict)
    total_enrolled: int
    source_url: str
    scraped_at: str

    def to_jsonl(self) -> str:
        return self.model_dump_json()


class CrawlOutput(BaseModel):
    courses: List[Course] = Field(default_factory=list)
    degree_plans: List[DegreePlan] = Field(default_factory=list)
    grade_distributions: List[GradeDistribution] = Field(default_factory=list)


def utc_now_iso() -> str:
    return datetime.utcnow().isoformat() + "Z"
