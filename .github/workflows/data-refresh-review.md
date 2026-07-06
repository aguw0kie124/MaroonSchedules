---
description: Post-refresh quality review of crawled event data — opens an issue if new events look garbled or miscategorized.

# Dispatched by data-refresh.yml after it commits refreshed events.
# Can also be run manually against any commit.
on:
  workflow_dispatch:
    inputs:
      refresh_sha:
        description: "Commit produced by the refresh run (defaults to HEAD)"
        required: false
      refresh_run_url:
        description: "URL of the refresh workflow run"
        required: false

engine: gemini

# Read-only audit: the agent never edits data or code.
permissions:
  contents: read

network: defaults

timeout-minutes: 10

# The only thing this workflow is allowed to do: open (at most) one issue.
safe-outputs:
  create-issue:
    title-prefix: "[data-refresh] "
    labels: [data-refresh, automation]
    max: 1

# Deterministic setup: build small JSON diff reports comparing the refresh
# commit against its parent, so the agent never has to read the full
# events.jsonl files (they are thousands of lines).
steps:
  - name: Set up Python
    uses: actions/setup-python@v5
    with:
      python-version: "3.13"

  - name: Build review reports
    run: |
      mkdir -p review
      SHA="${{ github.event.inputs.refresh_sha }}"
      SHA="${SHA:-HEAD}"
      git log -1 --stat "$SHA" > review/commit.txt || true
      python scripts/validate_refresh.py --campus tamu \
        --new TamuEventsCrawler/data/normalized/events.jsonl \
        --old-ref "$SHA~1" --report review/tamu.json --report-only || true
      python scripts/validate_refresh.py --campus utd \
        --new UtdEventsCrawler/data/normalized/events.jsonl \
        --old-ref "$SHA~1" --report review/utd.json --report-only || true
---

# Event data refresh review

The automated data refresh just committed freshly crawled campus events
(refresh run: "${{ github.event.inputs.refresh_run_url }}"). Small JSON
reports comparing the new data against the previous version were built for
you in the `review/` directory:

- `review/tamu.json` and `review/utd.json` — counts (total / upcoming /
  added / removed), per-source counts before and after, category-flag
  coverage, and up to 20 sample newly-added events with their title,
  start_time, source and category flags.
- `review/commit.txt` — the refresh commit summary.

Deterministic checks (schema, dates, no sharp drop in upcoming events)
already passed before this data was committed. Your job is the judgment
call those checks cannot make.

## What to do

1. Read ONLY the files in `review/` — do NOT read the full `events.jsonl`
   files; they are huge and the reports contain everything you need.
2. Judge the refresh on these points:
   - **Titles**: the sampled added events should read like real event names,
     not HTML fragments, navigation text, error pages, or mojibake.
   - **Dates**: plausible and varied — a batch of new events all sharing one
     identical timestamp is a parser bug signal.
   - **Categories**: each sampled event's flags (from the vocabulary
     `social, sports, academic, food, advocacy, entertainment,
     health_wellness, religion, casual, professional`) should make sense for
     its title — e.g. "Intramural Soccer Finals" should carry `sports`, a
     career fair should carry `professional`. The keyword rules live in
     `TamuEventsCrawler/classifiers/category_rules.yaml` if you need to
     check intent. Also flag it if `category_flag_coverage` collapsed
     compared to typical (most events should have at least one flag).
   - **Diff shape**: no single source mass-deleted in `sources_new` vs
     `sources_old`, no flood of near-duplicate titles among the samples.
3. **If everything looks fine, do nothing** — do not open an issue.
4. **If something looks wrong, open exactly one issue** covering all
   problems found:
   - Title: name the campus and the problem, e.g.
     `UTD refresh: new events have garbled titles`.
   - Body: the concrete signal with a small excerpt from the report (never
     large dumps), and a "likely cause" pointer — parsers live in
     `TamuEventsCrawler/parsers/` / `UtdEventsCrawler/parsers/`,
     categorization in `TamuEventsCrawler/classifiers/`.
   - Link the refresh run URL above.
   - Do not propose or make code or data changes — this is a report only.

Keep the issue concise and skimmable.
