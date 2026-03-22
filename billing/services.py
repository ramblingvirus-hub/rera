from django.utils import timezone
from django.db.models import Sum, Q
from audit.services import log_audit_event
from .models import CreditTransaction, Subscription
from django.db import transaction
from audit.constants import BILLING_CREDIT_DEDUCTED
import uuid

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

def deduct_credit(user):
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

        purchase_reference_id = active_purchase.reference_id

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


def enforce_report_access(user, reference_id=None):
    """
    Enforces billing rules for report generation.

    Returns:
        "subscription" if user has active subscription
        "credit" if credit was deducted

    Raises:
        ValueError if insufficient credits
    """

    if has_active_subscription(user):
        return "subscription"

    deduct_credit(user, reference_id=reference_id)
    return "credit"

def has_sufficient_credit(user):
    """
    Returns True if user has at least 1 usable credit.
    """
    return calculate_user_balance(user) >= 1

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
            request_id=reference_id if reference_id else None,
            metadata={
                "amount": credit_amount,
                "source": source
            }
        )

    return calculate_user_balance(user)


