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

    @mock.patch.object(campus_places_service.tracker, "fetch_library_data")
    @mock.patch.object(campus_places_service.tracker, "get_rec_center_live_counts")
    @mock.patch.object(campus_places_service.tracker, "fetch_rec_data")
    def test_capacity_realtime_snapshot_maps_rec_and_library_payloads(
        self,
        mock_fetch_rec_data,
        mock_get_rec_center_live_counts,
        mock_fetch_library_data,
    ):
        mock_fetch_rec_data.return_value = [{"FacilityName": "Student Rec Center"}]
        mock_get_rec_center_live_counts.return_value = {
            "rec": {
                "location_name": "Student Rec Center Strength & Conditioning",
                "current_count": 87,
                "capacity": 400,
                "percent_full": 21.8,
                "available_seats": 313,
                "last_updated": "2026-04-14T23:02:19.193",
                "facility_counts": [
                    {
                        "location_name": "Student Rec Center Strength & Conditioning",
                        "current_count": 87,
                        "capacity": 400,
                        "percent_full": 21.8,
                        "last_updated": "2026-04-14T23:02:19.193",
                        "is_closed": False,
                    }
                ],
            }
        }
        mock_fetch_library_data.return_value = {
            "lastupdate": "2026-04-15 01:43:01",
            "annex": {
                "percentfull": 16,
                "max": 1134,
                "occupancy": 171,
                "remaining": 963,
                "name": "Annex",
            },
        }

        snapshot = campus_places_service.get_places_capacity_realtime_snapshot()
        rec = snapshot["recreation"]["locations"]["rec"]
        annex = snapshot["libraries"]["locations"]["annex"]
        annex_alias = snapshot["libraries"]["locations"]["osm:way:307098419"]

        self.assertEqual(rec["current_count"], 87)
        self.assertEqual(rec["capacity"], 400)
        self.assertEqual(rec["occupancy_name"], "Student Rec Center Strength & Conditioning")
        self.assertEqual(rec["facility_counts"][0]["location_name"], "Student Rec Center Strength & Conditioning")
        self.assertEqual(annex["current_count"], 171)
        self.assertEqual(annex["capacity"], 1134)
        self.assertEqual(annex["capacity_as_of"], "2026-04-15 01:43:01")
        self.assertEqual(annex_alias["current_count"], 171)
        self.assertEqual(annex_alias["canonical_place_id"], "annex")


if __name__ == "__main__":
    unittest.main()
