"""Crawl state management for incremental crawls."""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional

logger = logging.getLogger("tamu_crawler.state")

STATE_DIR = Path("data/state")
STATE_FILE = STATE_DIR / "crawl_state.json"


class CrawlState:
    """Manages crawl state for incremental updates.

    State file stores per-source metadata and the HTTP conditional-request cache.
    """

    def __init__(self, state_path: Optional[Path] = None) -> None:
        self.state_path = state_path or STATE_FILE
        self._state: Dict[str, Any] = {
            "sources": {},
            "http_cache": {},
            "last_run": None,
            "run_count": 0,
        }

    def load(self) -> None:
        """Load state from disk."""
        if self.state_path.exists():
            try:
                with open(self.state_path, "r", encoding="utf-8") as f:
                    self._state = json.load(f)
                logger.info("Loaded crawl state from %s", self.state_path)
            except (json.JSONDecodeError, IOError) as exc:
                logger.warning("Failed to load state, starting fresh: %s", exc)
        else:
            logger.info("No existing state file; starting fresh crawl.")

    def save(self) -> None:
        """Persist state to disk."""
        self.state_path.parent.mkdir(parents=True, exist_ok=True)
        with open(self.state_path, "w", encoding="utf-8") as f:
            json.dump(self._state, f, indent=2, default=str)
        logger.info("Saved crawl state to %s", self.state_path)

    # ------------------------------------------------------------------
    # Per-source state
    # ------------------------------------------------------------------

    def get_source_state(self, source_name: str) -> Dict[str, Any]:
        return self._state["sources"].get(source_name, {})

    def update_source_state(
        self,
        source_name: str,
        *,
        event_count: int = 0,
        new_events: int = 0,
        errors: int = 0,
    ) -> None:
        prev = self._state["sources"].get(source_name, {})
        self._state["sources"][source_name] = {
            "last_crawled_at": datetime.utcnow().isoformat(),
            "event_count": event_count,
            "new_events": new_events,
            "errors": errors,
            "total_crawls": prev.get("total_crawls", 0) + 1,
        }

    # ------------------------------------------------------------------
    # HTTP conditional-request cache
    # ------------------------------------------------------------------

    @property
    def http_cache(self) -> Dict[str, Dict[str, str]]:
        return self._state.get("http_cache", {})

    @http_cache.setter
    def http_cache(self, value: Dict[str, Dict[str, str]]) -> None:
        self._state["http_cache"] = value

    # ------------------------------------------------------------------
    # Run metadata
    # ------------------------------------------------------------------

    def mark_run_started(self) -> None:
        self._state["last_run"] = datetime.utcnow().isoformat()
        self._state["run_count"] = self._state.get("run_count", 0) + 1

    @property
    def last_run(self) -> Optional[str]:
        return self._state.get("last_run")

    @property
    def run_count(self) -> int:
        return self._state.get("run_count", 0)

    # ------------------------------------------------------------------
    # Known event hashes (for dedup across runs)
    # ------------------------------------------------------------------

    def get_known_hashes(self) -> set:
        return set(self._state.get("known_hashes", []))

    def add_known_hashes(self, hashes: set) -> None:
        existing = self.get_known_hashes()
        existing.update(hashes)
        # Keep only last 50k hashes to bound memory
        if len(existing) > 50_000:
            existing = set(list(existing)[-50_000:])
        self._state["known_hashes"] = list(existing)
