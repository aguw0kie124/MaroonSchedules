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


class LibraryLiveMappingTests(unittest.TestCase):
    @mock.patch.object(TAMUFacilityTracker, "get_rec_center_live_counts", return_value={})
    @mock.patch.object(TAMUFacilityTracker, "fetch_event_data", return_value=[])
    @mock.patch.object(place_registry_service, "get_all_places", return_value=[])
    @mock.patch.object(TAMUFacilityTracker, "fetch_library_data")
    @mock.patch.object(place_registry_service, "resolve_place", return_value=None)
    @mock.patch.object(place_registry_service, "get_place_by_id")
    def test_get_all_locations_with_events_maps_library_api_keys_to_expected_places(
        self,
        mock_get_place_by_id,
        _mock_resolve_place,
        mock_fetch_library_data,
        _mock_get_all_places,
        _mock_fetch_event_data,
        _mock_get_rec_live_counts,
    ):
        by_place_id = {
            "libr": {"place_id": "libr", "name": "Sterling C. Evans Library", "type": "Library", "lat": 30.61, "lng": -96.34},
            "annex": {"place_id": "annex", "name": "Evans Library Annex", "type": "Library", "lat": 30.61, "lng": -96.34},
            "wcl": {"place_id": "wcl", "name": "West Campus Library", "type": "Library", "lat": 30.61, "lng": -96.34},
            "cush": {"place_id": "cush", "name": "Cushing Memorial Library", "type": "Library", "lat": 30.61, "lng": -96.34},
            "msl": {"place_id": "msl", "name": "Medical Sciences Library", "type": "Library", "lat": 30.61, "lng": -96.34},
            "psel": {"place_id": "psel", "name": "Policy Sciences & Economics Library", "type": "Library", "lat": 30.61, "lng": -96.34},
        }
        mock_get_place_by_id.side_effect = lambda place_id: by_place_id.get(place_id)
        mock_fetch_library_data.return_value = {
            "evans": {"percentfull": 21, "remaining": 2709, "max": 3422, "occupancy": 713},
            "annex": {"percentfull": 29, "remaining": 815, "max": 1134, "occupancy": 319},
            "blcc": {"percentfull": 14, "remaining": 858, "max": 994, "occupancy": 136},
            "cushing": {"percentfull": 0, "remaining": 132, "max": 132, "occupancy": 0},
            "msl": {"percentfull": 25, "remaining": 421, "max": 559, "occupancy": 138},
            "psel": {"percentfull": 0, "remaining": 51, "max": 51, "occupancy": 0},
            "lastupdate": "2026-04-14 18:56:01",
        }

        rows = TAMUFacilityTracker().get_all_locations_with_events()
        by_id = {row["place_id"]: row for row in rows}

        self.assertEqual(by_id["libr"]["current_count"], 713)
        self.assertEqual(by_id["annex"]["capacity"], 1134)
        self.assertEqual(by_id["wcl"]["available_seats"], 858)
        self.assertEqual(by_id["cush"]["percent_full"], 0.0)
        self.assertEqual(by_id["msl"]["current_count"], 138)
        self.assertEqual(by_id["psel"]["available_seats"], 51)


if __name__ == "__main__":
    unittest.main()
