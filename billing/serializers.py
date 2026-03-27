from decimal import Decimal
import os

from rest_framework import serializers

from .models import ManualPayment
from .services import get_credit_package


ALLOWED_MIME_TYPES = {
    "image/png",
    "image/jpeg",
    "application/pdf",
}
MAX_PROOF_FILE_SIZE_BYTES = 10 * 1024 * 1024


class ManualPaymentSubmitSerializer(serializers.Serializer):
    package = serializers.ChoiceField(choices=["single", "bundle_3", "bundle_5"])
    payment_method = serializers.ChoiceField(
        choices=[ManualPayment.PAYMENT_METHOD_GCASH, ManualPayment.PAYMENT_METHOD_MAYA]
    )
    reference_number = serializers.CharField(max_length=120)
    reference_note = serializers.CharField(max_length=255, required=False, allow_blank=True)
    proof_file = serializers.FileField()

    def validate_reference_number(self, value):
        normalized = ManualPayment.normalize_reference(value)
        if not normalized:
            raise serializers.ValidationError("reference_number is required")

        if ManualPayment.objects.filter(reference_number_normalized=normalized).exists():
            raise serializers.ValidationError("reference_number already exists")
        return value

    def validate_proof_file(self, value):
        content_type = getattr(value, "content_type", "")
        ext = os.path.splitext(getattr(value, "name", ""))[1].lower()

        if content_type and content_type not in ALLOWED_MIME_TYPES:
            raise serializers.ValidationError("proof_file must be PNG, JPG, JPEG, or PDF")

        if ext not in {".png", ".jpg", ".jpeg", ".pdf"}:
            raise serializers.ValidationError("proof_file must be PNG, JPG, JPEG, or PDF")

        size = getattr(value, "size", 0)
        if size > MAX_PROOF_FILE_SIZE_BYTES:
            raise serializers.ValidationError("proof_file must not exceed 10MB")

        return value


class ManualPaymentSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(source="user.id", read_only=True)

    class Meta:
        model = ManualPayment
        fields = [
            "id",
            "user_id",
            "package_key",
            "amount_php",
            "credits_purchased",
            "payment_method",
            "reference_number",
            "reference_note",
            "proof_file",
            "status",
            "admin_notes",
            "created_at",
            "reviewed_at",
            "reviewed_by",
        ]
        read_only_fields = fields


class AdminManualPaymentReviewSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=["approve", "reject"])
    admin_notes = serializers.CharField(required=False, allow_blank=True)


class ManualPaymentConfigSerializer(serializers.Serializer):
    paymongo_enabled = serializers.BooleanField()
    packages = serializers.DictField()
    methods = serializers.ListField(child=serializers.CharField())
    instructions = serializers.DictField()


class ManualPaymentCreateResultSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    package_key = serializers.CharField()
    amount_php = serializers.DecimalField(max_digits=10, decimal_places=2)
    credits_purchased = serializers.IntegerField()
    payment_method = serializers.CharField()
    status = serializers.CharField()

    @staticmethod
    def build(payment):
        package = get_credit_package(payment.package_key)
        return {
            "id": payment.id,
            "package_key": payment.package_key,
            "amount_php": Decimal(str(package["amount_php"] if package else payment.amount_php)),
            "credits_purchased": package["credits"] if package else payment.credits_purchased,
            "payment_method": payment.payment_method,
            "status": payment.status,
        }
