from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from billing.models import CreditTransaction, CreditPurchase
from billing.paymongo_service import PayMongoService, PayMongoException
from billing.services import calculate_user_balance
from django.utils import timezone
from django.db import transaction
from datetime import timedelta
import uuid
from billing.models import CreditPurchase, CreditTransaction, Subscription


# Credit bundle pricing in Philippine Pesos (centavos for PayMongo)
CREDIT_PACKAGES = {
    "single": {
        "credits": 1,
        "amount_php": 550,
        "amount_centavos": 55000,
        "description": "1 RERA Report Credit - PHP 550"
    },
    "bundle_3": {
        "credits": 3,
        "amount_php": 1500,
        "amount_centavos": 150000,
        "description": "3 RERA Report Credits - PHP 1,500"
    },
    "bundle_5": {
        "credits": 5,
        "amount_php": 2000,
        "amount_centavos": 200000,
        "description": "5 RERA Report Credits - PHP 2,000"
    },
}


class InitiateCreditPurchaseView(APIView):
    """
    Step 1 of credit purchase flow.
    Creates a PayMongo payment intent and returns the client key
    so the frontend can complete the payment.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        package_key = request.data.get("package")

        if not package_key:
            return Response(
                {"error": "package is required. Choose: single, bundle_3, bundle_5"},
                status=status.HTTP_400_BAD_REQUEST
            )

        if package_key not in CREDIT_PACKAGES:
            return Response(
                {"error": f"Invalid package. Choose from: {list(CREDIT_PACKAGES.keys())}"},
                status=status.HTTP_400_BAD_REQUEST
            )

        package = CREDIT_PACKAGES[package_key]

        try:
            paymongo = PayMongoService()
            payment_intent = paymongo.create_payment_intent(
                amount_cents=package["amount_centavos"],
                description=package["description"],
                metadata={
                    "user_id": str(request.user.id),
                    "package": package_key,
                    "credits": package["credits"]
                }
            )

            # Record pending purchase
            purchase = CreditPurchase.objects.create(
                user=request.user,
                credits_purchased=package["credits"],
                amount_php=package["amount_php"],
                payment_method="paymongo",
                paymongo_payment_id=payment_intent["id"],
                status="pending"
            )

            return Response(
                {
                    "purchase_id": str(purchase.id),
                    "payment_intent_id": payment_intent["id"],
                    "client_key": payment_intent["attributes"]["client_key"],
                    "amount_php": package["amount_php"],
                    "credits": package["credits"],
                    "description": package["description"],
                    "status": "pending"
                },
                status=status.HTTP_201_CREATED
            )

        except PayMongoException as e:
            return Response(
                {"error": f"Payment initiation failed: {str(e)}"},
                status=status.HTTP_502_BAD_GATEWAY
            )
        except Exception:
            return Response(
                {"error": "Unexpected error occurred."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class ConfirmCreditPurchaseView(APIView):
    """
    Step 2 of credit purchase flow.
    Checks PayMongo payment intent status and credits user when succeeded.
    """
    permission_classes = [IsAuthenticated]

    SUCCESS_STATUSES = {"succeeded"}
    FAILED_STATUSES = {"cancelled"}

    def post(self, request):
        purchase_id = request.data.get("purchase_id")

        if not purchase_id:
            return Response(
                {"error": "purchase_id is required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            purchase = CreditPurchase.objects.get(id=purchase_id, user=request.user)
        except CreditPurchase.DoesNotExist:
            return Response(
                {"error": "Purchase not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        # Idempotent: if already completed, return current balance
        if purchase.status == "completed":
            return Response(
                {
                    "purchase_id": str(purchase.id),
                    "status": "completed",
                    "credits_added": 0,
                    "credit_balance": calculate_user_balance(request.user),
                    "message": "Purchase already completed"
                },
                status=status.HTTP_200_OK
            )

        try:
            paymongo = PayMongoService()
            payment_intent = paymongo.retrieve_payment_intent(purchase.paymongo_payment_id)
            payment_status = payment_intent.get("attributes", {}).get("status", "unknown")

            if payment_status in self.SUCCESS_STATUSES:
                with transaction.atomic():
                    # lock row for safe re-check
                    purchase = CreditPurchase.objects.select_for_update().get(id=purchase.id)

                    if purchase.status != "completed":
                        CreditTransaction.objects.create(
                            user=request.user,
                            amount=purchase.credits_purchased,
                            type="purchase",
                            expiry_date=timezone.now() + timedelta(days=365),
                            reference_id=f"paymongo-{purchase.paymongo_payment_id}"
                        )
                        purchase.status = "completed"
                        purchase.save(update_fields=["status", "updated_at"])

                return Response(
                    {
                        "purchase_id": str(purchase.id),
                        "status": "completed",
                        "credits_added": purchase.credits_purchased,
                        "credit_balance": calculate_user_balance(request.user),
                    },
                    status=status.HTTP_200_OK
                )

            if payment_status in self.FAILED_STATUSES:
                purchase.status = "failed"
                purchase.save(update_fields=["status", "updated_at"])
                return Response(
                    {
                        "purchase_id": str(purchase.id),
                        "status": "failed",
                        "credit_balance": calculate_user_balance(request.user),
                    },
                    status=status.HTTP_200_OK
                )

            # still pending / waiting action
            return Response(
                {
                    "purchase_id": str(purchase.id),
                    "status": "pending",
                    "payment_status": payment_status,
                    "credit_balance": calculate_user_balance(request.user),
                },
                status=status.HTTP_200_OK
            )

        except PayMongoException as e:
            return Response(
                {"error": f"Payment verification failed: {str(e)}"},
                status=status.HTTP_502_BAD_GATEWAY
            )
        except Exception:
            return Response(
                {"error": "Unexpected error occurred."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class CreditBalanceView(APIView):
    """Returns the current credit balance for the logged-in user."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        balance = calculate_user_balance(request.user)
        return Response(
            {"credit_balance": balance},
            status=status.HTTP_200_OK
        )

class ActivateSubscriptionView(APIView):
    """
    Activates or renews a user's subscription.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        paymongo_subscription_id = request.data.get("paymongo_subscription_id")
        period_days = int(request.data.get("period_days", 30))

        if not paymongo_subscription_id:
            return Response(
                {"error": "paymongo_subscription_id is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if period_days not in (30, 365):
            return Response(
                {"error": "period_days must be 30 or 365"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        existing = Subscription.objects.filter(
            paymongo_subscription_id=paymongo_subscription_id
        ).first()
        if existing and existing.user_id != request.user.id:
            return Response(
                {"error": "paymongo_subscription_id already linked to another user"},
                status=status.HTTP_409_CONFLICT,
            )

        next_billing_date = timezone.localdate() + timedelta(days=period_days)

        subscription, created = Subscription.objects.update_or_create(
            user=request.user,
            defaults={
                "paymongo_subscription_id": paymongo_subscription_id,
                "status": "active",
                "billing_date": next_billing_date,
            },
        )

        return Response(
            {
                "subscription_id": subscription.id,
                "status": subscription.status,
                "billing_date": subscription.billing_date.isoformat(),
                "created": created,
            },
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


