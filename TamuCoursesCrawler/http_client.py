"""HTTP client with rate limiting, robots.txt compliance, and conditional requests."""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Any, Dict, Optional, Tuple
from urllib.parse import urlparse
from urllib.robotparser import RobotFileParser

import httpx
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

logger = logging.getLogger("tamu_courses_crawler.http")

DEFAULT_USER_AGENT = "TAMUCoursesCrawler/1.0 (+https://maroonlife.app)"


class RobotsCache:
    def __init__(self) -> None:
        self._parsers: Dict[str, RobotFileParser] = {}
        self._lock = asyncio.Lock()

    async def can_fetch(self, url: str, client: httpx.AsyncClient, user_agent: str) -> bool:
        parsed = urlparse(url)
        domain = f"{parsed.scheme}://{parsed.netloc}"
        async with self._lock:
            if domain not in self._parsers:
                parser = RobotFileParser()
                robots_url = f"{domain}/robots.txt"
                try:
                    response = await client.get(robots_url, timeout=10)
                    if response.status_code == 200:
                        parser.parse(response.text.splitlines())
                    else:
                        parser.allow_all = True
                except Exception:
                    parser.allow_all = True
                self._parsers[domain] = parser
        return self._parsers[domain].can_fetch(user_agent, url)


class RateLimiter:
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
                await asyncio.sleep(wait)
            self._last_request[domain] = time.monotonic()


class CrawlerHttpClient:
    def __init__(
        self,
        dry_run: bool = False,
        *,
        user_agent: str = DEFAULT_USER_AGENT,
        min_interval: float = 1.0,
    ) -> None:
        self.dry_run = dry_run
        self.user_agent = user_agent
        self._client: Optional[httpx.AsyncClient] = None
        self._rate_limiter = RateLimiter(min_interval=min_interval)
        self._robots = RobotsCache()
        self._etag_cache: Dict[str, str] = {}
        self._last_modified_cache: Dict[str, str] = {}

    async def __aenter__(self) -> "CrawlerHttpClient":
        self._client = httpx.AsyncClient(
            headers={"User-Agent": self.user_agent},
            follow_redirects=True,
            timeout=30.0,
        )
        return self

    async def __aexit__(self, *args: Any) -> None:
        if self._client:
            await self._client.aclose()

    def set_conditional_headers(self, url: str) -> Dict[str, str]:
        headers: Dict[str, str] = {}
        if url in self._etag_cache:
            headers["If-None-Match"] = self._etag_cache[url]
        if url in self._last_modified_cache:
            headers["If-Modified-Since"] = self._last_modified_cache[url]
        return headers

    def update_cache(self, url: str, response: httpx.Response) -> None:
        if etag := response.headers.get("etag"):
            self._etag_cache[url] = etag
        if last_modified := response.headers.get("last-modified"):
            self._last_modified_cache[url] = last_modified

    def load_conditional_cache(self, cache: Dict[str, Dict[str, str]]) -> None:
        for url, headers in cache.items():
            if "etag" in headers:
                self._etag_cache[url] = headers["etag"]
            if "last_modified" in headers:
                self._last_modified_cache[url] = headers["last_modified"]

    def get_conditional_cache(self) -> Dict[str, Dict[str, str]]:
        cache: Dict[str, Dict[str, str]] = {}
        for url in set(self._etag_cache) | set(self._last_modified_cache):
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
    async def fetch(self, url: str, use_conditional: bool = True) -> Tuple[Optional[str], int, Dict[str, str]]:
        assert self._client is not None, "Client not initialised. Use async with."

        if self.dry_run:
            logger.info("[DRY-RUN] Would fetch %s", url)
            return None, 0, {}

        if not await self._robots.can_fetch(url, self._client, self.user_agent):
            logger.warning("Blocked by robots.txt: %s", url)
            return None, 403, {}

        await self._rate_limiter.acquire(url)
        headers = self.set_conditional_headers(url) if use_conditional else {}
        response = await self._client.get(url, headers=headers)
        self.update_cache(url, response)

        if response.status_code == 304:
            return None, 304, dict(response.headers)

        if response.status_code == 429:
            retry_after = int(response.headers.get("retry-after", "5"))
            await asyncio.sleep(retry_after)
            raise httpx.TransportError(f"429 on {url}")

        response.raise_for_status()
        return response.text, response.status_code, dict(response.headers)
