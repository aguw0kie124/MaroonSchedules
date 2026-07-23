"""Lightweight web search for RevAI.

Prefers a proper search API when a key is configured (Tavily — LLM-friendly,
free tier), and falls back to a keyless DuckDuckGo HTML scrape so it works out
of the box. Always best-effort: any failure returns [] and the caller answers
from general knowledge instead.
"""

from __future__ import annotations

import logging
import os
import re
from typing import Dict, List

import requests

logger = logging.getLogger("backend.web_search")

_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0 Safari/537.36"
)
_TIMEOUT = 8.0

_DDG_RESULT_RE = re.compile(
    r'<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>(.*?)</a>', re.S
)
_DDG_SNIPPET_RE = re.compile(r'class="result__snippet"[^>]*>(.*?)</a>', re.S)
_TAG_RE = re.compile(r"<[^>]+>")


def _clean(text: str) -> str:
    text = _TAG_RE.sub("", text or "")
    for a, b in (("&amp;", "&"), ("&#x27;", "'"), ("&quot;", '"'), ("&#39;", "'"), ("&lt;", "<"), ("&gt;", ">")):
        text = text.replace(a, b)
    return text.strip()


def _tavily(query: str, max_results: int) -> List[Dict[str, str]] | None:
    key = (os.getenv("TAVILY_API_KEY") or "").strip()
    if not key:
        return None
    resp = requests.post(
        "https://api.tavily.com/search",
        json={
            "api_key": key,
            "query": query,
            "max_results": max_results,
            "search_depth": "basic",
        },
        timeout=_TIMEOUT,
    )
    resp.raise_for_status()
    payload = resp.json()
    return [
        {"title": r.get("title", ""), "snippet": r.get("content", ""), "url": r.get("url", "")}
        for r in payload.get("results", [])
    ][:max_results]


def _duckduckgo(query: str, max_results: int) -> List[Dict[str, str]]:
    resp = requests.post(
        "https://html.duckduckgo.com/html/",
        data={"q": query},
        headers={"User-Agent": _UA},
        timeout=_TIMEOUT,
    )
    resp.raise_for_status()
    html = resp.text
    hits = _DDG_RESULT_RE.findall(html)
    snippets = _DDG_SNIPPET_RE.findall(html)
    results: List[Dict[str, str]] = []
    for i, (url, title) in enumerate(hits[:max_results]):
        results.append(
            {
                "title": _clean(title),
                "snippet": _clean(snippets[i]) if i < len(snippets) else "",
                "url": url,
            }
        )
    return results


def _ddg_instant_answer(query: str, max_results: int) -> List[Dict[str, str]]:
    """DuckDuckGo Instant Answer API — keyless and unblocked, but only returns
    good data for entities/definitions (not local/current queries)."""
    resp = requests.get(
        "https://api.duckduckgo.com/",
        params={"q": query, "format": "json", "no_html": 1, "skip_disambig": 1},
        headers={"User-Agent": _UA},
        timeout=_TIMEOUT,
    )
    payload = resp.json()
    results: List[Dict[str, str]] = []
    if payload.get("Abstract"):
        results.append(
            {
                "title": payload.get("Heading", ""),
                "snippet": payload["Abstract"],
                "url": payload.get("AbstractURL", ""),
            }
        )
    for topic in payload.get("RelatedTopics", []):
        if len(results) >= max_results:
            break
        if isinstance(topic, dict) and topic.get("Text"):
            results.append(
                {
                    "title": topic.get("Text", "")[:60],
                    "snippet": topic.get("Text", ""),
                    "url": topic.get("FirstURL", ""),
                }
            )
    return results


def search(query: str, max_results: int = 5) -> List[Dict[str, str]]:
    """Return [{title, snippet, url}] for a query, best-effort (never raises).

    Tries providers in order of quality and returns the first with results:
    Tavily (needs TAVILY_API_KEY) -> DuckDuckGo HTML -> DuckDuckGo Instant Answer.
    An empty list means the caller should answer from general knowledge.
    """
    query = (query or "").strip()
    if not query:
        return []

    providers = (
        ("tavily", _tavily),
        ("duckduckgo_html", _duckduckgo),
        ("duckduckgo_instant", _ddg_instant_answer),
    )
    for name, provider in providers:
        try:
            results = provider(query, max_results)
            if results:
                return results
        except Exception as exc:  # noqa: BLE001
            logger.warning("%s search failed: %s", name, exc)
    return []
