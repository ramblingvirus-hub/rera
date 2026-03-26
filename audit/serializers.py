from rest_framework import serializers

from .constants import CANONICAL_EVENT_TYPES, SEVERITY_CHOICES, SEVERITY_INFO
from .models import AuditEvent


class AuditEventSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(source="user.id", allow_null=True)

    class Meta:
        model = AuditEvent
        fields = [
            "id",
            "request_id",
            "user_id",
            "event_type",
            "severity",
            "timestamp",
            "metadata",
        ]


class AdminAuditQuerySerializer(serializers.Serializer):
    request_id = serializers.UUIDField(required=False)
    user_id = serializers.IntegerField(required=False)
    event_type = serializers.ChoiceField(choices=CANONICAL_EVENT_TYPES, required=False)
    severity = serializers.ChoiceField(
        choices=[choice[0] for choice in SEVERITY_CHOICES],
        required=False,
    )
    timestamp_from = serializers.DateTimeField(required=False)
    timestamp_to = serializers.DateTimeField(required=False)
    limit = serializers.IntegerField(required=False, min_value=1, max_value=200, default=100)
    offset = serializers.IntegerField(required=False, min_value=0, default=0)

    def validate(self, attrs):
        timestamp_from = attrs.get("timestamp_from")
        timestamp_to = attrs.get("timestamp_to")
        if timestamp_from and timestamp_to and timestamp_from > timestamp_to:
            raise serializers.ValidationError("timestamp_from must be earlier than timestamp_to.")
        return attrs


class AuditLogSerializer(serializers.Serializer):
    event_type = serializers.ChoiceField(choices=CANONICAL_EVENT_TYPES)
    severity = serializers.ChoiceField(
        choices=[choice[0] for choice in SEVERITY_CHOICES],
        required=False,
        default=SEVERITY_INFO,
    )
    request_id = serializers.UUIDField(required=False, allow_null=True)
    metadata = serializers.DictField(required=False, default=dict)