"""Tests for Deduplicator."""

import sys
from pathlib import Path
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent.parent))

from deduper import deduplicate, _normalize_venue, _title_similar, _is_duplicate
from models import Event


def _make_event(**kwargs) -> Event:
    """Create a test event with defaults."""
    defaults = {
        "id": "tamu:test:1",
        "title": "Test Event",
        "start_time": datetime(2026, 4, 1, 18, 0),
        "source_name": "test",
        "source_url": "https://test.tamu.edu",
    }
    defaults.update(kwargs)
    return Event(**defaults)


class TestVenueNormalization:
    def test_msc_alias(self):
        assert _normalize_venue("MSC 2502") == "memorial student center"

    def test_bloc_alias(self):
        assert _normalize_venue("BLOC 123") == "blocker building"

    def test_zach_alias(self):
        assert _normalize_venue("ZACH 350") == "zachry engineering education complex"

    def test_wehner_alias(self):
        assert _normalize_venue("Wehner 101") == "wehner building"

    def test_unknown_venue(self):
        result = _normalize_venue("Some Random Building")
        assert result == "some random building"

    def test_none_venue(self):
        assert _normalize_venue(None) == ""


class TestTitleSimilarity:
    def test_identical(self):
        assert _title_similar("Pizza Night", "Pizza Night") == 100.0

    def test_very_similar(self):
        score = _title_similar("ECEN Seminar: ML", "ECEN Seminar: Machine Learning")
        assert score >= 60

    def test_different(self):
        score = _title_similar("Pizza Night", "Career Fair")
        assert score < 50


class TestDuplication:
    def test_same_id_is_duplicate(self):
        a = _make_event(id="tamu:test:1")
        b = _make_event(id="tamu:test:1")
        assert _is_duplicate(a, b) is True

    def test_same_hash_is_duplicate(self):
        a = _make_event(id="tamu:test:1", content_hash="abc123")
        b = _make_event(id="tamu:test:2", content_hash="abc123")
        assert _is_duplicate(a, b) is True

    def test_similar_title_same_time(self):
        a = _make_event(id="tamu:test:1", title="Pizza Night")
        b = _make_event(id="tamu:test:2", title="Pizza Night!")
        assert _is_duplicate(a, b) is True

    def test_different_events(self):
        a = _make_event(id="tamu:test:1", title="Pizza Night")
        b = _make_event(id="tamu:test:2", title="Career Fair",
                        start_time=datetime(2026, 4, 5, 10, 0))
        assert _is_duplicate(a, b) is False


class TestDeduplication:
    def test_removes_duplicates(self):
        events = [
            _make_event(id="tamu:src1:1", title="Pizza Night",
                        source_name="src1", food_confidence=0.9),
            _make_event(id="tamu:src2:1", title="Pizza Night!",
                        source_name="src2", food_confidence=0.8),
        ]
        result = deduplicate(events)
        assert len(result) == 1
        assert result[0].food_confidence == 0.9  # Best version picked

    def test_preserves_unique(self):
        events = [
            _make_event(id="tamu:test:1", title="Pizza Night"),
            _make_event(id="tamu:test:2", title="Career Fair",
                        start_time=datetime(2026, 4, 5, 10, 0)),
            _make_event(id="tamu:test:3", title="Yoga Class",
                        start_time=datetime(2026, 4, 3, 7, 0)),
        ]
        result = deduplicate(events)
        assert len(result) == 3

    def test_empty_list(self):
        result = deduplicate([])
        assert result == []

    def test_sets_dedupe_group_id(self):
        events = [_make_event()]
        result = deduplicate(events)
        assert result[0].dedupe_group_id is not None

    def test_sources_seen_count(self):
        events = [
            _make_event(id="tamu:src1:1", title="Pizza Night",
                        source_name="src1"),
            _make_event(id="tamu:src2:1", title="Pizza Night",
                        source_name="src2"),
            _make_event(id="tamu:src3:1", title="Pizza Night",
                        source_name="src3"),
        ]
        result = deduplicate(events)
        assert len(result) == 1
        assert result[0].sources_seen == 3
