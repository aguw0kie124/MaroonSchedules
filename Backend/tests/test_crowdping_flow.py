import asyncio
import os
import sys
import unittest
from datetime import datetime, timedelta, timezone
from unittest import mock
from starlette.requests import Request

BACKEND_ROOT = os.path.dirname(os.path.dirname(__file__))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

import chat
from services import pulse_service


def make_request() -> Request:
    return Request({"type": "http", "method": "GET", "path": "/", "headers": []})


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
            chat.proxy_add_activity(make_request(), "flat", "campus_pings", body, auth_user_id="user_123")
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

    @mock.patch.object(chat.feed_repository, "get_user_interactions_batch")
    @mock.patch.object(chat.feed_repository, "get_batch_interaction_counts")
    @mock.patch.object(chat.feed_repository, "get_crowdping_feed")
    @mock.patch.object(chat.cache_service, "delete")
    @mock.patch.object(chat, "_get_block_relationship_ids_cached", return_value=[])
    @mock.patch.object(chat, "_resolve_access_scope_cached", return_value=([], False))
    @mock.patch.object(chat.cache_service, "get_json", return_value=None)
    @mock.patch.object(chat.campus_hub_service, "_ensure_social_tables")
    def test_proxy_get_feed_returns_pings_with_batched_own_reactions(
        self,
        mock_ensure_tables,
        _mock_cache_get_json,
        _mock_resolve_access_scope,
        _mock_get_block_relationship_ids,
        _mock_cache_delete,
        mock_get_crowdping_feed,
        mock_get_batch_counts,
        mock_get_user_interactions_batch,
    ):
        mock_get_crowdping_feed.return_value = [
            {
                "id": "ping-1",
                "user_id": "user_456",
                "user_name": "Aggie User",
                "user_image": "",
                "content": "Pizza in the MSC",
                "lat": 30.61223,
                "lng": -96.34137,
                "location_tag": "Memorial Student Center",
                "event_id": None,
                "images": [],
                "is_anonymous": False,
                "visibility": "public",
                "post_type": "ping",
                "custom_data": {
                    "ping_title": "Pizza now",
                    "ping_category": "Free Food",
                    "start_at": "2099-01-01T12:00:00+00:00",
                },
                "created_at": "2099-01-01T11:55:00+00:00",
            }
        ]
        mock_get_batch_counts.return_value = {
            "ping-1": {"like": 0, "comment": 2, "upvote": 4, "downvote": 1, "score": 3}
        }
        mock_get_user_interactions_batch.return_value = {
            "ping-1": {"upvote": True}
        }

        response = asyncio.run(
            chat.proxy_get_feed(
                request=make_request(),
                feed_group="flat",
                feed_id="campus_pings",
                limit=25,
                clerk_id=None,
                refresh=False,
                auth_user_id="user_123",
            )
        )

        self.assertEqual(len(response["results"]), 1)
        activity = response["results"][0]
        self.assertEqual(activity["id"], "ping-1")
        self.assertEqual(activity["reaction_counts"]["score"], 3)
        self.assertEqual(activity["own_reactions"], {"upvote": [True]})
        mock_ensure_tables.assert_called_once()
        mock_get_crowdping_feed.assert_called_once_with(post_types=["ping", "post"], limit=50)
        mock_get_user_interactions_batch.assert_called_once_with("user_123", ["ping-1"])

    @mock.patch.object(chat.feed_repository, "get_user_interactions_batch", return_value={})
    @mock.patch.object(chat.feed_repository, "get_batch_interaction_counts", return_value={})
    @mock.patch.object(chat.feed_repository, "get_crowdping_feed", return_value=[])
    @mock.patch.object(chat.cache_service, "set_json")
    @mock.patch.object(chat.cache_service, "get_json")
    @mock.patch.object(chat.cache_service, "delete")
    @mock.patch.object(chat, "_get_block_relationship_ids_cached", return_value=[])
    @mock.patch.object(chat, "_resolve_access_scope_cached", return_value=([], False))
    @mock.patch.object(chat.campus_hub_service, "_ensure_social_tables")
    def test_proxy_get_feed_refresh_bypasses_backbone_cache(
        self,
        _mock_ensure_tables,
        _mock_resolve_access_scope,
        _mock_get_block_relationship_ids,
        mock_cache_delete,
        mock_cache_get_json,
        _mock_cache_set_json,
        mock_get_crowdping_feed,
        _mock_get_batch_counts,
        _mock_get_user_interactions_batch,
    ):
        asyncio.run(
            chat.proxy_get_feed(
                request=make_request(),
                feed_group="flat",
                feed_id="campus_pings",
                limit=25,
                clerk_id=None,
                refresh=True,
                auth_user_id="user_123",
            )
        )

        mock_cache_delete.assert_any_call("feed:backbone:flat:campus_pings")
        mock_cache_get_json.assert_not_called()
        mock_get_crowdping_feed.assert_called_once_with(post_types=["ping", "post"], limit=50)

    @mock.patch.object(chat.feed_repository, "get_user_interactions_batch", return_value={})
    @mock.patch.object(chat.feed_repository, "get_batch_interaction_counts", return_value={})
    @mock.patch.object(chat.feed_repository, "get_crowdping_feed")
    @mock.patch.object(chat.cache_service, "get_json", return_value=None)
    @mock.patch.object(chat, "_get_block_relationship_ids_cached", return_value=["blocked_user"])
    @mock.patch.object(chat, "_resolve_access_scope_cached", return_value=([], False))
    @mock.patch.object(chat.campus_hub_service, "_ensure_social_tables")
    def test_proxy_get_feed_filters_block_relationships(
        self,
        _mock_ensure_tables,
        _mock_resolve_access_scope,
        _mock_get_block_relationship_ids,
        _mock_cache_get_json,
        mock_get_crowdping_feed,
        _mock_get_batch_counts,
        _mock_get_user_interactions_batch,
    ):
        mock_get_crowdping_feed.return_value = [
            {
                "id": "hidden-ping",
                "user_id": "blocked_user",
                "user_name": "Blocked User",
                "user_image": "",
                "content": "Hidden",
                "lat": None,
                "lng": None,
                "location_tag": "Nowhere",
                "event_id": None,
                "images": [],
                "is_anonymous": False,
                "visibility": "public",
                "post_type": "ping",
                "custom_data": {},
                "created_at": "2099-01-01T11:55:00+00:00",
            },
            {
                "id": "visible-ping",
                "user_id": "user_789",
                "user_name": "Visible User",
                "user_image": "",
                "content": "Visible",
                "lat": None,
                "lng": None,
                "location_tag": "MSC",
                "event_id": None,
                "images": [],
                "is_anonymous": False,
                "visibility": "public",
                "post_type": "ping",
                "custom_data": {},
                "created_at": "2099-01-01T11:56:00+00:00",
            },
        ]

        response = asyncio.run(
            chat.proxy_get_feed(
                request=make_request(),
                feed_group="flat",
                feed_id="campus_pings",
                limit=25,
                clerk_id=None,
                refresh=False,
                auth_user_id="user_123",
            )
        )

        self.assertEqual([item["id"] for item in response["results"]], ["visible-ping"])

    @mock.patch.object(chat.feed_repository, "has_block_relationship", return_value=True)
    @mock.patch.object(chat.feed_repository, "get_crowdping_post_owner", return_value="blocked_user")
    @mock.patch.object(chat.campus_hub_service, "_ensure_social_tables")
    def test_proxy_add_reaction_blocks_interaction_when_users_blocked(
        self,
        _mock_ensure_tables,
        _mock_get_post_owner,
        _mock_has_block_relationship,
    ):
        body = chat.ReactionPayload(
            kind="upvote",
            activity_id="ping-1",
            user_id="user_123",
            data={"name": "Aggie"},
        )

        with self.assertRaises(chat.HTTPException) as ctx:
            asyncio.run(chat.proxy_add_reaction(make_request(), body, auth_user_id="user_123"))

        self.assertEqual(ctx.exception.status_code, 403)
        self.assertIn("blocked", str(ctx.exception.detail).lower())

    @mock.patch.object(chat.feed_repository, "get_post_interactions")
    @mock.patch.object(chat, "_get_block_relationship_ids_cached", return_value=["blocked_user"])
    @mock.patch.object(chat.campus_hub_service, "_ensure_social_tables")
    def test_proxy_get_reactions_filters_blocked_relationships(
        self,
        _mock_ensure_tables,
        _mock_get_block_relationship_ids,
        mock_get_post_interactions,
    ):
        mock_get_post_interactions.return_value = []

        asyncio.run(chat.proxy_get_reactions("ping-1", "comment", auth_user_id="user_123"))

        mock_get_post_interactions.assert_called_once_with(
            "ping-1",
            "crowdping",
            interaction_type="comment",
            exclude_user_ids=["blocked_user"],
        )


class PulseServiceTests(unittest.TestCase):
    def test_format_time_label_uses_cross_platform_output(self):
        dt = datetime.now(timezone.utc) + timedelta(days=2, hours=3)
        label = pulse_service._format_time_label(dt.isoformat())
        self.assertNotIn("%#d", label)
        self.assertNotIn("%#I", label)
        self.assertIn("·", label)

    @mock.patch.object(pulse_service.cache_service, "delete")
    @mock.patch.object(pulse_service.cache_service, "get_json")
    @mock.patch.object(pulse_service, "_resolve_access_scope", return_value=([], False))
    @mock.patch.object(pulse_service, "_load_admin_events", return_value=[])
    @mock.patch.object(pulse_service, "_load_occupancy_by_place", return_value={})
    @mock.patch.object(pulse_service.feed_repository, "get_batch_interaction_counts", return_value={})
    @mock.patch.object(pulse_service.feed_repository, "get_crowdping_feed", return_value=[])
    @mock.patch.object(pulse_service.campus_hub_service, "_ensure_social_tables")
    def test_get_pulse_map_force_refresh_bypasses_snapshot_cache(
        self,
        _mock_ensure_tables,
        _mock_get_crowdping_feed,
        _mock_get_batch_counts,
        _mock_load_occupancy,
        _mock_load_admin_events,
        _mock_resolve_access_scope,
        mock_cache_get_json,
        mock_cache_delete,
    ):
        pulse_service.get_pulse_map(limit=12, force_refresh=True)
        mock_cache_delete.assert_called_once_with("campus:pulse:map:v3:tamu:12")
        mock_cache_get_json.assert_not_called()

    @mock.patch.object(pulse_service.cache_service, "set_json")
    @mock.patch.object(pulse_service.cache_service, "get_json", return_value=None)
    @mock.patch.object(pulse_service, "_resolve_access_scope", return_value=([], False))
    @mock.patch.object(pulse_service, "_load_admin_events", return_value=[])
    @mock.patch.object(pulse_service, "_load_occupancy_by_place", return_value={})
    @mock.patch.object(pulse_service.feed_repository, "get_batch_interaction_counts", return_value={})
    @mock.patch.object(pulse_service.feed_repository, "get_crowdping_feed")
    @mock.patch.object(pulse_service.campus_hub_service, "_ensure_social_tables")
    def test_get_pulse_map_scopes_results_by_requested_campus(
        self,
        _mock_ensure_tables,
        mock_get_crowdping_feed,
        _mock_get_batch_counts,
        _mock_load_occupancy,
        _mock_load_admin_events,
        _mock_resolve_access_scope,
        _mock_get_json,
        _mock_set_json,
    ):
        now = datetime.now(timezone.utc)
        mock_get_crowdping_feed.return_value = [
            {
                "id": "tamu-ping-only",
                "location_tag": "Memorial Student Center",
                "lat": 30.61223,
                "lng": -96.34137,
                "post_type": "ping",
                "created_at": now.isoformat(),
                "custom_data": {
                    "ping_title": "Pizza now",
                    "ping_category": "Free Food",
                    "start_at": now.isoformat(),
                },
            }
        ]

        result = pulse_service.get_pulse_map(limit=12, campus="utd")
        self.assertEqual(result.get("campus"), "utd")
        self.assertEqual(result["hotspots"], [])

    @mock.patch.object(pulse_service.cache_service, "set_json")
    @mock.patch.object(pulse_service.cache_service, "get_json", return_value=None)
    @mock.patch.object(pulse_service, "_resolve_access_scope", return_value=([], False))
    @mock.patch.object(pulse_service, "_load_admin_events", return_value=[])
    @mock.patch.object(pulse_service, "_load_occupancy_by_place", return_value={})
    @mock.patch.object(pulse_service.feed_repository, "get_batch_interaction_counts", return_value={})
    @mock.patch.object(pulse_service.feed_repository, "get_crowdping_feed")
    @mock.patch.object(pulse_service.place_registry_service, "serialize_place")
    @mock.patch.object(pulse_service.place_registry_service, "get_place_by_id")
    @mock.patch.object(pulse_service.place_registry_service, "resolve_place")
    @mock.patch.object(pulse_service.campus_hub_service, "_ensure_social_tables")
    def test_get_pulse_map_reads_only_ping_posts_and_builds_hotspot(
        self,
        mock_ensure_tables,
        mock_resolve_place,
        mock_get_place_by_id,
        mock_serialize_place,
        mock_get_crowdping_feed,
        _mock_get_batch_counts,
        _mock_load_occupancy,
        _mock_load_admin_events,
        _mock_resolve_access_scope,
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
        mock_resolve_place.return_value = mock_get_place_by_id.return_value
        mock_serialize_place.return_value = {"place_id": "msc"}

        result = pulse_service.get_pulse_map(limit=12)

        mock_ensure_tables.assert_called_once()
        mock_get_crowdping_feed.assert_called_once_with(post_types=["ping", "post"], limit=500)
        self.assertEqual(len(result["hotspots"]), 1)
        self.assertEqual(result["hotspots"][0]["place_id"], "msc")

    @mock.patch.object(pulse_service.cache_service, "set_json")
    @mock.patch.object(pulse_service.cache_service, "get_json", return_value=None)
    @mock.patch.object(pulse_service, "_resolve_access_scope", return_value=([], False))
    @mock.patch.object(pulse_service, "_load_admin_events", return_value=[])
    @mock.patch.object(pulse_service, "_load_occupancy_by_place", return_value={})
    @mock.patch.object(pulse_service.feed_repository, "get_batch_interaction_counts", return_value={})
    @mock.patch.object(pulse_service.feed_repository, "get_crowdping_feed")
    @mock.patch.object(pulse_service.place_registry_service, "serialize_place")
    @mock.patch.object(pulse_service.place_registry_service, "get_place_by_id")
    @mock.patch.object(pulse_service.place_registry_service, "resolve_place")
    @mock.patch.object(pulse_service.campus_hub_service, "_ensure_social_tables")
    def test_get_pulse_map_includes_legacy_post_typed_pings(
        self,
        _mock_ensure_tables,
        mock_resolve_place,
        mock_get_place_by_id,
        mock_serialize_place,
        mock_get_crowdping_feed,
        _mock_get_batch_counts,
        _mock_load_occupancy,
        _mock_load_admin_events,
        _mock_resolve_access_scope,
        _mock_get_json,
        _mock_set_json,
    ):
        now = datetime.now(timezone.utc)
        mock_get_crowdping_feed.return_value = [
            {
                "id": "legacy-ping-1",
                "location_tag": "Memorial Student Center",
                "lat": 30.61223,
                "lng": -96.34137,
                "post_type": "post",
                "created_at": now.isoformat(),
                "custom_data": {
                    "content_type": "ping",
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
        mock_resolve_place.return_value = mock_get_place_by_id.return_value
        mock_serialize_place.return_value = {"place_id": "msc"}

        result = pulse_service.get_pulse_map(limit=12)

        self.assertEqual(len(result["hotspots"]), 1)
        self.assertEqual(result["hotspots"][0]["items"][0]["id"], "legacy-ping-1")

    @mock.patch.object(pulse_service.cache_service, "set_json")
    @mock.patch.object(pulse_service.cache_service, "get_json", return_value=None)
    @mock.patch.object(pulse_service, "_resolve_access_scope", return_value=([], False))
    @mock.patch.object(pulse_service, "_load_admin_events", return_value=[])
    @mock.patch.object(pulse_service, "_load_occupancy_by_place", return_value={})
    @mock.patch.object(pulse_service.feed_repository, "get_batch_interaction_counts", return_value={})
    @mock.patch.object(pulse_service.feed_repository, "get_crowdping_feed")
    @mock.patch.object(pulse_service.place_registry_service, "serialize_place")
    @mock.patch.object(pulse_service.place_registry_service, "get_place_by_id")
    @mock.patch.object(pulse_service.place_registry_service, "resolve_place")
    @mock.patch.object(pulse_service.campus_hub_service, "_ensure_social_tables")
    def test_get_pulse_map_uses_custom_place_id_when_top_level_place_id_missing(
        self,
        _mock_ensure_tables,
        mock_resolve_place,
        mock_get_place_by_id,
        mock_serialize_place,
        mock_get_crowdping_feed,
        _mock_get_batch_counts,
        _mock_load_occupancy,
        _mock_load_admin_events,
        _mock_resolve_access_scope,
        _mock_get_json,
        _mock_set_json,
    ):
        now = datetime.now(timezone.utc)
        mock_get_crowdping_feed.return_value = [
            {
                "id": "custom-place-ping",
                "location_tag": None,
                "lat": 30.61223,
                "lng": -96.34137,
                "post_type": "ping",
                "created_at": now.isoformat(),
                "custom_data": {
                    "place_id": "msc",
                    "place_name": "Memorial Student Center",
                    "ping_title": "Pizza now",
                    "ping_category": "Free Food",
                    "start_at": now.isoformat(),
                },
            }
        ]
        mock_get_place_by_id.return_value = {
            "place_id": "msc",
            "name": "Memorial Student Center",
            "lat": 30.61223,
            "lng": -96.34137,
        }
        mock_resolve_place.return_value = None
        mock_serialize_place.return_value = {"place_id": "msc"}

        result = pulse_service.get_pulse_map(limit=12)

        self.assertEqual(len(result["hotspots"]), 1)
        self.assertEqual(result["hotspots"][0]["place_id"], "msc")
        self.assertEqual(result["hotspots"][0]["items"][0]["id"], "custom-place-ping")

    @mock.patch.object(pulse_service.cache_service, "set_json")
    @mock.patch.object(pulse_service.cache_service, "get_json", return_value=None)
    @mock.patch.object(pulse_service, "_resolve_access_scope", return_value=([], False))
    @mock.patch.object(pulse_service, "_load_admin_events", return_value=[])
    @mock.patch.object(pulse_service, "_load_occupancy_by_place", return_value={})
    @mock.patch.object(pulse_service.feed_repository, "get_batch_interaction_counts", return_value={})
    @mock.patch.object(pulse_service.feed_repository, "get_crowdping_feed")
    @mock.patch.object(pulse_service.place_registry_service, "serialize_place")
    @mock.patch.object(pulse_service.place_registry_service, "get_place_by_id")
    @mock.patch.object(pulse_service.place_registry_service, "resolve_place")
    @mock.patch.object(pulse_service.campus_hub_service, "_ensure_social_tables")
    def test_get_pulse_map_does_not_mutate_registry_place_name_on_fallback(
        self,
        _mock_ensure_tables,
        mock_resolve_place,
        mock_get_place_by_id,
        mock_serialize_place,
        mock_get_crowdping_feed,
        _mock_get_batch_counts,
        _mock_load_occupancy,
        _mock_load_admin_events,
        _mock_resolve_access_scope,
        _mock_get_json,
        _mock_set_json,
    ):
        now = datetime.now(timezone.utc)
        registry_place = {
            "place_id": "MSC",
            "name": "Memorial Student Center",
            "lat": 30.61223,
            "lng": -96.34137,
        }
        mock_get_crowdping_feed.return_value = [
            {
                "id": "fallback-name-ping",
                "location_tag": None,
                "lat": None,
                "lng": None,
                "post_type": "ping",
                "created_at": now.isoformat(),
                "custom_data": {
                    "ping_title": "Mystery ping",
                    "start_at": now.isoformat(),
                },
            }
        ]
        mock_get_place_by_id.return_value = registry_place
        mock_resolve_place.return_value = None
        mock_serialize_place.return_value = {"place_id": "MSC"}

        result = pulse_service.get_pulse_map(limit=12)

        self.assertEqual(len(result["hotspots"]), 1)
        self.assertEqual(result["hotspots"][0]["locationName"], "Campus")
        self.assertEqual(registry_place["name"], "Memorial Student Center")


if __name__ == "__main__":
    unittest.main()
