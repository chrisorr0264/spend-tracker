# backend/tracker/admin.py
from django.contrib import admin
from .models import Party, Person, Expense, Settlement, FxRate, UserRecentCurrency

@admin.register(Party)
class PartyAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "is_household")
    search_fields = ("name", "slug")
    list_filter = ("is_household",)

@admin.register(Person)
class PersonAdmin(admin.ModelAdmin):
    list_display = ("name", "party")
    list_filter = ("party",)
    search_fields = ("name",)

@admin.register(Expense)
class ExpenseAdmin(admin.ModelAdmin):
    list_display = ("date", "description", "currency", "amount", "paid_by")
    list_filter = ("category", "currency", "paid_by__party")
    search_fields = ("description", "notes")

@admin.register(Settlement)
class SettlementAdmin(admin.ModelAdmin):
    list_display = ("date", "from_party", "to_party", "amount_cad")
    list_filter = ("from_party", "to_party")

# Optional, usually hidden from admin, but you can expose them if you want:
# admin.site.register(FxRate)
# admin.site.register(UserRecentCurrency)
