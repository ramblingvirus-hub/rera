from django.conf import settings
from rest_framework_simplejwt.exceptions import InvalidToken
from rest_framework_simplejwt.serializers import (
    TokenObtainPairSerializer,
    TokenRefreshSerializer,
)
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from audit.constants import LOGIN_FAILED
from audit.services import log_audit_event


def get_superadmin_access_lifetime():
    return settings.SIMPLE_JWT.get("SUPERADMIN_ACCESS_TOKEN_LIFETIME")


class RERATokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["is_superuser"] = bool(getattr(user, "is_superuser", False))
        token["user_id"] = user.id
        token["username"] = user.username
        return token

    def validate(self, attrs):
        try:
            data = super().validate(attrs)
        except InvalidToken:
            request = self.context.get("request")
            username = attrs.get("username")
            ip_address = request.META.get("REMOTE_ADDR") if request is not None else None

            log_audit_event(
                user=None,
                event_type=LOGIN_FAILED,
                severity="WARNING",
                metadata={
                    "username": username,
                    "ip": ip_address,
                },
            )
            raise

        if getattr(self.user, "is_superuser", False):
            refresh = self.get_token(self.user)
            access = refresh.access_token
            access.set_exp(lifetime=get_superadmin_access_lifetime())
            data["refresh"] = str(refresh)
            data["access"] = str(access)

        return data


class RERATokenRefreshSerializer(TokenRefreshSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)

        try:
            refresh_token = RefreshToken(attrs.get("refresh"))
        except Exception:
            return data

        if bool(refresh_token.get("is_superuser", False)):
            access = refresh_token.access_token
            access.set_exp(lifetime=get_superadmin_access_lifetime())
            data["access"] = str(access)

        return data


class RERATokenObtainPairView(TokenObtainPairView):
    serializer_class = RERATokenObtainPairSerializer


class RERATokenRefreshView(TokenRefreshView):
    serializer_class = RERATokenRefreshSerializer
