from rest_framework import serializers

from .models import ContactMessage


class ContactMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContactMessage
        fields = ["name", "email", "category", "subject", "message", "request_id"]
        extra_kwargs = {
            "name": {"required": False, "allow_blank": True},
            "email": {"required": True},
            "category": {"required": True},
            "subject": {"required": True},
            "message": {"required": True},
            "request_id": {"required": False, "allow_null": True},
        }

    def validate_subject(self, value):
        text = (value or "").strip()
        if len(text) < 5:
            raise serializers.ValidationError("Subject must be at least 5 characters.")
        return text

    def validate_message(self, value):
        text = (value or "").strip()
        if len(text) < 10:
            raise serializers.ValidationError("Message must be at least 10 characters.")
        return text

    def validate_name(self, value):
        return (value or "").strip()
