from .models import AuditEvent


def log_audit_event(
    *,
    user=None,
    event_type,
    severity,
    request_id=None,
    metadata=None,
):
    """
    Centralized audit logging function.

    All audit events must go through this function.
    """

    event = AuditEvent(
        user=user,
        event_type=event_type,
        severity=severity,
        request_id=request_id,
        metadata=metadata or {},
    )
    event.full_clean()
    event.save()