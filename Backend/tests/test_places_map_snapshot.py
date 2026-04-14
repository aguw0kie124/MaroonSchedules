import os
import sys
import unittest
from unittest import mock

BACKEND_ROOT = os.path.dirname(os.path.dirname(__file__))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from services import campus_places_service


class PlacesMapSnapshotTests(unittest.TestCase):
    @mock.patch.object(campus_places_service.cache_service, "set_json")
    @mock.patch.object(campus_places_service.cache_service, "get_json", return_value=None)
    @mock.patch.object(campus_places_service, "_annotate_hours_today")
    @mock.patch.object(campus_places_service, "_merge_visitor_parking_counts")
    @mock.patch.object(campus_places_service.parking_realtime_service, "snapshot_block", return_value={})
    @mock.patch.object(campus_places_service.place_registry_service, "get_all_places")
    @mock.patch.object(campus_places_service.tracker, "get_all_locations_with_events")
    def test_live_capacity_propagates_to_annex_alias_row(
        self,
        mock_live_rows,
        mock_get_all_places,
        _mock_parking_snapshot,
        _mock_merge_visitor,
        _mock_annotate_hours,
        _mock_get_json,
        _mock_set_json,
    ):
        mock_get_all_places.return_value = [
            {
                "place_id": "annex",
                "name": "Evans Library Annex",
                "type": "Library",
                "coord": {"lat": 30.0, "lng": -96.0},
                "aliases": [],
            },
            {
                "place_id": "osm:way:307098419",
                "name": "Sterling C. Evans Library Annex",
                "type": "Library",
                "coord": {"lat": 30.0004, "lng": -96.0004},
                "aliases": [],
            },
        ]
        mock_live_rows.return_value = [
            {
                "place_id": "annex",
                "location": "Evans Library Annex",
                "percent_full": 33.3,
                "type": "Library",
                "is_live": True,
                "available_seats": 20,
                "capacity": 60,
                "current_count": 20,
            }
        ]

        snapshot = campus_places_service.get_places_map_snapshot()
        by_id = {entry["placeId"]: entry for entry in snapshot["locations"]}

        self.assertEqual(by_id["annex"]["capacity"], 60)
        self.assertEqual(by_id["annex"]["current_count"], 20)
        self.assertEqual(by_id["osm:way:307098419"]["capacity"], 60)
        self.assertEqual(by_id["osm:way:307098419"]["current_count"], 20)
        self.assertEqual(by_id["osm:way:307098419"]["percent_full"], 33)


if __name__ == "__main__":
    unittest.main()
