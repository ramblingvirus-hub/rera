from django.urls import path
from .views import EvaluateProjectView, GetReportView, ListReportsView

urlpatterns = [
    path("evaluate/", EvaluateProjectView.as_view(), name="evaluate_v1"),
    path("reports/", ListReportsView.as_view(), name="list_reports_v1"),
    path("reports/<uuid:request_id>/", GetReportView.as_view(), name="get_report_v1"),
]