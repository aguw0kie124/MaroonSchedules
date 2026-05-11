from __future__ import annotations

import asyncio
import logging
from pathlib import Path
from typing import Any, Dict

from http_client import CrawlerHttpClient
from state import CrawlState

from .business_catalog import parse_sheet_html, write_business_catalog
from .constants import (
    CATALOG_OUTPUT_CSV,
    CATALOG_OUTPUT_JSON,
    DEALS_OUTPUT_CSV,
    DEALS_OUTPUT_JSON,
    DEALS_OUTPUT_JSONL,
    DEFAULT_SHEET_URL,
    OUTPUT_ROOT,
    SOURCE_MAP_OUTPUT,
)
from .dedupe import deduplicate_records
from .output import write_deal_outputs
from .scrapers.century_square import crawl_century_square_events
from .scrapers.curated_promos import crawl_curated_promotions
from .scrapers.simpleview import crawl_simpleview_events
from .sources import (
    CURATED_PROMOTION_PAGES,
    DESTINATION_BRYAN_EVENTS,
    NEXT_SOURCE_CANDIDATES,
    VISIT_CSTX_EVENTS,
)

logger = logging.getLogger("tamu_crawler.business_deals.pipeline")

STATE_PATH = Path(__file__).resolve().parent / "data" / "state" / "business_deals_state.json"


def _write_next_sources_map() -> Path:
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    lines = [
        "# Next Source Candidates",
        "",
        "These official or public pages are the best follow-on sources to extend the TAMU-adjacent business feed:",
        "",
    ]
    for title, description in NEXT_SOURCE_CANDIDATES:
        lines.append(f"- **{title}**: {description}")
    SOURCE_MAP_OUTPUT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return SOURCE_MAP_OUTPUT


async def run_business_deals_pipeline(
    *,
    dry_run: bool = False,
) -> Dict[str, Any]:
    state = CrawlState(state_path=STATE_PATH)
    state.load()
    state.mark_run_started()

    async with CrawlerHttpClient(dry_run=dry_run) as http_client:
        http_client.load_conditional_cache(state.http_cache)

        if dry_run:
            state.http_cache = http_client.get_conditional_cache()
            state.save()
            return {
                "business_count": 0,
                "records": [],
                "catalog_csv": CATALOG_OUTPUT_CSV,
                "catalog_json": CATALOG_OUTPUT_JSON,
                "deals_json": DEALS_OUTPUT_JSON,
                "deals_jsonl": DEALS_OUTPUT_JSONL,
                "deals_csv": DEALS_OUTPUT_CSV,
                "next_sources": SOURCE_MAP_OUTPUT,
            }

        sheet_html, _, _ = await http_client.fetch(DEFAULT_SHEET_URL, use_conditional=False)
        business_records = parse_sheet_html(sheet_html or "")
        catalog_csv, catalog_json = write_business_catalog(business_records)

        records = []
        records.extend(
            await crawl_simpleview_events(
                http_client=http_client,
                source_name=VISIT_CSTX_EVENTS.name,
                sitemap_url=VISIT_CSTX_EVENTS.sitemap_url,
                city=VISIT_CSTX_EVENTS.city,
                area_label=VISIT_CSTX_EVENTS.area_label,
                business_records=business_records,
            )
        )
        records.extend(
            await crawl_simpleview_events(
                http_client=http_client,
                source_name=DESTINATION_BRYAN_EVENTS.name,
                sitemap_url=DESTINATION_BRYAN_EVENTS.sitemap_url,
                city=DESTINATION_BRYAN_EVENTS.city,
                area_label=DESTINATION_BRYAN_EVENTS.area_label,
                business_records=business_records,
            )
        )
        records.extend(
            await crawl_century_square_events(
                http_client=http_client,
                business_records=business_records,
            )
        )
        records.extend(
            await crawl_curated_promotions(
                http_client=http_client,
                sources=CURATED_PROMOTION_PAGES,
                business_records=business_records,
            )
        )

        deduped = deduplicate_records(records)
        deals_json, deals_jsonl, deals_csv = write_deal_outputs(deduped)
        source_map = _write_next_sources_map()

        state.http_cache = http_client.get_conditional_cache()
        state.save()

    logger.info(
        "Business deals pipeline complete: %d catalog rows, %d normalized records",
        len(business_records),
        len(deduped),
    )
    return {
        "business_count": len(business_records),
        "record_count": len(deduped),
        "catalog_csv": catalog_csv,
        "catalog_json": catalog_json,
        "deals_json": deals_json,
        "deals_jsonl": deals_jsonl,
        "deals_csv": deals_csv,
        "next_sources": source_map,
        "records": deduped,
    }


def run_business_deals_pipeline_sync(*, dry_run: bool = False) -> Dict[str, Any]:
    return asyncio.run(run_business_deals_pipeline(dry_run=dry_run))
