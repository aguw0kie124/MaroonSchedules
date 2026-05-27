import os
import sys
import unittest
from unittest import mock

BACKEND_ROOT = os.path.dirname(os.path.dirname(__file__))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from routers import admin, clubs
from services import campus_hub_service


class _FakeCursor:
    def __init__(self, fetchone_result=None):
        self.fetchone_result = fetchone_result
        self.executed = []

    def execute(self, query, params=None):
        self.executed.append((query, params))

    def fetchone(self):
        return self.fetchone_result

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False


class _FakeConnection:
    def __init__(self, fetchone_result=None):
        self.cursor_instance = _FakeCursor(fetchone_result=fetchone_result)
        self.committed = False

    def cursor(self, *args, **kwargs):
        return self.cursor_instance

    def commit(self):
        self.committed = True

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False


class CampusEventAccessTests(unittest.TestCase):
    @mock.patch.object(campus_hub_service, "_ensure_social_tables")
    @mock.patch.object(campus_hub_service.tag_repository, "get_user_tags")
    @mock.patch.object(campus_hub_service.user_repository, "get_user")
    @mock.patch.object(campus_hub_service.campus_events_service, "load_campus_events")
    @mock.patch.object(campus_hub_service, "_safe_db_fetchall")
    def test_get_events_snapshot_filters_by_user_tags(
        self,
        mock_fetchall,
        mock_load_events,
        mock_get_user,
        mock_get_user_tags,
        _mock_ensure_tables,
    ):
        mock_get_user.return_value = {"is_admin": False}
        mock_get_user_tags.return_value = ["Engineering"]
        mock_fetchall.side_effect = [[], [], [], []]
        mock_load_events.return_value = {
            "source_status": "live",
            "events": [
                {"event_id": "public", "title": "Public", "start_time": "2099-04-06T12:00:00Z", "access_tags": []},
                {
                    "event_id": "match",
                    "title": "Engineering Mixer",
                    "start_time": "2099-04-06T13:00:00Z",
                    "access_tags": ["Engineering"],
                },
                {
                    "event_id": "hidden",
                    "title": "Business Social",
                    "start_time": "2099-04-06T14:00:00Z",
                    "access_tags": ["Business"],
                },
            ],
        }

        result = campus_hub_service.get_events_snapshot(clerk_id="user_1", limit=20, student_relevant_only=False)

        event_ids = [event["event_id"] for event in result["events"]]
        self.assertEqual(event_ids, ["public", "match"])

    @mock.patch.object(campus_hub_service, "_ensure_social_tables")
    @mock.patch.object(campus_hub_service.tag_repository, "get_user_tags")
    @mock.patch.object(campus_hub_service.user_repository, "get_user")
    @mock.patch.object(campus_hub_service.campus_events_service, "load_campus_events")
    @mock.patch.object(campus_hub_service, "_safe_db_fetchall")
    def test_admin_users_bypass_tag_filtering(
        self,
        mock_fetchall,
        mock_load_events,
        mock_get_user,
        mock_get_user_tags,
        _mock_ensure_tables,
    ):
        mock_get_user.return_value = {"is_admin": True}
        mock_get_user_tags.return_value = []
        mock_fetchall.side_effect = [[], [], [], []]
        mock_load_events.return_value = {
            "source_status": "live",
            "events": [
                {"event_id": "eng", "title": "Engineering", "start_time": "2099-04-06T12:00:00Z", "access_tags": ["Engineering"]},
                {"event_id": "biz", "title": "Business", "start_time": "2099-04-06T13:00:00Z", "access_tags": ["Business"]},
            ],
        }

        result = campus_hub_service.get_events_snapshot(clerk_id="admin_1", limit=20, student_relevant_only=False)

        event_ids = [event["event_id"] for event in result["events"]]
        self.assertEqual(event_ids, ["eng", "biz"])

    @mock.patch.object(campus_hub_service, "_ensure_social_tables")
    @mock.patch.object(campus_hub_service.tag_repository, "get_user_tags")
    @mock.patch.object(campus_hub_service.user_repository, "get_user")
    @mock.patch.object(campus_hub_service.campus_events_service, "load_campus_events")
    @mock.patch.object(campus_hub_service, "_safe_db_fetchall")
    def test_get_events_snapshot_excludes_past_events(
        self,
        mock_fetchall,
        mock_load_events,
        mock_get_user,
        mock_get_user_tags,
        _mock_ensure_tables,
    ):
        mock_get_user.return_value = {"is_admin": False}
        mock_get_user_tags.return_value = []
        mock_fetchall.side_effect = [[], [], [], []]
        mock_load_events.return_value = {
            "source_status": "live",
            "events": [
                {
                    "event_id": "past",
                    "title": "Past Event",
                    "start_time": "2000-01-01T12:00:00Z",
                    "end_time": "2000-01-01T13:00:00Z",
                    "access_tags": [],
                },
                {
                    "event_id": "ongoing",
                    "title": "Ongoing Event",
                    "start_time": "2000-01-01T12:00:00Z",
                    "end_time": "2099-01-01T13:00:00Z",
                    "access_tags": [],
                },
                {
                    "event_id": "future",
                    "title": "Future Event",
                    "start_time": "2099-01-01T14:00:00Z",
                    "access_tags": [],
                },
            ],
        }

        result = campus_hub_service.get_events_snapshot(clerk_id="user_1", limit=20, student_relevant_only=False)

        event_ids = [event["event_id"] for event in result["events"]]
        self.assertEqual(event_ids, ["ongoing", "future"])

    @mock.patch.object(campus_hub_service, "_ensure_social_tables")
    @mock.patch.object(campus_hub_service.tag_repository, "get_user_tags")
    @mock.patch.object(campus_hub_service.user_repository, "get_user")
    @mock.patch.object(campus_hub_service.campus_events_service, "load_campus_events")
    @mock.patch.object(campus_hub_service, "_safe_db_fetchall")
    def test_get_events_snapshot_excludes_stale_admin_events_after_24_hours(
        self,
        mock_fetchall,
        mock_load_events,
        mock_get_user,
        mock_get_user_tags,
        _mock_ensure_tables,
    ):
        mock_get_user.return_value = {"is_admin": False}
        mock_get_user_tags.return_value = []
        mock_fetchall.side_effect = [
            [],
            [],
            [
                {
                    "id": "stale-admin",
                    "clerk_id": "admin_1",
                    "title": "Encrypted title",
                    "description": "Encrypted description",
                    "lat": None,
                    "lng": None,
                    "location_name": "Encrypted location",
                    "start_time": campus_hub_service.datetime.now(campus_hub_service.timezone.utc) - campus_hub_service.timedelta(days=2),
                    "end_time": campus_hub_service.datetime.now(campus_hub_service.timezone.utc) - campus_hub_service.timedelta(days=2, hours=-2),
                    "google_review_url": None,
                    "image_url": None,
                    "access_tags": [],
                    "organization_name": "Encrypted org",
                }
            ],
            [],
        ]
        mock_load_events.return_value = {"source_status": "live", "events": []}

        result = campus_hub_service.get_events_snapshot(clerk_id="user_1", limit=20, student_relevant_only=False)

        event_ids = [event["event_id"] for event in result["events"]]
        self.assertEqual(event_ids, [])

    @mock.patch.object(campus_hub_service, "_ensure_social_tables")
    @mock.patch.object(campus_hub_service.tag_repository, "get_user_tags")
    @mock.patch.object(campus_hub_service.user_repository, "get_user")
    @mock.patch.object(campus_hub_service.campus_events_service, "load_campus_events")
    @mock.patch.object(campus_hub_service, "_safe_db_fetchall")
    def test_get_events_snapshot_passes_campus_to_loader(
        self,
        mock_fetchall,
        mock_load_events,
        mock_get_user,
        mock_get_user_tags,
        _mock_ensure_tables,
    ):
        mock_get_user.return_value = {"is_admin": False}
        mock_get_user_tags.return_value = []
        mock_fetchall.side_effect = [[], [], [], []]
        mock_load_events.return_value = {
            "source_status": "live",
            "events": [
                {"event_id": "utd_1", "title": "UTD Event", "start_time": "2099-04-06T12:00:00Z", "access_tags": []},
            ],
        }

        result = campus_hub_service.get_events_snapshot(
            clerk_id="user_1",
            limit=20,
            student_relevant_only=False,
            campus="utd",
        )

        self.assertEqual([event["event_id"] for event in result["events"]], ["utd_1"])
        mock_load_events.assert_called_once_with(campus="utd")


class AdminTagRouteTests(unittest.TestCase):
    @mock.patch("repositories.user_repository.upsert_user")
    @mock.patch("repositories.user_repository.get_user")
    @mock.patch.object(admin, "_ensure_admin_application_schema")
    @mock.patch.object(admin.psycopg, "connect")
    def test_submit_admin_application_ensures_schema(
        self,
        mock_connect,
        mock_ensure_application_schema,
        mock_get_user,
        mock_upsert_user,
    ):
        fake_connection = _FakeConnection(fetchone_result=["application-123"])
        mock_connect.return_value = fake_connection
        mock_get_user.return_value = None

        req = admin.AdminApplicationRequest(
            clerk_id="user_1",
            email=None,
            organization_name="Aggie Coding Club",
            reason="We need to post campus events for members.",
        )

        response = admin.submit_admin_application(req, auth_user_id="user_1")

        self.assertEqual(response["application_id"], "application-123")
        mock_ensure_application_schema.assert_called_once_with(fake_connection)
        mock_upsert_user.assert_called_once_with(
            "user_1",
            email="user_1@users.clerk.local",
            full_name=None,
            profile_image_url=None,
        )
        insert_query, insert_params = fake_connection.cursor_instance.executed[-1]
        self.assertIn("INSERT INTO admin_applications", insert_query)
        self.assertEqual(insert_params[1], "user_1@users.clerk.local")
        self.assertTrue(fake_connection.committed)

    @mock.patch.object(admin, "_invalidate_admin_event_caches")
    @mock.patch.object(admin.tag_repository, "set_event_tags")
    @mock.patch.object(admin, "_ensure_admin_review_schema")
    @mock.patch.object(admin, "_require_admin_user")
    @mock.patch.object(admin.psycopg, "connect")
    def test_create_admin_event_assigns_tags(
        self,
        mock_connect,
        _mock_require_admin_user,
        _mock_ensure_admin_review_schema,
        mock_set_event_tags,
        _mock_invalidate,
    ):
        fake_connection = _FakeConnection(fetchone_result=["event-123"])
        mock_connect.return_value = fake_connection

        req = admin.AdminEventCreateRequest(
            clerk_id="admin_1",
            title="Engineering Night",
            description="Bring your project team.",
            lat=30.61,
            lng=-96.34,
            location_name="Zachry",
            start_time="2026-04-06T18:00:00Z",
            end_time="2026-04-06T20:00:00Z",
            google_review_url=None,
            image_url=None,
            tags=["Engineering", "Honors"],
        )

        response = admin.create_admin_event(req, auth_user_id="admin_1")

        self.assertEqual(response["event_id"], "event-123")
        mock_set_event_tags.assert_called_once_with("event-123", ["Engineering", "Honors"], conn=fake_connection)

    @mock.patch("repositories.user_repository.get_user")
    @mock.patch.object(admin.tag_repository, "set_user_tags")
    @mock.patch.object(admin, "_require_admin_user")
    def test_update_user_tags_returns_updated_user(
        self,
        _mock_require_admin_user,
        mock_set_user_tags,
        mock_get_user,
    ):
        mock_get_user.return_value = {
            "clerk_id": "user_9",
            "email": "student@example.com",
            "full_name": "Student Example",
            "tags": [],
        }
        mock_set_user_tags.return_value = ["Engineering", "Robotics"]

        req = admin.AdminUserTagsRequest(clerk_id="admin_1", tags=["Engineering", "Robotics"])
        response = admin.update_user_tags("user_9", req, auth_user_id="admin_1")

        self.assertEqual(response["tags"], ["Engineering", "Robotics"])
        mock_set_user_tags.assert_called_once_with("user_9", ["Engineering", "Robotics"])


class ClubJoinFlowTests(unittest.TestCase):
    @mock.patch.object(clubs.tag_repository, "create_club_join_request")
    def test_request_join_club_returns_repository_result(self, mock_create_join):
        mock_create_join.return_value = {
            "status": "approved",
            "club_tag": "Engineering",
            "auto_approved": True,
        }

        req = clubs.ClubJoinRequestCreate(clerk_id="user_2")
        response = clubs.request_club_join("admin_1", req, auth_user_id="user_2")

        self.assertEqual(response["status"], "approved")
        self.assertTrue(response["auto_approved"])
        mock_create_join.assert_called_once_with(admin_clerk_id="admin_1", requester_clerk_id="user_2")

    @mock.patch.object(admin.tag_repository, "review_club_join_request")
    @mock.patch.object(admin, "_require_admin_user")
    def test_approve_club_join_request_passes_tag_assignment_flag(
        self,
        _mock_require_admin_user,
        mock_review,
    ):
        mock_review.return_value = {"status": "approved", "club_tag": "Engineering"}

        req = admin.ClubJoinReviewRequest(clerk_id="admin_1", assign_club_tag=True)
        response = admin.approve_club_join_request("request-1", req, auth_user_id="admin_1")

        self.assertEqual(response["status"], "approved")
        mock_review.assert_called_once_with(
            request_id="request-1",
            admin_clerk_id="admin_1",
            approve=True,
            assign_club_tag=True,
        )


if __name__ == "__main__":
    unittest.main()
