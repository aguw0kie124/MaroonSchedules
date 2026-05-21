#!/usr/bin/env python3
"""Run the backend unit tests that are stable without external services."""

from __future__ import annotations

import os
import sys
import unittest
from compileall import compile_dir
from pathlib import Path


BACKEND_TEST_MODULES = [
    "Backend.tests.test_cache_service",
    "Backend.tests.test_crowdping_flow",
    "Backend.tests.test_migrate_registry",
    "Backend.tests.test_osm_places_service",
    "Backend.tests.test_place_detail_cache",
    "Backend.tests.test_places_map_snapshot",
    "Backend.tests.test_rec_live_counts",
    "Backend.tests.test_user_repository",
]


def run_unittest_modules(module_names: list[str]) -> unittest.result.TestResult:
    print(f"+ {sys.executable} -m unittest {' '.join(module_names)}")
    loader = unittest.defaultTestLoader
    suite = loader.loadTestsFromNames(module_names)
    runner = unittest.TextTestRunner(verbosity=1)
    return runner.run(suite)


def run_unittest_discovery(start_dir: str, pattern: str) -> unittest.result.TestResult:
    print(f"+ {sys.executable} -m unittest discover -s {start_dir} -p {pattern}")
    loader = unittest.defaultTestLoader
    suite = loader.discover(start_dir=start_dir, pattern=pattern)
    runner = unittest.TextTestRunner(verbosity=1)
    return runner.run(suite)


def main() -> None:
    repo_root = Path(__file__).resolve().parent.parent
    os.chdir(repo_root)

    env = os.environ.copy()
    pythonpath_entries = [str(repo_root), str(repo_root / "Backend"), str(repo_root / "TamuEventsCrawler")]
    existing_pythonpath = env.get("PYTHONPATH")
    if existing_pythonpath:
        pythonpath_entries.append(existing_pythonpath)
    env["PYTHONPATH"] = os.pathsep.join(pythonpath_entries)
    env.setdefault("CI", "true")
    env.setdefault("DB_HOST", "127.0.0.1")
    env.setdefault("DB_CONNECT_TIMEOUT", "1")
    env.setdefault("REDIS_URL", "")
    env.setdefault("UPSTASH_REDIS_URL", "")
    env.setdefault("REDIS_HOST", "")
    os.environ.update(env)

    for entry in reversed(pythonpath_entries):
        if entry and entry not in sys.path:
            sys.path.insert(0, entry)

    print(f"+ {sys.executable} -m compileall -q Backend TamuEventsCrawler UtdEventsCrawler")
    compile_ok = all(
        compile_dir(path, quiet=1)
        for path in ["Backend", "TamuEventsCrawler", "UtdEventsCrawler"]
    )

    results = [
        run_unittest_modules(BACKEND_TEST_MODULES),
        run_unittest_discovery("TamuEventsCrawler/tests", "test_*.py"),
    ]

    try:
        from db_config import close_pool

        close_pool()
    except Exception:
        pass

    if not compile_ok or any(not result.wasSuccessful() for result in results):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
