
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

# Semester ends approx May 15
END_DATE = date(2026, 5, 15)

db_lock = Lock()

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

def scrape_all():
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
    
    today = date.today()
    delta = (END_DATE - today).days
    dates = [today + timedelta(days=i) for i in range(delta + 1)]
    print(f"[scraper] Scraping for {len(dates)} days ({today} to {END_DATE})")
    
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
    scrape_all()
