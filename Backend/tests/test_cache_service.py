import json
import os
import sys
import unittest
from unittest import mock

BACKEND_ROOT = os.path.dirname(os.path.dirname(__file__))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from repositories import feed_repository
from services import cache_service


class _FakePipeline:
    def __init__(self):
        self.commands = []
        self.executed = False

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def setex(self, key, ttl_seconds, payload):
        self.commands.append((key, ttl_seconds, payload))

    def execute(self):
        self.executed = True


class _FakeRedisClient:
    def __init__(self, payloads=None):
        self.payloads = payloads or {}
        self.mget_calls = []
        self.pipeline_instance = _FakePipeline()

    def mget(self, keys):
        self.mget_calls.append(list(keys))
        return [self.payloads.get(key) for key in keys]

    def pipeline(self, transaction=False):
        return self.pipeline_instance


class CacheServiceTests(unittest.TestCase):
    def setUp(self):
        cache_service._MEMORY_CACHE.clear()
        cache_service._REDIS_CLIENT = None

    def tearDown(self):
        cache_service._MEMORY_CACHE.clear()
        cache_service._REDIS_CLIENT = None

    @mock.patch.object(cache_service, "_get_client")
    def test_get_json_uses_memory_before_redis(self, mock_get_client):
        cache_service._memory_set("demo:key", {"value": 1}, ttl_seconds=30)

        result = cache_service.get_json("demo:key")

        self.assertEqual(result, {"value": 1})
        mock_get_client.assert_not_called()

    @mock.patch.object(cache_service, "_get_client")
    def test_get_json_many_uses_single_mget_for_missing_keys(self, mock_get_client):
        cache_service._memory_set("hot:key", {"source": "memory"}, ttl_seconds=30)
        client = _FakeRedisClient(
            payloads={
                "cold:key": json.dumps({"source": "redis"}),
            }
        )
        mock_get_client.return_value = client

        result = cache_service.get_json_many(["hot:key", "cold:key", "miss:key"])

        self.assertEqual(
            result,
            {
                "hot:key": {"source": "memory"},
                "cold:key": {"source": "redis"},
            },
        )
        self.assertEqual(client.mget_calls, [["cold:key", "miss:key"]])

    @mock.patch.object(cache_service, "_get_client")
    def test_set_json_many_uses_pipeline(self, mock_get_client):
        client = _FakeRedisClient()
        mock_get_client.return_value = client

        cache_service.set_json_many(
            {
                "alpha:key": {"count": 1},
                "beta:key": {"count": 2},
            },
            ttl_seconds=120,
        )

        self.assertTrue(client.pipeline_instance.executed)
        self.assertEqual(
            client.pipeline_instance.commands,
            [
                ("alpha:key", 120, json.dumps({"count": 1}, ensure_ascii=False)),
                ("beta:key", 120, json.dumps({"count": 2}, ensure_ascii=False)),
            ],
        )


class _FakeCursor:
    def __init__(self, rows):
        self.rows = rows
        self.executed = []

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def execute(self, query, params):
        self.executed.append((query, params))

    def fetchall(self):
        return list(self.rows)


class _FakeConnection:
    def __init__(self, rows):
        self.rows = rows
        self.cursor_instance = _FakeCursor(rows)

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def cursor(self):
        return self.cursor_instance


class FeedRepositoryCacheTests(unittest.TestCase):
    @mock.patch.object(feed_repository.cache_service, "set_json_many")
    @mock.patch.object(feed_repository.cache_service, "get_json_many")
    @mock.patch.object(feed_repository.psycopg, "connect")
    def test_get_batch_interaction_counts_batches_cache_operations(
        self,
        mock_connect,
        mock_get_json_many,
        mock_set_json_many,
    ):
        mock_get_json_many.return_value = {
            "post:interactions:p1": {"like": 4, "comment": 1, "upvote": 3, "downvote": 1, "score": 2}
        }
        mock_connect.return_value = _FakeConnection(
            [
                ("p2", "like", 2),
                ("p2", "upvote", 5),
                ("p2", "downvote", 1),
            ]
        )

        result = feed_repository.get_batch_interaction_counts(["p1", "p2"])

        mock_get_json_many.assert_called_once_with(
            ["post:interactions:p1", "post:interactions:p2"]
        )
        mock_set_json_many.assert_called_once_with(
            {
                "post:interactions:p2": {
                    "like": 2,
                    "comment": 0,
                    "upvote": 5,
                    "downvote": 1,
                    "score": 4,
                }
            },
            ttl_seconds=1800,
        )
        self.assertEqual(result["p1"]["score"], 2)
        self.assertEqual(result["p2"]["score"], 4)


if __name__ == "__main__":
    unittest.main()
