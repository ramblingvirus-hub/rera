from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)
from rest_framework.permissions import AllowAny
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),

    path('api/token/',
        TokenObtainPairView.as_view(permission_classes=[AllowAny]),
        name='token_obtain_pair'
    ),

    path('api/token/refresh/',
        TokenRefreshView.as_view(permission_classes=[AllowAny]),
        name='token_refresh'
    ),

    path("api/v1/", include("reports.urls")),
    path("api/v1/billing/", include("billing.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.BASE_DIR)