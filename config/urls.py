from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import (
    TokenRefreshView,
)
from rest_framework.permissions import AllowAny
from django.conf import settings
from django.conf.urls.static import static
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status as drf_status
from django.contrib.auth.models import User
from django.contrib.auth.tokens import default_token_generator
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from django.utils.encoding import force_bytes, force_str
from django.core.mail import send_mail
from rest_framework.permissions import IsAuthenticated
import re
import logging
from config.jwt import RERATokenObtainPairView


logger = logging.getLogger(__name__)


def validate_password_policy(password):
    if len(password) < 8:
        return "Password must be at least 8 characters."
    if not re.search(r"[A-Z]", password):
        return "Password must contain at least one capital letter."
    if not re.search(r"[0-9]", password):
        return "Password must contain at least one number."
    if not re.search(r"[^A-Za-z0-9]", password):
        return "Password must contain at least one symbol (e.g. @, #, !, $)."
    return None


class ForgotPasswordView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = (request.data.get("email") or "").strip().lower()

        if not email:
            return Response(
                {"error": "Email is required."},
                status=drf_status.HTTP_400_BAD_REQUEST,
            )

        user = User.objects.filter(email__iexact=email).first()

        if user:
            try:
                uid = urlsafe_base64_encode(force_bytes(user.pk))
                token = default_token_generator.make_token(user)

                frontend_origin = (
                    request.headers.get("Origin")
                    or getattr(settings, "PAYMONGO_CHECKOUT_FRONTEND_ORIGIN", "")
                    or (settings.CORS_ALLOWED_ORIGINS[0] if getattr(settings, "CORS_ALLOWED_ORIGINS", None) else "")
                    or "http://localhost:5173"
                ).rstrip("/")

                reset_url = f"{frontend_origin}/reset-password?uid={uid}&token={token}"

                send_mail(
                    subject="RERA Password Reset",
                    message=(
                        "We received a request to reset your RERA password.\n\n"
                        f"Reset link: {reset_url}\n\n"
                        "If you did not request this, you can ignore this email."
                    ),
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[user.email],
                    fail_silently=False,
                )
            except Exception:
                logger.exception("Failed to send password reset email")

        # Do not leak whether an email exists.
        return Response(
            {"message": "If an account with that email exists, a reset link has been sent."},
            status=drf_status.HTTP_200_OK,
        )


class ResetPasswordConfirmView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        uid = (request.data.get("uid") or "").strip()
        token = (request.data.get("token") or "").strip()
        password = (request.data.get("password") or "").strip()
        confirm = (request.data.get("confirm_password") or "").strip()

        if not uid or not token or not password or not confirm:
            return Response(
                {"error": "uid, token, password, and confirm_password are required."},
                status=drf_status.HTTP_400_BAD_REQUEST,
            )

        if password != confirm:
            return Response(
                {"error": "Passwords do not match."},
                status=drf_status.HTTP_400_BAD_REQUEST,
            )

        policy_error = validate_password_policy(password)
        if policy_error:
            return Response(
                {"error": policy_error},
                status=drf_status.HTTP_400_BAD_REQUEST,
            )

        try:
            user_id = force_str(urlsafe_base64_decode(uid))
            user = User.objects.get(pk=user_id)
        except Exception:
            return Response(
                {"error": "Invalid password reset link."},
                status=drf_status.HTTP_400_BAD_REQUEST,
            )

        if not default_token_generator.check_token(user, token):
            return Response(
                {"error": "Password reset link has expired or is invalid."},
                status=drf_status.HTTP_400_BAD_REQUEST,
            )

        try:
            validate_password(password, user=user)
        except ValidationError as e:
            return Response(
                {"error": " ".join(e.messages)},
                status=drf_status.HTTP_400_BAD_REQUEST,
            )

        user.set_password(password)
        user.save(update_fields=["password"])

        return Response(
            {"message": "Password has been reset successfully."},
            status=drf_status.HTTP_200_OK,
        )


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        current_password = (request.data.get("current_password") or "").strip()
        password = (request.data.get("password") or "").strip()
        confirm = (request.data.get("confirm_password") or "").strip()

        if not current_password or not password or not confirm:
            return Response(
                {"error": "current_password, password, and confirm_password are required."},
                status=drf_status.HTTP_400_BAD_REQUEST,
            )

        if not request.user.check_password(current_password):
            return Response(
                {"error": "Current password is incorrect."},
                status=drf_status.HTTP_400_BAD_REQUEST,
            )

        if password != confirm:
            return Response(
                {"error": "Passwords do not match."},
                status=drf_status.HTTP_400_BAD_REQUEST,
            )

        policy_error = validate_password_policy(password)
        if policy_error:
            return Response(
                {"error": policy_error},
                status=drf_status.HTTP_400_BAD_REQUEST,
            )

        try:
            validate_password(password, user=request.user)
        except ValidationError as e:
            return Response(
                {"error": " ".join(e.messages)},
                status=drf_status.HTTP_400_BAD_REQUEST,
            )

        request.user.set_password(password)
        request.user.save(update_fields=["password"])

        return Response(
            {"message": "Password updated successfully."},
            status=drf_status.HTTP_200_OK,
        )


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        username = (request.data.get("username") or "").strip()
        email = (request.data.get("email") or "").strip().lower()
        password = (request.data.get("password") or "").strip()
        confirm = (request.data.get("confirm_password") or "").strip()

        if not username or not email or not password or not confirm:
            return Response(
                {"error": "Username, email, password, and confirm_password are required."},
                status=drf_status.HTTP_400_BAD_REQUEST,
            )

        if len(username) < 3:
            return Response(
                {"error": "Username must be at least 3 characters."},
                status=drf_status.HTTP_400_BAD_REQUEST,
            )

        if not re.match(r"^[A-Za-z0-9_.-]+$", username):
            return Response(
                {"error": "Username may only contain letters, numbers, underscore, dot, or hyphen."},
                status=drf_status.HTTP_400_BAD_REQUEST,
            )

        if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
            return Response(
                {"error": "Enter a valid email address."},
                status=drf_status.HTTP_400_BAD_REQUEST,
            )

        if password != confirm:
            return Response(
                {"error": "Passwords do not match."},
                status=drf_status.HTTP_400_BAD_REQUEST,
            )

        if User.objects.filter(username__iexact=username).exists():
            return Response(
                {"error": "This username is already taken."},
                status=drf_status.HTTP_409_CONFLICT,
            )

        if User.objects.filter(email__iexact=email).exists():
            return Response(
                {"error": "An account with this email already exists."},
                status=drf_status.HTTP_409_CONFLICT,
            )

        policy_error = validate_password_policy(password)
        if policy_error:
            return Response(
                {"error": policy_error},
                status=drf_status.HTTP_400_BAD_REQUEST,
            )

        try:
            validate_password(password)
        except ValidationError as e:
            return Response(
                {"error": " ".join(e.messages)},
                status=drf_status.HTTP_400_BAD_REQUEST,
            )

        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
        )

        return Response(
            {"message": "Account created successfully.", "username": user.username},
            status=drf_status.HTTP_201_CREATED,
        )


urlpatterns = [
    path('admin/', admin.site.urls),

    path('api/token/',
        RERATokenObtainPairView.as_view(permission_classes=[AllowAny]),
        name='token_obtain_pair'
    ),

    path('api/token/refresh/',
        TokenRefreshView.as_view(permission_classes=[AllowAny]),
        name='token_refresh'
    ),

    path('api/v1/auth/register/',
        RegisterView.as_view(),
        name='register'
    ),

    path('api/v1/auth/password/forgot/',
        ForgotPasswordView.as_view(),
        name='password_forgot'
    ),

    path('api/v1/auth/password/reset/',
        ResetPasswordConfirmView.as_view(),
        name='password_reset'
    ),

    path('api/v1/auth/password/change/',
        ChangePasswordView.as_view(),
        name='password_change'
    ),

    path("api/v1/", include("reports.urls")),
    path("api/v1/billing/", include("billing.urls")),
    path("api/v1/", include("contact.urls")),
    path("api/v1/", include("audit.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.BASE_DIR)
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)