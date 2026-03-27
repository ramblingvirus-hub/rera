from django.urls import path

from .views import AdminAuditListView, AdminSystemFlagsView, AuditLogView


urlpatterns = [
    path("admin/audit/", AdminAuditListView.as_view(), name="admin_audit_list"),
    path("admin/audit/system-flags/", AdminSystemFlagsView.as_view(), name="admin_system_flags"),
    path("audit/log/", AuditLogView.as_view(), name="audit_log"),
]
