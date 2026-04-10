#!/usr/bin/env python3
"""UTD Events Crawler CLI."""

from __future__ import annotations

import asyncio
import logging
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import urlencode

import click
import yaml

BASE_DIR = Path(__file__).resolve().parent
SHARED_TAMU_DIR = BASE_DIR.parent / "TamuEventsCrawler"

if sys.stdout and getattr(sys.stdout, "encoding", None) != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))
if str(SHARED_TAMU_DIR) not in sys.path:
    sys.path.insert(1, str(SHARED_TAMU_DIR))

from deduper import deduplicate
from http_client import CrawlerHttpClient
from models import Event, SourceConfig, SourceRegistry
from normalizer import normalize_batch
from parsers import parse_localist_api, parse_localist_html, select_localist_entities
from state import CrawlState

LOG_FORMAT = "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"
USER_AGENT = "UTDEventsCrawler/1.0 (+https://calendar.utdallas.edu; backend integration)"
DATA_DIR = BASE_DIR / "data"
OUTPUT_FILE = DATA_DIR / "normalized" / "events.jsonl"
SOURCES_FILE = BASE_DIR / "sources.yaml"
LOG_FILE = BASE_DIR / "crawler.log"

logger = logging.getLogger("utd_crawler")


def setup_logging(verbose: bool = False) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    level = logging.DEBUG if verbose else logging.INFO

    file_handler = logging.FileHandler(LOG_FILE, encoding="utf-8")
    file_handler.setLevel(logging.DEBUG)
    file_handler.setFormatter(logging.Formatter(LOG_FORMAT))

    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(level)
    console_handler.setFormatter(logging.Formatter(LOG_FORMAT))

    root = logging.getLogger()
    root.setLevel(logging.DEBUG)
    root.handlers.clear()
    root.addHandler(file_handler)
    root.addHandler(console_handler)

    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)


def load_sources(path: Path = SOURCES_FILE) -> List[SourceConfig]:
    registry = SourceRegistry(**yaml.safe_load(path.read_text(encoding="utf-8")))
    return registry.sources


def write_events_jsonl(events: List[Event]) -> None:
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT_FILE.open("w", encoding="utf-8") as handle:
        for event in events:
            handle.write(event.to_jsonl() + "\n")
    logger.info("Wrote %d events to %s", len(events), OUTPUT_FILE)


def _with_query(base_url: str, **params: Any) -> str:
    compact = {key: value for key, value in params.items() if value not in (None, "", [])}
    return f"{base_url}?{urlencode(compact, doseq=True)}"


async def _crawl_localist_api(
    source: SourceConfig,
    http_client: CrawlerHttpClient,
) -> List[Dict[str, Any]]:
    raw_events: List[Dict[str, Any]] = []
    for page in range(1, max(source.max_pages, 1) + 1):
        page_url = _with_query(
            source.url or "",
            pp=source.page_size,
            days=source.days,
            page=page,
        )
        body, status, _ = await http_client.fetch(page_url)
        if not body or status == 304:
            break
        page_events = await parse_localist_api(
            body,
            source.name,
            page_url,
            extra_tags=source.extra_tags,
            crawl_path=[page_url],
        )
        if not page_events:
            break
        raw_events.extend(page_events)
        if len(page_events) < source.page_size:
            break
    return raw_events


async def _crawl_localist_directory(
    source: SourceConfig,
    http_client: CrawlerHttpClient,
) -> List[Dict[str, Any]]:
    entities: List[Dict[str, Any]] = []
    for page in range(1, max(source.max_pages, 1) + 1):
        page_url = _with_query(source.url or "", pp=source.page_size, page=page)
        body, status, _ = await http_client.fetch(page_url)
        if not body or status == 304:
            break
        page_entities = await select_localist_entities(
            body,
            source.name,
            page_url,
            entity_kind=source.entity_kind or "group",
            page_suffix=source.entity_page_suffix,
            extra_tags=source.extra_tags,
            selection_keywords=source.selection_keywords,
            max_entities=source.max_entities,
        )
        if not page_entities:
            break
        entities.extend(page_entities)
        if len(page_entities) < source.page_size:
            break
        if source.max_entities is not None and len(entities) >= source.max_entities:
            entities = entities[: source.max_entities]
            break

    raw_events: List[Dict[str, Any]] = []
    for entity in entities:
        entity_url = entity["calendar_url"]
        try:
            body, status, _ = await http_client.fetch(entity_url)
            if not body or status == 304:
                continue
            entity_events = await parse_localist_html(
                body,
                f"{source.name}:{entity.get('slug') or entity.get('name', 'entity')}",
                entity_url,
                host_name=entity.get("name"),
                host_type=entity.get("host_type"),
                extra_tags=entity.get("extra_tags", []),
                discovered_via=source.name,
                crawl_path=[source.url or "", entity_url],
            )
            raw_events.extend(entity_events)
        except Exception as exc:
            logger.warning("Error crawling entity %s from %s: %s", entity_url, source.name, exc)
    return raw_events


async def _crawl_localist_html(
    source: SourceConfig,
    http_client: CrawlerHttpClient,
) -> List[Dict[str, Any]]:
    body, status, _ = await http_client.fetch(source.url or "")
    if not body or status == 304:
        return []
    return await parse_localist_html(
        body,
        source.name,
        source.url or "",
        host_name="Auxiliary Services" if source.name == "auxiliary_services" else None,
        host_type="department",
        extra_tags=source.extra_tags,
        crawl_path=[source.url or ""],
    )


async def crawl_source(
    source: SourceConfig,
    http_client: CrawlerHttpClient,
    state: CrawlState,
    *,
    dry_run: bool = False,
) -> List[Event]:
    logger.info("--- Crawling source: %s (%s) ---", source.name, source.type)
    if dry_run:
        logger.info("[DRY-RUN] Would crawl %s", source.name)
        return []

    try:
        if source.type == "localist_api":
            raw_events = await _crawl_localist_api(source, http_client)
        elif source.type == "localist_directory":
            raw_events = await _crawl_localist_directory(source, http_client)
        elif source.type == "localist_html":
            raw_events = await _crawl_localist_html(source, http_client)
        else:
            raise ValueError(f"Unsupported source type: {source.type}")
    except Exception as exc:
        logger.error("Error crawling %s: %s", source.name, exc)
        state.update_source_state(source.name, errors=1)
        return []

    events = normalize_batch(raw_events, source.priority.value)
    state.update_source_state(
        source.name,
        event_count=len(events),
        new_events=len(events),
    )
    logger.info(
        "Source %s: %d raw -> %d normalized events",
        source.name,
        len(raw_events),
        len(events),
    )
    return events


async def run_crawl(
    sources: List[SourceConfig],
    *,
    source_filter: Optional[str] = None,
    dry_run: bool = False,
) -> List[Event]:
    state = CrawlState()
    state.load()
    state.mark_run_started()

    if source_filter:
        sources = [source for source in sources if source.name == source_filter]
        if not sources:
            logger.error("Unknown source: %s", source_filter)
            return []

    all_events: List[Event] = []
    async with CrawlerHttpClient(
        dry_run=dry_run,
        user_agent=USER_AGENT,
        min_interval=1.5,
    ) as http_client:
        http_client.load_conditional_cache(state.http_cache)
        for source in sources:
            all_events.extend(
                await crawl_source(source, http_client, state, dry_run=dry_run)
            )
        state.http_cache = http_client.get_conditional_cache()

    if dry_run:
        state.save()
        return []

    deduped = deduplicate(all_events)
    deduped.sort(key=lambda event: (-event.food_confidence, -event.freshness_score))

    new_hashes = {event.content_hash for event in deduped}
    truly_new = new_hashes - state.get_known_hashes()
    state.add_known_hashes(new_hashes)

    write_events_jsonl(deduped)
    state.save()
    print_health_report(deduped, truly_new, sources)
    return deduped


def print_health_report(
    events: List[Event],
    new_hashes: set[str],
    sources: List[SourceConfig],
) -> None:
    food_events = [event for event in events if event.has_food]
    high_food = [event for event in food_events if event.food_confidence >= 0.8]

    print(
        f"\nUTD crawler report | sources={len(sources)} | events={len(events)} | "
        f"new={len(new_hashes)} | food={len(food_events)} | high_food={len(high_food)}"
    )


@click.group()
def cli() -> None:
    """UTD Events Crawler."""


@cli.command()
@click.option("--source", "source_filter", default=None)
@click.option("--dry-run", is_flag=True, default=False)
@click.option("--verbose", "-v", is_flag=True, default=False)
def crawl(source_filter: Optional[str], dry_run: bool, verbose: bool) -> None:
    setup_logging(verbose)
    sources = load_sources()
    events = asyncio.run(
        run_crawl(
            sources,
            source_filter=source_filter,
            dry_run=dry_run,
        )
    )
    if not dry_run:
        logger.info("Crawl complete. %d events written.", len(events))


@cli.command()
def stats() -> None:
    if not OUTPUT_FILE.exists():
        print("No UTD events snapshot yet.")
        return
    lines = [line for line in OUTPUT_FILE.read_text(encoding="utf-8").splitlines() if line.strip()]
    print(f"{OUTPUT_FILE}: {len(lines)} events")


if __name__ == "__main__":
    cli()
