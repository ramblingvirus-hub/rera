from django.urls import path
from billing.views import (
    AdminManualPaymentReviewView,
    InitiateCreditPurchaseView,
    ConfirmCreditPurchaseView,
    CreditBalanceView,
    ActivateSubscriptionView,
    ManualPaymentConfigView,
    ManualPaymentListCreateView,
    PayMongoWebhookView,
)

urlpatterns = [
    path("credits/purchase/initiate/", InitiateCreditPurchaseView.as_view(), name="credits_purchase_initiate"),
    path("credits/purchase/confirm/", ConfirmCreditPurchaseView.as_view(), name="credits_purchase_confirm"),
    path("credits/balance/", CreditBalanceView.as_view(), name="credits_balance"),
    path("subscription/activate/", ActivateSubscriptionView.as_view(), name="subscription_activate"),
    path("manual-payments/config/", ManualPaymentConfigView.as_view(), name="manual_payment_config"),
    path("manual-payments/", ManualPaymentListCreateView.as_view(), name="manual_payment_list_create"),
    path("admin/manual-payments/<int:payment_id>/review/", AdminManualPaymentReviewView.as_view(), name="admin_manual_payment_review"),
    path("webhooks/paymongo/", PayMongoWebhookView.as_view(), name="paymongo_webhook"),
]
