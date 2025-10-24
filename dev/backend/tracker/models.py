# --- backend/tracker/models.py ---
from django.db import models
from django.contrib.auth import get_user_model
from django.conf import settings

User = get_user_model()

class Party(models.Model):
    name = models.CharField(max_length=64, unique=True)
    slug = models.SlugField(max_length=64, unique=True)
    is_household = models.BooleanField(default=False)  # Household (Chris+Tressa)

    def __str__(self):
        return self.name

class Person(models.Model):
    """A concrete person who belongs to a Party (e.g., Chris/Tressa -> Household, Bev -> Bev)."""
    name = models.CharField(max_length=64)
    party = models.ForeignKey(Party, on_delete=models.PROTECT, related_name="people")

    class Meta:
        unique_together = ("name", "party")
        indexes = [
            models.Index(fields=["party"]),
        ]

    def __str__(self):
        return f"{self.name} ({self.party.name})"

class FxRate(models.Model):
    """Cache of historical FX rates: base -> quote for a given date."""
    date = models.DateField()
    base = models.CharField(max_length=3)   # e.g., CAD
    quote = models.CharField(max_length=3)  # e.g., THB
    rate = models.DecimalField(max_digits=18, decimal_places=8)

    class Meta:
        unique_together = ("date", "base", "quote")
        indexes = [
            models.Index(fields=["date", "base", "quote"]),
        ]

    def __str__(self):
        return f"{self.date} {self.base}->{self.quote} {self.rate}"

class UserRecentCurrency(models.Model):
    """Tracks each user's most recently used currencies (we'll surface the latest 5)."""
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    code = models.CharField(max_length=3)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("user", "code")
        indexes = [
            models.Index(fields=["user", "-updated_at"]),
        ]

    def __str__(self):
        return f"{self.user_id}:{self.code}"

class Expense(models.Model):
    CATEGORY_CHOICES = [
        ("lodging", "Lodging"),
        ("food", "Food"),
        ("transport", "Transport"),
        ("activities", "Activities"),
        ("other", "Other"),
    ]
    date = models.DateField()
    description = models.CharField(max_length=200)
    category = models.CharField(max_length=24, choices=CATEGORY_CHOICES, default="lodging")

    # Use ISO 4217 currency codes
    currency = models.CharField(max_length=3, default="THB")

    # Higher precision FX to CAD (or your base)
    fx_to_cad = models.DecimalField(max_digits=18, decimal_places=8, default=1)

    amount = models.DecimalField(max_digits=14, decimal_places=2)

    # CHANGED: paid_by points to Person (not Party)
    paid_by = models.ForeignKey(Person, on_delete=models.PROTECT, related_name="paid_expenses")

    # Weighted split for Household vs Bev (frontend will show side-by-side)
    weight_household = models.PositiveIntegerField(default=1)
    weight_bev = models.PositiveIntegerField(default=1)

    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date", "-id"]
        indexes = [
            models.Index(fields=["date"]),
            models.Index(fields=["currency"]),
            models.Index(fields=["paid_by"]),
        ]

    def __str__(self):
        return f"{self.date} {self.description} {self.amount} {self.currency}"

class Settlement(models.Model):
    date = models.DateField()
    from_party = models.ForeignKey(Party, on_delete=models.PROTECT, related_name="outgoing_settlements")
    to_party = models.ForeignKey(Party, on_delete=models.PROTECT, related_name="incoming_settlements")
    amount_cad = models.DecimalField(max_digits=14, decimal_places=2)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date", "-id"]
        indexes = [
            models.Index(fields=["date"]),
            models.Index(fields=["from_party", "to_party"]),
        ]

    def __str__(self):
        return f"{self.date} {self.from_party} -> {self.to_party} {self.amount_cad} CAD"
