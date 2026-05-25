#!/usr/bin/env python3
"""TAMU Events Crawler v3 — CLI entry point.

Usage:
    python crawler.py crawl --all
    python crawler.py crawl --source=main_calendar
    python crawler.py crawl --dry-run
    python crawler.py crawl --food-only --confidence=0.7
    python crawler.py stats
    python crawler.py diagnose --query "Good Bull Pitch"
    python crawler.py discover
    python crawler.py rebuild-index
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import sys

if sys.stdout and getattr(sys.stdout, "encoding", None) != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

import click
import yaml

# Ensure the project root is on the path
sys.path.insert(0, str(Path(__file__).parent))

from deduper import deduplicate
from http_client import CrawlerHttpClient
from models import Event, SourceConfig, SourceRegistry
from normalizer import normalize_batch
from output_csv import generate_all_summaries
from parsers import get_parser
from state import CrawlState

# ---------------------------------------------------------------------------
# Logging setup
# ---------------------------------------------------------------------------

LOG_FORMAT = "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"


def setup_logging(verbose: bool = False) -> None:
    """Configure structured logging to file and console."""
    log_dir = Path("data")
    log_dir.mkdir(parents=True, exist_ok=True)

    level = logging.DEBUG if verbose else logging.INFO

    # File handler
    file_handler = logging.FileHandler("crawler.log", encoding="utf-8")
    file_handler.setLevel(logging.DEBUG)
    file_handler.setFormatter(logging.Formatter(LOG_FORMAT))

    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(level)
    console_handler.setFormatter(logging.Formatter(LOG_FORMAT))

    root = logging.getLogger()
    root.setLevel(logging.DEBUG)
    # Clear existing handlers to avoid duplicates on re-run
    root.handlers.clear()
    root.addHandler(file_handler)
    root.addHandler(console_handler)

    # Quiet down noisy libraries
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("hpack").setLevel(logging.WARNING)


logger = logging.getLogger("tamu_crawler")


# ---------------------------------------------------------------------------
# Source loading
# ---------------------------------------------------------------------------


def load_sources(path: str = "sources.yaml") -> List[SourceConfig]:
    """Load source registry from YAML."""
    with open(path, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)

    registry = SourceRegistry(**data)
    return registry.sources


# ---------------------------------------------------------------------------
# Output
# ---------------------------------------------------------------------------

OUTPUT_DIR = Path("data/normalized")
OUTPUT_FILE = OUTPUT_DIR / "events.jsonl"
RAW_DIR = Path("data/raw")


def write_events_jsonl(events: List[Event], output_path: Path = OUTPUT_FILE) -> None:
    """Write events to JSONL file."""
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, "w", encoding="utf-8") as f:
        for event in events:
            f.write(event.to_jsonl() + "\n")

    logger.info("Wrote %d events to %s", len(events), output_path)


def save_raw(source_name: str, data: str | None) -> None:
    """Save raw response to data/raw/ for debugging."""
    if not data:
        return
    raw_path = RAW_DIR / f"{source_name}.json"
    raw_path.parent.mkdir(parents=True, exist_ok=True)
    with open(raw_path, "w", encoding="utf-8") as f:
        f.write(data)


def load_cached_raw(source_name: str) -> str | None:
    """Load previously saved raw payload for a source."""
    raw_path = RAW_DIR / f"{source_name}.json"
    if not raw_path.exists():
        return None
    try:
        return raw_path.read_text(encoding="utf-8")
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Crawl orchestration
# ---------------------------------------------------------------------------


async def crawl_source(
    source: SourceConfig,
    http_client: CrawlerHttpClient,
    state: CrawlState,
    dry_run: bool = False,
) -> List[Event]:
    """Crawl a single source and return normalised events."""
    src_name = source.name
    src_type = source.type
    url = source.url or source.base_url or ""

    logger.info("━━━ Crawling source: %s (%s) ━━━", src_name, src_type)

    if dry_run:
        logger.info("[DRY-RUN] Would crawl %s at %s", src_name, url)
        return []

    try:
        parser = get_parser(src_type, source.parser)
    except ValueError as exc:
        logger.error("No parser for source %s: %s", src_name, exc)
        state.update_source_state(src_name, errors=1)
        return []

    raw_events: List[Dict[str, Any]] = []

    if src_type == "html_pagination":
        # Paginated source
        base = source.base_url or ""
        pattern = source.page_pattern or "?page={page}"
        max_pages = source.max_pages or 50

        for page in range(1, max_pages + 1):
            page_url = base + pattern.format(page=page)
            try:
                body, status, _ = await http_client.fetch(page_url)
                if not body or status == 304:
                    break
                save_raw(f"{src_name}_page_{page}", body)
                page_events = await parser(body, src_name, page_url)
                if not page_events:
                    logger.info("No more results at page %d, stopping", page)
                    break
                raw_events.extend(page_events)
            except Exception as exc:
                logger.warning("Error crawling %s page %d: %s", src_name, page, exc)
                break

    elif src_type == "html_search":
        # Search-query source: iterate over query terms
        base = source.base_url or source.url or ""
        queries = source.queries or []
        if not queries:
            logger.warning("No queries defined for search source %s", src_name)
        for query in queries:
            search_url = f"{base}?query={query}"
            try:
                body, status, _ = await http_client.fetch(search_url)
                if body and status != 304:
                    save_raw(f"{src_name}_{query}", body)
                    page_events = await parser(
                        body, src_name, search_url, query=query
                    )
                    raw_events.extend(page_events)
            except Exception as exc:
                logger.warning(
                    "Error searching %s for '%s': %s", src_name, query, exc
                )

    elif src_type == "rss_directory":
        # RSS directory needs the http_client for sub-fetches
        try:
            body, status, _ = await http_client.fetch(url)
            if body and status != 304:
                save_raw(src_name, body)
                raw_events = await parser(
                    body, src_name, url, http_client=http_client
                )
            elif status == 304:
                cached_body = load_cached_raw(src_name)
                if cached_body:
                    logger.info("Source %s not modified, using cached raw payload", src_name)
                    raw_events = await parser(
                        cached_body, src_name, url, http_client=http_client
                    )
        except Exception as exc:
            logger.warning("Error crawling RSS directory %s: %s", src_name, exc)
            cached_body = load_cached_raw(src_name)
            if cached_body:
                try:
                    logger.info("Using cached raw payload for %s after fetch error", src_name)
                    raw_events = await parser(
                        cached_body, src_name, url, http_client=http_client
                    )
                except Exception as cache_exc:
                    logger.warning("Cached parse failed for %s: %s", src_name, cache_exc)

    elif src_type == "html_multi_url":
        # Multi-URL source: fetch seed page + explicit URLs with link following
        try:
            body = None
            if url:
                body, status, _ = await http_client.fetch(url)
                if body and status != 304:
                    save_raw(src_name, body)
                elif status == 304:
                    cached_body = load_cached_raw(src_name)
                    if cached_body:
                        logger.info("Source %s not modified, using cached raw payload", src_name)
                        body = cached_body

            raw_events = await parser(
                body, src_name, url or "",
                http_client=http_client,
                urls=source.urls or [],
            )
        except Exception as exc:
            logger.warning("Error crawling multi-URL source %s: %s", src_name, exc)
            cached_body = load_cached_raw(src_name)
            if cached_body:
                try:
                    logger.info("Using cached raw payload for %s after fetch error", src_name)
                    raw_events = await parser(
                        cached_body, src_name, url or "",
                        http_client=http_client,
                        urls=source.urls or [],
                    )
                except Exception as cache_exc:
                    logger.warning("Cached parse failed for %s: %s", src_name, cache_exc)
                    state.update_source_state(src_name, errors=1)
                    return []
            else:
                state.update_source_state(src_name, errors=1)
                return []

    elif src_type == "html_events":
        # Single HTML events page
        try:
            body, status, _ = await http_client.fetch(url)
            if body and status != 304:
                save_raw(src_name, body)
                raw_events = await parser(body, src_name, url)
            elif status == 304:
                cached_body = load_cached_raw(src_name)
                if cached_body:
                    logger.info("Source %s not modified, using cached raw payload", src_name)
                    raw_events = await parser(cached_body, src_name, url)
                else:
                    logger.info("Source %s not modified and no cached payload available", src_name)
                    return []
        except Exception as exc:
            logger.error("Error crawling HTML events %s: %s", src_name, exc)
            cached_body = load_cached_raw(src_name)
            if cached_body:
                try:
                    logger.info("Using cached raw payload for %s after fetch error", src_name)
                    raw_events = await parser(cached_body, src_name, url)
                except Exception as cache_exc:
                    logger.error("Cached parse failed for HTML events %s: %s", src_name, cache_exc)
                    state.update_source_state(src_name, errors=1)
                    return []
            else:
                state.update_source_state(src_name, errors=1)
                return []

    elif src_type == "html_dynamic_table":
        # HTML table source that may follow detail links for enrichment
        primary_url = url or (source.base_urls[0] if source.base_urls else "")
        try:
            body, status, _ = await http_client.fetch(primary_url)
            if body and status != 304:
                save_raw(src_name, body)
                raw_events = await parser(
                    body,
                    src_name,
                    primary_url,
                    http_client=http_client,
                    source_config=source,
                )
            elif status == 304:
                cached_body = load_cached_raw(src_name)
                if cached_body:
                    logger.info("Source %s not modified, using cached raw payload", src_name)
                    raw_events = await parser(
                        cached_body,
                        src_name,
                        primary_url,
                        http_client=http_client,
                        source_config=source,
                    )
                else:
                    logger.info("Source %s not modified and no cached payload available", src_name)
                    return []
        except Exception as exc:
            logger.error("Error crawling HTML dynamic table %s: %s", src_name, exc)
            cached_body = load_cached_raw(src_name)
            if cached_body:
                try:
                    logger.info("Using cached raw payload for %s after fetch error", src_name)
                    raw_events = await parser(
                        cached_body,
                        src_name,
                        primary_url,
                        http_client=http_client,
                        source_config=source,
                    )
                except Exception as cache_exc:
                    logger.error("Cached parse failed for HTML dynamic table %s: %s", src_name, cache_exc)
                    state.update_source_state(src_name, errors=1)
                    return []
            else:
                state.update_source_state(src_name, errors=1)
                return []

    else:
        # Standard single-URL source (livewhale_json, html)
        try:
            body, status, _ = await http_client.fetch(url)
            if body and status != 304:
                save_raw(src_name, body)
                raw_events = await parser(body, src_name, url)
            elif status == 304:
                cached_body = load_cached_raw(src_name)
                if cached_body:
                    logger.info("Source %s not modified, using cached raw payload", src_name)
                    raw_events = await parser(cached_body, src_name, url)
                else:
                    logger.info("Source %s not modified and no cached payload available", src_name)
                    return []
        except Exception as exc:
            logger.error("Error crawling %s: %s", src_name, exc)
            cached_body = load_cached_raw(src_name)
            if cached_body:
                try:
                    logger.info("Using cached raw payload for %s after fetch error", src_name)
                    raw_events = await parser(cached_body, src_name, url)
                except Exception as cache_exc:
                    logger.error("Cached parse failed for %s: %s", src_name, cache_exc)
                    state.update_source_state(src_name, errors=1)
                    return []
            else:
                state.update_source_state(src_name, errors=1)
                return []

    # Opportunistic RSS / iCal discovery for HTML pages
    if src_type in ("html_events", "html_multi_url", "html_pagination", "html_search") and "body" in locals() and body:
        try:
            from parsers.rss import parse_rss_directory
            rss_events = await parse_rss_directory(body, src_name, url, http_client=http_client)
            if rss_events:
                logger.info("Opportunistic RSS discovery found %d events", len(rss_events))
                raw_events.extend(rss_events)
        except Exception as exc:
            logger.debug("Opportunistic RSS for %s skipped: %s", src_name, exc)

    # Normalise
    events = normalize_batch(raw_events, source.priority.value)

    # Update state
    state.update_source_state(
        src_name,
        event_count=len(events),
        new_events=len(events),
    )

    logger.info(
        "Source %s: %d raw → %d normalised events",
        src_name,
        len(raw_events),
        len(events),
    )
    return events


async def run_crawl(
    sources: List[SourceConfig],
    dry_run: bool = False,
    source_filter: Optional[str] = None,
    food_only: bool = False,
    min_confidence: float = 0.0,
) -> List[Event]:
    """Run the full crawl pipeline."""
    state = CrawlState()
    state.load()
    state.mark_run_started()

    # Filter sources if requested
    if source_filter:
        sources = [s for s in sources if s.name == source_filter]
        if not sources:
            logger.error("Source '%s' not found in registry", source_filter)
            return []

    logger.info(
        "Starting crawl — %d sources, dry_run=%s",
        len(sources),
        dry_run,
    )

    all_events: List[Event] = []

    async with CrawlerHttpClient(dry_run=dry_run) as http_client:
        # Restore HTTP cache from state
        http_client.load_conditional_cache(state.http_cache)

        for source in sources:
            try:
                events = await crawl_source(source, http_client, state, dry_run)
                all_events.extend(events)
            except Exception as exc:
                logger.error(
                    "Unhandled error crawling %s: %s", source.name, exc,
                    exc_info=True,
                )
                state.update_source_state(source.name, errors=1)

        # Save HTTP cache back to state
        state.http_cache = http_client.get_conditional_cache()

    if dry_run:
        logger.info("[DRY-RUN] Would have crawled %d sources", len(sources))
        state.save()
        return []

    # Dedup across sources
    logger.info("Deduplicating %d events across all sources...", len(all_events))
    deduped = deduplicate(all_events)

    # Sort: food events first, then by freshness
    deduped.sort(key=lambda e: (-e.food_confidence, -e.freshness_score))

    # Apply food-only filter
    if food_only:
        deduped = [e for e in deduped if e.has_food and e.food_confidence >= min_confidence]
        logger.info("Food-only filter: %d events with confidence >= %.2f", len(deduped), min_confidence)
    elif min_confidence > 0:
        deduped = [e for e in deduped if e.food_confidence >= min_confidence or not e.has_food]

    # Track known hashes
    new_hashes = {e.content_hash for e in deduped}
    known_hashes = state.get_known_hashes()
    truly_new = new_hashes - known_hashes
    state.add_known_hashes(new_hashes)

    # Write JSONL output
    write_events_jsonl(deduped)

    # Generate CSV summaries
    try:
        events_dicts = [json.loads(e.to_jsonl()) for e in deduped]
        csv_files = generate_all_summaries(events_dicts)
        logger.info("Generated %d CSV summary files", len(csv_files))
    except Exception as exc:
        logger.warning("Error generating CSV summaries: %s", exc)

    # Save state
    state.save()

    # Print health report
    print_health_report(deduped, truly_new, sources)

    return deduped


# ---------------------------------------------------------------------------
# Health report
# ---------------------------------------------------------------------------


def print_health_report(
    events: List[Event],
    new_hashes: set,
    sources: List[SourceConfig],
) -> None:
    """Print a crawl health summary."""
    food_events = [e for e in events if e.has_food]
    high_food = [e for e in food_events if e.food_confidence >= 0.8]

    # Food type breakdown
    food_types: Dict[str, int] = {}
    for e in food_events:
        ft = getattr(e, 'food_type', 'unknown')
        food_types[ft] = food_types.get(ft, 0) + 1

    # Category counts
    cat_counts: Dict[str, int] = {}
    for cat in ["social", "sports", "academic", "food", "advocacy",
                "entertainment", "health_wellness", "religion"]:
        cat_counts[cat] = sum(1 for e in events if getattr(e, cat, 0) == 1)

    # Department counts
    dept_counts: Dict[str, int] = {}
    for e in events:
        dept = e.department_code or "unmapped"
        dept_counts[dept] = dept_counts.get(dept, 0) + 1

    report = f"""
╔══════════════════════════════════════════════════╗
║       TAMU Events Crawler v3 Report         ║
╠══════════════════════════════════════════════════╣
║ Sources crawled:       {len(sources):>5}                     ║
║ Total events:          {len(events):>5}                     ║
║ New events this run:   {len(new_hashes):>5}                     ║
║ Food events (any):     {len(food_events):>5}                     ║
║ Food events (high):    {len(high_food):>5}                     ║
╚══════════════════════════════════════════════════╝"""
    print(report)

    # Category breakdown
    print("\n🏷️  Category Breakdown:")
    for cat, count in sorted(cat_counts.items(), key=lambda x: -x[1]):
        bar = "█" * min(count, 30)
        print(f"    {cat:18s} {count:>4} {bar}")

    # Department breakdown (top 15)
    print("\n🏫 Department Breakdown (top 15):")
    for dept, count in sorted(dept_counts.items(), key=lambda x: -x[1])[:15]:
        print(f"    {dept:20s} {count:>4}")

    # Food type breakdown
    if food_types:
        print("\n🍽️  Food Type Breakdown:")
        for ft, count in sorted(food_types.items(), key=lambda x: -x[1]):
            print(f"    {ft:15s} {count:>4}")

    if high_food:
        print("\n🍕 Top Free-Food Events:")
        for e in high_food[:10]:
            ft_label = f" [{e.food_type}]" if hasattr(e, 'food_type') and e.food_type != 'unknown' else ""
            print(f"  • [{e.food_confidence:.0%}]{ft_label} {e.title[:55]}")
            if e.location:
                print(f"    📍 {e.location}")
            print(f"    📅 {e.start_time.strftime('%b %d, %I:%M %p')}")

    # Source breakdown
    print("\n📊 Events per source:")
    source_counts: Dict[str, int] = {}
    for e in events:
        source_counts[e.source_name] = source_counts.get(e.source_name, 0) + 1
    for name, count in sorted(source_counts.items(), key=lambda x: -x[1]):
        print(f"  {name:35s} {count:>5}")

    print()


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


@click.group()
def cli() -> None:
    """TAMU Campus Events Crawler v3 — scrape, classify, and prioritise events."""
    pass


@cli.command()
@click.option("--all", "crawl_all", is_flag=True, default=True, help="Crawl all sources")
@click.option("--source", "source_filter", default=None, help="Crawl a single source by name")
@click.option("--dry-run", is_flag=True, default=False, help="Test mode — no HTTP requests")
@click.option("--food-only", is_flag=True, default=False, help="Output only food events")
@click.option("--confidence", "min_confidence", type=float, default=0.0, help="Min food confidence threshold (0.0-1.0)")
@click.option("--verbose", "-v", is_flag=True, default=False, help="Debug logging")
def crawl(
    crawl_all: bool,
    source_filter: Optional[str],
    dry_run: bool,
    food_only: bool,
    min_confidence: float,
    verbose: bool,
) -> None:
    """Run the event crawler."""
    setup_logging(verbose)
    logger.info("TAMU Events Crawler v3 starting...")

    sources = load_sources()
    logger.info("Loaded %d sources from sources.yaml", len(sources))

    events = asyncio.run(run_crawl(
        sources,
        dry_run=dry_run,
        source_filter=source_filter,
        food_only=food_only,
        min_confidence=min_confidence,
    ))

    if not dry_run:
        logger.info("Crawl complete. %d events written.", len(events))


@cli.command()
def stats() -> None:
    """Show crawl statistics from the last run."""
    setup_logging()
    state = CrawlState()
    state.load()

    print(f"\nLast run: {state.last_run or 'never'}")
    print(f"Total runs: {state.run_count}")
    print(f"Known event hashes: {len(state.get_known_hashes())}")

    if state._state.get("sources"):
        print("\nPer-source stats:")
        for name, info in sorted(state._state["sources"].items()):
            errors = info.get('errors', 0)
            err_label = f" ❗{errors}err" if errors else ""
            print(f"  {name:35s} | events: {info.get('event_count', 0):>4} | "
                  f"last: {info.get('last_crawled_at', 'never')}{err_label}")

    # Check output file
    output = Path("data/normalized/events.jsonl")
    if output.exists():
        lines = output.read_text(encoding="utf-8").strip().split("\n")
        print(f"\nOutput file: {output} ({len(lines)} events)")

        # Count food events, categories, departments
        food_count = 0
        food_types: Dict[str, int] = {}
        cat_counts: Dict[str, int] = {}
        dept_counts: Dict[str, int] = {}
        for line in lines:
            try:
                data = json.loads(line)
                if data.get("has_food"):
                    food_count += 1
                    ft = data.get("food_type", "unknown")
                    food_types[ft] = food_types.get(ft, 0) + 1
                for cat in ["social", "sports", "academic", "food", "advocacy",
                             "entertainment", "health_wellness", "religion"]:
                    if data.get(cat, 0) == 1:
                        cat_counts[cat] = cat_counts.get(cat, 0) + 1
                dept = data.get("department_code") or "unmapped"
                dept_counts[dept] = dept_counts.get(dept, 0) + 1
            except json.JSONDecodeError:
                pass

        print(f"Food events: {food_count}")
        if food_types:
            print("Food type breakdown:")
            for ft, ct in sorted(food_types.items(), key=lambda x: -x[1]):
                print(f"  {ft:15s} {ct:>4}")
        if cat_counts:
            print("\nCategory breakdown:")
            for cat, ct in sorted(cat_counts.items(), key=lambda x: -x[1]):
                print(f"  {cat:18s} {ct:>4}")
        if dept_counts:
            print("\nDepartment breakdown (top 10):")
            for dept, ct in sorted(dept_counts.items(), key=lambda x: -x[1])[:10]:
                print(f"  {dept:20s} {ct:>4}")
    else:
        print("\nNo output file yet. Run 'python crawler.py crawl' first.")


@cli.command()
@click.option("--query", "-q", required=True, help="Event title/phrase to search for")
@click.option("--verbose", "-v", is_flag=True, default=False, help="Debug logging")
def diagnose(query: str, verbose: bool) -> None:
    """Debug why a specific event is missing from crawl results."""
    setup_logging(verbose)
    from diagnostics.missing_event import diagnose_missing_event
    report = diagnose_missing_event(query)
    print(report)


@cli.command()
@click.option("--verbose", "-v", is_flag=True, default=False, help="Debug logging")
def discover(verbose: bool) -> None:
    """Discover new sources from existing seed pages."""
    setup_logging(verbose)
    logger.info("Source discovery not yet implemented — run 'crawl' to use configured sources.")
    logger.info("Loaded sources:")
    sources = load_sources()
    for s in sources:
        url = s.url or s.base_url or "(multi-url)"
        print(f"  [{s.priority.value:6s}] {s.name:35s} {s.type:20s} {url[:60]}")
    print(f"\nTotal: {len(sources)} sources configured")


@cli.command(name="rebuild-index")
@click.option("--verbose", "-v", is_flag=True, default=False, help="Debug logging")
def rebuild_index(verbose: bool) -> None:
    """Rebuild CSV summaries from existing JSONL output."""
    setup_logging(verbose)
    logger.info("Rebuilding CSV summaries from events.jsonl...")

    output = Path("data/normalized/events.jsonl")
    if not output.exists():
        logger.error("No events.jsonl found. Run 'crawl' first.")
        return

    from output_csv import generate_all_summaries
    csv_files = generate_all_summaries()
    print(f"\nGenerated {len(csv_files)} CSV summary files:")
    for f in csv_files:
        print(f"  📄 {f}")


@cli.command(name="crawl-business-deals")
@click.option("--dry-run", is_flag=True, default=False, help="Run the off-campus business pipeline without scraping")
@click.option("--verbose", "-v", is_flag=True, default=False, help="Debug logging")
def crawl_business_deals(dry_run: bool, verbose: bool) -> None:
    """Build TAMU-adjacent off-campus business events and promotions."""
    setup_logging(verbose)
    logger.info("TAMU business deals pipeline starting...")

    from tamu_business_deals.pipeline import run_business_deals_pipeline_sync

    result = run_business_deals_pipeline_sync(dry_run=dry_run)
    print("\nBusiness deals pipeline complete:")
    print(f"  Businesses exported: {result.get('business_count', 0)}")
    print(f"  Deal/event records:   {result.get('record_count', 0)}")
    if result.get("catalog_csv"):
        print(f"  Catalog CSV:         {result['catalog_csv']}")
    if result.get("deals_csv"):
        print(f"  Deals CSV:           {result['deals_csv']}")
    if result.get("deals_jsonl"):
        print(f"  Deals JSONL:         {result['deals_jsonl']}")
    if result.get("next_sources"):
        print(f"  Next sources map:    {result['next_sources']}")


if __name__ == "__main__":
    cli()
