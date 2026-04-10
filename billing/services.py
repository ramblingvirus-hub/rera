from django.utils import timezone
from django.db.models import Sum, Q
from django.conf import settings
from audit.services import log_audit_event
from .models import CreditPurchase, CreditTransaction, ManualPayment, Subscription
from django.db import connection, transaction
from django.db.utils import OperationalError, ProgrammingError
from django.db.models.functions import Lower
from audit.constants import (
    PAYMENT_MANUAL_APPROVED,
    PAYMENT_MANUAL_REJECTED,
)
import uuid
from datetime import timedelta


MANUAL_CREDIT_PACKAGES = {
    "single": {
        "credits": 1,
        "amount_php": 550,
        "description": "1 RERA Report Credit - PHP 550",
    },
    "bundle_3": {
        "credits": 3,
        "amount_php": 1500,
        "description": "3 RERA Report Credits - PHP 1,500",
    },
    "bundle_5": {
        "credits": 5,
        "amount_php": 2000,
        "description": "5 RERA Report Credits - PHP 2,000",
    },
}

SUCCESS_PURCHASE_STATUSES = {"completed", "approved", "paid", "succeeded"}
APPROVED_MANUAL_STATUSES = {"approved"}


def paymongo_enabled():
    return bool(getattr(settings, "PAYMONGO_ENABLED", True))


def get_credit_package(package_key):
    return MANUAL_CREDIT_PACKAGES.get(package_key)


def user_has_admin_bypass(user):
    """Superusers are exempt from report credit and subscription checks."""
    return bool(user and getattr(user, "is_superuser", False))


def qa_bypass_unlock_enabled():
    """Temporary QA bypass switch for report paywall testing."""
    return bool(getattr(settings, "QA_BYPASS_UNLOCK", False))

def calculate_user_balance(user):
    """
    Returns the current usable credit balance for a user.
    Expired purchase credits are excluded.
    """

    now = timezone.now()

    # Self-heal historical records into immutable ledger entries.
    try:
        reconcile_manual_payment_credits(user)
        reconcile_completed_purchases(user)
    except Exception:
        # Balance checks must remain available even if reconciliation fails.
        pass

    transactions = CreditTransaction.objects.filter(
        user=user
    ).filter(
        Q(expiry_date__isnull=True) | Q(expiry_date__gte=now)
    )

    result = transactions.aggregate(total=Sum('amount'))

    return result['total'] or 0


def reconcile_manual_payment_credits(user):
    """
    Ensure every approved manual payment has a completed purchase record and
    exactly one immutable purchase ledger transaction.
    """
    if not user:
        return 0

    if not table_exists("billing_manualpayment"):
        return 0

    repaired = 0

    with transaction.atomic():
        approved_payments = (
            ManualPayment.objects
            .select_for_update()
            .select_related("credit_purchase")
            .annotate(status_lower=Lower("status"))
            .filter(user=user, status_lower__in=APPROVED_MANUAL_STATUSES)
        )

        for payment in approved_payments:
            reference_id = f"manual-{payment.id}"

            purchase = payment.credit_purchase
            if purchase is None:
                purchase = CreditPurchase.objects.create(
                    user=payment.user,
                    credits_purchased=payment.credits_purchased,
                    amount_php=payment.amount_php,
                    payment_method=f"manual_{payment.payment_method.lower()}",
                    paymongo_payment_id=None,
                    status="completed",
                )
                payment.credit_purchase = purchase
                payment.save(update_fields=["credit_purchase"])
            elif purchase.status != "completed":
                purchase.status = "completed"
                purchase.save(update_fields=["status", "updated_at"])

            has_purchase_txn = CreditTransaction.objects.filter(
                user=payment.user,
                type="purchase",
                reference_id=reference_id,
            ).exists()

            if has_purchase_txn:
                continue

            expiry_anchor = payment.reviewed_at or payment.created_at or timezone.now()
            CreditTransaction.objects.create(
                user=payment.user,
                amount=payment.credits_purchased,
                type="purchase",
                expiry_date=expiry_anchor + timedelta(days=365),
                reference_id=reference_id,
            )
            repaired += 1

    return repaired


def table_exists(table_name):
    try:
        return table_name in connection.introspection.table_names()
    except Exception:
        return False


def reconcile_completed_purchases(user):
    """
    Backfill missing purchase ledger rows from completed purchases.
    This protects balance visibility if historical jobs marked purchases
    as completed but never wrote immutable credit transactions.
    """
    if not user:
        return 0

    repaired = 0

    with transaction.atomic():
        purchases = (
            CreditPurchase.objects
            .select_for_update()
            .annotate(status_lower=Lower("status"))
            .filter(user=user, status_lower__in=SUCCESS_PURCHASE_STATUSES)
            .order_by("created_at")
        )

        for purchase in purchases:
            if purchase.paymongo_payment_id:
                reference_id = f"paymongo-{purchase.paymongo_payment_id}"
            elif str(purchase.payment_method or "").startswith("manual_"):
                reference_id = f"manual-purchase-{purchase.id}"
            else:
                reference_id = f"purchase-{purchase.id}"

            if CreditTransaction.objects.filter(
                user=user,
                type="purchase",
                reference_id=reference_id,
            ).exists():
                continue

            # If this manual purchase is linked to a manual payment record,
            # prefer the canonical manual-{payment_id} reference.
            if str(purchase.payment_method or "").startswith("manual_") and table_exists("billing_manualpayment"):
                linked_payment_id = (
                    ManualPayment.objects
                    .filter(credit_purchase_id=purchase.id)
                    .values_list("id", flat=True)
                    .first()
                )
                if linked_payment_id:
                    canonical_ref = f"manual-{linked_payment_id}"
                    if CreditTransaction.objects.filter(
                        user=user,
                        type="purchase",
                        reference_id=canonical_ref,
                    ).exists():
                        continue
                    reference_id = canonical_ref

            expiry_anchor = purchase.updated_at or purchase.created_at or timezone.now()

            CreditTransaction.objects.create(
                user=user,
                amount=purchase.credits_purchased,
                type="purchase",
                expiry_date=expiry_anchor + timedelta(days=365),
                reference_id=reference_id,
            )
            repaired += 1

    return repaired


def reconcile_user_credits(user):
    """
    Run all available reconciliation routines for a user and return summary.
    """
    repaired_manual = 0
    repaired_purchase = 0

    try:
        repaired_manual = reconcile_manual_payment_credits(user)
    except Exception:
        repaired_manual = 0

    try:
        repaired_purchase = reconcile_completed_purchases(user)
    except Exception:
        repaired_purchase = 0

    balance = calculate_user_balance(user)

    return {
        "repaired_manual": int(repaired_manual or 0),
        "repaired_purchase": int(repaired_purchase or 0),
        "credit_balance": int(balance or 0),
    }

def deduct_credit(user, reference_id=None):
    """
    Deducts 1 credit from user if balance is sufficient.
    Returns True if deduction successful.
    Raises ValueError if insufficient balance.
    """

    with transaction.atomic():

        from django.utils import timezone

        now = timezone.now()

        active_purchase = (
    CreditTransaction.objects
        .select_for_update()
        .filter(
            user=user,
            type="purchase"
        )
        .filter(
            Q(expiry_date__isnull=True) | Q(expiry_date__gte=now)
        )
        .order_by("-created_at")
        .first()
)

        if not active_purchase:
            raise ValueError("No active credit purchase found.")

        purchase_reference_id = reference_id or active_purchase.reference_id

        balance = calculate_user_balance(user)

        if balance < 1:
                 raise ValueError("Insufficient credits")

        CreditTransaction.objects.create(
                user=user,
                amount=-1,
                type='usage',
                expiry_date=None,
                reference_id=purchase_reference_id
            )

        
        return True

def has_active_subscription(user):
    """
    Active if:
    - status is 'active'
    - billing_date is today or later
    """
    today = timezone.localdate()
    return Subscription.objects.filter(
        user=user,
        status="active",
        billing_date__gte=today
    ).exists()


def has_unlimited_report_access(user):
    """Users with a valid subscription or superuser bypass can evaluate without credits."""
    return user_has_admin_bypass(user) or has_active_subscription(user) or qa_bypass_unlock_enabled()


def enforce_report_access(user, reference_id=None):
    """
    Enforces billing rules for report generation.

    Returns:
        "subscription" if user has active subscription
        "credit" if credit was deducted

    Raises:
        ValueError if insufficient credits
    """

    if user_has_admin_bypass(user):
        return "admin"

    if has_active_subscription(user):
        return "subscription"

    deduct_credit(user, reference_id=reference_id)
    return "credit"

def has_sufficient_credit(user):
    """
    Returns True if user has at least 1 usable credit.
    """
    return user_has_admin_bypass(user) or qa_bypass_unlock_enabled() or calculate_user_balance(user) >= 1

def create_credit_purchase(user, credit_amount, expiry_date, reference_id=None, source="manual"):
    """
    Creates a purchase ledger entry for credits.

    This is the ONLY approved entry point for adding credits.
    Used for:
    - Payment webhook
    - Manual admin credit grant
    - Refund compensation

    Returns updated user balance.
    """
    if has_active_subscription(user):
        raise ValueError("Cannot purchase credits while subscription is active.")
    
    if calculate_user_balance(user) > 0:
        raise ValueError("Cannot purchase new credits until existing credits are fully consumed.")
    
    if credit_amount <= 0:
        raise ValueError("Credit amount must be positive.")

    if not reference_id:
        reference_id = str(uuid.uuid4())

    with transaction.atomic():

        CreditTransaction.objects.create(
            user=user,
            amount=credit_amount,
            type="purchase",
            expiry_date=expiry_date,
            reference_id=reference_id
        )

        log_audit_event(
            user=user,
            event_type="CREDIT_PURCHASE_CREATED",
            severity="INFO",
            request_id=None,
            metadata={
                "amount": credit_amount,
                "source": source,
                "reference_id": reference_id,
            }
        )

    return calculate_user_balance(user)


def review_manual_payment(payment, reviewer, action, admin_notes=""):
    """
    Review a pending manual payment.

    Rules:
    - approved is idempotent (re-approve does nothing)
    - rejected is terminal
    - only pending can transition
    """
    action_normalized = str(action or "").strip().lower()
    if action_normalized not in {"approve", "reject"}:
        raise ValueError("action must be approve or reject")

    with transaction.atomic():
        locked = ManualPayment.objects.select_for_update().select_related("user").get(id=payment.id)

        if locked.status == ManualPayment.STATUS_APPROVED:
            return locked

        if locked.status == ManualPayment.STATUS_REJECTED:
            raise ValueError("Rejected payments cannot be reopened.")

        now = timezone.now()

        if action_normalized == "reject":
            locked.status = ManualPayment.STATUS_REJECTED
            locked.reviewed_at = now
            locked.reviewed_by = reviewer
            locked.admin_notes = (admin_notes or "").strip()
            locked.save(update_fields=["status", "reviewed_at", "reviewed_by", "admin_notes"])

            log_audit_event(
                user=reviewer,
                event_type=PAYMENT_MANUAL_REJECTED,
                severity="WARNING",
                metadata={
                    "payment_id": locked.id,
                    "user_id": locked.user_id,
                    "amount": float(locked.amount_php),
                    "package_key": locked.package_key,
                    "payment_method": locked.payment_method,
                    "reference_number": locked.reference_number,
                },
            )
            return locked

        package = get_credit_package(locked.package_key)
        if not package:
            raise ValueError("Unknown package key.")

        if int(locked.credits_purchased) != int(package["credits"]):
            raise ValueError("Payment credits do not match the configured package.")

        if float(locked.amount_php) != float(package["amount_php"]):
            raise ValueError("Payment amount does not match the configured package.")

        purchase = CreditPurchase.objects.create(
            user=locked.user,
            credits_purchased=locked.credits_purchased,
            amount_php=locked.amount_php,
            payment_method=f"manual_{locked.payment_method.lower()}",
            paymongo_payment_id=None,
            status="completed",
        )

        reference_id = f"manual-{locked.id}"
        if not CreditTransaction.objects.filter(
            user=locked.user,
            type="purchase",
            reference_id=reference_id,
        ).exists():
            CreditTransaction.objects.create(
                user=locked.user,
                amount=locked.credits_purchased,
                type="purchase",
                expiry_date=now + timedelta(days=365),
                reference_id=reference_id,
            )

        locked.status = ManualPayment.STATUS_APPROVED
        locked.reviewed_at = now
        locked.reviewed_by = reviewer
        locked.admin_notes = (admin_notes or "").strip()
        locked.credit_purchase = purchase
        locked.save(update_fields=["status", "reviewed_at", "reviewed_by", "admin_notes", "credit_purchase"])

        log_audit_event(
            user=reviewer,
            event_type=PAYMENT_MANUAL_APPROVED,
            severity="INFO",
            metadata={
                "payment_id": locked.id,
                "user_id": locked.user_id,
                "amount": float(locked.amount_php),
                "package_key": locked.package_key,
                "payment_method": locked.payment_method,
                "reference_number": locked.reference_number,
            },
        )

        return locked


