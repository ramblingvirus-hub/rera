from django.contrib import admin
from django.utils import timezone

from .models import CreditPurchase, CreditTransaction, ManualPayment
from .services import review_manual_payment

@admin.register(CreditTransaction)
class CreditTransactionAdmin(admin.ModelAdmin):
    readonly_fields = [field.name for field in CreditTransaction._meta.fields]

    def has_delete_permission(self, request, obj=None):
        return False

    def has_change_permission(self, request, obj=None):
        return False


@admin.register(CreditPurchase)
class CreditPurchaseAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "credits_purchased", "amount_php", "payment_method", "status", "created_at")
    list_filter = ("status", "payment_method")
    search_fields = ("user__username", "paymongo_payment_id")
    readonly_fields = [field.name for field in CreditPurchase._meta.fields]


@admin.register(ManualPayment)
class ManualPaymentAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "user",
        "package_key",
        "amount_php",
        "payment_method",
        "reference_number",
        "status",
        "created_at",
    )
    list_filter = ("status", "payment_method", "package_key")
    search_fields = ("user__username", "reference_number", "reference_note")
    readonly_fields = (
        "user",
        "package_key",
        "amount_php",
        "credits_purchased",
        "payment_method",
        "reference_number",
        "reference_number_normalized",
        "reference_note",
        "proof_file",
        "created_at",
        "reviewed_at",
        "reviewed_by",
        "credit_purchase",
    )
    actions = ["approve_selected", "reject_selected"]

    def get_queryset(self, request):
        queryset = super().get_queryset(request)
        if request.GET.get("status__exact"):
            return queryset
        return queryset.filter(status=ManualPayment.STATUS_PENDING)

    @admin.action(description="Approve selected pending payments")
    def approve_selected(self, request, queryset):
        approved_count = 0
        for payment in queryset:
            try:
                updated = review_manual_payment(
                    payment=payment,
                    reviewer=request.user,
                    action="approve",
                    admin_notes=f"Approved in Django admin at {timezone.now().isoformat()}",
                )
                if updated.status == ManualPayment.STATUS_APPROVED:
                    approved_count += 1
            except ValueError:
                continue

        self.message_user(request, f"Approved {approved_count} payment(s).")

    @admin.action(description="Reject selected pending payments")
    def reject_selected(self, request, queryset):
        rejected_count = 0
        for payment in queryset:
            try:
                updated = review_manual_payment(
                    payment=payment,
                    reviewer=request.user,
                    action="reject",
                    admin_notes=f"Rejected in Django admin at {timezone.now().isoformat()}",
                )
                if updated.status == ManualPayment.STATUS_REJECTED:
                    rejected_count += 1
            except ValueError:
                continue

        self.message_user(request, f"Rejected {rejected_count} payment(s).")