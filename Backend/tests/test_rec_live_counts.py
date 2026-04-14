import os
import sys
import unittest
from unittest import mock

BACKEND_ROOT = os.path.dirname(os.path.dirname(__file__))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from routers.traffic import TAMUFacilityTracker
from services import campus_hub_service, place_registry_service


class RecLiveCountSelectionTests(unittest.TestCase):
    @mock.patch.object(place_registry_service, "resolve_place")
    def test_rec_center_live_counts_prefers_explicit_strength_rows_for_major_rec_centers(self, mock_resolve_place):
        rec_place = {
            "place_id": "rec",
            "name": "Student Recreation Center",
            "type": "Rec",
            "lat": 30.0,
            "lng": -96.0,
        }
        southside_place = {
            "place_id": "southside-rec",
            "name": "Southside Recreation Center",
            "type": "Rec",
            "lat": 30.0,
            "lng": -96.0,
        }
        polo_place = {
            "place_id": "polo-rec",
            "name": "Polo Road Recreation Center",
            "type": "Rec",
            "lat": 30.0,
            "lng": -96.0,
        }

        def resolve_side_effect(name, *args, **kwargs):
            if name == "Student Rec Center":
                return rec_place
            if name == "Southside Rec Center":
                return southside_place
            if name == "Polo Road Rec Center":
                return polo_place
            return None

        mock_resolve_place.side_effect = resolve_side_effect

        tracker = TAMUFacilityTracker()
        rows = [
            {
                "FacilityName": "Student Rec Center",
                "LocationName": "Rec Boulder (new)",
                "LastCount": 17,
                "TotalCapacity": 40,
                "LastUpdatedDateAndTime": "2026-04-09T18:55:49.357",
                "IsClosed": False,
            },
            {
                "FacilityName": "Student Rec Center",
                "LocationName": "Student Rec Center Strength & Conditioning",
                "LastCount": 150,
                "TotalCapacity": 400,
                "LastUpdatedDateAndTime": "2026-04-09T18:53:36.193",
                "IsClosed": False,
            },
            {
                "FacilityName": "Southside Rec Center",
                "LocationName": "Southside Rec Boulder Wall",
                "LastCount": 2,
                "TotalCapacity": 10,
                "LastUpdatedDateAndTime": "2026-04-09T18:26:48.020",
                "IsClosed": False,
            },
            {
                "FacilityName": "Southside Rec Center",
                "LocationName": "Southside Strength & Conditioning Area",
                "LastCount": 106,
                "TotalCapacity": 300,
                "LastUpdatedDateAndTime": "2026-04-09T19:05:40.007",
                "IsClosed": False,
            },
            {
                "FacilityName": "Polo Road Rec Center",
                "LocationName": "Polo Road Strength & Conditioning",
                "LastCount": 67,
                "TotalCapacity": 250,
                "LastUpdatedDateAndTime": "2026-04-09T19:02:22.837",
                "IsClosed": False,
            },
        ]

        summaries = tracker.get_rec_center_live_counts(rows)

        self.assertEqual(
            summaries["rec"]["location_name"],
            "Student Rec Center Strength & Conditioning",
        )
        self.assertAlmostEqual(summaries["rec"]["percent_full"], 37.5)
        self.assertIn("southside-rec", summaries)
        self.assertEqual(
            summaries["southside-rec"]["location_name"],
            "Southside Strength & Conditioning Area",
        )
        self.assertEqual(summaries["southside-rec"]["current_count"], 106)
        self.assertEqual(summaries["southside-rec"]["capacity"], 300)
        self.assertAlmostEqual(summaries["southside-rec"]["percent_full"], 35.3)
        self.assertEqual(
            summaries["polo-rec"]["location_name"],
            "Polo Road Strength & Conditioning",
        )
        self.assertAlmostEqual(summaries["polo-rec"]["percent_full"], 26.8)


class RecreationSnapshotTests(unittest.TestCase):
    @mock.patch.object(campus_hub_service.cache_service, "set_json")
    @mock.patch.object(campus_hub_service.cache_service, "get_json", return_value=None)
    @mock.patch.object(campus_hub_service, "_fetch_rec_notices", return_value=[])
    @mock.patch.object(campus_hub_service, "_fetch_rec_facility_page_details", return_value={})
    @mock.patch.object(campus_hub_service.place_registry_service, "get_all_places")
    @mock.patch("routers.traffic.tracker.get_rec_center_live_counts")
    @mock.patch("routers.traffic.tracker.fetch_rec_data")
    def test_get_recreation_snapshot_uses_live_count_summary_and_student_rec_url(
        self,
        mock_fetch_rec_data,
        mock_get_rec_center_live_counts,
        mock_get_all_places,
        _mock_fetch_page_details,
        _mock_fetch_notices,
        _mock_get_json,
        mock_set_json,
    ):
        mock_fetch_rec_data.return_value = [{"FacilityName": "Student Rec Center"}]
        mock_get_rec_center_live_counts.return_value = {
            "rec": {
                "location_name": "Student Rec Center Strength & Conditioning",
                "current_count": 150,
                "capacity": 400,
                "percent_full": 37.5,
                "last_updated": "2026-04-09T18:53:36.193",
            }
        }
        mock_get_all_places.return_value = [
            {
                "place_id": "rec",
                "name": "Student Recreation Center",
                "type": "Rec",
                "description": "Primary rec center",
                "features": ["Strength & Conditioning"],
                "hours": "6:00 AM - 11:45 PM",
            },
            {
                "place_id": "southside-rec",
                "name": "Southside Recreation Center",
                "type": "Rec",
                "description": "Southside rec center",
                "features": ["Strength & Conditioning"],
                "hours": "5:30 AM - 11:59 PM",
            },
            {
                "place_id": "polo-rec",
                "name": "Polo Road Recreation Center",
                "type": "Rec",
                "description": "Polo rec center",
                "features": ["Strength & Conditioning"],
                "hours": "6:00 AM - 10:00 PM",
            },
        ]

        snapshot = campus_hub_service.get_recreation_snapshot()

        student_rec = snapshot["facilities"][0]
        self.assertEqual(student_rec["id"], "rec")
        self.assertEqual(
            student_rec["source_url"],
            "https://recsports.tamu.edu/facilities/student-rec-center/",
        )
        self.assertEqual(
            student_rec["occupancy_name"],
            "Student Rec Center Strength & Conditioning",
        )
        self.assertEqual(student_rec["current_count"], 150)
        self.assertEqual(student_rec["capacity"], 400)
        self.assertEqual(student_rec["percent_full"], 37.5)
        self.assertTrue(
            any(call.args and call.args[0] == "campus:recreation:snapshot:v1" for call in mock_set_json.call_args_list)
        )


if __name__ == "__main__":
    unittest.main()
