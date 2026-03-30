import uuid
from unittest.mock import patch

from django.core import mail
from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from audit.models import AuditEvent
from contact.models import ContactMessage


@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class ContactMessageApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        cache.clear()

    def test_submit_contact_message_persists_and_emails_admin(self):
        request_id = str(uuid.uuid4())
        response = self.client.post(
            "/api/v1/contact/",
            {
                "name": "Linus",
                "email": "linus@example.com",
                "category": "GENERAL",
                "subject": "Need support",
                "message": "Hello team, I need help with my report.",
                "request_id": request_id,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["message"], "Message received. Our team will review your inquiry.")
        self.assertEqual(ContactMessage.objects.count(), 1)

        record = ContactMessage.objects.first()
        self.assertEqual(record.email, "linus@example.com")
        self.assertEqual(record.category, "GENERAL")
        self.assertEqual(str(record.request_id), request_id)

        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ["admin.heptageeks@gmail.com"])
        self.assertIn("[RERA CONTACT] GENERAL - Need support", mail.outbox[0].subject)

        self.assertTrue(
            AuditEvent.objects.filter(
                event_type="CONTACT_MESSAGE_SUBMITTED",
                metadata__category="GENERAL",
            ).exists()
        )

    def test_validation_rejects_short_subject_and_message(self):
        response = self.client.post(
            "/api/v1/contact/",
            {
                "email": "linus@example.com",
                "category": "GENERAL",
                "subject": "Hey",
                "message": "short",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("subject", response.data)
        self.assertIn("message", response.data)

    def test_rate_limit_blocks_fourth_submission_within_window(self):
        payload = {
            "email": "linus@example.com",
            "category": "GENERAL",
            "subject": "Need support",
            "message": "Hello team, I need help with my report.",
        }

        for _ in range(3):
            res = self.client.post("/api/v1/contact/", payload, format="json")
            self.assertEqual(res.status_code, 201)

        fourth = self.client.post("/api/v1/contact/", payload, format="json")
        self.assertEqual(fourth.status_code, 429)

    def test_email_failure_does_not_block_submission(self):
        payload = {
            "email": "linus@example.com",
            "category": "GENERAL",
            "subject": "Need support",
            "message": "Hello team, I need help with my report.",
        }

        with patch("contact.views.send_mail", side_effect=Exception("smtp down")):
            response = self.client.post("/api/v1/contact/", payload, format="json")

        self.assertEqual(response.status_code, 201)
        self.assertEqual(ContactMessage.objects.count(), 1)
