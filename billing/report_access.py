from django.db.models import Sum
from billing.models import CreditTransaction, Subscription
from django.utils import timezone


class ReportAccessControl:
    """Determines what report sections a user can access"""
    
    FREE_TEASER_SECTIONS = [
        'total_score',
        'risk_band'
    ]
    
    PAID_SECTIONS = [
        'category_breakdown',
        'signals',
        'information_gaps',
        'suggestions'
    ]
    
    REPORT_CREDIT_COST = 1  # Each report costs 1 credit (PHP 550)
    
    @staticmethod
    def user_has_active_subscription(user):
        """Check if user has active subscription"""
        try:
            subscription = Subscription.objects.get(user=user, status='active')
            if subscription.billing_date >= timezone.now().date():
                return True
        except Subscription.DoesNotExist:
            pass
        return False
    
    @staticmethod
    def user_has_sufficient_credits(user):
        """Check if user has at least 1 credit available"""
        balance = CreditTransaction.objects.filter(user=user).aggregate(
            total=Sum('amount')
        )['total'] or 0
        return balance >= ReportAccessControl.REPORT_CREDIT_COST
    
    @staticmethod
    def can_access_full_report(user):
        """
        User can access full report if:
        1. Has active subscription, OR
        2. Has sufficient credits
        """
        return (
            ReportAccessControl.user_has_active_subscription(user) or
            ReportAccessControl.user_has_sufficient_credits(user)
        )
    
    @staticmethod
    def get_user_credit_balance(user):
        """Get current credit balance"""
        balance = CreditTransaction.objects.filter(user=user).aggregate(
            total=Sum('amount')
        )['total'] or 0

        return balance

    @staticmethod
    def get_active_subscription(user):
        """Return active subscription object if currently valid, else None."""
        try:
            subscription = Subscription.objects.get(user=user, status='active')
        except Subscription.DoesNotExist:
            return None

        if subscription.billing_date >= timezone.now().date():
            return subscription

        return None

    @staticmethod
    def get_subscription_days_remaining(user):
        """Return remaining subscription days as a non-negative integer."""
        subscription = ReportAccessControl.get_active_subscription(user)
        if not subscription:
            return 0

        today = timezone.now().date()
        delta_days = (subscription.billing_date - today).days
        return max(delta_days, 0)
    

