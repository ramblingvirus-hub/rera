from django.urls import path
from billing.views import (
    InitiateCreditPurchaseView,
    ConfirmCreditPurchaseView,
    CreditBalanceView,
    ActivateSubscriptionView,
)

urlpatterns = [
    path("credits/purchase/initiate/", InitiateCreditPurchaseView.as_view(), name="credits_purchase_initiate"),
    path("credits/purchase/confirm/", ConfirmCreditPurchaseView.as_view(), name="credits_purchase_confirm"),
    path("credits/balance/", CreditBalanceView.as_view(), name="credits_balance"),
    path("subscription/activate/", ActivateSubscriptionView.as_view(), name="subscription_activate"),
]
