from django.urls import path
from billing.views import (
    InitiateCreditPurchaseView,
    ConfirmCreditPurchaseView,
    CreditBalanceView,
    ActivateSubscriptionView,
    PayMongoWebhookView,
)

urlpatterns = [
    path("credits/purchase/initiate/", InitiateCreditPurchaseView.as_view(), name="credits_purchase_initiate"),
    path("credits/purchase/confirm/", ConfirmCreditPurchaseView.as_view(), name="credits_purchase_confirm"),
    path("credits/balance/", CreditBalanceView.as_view(), name="credits_balance"),
    path("subscription/activate/", ActivateSubscriptionView.as_view(), name="subscription_activate"),
    path("webhooks/paymongo/", PayMongoWebhookView.as_view(), name="paymongo_webhook"),
]
