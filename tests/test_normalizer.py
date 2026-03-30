"""Tests for Normalizer v3."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from normalizer import normalize_event, _is_college_station, _is_undergrad_relevant


class TestCampusFilter:
    def test_college_station_event(self):
        event = {"title": "Pizza Night", "location": "MSC 2502"}
        assert _is_college_station(event) is True

    def test_galveston_filtered(self):
        event = {"title": "Beach Social", "location": "TAMU Galveston"}
        assert _is_college_station(event) is False

    def test_qatar_filtered(self):
        event = {"title": "Research Talk", "location": "TAMU Qatar"}
        assert _is_college_station(event) is False

    def test_virtual_only_filtered(self):
        event = {"title": "Online Only Webinar", "location": "Virtual Only"}
        assert _is_college_station(event) is False

    def test_tamu_mentioned_keeps_event(self):
        """Events mentioning 'tamu' with a city should be kept (not satellite campus)."""
        event = {"title": "TAMU professor presents in Austin", "description": "TAMU research talk"}
        assert _is_college_station(event) is True

    def test_tamu_satellite_filtered(self):
        """TAMU satellite campuses should be filtered."""
        event = {"title": "Talk at TAMU Galveston", "location": "TAMU Galveston campus"}
        assert _is_college_station(event) is False


class TestUndergradFilter:
    def test_undergrad_event(self):
        event = {"title": "Student Social Night"}
        assert _is_undergrad_relevant(event) is True

    def test_faculty_only_filtered(self):
        event = {"title": "Faculty Only Workshop"}
        assert _is_undergrad_relevant(event) is False

    def test_staff_only_filtered(self):
        event = {"title": "Staff Only Training"}
        assert _is_undergrad_relevant(event) is False


class TestNormalization:
    def test_basic_event_normalized(self):
        raw = {
            "id": "tamu:test:1",
            "title": "Test Event",
            "start_time": "2026-04-01T18:00:00",
            "source_name": "main_calendar",
            "source_url": "https://calendar.tamu.edu/test",
        }
        event = normalize_event(raw)
        assert event is not None
        assert event.title == "Test Event"
        assert event.campus == "college_station"

    def test_no_start_time_filtered(self):
        raw = {
            "id": "tamu:test:2",
            "title": "No Date Event",
            "source_name": "test",
            "source_url": "https://test.tamu.edu",
        }
        event = normalize_event(raw)
        assert event is None

    def test_category_flags_set(self):
        raw = {
            "id": "tamu:test:3",
            "title": "Free Pizza Mixer",
            "description": "Come for free pizza and socializing!",
            "start_time": "2026-04-01T18:00:00",
            "source_name": "student_activities",
            "source_url": "https://calendar.tamu.edu/test",
        }
        event = normalize_event(raw)
        assert event is not None
        assert event.food == 1
        assert event.has_food is True
        assert event.food_confidence > 0

    def test_department_mapped(self):
        raw = {
            "id": "tamu:test:4",
            "title": "Engineering Info Session",
            "start_time": "2026-04-01T18:00:00",
            "source_name": "engineering",
            "source_url": "https://calendar.tamu.edu/engineering",
        }
        event = normalize_event(raw)
        assert event is not None
        assert event.department_code == "ENGR"

    def test_source_links_populated(self):
        raw = {
            "id": "tamu:test:5",
            "title": "Test Event",
            "start_time": "2026-04-01T18:00:00",
            "source_name": "test",
            "source_url": "https://test.tamu.edu/events",
            "event_url": "https://test.tamu.edu/event/1",
            "source_links": ["https://test.tamu.edu/source"],
        }
        event = normalize_event(raw)
        assert event is not None
        assert len(event.source_links) >= 2
