# --- backend/tracker/permissions.py ---
from rest_framework.permissions import BasePermission, SAFE_METHODS

class IsEditorOrReadOnly(BasePermission):
    """Authenticated viewers can read; editors (staff) can write."""
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return request.user and request.user.is_authenticated
        return request.user and request.user.is_authenticated and request.user.is_staff