import os
import uuid

import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.settings_dev")
django.setup()

from django.conf import settings
from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from audit.constants import LOGIN_FAILED, SUSPICIOUS_ACTIVITY
from audit.models import AuditEvent
from config.throttles import TokenRateThrottle

settings.ALLOWED_HOSTS = [*settings.ALLOWED_HOSTS, "testserver"]


class ApiSecurityHardeningTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        unique_suffix = uuid.uuid4().hex
        self.admin = User.objects.create_superuser(
            username=f"security-admin-{unique_suffix}",
            email=f"security-admin-{unique_suffix}@example.com",
            password="StrongPass123!",
        )
        self.user = User.objects.create_user(
            username=f"security-user-{unique_suffix}",
            email=f"security-user-{unique_suffix}@example.com",
            password="StrongPass123!",
        )

    def test_ops_events_requires_authentication_with_minimal_response(self):
        response = self.client.get("/api/v1/ops/events/")

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.data, {"detail": "Unauthorized"})

    def test_admin_billing_list_requires_admin_with_minimal_response(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get("/api/v1/billing/admin/manual-payments/")

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.data, {"detail": "Forbidden"})

    def test_admin_billing_review_requires_admin_with_minimal_response(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.post(
            "/api/v1/billing/admin/manual-payments/999/review/",
            data={"action": "approve", "admin_notes": "blocked"},
            format="json",
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.data, {"detail": "Forbidden"})

    def test_invalid_login_logs_failure_and_returns_minimal_response(self):
        response = self.client.post(
            "/api/token/",
            {"username": self.admin.username, "password": "wrong-password"},
            format="json",
        )

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.data, {"detail": "Unauthorized"})
        self.assertEqual(AuditEvent.objects.filter(event_type=LOGIN_FAILED).count(), 1)

    def test_invalid_refresh_logs_suspicious_activity_and_returns_minimal_response(self):
        response = self.client.post(
            "/api/token/refresh/",
            {"refresh": "not-a-real-refresh-token"},
            format="json",
        )

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.data, {"detail": "Unauthorized"})
        self.assertEqual(AuditEvent.objects.filter(event_type=SUSPICIOUS_ACTIVITY).count(), 1)

    def test_token_endpoint_is_rate_limited(self):
        had_rate = hasattr(TokenRateThrottle, "rate")
        had_num_requests = hasattr(TokenRateThrottle, "num_requests")
        had_duration = hasattr(TokenRateThrottle, "duration")
        original_rate = getattr(TokenRateThrottle, "rate", None)
        original_num_requests = getattr(TokenRateThrottle, "num_requests", None)
        original_duration = getattr(TokenRateThrottle, "duration", None)
        TokenRateThrottle.rate = "1/min"
        throttle = TokenRateThrottle()
        TokenRateThrottle.num_requests, TokenRateThrottle.duration = throttle.parse_rate("1/min")
        cache.clear()

        try:
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
        finally:
            if had_rate:
                TokenRateThrottle.rate = original_rate
            else:
                delattr(TokenRateThrottle, "rate")

            if had_num_requests:
                TokenRateThrottle.num_requests = original_num_requests
            else:
                delattr(TokenRateThrottle, "num_requests")

            if had_duration:
                TokenRateThrottle.duration = original_duration
            else:
                delattr(TokenRateThrottle, "duration")

            cache.clear()

        self.assertEqual(first.status_code, 401)
        self.assertEqual(second.status_code, 429)
        self.assertEqual(second.data, {"detail": "Too many requests"})