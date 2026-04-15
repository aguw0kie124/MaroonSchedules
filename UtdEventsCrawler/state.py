"""Crawl state management for incremental UTD crawls."""

from __future__ import annotations

import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional

logger = logging.getLogger("utd_crawler.state")

BASE_DIR = Path(__file__).resolve().parent
STATE_DIR = BASE_DIR / "data" / "state"
STATE_FILE = STATE_DIR / "crawl_state.json"


class CrawlState:
    def __init__(self, state_path: Optional[Path] = None) -> None:
        self.state_path = state_path or STATE_FILE
        self._state: Dict[str, Any] = {
            "sources": {},
            "http_cache": {},
            "last_run": None,
            "run_count": 0,
        }

    def load(self) -> None:
        if self.state_path.exists():
            try:
                self._state = json.loads(self.state_path.read_text(encoding="utf-8"))
                logger.info("Loaded crawl state from %s", self.state_path)
            except (json.JSONDecodeError, OSError) as exc:
                logger.warning("Failed to load state, starting fresh: %s", exc)
        else:
            logger.info("No existing state file; starting fresh crawl.")

    def save(self) -> None:
        self.state_path.parent.mkdir(parents=True, exist_ok=True)
        self.state_path.write_text(
            json.dumps(self._state, indent=2, default=str),
            encoding="utf-8",
        )
        logger.info("Saved crawl state to %s", self.state_path)

    def update_source_state(
        self,
        source_name: str,
        *,
        event_count: int = 0,
        new_events: int = 0,
        errors: int = 0,
    ) -> None:
        previous = self._state["sources"].get(source_name, {})
        self._state["sources"][source_name] = {
            "last_crawled_at": datetime.utcnow().isoformat(),
            "event_count": event_count,
            "new_events": new_events,
            "errors": errors,
            "total_crawls": previous.get("total_crawls", 0) + 1,
        }

    @property
    def http_cache(self) -> Dict[str, Dict[str, str]]:
        return self._state.get("http_cache", {})

    @http_cache.setter
    def http_cache(self, value: Dict[str, Dict[str, str]]) -> None:
        self._state["http_cache"] = value

    def mark_run_started(self) -> None:
        self._state["last_run"] = datetime.utcnow().isoformat()
        self._state["run_count"] = self._state.get("run_count", 0) + 1

    def get_known_hashes(self) -> set[str]:
        return set(self._state.get("known_hashes", []))

    def add_known_hashes(self, hashes: set[str]) -> None:
        existing = self.get_known_hashes()
        existing.update(hashes)
        if len(existing) > 50_000:
            existing = set(list(existing)[-50_000:])
        self._state["known_hashes"] = list(existing)
