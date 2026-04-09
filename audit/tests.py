from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from audit.models import AuditEvent


class AuditApiTests(TestCase):
	def setUp(self):
		self.client = APIClient()
		self.admin = User.objects.create_superuser(
			username="audit_admin",
			email="audit_admin@example.com",
			password="Test@1234",
		)
		self.regular = User.objects.create_user(
			username="audit_user",
			email="audit_user@example.com",
			password="Test@1234",
		)

	def test_admin_audit_requires_superuser(self):
		self.client.force_authenticate(user=self.regular)
		response = self.client.get("/api/v1/admin/audit/")
		self.assertEqual(response.status_code, 403)

	def test_ops_events_alias_requires_superuser(self):
		self.client.force_authenticate(user=self.regular)
		response = self.client.get("/api/v1/ops/events/")
		self.assertEqual(response.status_code, 403)

	def test_admin_audit_returns_filtered_events(self):
		first = AuditEvent.objects.create(
			user=self.regular,
			event_type="EVALUATION_ATTEMPT",
			severity="INFO",
			metadata={"tag": "first"},
		)
		AuditEvent.objects.create(
			user=self.admin,
			event_type="THROTTLE_TRIGGERED",
			severity="CRITICAL",
			metadata={"tag": "second"},
		)

		self.client.force_authenticate(user=self.admin)
		response = self.client.get("/api/v1/admin/audit/", {"event_type": "EVALUATION_ATTEMPT", "limit": 1})

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.data["count"], 1)
		self.assertEqual(len(response.data["results"]), 1)
		self.assertEqual(response.data["results"][0]["id"], str(first.id))
		self.assertEqual(response.data["results"][0]["event_type"], "EVALUATION_ATTEMPT")

	def test_admin_audit_supports_offset_pagination(self):
		self.client.force_authenticate(user=self.admin)
		first = AuditEvent.objects.create(
			user=self.admin,
			event_type="PAGE_VIEW",
			severity="INFO",
			metadata={"idx": 1},
		)
		second = AuditEvent.objects.create(
			user=self.admin,
			event_type="PAGE_VIEW",
			severity="INFO",
			metadata={"idx": 2},
		)

		response = self.client.get("/api/v1/admin/audit/", {"event_type": "PAGE_VIEW", "limit": 1, "offset": 1})

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.data["count"], 2)
		self.assertEqual(response.data["offset"], 1)
		self.assertEqual(response.data["limit"], 1)
		self.assertEqual(len(response.data["results"]), 1)
		self.assertEqual(response.data["results"][0]["id"], str(first.id))
		self.assertIsNone(response.data["next_offset"])
		self.assertNotEqual(response.data["results"][0]["id"], str(second.id))

	def test_audit_log_rejects_invalid_event_type(self):
		self.client.force_authenticate(user=self.regular)
		response = self.client.post(
			"/api/v1/audit/log/",
			{"event_type": "UNKNOWN_EVENT", "metadata": {}},
			format="json",
		)

		self.assertEqual(response.status_code, 400)
		self.assertEqual(AuditEvent.objects.count(), 0)

	def test_audit_log_creates_event(self):
		self.client.force_authenticate(user=self.regular)
		response = self.client.post(
			"/api/v1/audit/log/",
			{
				"event_type": "PAGE_VIEW",
				"metadata": {"path": "/dashboard"},
			},
			format="json",
		)

		self.assertEqual(response.status_code, 201)
		self.assertEqual(AuditEvent.objects.count(), 1)
		event = AuditEvent.objects.first()
		self.assertEqual(event.event_type, "PAGE_VIEW")
		self.assertEqual(event.severity, "INFO")
		self.assertEqual(event.metadata.get("path"), "/dashboard")

	def test_events_log_alias_creates_event(self):
		self.client.force_authenticate(user=self.regular)
		response = self.client.post(
			"/api/v1/events/log/",
			{
				"event_type": "PAGE_VIEW",
				"metadata": {"path": "/dashboard"},
			},
			format="json",
		)

		self.assertEqual(response.status_code, 201)
		self.assertEqual(AuditEvent.objects.count(), 1)

	def test_token_contains_superuser_claim(self):
		response = self.client.post(
			"/api/token/",
			{"username": self.admin.username, "password": "Test@1234"},
			format="json",
		)

		self.assertEqual(response.status_code, 200)
		self.assertIn("access", response.data)

		import base64
		import json

		payload_part = response.data["access"].split(".")[1]
		padded = payload_part + "=" * (-len(payload_part) % 4)
		payload = json.loads(base64.urlsafe_b64decode(padded.encode("utf-8")).decode("utf-8"))

		self.assertTrue(payload.get("is_superuser"))
		self.assertEqual(payload.get("user_id"), self.admin.id)
