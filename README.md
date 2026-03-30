# TAMU Campus Events Crawler v3

A production-ready Python crawler that scrapes **all** Texas A&M University (College Station) events — 48+ sources including LiveWhale calendars, GetInvolved, McFerrin entrepreneurship, Mays Business, Career Center, Engineering seminars, student orgs, and more.

## Features

- **48+ source ingestion** — LiveWhale JSON APIs, HTML pages, RSS feeds, program pages
- **8 binary category flags** — social, sports, academic, food, advocacy, entertainment, health_wellness, religion
- **Two-stage food detection** — Stage A (high recall) + Stage B (precision filtering)
- **Department mapping** — 40+ TAMU departments/schools with code + name inference
- **Source traceability** — every event stores source_links, crawl_path, discovered_via
- **Cross-source deduplication** — title similarity + datetime window + location fuzzy match
- **MAX_DEPTH = 2 link following** — surgical crawling: seed → links → sub-links
- **Polite crawling** — robots.txt compliance, 1 req/sec per domain, exponential backoff
- **Missing event diagnostics** — `diagnose --query "Good Bull Pitch"`
- **CSV summaries** — breakdowns by source, department, category, food confidence
- **College Station filter** — automatically skips Galveston, Qatar, online-only events

## Quick Start

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Dry run (no HTTP requests)
python crawler.py crawl --dry-run

# 3. Full crawl (all 48+ sources)
python crawler.py crawl --all

# 4. Crawl a single source
python crawler.py crawl --source=mcferrin_programs

# 5. Food events only
python crawler.py crawl --food-only --confidence=0.7

# 6. View stats
python crawler.py stats

# 7. Debug missing events
python crawler.py diagnose --query "Good Bull Pitch"

# 8. Rebuild CSV summaries
python crawler.py rebuild-index

# 9. Run tests
python -m pytest tests/ -v
```

## Output

### JSONL Events

Events are written to `data/normalized/events.jsonl` — one JSON object per line:

```json
{
  "id": "tamu:livewhale:12345",
  "title": "Free Pizza Night at MSC",
  "start_time": "2026-04-01T18:00:00",
  "location": "MSC 2502",
  "department_code": "MSC",
  "department_name": "Memorial Student Center",
  "social": 1,
  "food": 1,
  "academic": 0,
  "sports": 0,
  "advocacy": 0,
  "entertainment": 0,
  "health_wellness": 0,
  "religion": 0,
  "has_food": true,
  "food_confidence": 0.95,
  "food_reasons": ["explicit:free pizza", "food_org:msc"],
  "food_type": "snacks",
  "source_links": ["https://calendar.tamu.edu/...", "https://getinvolved.tamu.edu/event/123"],
  "crawl_path": ["https://calendar.tamu.edu/", "https://calendar.tamu.edu/event/12345"],
  "category_reasons": ["food:title:pizza", "social:title:night"]
}
```

### CSV Summaries

Generated in `output/`:
- `summary_by_source.csv`
- `summary_by_department.csv`
- `summary_by_category.csv`
- `summary_by_food_confidence.csv`
- `summary_by_campus.csv`
- `summary_by_host_type.csv`
- `summary_by_food_type.csv`
- `source_health.csv`

## Architecture

```
crawler.py                ← CLI (Click) — orchestrates pipeline
├── sources.yaml          ← Source registry (48+ sources)
├── models.py             ← Pydantic Event model + SourceConfig
├── http_client.py        ← Async httpx (rate limit, robots.txt, ETag)
├── state.py              ← Incremental crawl state (JSON)
├── normalizer.py         ← Raw → Event (filters + classifiers + mappers)
├── deduper.py            ← Cross-source dedup (rapidfuzz)
├── food_detector.py      ← Two-stage free-food scoring
├── output_csv.py         ← CSV summary generation
├── parsers/
│   ├── livewhale.py      ← LiveWhale JSON API parser
│   ├── getinvolved.py    ← GetInvolved HTML events + orgs
│   ├── html_generic.py   ← Generic HTML + multi-URL (McFerrin, Mays, etc.)
│   └── rss.py            ← RSS feed discovery + parsing
├── classifiers/
│   ├── category_classifier.py  ← 8-category deterministic classifier
│   └── category_rules.yaml     ← Config-driven keyword rules
├── mappers/
│   ├── department_mapper.py    ← Department code/name inference
│   └── departments.yaml        ← 40+ department mappings
├── diagnostics/
│   └── missing_event.py        ← Missing event debug tool
├── tests/
│   ├── test_food_detector.py
│   ├── test_category_classifier.py
│   ├── test_department_mapper.py
│   ├── test_normalizer.py
│   └── test_deduper.py
└── data/
    ├── raw/              ← Cached raw API responses
    ├── normalized/       ← events.jsonl output
    └── state/            ← crawl_state.json
```

## Pipeline Flow

```
Sources → HTTP Fetch → Parse → Normalise → Categories → Food Detect → Dedup → JSONL + CSV
```

1. Load 48+ sources from `sources.yaml`
2. Fetch each URL (rate-limited, robots.txt checked, conditional requests)
3. Parse via type-specific parser (LiveWhale JSON, HTML cards, RSS, multi-URL)
4. Normalise to `Event` model (campus filter, undergrad filter)
5. Classify into 8 binary categories
6. Map department code + name
7. Score food likelihood (two-stage: recall → precision)
8. Deduplicate across all sources
9. Write JSONL + generate CSV summaries

## Source Types

| Type | Description | Example |
|------|-------------|---------|
| `livewhale_json` | LiveWhale JSON API | TAMU calendars |
| `html_events` | Single HTML page with event cards | McFerrin events, Career Center |
| `html_multi_url` | Multi-URL with depth-2 link following | McFerrin programs (25 pages) |
| `html_pagination` | Paginated HTML | GetInvolved orgs |
| `html_search` | Search query source | GetInvolved event search |
| `rss_directory` | RSS feed discovery + parsing | calendar.tamu.edu/feeds/ |

## Category Flags

Each event has 8 binary flags (0 or 1):

| Flag | Examples |
|------|----------|
| `social` | mixer, game night, welcome, meet & greet |
| `sports` | intramural, rec sports, tailgate, watch party |
| `academic` | seminar, colloquium, workshop, pitch competition |
| `food` | free food, pizza, catered, lunch provided |
| `advocacy` | volunteer, voter registration, awareness, service |
| `entertainment` | concert, movie night, trivia, open mic |
| `health_wellness` | mental health, meditation, blood drive, wellness |
| `religion` | bible study, worship, prayer, interfaith |

## Food Detection (Two-Stage)

### Stage A: Candidate Generation (High Recall)

| Tier | Examples | Base Score |
|------|----------|------------|
| Explicit | "free food", "food provided", "catered lunch" | 0.95 |
| High | pizza, lunch, dinner, crawfish boil | 0.90 |
| Academic | colloquium, candidate talk, thesis defense | 0.80 |
| Medium | reception, mixer, info session, open house | 0.55 |
| Low | social, welcome, tailgate, gathering | 0.30 |

### Stage B: Precision Filtering

- **word-boundary safe**: "tea" ≠ "team", "teaching", "Texas"
- **≥2 cues required** for medium-confidence keywords
- **Seminar alone** → suppressed (needs explicit food cue)
- **Virtual/online** → automatic 0 (unless food in title)
- **Source priors**: McFerrin +0.15, Career Center +0.15, MSC +0.10

## Diagnostics

Debug why specific events are missing:

```bash
python crawler.py diagnose --query "Good Bull Pitch"
```

Reports:
- Fuzzy matches in crawled events
- Matches in raw cached pages
- McFerrin program page status
- Source coverage analysis
- Possible reasons + recommendations

## Configuration

| Setting | Default | Location |
|---------|---------|----------|
| Rate limit | 1 req/sec/domain | `http_client.py` |
| Max crawl depth | 2 hops | `parsers/html_generic.py` |
| Title dedup threshold | 85% | `deduper.py` |
| Time window for dedup | ±2 hours | `deduper.py` |
| Food detection cutoff | 0.30 | `food_detector.py` |
| Max RSS feeds | 20 | `parsers/rss.py` |
| Max org pages | 50 | `sources.yaml` |

## License

MIT
