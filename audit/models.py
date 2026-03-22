from django.db import models
from django.contrib.auth.models import User
import uuid


class AuditEvent(models.Model):

    SEVERITY_CHOICES = [
        ("INFO", "Info"),
        ("WARNING", "Warning"),
        ("CRITICAL", "Critical"),
    ]

    EVENT_TYPES = [
        ("EVALUATION_ATTEMPT", "Evaluation Attempt"),
        ("EVALUATION_SUCCESS", "Evaluation Success"),
        ("EVALUATION_VALIDATION_FAIL", "Evaluation Validation Fail"),
        ("BILLING_SUBSCRIPTION_APPLIED", "Billing Subscription Applied"),
        ("BILLING_CREDIT_DEDUCTED", "Billing Credit Deducted"),
        ("BILLING_INSUFFICIENT_CREDIT", "Billing Insufficient Credit"),
        ("THROTTLE_TRIGGERED", "Throttle Triggered"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )

    event_type = models.CharField(
        max_length=50,
        choices=EVENT_TYPES,
        db_index=True,
    )

    severity = models.CharField(
        max_length=10,
        choices=SEVERITY_CHOICES,
    )

    request_id = models.UUIDField(
        null=True,
        blank=True,
        db_index=True,
    )

    metadata = models.JSONField(
        blank=True,
        null=True,
    )

    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-timestamp"]

    def __str__(self):
        return f"{self.event_type} | {self.timestamp}"
    
    def save(self, *args, **kwargs):
        if not self._state.adding:
            raise Exception("Audit events are immutable and cannot be updated.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise Exception("Audit events cannot be deleted.")


