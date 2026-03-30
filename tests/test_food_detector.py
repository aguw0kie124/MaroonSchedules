"""Tests for Food Detector v3 — two-stage precision system."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from food_detector import detect_food


# ──────────────────────────────────────────────────────────────────
# TRUE POSITIVES — should detect food
# ──────────────────────────────────────────────────────────────────


class TestTruePositives:
    """Events that should be flagged as having food."""

    def test_explicit_free_food(self):
        has_food, conf, reasons, ft = detect_food(
            "CSA Meeting — Free Food!", "Come grab some free food at our meeting."
        )
        assert has_food is True
        assert conf >= 0.9

    def test_explicit_pizza(self):
        has_food, conf, reasons, ft = detect_food(
            "IEEE General Meeting", "Pizza will be served."
        )
        assert has_food is True
        assert conf >= 0.8
        assert ft == "snacks"

    def test_catered_lunch(self):
        has_food, conf, reasons, ft = detect_food(
            "Career Center Info Session", "A catered lunch will be provided for attendees."
        )
        assert has_food is True
        assert conf >= 0.9
        assert ft == "lunch"

    def test_free_boba(self):
        has_food, conf, reasons, ft = detect_food(
            "TASA Free Boba Night", "Come enjoy free boba tea with us!"
        )
        assert has_food is True
        assert conf >= 0.8

    def test_colloquium_with_refreshments(self):
        has_food, conf, reasons, ft = detect_food(
            "ECEN Colloquium: Quantum Computing",
            "Refreshments will be served at 3:30pm before the talk."
        )
        assert has_food is True
        assert conf >= 0.85

    def test_student_org_mixer(self):
        has_food, conf, reasons, ft = detect_food(
            "PhilSA Mixer", "Join us for a mixer social event!",
            host_type="student_org"
        )
        assert has_food is True
        assert conf >= 0.3

    def test_lunch_in_title(self):
        has_food, conf, reasons, ft = detect_food(
            "Lunch and Learn: Resume Tips", "Career Center workshop with lunch."
        )
        assert has_food is True
        assert ft == "lunch"

    def test_crawfish_boil(self):
        has_food, conf, reasons, ft = detect_food(
            "Annual Crawfish Boil", "TAMU's biggest crawfish boil of the year!"
        )
        assert has_food is True
        assert conf >= 0.8

    def test_breakfast_provided(self):
        has_food, conf, reasons, ft = detect_food(
            "Morning Workshop", "Breakfast will be provided starting at 8am."
        )
        assert has_food is True
        assert ft == "breakfast"

    def test_source_prior_boost(self):
        """McFerrin events should get a source prior boost."""
        has_food, conf, reasons, ft = detect_food(
            "McFerrin Networking Night",
            "Join us for a networking social event.",
            source_name="mcferrin_events",
        )
        # Source prior boost should push this higher
        assert any("source_prior" in r for r in reasons)


# ──────────────────────────────────────────────────────────────────
# FALSE POSITIVE PREVENTION — should NOT detect food
# ──────────────────────────────────────────────────────────────────


class TestFalsePositives:
    """Events that should NOT be flagged as having food."""

    def test_tea_in_team(self):
        """'team' should not trigger tea matching."""
        has_food, conf, reasons, ft = detect_food(
            "Team Building Workshop", "Build your team skills today."
        )
        # Should NOT match on "tea" inside "team"
        assert not any("tea" in r.lower() for r in reasons if "coffee" in r or "tea" in r)

    def test_tea_in_teaching(self):
        """'teaching' should not trigger tea matching."""
        has_food, conf, reasons, ft = detect_food(
            "Teaching Excellence Award Ceremony", "Celebrating great teaching."
        )
        assert not any("tea" in r.lower() for r in reasons if "coffee" in r or "tea" in r)

    def test_tea_in_texas(self):
        """'Texas' should not trigger tea matching."""
        has_food, conf, reasons, ft = detect_food(
            "Texas A&M Research Symposium", "A showcase of Texas A&M research."
        )
        assert not any("tea_with_context" in r for r in reasons)

    def test_virtual_event(self):
        """Virtual events should not have food."""
        has_food, conf, reasons, ft = detect_food(
            "Virtual Career Fair", "Join our online career fair via Zoom."
        )
        assert has_food is False
        assert conf == 0.0

    def test_food_science_course(self):
        """Food science courses are not food events."""
        has_food, conf, reasons, ft = detect_food(
            "Food Science 101 Lecture",
            "Introduction to food science and food safety principles."
        )
        # The anti-pattern stripping should prevent false match
        assert conf < 0.5 or not has_food

    def test_seminar_alone(self):
        """A generic seminar without food cues should not score as food."""
        has_food, conf, reasons, ft = detect_food(
            "Math Seminar: Algebraic Topology",
            "A seminar on recent advances in algebraic topology."
        )
        # Seminar alone should be suppressed
        if has_food:
            assert conf < 0.5

    def test_social_alone_non_org(self):
        """'Social' alone from a department should not score as food."""
        has_food, conf, reasons, ft = detect_food(
            "Social Sciences Research Forum",
            "A forum on social research methods.",
            host_type="department",
        )
        # Should be suppressed or very low
        assert conf < 0.35 or not has_food

    def test_webinar(self):
        """Webinar should not have food."""
        has_food, conf, reasons, ft = detect_food(
            "Webinar: Data Science Best Practices",
            "An online webinar about data science."
        )
        assert has_food is False

    def test_food_bank_not_food_event(self):
        """Food bank/drive are not 'free food' events."""
        has_food, conf, reasons, ft = detect_food(
            "Annual Food Bank Drive",
            "Help collect canned food for the local food bank."
        )
        # Anti-pattern should strip "food bank" references
        assert conf < 0.5


# ──────────────────────────────────────────────────────────────────
# FOOD TYPE CLASSIFICATION
# ──────────────────────────────────────────────────────────────────


class TestFoodTypes:
    """Test food type classification."""

    def test_lunch_type(self):
        _, _, _, ft = detect_food("Lunch Workshop", "Lunch will be served.")
        assert ft == "lunch"

    def test_dinner_type(self):
        _, _, _, ft = detect_food("Dinner Social", "Dinner provided for attendees.")
        assert ft == "dinner"

    def test_snacks_type(self):
        _, _, _, ft = detect_food("Pizza Night", "Free pizza and drinks!")
        assert ft == "snacks"

    def test_reception_type(self):
        _, _, _, ft = detect_food(
            "Awards Reception", "Join us for a networking reception."
        )
        assert ft == "reception"
