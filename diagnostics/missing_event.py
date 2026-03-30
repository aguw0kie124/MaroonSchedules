"""Missing event diagnostics — debug why specific events are not found.

Usage:
    python crawler.py diagnose --query "Good Bull Pitch"

Reports:
    - All source URLs checked
    - Whether event was blocked by robots, missed discovery, or filtered
    - Closest fuzzy matches in crawled data
    - Pages where matches were found
    - McFerrin program page reachability
"""

from __future__ import annotations

import json
import logging
import os
import re
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from rapidfuzz import fuzz

logger = logging.getLogger("tamu_crawler.diagnostics")

OUTPUT_FILE = Path("data/normalized/events.jsonl")
RAW_DIR = Path("data/raw")
STATE_FILE = Path("data/state/crawl_state.json")

# McFerrin program URLs to check specifically
MCFERRIN_PROGRAM_URLS = [
    "https://mcferrin.tamu.edu/programs/",
    "https://mcferrin.tamu.edu/events/",
    "https://mcferrin.tamu.edu/program/good-bull-pitch/",
    "https://mcferrin.tamu.edu/program/aggie-pitch/",
    "https://mcferrin.tamu.edu/program/aggie-startup-summit/",
    "https://mcferrin.tamu.edu/program/aggie-100-career-fair/",
    "https://mcferrin.tamu.edu/program/ideas-challenge/",
    "https://mcferrin.tamu.edu/program/box-party/",
    "https://mcferrin.tamu.edu/program/weekend-startup/",
]

# Target queries for pitch/startup events
PITCH_STARTUP_QUERIES = [
    "Good Bull Pitch",
    "Aggie PITCH",
    "Aggie Startup Summit",
    "Aggie 100 Career Fair",
    "Ideas Challenge",
    "Box Party",
    "Weekend Startup",
    "McFerrin Mashup",
    "Startup 101",
]


def _load_events() -> List[Dict[str, Any]]:
    """Load crawled events from JSONL."""
    events = []
    if OUTPUT_FILE.exists():
        with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    try:
                        events.append(json.loads(line))
                    except json.JSONDecodeError:
                        continue
    return events


def _load_raw_pages() -> Dict[str, str]:
    """Load cached raw responses from data/raw/."""
    pages: Dict[str, str] = {}
    if RAW_DIR.exists():
        for filepath in RAW_DIR.iterdir():
            if filepath.is_file():
                try:
                    pages[filepath.name] = filepath.read_text(encoding="utf-8")[:50000]
                except Exception:
                    continue
    return pages


def _load_state() -> Dict[str, Any]:
    """Load crawl state."""
    if STATE_FILE.exists():
        try:
            with open(STATE_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {}


def _fuzzy_search_events(
    query: str, events: List[Dict[str, Any]], threshold: int = 50
) -> List[Tuple[Dict[str, Any], float, str]]:
    """Search events by fuzzy title/description match.

    Returns: [(event, score, match_field), ...]
    """
    results: List[Tuple[Dict[str, Any], float, str]] = []
    query_lower = query.lower()

    for event in events:
        title = event.get("title", "")
        description = event.get("description", "") or ""

        # Title match
        title_score = fuzz.partial_ratio(query_lower, title.lower())
        if title_score >= threshold:
            results.append((event, title_score, "title"))

        # Description match
        desc_score = fuzz.partial_ratio(query_lower, description.lower()[:500])
        if desc_score >= threshold and desc_score > title_score:
            results.append((event, desc_score, "description"))

    # Sort by score descending
    results.sort(key=lambda x: -x[1])
    return results[:20]


def _search_raw_pages(query: str, pages: Dict[str, str]) -> List[Tuple[str, int]]:
    """Search raw cached responses for query occurrences.

    Returns: [(page_name, occurrence_count), ...]
    """
    results: List[Tuple[str, int]] = []
    query_lower = query.lower()

    for page_name, content in pages.items():
        content_lower = content.lower()
        count = content_lower.count(query_lower)
        if count > 0:
            results.append((page_name, count))

    results.sort(key=lambda x: -x[1])
    return results


def diagnose_missing_event(query: str) -> str:
    """Run full diagnostic for a missing event query.

    Returns a formatted diagnostic report string.
    """
    report_lines: List[str] = []
    report_lines.append(f"\n{'='*70}")
    report_lines.append(f"  DIAGNOSTIC REPORT: \"{query}\"")
    report_lines.append(f"  Generated: {datetime.utcnow().isoformat()}")
    report_lines.append(f"{'='*70}\n")

    # --- Load data ---
    events = _load_events()
    raw_pages = _load_raw_pages()
    state = _load_state()

    report_lines.append(f"📊 Data loaded:")
    report_lines.append(f"   Crawled events:    {len(events)}")
    report_lines.append(f"   Raw cached pages:  {len(raw_pages)}")
    report_lines.append(f"   Sources in state:  {len(state.get('sources', {}))}")
    report_lines.append("")

    # --- 1. Search crawled events ---
    report_lines.append("─" * 50)
    report_lines.append("1. FUZZY SEARCH IN CRAWLED EVENTS")
    report_lines.append("─" * 50)

    matches = _fuzzy_search_events(query, events)
    if matches:
        report_lines.append(f"   Found {len(matches)} fuzzy match(es):\n")
        for event, score, field in matches[:10]:
            report_lines.append(f"   [{score:.0f}%] {event.get('title', 'N/A')[:60]}")
            report_lines.append(f"         Source: {event.get('source_name', 'N/A')}")
            report_lines.append(f"         URL:    {event.get('event_url', 'N/A')}")
            report_lines.append(f"         Date:   {event.get('start_time', 'N/A')}")
            report_lines.append(f"         Match:  {field}")
            if event.get("crawl_path"):
                report_lines.append(f"         Path:   {' → '.join(event['crawl_path'][:3])}")
            report_lines.append("")
    else:
        report_lines.append("   ❌ No fuzzy matches found in crawled events.\n")

    # --- 2. Search raw cached pages ---
    report_lines.append("─" * 50)
    report_lines.append("2. SEARCH IN RAW CACHED PAGES")
    report_lines.append("─" * 50)

    raw_matches = _search_raw_pages(query, raw_pages)
    if raw_matches:
        report_lines.append(f"   Found \"{query}\" in {len(raw_matches)} cached page(s):\n")
        for page_name, count in raw_matches[:15]:
            report_lines.append(f"   📄 {page_name}: {count} occurrence(s)")
    else:
        report_lines.append(f"   ❌ \"{query}\" not found in any cached raw page.\n")
    report_lines.append("")

    # --- 3. Source coverage check ---
    report_lines.append("─" * 50)
    report_lines.append("3. SOURCE COVERAGE")
    report_lines.append("─" * 50)

    sources_checked = state.get("sources", {})
    mcferrin_sources = {k: v for k, v in sources_checked.items() if "mcferrin" in k.lower()}
    if mcferrin_sources:
        report_lines.append("   McFerrin sources crawled:")
        for name, info in mcferrin_sources.items():
            status = "✅" if info.get("event_count", 0) > 0 else "⚠️"
            report_lines.append(
                f"   {status} {name}: {info.get('event_count', 0)} events "
                f"(last: {info.get('last_crawled_at', 'never')})"
            )
    else:
        report_lines.append("   ⚠️ No McFerrin sources found in crawl state!")
    report_lines.append("")

    # Check other relevant sources
    relevant_keywords = ["career", "business", "mays", "engineering", "sec", "getinvolved"]
    relevant_sources = {
        k: v for k, v in sources_checked.items()
        if any(kw in k.lower() for kw in relevant_keywords)
    }
    if relevant_sources:
        report_lines.append("   Other relevant sources:")
        for name, info in sorted(relevant_sources.items()):
            status = "✅" if info.get("event_count", 0) > 0 else "⚠️"
            errors = info.get("errors", 0)
            err_label = f" ❗{errors} errors" if errors else ""
            report_lines.append(
                f"   {status} {name}: {info.get('event_count', 0)} events{err_label}"
            )
    report_lines.append("")

    # --- 4. McFerrin program URL check ---
    report_lines.append("─" * 50)
    report_lines.append("4. MCFERRIN PROGRAM PAGE STATUS")
    report_lines.append("─" * 50)

    for url in MCFERRIN_PROGRAM_URLS:
        # Check if this URL appears in any raw cache
        url_slug = url.split("/")[-2] if url.endswith("/") else url.split("/")[-1]
        found_in_cache = any(url_slug in page_name for page_name in raw_pages.keys())
        found_in_content = any(url in content for content in raw_pages.values())

        if found_in_cache or found_in_content:
            report_lines.append(f"   ✅ {url}")
        else:
            report_lines.append(f"   ❌ {url} — NOT in cache (may not have been crawled)")
    report_lines.append("")

    # --- 5. Possible reasons for missing ---
    report_lines.append("─" * 50)
    report_lines.append("5. POSSIBLE REASONS FOR MISSING EVENT")
    report_lines.append("─" * 50)

    reasons: List[str] = []

    # Check if no events at all
    if not events:
        reasons.append("No events have been crawled yet. Run: python crawler.py crawl --all")

    # Check if McFerrin not crawled
    if not mcferrin_sources:
        reasons.append("McFerrin source not configured or not crawled. Check sources.yaml.")

    # Check if mcferrin has errors
    for name, info in mcferrin_sources.items():
        if info.get("errors", 0) > 0:
            reasons.append(f"McFerrin source '{name}' had {info['errors']} error(s).")

    # Check if event was found in raw but not in output
    if raw_matches and not matches:
        reasons.append(
            f"\"{query}\" appears in raw pages but NOT in normalised output. "
            "Possible causes: campus filter, date parsing failure, or dedup."
        )

    # Check if it's a program page without dates
    if "pitch" in query.lower() or "startup" in query.lower():
        reasons.append(
            "Program pages (like Good Bull Pitch) may not have structured dates. "
            "Events are extracted from page content with fuzzy date parsing."
        )

    if not reasons:
        if matches:
            reasons.append("Event WAS found! Check the fuzzy matches above.")
        else:
            reasons.append(
                "Event not found in any source. Possible causes:\n"
                "   - Event hasn't been published yet\n"
                "   - Page uses JavaScript rendering (not crawlable with requests)\n"
                "   - robots.txt is blocking the crawler\n"
                "   - Event is on a page not in the source registry"
            )

    for i, reason in enumerate(reasons, 1):
        report_lines.append(f"   {i}. {reason}")
    report_lines.append("")

    # --- 6. Recommendations ---
    report_lines.append("─" * 50)
    report_lines.append("6. RECOMMENDATIONS")
    report_lines.append("─" * 50)
    report_lines.append("   • Run a full crawl: python crawler.py crawl --all --verbose")
    report_lines.append("   • Check McFerrin pages manually in browser")
    report_lines.append("   • Verify robots.txt allows crawling: https://mcferrin.tamu.edu/robots.txt")
    report_lines.append("   • Check if event uses JavaScript rendering (needs browser-based scraping)")
    report_lines.append(f"\n{'='*70}\n")

    return "\n".join(report_lines)


def diagnose_all_targets() -> str:
    """Run diagnostics for all known pitch/startup target queries."""
    reports: List[str] = []
    for query in PITCH_STARTUP_QUERIES:
        reports.append(diagnose_missing_event(query))
    return "\n".join(reports)
