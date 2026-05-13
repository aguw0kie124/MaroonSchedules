"""Crawl state management for TAMU course crawls."""

from __future__ import annotations

import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional

logger = logging.getLogger("tamu_courses_crawler.state")

STATE_DIR = Path("data/state")
STATE_FILE = STATE_DIR / "crawl_state.json"


class CrawlState:
    def __init__(self, state_path: Optional[Path] = None) -> None:
        self.state_path = state_path or STATE_FILE
        self._state: Dict[str, Any] = {
            "sources": {},
            "http_cache": {},
            "last_run": None,
            "run_count": 0,
            "known_ids": [],
        }

    def load(self) -> None:
        if self.state_path.exists():
            try:
                self._state = json.loads(self.state_path.read_text(encoding="utf-8"))
            except Exception as exc:
                logger.warning("Failed to load state, starting fresh: %s", exc)

    def save(self) -> None:
        self.state_path.parent.mkdir(parents=True, exist_ok=True)
        self.state_path.write_text(json.dumps(self._state, indent=2, default=str), encoding="utf-8")

    def get_source_state(self, source_name: str) -> Dict[str, Any]:
        return self._state["sources"].get(source_name, {})

    def update_source_state(self, source_name: str, *, records: int = 0, errors: int = 0) -> None:
        prev = self._state["sources"].get(source_name, {})
        self._state["sources"][source_name] = {
            "last_crawled_at": datetime.utcnow().isoformat(),
            "records": records,
            "errors": errors,
            "total_crawls": prev.get("total_crawls", 0) + 1,
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

    @property
    def last_run(self) -> Optional[str]:
        return self._state.get("last_run")

    @property
    def run_count(self) -> int:
        return self._state.get("run_count", 0)

    def get_known_ids(self) -> set[str]:
        return set(self._state.get("known_ids", []))

    def add_known_ids(self, ids: set[str]) -> None:
        known = self.get_known_ids()
        known.update(ids)
        if len(known) > 100_000:
            known = set(list(known)[-100_000:])
        self._state["known_ids"] = list(known)
