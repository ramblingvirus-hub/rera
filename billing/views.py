from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny
from billing.models import CreditTransaction, CreditPurchase
from billing.paymongo_service import PayMongoService, PayMongoException
from billing.services import calculate_user_balance
from django.utils import timezone
from django.db import transaction
from django.conf import settings
from datetime import timedelta
import uuid
from billing.models import CreditPurchase, CreditTransaction, Subscription
import hashlib
import hmac
import json
import logging


logger = logging.getLogger(__name__)


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


class PayMongoWebhookView(APIView):
    """
    Receives PayMongo webhook events and finalizes pending purchases.
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    SUCCESS_EVENT_TYPES = {"payment_intent.succeeded", "payment.paid"}
    FAILED_EVENT_TYPES = {"payment_intent.payment_failed", "payment.failed"}

    def post(self, request):
        webhook_secret = getattr(settings, "PAYMONGO_WEBHOOK_SECRET", None)
        if not webhook_secret:
            return Response(
                {"error": "Webhook secret is not configured."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        payload_bytes = request.body or b""
        signature = request.headers.get("x-paymongo-signature")

        if not self._is_valid_signature(payload_bytes, signature, webhook_secret):
            return Response(
                {"error": "Invalid webhook signature."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        try:
            event = json.loads(payload_bytes.decode("utf-8"))
        except Exception:
            return Response(
                {"error": "Invalid JSON payload."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        event_type = self._event_type(event)
        payment_intent_id = self._payment_intent_id(event)

        if not event_type or not payment_intent_id:
            return Response({"status": "ignored"}, status=status.HTTP_200_OK)

        if event_type in self.SUCCESS_EVENT_TYPES:
            processed = self._process_success(payment_intent_id)
            return Response(
                {
                    "status": "processed" if processed else "already_processed",
                    "payment_intent_id": payment_intent_id,
                },
                status=status.HTTP_200_OK,
            )

        if event_type in self.FAILED_EVENT_TYPES:
            self._process_failure(payment_intent_id)
            return Response(
                {"status": "failed_marked", "payment_intent_id": payment_intent_id},
                status=status.HTTP_200_OK,
            )

        return Response({"status": "ignored"}, status=status.HTTP_200_OK)

    def _is_valid_signature(self, payload_bytes, signature_header, webhook_secret):
        if not signature_header:
            return False

        # Expected header shape: "t=<unix>,v1=<hex>"
        parts = {}
        for chunk in signature_header.split(","):
            if "=" in chunk:
                k, v = chunk.split("=", 1)
                parts[k.strip()] = v.strip()

        timestamp = parts.get("t")
        provided_v1 = parts.get("v1")

        if not timestamp or not provided_v1:
            return False

        signed_payload = f"{timestamp}.".encode("utf-8") + payload_bytes
        expected_v1 = hmac.new(
            webhook_secret.encode("utf-8"),
            signed_payload,
            hashlib.sha256,
        ).hexdigest()

        return hmac.compare_digest(expected_v1, provided_v1)

    def _event_type(self, event):
        return (
            event.get("data", {})
            .get("attributes", {})
            .get("type")
        )

    def _payment_intent_id(self, event):
        data = event.get("data", {}).get("attributes", {}).get("data", {})

        # payment_intent.* events usually place intent id at data.id
        if data.get("id", "").startswith("pi_"):
            return data.get("id")

        # payment.* events usually contain payment_intent_id in attributes
        attrs = data.get("attributes", {})
        if attrs.get("payment_intent_id"):
            return attrs.get("payment_intent_id")

        return None

    def _process_success(self, payment_intent_id):
        with transaction.atomic():
            purchase = (
                CreditPurchase.objects.select_for_update()
                .select_related("user")
                .filter(paymongo_payment_id=payment_intent_id)
                .first()
            )

            if not purchase:
                logger.warning(
                    "PayMongo webhook success ignored: purchase not found for %s",
                    payment_intent_id,
                )
                return False

            if purchase.status == "completed":
                return False

            CreditTransaction.objects.create(
                user=purchase.user,
                amount=purchase.credits_purchased,
                type="purchase",
                expiry_date=timezone.now() + timedelta(days=365),
                reference_id=f"paymongo-{payment_intent_id}",
            )

            purchase.status = "completed"
            purchase.save(update_fields=["status", "updated_at"])
            return True

    def _process_failure(self, payment_intent_id):
        CreditPurchase.objects.filter(
            paymongo_payment_id=payment_intent_id,
            status="pending",
        ).update(status="failed")


