import uuid

from django.contrib.auth.models import User
from django.db import models


class ContactMessage(models.Model):
    CATEGORY_GENERAL = "GENERAL"
    CATEGORY_REPORT_INQUIRY = "REPORT_INQUIRY"
    CATEGORY_PAYMENT_CONCERN = "PAYMENT_CONCERN"
    CATEGORY_SUGGESTION = "SUGGESTION"
    CATEGORY_TECHNICAL_ISSUE = "TECHNICAL_ISSUE"

    CATEGORY_CHOICES = [
        (CATEGORY_GENERAL, "General"),
        (CATEGORY_REPORT_INQUIRY, "Report Inquiry"),
        (CATEGORY_PAYMENT_CONCERN, "Payment Concern"),
        (CATEGORY_SUGGESTION, "Suggestion"),
        (CATEGORY_TECHNICAL_ISSUE, "Technical Issue"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    name = models.CharField(max_length=120, blank=True)
    email = models.EmailField()
    category = models.CharField(max_length=32, choices=CATEGORY_CHOICES)
    subject = models.CharField(max_length=200)
    message = models.TextField()
    request_id = models.UUIDField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.category} | {self.email}"
