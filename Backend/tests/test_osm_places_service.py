import os
import sys
import unittest

BACKEND_ROOT = os.path.dirname(os.path.dirname(__file__))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from services import osm_places_service


class OSMPlacesServiceTests(unittest.TestCase):
    def test_record_from_element_maps_restaurant(self):
        record = osm_places_service._record_from_element(
            {
                "type": "node",
                "id": 123,
                "lat": 30.61,
                "lon": -96.34,
                "tags": {
                    "name": "Example Grill",
                    "amenity": "restaurant",
                    "addr:housenumber": "123",
                    "addr:street": "University Dr",
                    "brand": "Example",
                    "alt_name": "Example Burgers",
                },
            }
        )
        self.assertIsNotNone(record)
        self.assertEqual(record["place_id"], "osm:node:123")
        self.assertEqual(record["type"], "Dining")
        self.assertTrue(record["search_only"])
        self.assertIn("University Dr", record["description"])
        self.assertIn("Example Burgers", record["aliases"])

    def test_record_from_element_maps_library_and_center_coords(self):
        record = osm_places_service._record_from_element(
            {
                "type": "way",
                "id": 456,
                "center": {"lat": 30.62, "lon": -96.33},
                "tags": {
                    "name": "Example Branch Library",
                    "amenity": "library",
                },
            }
        )
        self.assertIsNotNone(record)
        self.assertEqual(record["type"], "Library")
        self.assertEqual(record["lat"], 30.62)
        self.assertEqual(record["lng"], -96.33)

    def test_dedupe_prefers_more_specific_non_building_record(self):
        building_only = {
            "place_id": "osm:way:1",
            "name": "Century Square",
            "short_name": "Commercial",
            "type": "General",
            "lat": 30.62,
            "lng": -96.33,
            "aliases": [],
            "search_only": True,
            "source": "osm",
            "description": "Commercial building",
            "primary_tag": "building",
            "primary_value": "commercial",
        }
        amenity = {
            **building_only,
            "place_id": "osm:node:2",
            "type": "Dining",
            "primary_tag": "amenity",
            "primary_value": "restaurant",
        }

        records = osm_places_service._dedupe_records([building_only, amenity])
        self.assertEqual(len(records), 1)
        self.assertEqual(records[0]["place_id"], "osm:node:2")


if __name__ == "__main__":
    unittest.main()
