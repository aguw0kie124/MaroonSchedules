import os
from pathlib import Path

# Simulate campus_events_service path resolution
path = Path('/Users/shreyaannath/Programming/MaroonSchedules/Backend/services/campus_events_service.py')
root = path.resolve().parents[2]
crawler_output = root / "TamuEventsCrawler" / "data" / "normalized" / "events.jsonl"

print(f"File path: {path}")
print(f"Root path: {root}")
print(f"Crawler output path: {crawler_output}")
print(f"Exists: {crawler_output.exists()}")
if crawler_output.exists():
    print(f"Size: {crawler_output.stat().st_size}")
