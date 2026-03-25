from django.db import models
from django.core.exceptions import ValidationError
from django.contrib.auth.models import User
import uuid
from django.conf import settings


class Report(models.Model):
    request_id = models.UUIDField(unique=True)
    timestamp_utc = models.DateTimeField()

    user = models.ForeignKey(User, on_delete=models.CASCADE)


    structure_version = models.CharField(max_length=10)
    total_score = models.FloatField()
    risk_band = models.CharField(max_length=20)

    category_breakdown = models.JSONField()
    license_to_sell_present = models.BooleanField()
    
    # Explanation fields
    strengths = models.JSONField(default=list)
    signals = models.JSONField(default=list)
    information_gaps = models.JSONField(default=list)
    suggestions = models.JSONField(default=list)
    assessment_summary = models.TextField(blank=True, null=True)
    
    # Interview context
    project_name = models.CharField(max_length=255, blank=True, null=True)
    city = models.CharField(max_length=100, blank=True, null=True)
    location = models.CharField(max_length=100, blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if self.pk is not None:
            raise ValidationError("Reports are immutable and cannot be modified.")
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Report {self.request_id} - {self.risk_band}"

class InterviewStatus(models.TextChoices):
    DRAFT = "draft", "Draft"
    READY = "ready", "Ready"
    SUBMITTED = "submitted", "Submitted"

class InterviewSession(models.Model):

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="interviews",
        null=True,
        blank=True
    )

    interview_version = models.CharField(max_length=10)

    responses = models.JSONField(default=dict)

    status = models.CharField(
        max_length=20,
        choices=InterviewStatus.choices,
        default=InterviewStatus.DRAFT
    )

    created_at = models.DateTimeField(auto_now_add=True)

    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Interview {self.id} ({self.status})"






