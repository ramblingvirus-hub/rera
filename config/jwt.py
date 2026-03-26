from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.exceptions import InvalidToken

from audit.constants import LOGIN_FAILED
from audit.services import log_audit_event


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
            return super().validate(attrs)
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


class RERATokenObtainPairView(TokenObtainPairView):
    serializer_class = RERATokenObtainPairSerializer
