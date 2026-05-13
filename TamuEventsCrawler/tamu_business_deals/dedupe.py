from __future__ import annotations

from typing import Dict, Iterable, List

from rapidfuzz import fuzz

from .models import DealRecord
from .utils import canonicalize_url, normalize_key, unique_strings


def _time_key(record: DealRecord) -> str:
    if record.start_date:
        return record.start_date.date().isoformat()
    if record.recurring_pattern:
        return record.recurring_pattern
    return ""


def _record_key(record: DealRecord) -> tuple[str, str, str, str]:
    return (
        normalize_key(record.title),
        normalize_key(record.location_name or record.business_name),
        _time_key(record),
        canonicalize_url(record.canonical_url or record.source_url),
    )


def _merge(primary: DealRecord, duplicate: DealRecord) -> DealRecord:
    if not primary.description and duplicate.description:
        primary.description = duplicate.description
    if not primary.discount_text and duplicate.discount_text:
        primary.discount_text = duplicate.discount_text
    if not primary.address and duplicate.address:
        primary.address = duplicate.address
    if not primary.city and duplicate.city:
        primary.city = duplicate.city
    if primary.start_date is None and duplicate.start_date is not None:
        primary.start_date = duplicate.start_date
    if primary.end_date is None and duplicate.end_date is not None:
        primary.end_date = duplicate.end_date
    if not primary.recurring_pattern and duplicate.recurring_pattern:
        primary.recurring_pattern = duplicate.recurring_pattern
    if primary.image_url is None and duplicate.image_url:
        primary.image_url = duplicate.image_url
    if primary.latitude is None and duplicate.latitude is not None:
        primary.latitude = duplicate.latitude
    if primary.longitude is None and duplicate.longitude is not None:
        primary.longitude = duplicate.longitude
    primary.tags = unique_strings(list(primary.tags) + list(duplicate.tags))
    primary.source_links = unique_strings(list(primary.source_links) + list(duplicate.source_links))
    primary.updated_at = max(primary.updated_at, duplicate.updated_at)
    return primary


def deduplicate_records(records: Iterable[DealRecord]) -> list[DealRecord]:
    exact: Dict[tuple[str, str, str, str], DealRecord] = {}
    fuzzy_result: List[DealRecord] = []

    for record in records:
        key = _record_key(record)
        if key in exact:
            exact[key] = _merge(exact[key], record)
            continue
        exact[key] = record

    for record in exact.values():
        merged = False
        for existing in fuzzy_result:
            if _time_key(existing) != _time_key(record):
                continue
            if normalize_key(existing.location_name or existing.business_name) != normalize_key(record.location_name or record.business_name):
                continue
            if fuzz.ratio(normalize_key(existing.title), normalize_key(record.title)) < 92:
                continue
            _merge(existing, record)
            merged = True
            break
        if not merged:
            fuzzy_result.append(record)

    fuzzy_result.sort(
        key=lambda record: (
            0 if record.event_scope == "event" else 1,
            record.start_date.isoformat() if record.start_date else "9999-12-31",
            normalize_key(record.title),
        )
    )
    return fuzzy_result
