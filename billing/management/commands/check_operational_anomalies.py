from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from billing.models import CreditTransaction
from django.db.models import Count
from audit.models import AuditEvent
import logging

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = "Checks for operational anomalies in the RERA system"

    def handle(self, *args, **options):
        now = timezone.now()
        window_start = now - timedelta(minutes=5)
        
        system_health = "HEALTHY"

        recent_usage = CreditTransaction.objects.filter(
            type="usage",
            created_at__gte=window_start
        )

        recent_validation_failures = AuditEvent.objects.filter(
            event_type="EVALUATION_VALIDATION_FAIL",
            timestamp__gte=window_start
        )

        validation_fail_count = recent_validation_failures.count()

        recent_eval_attempts = AuditEvent.objects.filter(
            event_type="EVALUATION_ATTEMPT",
            timestamp__gte=window_start
        )

        eval_attempt_count = recent_eval_attempts.count()

        usage_by_user = (
            recent_usage
            .values("user_id")
            .annotate(count=Count("id"))
        )

        usage_count = recent_usage.count()

        local_now = timezone.localtime(now)
        
        print("Monitoring time (Manila):", local_now)
        print("RERA Operational Monitoring")
        print("Checking credit usage since:", window_start)

        print("Credits consumed in last 5 minutes:", usage_count)
        print("Validation failures in last 5 minutes:", validation_fail_count)
        print("Evaluation attempts in last 5 minutes:", eval_attempt_count)

        if eval_attempt_count > 50:
            print("⚠ ANOMALY: High evaluation request velocity detected!")
            system_health = "ANOMALY DETECTED"
        
               
        if validation_fail_count > 5:
            print("⚠ ANOMALY: Excessive validation failures detected!")
            system_health = "ANOMALY DETECTED"

        if usage_count > 10:
            print("WARNING: High credit consumption detected!")
            system_health = "ANOMALY DETECTED"
        else:
            print("Usage level appears normal.")


        print("\nUsage by user:")

        if not usage_by_user:
            print("No recent credit usage detected.")

        for entry in usage_by_user:
            user_id = entry["user_id"]
            count = entry["count"]

            print("User", user_id, "used", count, "credits")

            if count > 10:
                print("⚠ ANOMALY: User", user_id, "exceeded safe usage threshold")

        print("\n-----------------------------------")
        print("SYSTEM STATUS:", system_health)

        if system_health == "HEALTHY":
            logger.info("Operational monitoring check completed: SYSTEM STATUS HEALTHY")
        else:
            logger.error(f"ANOMALY DETECTED: SYSTEM STATUS {system_health}")

