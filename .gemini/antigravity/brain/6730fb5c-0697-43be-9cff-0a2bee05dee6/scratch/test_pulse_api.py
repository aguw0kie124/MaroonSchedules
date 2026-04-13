import sys
import os
from pathlib import Path
import json

# Add Backend to path
backend_path = Path(__file__).resolve().parent.parent.parent.parent.parent / "Programming" / "MaroonSchedules" / "Backend"
if not backend_path.exists():
     # Fallback to local relative path if on the same drive
     backend_path = Path.cwd()

sys.path.append(str(backend_path))

try:
    from services import pulse_service
    # No clerk_id to bypass personalization/tag issues for now
    result = pulse_service.get_pulse_map(limit=10, clerk_id=None)
    print("Pulse Map Response Status:", result.get("status"))
    print(f"Hotspots Found: {len(result.get('hotspots', []))}")
    if result.get('hotspots'):
        for h in result['hotspots'][:3]:
            print(f"- {h['locationName']}: Score {h['score']}, Pings {h['pingCount']}")
except Exception as e:
    import traceback
    print(f"Error calling get_pulse_map: {e}")
    traceback.print_exc()
