from rest_framework.views import exception_handler
from rest_framework import status
import uuid
from rest_framework.exceptions import Throttled
from audit.services import log_audit_event
from audit.constants import THROTTLE_TRIGGERED

def custom_exception_handler(exc, context):
    """
    Standardizes error responses across the API.
    """

    response = exception_handler(exc, context)

    request = context.get("request")
    if isinstance(exc, Throttled) and request:
        log_audit_event(
            user=request.user if request.user.is_authenticated else None,
            event_type=THROTTLE_TRIGGERED,
            severity="WARNING",
            request_id=str(uuid.uuid4()),
            metadata={
                "detail": str(exc.detail)
            }
        )

    # Return minimal responses for auth and probing-related failures.
    if response is not None:
        if response.status_code == status.HTTP_401_UNAUTHORIZED:
            response.data = {"detail": "Unauthorized"}
        elif response.status_code == status.HTTP_403_FORBIDDEN:
            response.data = {"detail": "Forbidden"}
        elif response.status_code == status.HTTP_404_NOT_FOUND:
            response.data = {"detail": "Not found"}
        elif response.status_code == status.HTTP_429_TOO_MANY_REQUESTS:
            response.data = {"detail": "Too many requests"}

    return response