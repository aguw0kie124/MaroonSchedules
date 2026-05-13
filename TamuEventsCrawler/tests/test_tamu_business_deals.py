from __future__ import annotations

import unittest
from datetime import datetime

from tamu_business_deals.date_utils import infer_recurrence_rule, parse_time_range
from tamu_business_deals.dedupe import deduplicate_records
from tamu_business_deals.models import BusinessRecord, DealRecord
from tamu_business_deals.normalizer import normalize_candidate


class TamuBusinessDealsTests(unittest.TestCase):
    def test_parse_time_range_infers_missing_meridian(self) -> None:
        start, end = parse_time_range("6 - 7:30 PM")
        self.assertIsNotNone(start)
        self.assertIsNotNone(end)
        self.assertEqual(start.hour, 18)
        self.assertEqual(start.minute, 0)
        self.assertEqual(end.hour, 19)
        self.assertEqual(end.minute, 30)

    def test_infer_recurrence_prefers_weekly_pattern(self) -> None:
        rule = infer_recurrence_rule(
            "Every Tuesday 6 - 7:30 PM. First Tuesday of the month meetup.",
            time_hint="6 - 7:30 PM",
        )
        self.assertIsNotNone(rule)
        assert rule is not None
        self.assertEqual(rule.pattern, "weekly:TU")
        self.assertEqual(rule.weekdays, [1])
        self.assertEqual(rule.start_time.hour, 18)
        self.assertEqual(rule.end_time.hour, 19)

    def test_normalize_candidate_builds_promotion_window(self) -> None:
        business_records = [
            BusinessRecord(
                name="The Owl BCS",
                category="bar",
                address="620 University Dr",
                city="College Station",
            )
        ]
        record = normalize_candidate(
            {
                "title": "Trivia Tuesday at The Owl",
                "description": "Every Tuesday with $5 pitchers and prizes.",
                "business_name": "The Owl BCS",
                "location_name": "The Owl BCS",
                "address": "620 University Dr",
                "city": "College Station",
                "source_url": "https://example.com/owl/trivia",
                "source_name": "curated_promos",
                "event_scope": "promotion",
                "recurrence_text": "Every Tuesday 6 - 7:30 PM",
                "time_text": "6 - 7:30 PM",
                "area_label": "Northgate",
                "tags": ["Northgate", "Trivia"],
            },
            business_records,
        )
        self.assertIsNotNone(record)
        assert record is not None
        self.assertEqual(record.category, "Promotions")
        self.assertEqual(record.event_scope, "promotion")
        self.assertEqual(record.recurring_pattern, "weekly:TU")
        self.assertIsNotNone(record.start_date)
        self.assertIsNotNone(record.end_date)
        assert record.start_date is not None
        assert record.end_date is not None
        self.assertEqual(record.start_date.weekday(), 1)
        self.assertGreater(record.end_date, record.start_date)

    def test_deduplicate_records_merges_duplicate_metadata(self) -> None:
        start = datetime(2026, 5, 12, 18, 0, 0)
        end = datetime(2026, 5, 12, 19, 30, 0)
        primary = DealRecord(
            title="Trivia Tuesday",
            description=None,
            business_name="The Owl BCS",
            category="Promotions",
            source_url="https://example.com/owl/trivia",
            canonical_url="https://example.com/owl/trivia/",
            source_name="source_a",
            location_name="The Owl BCS",
            city="College Station",
            start_date=start,
            end_date=end,
            tags=["Northgate"],
            event_scope="promotion",
        )
        duplicate = DealRecord(
            title="Trivia Tuesday",
            description="Weekly trivia with prizes.",
            business_name="The Owl BCS",
            category="Promotions",
            source_url="https://example.com/owl/trivia/",
            canonical_url="https://example.com/owl/trivia",
            source_name="source_b",
            location_name="The Owl BCS",
            city="College Station",
            start_date=start,
            end_date=end,
            discount_text="$5 pitchers",
            tags=["Trivia"],
            event_scope="promotion",
        )

        deduped = deduplicate_records([primary, duplicate])
        self.assertEqual(len(deduped), 1)
        self.assertEqual(deduped[0].description, "Weekly trivia with prizes.")
        self.assertEqual(deduped[0].discount_text, "$5 pitchers")
        self.assertCountEqual(deduped[0].tags, ["Northgate", "Trivia"])


if __name__ == "__main__":
    unittest.main()
