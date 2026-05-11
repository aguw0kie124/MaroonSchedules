from __future__ import annotations

import hashlib
from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, computed_field


class BusinessRecord(BaseModel):
    name: str
    category: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    email: Optional[str] = None
    distance_miles: Optional[float] = None
    business_size: Optional[str] = None
    source: Optional[str] = None
    area_label: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    matched_place_id: Optional[str] = None
    matched_place_confidence: Optional[float] = None

    @computed_field
    @property
    def slug(self) -> str:
        raw = (self.name or "").lower().strip()
        parts = ["".join(ch if ch.isalnum() else "-" for ch in raw)]
        return "-".join(part for part in parts if part).strip("-")


class DealRecord(BaseModel):
    title: str
    description: Optional[str] = None
    business_name: Optional[str] = None
    category: str
    source_url: str
    source_name: str
    location_name: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    recurring_pattern: Optional[str] = None
    deal_type: Optional[str] = None
    discount_text: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    image_url: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    is_student_friendly: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    raw_source_text: Optional[str] = None
    canonical_url: Optional[str] = None
    event_scope: str = "event"
    area_label: Optional[str] = None
    raw_payload: Dict[str, Any] = Field(default_factory=dict)
    source_links: List[str] = Field(default_factory=list)

    @computed_field
    @property
    def id(self) -> str:
        blob = "|".join(
            [
                (self.event_scope or "").lower(),
                (self.title or "").lower().strip(),
                (self.business_name or "").lower().strip(),
                (self.location_name or "").lower().strip(),
                self.start_date.isoformat() if self.start_date else "",
                self.end_date.isoformat() if self.end_date else "",
                (self.canonical_url or self.source_url or "").strip().lower(),
            ]
        )
        return hashlib.sha256(blob.encode("utf-8")).hexdigest()[:20]

    def to_export_dict(self) -> Dict[str, Any]:
        payload = self.model_dump()
        payload["id"] = self.id
        payload["tags"] = list(self.tags)
        payload["source_links"] = list(self.source_links)
        return payload
