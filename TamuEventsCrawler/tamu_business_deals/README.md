# TAMU Business Deals Pipeline

This package extends `TamuEventsCrawler` with off-campus Texas A&M-adjacent events and promotions for Northgate, Downtown Bryan, Century Square, and nearby student-friendly businesses.

## What It Produces

- `output/local_businesses.csv`
- `output/local_businesses.json`
- `output/business_deals.json`
- `output/business_deals.jsonl`
- `output/business_deals.csv`
- `output/next_sources.md`

## Current Inputs

- TAMU local businesses Google Sheet
- Visit College Station official event pages
- Destination Bryan official event pages
- Century Square official events page
- Curated official promotion pages for student-relevant venues

## Run It

```bash
cd TamuEventsCrawler
python crawler.py crawl-business-deals
```

Dry run:

```bash
python crawler.py crawl-business-deals --dry-run
```

## Notes

- The sheet importer converts the published Google Sheet into a clean business catalog first.
- Off-campus items are normalized into a stable schema with recurrence, canonical URLs, raw trace text, and student-friendly filtering.
- The pipeline is incremental-friendly through the shared HTTP conditional cache and a dedicated state file at `tamu_business_deals/data/state/business_deals_state.json`.
