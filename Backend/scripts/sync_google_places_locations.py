"""
One-time offline sync:
- Uses Google Places Nearby Search + Place Details to resolve:
  - google `place_id` for each known spot
  - corrected marker coordinates (lat/lng)

Output is designed for manual application into:
  Backend/routers/traffic.py -> LOCATION_DATA

Run:
  cd Backend
  python3 scripts/sync_google_places_locations.py
"""

from __future__ import annotations

import json
import os
import sys
import time
from typing import Any, Dict, Tuple

from dotenv import load_dotenv

# Ensure `Backend/` is on sys.path so we can import routers.*.
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND_DIR)

from routers.traffic import LOCATION_DATA  # noqa: E402
from services.google_places import resolve_place_for_location  # noqa: E402


def main() -> None:
    env_path = os.path.join(BACKEND_DIR, ".env")
    load_dotenv(dotenv_path=env_path, override=True)

    # Key validation is done in google_places.* when requests happen.
    output: Dict[str, Any] = {}
    errors: Dict[str, str] = {}

    # Deterministic ordering
    items = sorted(LOCATION_DATA.items(), key=lambda kv: kv[0])
    for name, meta in items:
        location_type = meta.get("type") or ""
        lat = float(meta["lat"])
        lng = float(meta["lng"])

        print(f"[sync] Resolving: {name} ({location_type}) near ({lat},{lng})")
        try:
            resolved = resolve_place_for_location(
                location_name=name,
                location_type=location_type,
                lat=lat,
                lng=lng,
            )

            output[name] = {
                "google_place_id": resolved.get("place_id"),
                "coord": {
                    "lat": resolved.get("resolved_lat"),
                    "lng": resolved.get("resolved_lng"),
                },
                "resolved_name": resolved.get("resolved_name"),
            }

            # Be nice to quota / API usage
            time.sleep(0.2)
        except Exception as e:
            errors[name] = str(e)
            print(f"[sync] ERROR: {name}: {e}")

    result = {"updates": output, "errors": errors}
    print("\n===SYNC_RESULT_JSON===\n")
    print(json.dumps(result, indent=2, ensure_ascii=False))

    # Also write to a local file for convenience.
    out_file = os.path.join(BACKEND_DIR, ".cache", "google_places_sync_result.json")
    os.makedirs(os.path.dirname(out_file), exist_ok=True)
    with open(out_file, "w", encoding="utf-8") as f:
        f.write(json.dumps(result, indent=2, ensure_ascii=False))

    print(f"\nWrote sync output to: {out_file}")


if __name__ == "__main__":
    main()

