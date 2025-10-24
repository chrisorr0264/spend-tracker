# --- backend/tracker/models.py ---
from django.db import models
from django.contrib.auth import get_user_model
User = get_user_model()

class Party(models.Model):
    name = models.CharField(max_length=64, unique=True)
    slug = models.SlugField(max_length=64, unique=True)
    is_household = models.BooleanField(default=False)  # Household (Chris+Tressa)
    def __str__(self):
        return self.name

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
    currency = models.CharField(max_length=8, default="THB")
    fx_to_cad = models.DecimalField(max_digits=12, decimal_places=6, default=1)
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    paid_by = models.ForeignKey(Party, on_delete=models.PROTECT, related_name="paid_expenses")
    # Weighted split for Household vs Bev
    weight_household = models.PositiveIntegerField(default=1)
    weight_bev = models.PositiveIntegerField(default=1)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date", "-id"]

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