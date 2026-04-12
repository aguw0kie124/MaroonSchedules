from __future__ import annotations
"""Direct test of get_events_snapshot to verify admin events are present."""
import sys
import json
from services import campus_hub_service

result = campus_hub_service.get_events_snapshot(
    clerk_id=None,
    limit=50,
    student_relevant_only=False,
    campus="tamu",
)

events = result.get("events", []) if isinstance(result, dict) else result
admin_events = [e for e in events if e.get("is_admin_event")]
total = len(events)
admin_count = len(admin_events)

print(f"Total events returned: {total}")
print(f"Admin events returned: {admin_count}")

for e in admin_events:
    print(f"  ADMIN: {e.get('title')} | date_ts={e.get('date_ts')} | start={e.get('start_time')}")

if admin_count == 0:
    print("\n!!! NO ADMIN EVENTS FOUND - checking diagnostic...")
    diag = [e for e in events if "diag" in str(e.get("event_id", "")).lower()]
    print(f"  Diagnostic events found: {len(diag)}")
    
# Also check the raw DB query
print("\n--- Raw DB check ---")
from services.campus_hub_service import _safe_db_fetchall
raw = _safe_db_fetchall("SELECT id, title, start_time FROM admin_events LIMIT 5")
print(f"admin_events rows in DB: {len(raw)}")
for r in raw:
    print(f"  DB Row: id={r.get('id')} title={r.get('title')} start={r.get('start_time')}")
