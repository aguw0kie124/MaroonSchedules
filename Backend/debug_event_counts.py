import json
from pathlib import Path
from datetime import datetime, timezone, timedelta

def parse_iso(dt_str):
    if not dt_str: return None
    return datetime.fromisoformat(dt_str.replace('Z', '+00:00'))

def main():
    events_file = Path('TamuEventsCrawler/data/normalized/events.jsonl')
    if not events_file.exists():
        print("Events file not found")
        return

    now = datetime.now(timezone.utc)
    now_ts = now.timestamp()
    
    counts = {
        'Featured': 0, 'For U': 0, 'Sports': 0, 'Academic': 0, 'Food': 0,
        'Social': 0, 'Health & Wellness': 0, 'Entertainment': 0, 'Advocacy': 0, 'Miscellaneous': 0
    }
    
    total = 0
    upcoming = 0
    
    with open(events_file, 'r') as f:
        for line in f:
            event = json.loads(line)
            total += 1
            start_time = parse_iso(event.get('start_time'))
            end_time = parse_iso(event.get('end_time'))
            
            # Simple upcoming check matching frontend logic (roughly)
            in_window = False
            if end_time and end_time.timestamp() > now_ts:
                in_window = True
            elif start_time and start_time.timestamp() >= now_ts - 7200:
                in_window = True
            
            if not in_window: continue
            upcoming += 1
            
            # Categories check
            if event.get('sports') == 1: counts['Sports'] += 1
            if event.get('academic') == 1: counts['Academic'] += 1
            if event.get('food') == 1: counts['Food'] += 1
            if event.get('social') == 1: counts['Social'] += 1
            if event.get('advocacy') == 1: counts['Advocacy'] += 1
            if event.get('entertainment') == 1: counts['Entertainment'] += 1
            if event.get('health_wellness') == 1: counts['Health & Wellness'] += 1

    print(f"Total events in file: {total}")
    print(f"Upcoming events in file: {upcoming}")
    print(f"Category counts for upcoming: {counts}")

if __name__ == "__main__":
    main()
