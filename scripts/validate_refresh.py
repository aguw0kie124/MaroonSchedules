"""Guard script for the automated event data refresh (CI).

Compares freshly-crawled events.jsonl against the previously committed
version (via `git show <ref>:<path>`) and fails when the new data looks
broken or would lose a large share of upcoming events. Always writes a
JSON report used by the agentic reviewer workflow.

Usage:
  python scripts/validate_refresh.py --campus tamu \
    --new TamuEventsCrawler/data/normalized/events.jsonl \
    --old-ref HEAD --report refresh-report/tamu.json

Exit codes: 0 = pass, 1 = hard failure (do not commit this data).
"""
import argparse
import json
import math
import subprocess
import sys
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path

# Same base fields validate.py checks, plus the category flags the app
# depends on for filtering.
REQUIRED_FIELDS = [
    "id", "title", "start_time", "source_name", "has_food",
    "content_hash", "food_type", "student_org_prob", "sources_seen",
]
CATEGORY_FLAGS = [
    "social", "sports", "academic", "food", "advocacy", "entertainment",
    "health_wellness", "religion", "casual", "professional",
]
# Backend serves events with start_time >= now - 3 days
# (Backend/services/campus_events_service.py).
UPCOMING_CUTOFF_DAYS = 3


def parse_dt(value):
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None


def load_jsonl(text):
    events, bad_lines = [], 0
    for line in text.splitlines():
        if not line.strip():
            continue
        try:
            events.append(json.loads(line))
        except json.JSONDecodeError:
            bad_lines += 1
    return events, bad_lines


def git_show(ref, path):
    result = subprocess.run(
        ["git", "show", f"{ref}:{path}"], capture_output=True, text=True
    )
    return result.stdout if result.returncode == 0 else None


def upcoming(events, now):
    cutoff = now - timedelta(days=UPCOMING_CUTOFF_DAYS)
    out = []
    for e in events:
        dt = parse_dt(e.get("start_time"))
        if dt is not None:
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            if dt >= cutoff:
                out.append(e)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--campus", required=True)
    ap.add_argument("--new", required=True, help="path to freshly-crawled events.jsonl")
    ap.add_argument("--old-ref", default="HEAD", help="git ref holding the previous version")
    ap.add_argument("--report", required=True, help="where to write the JSON report")
    ap.add_argument("--min-count", type=int, default=50)
    ap.add_argument("--min-upcoming-ratio", type=float, default=0.6)
    ap.add_argument("--report-only", action="store_true",
                    help="never exit non-zero; just write the report")
    args = ap.parse_args()

    now = datetime.now(timezone.utc)
    failures = []
    warnings = []

    new_path = Path(args.new)
    if not new_path.exists() or not new_path.read_text(encoding="utf-8").strip():
        failures.append(f"new file {args.new} is missing or empty")
        new_events, bad_lines = [], 0
    else:
        new_events, bad_lines = load_jsonl(new_path.read_text(encoding="utf-8"))
        if bad_lines:
            failures.append(f"{bad_lines} lines failed to parse as JSON")

    old_text = git_show(args.old_ref, args.new)
    old_events = load_jsonl(old_text)[0] if old_text else []
    if not old_events:
        warnings.append(f"no previous version at {args.old_ref}:{args.new}; skipping comparison checks")

    # --- schema ---
    all_fields = REQUIRED_FIELDS + CATEGORY_FLAGS
    missing_fields = Counter()
    for e in new_events:
        for f in all_fields:
            if f not in e:
                missing_fields[f] += 1
    if missing_fields:
        failures.append(f"missing required fields: {dict(missing_fields)}")

    # --- dates ---
    bad_dates = 0
    for e in new_events:
        start = parse_dt(e.get("start_time"))
        if start is None:
            bad_dates += 1
            continue
        if start.tzinfo is None:
            start = start.replace(tzinfo=timezone.utc)
        if start.year < 2020 or start > now + timedelta(days=730):
            bad_dates += 1
        if e.get("end_time") and parse_dt(e.get("end_time")) is None:
            bad_dates += 1
    if bad_dates:
        failures.append(f"{bad_dates} events with unparseable or implausible dates")

    # --- duplicate ids ---
    ids = Counter(e.get("id") for e in new_events)
    dupes = [i for i, c in ids.items() if c > 1]
    if dupes:
        failures.append(f"{len(dupes)} duplicate event ids (e.g. {dupes[:3]})")

    # --- absolute floor ---
    if len(new_events) < args.min_count:
        failures.append(f"only {len(new_events)} events (< {args.min_count} floor)")

    # --- data-loss guard: upcoming events must not drop sharply ---
    new_up = upcoming(new_events, now)
    old_up = upcoming(old_events, now)
    if old_up:
        floor = math.ceil(args.min_upcoming_ratio * len(old_up))
        if len(new_up) < floor:
            failures.append(
                f"upcoming events dropped {len(old_up)} -> {len(new_up)} "
                f"(below {args.min_upcoming_ratio:.0%} floor of {floor})"
            )

    # --- source-death guard ---
    new_sources = Counter(e.get("source_name") for e in new_events)
    old_sources = Counter(e.get("source_name") for e in old_events)
    if old_sources and len(new_sources) < len(old_sources) / 2:
        failures.append(f"distinct sources dropped {len(old_sources)} -> {len(new_sources)}")

    # --- report-only signals ---
    old_ids = {e.get("id") for e in old_events}
    new_ids = {e.get("id") for e in new_events}
    added = [e for e in new_events if e.get("id") not in old_ids]
    flagged = sum(1 for e in new_events if any(e.get(f) for f in CATEGORY_FLAGS))
    garbage_titles = sum(
        1 for e in new_events
        if not str(e.get("title") or "").strip() or len(str(e.get("title") or "")) > 300
    )
    if garbage_titles:
        warnings.append(f"{garbage_titles} events with empty or overlong titles")

    report = {
        "campus": args.campus,
        "generated_at": now.isoformat(),
        "passed": not failures,
        "failures": failures,
        "warnings": warnings,
        "counts": {
            "old_total": len(old_events),
            "new_total": len(new_events),
            "old_upcoming": len(old_up),
            "new_upcoming": len(new_up),
            "added": len(added),
            "removed": len(old_ids - new_ids),
        },
        "category_flag_coverage": round(flagged / len(new_events), 3) if new_events else 0,
        "sources_old": dict(old_sources.most_common()),
        "sources_new": dict(new_sources.most_common()),
        "sample_added_events": [
            {
                "title": e.get("title"),
                "start_time": e.get("start_time"),
                "source_name": e.get("source_name"),
                "categories": [f for f in CATEGORY_FLAGS if e.get(f)],
            }
            for e in added[:20]
        ],
    }
    report_path = Path(args.report)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

    print(f"[{args.campus}] {len(old_events)} -> {len(new_events)} events "
          f"(upcoming {len(old_up)} -> {len(new_up)}, +{len(added)} new)")
    for w in warnings:
        print(f"  WARN: {w}")
    for f in failures:
        print(f"  FAIL: {f}")
    if failures and not args.report_only:
        sys.exit(1)
    print(f"  {'REPORT-ONLY' if args.report_only else 'PASSED'}: report at {args.report}")


if __name__ == "__main__":
    main()
