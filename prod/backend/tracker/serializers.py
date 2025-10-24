# --- backend/tracker/serializers.py ---
from rest_framework import serializers
from .models import Party, Expense, Settlement

class PartySerializer(serializers.ModelSerializer):
    class Meta:
        model = Party
        fields = ["id", "name", "slug", "is_household"]

class ExpenseSerializer(serializers.ModelSerializer):
    amount_cad = serializers.SerializerMethodField()
    share_household_cad = serializers.SerializerMethodField()
    share_bev_cad = serializers.SerializerMethodField()

    class Meta:
        model = Expense
        fields = [
            "id","date","description","category","currency","fx_to_cad","amount","amount_cad",
            "paid_by","weight_household","weight_bev","share_household_cad","share_bev_cad","notes",
        ]

    def get_amount_cad(self, obj):
        return float(obj.amount) * float(obj.fx_to_cad)

    def _shares(self, obj):
        amt = float(obj.amount) * float(obj.fx_to_cad)
        wH = obj.weight_household or 0
        wB = obj.weight_bev or 0
        denom = (wH + wB) or 1
        return amt * wH / denom, amt * wB / denom

    def get_share_household_cad(self, obj):
        h, _ = self._shares(obj)
        return h

    def get_share_bev_cad(self, obj):
        _, b = self._shares(obj)
        return b

class SettlementSerializer(serializers.ModelSerializer):
    class Meta:
        model = Settlement
        fields = ["id","date","from_party","to_party","amount_cad","notes"]