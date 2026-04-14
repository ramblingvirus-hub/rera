from django.urls import path

from .views import AdminAuditListView, AdminSystemFlagsView, AuditLogView


urlpatterns = [
    path("admin/audit/", AdminAuditListView.as_view(), name="admin_audit_list"),
    path("admin/audit/system-flags/", AdminSystemFlagsView.as_view(), name="admin_system_flags"),
    path("audit/log/", AuditLogView.as_view(), name="audit_log"),
    # Cloudflare may challenge some admin/audit paths for browser XHR. Keep
    # neutral aliases so frontend traffic can use stable, non-admin route names.
    path("ops/events/", AdminAuditListView.as_view(), name="ops_audit_list"),
    path("ops/system-flags/", AdminSystemFlagsView.as_view(), name="ops_system_flags"),
    path("insights/events/", AdminAuditListView.as_view(), name="insights_audit_list"),
    path("insights/system-flags/", AdminSystemFlagsView.as_view(), name="insights_system_flags"),
    path("events/log/", AuditLogView.as_view(), name="events_log"),
]
