import os
import uuid

import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.settings_dev")
django.setup()

from django.conf import settings
from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from billing.models import CreditTransaction
from billing.report_access import ReportAccessControl
from billing.services import has_sufficient_credit
from reports.models import Report

settings.ALLOWED_HOSTS = [*settings.ALLOWED_HOSTS, "testserver"]


class SuperuserBillingBypassTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        unique_suffix = uuid.uuid4().hex
        self.superuser = User.objects.create_user(
            username=f"superadmin-{unique_suffix}",
            email=f"admin-{unique_suffix}@example.com",
            password="StrongPass123!",
            is_staff=True,
            is_superuser=True,
        )
        self.client.force_authenticate(user=self.superuser)

    def test_superuser_is_treated_as_credit_eligible_without_ledger_entries(self):
        self.assertTrue(has_sufficient_credit(self.superuser))
        self.assertTrue(ReportAccessControl.can_access_full_report(self.superuser))
        self.assertEqual(ReportAccessControl.get_user_credit_balance(self.superuser), 0)

    def test_superuser_can_evaluate_without_deducting_credits(self):
        response = self.client.post(
            "/api/v1/evaluate/",
            {
                "answers": {
                    "q1": "Admin Test Project",
                    "q3": "Makati",
                    "q4": "Legazpi Village",
                    "q7": "Yes",
                    "q8": "Yes",
                    "q9": "Yes",
                    "q10": "Yes",
                    "q11": "TCT",
                    "q12": "No known issues",
                    "q13": "No",
                    "q14": "No",
                    "q15": "No",
                    "q16": "No",
                }
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["billing_type"], "admin")
        self.assertIn("strengths", payload["report"])
        self.assertIn("assessment_summary", payload["report"])
        self.assertIn("category_interpretations", payload["report"])
        self.assertFalse(CreditTransaction.objects.filter(user=self.superuser).exists())
        self.assertEqual(Report.objects.filter(user=self.superuser).count(), 1)

    def test_superuser_can_view_full_report_without_credits_or_subscription(self):
        report = Report.objects.create(
            request_id=uuid.uuid4(),
            timestamp_utc=timezone.now(),
            user=self.superuser,
            structure_version="1.0",
            total_score=82.5,
            risk_band="LOW_RISK",
            category_breakdown={
                "developer_legitimacy": 100,
                "project_compliance": 100,
                "title_land": 100,
                "financial_exposure": 60,
                "lgu_environment": 60,
            },
            license_to_sell_present=True,
            signals=["Sample signal"],
            information_gaps=["Sample gap"],
            suggestions=["Sample suggestion"],
            project_name="Admin View Project",
            city="Taguig",
            location="BGC",
        )

        response = self.client.get(f"/api/v1/reports/{report.request_id}/")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload["access"]["can_view_full_report"])
        self.assertEqual(payload["access"]["credit_balance"], 0)
        self.assertEqual(payload["access"]["locked_sections"], [])
        self.assertIn("assessment_summary", payload["report"])
        self.assertIn("strengths", payload["report"])
        self.assertIn("category_interpretations", payload["report"])
        self.assertIn("signals", payload["report"])


@override_settings(QA_BYPASS_UNLOCK=True)
class QaBypassUnlockTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        unique_suffix = uuid.uuid4().hex
        self.user = User.objects.create_user(
            username=f"qa-user-{unique_suffix}",
            email=f"qa-{unique_suffix}@example.com",
            password="StrongPass123!",
        )
        self.client.force_authenticate(user=self.user)

    def test_user_can_evaluate_without_credits_when_qa_bypass_enabled(self):
        response = self.client.post(
            "/api/v1/evaluate/",
            {
                "answers": {
                    "q1": "QA Bypass Project",
                    "q3": "Makati",
                    "q4": "Legazpi Village",
                    "q7": "Yes",
                    "q8": "Yes",
                    "q9": "Yes",
                    "q10": "Yes",
                    "q11": "TCT",
                    "q12": "No known issues",
                    "q13": "No",
                    "q14": "No",
                    "q15": "No",
                    "q16": "No",
                }
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["billing_type"], "qa_bypass")
        self.assertIn("strengths", payload["report"])
        self.assertIn("assessment_summary", payload["report"])
        self.assertIn("category_interpretations", payload["report"])
        self.assertFalse(CreditTransaction.objects.filter(user=self.user).exists())

    def test_user_can_view_full_report_without_credits_when_qa_bypass_enabled(self):
        report = Report.objects.create(
            request_id=uuid.uuid4(),
            timestamp_utc=timezone.now(),
            user=self.user,
            structure_version="1.0",
            total_score=82.5,
            risk_band="LOW_RISK",
            category_breakdown={
                "developer_legitimacy": 100,
                "project_compliance": 100,
                "title_land": 100,
                "financial_exposure": 60,
                "lgu_environment": 60,
            },
            license_to_sell_present=True,
            signals=["Sample signal"],
            information_gaps=["Sample gap"],
            suggestions=["Sample suggestion"],
            project_name="QA Bypass View Project",
            city="Taguig",
            location="BGC",
        )

        response = self.client.get(f"/api/v1/reports/{report.request_id}/")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload["access"]["can_view_full_report"])
        self.assertEqual(payload["access"]["locked_sections"], [])
        self.assertIn("assessment_summary", payload["report"])
        self.assertIn("strengths", payload["report"])
        self.assertIn("category_interpretations", payload["report"])
        self.assertIn("signals", payload["report"])


class ExistingOwnedReportAccessTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        unique_suffix = uuid.uuid4().hex
        self.user = User.objects.create_user(
            username=f"owned-report-user-{unique_suffix}",
            email=f"owned-report-{unique_suffix}@example.com",
            password="StrongPass123!",
        )
        self.client.force_authenticate(user=self.user)

    def test_owned_report_remains_unlocked_even_with_zero_credits(self):
        report = Report.objects.create(
            request_id=uuid.uuid4(),
            timestamp_utc=timezone.now(),
            user=self.user,
            structure_version="1.0",
            total_score=71.2,
            risk_band="MODERATE_RISK",
            category_breakdown={
                "developer_legitimacy": 70,
                "project_compliance": 72,
                "title_land": 68,
                "financial_exposure": 69,
                "lgu_environment": 77,
            },
            license_to_sell_present=True,
            signals=["Signal A"],
            information_gaps=["Gap A"],
            suggestions=["Suggestion A"],
            assessment_summary="Owned report should remain visible.",
            project_name="Owned Report Project",
            city="Makati",
            location="Ayala",
        )

        response = self.client.get(f"/api/v1/reports/{report.request_id}/")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload["access"]["can_view_full_report"])
        self.assertEqual(payload["access"]["locked_sections"], [])
        self.assertIn("assessment_summary", payload["report"])
        self.assertIn("signals", payload["report"])
