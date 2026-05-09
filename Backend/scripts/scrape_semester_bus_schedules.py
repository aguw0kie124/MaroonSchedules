import argparse
import os
import sys
import json
import re
import requests
from datetime import datetime, timedelta, date
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from threading import Lock

# Add backend to path
sys.path.append(str(Path(__file__).resolve().parent.parent))

from db_config import get_pool
from routers.traffic import transit_proxy

BASE_URL = "https://aggiespirit.ts.tamu.edu"
DEFAULT_LOOKAHEAD_DAYS = 45
ENV_END_DATE = "TRANSIT_SCRAPE_END_DATE"
ENV_DAYS_AHEAD = "TRANSIT_SCRAPE_DAYS_AHEAD"

db_lock = Lock()


def parse_args():
    parser = argparse.ArgumentParser(
        description="Scrape AggieSpirit stop schedules into transit_stop_schedules."
    )
    parser.add_argument(
        "--start-date",
        help="Override the scrape start date in YYYY-MM-DD format. Defaults to today.",
    )
    parser.add_argument(
        "--end-date",
        help="Override the scrape end date in YYYY-MM-DD format.",
    )
    parser.add_argument(
        "--days-ahead",
        type=int,
        help=(
            "Scrape this many days ahead from the start date when --end-date is not set. "
            f"Defaults to {DEFAULT_LOOKAHEAD_DAYS}."
        ),
    )
    return parser.parse_args()


def _parse_iso_date(raw_value, label):
    try:
        return datetime.strptime(str(raw_value).strip(), "%Y-%m-%d").date()
    except ValueError as exc:
        raise ValueError(f"Invalid {label}: {raw_value!r}. Expected YYYY-MM-DD.") from exc


def resolve_scrape_window(args):
    start_date = (
        _parse_iso_date(args.start_date, "--start-date")
        if args.start_date
        else date.today()
    )

    env_end_date = os.getenv(ENV_END_DATE, "").strip()
    env_days_ahead = os.getenv(ENV_DAYS_AHEAD, "").strip()

    if args.end_date:
        end_date = _parse_iso_date(args.end_date, "--end-date")
        source = "cli:end-date"
    elif env_end_date:
        end_date = _parse_iso_date(env_end_date, ENV_END_DATE)
        source = f"env:{ENV_END_DATE}"
    else:
        days_ahead = args.days_ahead
        source = "cli:days-ahead"
        if days_ahead is None and env_days_ahead:
            try:
                days_ahead = int(env_days_ahead)
            except ValueError as exc:
                raise ValueError(
                    f"Invalid {ENV_DAYS_AHEAD}: {env_days_ahead!r}. Expected an integer."
                ) from exc
            source = f"env:{ENV_DAYS_AHEAD}"
        if days_ahead is None:
            days_ahead = DEFAULT_LOOKAHEAD_DAYS
            source = f"default:{DEFAULT_LOOKAHEAD_DAYS}d"
        if days_ahead < 0:
            raise ValueError("days-ahead must be greater than or equal to 0.")
        end_date = start_date + timedelta(days=days_ahead)

    if end_date < start_date:
        raise ValueError(
            f"Scrape end date {end_date} cannot be earlier than start date {start_date}."
        )

    return start_date, end_date, source

def get_session():
    session = requests.Session()
    # Get CSRF tokens
    try:
        r = session.get(f"{BASE_URL}/RouteMap")
        html = r.text
        html_token_match = re.search(r'name="__RequestVerificationToken" type="hidden" value="([^"]+)"', html)
        cookie_token = session.cookies.get(".MyRide.RequestVerificationToken")
        
        if html_token_match and cookie_token:
            headers = {
                "requestverificationtoken": f"{cookie_token}:{html_token_match.group(1)}",
                "X-Requested-With": "XMLHttpRequest",
                "Content-Type": "application/json"
            }
            return session, headers
    except Exception as e:
        print(f"[scraper] Session init error: {e}")
    return None, None

def fetch_stop_schedule(session, headers, route_number, stop_code, direction_name, target_date, retries=3):
    path = "/Schedule/GetStopSchedules"
    payload = {
        "routeNumber": route_number,
        "stopCode": stop_code,
        "directionName": direction_name,
        "date": target_date.strftime("%Y-%m-%d")
    }
    
    for attempt in range(retries):
        try:
            resp = session.post(f"{BASE_URL}{path}", headers=headers, json=payload, timeout=15)
            if resp.status_code == 200:
                return resp.json()
            if resp.status_code in [401, 403]:
                # Token might have expired, re-init session
                print(f"[scraper] Token expired, re-initializing session...")
                new_session, new_headers = get_session()
                if new_session:
                    session, headers = new_session, new_headers
        except Exception as e:
            if attempt == retries - 1:
                print(f"[scraper] Fetch error for {route_number} {stop_code} on {target_date}: {e}")
    return None

def process_triplet_day(route_number, route_short_name, stop_code, direction_name, target_date, session, headers):
    data = fetch_stop_schedule(session, headers, route_short_name, stop_code, direction_name, target_date)
    if not data or "routeStopSchedules" not in data:
        return 0
    
    rows = []
    for schedule in data["routeStopSchedules"]:
        # Verify it matches our request to avoid mixups
        if schedule.get("routeNumber") != route_short_name:
            continue
            
        for stop_time in schedule.get("stopTimes", []):
            scheduled_str = stop_time.get("scheduledDepartTimeUtc")
            if not scheduled_str:
                continue
            
            # Formatted typically like "2026-04-16T12:11:00Z"
            rows.append((
                route_short_name,
                stop_code,
                direction_name,
                scheduled_str,
                True, # is_departure
                stop_time.get("tripPointId"),
            ))
            
    if rows:
        with db_lock:
            pool = get_pool()
            with pool.connection() as conn:
                with conn.cursor() as cur:
                    # Use ON CONFLICT DO NOTHING to handle duplicates gracefully
                    cur.executemany("""
                        INSERT INTO transit_stop_schedules (route_number, stop_code, direction_name, scheduled_time, is_departure, trip_point_id)
                        VALUES (%s, %s, %s, %s, %s, %s)
                        ON CONFLICT (route_number, stop_code, direction_name, scheduled_time) DO NOTHING
                    """, rows)
                    conn.commit()
    return len(rows)

def scrape_all(start_date, end_date):
    routes = transit_proxy.get_routes()
    active_labels = set(transit_proxy.get_active_routes())
    
    # Filter for active routes only to save time
    active_routes = [r for r in routes if r['ShortName'] in active_labels or r['Key'] in active_labels]
    print(f"[scraper] Found {len(active_routes)} active routes.")
    
    # Build a list of all unique (route_short_name, stop_code, direction_name)
    triplets = []
    for r in active_routes:
        print(f"[scraper] Fetching pattern for Route {r['ShortName']}...")
        pattern = transit_proxy.get_pattern(r['Key'])
        stops = pattern.get('stops', [])
        seen = set()
        for s in stops:
            scade = s.get('StopCode')
            dname = s.get('DirectionName')
            if scade and dname:
                pair = (r['ShortName'], scade, dname)
                if pair not in seen:
                    triplets.append(pair)
                    seen.add(pair)
                    
    print(f"[scraper] Total stop/direction triplets to scrape: {len(triplets)}")
    
    delta = (end_date - start_date).days
    dates = [start_date + timedelta(days=i) for i in range(delta + 1)]
    print(f"[scraper] Scraping for {len(dates)} days ({start_date} to {end_date})")
    
    tasks = []
    for d in dates:
        for t in triplets:
            tasks.append((t[0], t[1], t[2], d))
            
    print(f"[scraper] Total sub-tasks: {len(tasks)}")
    
    # Using multiple sessions to stay within limits and handle timeouts
    num_sessions = 8
    sessions_pool = [get_session() for _ in range(num_sessions)]
    
    def worker(task_idx):
        rsn, scade, dname, d = tasks[task_idx]
        session, headers = sessions_pool[task_idx % num_sessions]
        if not session:
            return 0
        return process_triplet_day(None, rsn, scade, dname, d, session, headers)

    total_inserted = 0
    with ThreadPoolExecutor(max_workers=16) as executor:
        futures = {executor.submit(worker, i): i for i in range(len(tasks))}
        for i, future in enumerate(as_completed(futures)):
            inserted = future.result()
            total_inserted += inserted
            if (i + 1) % 100 == 0:
                print(f"[scraper] Progress: {i+1}/{len(tasks)} tasks done. Total stop-times: {total_inserted}")
                
    print(f"[scraper] Finished. Inserted {total_inserted} stop-times.")

if __name__ == "__main__":
    try:
        cli_args = parse_args()
        start_date, end_date, window_source = resolve_scrape_window(cli_args)
        print(
            f"[scraper] Resolved scrape window: {start_date} to {end_date} "
            f"({window_source})"
        )
        scrape_all(start_date, end_date)
    except ValueError as exc:
        print(f"[scraper] {exc}")
        raise SystemExit(1)
