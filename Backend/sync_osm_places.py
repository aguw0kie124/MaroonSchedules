from __future__ import annotations

import os
import shutil
import sys


BACKEND_ROOT = os.path.dirname(os.path.abspath(__file__))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from services import osm_places_service

FRONTEND_COPY_PATH = os.path.join(
    os.path.dirname(BACKEND_ROOT),
    "Frontend",
    "data",
    "osm_places_tamu_10mi.json",
)


def main() -> None:
    payload = osm_places_service.sync_places_payload()
    path = osm_places_service.OSM_PLACE_DATA_PATH
    os.makedirs(os.path.dirname(FRONTEND_COPY_PATH), exist_ok=True)
    shutil.copyfile(path, FRONTEND_COPY_PATH)
    print(f"Synced {payload.get('count', 0)} OSM places to {path}")
    print(f"Copied frontend search dataset to {FRONTEND_COPY_PATH}")


if __name__ == "__main__":
    main()
