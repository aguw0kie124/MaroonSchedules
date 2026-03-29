# TAMU Campus Events Crawler

A production-ready Python crawler that scrapes all Texas A&M University (College Station) events, prioritises free-food events for the mobile app, and outputs normalised JSONL.

## Features

- **Multi-source ingestion** — LiveWhale JSON APIs, HTML pages (GetInvolved), RSS feeds
- **Aggressive free-food detection** — 3-tier keyword scoring with pattern & org boosts
- **Cross-source deduplication** — title similarity + datetime window + location fuzzy match
- **Incremental crawls** — ETag / If-Modified-Since conditional requests
- **Polite crawling** — robots.txt compliance, 1 req/sec per domain, exponential backoff
- **College Station filter** — automatically skips Galveston, Qatar, online-only events
- **Structured logging** — file + console with per-source stats
- **State management** — persistent JSON state for incremental runs

## Quick Start

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Dry run (no HTTP requests)
python crawler.py crawl --dry-run

# 3. Full crawl
python crawler.py crawl --all

# 4. Crawl a single source
python crawler.py crawl --source=main_calendar

# 5. View stats
python crawler.py stats
```

## Output

Events are written to `data/normalized/events.jsonl` — one JSON object per line, sorted by food confidence (highest first), then freshness.

```json
{
  "id": "tamu:livewhale:12345",
  "title": "Free Pizza Night at MSC",
  "start_time": "2026-04-01T18:00:00",
  "location": "MSC 2502",
  "has_food": true,
  "food_confidence": 0.95,
  "food_reasons": ["high_keyword:free pizza", "food_org:msc"],
  ...
}
```

## Architecture

```
crawler.py          ← CLI (Click) — orchestrates the pipeline
├── sources.yaml    ← Source registry
├── models.py       ← Pydantic Event model + SourceConfig
├── http_client.py  ← Async httpx client (rate limit, robots.txt, ETag)
├── state.py        ← Incremental crawl state (JSON)
├── parsers/
│   ├── livewhale.py    ← LiveWhale JSON API parser
│   ├── getinvolved.py  ← GetInvolved HTML events + orgs parser
│   └── rss.py          ← RSS feed discovery + parsing
├── food_detector.py    ← Free-food scoring engine
├── normalizer.py       ← Raw → Event conversion with filters
├── deduper.py          ← Cross-source dedup (rapidfuzz)
└── data/
    ├── raw/            ← Cached raw API responses
    ├── normalized/     ← events.jsonl output
    └── state/          ← crawl_state.json
```

## Pipeline Flow

```
Sources → HTTP Fetch → Parse → Normalise → Food Detect → Deduplicate → JSONL
```

1. Load sources from `sources.yaml`
2. Fetch each URL (rate-limited, robots.txt checked, conditional)
3. Parse response via type-specific parser
4. Normalise to `Event` model (campus filter, undergrad filter)
5. Score food likelihood (keywords, patterns, org signals)
6. Deduplicate across all sources (title + time + location)
7. Write sorted JSONL output

## Adding Sources

Edit `sources.yaml` to add new calendar groups:

```yaml
sources:
  - name: my_department
    type: livewhale_json
    url: "https://calendar.tamu.edu/live/json/events/group/My%20Department"
    priority: medium
    campus_filter: college_station
```

### Source Types

| Type | Description |
|------|-------------|
| `livewhale_json` | LiveWhale JSON API (most TAMU calendars) |
| `rss_directory` | Discover and parse RSS feeds from a directory page |
| `html` | Single HTML page (e.g. GetInvolved events) |
| `html_pagination` | Paginated HTML (e.g. GetInvolved orgs) |

## Free-Food Detection

The detector uses aggressive recall:

| Tier | Examples | Base Score |
|------|----------|------------|
| High | pizza, free food, catering, lunch | 0.90+ |
| Medium | reception, info session, mixer | 0.60+ |
| Low | social, welcome, tailgate | 0.30+ |

**Boosts:** Pattern matches (+0.15), known food orgs (+0.10), title match (+0.05)

## Configuration

| Setting | Default | Location |
|---------|---------|----------|
| Rate limit | 1 req/sec/domain | `http_client.py` |
| Retry attempts | 3 | `http_client.py` |
| Title dedup threshold | 85% | `deduper.py` |
| Time window for dedup | ±2 hours | `deduper.py` |
| Food detection cutoff | 0.30 | `food_detector.py` |
| Max RSS feeds | 20 | `parsers/rss.py` |
| Max org pages | 50 | `sources.yaml` |

## AWS Lambda Deployment

The crawler is designed for Lambda readiness:

1. Package as a zip with dependencies
2. Set handler to a wrapper that calls `run_crawl()`
3. Use S3 for `data/` directory (state + output)
4. Trigger via CloudWatch Events (e.g. every 6 hours)

## License

MIT
