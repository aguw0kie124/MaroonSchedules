from __future__ import annotations

import csv
import json
from pathlib import Path
from typing import Iterable

from .constants import DEALS_OUTPUT_CSV, DEALS_OUTPUT_JSON, DEALS_OUTPUT_JSONL
from .models import DealRecord


CSV_FIELDNAMES = [
    "id",
    "title",
    "description",
    "business_name",
    "category",
    "source_url",
    "source_name",
    "location_name",
    "address",
    "city",
    "start_date",
    "end_date",
    "recurring_pattern",
    "deal_type",
    "discount_text",
    "tags",
    "image_url",
    "latitude",
    "longitude",
    "is_student_friendly",
    "created_at",
    "updated_at",
    "raw_source_text",
    "canonical_url",
    "event_scope",
    "area_label",
]


def write_deal_outputs(records: Iterable[DealRecord]) -> tuple[Path, Path, Path]:
    exported = [record.to_export_dict() for record in records]
    DEALS_OUTPUT_JSON.parent.mkdir(parents=True, exist_ok=True)

    DEALS_OUTPUT_JSON.write_text(
        json.dumps(exported, indent=2, default=str),
        encoding="utf-8",
    )

    with DEALS_OUTPUT_JSONL.open("w", encoding="utf-8") as handle:
        for payload in exported:
            handle.write(json.dumps(payload, default=str) + "\n")

    with DEALS_OUTPUT_CSV.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=CSV_FIELDNAMES)
        writer.writeheader()
        for payload in exported:
            row = {key: payload.get(key) for key in CSV_FIELDNAMES}
            row["tags"] = " | ".join(payload.get("tags") or [])
            writer.writerow(row)

    return DEALS_OUTPUT_JSON, DEALS_OUTPUT_JSONL, DEALS_OUTPUT_CSV
