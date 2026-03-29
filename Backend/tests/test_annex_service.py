import os
import sys
import unittest
from unittest.mock import patch

BACKEND_ROOT = os.path.dirname(os.path.dirname(__file__))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from services import annex_service


LIBRARIES_HTML = """
<select id="location">
  <option value="">Choose</option>
  <option value="/r/search/evans-annex">Evans Library and Annex</option>
  <option value="/r/search?lid=1192">Medical Sciences Library</option>
</select>
"""

LIBRARY_DETAIL_HTML = """
<select>
  <option value="2068">Library Annex Group Study Rooms</option>
  <option value="2078">Evans Library Individual Quiet Study Rooms</option>
</select>
<div id="s-lc-location-description">
  <p>Group study rooms are available in both Evans and the Annex.</p>
  <p>You must check in upon arrival using the link in your confirmation email.</p>
  <p>Please see our Study Room Policies for full usage guidelines.</p>
</div>
"""

RENTALS_HTML = """
<li><a class="btn btn-default" href="https://tamu.libcal.com/equipment?lid=20326&amp;gid=42970" role="button">Audio Equipment</a></li>
<li><a class="btn btn-default" href="https://tamu.libcal.com/reserve/AdvancedScheduling" role="button">Advanced Reservation Items</a></li>
<li><a class="btn btn-primary" href="https://tamu.libcal.com/equipment?lid=20326" role="button">West Campus Library</a></li>
"""

EQUIPMENT_PAYLOAD = {
    "status": 1,
    "results": [
        {
            "ID": 174864,
            "NAME": "Akai APC 25-key mk2 keyboard controller",
            "MODEL": "Akai APC",
            "DESCRIPTION": "<p>Controller for music production.</p>",
            "IMAGE": "https://example.com/item.png",
        }
    ],
}


class AnnexServiceTests(unittest.TestCase):
    def test_parse_libraries_from_search_html(self):
        libraries = annex_service._parse_libraries_from_search_html(LIBRARIES_HTML)
        self.assertEqual(len(libraries), 2)
        self.assertEqual(libraries[0]["id"], "evans-annex")
        self.assertEqual(libraries[1]["id"], "lid-1192")

    def test_extract_booking_rules_and_room_groups(self):
        groups = annex_service._extract_room_groups(LIBRARY_DETAIL_HTML)
        rules = annex_service._extract_booking_rules(LIBRARY_DETAIL_HTML)
        self.assertEqual(len(groups), 2)
        self.assertTrue(any("check in" in rule.lower() for rule in rules))

    def test_parse_rentals_overview_html(self):
        overview = annex_service._parse_rental_overview_html(RENTALS_HTML)
        self.assertEqual(len(overview["categories"]), 2)
        self.assertEqual(len(overview["locations"]), 1)
        self.assertEqual(overview["categories"][0]["id"], "gid-42970")

    def test_parse_equipment_results(self):
        items = annex_service._parse_equipment_results(
            EQUIPMENT_PAYLOAD,
            "https://tamu.libcal.com/equipment?lid=20326&gid=42970",
        )
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["id"], "174864")
        self.assertIn("music production", items[0]["description"].lower())

    def test_evaluate_booking_eligibility_states(self):
        self.assertEqual(
            annex_service.evaluate_booking_eligibility("student@tamu.edu")["status"],
            "eligible",
        )
        self.assertEqual(
            annex_service.evaluate_booking_eligibility(None)["status"],
            "requires_login",
        )
        self.assertEqual(
            annex_service.evaluate_booking_eligibility("guest@gmail.com")["status"],
            "unauthorized",
        )

    @patch("services.annex_service.get_libraries")
    def test_get_library_detail_raises_for_unknown_library(self, mock_get_libraries):
        mock_get_libraries.return_value = {"items": []}
        with self.assertRaises(ValueError):
            annex_service.get_library_detail("missing-library", email="student@tamu.edu")

    @patch("services.annex_service._fetch_html")
    def test_get_library_detail_returns_embedded_booking_fallback(self, mock_fetch_html):
        mock_fetch_html.side_effect = [LIBRARIES_HTML, LIBRARY_DETAIL_HTML]
        detail = annex_service.get_library_detail("evans-annex", email="student@tamu.edu")
        self.assertEqual(detail["availability_mode"], "embedded_live_grid")
        self.assertFalse(detail["supports_direct_submission"])
        self.assertEqual(detail["eligibility"]["status"], "eligible")

    @patch("services.annex_service._fetch_html")
    @patch("services.annex_service._fetch_json")
    def test_get_rental_detail_returns_catalog_items(self, mock_fetch_json, mock_fetch_html):
        mock_fetch_html.return_value = RENTALS_HTML
        mock_fetch_json.return_value = EQUIPMENT_PAYLOAD
        detail = annex_service.get_rental_detail("gid-42970", email="student@tamu.edu")
        self.assertEqual(detail["availability_mode"], "catalog_api")
        self.assertEqual(len(detail["items"]), 1)
        self.assertEqual(detail["eligibility"]["status"], "eligible")

    @patch("services.annex_service._fetch_html")
    @patch("services.annex_service._fetch_json")
    def test_get_rental_detail_handles_requires_login_state(self, mock_fetch_json, mock_fetch_html):
        mock_fetch_html.return_value = RENTALS_HTML
        mock_fetch_json.return_value = EQUIPMENT_PAYLOAD
        detail = annex_service.get_rental_detail("gid-42970", email=None)
        self.assertEqual(detail["eligibility"]["status"], "requires_login")

    @patch("services.annex_service.get_rentals_overview")
    def test_get_rental_detail_raises_for_unknown_category(self, mock_get_rentals_overview):
        mock_get_rentals_overview.return_value = {
            "categories": [],
            "locations": [],
        }
        with self.assertRaises(ValueError):
            annex_service.get_rental_detail("unknown-category", email="student@tamu.edu")


if __name__ == "__main__":
    unittest.main()
