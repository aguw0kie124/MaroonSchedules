from __future__ import annotations

import logging
import xml.etree.ElementTree as ET
from typing import Any, Callable

from ..models import BusinessRecord
from ..normalizer import normalize_candidate
from .shared_parsers import parse_simpleview_event_page, parse_simpleview_offer_page

logger = logging.getLogger("tamu_crawler.business_deals.simpleview")


def _sitemap_urls(xml_text: str) -> list[str]:
    root = ET.fromstring(xml_text)
    namespace = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    return [node.text.strip() for node in root.findall(".//s:loc", namespace) if node.text]


async def crawl_simpleview_sitemap(
    *,
    http_client: Any,
    source_name: str,
    sitemap_url: str,
    city: str,
    business_records: list[BusinessRecord],
    parser: Callable[..., dict[str, Any] | None],
    area_label: str | None = None,
) -> list[Any]:
    xml_text, status, _ = await http_client.fetch(sitemap_url, use_conditional=False)
    if not xml_text or status >= 400:
        return []

    records = []
    for url in _sitemap_urls(xml_text):
        try:
            body, page_status, _ = await http_client.fetch(url, use_conditional=False)
            if not body or page_status >= 400:
                continue
            candidate = parser(
                body,
                url,
                source_name=source_name,
                city=city,
                area_label=area_label,
            )
            if not candidate:
                continue
            normalized = normalize_candidate(candidate, business_records)
            if normalized:
                records.append(normalized)
        except Exception as exc:
            logger.warning("Failed to parse %s from %s: %s", source_name, url, exc)
    return records


async def crawl_simpleview_events(
    *,
    http_client: Any,
    source_name: str,
    sitemap_url: str,
    city: str,
    business_records: list[BusinessRecord],
    area_label: str | None = None,
) -> list[Any]:
    return await crawl_simpleview_sitemap(
        http_client=http_client,
        source_name=source_name,
        sitemap_url=sitemap_url,
        city=city,
        business_records=business_records,
        parser=parse_simpleview_event_page,
        area_label=area_label,
    )


async def crawl_simpleview_offers(
    *,
    http_client: Any,
    source_name: str,
    sitemap_url: str,
    city: str,
    business_records: list[BusinessRecord],
    area_label: str | None = None,
) -> list[Any]:
    return await crawl_simpleview_sitemap(
        http_client=http_client,
        source_name=source_name,
        sitemap_url=sitemap_url,
        city=city,
        business_records=business_records,
        parser=parse_simpleview_offer_page,
        area_label=area_label,
    )
