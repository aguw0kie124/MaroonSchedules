import asyncio
import os
import sys
import unittest
from datetime import datetime, timedelta, timezone
from unittest import mock

BACKEND_ROOT = os.path.dirname(os.path.dirname(__file__))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

import chat
from services import pulse_service


class CrowdPingRouteTests(unittest.TestCase):
    @mock.patch.object(chat.cache_service, "delete")
    @mock.patch.object(chat.pulse_service, "invalidate_pulse_map_cache")
    @mock.patch.object(chat.feed_repository, "add_crowdping_post")
    @mock.patch.object(chat.ping_service, "normalize_ping_activity_payload")
    @mock.patch.object(chat.campus_hub_service, "_ensure_social_tables")
    def test_proxy_add_activity_invalidates_pulse_and_feed_caches(
        self,
        mock_ensure_tables,
        mock_normalize_ping,
        mock_add_crowdping_post,
        mock_invalidate_pulse_map_cache,
        mock_cache_delete,
    ):
        normalized_activity = {
            "actor": "SU:user_123",
            "verb": "ping",
            "text": "Pizza in the MSC",
            "attachments": [],
            "custom": {
                "user_name": "Aggie User",
                "user_image": "",
                "ping_title": "Pizza now",
                "ping_category": "Free Food",
                "location_tag": "Memorial Student Center",
                "place_id": "msc",
                "place_lat": 30.61223,
                "place_lng": -96.34137,
                "start_at": "2099-01-01T12:00:00+00:00",
                "end_at": "2099-01-01T14:00:00+00:00",
                "is_anonymous": True,
            },
        }
        mock_normalize_ping.return_value = normalized_activity

        body = chat.FeedActivity(
            activity={
                "actor": "SU:user_123",
                "verb": "ping",
                "text": "Pizza in the MSC",
                "custom": {
                    "location_tag": "Memorial Student Center",
                    "place_id": "msc",
                },
            }
        )

        response = asyncio.run(
            chat.proxy_add_activity("flat", "campus_pings", body, auth_user_id="user_123")
        )

        self.assertEqual(response["status"], "success")
        mock_ensure_tables.assert_called_once()
        mock_normalize_ping.assert_called_once()
        self.assertTrue(mock_add_crowdping_post.called)
        self.assertTrue(mock_add_crowdping_post.call_args.kwargs["is_anonymous"])
        mock_cache_delete.assert_has_calls(
            [
                mock.call("feed:backbone:flat:campus_pings"),
                mock.call("feed:backbone:flat:campus_global"),
            ],
            any_order=True,
        )
        mock_invalidate_pulse_map_cache.assert_called_once()


class PulseServiceTests(unittest.TestCase):
    @mock.patch.object(pulse_service.cache_service, "set_json")
    @mock.patch.object(pulse_service.cache_service, "get_json", return_value=None)
    @mock.patch.object(pulse_service, "_load_admin_events", return_value=[])
    @mock.patch.object(pulse_service, "_load_occupancy_by_place", return_value={})
    @mock.patch.object(pulse_service.feed_repository, "get_batch_interaction_counts", return_value={})
    @mock.patch.object(pulse_service.feed_repository, "get_crowdping_feed")
    @mock.patch.object(pulse_service.place_registry_service, "serialize_place")
    @mock.patch.object(pulse_service.place_registry_service, "get_place_by_id")
    @mock.patch.object(pulse_service.campus_hub_service, "_ensure_social_tables")
    def test_get_pulse_map_reads_only_ping_posts_and_builds_hotspot(
        self,
        mock_ensure_tables,
        mock_get_place_by_id,
        mock_serialize_place,
        mock_get_crowdping_feed,
        _mock_get_batch_counts,
        _mock_load_occupancy,
        _mock_load_admin_events,
        _mock_get_json,
        _mock_set_json,
    ):
        now = datetime.now(timezone.utc)
        mock_get_crowdping_feed.return_value = [
            {
                "id": "ping-1",
                "location_tag": "Memorial Student Center",
                "lat": 30.61223,
                "lng": -96.34137,
                "post_type": "ping",
                "created_at": now.isoformat(),
                "custom_data": {
                    "place_id": "msc",
                    "ping_title": "Pizza now",
                    "ping_category": "Free Food",
                    "start_at": now.isoformat(),
                    "end_at": (now + timedelta(hours=2)).isoformat(),
                    "user_name": "Aggie User",
                },
            }
        ]
        mock_get_place_by_id.return_value = {
            "place_id": "msc",
            "name": "Memorial Student Center",
            "lat": 30.61223,
            "lng": -96.34137,
        }
        mock_serialize_place.return_value = {"place_id": "msc"}

        result = pulse_service.get_pulse_map(limit=12)

        mock_ensure_tables.assert_called_once()
        mock_get_crowdping_feed.assert_called_once_with(post_types=["ping"], limit=80)
        self.assertEqual(len(result["hotspots"]), 1)
        self.assertEqual(result["hotspots"][0]["placeId"], "msc")


if __name__ == "__main__":
    unittest.main()
