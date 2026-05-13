#!/usr/bin/env python3
"""TAMU Courses Crawler CLI."""

from __future__ import annotations

import asyncio
import json
import logging
import sys
from pathlib import Path
from typing import List, Optional

import click
import yaml

from deduper import dedupe_courses, dedupe_degree_plans, dedupe_grade_distributions
from http_client import CrawlerHttpClient
from models import Course, DegreePlan, GradeDistribution, SourceConfig, SourceRegistry
from normalizer import normalize_courses, normalize_degree_plans, normalize_grade_distributions
from parsers import crawl_annex_source, crawl_catalog_source
from state import CrawlState

if sys.stdout and getattr(sys.stdout, "encoding", None) != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

LOG_FORMAT = "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"
DATA_DIR = Path("data")
RAW_DIR = DATA_DIR / "raw"
NORMALIZED_DIR = DATA_DIR / "normalized"
COURSES_OUTPUT = NORMALIZED_DIR / "courses.jsonl"
PLANS_OUTPUT = NORMALIZED_DIR / "degree_plans.jsonl"
GRADES_OUTPUT = NORMALIZED_DIR / "grade_distributions.jsonl"

logger = logging.getLogger("tamu_courses_crawler")


def setup_logging(verbose: bool = False) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    level = logging.DEBUG if verbose else logging.INFO
    file_handler = logging.FileHandler("crawler.log", encoding="utf-8")
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


def load_sources(path: str = "sources.yaml") -> List[SourceConfig]:
    data = yaml.safe_load(Path(path).read_text(encoding="utf-8"))
    return SourceRegistry(**data).sources


def save_raw(source_name: str, data: str | None) -> None:
    if not data:
        return
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    (RAW_DIR / f"{source_name}.html").write_text(data, encoding="utf-8")


def write_jsonl(path: Path, rows: List[Course | DegreePlan | GradeDistribution]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(row.to_jsonl() + "\n")


async def crawl_source(
    source: SourceConfig,
    http_client: CrawlerHttpClient,
    state: CrawlState,
    *,
    dry_run: bool = False,
) -> tuple[List[Course], List[DegreePlan], List[GradeDistribution]]:
    logger.info("Crawling source: %s (%s)", source.name, source.type)
    try:
        if source.type == "catalog_html":
            courses, plans = await crawl_catalog_source(source, http_client, dry_run=dry_run)
            state.update_source_state(source.name, records=len(courses) + len(plans))
            return courses, plans, []
        if source.type == "annex_html":
            grades = await crawl_annex_source(source, http_client, dry_run=dry_run)
            state.update_source_state(source.name, records=len(grades))
            return [], [], grades
        raise ValueError(f"Unsupported source type: {source.type}")
    except Exception as exc:
        logger.error("Error crawling %s: %s", source.name, exc, exc_info=True)
        state.update_source_state(source.name, errors=1)
        return [], [], []


async def run_crawl(
    sources: List[SourceConfig],
    *,
    source_filter: Optional[str] = None,
    dry_run: bool = False,
) -> tuple[List[Course], List[DegreePlan], List[GradeDistribution]]:
    state = CrawlState()
    state.load()
    state.mark_run_started()

    if source_filter:
        sources = [source for source in sources if source.name == source_filter]
        if not sources:
            logger.error("Unknown source: %s", source_filter)
            return [], [], []

    all_courses: List[Course] = []
    all_plans: List[DegreePlan] = []
    all_grades: List[GradeDistribution] = []

    async with CrawlerHttpClient(dry_run=dry_run) as http_client:
        http_client.load_conditional_cache(state.http_cache)
        for source in sources:
            courses, plans, grades = await crawl_source(source, http_client, state, dry_run=dry_run)
            all_courses.extend(courses)
            all_plans.extend(plans)
            all_grades.extend(grades)
        state.http_cache = http_client.get_conditional_cache()

    if dry_run:
        state.save()
        return [], [], []

    deduped_courses = dedupe_courses(normalize_courses(all_courses))
    deduped_plans = dedupe_degree_plans(normalize_degree_plans(all_plans))
    deduped_grades = dedupe_grade_distributions(normalize_grade_distributions(all_grades))

    write_jsonl(COURSES_OUTPUT, deduped_courses)
    write_jsonl(PLANS_OUTPUT, deduped_plans)
    write_jsonl(GRADES_OUTPUT, deduped_grades)

    state.add_known_ids({row.id for row in deduped_courses} | {row.id for row in deduped_plans} | {row.id for row in deduped_grades})
    state.save()
    return deduped_courses, deduped_plans, deduped_grades


def print_stats() -> None:
    state = CrawlState()
    state.load()
    print(f"Last run: {state.last_run or 'never'}")
    print(f"Total runs: {state.run_count}")
    for label, path in (
        ("courses", COURSES_OUTPUT),
        ("degree plans", PLANS_OUTPUT),
        ("grade distributions", GRADES_OUTPUT),
    ):
        count = 0
        if path.exists():
            count = len([line for line in path.read_text(encoding="utf-8").splitlines() if line.strip()])
        print(f"{label}: {count}")


@click.group()
def cli() -> None:
    """TAMU Courses Crawler."""


@cli.command()
@click.option("--all", "crawl_all", is_flag=True, default=True)
@click.option("--source", "source_filter", default=None)
@click.option("--dry-run", is_flag=True, default=False)
@click.option("--verbose", "-v", is_flag=True, default=False)
def crawl(crawl_all: bool, source_filter: Optional[str], dry_run: bool, verbose: bool) -> None:
    setup_logging(verbose)
    sources = load_sources()
    asyncio.run(run_crawl(sources, source_filter=source_filter, dry_run=dry_run))


@cli.command()
def stats() -> None:
    print_stats()


@cli.command()
@click.option("--format", "export_format", type=click.Choice(["postgres"]), default="postgres")
def export(export_format: str) -> None:
    if export_format != "postgres":
        raise click.ClickException(f"Unsupported export format: {export_format}")
    print("Use Backend/services/courses_service.py ingest_course_data() to load JSONL into Postgres.")


if __name__ == "__main__":
    cli()
