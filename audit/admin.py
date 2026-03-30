from django.contrib import admin
from .models import AuditEvent


@admin.register(AuditEvent)
class AuditEventAdmin(admin.ModelAdmin):
    list_display = ("timestamp", "event_type", "severity", "user", "request_id")
    list_filter = ("event_type", "severity", "timestamp")
    search_fields = ("user__username", "event_type", "request_id")
    ordering = ("-timestamp",)
    readonly_fields = [field.name for field in AuditEvent._meta.fields]
    
    fieldsets = (
        ("Event Info", {
            "fields": ("id", "event_type", "severity", "timestamp")
        }),
        ("User & Request", {
            "fields": ("user", "request_id")
        }),
        ("Metadata", {
            "fields": ("metadata",),
            "classes": ("collapse",)
        }),
    )

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_view_permission(self, request, obj=None):
        # Keep this model read-only but still accessible in admin.
        return True