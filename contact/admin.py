from django.contrib import admin

from .models import ContactMessage


@admin.register(ContactMessage)
class ContactMessageAdmin(admin.ModelAdmin):
    list_display = ("created_at", "category", "email", "name", "request_id")
    search_fields = ("email", "name", "subject", "message")
    list_filter = ("category", "created_at")
    readonly_fields = [field.name for field in ContactMessage._meta.fields]

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
