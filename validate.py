"""Quick validation script for crawl output — v2."""
import json
from pathlib import Path
from collections import Counter

output = Path("data/normalized/events.jsonl")
if not output.exists():
    print("ERROR: events.jsonl not found — run 'python crawler.py crawl' first")
    exit(1)

lines = output.read_text(encoding="utf-8").strip().split("\n")
events = [json.loads(line) for line in lines if line.strip()]

print(f"Total events: {len(events)}")

food_events = [e for e in events if e.get("has_food")]
high_food = [e for e in food_events if e.get("food_confidence", 0) >= 0.8]
print(f"Food events (any match): {len(food_events)}")
print(f"Food events (high confidence >=0.8): {len(high_food)}")

# Food type distribution
food_types = Counter(e.get("food_type", "unknown") for e in food_events)
if food_types:
    print(f"\nFood type breakdown:")
    for ft, count in food_types.most_common():
        print(f"  {ft:15s} {count:>4}")

sources = Counter(e["source_name"] for e in events)
print(f"\nEvents per source:")
for name, count in sources.most_common():
    print(f"  {name:30s} {count:>5}")

print(f"\nSample food events:")
for e in high_food[:5]:
    ft = e.get('food_type', '')
    ft_label = f" [{ft}]" if ft and ft != 'unknown' else ""
    print(f"  [{e['food_confidence']:.0%}]{ft_label} {e['title'][:65]}")
    if e.get("location"):
        print(f"       Location: {e['location']}")
    print(f"       Reasons: {', '.join(e.get('food_reasons', [])[:3])}")

print(f"\nSample non-food events:")
for e in [ev for ev in events if not ev.get("has_food")][:3]:
    print(f"  {e['title'][:70]}")

# Validate schema
print(f"\nSchema validation:")
required_fields = [
    "id", "title", "start_time", "source_name", "has_food",
    "content_hash", "food_type", "student_org_prob", "sources_seen",
]
missing = []
for field in required_fields:
    if not all(field in e for e in events):
        missing.append(field)
if missing:
    print(f"  MISSING: {missing}")
else:
    print(f"  All {len(required_fields)} required fields present [OK]")

assert len(events) >= 50, f"Expected 50+ events, got {len(events)}"
print(f"\nPASSED: {len(events)} events, {len(food_events)} food events")
