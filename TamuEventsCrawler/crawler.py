#!/usr/bin/env python3
"""TAMU Events Crawler — CLI entry point.

Usage:
    python crawler.py crawl --all
    python crawler.py crawl --source=main_calendar
    python crawler.py crawl --dry-run
    python crawler.py stats
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import sys
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
        except Exception as exc:
            logger.warning("Error crawling RSS directory %s: %s", src_name, exc)
    else:
        # Standard single-URL source
        try:
            body, status, _ = await http_client.fetch(url)
            if body and status != 304:
                save_raw(src_name, body)
                raw_events = await parser(body, src_name, url)
            elif status == 304:
                logger.info("Source %s not modified, skipping", src_name)
                return []
        except Exception as exc:
            logger.error("Error crawling %s: %s", src_name, exc)
            state.update_source_state(src_name, errors=1)
            return []

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

    # Write output
    write_events_jsonl(deduped)

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

    report = f"""
╔══════════════════════════════════════════════════╗
║       TAMU Events Crawler v2 Report         ║
╠══════════════════════════════════════════════════╣
║ Sources crawled:       {len(sources):>5}                     ║
║ Total events:          {len(events):>5}                     ║
║ New events this run:   {len(new_hashes):>5}                     ║
║ Food events (any):     {len(food_events):>5}                     ║
║ Food events (high):    {len(high_food):>5}                     ║
╚══════════════════════════════════════════════════╝"""
    print(report)

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
        print(f"  {name:30s} {count:>5}")

    print()


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


@click.group()
def cli() -> None:
    """TAMU Campus Events Crawler — scrape, normalise, and prioritise events."""
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
    logger.info("TAMU Events Crawler v2 starting...")

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
            print(f"  {name:30s} | events: {info.get('event_count', 0):>4} | "
                  f"last: {info.get('last_crawled_at', 'never')}")

    # Check output file
    output = Path("data/normalized/events.jsonl")
    if output.exists():
        lines = output.read_text(encoding="utf-8").strip().split("\n")
        print(f"\nOutput file: {output} ({len(lines)} events)")

        # Count food events and types
        food_count = 0
        food_types: Dict[str, int] = {}
        for line in lines:
            try:
                data = json.loads(line)
                if data.get("has_food"):
                    food_count += 1
                    ft = data.get("food_type", "unknown")
                    food_types[ft] = food_types.get(ft, 0) + 1
            except json.JSONDecodeError:
                pass
        print(f"Food events: {food_count}")
        if food_types:
            print("Food type breakdown:")
            for ft, ct in sorted(food_types.items(), key=lambda x: -x[1]):
                print(f"  {ft:15s} {ct:>4}")
    else:
        print("\nNo output file yet. Run 'python crawler.py crawl' first.")


if __name__ == "__main__":
    cli()
