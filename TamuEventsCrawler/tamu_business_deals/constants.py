from __future__ import annotations

from pathlib import Path


PACKAGE_ROOT = Path(__file__).resolve().parent
REPO_ROOT = PACKAGE_ROOT.parents[1]
BACKEND_ROOT = REPO_ROOT / "Backend"
BACKEND_DATA_ROOT = BACKEND_ROOT / "Data"

DEFAULT_SHEET_URL = (
    "https://docs.google.com/spreadsheets/d/"
    "1eFOmEOtSgyjXXYBlydmOgiGbwxh-R0UnCiDm7nZuMjk/"
    "htmlview/sheet?headers=true&gid=248840036"
)

OUTPUT_ROOT = PACKAGE_ROOT / "output"
CATALOG_OUTPUT_CSV = OUTPUT_ROOT / "local_businesses.csv"
CATALOG_OUTPUT_JSON = OUTPUT_ROOT / "local_businesses.json"
DEALS_OUTPUT_JSON = OUTPUT_ROOT / "business_deals.json"
DEALS_OUTPUT_JSONL = OUTPUT_ROOT / "business_deals.jsonl"
DEALS_OUTPUT_CSV = OUTPUT_ROOT / "business_deals.csv"
SOURCE_MAP_OUTPUT = OUTPUT_ROOT / "next_sources.md"

OSM_JSON_CANDIDATES = (
    BACKEND_DATA_ROOT / "osm_places_tamu_10mi.json",
    REPO_ROOT / "Frontend" / "data" / "osm_places_tamu_10mi.json",
)
