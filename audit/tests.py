from django.conf import settings
from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from audit.models import AuditEvent
from audit.constants import LOGIN_FAILED, SUSPICIOUS_ACTIVITY


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
		self.assertEqual(response.data, {"detail": "Forbidden"})

	def test_ops_events_alias_requires_authentication(self):
		response = self.client.get("/api/v1/ops/events/")
		self.assertEqual(response.status_code, 401)
		self.assertEqual(response.data, {"detail": "Unauthorized"})

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

	def test_invalid_login_uses_minimal_response_and_logs_failure(self):
		response = self.client.post(
			"/api/token/",
			{"username": self.admin.username, "password": "wrong-password"},
			format="json",
		)

		self.assertEqual(response.status_code, 401)
		self.assertEqual(response.data, {"detail": "Unauthorized"})
		self.assertEqual(AuditEvent.objects.filter(event_type=LOGIN_FAILED).count(), 1)

	def test_invalid_refresh_uses_minimal_response_and_logs_suspicious_activity(self):
		response = self.client.post(
			"/api/token/refresh/",
			{"refresh": "not-a-real-refresh-token"},
			format="json",
		)

		self.assertEqual(response.status_code, 401)
		self.assertEqual(response.data, {"detail": "Unauthorized"})
		self.assertEqual(AuditEvent.objects.filter(event_type=SUSPICIOUS_ACTIVITY).count(), 1)

	def test_token_endpoint_is_rate_limited(self):
		rest_framework = dict(settings.REST_FRAMEWORK)
		rates = dict(rest_framework.get("DEFAULT_THROTTLE_RATES", {}))
		rates["token"] = "1/min"
		rest_framework["DEFAULT_THROTTLE_RATES"] = rates

		with override_settings(REST_FRAMEWORK=rest_framework):
			first = self.client.post(
				"/api/token/",
				{"username": self.admin.username, "password": "wrong-password"},
				format="json",
			)
			second = self.client.post(
				"/api/token/",
				{"username": self.admin.username, "password": "wrong-password"},
				format="json",
			)

		self.assertEqual(first.status_code, 401)
		self.assertEqual(second.status_code, 429)
		self.assertEqual(second.data, {"detail": "Too many requests"})
