import os
import sys
import unittest

BACKEND_ROOT = os.path.dirname(os.path.dirname(__file__))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from scripts import migrate_registry


class SpecialPlaceCoordinateTests(unittest.TestCase):
    def test_resolve_special_place_coordinates_prefers_osm_geometry(self):
        place = {
            "place_id": "commons",
            "name": "The Commons Dining Hall",
            "type": "Dining",
            "coord_lookup_names": ["Commons Dining Hall", "The Commons Dining Hall", "Commons"],
        }
        osm_records = [
            {
                "place_id": "osm:way:155052765",
                "name": "Commons",
                "type": "Academic",
                "lat": 30.6153804,
                "lng": -96.3360119,
                "aliases": ["COMM"],
            },
            {
                "place_id": "osm:node:11033604440",
                "name": "Commons Dining Hall",
                "type": "Dining",
                "lat": 30.615787327676124,
                "lng": -96.33632240064732,
                "aliases": [],
            },
        ]

        lat, lng = migrate_registry.resolve_special_place_coordinates(place, osm_records)

        self.assertAlmostEqual(lat, 30.615787327676124)
        self.assertAlmostEqual(lng, -96.33632240064732)

    def test_resolve_special_place_coordinates_raises_when_no_lookup_or_fallback_exists(self):
        place = {
            "place_id": "missing",
            "name": "Missing Place",
            "type": "Dining",
            "coord_lookup_names": ["Missing Place"],
        }

        with self.assertRaises(ValueError):
            migrate_registry.resolve_special_place_coordinates(place, [])


if __name__ == "__main__":
    unittest.main()
