from rest_framework import status
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django.conf import settings

from .models import AuditEvent
from .serializers import (
	AdminAuditQuerySerializer,
	AuditEventSerializer,
	AuditLogSerializer,
)
from .services import log_audit_event


class AdminAuditListView(APIView):
	permission_classes = [IsAdminUser]

	def get(self, request):
		query_serializer = AdminAuditQuerySerializer(data=request.query_params)
		query_serializer.is_valid(raise_exception=True)
		filters = query_serializer.validated_data

		queryset = AuditEvent.objects.select_related("user").all()

		request_id = filters.get("request_id")
		user_id = filters.get("user_id")
		event_type = filters.get("event_type")
		severity = filters.get("severity")
		timestamp_from = filters.get("timestamp_from")
		timestamp_to = filters.get("timestamp_to")
		limit = filters.get("limit", 100)
		offset = filters.get("offset", 0)

		if request_id is not None:
			queryset = queryset.filter(request_id=request_id)

		if user_id is not None:
			queryset = queryset.filter(user_id=user_id)

		if event_type is not None:
			queryset = queryset.filter(event_type=event_type)

		if severity is not None:
			queryset = queryset.filter(severity=severity)

		if timestamp_from is not None:
			queryset = queryset.filter(timestamp__gte=timestamp_from)

		if timestamp_to is not None:
			queryset = queryset.filter(timestamp__lte=timestamp_to)

		total_count = queryset.count()
		paginated_queryset = queryset[offset: offset + limit]
		results = AuditEventSerializer(paginated_queryset, many=True).data
		next_offset = offset + limit if (offset + limit) < total_count else None

		return Response(
			{
				"count": total_count,
				"limit": limit,
				"offset": offset,
				"next_offset": next_offset,
				"results": results,
			},
			status=status.HTTP_200_OK,
		)


class AuditLogView(APIView):
	permission_classes = [IsAuthenticated]

	def post(self, request):
		payload_serializer = AuditLogSerializer(data=request.data)
		payload_serializer.is_valid(raise_exception=True)
		payload = payload_serializer.validated_data

		log_audit_event(
			user=request.user,
			event_type=payload["event_type"],
			severity=payload.get("severity"),
			request_id=payload.get("request_id"),
			metadata=payload.get("metadata", {}),
		)

		return Response({"status": "logged"}, status=status.HTTP_201_CREATED)


class AdminSystemFlagsView(APIView):
	permission_classes = [IsAdminUser]

	def get(self, request):
		return Response(
			{
				"qa_bypass_unlock": bool(getattr(settings, "QA_BYPASS_UNLOCK", False)),
				"paymongo_enabled": bool(getattr(settings, "PAYMONGO_ENABLED", True)),
			},
			status=status.HTTP_200_OK,
		)
