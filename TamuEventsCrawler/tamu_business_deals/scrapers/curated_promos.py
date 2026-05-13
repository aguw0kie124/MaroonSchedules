from __future__ import annotations

import logging
import re
from typing import Any, Iterable

from ..date_utils import infer_recurrence_rule, next_window_from_recurrence
from ..models import BusinessRecord
from ..normalizer import normalize_candidate
from ..sources import CuratedPageSource
from ..utils import clean_text
from .shared_parsers import page_text

logger = logging.getLogger("tamu_crawler.business_deals.curated")


def _build_record(
    *,
    title: str,
    description: str,
    business_name: str,
    source: CuratedPageSource,
    event_scope: str,
    deal_type: str,
    discount_text: str | None = None,
    recurrence_text: str | None = None,
) -> dict[str, Any]:
    recurrence_rule = infer_recurrence_rule(recurrence_text or f"{title} {description}")
    start_date = end_date = None
    recurring_pattern = None
    if recurrence_rule:
        recurring_pattern = recurrence_rule.pattern
        start_date, end_date = next_window_from_recurrence(recurrence_rule)
    return {
        "title": title,
        "description": description,
        "business_name": business_name,
        "location_name": business_name,
        "city": source.city,
        "source_url": source.url,
        "source_name": source.name,
        "canonical_url": source.url,
        "event_scope": event_scope,
        "deal_type": deal_type,
        "discount_text": discount_text,
        "start_date": start_date,
        "end_date": end_date,
        "recurrence_text": recurrence_text,
        "recurring_pattern": recurring_pattern,
        "raw_source_text": f"{title} {description}",
        "area_label": source.area_label,
        "tags": [source.city, source.area_label, business_name],
    }


def _parse_fridas(text: str, source: CuratedPageSource) -> list[dict[str, Any]]:
    records = [
        _build_record(
            title="Frida's Happy Hour",
            description="Mimosas at $5 from 11 AM to 2 PM and $2 off all draft beers with $5 frozen margaritas from 3 PM to 7 PM.",
            business_name=source.business_name,
            source=source,
            event_scope="promotion",
            deal_type="happy_hour",
            discount_text="Mimosas at $5; $2 off draft beers; $5 frozen margaritas",
            recurrence_text="Mon-Fri 11 AM-2 PM and 3 PM-7 PM",
        ),
        _build_record(
            title="Frida's Teacher Tuesday",
            description="Teachers get 25% off one entree with a district badge.",
            business_name=source.business_name,
            source=source,
            event_scope="promotion",
            deal_type="discount",
            discount_text="25% off one entree",
            recurrence_text="Every Tuesday",
        ),
        _build_record(
            title="Frida's Wine Wednesday",
            description="Half off all wine bottles.",
            business_name=source.business_name,
            source=source,
            event_scope="promotion",
            deal_type="discount",
            discount_text="Half off all wine bottles",
            recurrence_text="Every Wednesday",
        ),
        _build_record(
            title="Frida's Thursday Cocktail Special",
            description="BOGO half off cocktails.",
            business_name=source.business_name,
            source=source,
            event_scope="promotion",
            deal_type="discount",
            discount_text="BOGO half off cocktails",
            recurrence_text="Every Thursday",
        ),
        _build_record(
            title="Frida's Sunday Mimosa Kit",
            description="$25 Mimosa Kit that serves 5 people.",
            business_name=source.business_name,
            source=source,
            event_scope="promotion",
            deal_type="discount",
            discount_text="$25 Mimosa Kit",
            recurrence_text="Every Sunday",
        ),
    ]
    return records


def _parse_owl(text: str, source: CuratedPageSource) -> list[dict[str, Any]]:
    return [
        _build_record(
            title="The Owl Trivia Night",
            description="Trivia Night every Tuesday from 8 PM to 10 PM.",
            business_name=source.business_name,
            source=source,
            event_scope="event",
            deal_type="trivia",
            recurrence_text="Every Tuesday 8-10 PM",
        ),
        _build_record(
            title="The Owl Live Music Night",
            description="Live Music Night every Wednesday from 7 PM to 10 PM.",
            business_name=source.business_name,
            source=source,
            event_scope="event",
            deal_type="live_music",
            recurrence_text="Every Wednesday 7-10 PM",
        ),
        _build_record(
            title="The Owl Pint Night",
            description="Half-priced draft beer every Thursday.",
            business_name=source.business_name,
            source=source,
            event_scope="promotion",
            deal_type="discount",
            discount_text="Half-priced draft beer",
            recurrence_text="Every Thursday",
        ),
        _build_record(
            title="The Owl Sunday Happy Hour",
            description="All day happy hour every Sunday, plus wings specials.",
            business_name=source.business_name,
            source=source,
            event_scope="promotion",
            deal_type="happy_hour",
            discount_text="All day happy hour and wings specials",
            recurrence_text="Every Sunday all day",
        ),
        _build_record(
            title="The Owl Weekday Happy Hour",
            description="Weekday happy hour with $5 house wines, $3 wells, $1 off draft beers, and $1 off espresso martinis.",
            business_name=source.business_name,
            source=source,
            event_scope="promotion",
            deal_type="happy_hour",
            discount_text="$5 house wines; $3 wells; $1 off draft beers; $1 off espresso martinis",
            recurrence_text="Mon-Fri 4-6 PM",
        ),
    ]


def _parse_messina_hof(text: str, source: CuratedPageSource) -> list[dict[str, Any]]:
    return [
        _build_record(
            title="Messina Hof Happy Hour",
            description="Happy hour at the Estate Tasting Room & Wine Bar with wine, light bites, and specials.",
            business_name=source.business_name,
            source=source,
            event_scope="promotion",
            deal_type="happy_hour",
            discount_text="Happy hour specials",
            recurrence_text="Mon-Fri 4-6 PM",
        )
    ]


def _parse_spot_directory(text: str, source: CuratedPageSource) -> list[dict[str, Any]]:
    return [
        _build_record(
            title="The Spot on Northgate Happy Hour",
            description="Happy hour specials every single day except game days and holidays.",
            business_name=source.business_name,
            source=source,
            event_scope="promotion",
            deal_type="happy_hour",
            discount_text="Happy hour specials every day",
            recurrence_text="Every day except game days and holidays",
        )
    ]


PARSERS = {
    "fridas": _parse_fridas,
    "owl": _parse_owl,
    "messina_hof": _parse_messina_hof,
    "spot_directory": _parse_spot_directory,
}


async def crawl_curated_promotions(
    *,
    http_client: Any,
    sources: Iterable[CuratedPageSource],
    business_records: list[BusinessRecord],
) -> list[Any]:
    normalized_records = []
    for source in sources:
        try:
            body, status, _ = await http_client.fetch(source.url, use_conditional=False)
            if not body or status >= 400:
                continue
            text = page_text(body)
            parser = PARSERS[source.parser]
            for candidate in parser(text, source):
                candidate["raw_payload"] = {"source": source.name}
                candidate["raw_source_text"] = text
                normalized = normalize_candidate(candidate, business_records)
                if normalized:
                    normalized_records.append(normalized)
        except Exception as exc:
            logger.warning("Failed to parse curated promo %s: %s", source.name, exc)
    return normalized_records
