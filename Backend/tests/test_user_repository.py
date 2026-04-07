import os
import sys
import unittest
from unittest import mock

import psycopg

BACKEND_ROOT = os.path.dirname(os.path.dirname(__file__))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from repositories import user_repository


class EnsureUserSchemaTests(unittest.TestCase):
    def test_optional_ddl_swallows_insufficient_privilege(self):
        conn = mock.MagicMock()
        tx = conn.transaction.return_value
        tx.__enter__.return_value = None
        tx.__exit__.return_value = None

        cursor = mock.MagicMock()
        cursor.__enter__.return_value = cursor
        cursor.__exit__.return_value = None
        cursor.execute.side_effect = psycopg.errors.InsufficientPrivilege("must be owner of table users")
        conn.cursor.return_value = cursor

        user_repository._execute_optional_ddl(conn, "ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT")

        cursor.execute.assert_called_once()


class UserRowMappingTests(unittest.TestCase):
    def test_row_to_dict_defaults_missing_optional_columns(self):
        row = {
            "id": 1,
            "clerk_id": "user_123",
            "email": "aggie@example.com",
            "full_name": "Aggie User",
            "profile_image_url": None,
            "major": None,
            "graduation_year": None,
            "preferred_time": None,
            "max_credits": None,
            "avoid_friday": False,
            "show_online_first": False,
            "schedules": [],
            "created_at": None,
            "updated_at": None,
            "canvas_access_token": None,
            "canvas_refresh_token": None,
            "canvas_expires_at": None,
            "canvas_instance_url": "https://canvas.tamu.edu",
            "tos_accepted": False,
            "tour_completed": True,
        }

        result = user_repository._row_to_dict(row)

        self.assertEqual(result["clerk_id"], "user_123")
        self.assertFalse(result["is_admin"])
        self.assertTrue(result["tour_completed"])


if __name__ == "__main__":
    unittest.main()
