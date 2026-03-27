from django.db import models
from django.contrib.auth.models import User
from django.db.models import Q
from django.core.exceptions import ValidationError
from django.core.validators import FileExtensionValidator, MinValueValidator

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


class ManualPayment(models.Model):
    PAYMENT_METHOD_GCASH = "GCASH"
    PAYMENT_METHOD_MAYA = "MAYA"

    STATUS_PENDING = "pending"
    STATUS_APPROVED = "approved"
    STATUS_REJECTED = "rejected"

    PAYMENT_METHOD_CHOICES = [
        (PAYMENT_METHOD_GCASH, "GCash"),
        (PAYMENT_METHOD_MAYA, "Maya"),
    ]

    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_APPROVED, "Approved"),
        (STATUS_REJECTED, "Rejected"),
    ]

    PACKAGE_CHOICES = [
        ("single", "Single"),
        ("bundle_3", "Bundle 3"),
        ("bundle_5", "Bundle 5"),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="manual_payments")
    package_key = models.CharField(max_length=20, choices=PACKAGE_CHOICES)
    amount_php = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(0.01)])
    credits_purchased = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    payment_method = models.CharField(max_length=10, choices=PAYMENT_METHOD_CHOICES)
    reference_number = models.CharField(max_length=120)
    reference_number_normalized = models.CharField(max_length=120, unique=True)
    reference_note = models.CharField(max_length=255, blank=True)
    proof_file = models.FileField(
        upload_to="manual_payments/%Y/%m/",
        validators=[FileExtensionValidator(allowed_extensions=["png", "jpg", "jpeg", "pdf"])],
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    admin_notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="manual_payments_reviewed",
    )
    credit_purchase = models.ForeignKey(
        CreditPurchase,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="manual_payment_records",
    )

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"ManualPayment #{self.pk} ({self.payment_method})"

    @staticmethod
    def normalize_reference(value):
        return "".join(str(value or "").strip().upper().split())

    def clean(self):
        super().clean()

        if not self.reference_number:
            raise ValidationError({"reference_number": "Reference number is required."})

        normalized = self.normalize_reference(self.reference_number)
        if not normalized:
            raise ValidationError({"reference_number": "Reference number is required."})

        self.reference_number_normalized = normalized

        if self.status == self.STATUS_APPROVED and not self.reviewed_at:
            raise ValidationError({"reviewed_at": "Approved payments must include a review timestamp."})

    def save(self, *args, **kwargs):
        self.reference_number_normalized = self.normalize_reference(self.reference_number)
        super().save(*args, **kwargs)





