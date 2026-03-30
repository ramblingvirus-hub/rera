import logging
import threading

import resend
from django.conf import settings
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from audit.constants import CONTACT_MESSAGE_SUBMITTED
from audit.services import log_audit_event
from .serializers import ContactMessageSerializer
from .throttles import ContactMessageSubmitRateThrottle

logger = logging.getLogger(__name__)


class ContactMessageCreateView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ContactMessageSubmitRateThrottle]

    def post(self, request):
        serializer = ContactMessageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        contact_message = serializer.save(
            user=request.user if getattr(request, "user", None) and request.user.is_authenticated else None
        )

        threading.Thread(
            target=self._send_admin_email,
            args=(contact_message,),
            daemon=True,
        ).start()
        self._log_contact_submission(request, contact_message)

        return Response(
            {"message": "Message received. Our team will review your inquiry."},
            status=status.HTTP_201_CREATED,
        )

    def _send_admin_email(self, contact_message):
        api_key = getattr(settings, "RESEND_API_KEY", None)
        if not api_key:
            logger.warning("RESEND_API_KEY not configured — contact email skipped")
            return

        resend.api_key = api_key
        resend_from = getattr(settings, "RESEND_FROM_EMAIL", "RERA <onboarding@resend.dev>")
        if "@gmail.com" in resend_from.lower():
            logger.warning("RESEND_FROM_EMAIL cannot be gmail.com; falling back to onboarding sender")
            resend_from = "RERA <onboarding@resend.dev>"

        subject = f"[RERA CONTACT] {contact_message.category} - {contact_message.subject}"
        body = (
            "New Contact Message Received\n\n"
            f"Category: {contact_message.category}\n"
            f"Name: {contact_message.name or 'N/A'}\n"
            f"Email: {contact_message.email}\n"
            f"Request ID: {contact_message.request_id or 'N/A'}\n\n"
            "Subject:\n"
            f"{contact_message.subject}\n\n"
            "Message:\n"
            f"{contact_message.message}\n\n"
            "Timestamp:\n"
            f"{contact_message.created_at.isoformat()}\n"
        )

        try:
            resend.Emails.send({
                "from": resend_from,
                "to": [settings.CONTACT_ADMIN_EMAIL],
                "subject": subject,
                "text": body,
            })
        except Exception:
            # Email issues must never block contact intake.
            logger.exception("Contact email send failed")

    def _log_contact_submission(self, request, contact_message):
        try:
            log_audit_event(
                user=request.user if getattr(request, "user", None) and request.user.is_authenticated else None,
                event_type=CONTACT_MESSAGE_SUBMITTED,
                severity="INFO",
                request_id=str(contact_message.request_id) if contact_message.request_id else None,
                metadata={
                    "category": contact_message.category,
                    "email": contact_message.email,
                    "request_id": str(contact_message.request_id) if contact_message.request_id else None,
                },
            )
        except Exception:
            logger.exception("Contact audit log failed")
