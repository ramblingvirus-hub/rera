from django.db import models
from django.contrib.auth.models import User
from django.db.models import Q
from django.core.exceptions import ValidationError

class CreditTransaction(models.Model):
    TRANSACTION_TYPES = [
        ('purchase', 'Purchase'),
        ('usage', 'Usage'),
        ('refund', 'Refund'),
        ('admin_adjustment', 'Admin Adjustment'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE)
    amount = models.IntegerField()
    type = models.CharField(max_length=30, choices=TRANSACTION_TYPES)

    expiry_date = models.DateTimeField(null=True, blank=True)

    reference_id = models.CharField(max_length=100, null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if self.pk is not None:
            raise ValidationError("Ledger entries are immutable and cannot be updated.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError("Ledger entries cannot be deleted.")


    class Meta:
        ordering = ['created_at']
        constraints = [
            models.CheckConstraint(
                condition=(
                    ~Q(type='purchase') |
                    (
                        Q(expiry_date__isnull=False) &
                        Q(amount__gt=0)
                    )
                ),
                name='purchase_rule'
            ),
            models.CheckConstraint(
                condition=(
                    ~Q(type='usage') |
                    (
                        Q(expiry_date__isnull=True) &
                        Q(amount__lt=0)
                    )
                ),
                name='usage_rule'
            ),
            models.CheckConstraint(
                condition=(
                    ~Q(type='refund') |
                    (
                        Q(expiry_date__isnull=True) &
                        Q(amount__gt=0)
                    )
                ),
                name='refund_rule'
            ),
            models.CheckConstraint(
                condition=(
                    ~Q(type='admin_adjustment') |
                    Q(expiry_date__isnull=True)
                ),
                name='admin_adjustment_rule'
            ),
        ]

# ...existing code...


class CreditPurchase(models.Model):
    """Record of credit purchases for audit trail"""
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    credits_purchased = models.IntegerField()
    amount_php = models.DecimalField(max_digits=10, decimal_places=2)
    payment_method = models.CharField(max_length=50)  # 'paymongo'
    paymongo_payment_id = models.CharField(max_length=255, blank=True, null=True)
    status = models.CharField(
        max_length=20,
        choices=[
            ('pending', 'Pending'),
            ('completed', 'Completed'),
            ('failed', 'Failed'),
        ],
        default='pending'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']


class Subscription(models.Model):
    """Track active subscriptions"""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='subscription')
    paymongo_subscription_id = models.CharField(max_length=255, unique=True)
    status = models.CharField(
        max_length=20,
        choices=[
            ('active', 'Active'),
            ('cancelled', 'Cancelled'),
            ('expired', 'Expired'),
        ],
        default='active'
    )
    billing_date = models.DateField(default='2026-03-20')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "Subscriptions"





