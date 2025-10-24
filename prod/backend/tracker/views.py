# --- backend/tracker/views.py ---
from rest_framework import viewsets, permissions, decorators, response, status
from django.db.models import Sum, F, FloatField
from .models import Party, Expense, Settlement
from .serializers import PartySerializer, ExpenseSerializer, SettlementSerializer
from .permissions import IsEditorOrReadOnly
from django.views.decorators.csrf import ensure_csrf_cookie
from django.contrib.auth import authenticate, login as dj_login, logout as dj_logout

class PartyViewSet(viewsets.ModelViewSet):
    queryset = Party.objects.all().order_by("-is_household", "name")
    serializer_class = PartySerializer
    permission_classes = [IsEditorOrReadOnly]

class ExpenseViewSet(viewsets.ModelViewSet):
    queryset = Expense.objects.all()
    serializer_class = ExpenseSerializer
    permission_classes = [IsEditorOrReadOnly]
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

class SettlementViewSet(viewsets.ModelViewSet):
    queryset = Settlement.objects.all()
    serializer_class = SettlementSerializer
    permission_classes = [IsEditorOrReadOnly]
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

@decorators.api_view(["GET"])
@decorators.permission_classes([permissions.AllowAny])
@ensure_csrf_cookie
def csrf(request):
    return response.Response({"detail": "ok"})

@decorators.api_view(["POST"])
@decorators.permission_classes([permissions.AllowAny])  # public login (still needs CSRF)
def auth_login(request):
    username = request.data.get("username")
    password = request.data.get("password")
    user = authenticate(request, username=username, password=password)
    if not user:
        return response.Response({"detail": "Invalid credentials"}, status=status.HTTP_400_BAD_REQUEST)
    dj_login(request, user)
    return response.Response({"detail": "ok", "is_staff": user.is_staff})

@decorators.api_view(["POST"])
def auth_logout(request):
    dj_logout(request)
    return response.Response({"detail": "ok"})

@decorators.api_view(["GET"])
def whoami(request):
    u = request.user
    if not u.is_authenticated:
        return response.Response({"authenticated": False})
    return response.Response({"authenticated": True, "username": u.username, "is_staff": u.is_staff})

@decorators.api_view(["GET"])
@decorators.permission_classes([permissions.IsAuthenticated])
def summary(request):
    # Identify parties
    try:
        household = Party.objects.get(is_household=True)
        bev = Party.objects.get(slug="bev")
    except Party.DoesNotExist:
        return response.Response({"detail": "Parties not bootstrapped yet."}, status=400)

    # Compute Bev owes Household from Household-paid expenses (sum of share_bev)
    hh_paid = Expense.objects.filter(paid_by=household)
    bev_paid = Expense.objects.filter(paid_by=bev)

    # Sum shares in DB (double-checking using annotation)
    # amount_cad = amount * fx
    # share_bev = amount_cad * weight_bev / (weight_household + weight_bev)
    hh_b_owes = hh_paid.annotate(
        amount_cad=F("amount") * F("fx_to_cad"),
        denom=(F("weight_household") + F("weight_bev")),
        share_bev=F("amount") * F("fx_to_cad") * F("weight_bev") / (F("weight_household") + F("weight_bev")),
    ).aggregate(total=Sum("share_bev", output_field=FloatField()))["total"] or 0.0

    # Household owes Bev from Bev-paid expenses (sum of share_household)
    hh_owes = bev_paid.annotate(
        share_household=F("amount") * F("fx_to_cad") * F("weight_household") / (F("weight_household") + F("weight_bev")),
    ).aggregate(total=Sum("share_household", output_field=FloatField()))["total"] or 0.0

    # Settlements
    bev_to_house = Settlement.objects.filter(from_party=bev, to_party=household).aggregate(Sum("amount_cad"))["amount_cad__sum"] or 0.0
    house_to_bev = Settlement.objects.filter(from_party=household, to_party=bev).aggregate(Sum("amount_cad"))["amount_cad__sum"] or 0.0

    net = hh_b_owes - hh_owes - (bev_to_house - house_to_bev)

    return response.Response({
        "bev_owes_from_expenses": hh_b_owes,
        "household_owes_from_expenses": hh_owes,
        "settlements_bev_to_household": bev_to_house,
        "settlements_household_to_bev": house_to_bev,
        "net": net,
    })