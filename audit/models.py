from django.db import models
from django.contrib.auth.models import User
import uuid
from .constants import EVENT_TYPE_CHOICES, SEVERITY_CHOICES


class AuditEvent(models.Model):

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )

    event_type = models.CharField(
        max_length=50,
        choices=EVENT_TYPE_CHOICES,
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


