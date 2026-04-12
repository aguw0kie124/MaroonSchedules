# UTD Events Crawler

Backend-oriented event crawler for The University of Texas at Dallas.

It mirrors the TAMU crawler approach while targeting UTD's official Comet Calendar stack:

- `localist_api`: pulls paginated events from the public Comet Calendar JSON API
- `localist_directory`: expands official group and department calendars for supplemental coverage
- `localist_html`: adds curated high-signal pages such as Auxiliary Services for commuter-friendly enrichment

Output is written to `UtdEventsCrawler/data/normalized/events.jsonl` and is consumed by the backend via the campus-aware event loader.

## Run

```bash
python UtdEventsCrawler/crawler.py crawl
python UtdEventsCrawler/crawler.py stats
```
