from django.urls import path

from .views import AdminAuditListView, AuditLogView


urlpatterns = [
    path("admin/audit/", AdminAuditListView.as_view(), name="admin_audit_list"),
    path("audit/log/", AuditLogView.as_view(), name="audit_log"),
]
