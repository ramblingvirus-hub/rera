from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)
from rest_framework.permissions import AllowAny
from django.conf import settings
from django.conf.urls.static import static
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status as drf_status
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
import re


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = (request.data.get("email") or "").strip().lower()
        password = (request.data.get("password") or "").strip()
        confirm = (request.data.get("confirm_password") or "").strip()

        if not email or not password or not confirm:
            return Response(
                {"error": "Email, password, and confirm_password are required."},
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

        if User.objects.filter(username=email).exists():
            return Response(
                {"error": "An account with this email already exists."},
                status=drf_status.HTTP_409_CONFLICT,
            )

        # Enforce password rules explicitly before Django's generic validator
        import re as _re
        if len(password) < 8:
            return Response(
                {"error": "Password must be at least 8 characters."},
                status=drf_status.HTTP_400_BAD_REQUEST,
            )
        if not _re.search(r'[A-Z]', password):
            return Response(
                {"error": "Password must contain at least one capital letter."},
                status=drf_status.HTTP_400_BAD_REQUEST,
            )
        if not _re.search(r'[0-9]', password):
            return Response(
                {"error": "Password must contain at least one number."},
                status=drf_status.HTTP_400_BAD_REQUEST,
            )
        if not _re.search(r'[^A-Za-z0-9]', password):
            return Response(
                {"error": "Password must contain at least one symbol (e.g. @, #, !, $)."},
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
            username=email,
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
        TokenObtainPairView.as_view(permission_classes=[AllowAny]),
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

    path("api/v1/", include("reports.urls")),
    path("api/v1/billing/", include("billing.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.BASE_DIR)