import os
import sys
import unittest
from unittest import mock

BACKEND_ROOT = os.path.dirname(os.path.dirname(__file__))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from services import campus_hub_service, place_registry_service


class PlaceRegistryResolutionTests(unittest.TestCase):
    @mock.patch.object(place_registry_service, "_build_registry")
    def test_resolve_place_accepts_place_id_and_normalized_alias(self, mock_build_registry):
        place = {
            "place_id": "libr",
            "name": "Sterling C. Evans Library",
            "short_name": "LIBR",
            "type": "Library",
            "lat": 30.616332,
            "lng": -96.338571,
            "aliases": ["Evans Library"],
        }
        mock_build_registry.return_value = {
            "records": [place],
            "by_id": {"libr": place},
            "by_name": {"sterling c evans library": place},
            "alias_lookup": {"evans library": place},
        }

        self.assertEqual(place_registry_service.resolve_place("libr"), place)
        self.assertEqual(place_registry_service.resolve_place("Evans Library"), place)


class PlaceDetailCacheTests(unittest.TestCase):
    @mock.patch.object(campus_hub_service, "get_recreation_snapshot", return_value=None)
    @mock.patch.object(campus_hub_service, "get_transit_snapshot", return_value=None)
    @mock.patch.object(campus_hub_service.campus_places_service, "get_places_map_snapshot", return_value={"locations": []})
    @mock.patch.object(campus_hub_service.place_registry_service, "serialize_place")
    @mock.patch.object(campus_hub_service.place_registry_service, "get_place_by_id")
    @mock.patch.object(campus_hub_service.cache_service, "set_json")
    @mock.patch.object(campus_hub_service.cache_service, "get_json")
    def test_get_place_detail_rebuilds_when_cached_live_payload_has_no_place(
        self,
        mock_get_json,
        mock_set_json,
        mock_get_place_by_id,
        mock_serialize_place,
        _mock_get_places_map,
        _mock_get_transit,
        _mock_get_recreation,
    ):
        mock_get_json.return_value = {
            "generated_at": "2026-04-06T00:00:00Z",
            "stale_after": 60,
            "source_status": "live",
            "place": None,
        }
        mock_get_place_by_id.return_value = {
            "place_id": "libr",
            "name": "Sterling C. Evans Library",
            "type": "Library",
        }
        mock_serialize_place.return_value = {
            "place_id": "libr",
            "name": "Sterling C. Evans Library",
        }

        result = campus_hub_service.get_place_detail_snapshot("libr")

        self.assertEqual(result["place"]["place_id"], "libr")
        mock_set_json.assert_called_once()
        cache_key = mock_set_json.call_args.args[0]
        self.assertIn("campus:place-detail:v2:libr", cache_key)

    @mock.patch.object(campus_hub_service, "get_recreation_snapshot", return_value=None)
    @mock.patch.object(campus_hub_service, "get_transit_snapshot", return_value=None)
    @mock.patch.object(campus_hub_service.campus_places_service, "get_places_capacity_realtime_snapshot")
    @mock.patch.object(campus_hub_service.campus_places_service, "get_places_map_snapshot")
    @mock.patch.object(campus_hub_service.place_registry_service, "serialize_place")
    @mock.patch.object(campus_hub_service.place_registry_service, "get_place_by_id")
    @mock.patch.object(campus_hub_service.cache_service, "set_json")
    @mock.patch.object(campus_hub_service.cache_service, "get_json", return_value=None)
    def test_get_place_detail_overlays_fresh_library_capacity(
        self,
        _mock_get_json,
        _mock_set_json,
        mock_get_place_by_id,
        _mock_serialize_place,
        mock_get_places_map,
        mock_get_capacity_snapshot,
        _mock_get_transit,
        _mock_get_recreation,
    ):
        mock_get_place_by_id.return_value = {
            "place_id": "annex",
            "name": "Evans Library Annex",
            "type": "Library",
        }
        mock_get_places_map.return_value = {
            "locations": [
                {
                    "placeId": "annex",
                    "location": "Evans Library Annex",
                    "type": "Library",
                    "percent_full": 4,
                    "available_seats": 1088,
                    "capacity": 1134,
                    "current_count": 46,
                    "is_live": True,
                }
            ]
        }
        mock_get_capacity_snapshot.return_value = {
            "libraries": {
                "locations": {
                    "annex": {
                        "percent_full": 16,
                        "available_seats": 963,
                        "capacity": 1134,
                        "current_count": 171,
                        "capacity_as_of": "2026-04-15 01:43:01",
                        "capacity_source_url": "https://php.library.tamu.edu/utilities/occupancy/index.php",
                        "is_live": True,
                    }
                }
            }
        }

        result = campus_hub_service.get_place_detail_snapshot("annex")

        self.assertEqual(result["place"]["current_count"], 171)
        self.assertEqual(result["place"]["available_seats"], 963)
        self.assertEqual(result["place"]["capacity_as_of"], "2026-04-15 01:43:01")


if __name__ == "__main__":
    unittest.main()
