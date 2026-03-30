"""HTTP client with rate limiting, robots.txt compliance, and conditional requests."""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Any, Dict, Optional, Tuple
from urllib.parse import urlparse
from urllib.robotparser import RobotFileParser

import httpx
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

logger = logging.getLogger("tamu_crawler.http")

USER_AGENT = "TAMUEventsCrawler/1.0 (+https://github.com/tamu-events-crawler; contact@tamu.edu)"


class RobotsCache:
    """Cache robots.txt parsers per domain."""

    def __init__(self) -> None:
        self._parsers: Dict[str, RobotFileParser] = {}
        self._lock = asyncio.Lock()

    async def can_fetch(self, url: str, client: httpx.AsyncClient) -> bool:
        parsed = urlparse(url)
        domain = f"{parsed.scheme}://{parsed.netloc}"
        async with self._lock:
            if domain not in self._parsers:
                rp = RobotFileParser()
                robots_url = f"{domain}/robots.txt"
                try:
                    resp = await client.get(robots_url, timeout=10)
                    if resp.status_code == 200:
                        rp.parse(resp.text.splitlines())
                    else:
                        # No robots.txt or error → allow all
                        rp.allow_all = True
                except Exception:
                    rp.allow_all = True
                self._parsers[domain] = rp

        return self._parsers[domain].can_fetch(USER_AGENT, url)


class RateLimiter:
    """Per-domain rate limiter — 1 request per second per domain."""

    def __init__(self, min_interval: float = 1.0) -> None:
        self._min_interval = min_interval
        self._last_request: Dict[str, float] = {}
        self._locks: Dict[str, asyncio.Lock] = {}
        self._global_lock = asyncio.Lock()

    async def acquire(self, url: str) -> None:
        domain = urlparse(url).netloc
        async with self._global_lock:
            if domain not in self._locks:
                self._locks[domain] = asyncio.Lock()

        async with self._locks[domain]:
            now = time.monotonic()
            last = self._last_request.get(domain, 0.0)
            wait = self._min_interval - (now - last)
            if wait > 0:
                logger.debug("Rate-limiting %s: sleeping %.2fs", domain, wait)
                await asyncio.sleep(wait)
            self._last_request[domain] = time.monotonic()


class CrawlerHttpClient:
    """Async HTTP client with rate limiting, robots.txt, conditional requests."""

    def __init__(self, dry_run: bool = False) -> None:
        self.dry_run = dry_run
        self._client: Optional[httpx.AsyncClient] = None
        self._rate_limiter = RateLimiter()
        self._robots = RobotsCache()
        self._etag_cache: Dict[str, str] = {}
        self._last_modified_cache: Dict[str, str] = {}

    async def __aenter__(self) -> "CrawlerHttpClient":
        self._client = httpx.AsyncClient(
            headers={"User-Agent": USER_AGENT},
            follow_redirects=True,
            timeout=30.0,
        )
        return self

    async def __aexit__(self, *args: Any) -> None:
        if self._client:
            await self._client.aclose()

    def set_conditional_headers(self, url: str) -> Dict[str, str]:
        """Build conditional request headers from cached values."""
        headers: Dict[str, str] = {}
        if url in self._etag_cache:
            headers["If-None-Match"] = self._etag_cache[url]
        if url in self._last_modified_cache:
            headers["If-Modified-Since"] = self._last_modified_cache[url]
        return headers

    def update_cache(self, url: str, response: httpx.Response) -> None:
        """Store ETag / Last-Modified from response."""
        if etag := response.headers.get("etag"):
            self._etag_cache[url] = etag
        if lm := response.headers.get("last-modified"):
            self._last_modified_cache[url] = lm

    def load_conditional_cache(self, cache: Dict[str, Dict[str, str]]) -> None:
        """Restore conditional request cache from state."""
        for url, headers in cache.items():
            if "etag" in headers:
                self._etag_cache[url] = headers["etag"]
            if "last_modified" in headers:
                self._last_modified_cache[url] = headers["last_modified"]

    def get_conditional_cache(self) -> Dict[str, Dict[str, str]]:
        """Export conditional request cache for state persistence."""
        cache: Dict[str, Dict[str, str]] = {}
        all_urls = set(self._etag_cache.keys()) | set(self._last_modified_cache.keys())
        for url in all_urls:
            entry: Dict[str, str] = {}
            if url in self._etag_cache:
                entry["etag"] = self._etag_cache[url]
            if url in self._last_modified_cache:
                entry["last_modified"] = self._last_modified_cache[url]
            cache[url] = entry
        return cache

    @retry(
        retry=retry_if_exception_type((httpx.TransportError, httpx.TimeoutException)),
        wait=wait_exponential(multiplier=1, min=2, max=30),
        stop=stop_after_attempt(3),
        reraise=True,
    )
    async def fetch(
        self, url: str, use_conditional: bool = True
    ) -> Tuple[Optional[str], int, Dict[str, str]]:
        """Fetch a URL with rate limiting, robots.txt, and conditional requests.

        Returns:
            (body_text | None, status_code, response_headers)
            body_text is None for 304 Not Modified or dry_run.
        """
        assert self._client is not None, "Client not initialised. Use async with."

        if self.dry_run:
            logger.info("[DRY-RUN] Would fetch: %s", url)
            return None, 0, {}

        # Robots.txt check
        if not await self._robots.can_fetch(url, self._client):
            logger.warning("Blocked by robots.txt: %s", url)
            return None, 403, {}

        # Rate limiting
        await self._rate_limiter.acquire(url)

        # Conditional headers
        headers = self.set_conditional_headers(url) if use_conditional else {}

        logger.info("Fetching: %s", url)
        response = await self._client.get(url, headers=headers)

        self.update_cache(url, response)

        if response.status_code == 304:
            logger.info("Not modified (304): %s", url)
            return None, 304, dict(response.headers)

        if response.status_code == 429:
            retry_after = int(response.headers.get("retry-after", "5"))
            logger.warning("Rate limited (429) on %s, sleeping %ds", url, retry_after)
            await asyncio.sleep(retry_after)
            raise httpx.TransportError(f"429 on {url}")

        response.raise_for_status()
        return response.text, response.status_code, dict(response.headers)
