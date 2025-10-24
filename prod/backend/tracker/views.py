# --- backend/tracker/views.py ---
from decimal import Decimal, InvalidOperation
from datetime import date as dte

from django.db import transaction
from django.db.models import Sum, F, FloatField, DecimalField, ExpressionWrapper
from django.views.decorators.csrf import ensure_csrf_cookie
from django.contrib.auth import authenticate, login as dj_login, logout as dj_logout

from rest_framework import viewsets, permissions, decorators, response, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated, IsAuthenticatedOrReadOnly
from rest_framework.response import Response

from .permissions import IsEditorOrReadOnly
from .models import Party, Person, Expense, Settlement, FxRate, UserRecentCurrency
from .serializers import PartySerializer, PersonSerializer, ExpenseSerializer, SettlementSerializer


# -------------------------
# ViewSets
# -------------------------
class PartyViewSet(viewsets.ModelViewSet):
    queryset = Party.objects.all().order_by("-is_household", "name")
    serializer_class = PartySerializer
    permission_classes = [IsEditorOrReadOnly]


class PersonViewSet(viewsets.ModelViewSet):
    queryset = Person.objects.select_related("party").order_by("name")
    serializer_class = PersonSerializer
    permission_classes = [IsEditorOrReadOnly]


class ExpenseViewSet(viewsets.ModelViewSet):
    queryset = Expense.objects.select_related("paid_by", "paid_by__party").all()
    serializer_class = ExpenseSerializer
    permission_classes = [IsEditorOrReadOnly]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class SettlementViewSet(viewsets.ModelViewSet):
    queryset = Settlement.objects.select_related("from_party", "to_party").all()
    serializer_class = SettlementSerializer
    permission_classes = [IsEditorOrReadOnly]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


# -------------------------
# Auth / CSRF helpers
# -------------------------
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


# -------------------------
# FX rate (Frankfurter, no key required)
# -------------------------
@api_view(["GET"])
@permission_classes([permissions.AllowAny])  # temporarily allow anyone until session cookies are solid
def fx_rate(request):
    """Return (and cache) the FX rate for a given date/base/quote."""
    import requests
    from decimal import Decimal, InvalidOperation
    from datetime import date as dte

    date_str = request.GET.get("date")
    base = (request.GET.get("base") or "CAD").upper()
    quote = (request.GET.get("quote") or "THB").upper()

    try:
        query_date = dte.fromisoformat(date_str) if date_str else dte.today()
    except Exception:
        return Response({"detail": "Invalid date"}, status=status.HTTP_400_BAD_REQUEST)

    # check cache first
    existing = FxRate.objects.filter(date=query_date, base=base, quote=quote).first()
    if existing:
        return Response({
            "date": str(existing.date),
            "base": existing.base,
            "quote": existing.quote,
            "rate": str(existing.rate),
            "source": "cache",
        })

    # --- call Frankfurter ---
    url = f"https://api.frankfurter.app/{query_date.isoformat()}?from={base}&to={quote}"
    try:
        r = requests.get(url, timeout=10)
        r.raise_for_status()
        data = r.json()

        # Frankfurter returns e.g. {"amount":1.0,"base":"CAD","date":"2025-10-23","rates":{"THB":25.3829}}
        rate_raw = (data.get("rates") or {}).get(quote)
        if rate_raw is None:
            raise RuntimeError(f"Missing rate for {quote}: {data}")

        try:
            rate_val = Decimal(str(rate_raw))
        except InvalidOperation:
            raise RuntimeError(f"Invalid rate value: {rate_raw}")

        source = "live-frankfurter"

    except Exception as e:
        # graceful fallback
        return Response({
            "date": query_date.isoformat(),
            "base": base,
            "quote": quote,
            "rate": "1",
            "source": "fallback",
            "note": f"fx upstream error: {e}",
        }, status=200)

    # --- cache it ---
    with transaction.atomic():
        FxRate.objects.update_or_create(
            date=query_date, base=base, quote=quote,
            defaults={"rate": rate_val}
        )

    return Response({
        "date": query_date.isoformat(),
        "base": base,
        "quote": quote,
        "rate": str(rate_val),
        "source": source,
    })



# -------------------------
# Recent currencies (auth)
# -------------------------
@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def recent_currencies(request):
    if request.method == "GET":
        qs = (UserRecentCurrency.objects
              .filter(user=request.user)
              .order_by("-updated_at")
              .values_list("code", flat=True)[:5])
        return Response(list(qs))

    code = (request.data.get("code") or "").upper().strip()
    if not code:
        return Response({"detail": "code required"}, status=400)
    UserRecentCurrency.objects.update_or_create(user=request.user, code=code)
    return Response({"ok": True})


# -------------------------
# Summary (paid_by is a Person)
# -------------------------
@decorators.api_view(["GET"])
@decorators.permission_classes([permissions.IsAuthenticated])
def summary(request):
    # Identify parties
    household = Party.objects.filter(is_household=True).first()
    bev = Party.objects.filter(slug="bev").first()
    if not household or not bev:
        return response.Response({"detail": "Parties not bootstrapped yet."}, status=400)

    # Expenses paid by Household/Bev (via person.party)
    hh_paid = Expense.objects.filter(paid_by__party=household)
    bev_paid = Expense.objects.filter(paid_by__party=bev)

    # amount_cad = amount * fx_to_cad
    share_bev_expr = ExpressionWrapper(
        F("amount") * F("fx_to_cad") * F("weight_bev") / (F("weight_household") + F("weight_bev")),
        output_field=DecimalField(max_digits=18, decimal_places=8),
    )
    share_household_expr = ExpressionWrapper(
        F("amount") * F("fx_to_cad") * F("weight_household") / (F("weight_household") + F("weight_bev")),
        output_field=DecimalField(max_digits=18, decimal_places=8),
    )

    hh_b_owes = (
        hh_paid.annotate(share_bev=share_bev_expr)
        .aggregate(total=Sum("share_bev", output_field=DecimalField(max_digits=18, decimal_places=8)))
        .get("total") or Decimal("0")
    )

    hh_owes = (
        bev_paid.annotate(share_household=share_household_expr)
        .aggregate(total=Sum("share_household", output_field=DecimalField(max_digits=18, decimal_places=8)))
        .get("total") or Decimal("0")
    )

    # Settlements (ensure Decimal defaults; don't use 0.0)
    bev_to_house = (
        Settlement.objects.filter(from_party=bev, to_party=household)
        .aggregate(total=Sum("amount_cad", output_field=DecimalField(max_digits=18, decimal_places=2)))
        .get("total") or Decimal("0")
    )
    house_to_bev = (
        Settlement.objects.filter(from_party=household, to_party=bev)
        .aggregate(total=Sum("amount_cad", output_field=DecimalField(max_digits=18, decimal_places=2)))
        .get("total") or Decimal("0")
    )

    net = hh_b_owes - hh_owes - (bev_to_house - house_to_bev)

    return response.Response({
        "bev_owes_from_expenses": hh_b_owes,
        "household_owes_from_expenses": hh_owes,
        "settlements_bev_to_household": bev_to_house,
        "settlements_household_to_bev": house_to_bev,
        "net": net,
    })
