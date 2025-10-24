# --- backend/tracker/urls.py ---
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    PartyViewSet, ExpenseViewSet, SettlementViewSet,
    summary, csrf, auth_login, auth_logout, whoami   # <-- add these
)

router = DefaultRouter()
router.register(r"parties", PartyViewSet)
router.register(r"expenses", ExpenseViewSet)
router.register(r"settlements", SettlementViewSet)

urlpatterns = [
    path("", include(router.urls)),
    path("summary/", summary),
    path("csrf/", csrf),
    path("auth/login/", auth_login),
    path("auth/logout/", auth_logout),
    path("auth/whoami/", whoami),
]