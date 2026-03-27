from django.utils import timezone
from django.db.models import Sum, Q
from django.conf import settings
from audit.services import log_audit_event
from .models import CreditPurchase, CreditTransaction, ManualPayment, Subscription
from django.db import transaction
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

    transactions = CreditTransaction.objects.filter(
        user=user
    ).filter(
        Q(expiry_date__isnull=True) | Q(expiry_date__gte=now)
    )

    result = transactions.aggregate(total=Sum('amount'))

    return result['total'] or 0

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
        create_credit_purchase(
            user=locked.user,
            credit_amount=locked.credits_purchased,
            expiry_date=now + timedelta(days=365),
            reference_id=reference_id,
            source="manual_review",
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


