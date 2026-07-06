---
description: Daily health check for the TAMU and UTD event crawlers — opens an issue when a scraper looks broken.

# Runs once a day, plus a manual button so we can smoke-test from a branch.
on:
  schedule:
    - cron: "0 13 * * *"   # 13:00 UTC daily
  workflow_dispatch:

engine: claude

# The agent only READS the crawl output and (via safe-outputs) proposes an issue.
# It gets no write token and no deploy access.
permissions:
  contents: read

network: defaults

timeout-minutes: 15

# The only thing this workflow is allowed to do: open (at most) one issue.
safe-outputs:
  create-issue:
    title-prefix: "[crawler-health] "
    labels: [crawler-health, automation]
    max: 1

# Deterministic setup: run the crawlers with normal (un-firewalled) network,
# capture their output into ./crawler-health/, THEN hand off to the agent.
# These steps run in the same job as the agent and share the workspace, so the
# agent can read the files they produce. continue-on-error keeps a crawler crash
# from aborting the run — the agent still sees the log and reports it.
steps:
  - name: Set up Python
    uses: actions/setup-python@v5
    with:
      python-version: "3.13"

  - name: Install crawler dependencies
    run: |
      python -m pip install --upgrade pip
      python -m pip install -r TamuEventsCrawler/requirements.txt

  - name: Run TAMU crawler
    continue-on-error: true
    working-directory: TamuEventsCrawler
    run: |
      mkdir -p "$GITHUB_WORKSPACE/crawler-health"
      echo "== TAMU crawl ==" > "$GITHUB_WORKSPACE/crawler-health/tamu.log"
      python crawler.py crawl --all >> "$GITHUB_WORKSPACE/crawler-health/tamu.log" 2>&1
      echo "== TAMU stats ==" >> "$GITHUB_WORKSPACE/crawler-health/tamu.log"
      python crawler.py stats  >> "$GITHUB_WORKSPACE/crawler-health/tamu.log" 2>&1
      cp -f output/source_health.csv "$GITHUB_WORKSPACE/crawler-health/tamu-source-health.csv" 2>/dev/null || true

  - name: Run UTD crawler
    continue-on-error: true
    run: |
      mkdir -p "$GITHUB_WORKSPACE/crawler-health"
      echo "== UTD crawl ==" > "$GITHUB_WORKSPACE/crawler-health/utd.log"
      python UtdEventsCrawler/crawler.py crawl >> "$GITHUB_WORKSPACE/crawler-health/utd.log" 2>&1
      echo "== UTD stats ==" >> "$GITHUB_WORKSPACE/crawler-health/utd.log"
      python UtdEventsCrawler/crawler.py stats >> "$GITHUB_WORKSPACE/crawler-health/utd.log" 2>&1
---

# Crawler health check

Two event scrapers were just run for you and their output saved to the
`crawler-health/` directory in the workspace:

- `crawler-health/tamu.log` — TAMU crawler crawl + stats output
- `crawler-health/tamu-source-health.csv` — per-source event counts for TAMU (may be absent if the crawl crashed early)
- `crawler-health/utd.log` — UTD crawler crawl + stats output

Both crawlers scrape live university calendars, so the usual way they "break" is
a source site changing its HTML/RSS and a parser silently returning **zero
events** for a source that normally has some — or the crawler throwing an
exception partway through.

## What to do

1. Read the log files (and the CSV if present).
2. Decide whether either crawler is **unhealthy**. Treat these as unhealthy:
   - A crawler process crashed / printed a traceback or an unhandled exception.
   - Total events collected is **0** for a crawler.
   - A specific source in `tamu-source-health.csv` dropped to **0 events** when it
     clearly should have some (compare against the other sources — one dead
     source among many healthy ones is the classic "their site changed" signal).
3. **If everything looks healthy, do nothing** — do not open an issue.
4. **If something is unhealthy, open exactly one issue** summarizing all the
   problems found in this run. In the issue:
   - Title: name the crawler(s) and the broken source(s), e.g.
     `TAMU crawler: main_calendar returned 0 events`.
   - Body: for each problem, state the crawler, the source name, the concrete
     signal (0 events, or the traceback), and the **most relevant log excerpt**
     (a few lines — do not paste the whole log).
   - Add a short "likely cause" and where to look:
     `TamuEventsCrawler/parsers/` + `TamuEventsCrawler/sources.yaml` for TAMU,
     `UtdEventsCrawler/parsers/` + `UtdEventsCrawler/sources.yaml` for UTD.
   - Do not propose or make code changes here — this is a report only.

Keep the issue concise and skimmable.
