from rest_framework.views import APIView
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny
from billing.models import CreditPurchase, CreditTransaction, ManualPayment, Subscription
from billing.serializers import (
    AdminManualPaymentReviewSerializer,
    ManualPaymentConfigSerializer,
    ManualPaymentCreateResultSerializer,
    ManualPaymentSerializer,
    ManualPaymentSubmitSerializer,
)
from billing.paymongo_service import PayMongoService, PayMongoException
from billing.services import (
    MANUAL_CREDIT_PACKAGES,
    calculate_user_balance,
    get_credit_package,
    paymongo_enabled,
    review_manual_payment,
)
from django.utils import timezone
from django.db import transaction
from django.conf import settings
from datetime import timedelta
import uuid
import hashlib
import hmac
import json
import logging
from django.core.mail import send_mail
from audit.services import log_audit_event
from audit.constants import (
    CREDIT_PURCHASE_INITIATED,
    PAYMENT_FAILED,
    PAYMENT_MANUAL_SUBMITTED,
    PAYMENT_VERIFIED,
    PAYMENT_WEBHOOK_RECEIVED,
)


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


def build_manual_payment_instructions():
    return {
        "GCASH": {
            "number": getattr(settings, "GCASH_NUMBER", ""),
            "name": getattr(settings, "GCASH_NAME", ""),
            "qr_url": getattr(settings, "GCASH_QR_URL", ""),
        },
        "MAYA": {
            "number": getattr(settings, "MAYA_NUMBER", ""),
            "name": getattr(settings, "MAYA_NAME", ""),
            "qr_url": getattr(settings, "MAYA_QR_URL", ""),
        },
    }


class InitiateCreditPurchaseView(APIView):
    """
    Step 1 of credit purchase flow.
    Creates a hosted PayMongo checkout session and returns checkout URL.
    """
    permission_classes = [IsAuthenticated]

    def _resolve_redirect_urls(self, request):
        app_origin = (
            request.headers.get("Origin")
            or getattr(settings, "PAYMONGO_CHECKOUT_FRONTEND_ORIGIN", "")
            or (settings.CORS_ALLOWED_ORIGINS[0] if getattr(settings, "CORS_ALLOWED_ORIGINS", None) else "")
        )

        if app_origin:
            app_origin = app_origin.rstrip("/")
            return (
                f"{app_origin}/report",
                f"{app_origin}/report",
            )

        return (None, None)

    def post(self, request):
        if not paymongo_enabled():
            return Response(
                {"error": "PayMongo is temporarily disabled. Please use manual payment."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

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
            body_success = request.data.get("success_url") or None
            body_cancel = request.data.get("cancel_url") or None
            if body_success and body_cancel:
                success_url, cancel_url = body_success, body_cancel
            else:
                success_url, cancel_url = self._resolve_redirect_urls(request)

            checkout_session = paymongo.create_checkout_session(
                amount_cents=package["amount_centavos"],
                description=package["description"],
                metadata={
                    "user_id": str(request.user.id),
                    "package": package_key,
                    "credits": package["credits"],
                },
                success_url=success_url,
                cancel_url=cancel_url,
                reference_number=f"rera-{uuid.uuid4().hex[:12]}",
            )

            checkout_session_id = checkout_session.get("id")
            checkout_url = checkout_session.get("attributes", {}).get("checkout_url")

            if not checkout_session_id or not checkout_url:
                return Response(
                    {"error": "Payment initiation failed: checkout URL not returned."},
                    status=status.HTTP_502_BAD_GATEWAY,
                )

            # Record pending purchase
            purchase = CreditPurchase.objects.create(
                user=request.user,
                credits_purchased=package["credits"],
                amount_php=package["amount_php"],
                payment_method="paymongo",
                paymongo_payment_id=checkout_session_id,
                status="pending"
            )

            log_audit_event(
                user=request.user,
                event_type=CREDIT_PURCHASE_INITIATED,
                severity="INFO",
                request_id=None,
                metadata={
                    "purchase_id": purchase.id,
                    "package": package_key,
                    "amount_php": package["amount_php"],
                    "credits": package["credits"],
                    "checkout_session_id": checkout_session_id,
                },
            )

            return Response(
                {
                    "purchase_id": str(purchase.id),
                    "checkout_session_id": checkout_session_id,
                    "checkout_url": checkout_url,
                    "amount_php": package["amount_php"],
                    "credits": package["credits"],
                    "description": package["description"],
                    "status": "pending"
                },
                status=status.HTTP_201_CREATED
            )

        except PayMongoException as e:
            log_audit_event(
                user=request.user,
                event_type=PAYMENT_FAILED,
                severity="CRITICAL",
                metadata={"stage": "purchase_initiation", "error": str(e)},
            )
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
    Checks PayMongo payment status and credits user when succeeded.
    """
    permission_classes = [IsAuthenticated]

    SUCCESS_STATUSES = {"succeeded", "paid"}
    FAILED_STATUSES = {"cancelled", "failed", "expired"}

    def post(self, request):
        if not paymongo_enabled():
            return Response(
                {"error": "PayMongo is temporarily disabled. Please use manual payment."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

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
            paymongo_ref = (purchase.paymongo_payment_id or "").strip()

            if paymongo_ref.startswith("cs_"):
                session = paymongo.retrieve_checkout_session(paymongo_ref)
                session_attrs = session.get("attributes", {})
                session_status = session_attrs.get("status", "unknown")

                payments = session_attrs.get("payments") or []
                latest_payment = payments[-1] if payments else {}
                latest_status = latest_payment.get("attributes", {}).get("status", "unknown")

                payment_status = latest_status if latest_status != "unknown" else session_status
            else:
                payment_intent = paymongo.retrieve_payment_intent(paymongo_ref)
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

                log_audit_event(
                    user=request.user,
                    event_type=PAYMENT_VERIFIED,
                    severity="INFO",
                    request_id=None,
                    metadata={
                        "purchase_id": purchase.id,
                        "payment_status": payment_status,
                        "paymongo_payment_id": purchase.paymongo_payment_id,
                        "credits_added": purchase.credits_purchased,
                    },
                )

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
                log_audit_event(
                    user=request.user,
                    event_type=PAYMENT_FAILED,
                    severity="CRITICAL",
                    request_id=None,
                    metadata={
                        "purchase_id": purchase.id,
                        "payment_status": payment_status,
                        "paymongo_payment_id": purchase.paymongo_payment_id,
                    },
                )
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
            log_audit_event(
                user=request.user,
                event_type=PAYMENT_FAILED,
                severity="CRITICAL",
                metadata={"stage": "purchase_confirmation", "error": str(e)},
            )
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


class ManualPaymentConfigView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        payload = {
            "paymongo_enabled": paymongo_enabled(),
            "packages": MANUAL_CREDIT_PACKAGES,
            "methods": [ManualPayment.PAYMENT_METHOD_GCASH, ManualPayment.PAYMENT_METHOD_MAYA],
            "instructions": build_manual_payment_instructions(),
        }
        serializer = ManualPaymentConfigSerializer(payload)
        return Response(serializer.data, status=status.HTTP_200_OK)


class ManualPaymentListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        queryset = ManualPayment.objects.filter(user=request.user).select_related("reviewed_by").all()
        serializer = ManualPaymentSerializer(queryset, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = ManualPaymentSubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        package = get_credit_package(data["package"])
        if not package:
            return Response({"error": "Invalid package."}, status=status.HTTP_400_BAD_REQUEST)

        payment = ManualPayment.objects.create(
            user=request.user,
            package_key=data["package"],
            amount_php=package["amount_php"],
            credits_purchased=package["credits"],
            payment_method=data["payment_method"],
            reference_number=data["reference_number"],
            reference_note=data.get("reference_note", ""),
            proof_file=data["proof_file"],
            status=ManualPayment.STATUS_PENDING,
        )

        log_audit_event(
            user=request.user,
            event_type=PAYMENT_MANUAL_SUBMITTED,
            severity="INFO",
            metadata={
                "payment_id": payment.id,
                "user_id": request.user.id,
                "amount": float(payment.amount_php),
                "package_key": payment.package_key,
                "payment_method": payment.payment_method,
                "reference_number": payment.reference_number,
            },
        )

        admin_email = getattr(settings, "ADMIN_EMAIL", "")
        if admin_email:
            try:
                send_mail(
                    subject="RERA: New Payment Submitted",
                    message=(
                        f"User: {request.user.username}\n"
                        f"Amount: PHP {payment.amount_php}\n"
                        f"Method: {payment.payment_method}\n"
                        f"Reference Number: {payment.reference_number}\n"
                        f"Timestamp: {payment.created_at.isoformat()}\n"
                    ),
                    from_email=None,
                    recipient_list=[admin_email],
                    fail_silently=True,
                )
            except Exception:
                # Email must never block payment submission.
                pass

        result = ManualPaymentCreateResultSerializer(ManualPaymentCreateResultSerializer.build(payment))
        return Response(
            {
                "message": "Payment submitted for review",
                "payment": result.data,
            },
            status=status.HTTP_201_CREATED,
        )


class AdminManualPaymentReviewView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request, payment_id):
        payload = AdminManualPaymentReviewSerializer(data=request.data)
        payload.is_valid(raise_exception=True)

        payment = ManualPayment.objects.filter(id=payment_id).select_related("user").first()
        if not payment:
            return Response({"error": "Manual payment not found."}, status=status.HTTP_404_NOT_FOUND)

        action = payload.validated_data["action"]
        admin_notes = payload.validated_data.get("admin_notes", "")

        try:
            updated = review_manual_payment(
                payment=payment,
                reviewer=request.user,
                action=action,
                admin_notes=admin_notes,
            )
        except ValueError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(
            {
                "status": updated.status,
                "payment_id": updated.id,
            },
            status=status.HTTP_200_OK,
        )


class AdminManualPaymentListView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        queryset = ManualPayment.objects.select_related("user", "reviewed_by").all().order_by("-created_at")

        status_filter = (request.query_params.get("status") or "").strip().lower()
        if status_filter in {
            ManualPayment.STATUS_PENDING,
            ManualPayment.STATUS_APPROVED,
            ManualPayment.STATUS_REJECTED,
        }:
            queryset = queryset.filter(status=status_filter)

        username_filter = (request.query_params.get("username") or "").strip()
        if username_filter:
            queryset = queryset.filter(user__username__icontains=username_filter)

        serializer = ManualPaymentSerializer(queryset, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

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
        if not paymongo_enabled():
            return Response({"status": "disabled"}, status=status.HTTP_200_OK)

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

        log_audit_event(
            user=None,
            event_type=PAYMENT_WEBHOOK_RECEIVED,
            severity="INFO",
            request_id=None,
            metadata={"provider_event_type": event_type},
        )

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


