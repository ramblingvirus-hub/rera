from django.contrib import admin
from .models import InterviewSession

@admin.register(InterviewSession)
class InterviewSessionAdmin(admin.ModelAdmin):

    list_display = ("id", "user", "status", "interview_version", "created_at")

    readonly_fields = ("id", "created_at", "updated_at")

    ordering = ("-created_at",)
    
    
    # Register your models here.
