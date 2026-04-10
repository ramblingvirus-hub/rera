import os
import uuid

import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.settings_dev")
django.setup()

from django.conf import settings
from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from reports.models import InterviewSession, InterviewStatus, Report

settings.ALLOWED_HOSTS = [*settings.ALLOWED_HOSTS, "testserver"]


class SubmitInterviewRecoveryTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        unique = uuid.uuid4().hex
        self.user = User.objects.create_user(
            username=f"recover-user-{unique}",
            email=f"recover-{unique}@example.com",
            password="StrongPass123!",
        )

    def _build_answers(self):
        return {
            "q1": "Recovery Towers",
            "q3": "Makati",
            "q4": "Legazpi Village",
            "q6": "Developer Project",
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

    def test_submitted_interview_returns_existing_report_request_id(self):
        interview = InterviewSession.objects.create(
            user=self.user,
            interview_version="v1.1",
            responses=self._build_answers(),
            status=InterviewStatus.SUBMITTED,
        )

        report = Report.objects.create(
            request_id=uuid.uuid4(),
            timestamp_utc=timezone.now(),
            user=self.user,
            structure_version="1.0",
            total_score=78.0,
            risk_band="MODERATE_RISK",
            category_breakdown={
                "developer_legitimacy": 75,
                "project_compliance": 76,
                "title_land": 82,
                "financial_exposure": 70,
                "lgu_environment": 74,
            },
            license_to_sell_present=True,
            strengths=["sample"],
            signals=["sample"],
            information_gaps=["sample"],
            suggestions=["sample"],
            assessment_summary="sample summary",
            project_name="Recovery Towers",
            city="Makati",
            location="Legazpi Village",
        )

        self.client.force_authenticate(user=self.user)
        response = self.client.post(f"/api/v1/interview/{interview.id}/submit/", format="json")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data.get("request_id"), str(report.request_id))
        self.assertTrue(response.data.get("recovered"))

    def test_submitted_interview_without_report_returns_error(self):
        interview = InterviewSession.objects.create(
            user=self.user,
            interview_version="v1.1",
            responses=self._build_answers(),
            status=InterviewStatus.SUBMITTED,
        )

        self.client.force_authenticate(user=self.user)
        response = self.client.post(f"/api/v1/interview/{interview.id}/submit/", format="json")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data.get("error"), "Interview already submitted")