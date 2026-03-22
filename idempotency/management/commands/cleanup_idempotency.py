from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta

from idempotency.models import IdempotencyKey


class Command(BaseCommand):
    help = "Delete idempotency keys older than 24 hours."

    def handle(self, *args, **kwargs):

        cutoff = timezone.now() - timedelta(hours=24)

        old_keys = IdempotencyKey.objects.filter(created_at__lt=cutoff)

        count = old_keys.count()

        old_keys.delete()

        self.stdout.write(
            self.style.SUCCESS(f"Deleted {count} expired idempotency keys.")
        )