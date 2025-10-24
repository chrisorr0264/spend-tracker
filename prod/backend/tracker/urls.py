# --- backend/tracker/urls.py ---
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    PartyViewSet, PersonViewSet, ExpenseViewSet, SettlementViewSet,
    fx_rate, recent_currencies, csrf, auth_login, auth_logout, whoami, summary
)

router = DefaultRouter()
router.register(r'parties', PartyViewSet, basename='party')
router.register(r'people', PersonViewSet, basename='person')
router.register(r'expenses', ExpenseViewSet, basename='expense')
router.register(r'settlements', SettlementViewSet, basename='settlement')

urlpatterns = [
    path('', include(router.urls)),
    path('fx-rate/', fx_rate, name='fx-rate'),
    path('recent-currencies/', recent_currencies, name='recent-currencies'),
    path('csrf/', csrf, name='csrf'),
    path('auth/login/', auth_login, name='auth-login'),
    path('auth/logout/', auth_logout, name='auth-logout'),
    path('whoami/', whoami, name='whoami'),
    path('summary/', summary, name='summary'),
]
