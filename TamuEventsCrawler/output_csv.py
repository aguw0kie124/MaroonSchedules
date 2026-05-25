"""CSV summary output — generates summary reports from crawled events."""

from __future__ import annotations

import csv
import json
import logging
from collections import Counter
from pathlib import Path
from typing import Any, Dict, List

logger = logging.getLogger("tamu_crawler.output_csv")

OUTPUT_DIR = Path("output")
EVENTS_FILE = Path("data/normalized/events.jsonl")

PRIMARY_CATEGORY_ORDER = [
    "sports",
    "academic",
    "food",
    "social",
    "health_wellness",
    "entertainment",
    "advocacy",
    "miscellaneous",
]


def _normalized_primary_category(event: Dict[str, Any]) -> str:
    category = str(event.get("primary_category") or "").strip().lower()
    if category in PRIMARY_CATEGORY_ORDER:
        return category

    # Back-compat with legacy boolean flags when primary_category is absent.
    for key in PRIMARY_CATEGORY_ORDER:
        if event.get(key, 0) == 1:
            return key
    return "miscellaneous"


def _load_events() -> List[Dict[str, Any]]:
    """Load events from JSONL."""
    events = []
    if EVENTS_FILE.exists():
        with open(EVENTS_FILE, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    try:
                        events.append(json.loads(line))
                    except json.JSONDecodeError:
                        continue
    return events


def _write_csv(filename: str, headers: List[str], rows: List[List[Any]]) -> Path:
    """Write a CSV file to the output directory."""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    filepath = OUTPUT_DIR / filename
    with open(filepath, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(headers)
        writer.writerows(rows)
    logger.info("Wrote %d rows to %s", len(rows), filepath)
    return filepath


def generate_summary_by_source(events: List[Dict[str, Any]]) -> Path:
    """Generate CSV: event counts by source_name."""
    counter = Counter(e.get("source_name", "unknown") for e in events)
    rows = [[name, count] for name, count in counter.most_common()]
    return _write_csv("summary_by_source.csv", ["source_name", "event_count"], rows)


def generate_summary_by_department(events: List[Dict[str, Any]]) -> Path:
    """Generate CSV: event counts by department."""
    counter = Counter()
    for e in events:
        dept = e.get("department_code") or e.get("department_name") or "unmapped"
        counter[dept] += 1
    rows = [[dept, count] for dept, count in counter.most_common()]
    return _write_csv("summary_by_department.csv", ["department", "event_count"], rows)


def generate_summary_by_category(events: List[Dict[str, Any]]) -> Path:
    """Generate CSV: event counts by normalized primary category."""
    counter = Counter(_normalized_primary_category(event) for event in events)
    rows = [[category, counter.get(category, 0)] for category in PRIMARY_CATEGORY_ORDER]
    return _write_csv("summary_by_category.csv", ["category", "event_count"], rows)


def generate_summary_by_food_confidence(events: List[Dict[str, Any]]) -> Path:
    """Generate CSV: event counts by food confidence bucket."""
    buckets = {"0.0": 0, "0.1-0.29": 0, "0.3-0.49": 0,
               "0.5-0.69": 0, "0.7-0.89": 0, "0.9-1.0": 0}
    for e in events:
        conf = e.get("food_confidence", 0.0)
        if conf == 0.0:
            buckets["0.0"] += 1
        elif conf < 0.3:
            buckets["0.1-0.29"] += 1
        elif conf < 0.5:
            buckets["0.3-0.49"] += 1
        elif conf < 0.7:
            buckets["0.5-0.69"] += 1
        elif conf < 0.9:
            buckets["0.7-0.89"] += 1
        else:
            buckets["0.9-1.0"] += 1
    rows = [[bucket, count] for bucket, count in buckets.items()]
    return _write_csv("summary_by_food_confidence.csv", ["confidence_bucket", "event_count"], rows)


def generate_summary_by_campus(events: List[Dict[str, Any]]) -> Path:
    """Generate CSV: event counts by campus."""
    counter = Counter(e.get("campus", "unknown") for e in events)
    rows = [[campus, count] for campus, count in counter.most_common()]
    return _write_csv("summary_by_campus.csv", ["campus", "event_count"], rows)


def generate_summary_by_host_type(events: List[Dict[str, Any]]) -> Path:
    """Generate CSV: event counts by host_type."""
    counter = Counter(e.get("host_type", "unknown") for e in events)
    rows = [[ht, count] for ht, count in counter.most_common()]
    return _write_csv("summary_by_host_type.csv", ["host_type", "event_count"], rows)


def generate_summary_by_food_type(events: List[Dict[str, Any]]) -> Path:
    """Generate CSV: food event counts by food_type."""
    food_events = [e for e in events if e.get("has_food")]
    counter = Counter(e.get("food_type", "unknown") for e in food_events)
    rows = [[ft, count] for ft, count in counter.most_common()]
    return _write_csv("summary_by_food_type.csv", ["food_type", "event_count"], rows)


def generate_source_health(events: List[Dict[str, Any]]) -> Path:
    """Generate CSV: source health report."""
    source_stats: Dict[str, Dict[str, Any]] = {}
    for e in events:
        sn = e.get("source_name", "unknown")
        if sn not in source_stats:
            source_stats[sn] = {"count": 0, "food_count": 0, "categories": Counter()}
        source_stats[sn]["count"] += 1
        if e.get("has_food"):
            source_stats[sn]["food_count"] += 1
        source_stats[sn]["categories"][_normalized_primary_category(e)] += 1

    rows = []
    for sn, stats in sorted(source_stats.items(), key=lambda x: -x[1]["count"]):
        top_cats = ", ".join(
            f"{c}:{n}" for c, n in stats["categories"].most_common(3)
        )
        rows.append([sn, stats["count"], stats["food_count"], top_cats])

    return _write_csv(
        "source_health.csv",
        ["source_name", "event_count", "food_event_count", "top_categories"],
        rows,
    )


def generate_all_summaries(events: List[Dict[str, Any]] | None = None) -> List[Path]:
    """Generate all CSV summary reports."""
    if events is None:
        events = _load_events()

    if not events:
        logger.warning("No events to summarise.")
        return []

    paths = [
        generate_summary_by_source(events),
        generate_summary_by_department(events),
        generate_summary_by_category(events),
        generate_summary_by_food_confidence(events),
        generate_summary_by_campus(events),
        generate_summary_by_host_type(events),
        generate_summary_by_food_type(events),
        generate_source_health(events),
    ]

    logger.info("Generated %d CSV summary files in %s", len(paths), OUTPUT_DIR)
    return paths
