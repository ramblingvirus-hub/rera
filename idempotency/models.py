import uuid
from django.db import models
from django.conf import settings


class IdempotencyKey(models.Model):
    """
    Stores idempotency keys to prevent duplicate processing
    of the same request under retry conditions.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="idempotency_keys",
        db_index=True,
    )

    key = models.CharField(
    max_length=255,
    db_index=True,
    )

    request_hash = models.CharField(
        max_length=64,
    )

    response_snapshot = models.JSONField()

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "key"],
                name="unique_user_idempotency_key"
            )
        ]


    def __str__(self):
        return f"{self.user_id} - {self.key}"
