from django.contrib import admin
from .models import CreditTransaction

@admin.register(CreditTransaction)
class CreditTransactionAdmin(admin.ModelAdmin):
    readonly_fields = [field.name for field in CreditTransaction._meta.fields]

    def has_delete_permission(self, request, obj=None):
        return False

    def has_change_permission(self, request, obj=None):
        return False