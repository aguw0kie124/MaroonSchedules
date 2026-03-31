"""Find food events — v2 with food-type display and confidence filtering."""
import json
import sys
from pathlib import Path

# Optional: minimum confidence from CLI
min_conf = float(sys.argv[1]) if len(sys.argv) > 1 else 0.0

output = Path("data/normalized/events.jsonl")
if output.exists():
    lines = output.read_text(encoding="utf-8").strip().split("\n")
    events = [json.loads(line) for line in lines if line.strip()]
    food_events = [
        e for e in events
        if e.get("has_food") and e.get("food_confidence", 0) >= min_conf
    ]
    # Sort by confidence
    food_events.sort(key=lambda x: -x.get("food_confidence", 0))

    print(f"Detected {len(food_events)} food events out of {len(events)} total.")
    if min_conf > 0:
        print(f"(Filtered to confidence >= {min_conf:.2f})")
    print()
    for e in food_events[:20]:
        ft = e.get("food_type", "unknown")
        ft_label = f" [{ft}]" if ft != "unknown" else ""
        src_seen = e.get("sources_seen", 1)
        multi = f" (seen in {src_seen} sources)" if src_seen > 1 else ""
        print(f"[{e['food_confidence']:.2f}]{ft_label} {e['title'][:65]}{multi}")
        print(f"      Reasons: {', '.join(e['food_reasons'][:4])}")
        print(f"      Source: {e['source_name']}")
        if e.get("duration_minutes"):
            print(f"      Duration: {e['duration_minutes']} min")
        print()
else:
    print("No events.jsonl found.")
