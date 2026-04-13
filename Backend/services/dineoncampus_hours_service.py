"""
Fetch today's meal/service windows from DineOnCampus (apiv4) for TAMU dining halls.
Used by campus_places_service so Places tab shows live schedule data, not static tables.
"""

from __future__ import annotations

import re
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

import requests
import warnings

try:
    from urllib3.exceptions import InsecureRequestWarning

    warnings.filterwarnings("ignore", category=InsecureRequestWarning)
except Exception:
    pass

# Minimal copy of dining_service HTTP behavior (avoid importing dining_service / db at import time)
API_BASE = "https://apiv4.dineoncampus.com"
DINE_API_HOST = "apiv4.dineoncampus.com"
DINE_API_IP_FALLBACK = "206.82.192.172"
HEADERS = {
    "User-Agent": "Mozilla/5.0 MaroonSchedules/1.0 (places map hours)",
    "Accept": "application/json, text/plain, */*",
    "Origin": "https://dineoncampus.com",
    "Referer": "https://dineoncampus.com/",
}

# Registry place_id -> exact key in dining_service.DINING_LOCATIONS
PLACE_ID_TO_DINE_LOCATION_NAME: Dict[str, str] = {
    "commons": "The Commons Dining Hall (South Campus)",
    "sbisa": "Sbisa Dining Hall (North Campus)",
    "duncan": "Duncan Dining Hall (South Campus/Quad)",
    "west-campus-dining": "Chick-fil-A - West Campus Food Hall",
    "msc": "Panda Express - MSC",
    "polo-garage-food": "Panda Express - Polo Garage",
    "underground-food": "Pizza @ Underground",
}

# location name -> Mongo-style id (subset of dining_service.DINING_LOCATIONS)
DINING_LOCATION_IDS: Dict[str, str] = {
    "The Commons Dining Hall (South Campus)": "59972586ee596fe55d2eef75",
    "Sbisa Dining Hall (North Campus)": "587909deee596f31cedc179c",
    "Duncan Dining Hall (South Campus/Quad)": "5878eb5cee596f847636f114",
    "Chick-fil-A - West Campus Food Hall": "586d0bf1ee596f6e75049511",
    "Panda Express - MSC": "586d0bf1ee596f6e75049513",
    "Panda Express - Polo Garage": "5ff34e653a585b113c081c17",
    "Pizza @ Underground": "5873c5f33191a200e44eba3c",
}


def _dine_get(path: str, *, params: Optional[Dict[str, Any]] = None):
    attempts = [
        (f"{API_BASE}{path}", dict(HEADERS), True),
        (f"https://{DINE_API_IP_FALLBACK}{path}", {**HEADERS, "Host": DINE_API_HOST}, False),
    ]
    last_error = None
    for url, headers, verify in attempts:
        try:
            resp = requests.get(url, headers=headers, params=params, timeout=12, verify=verify)
            if resp.status_code == 200:
                return resp
            last_error = f"HTTP {resp.status_code}"
        except requests.RequestException as exc:
            last_error = str(exc)
    raise requests.RequestException(last_error or "DineOnCampus request failed")


def _resolve_location_id(place_id: str) -> Optional[str]:
    name = PLACE_ID_TO_DINE_LOCATION_NAME.get(place_id)
    if not name:
        return None
    return DINING_LOCATION_IDS.get(name)


def _short_time(value: Any) -> str:
    if value is None:
        return ""
    s = str(value).strip()
    if not s:
        return ""
    m = re.match(r"^(\d{1,2}):(\d{2})(?::(\d{2}))?", s)
    if m:
        h, mi = int(m.group(1)), int(m.group(2))
        ampm = "AM" if h < 12 or h == 24 else "PM"
        h12 = h % 12
        if h12 == 0:
            h12 = 12
        return f"{h12}:{mi:02d} {ampm}"
    if "T" in s:
        try:
            dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
            return dt.strftime("%I:%M %p").lstrip("0")
        except ValueError:
            pass
    return s


def _parse_periods_list(data: Dict[str, Any]) -> List[Dict[str, Any]]:
    periods = data.get("periods") or data.get("data") or []
    if isinstance(periods, dict):
        periods = list(periods.values()) if periods else []
    return periods if isinstance(periods, list) else []


def _analyze_periods(periods: List[Dict[str, Any]]) -> Tuple[Optional[str], List[str]]:
    """
    Returns (line with clock times if any, ordered period display names).
    When DineOnCampus omits start/end, period names still reflect what is open today.
    """
    if not periods:
        return None, []
    time_chunks: List[str] = []
    names: List[str] = []
    for p in periods:
        name = (p.get("name") or p.get("slug") or "").strip() or "Meal"
        if name.lower() not in {n.lower() for n in names}:
            names.append(name)
        start = (
            p.get("startTime")
            or p.get("start_time")
            or p.get("start")
            or p.get("from")
        )
        end = p.get("endTime") or p.get("end_time") or p.get("end") or p.get("to")
        st = _short_time(start)
        en = _short_time(end)
        if st and en:
            time_chunks.append(f"{name}: {st} – {en}")
    if time_chunks:
        return "; ".join(time_chunks[:8]), names
    return None, names


def fetch_dining_periods_summary(place_id: str, date_str: str) -> Optional[Dict[str, Any]]:
    """
    Live DineOnCampus periods for date_str (YYYY-MM-DD, Central calendar date).
    {"line_with_times": str|None, "period_names": [...]}
    """
    loc_id = _resolve_location_id(place_id)
    if not loc_id:
        return None
    try:
        resp = _dine_get(f"/locations/{loc_id}/periods/", params={"date": date_str})
        data = resp.json()
        periods = _parse_periods_list(data)
        line, names = _analyze_periods(periods)
        return {"line_with_times": line, "period_names": names}
    except Exception as exc:
        print(f"[dineoncampus_hours_service] periods fetch failed for {place_id}: {exc}")
        return None


def fetch_hours_line_for_place_id(place_id: str, date_str: str) -> Optional[str]:
    """Backward-compatible one-line string (times only, or joined period names)."""
    summary = fetch_dining_periods_summary(place_id, date_str)
    if not summary:
        return None
    if summary.get("line_with_times"):
        return summary["line_with_times"]
    names = summary.get("period_names") or []
    if names:
        return ", ".join(names)
    return None
