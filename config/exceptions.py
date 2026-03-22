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

    # If DRF handled the exception, reformat the response
    if response is not None:
        error_type = "api_error"
        error_code = None
        message = None

        # Extract standard DRF error structure
        if isinstance(response.data, dict):
            message = response.data.get("detail")

            # If DRF provides a code (like token_not_valid)
            if hasattr(exc, "default_code"):
                error_code = exc.default_code
        else:
            message = str(response.data)

        # Map common HTTP status codes to structured types
        if response.status_code == status.HTTP_401_UNAUTHORIZED:
            error_type = "authentication_error"
        elif response.status_code == status.HTTP_403_FORBIDDEN:
            error_type = "permission_error"
        elif response.status_code == status.HTTP_404_NOT_FOUND:
            error_type = "not_found"
        elif response.status_code == status.HTTP_400_BAD_REQUEST:
            error_type = "validation_error"
        elif response.status_code == status.HTTP_429_TOO_MANY_REQUESTS:
            error_type = "rate_limit_error"

        response.data = {
            "error": {
                "type": error_type,
                "code": error_code,
                "message": message,
            }
        }

    return response