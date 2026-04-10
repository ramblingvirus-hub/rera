from django.urls import path
from .views import EvaluateProjectView, GetReportView, ListReportsView
from .views import StartInterviewView, SaveInterviewView, GetInterviewView, RecoverLatestInterviewView, SubmitInterviewView


urlpatterns = [
    path("interview/start/", StartInterviewView.as_view()),
    path("interview/recover-latest/", RecoverLatestInterviewView.as_view()),
    path("interview/<uuid:interview_id>/save/", SaveInterviewView.as_view()),
    path("interview/<uuid:interview_id>/", GetInterviewView.as_view()),
    path("interview/<uuid:interview_id>/submit/", SubmitInterviewView.as_view()),
    
    path("evaluate/", EvaluateProjectView.as_view()),
    path("reports/<uuid:request_id>/", GetReportView.as_view()),
    path("reports/", ListReportsView.as_view()),
]

