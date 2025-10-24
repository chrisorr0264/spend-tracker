# --- backend/tracker/serializers.py ---
from decimal import Decimal, ROUND_HALF_UP
from rest_framework import serializers
from .models import Party, Person, Expense, Settlement

TWOPLACES = Decimal("0.01")

def q2(x: Decimal) -> Decimal:
    if x is None:
        return None
    return x.quantize(TWOPLACES, rounding=ROUND_HALF_UP)

class PartySerializer(serializers.ModelSerializer):
    class Meta:
        model = Party
        fields = ["id", "name", "slug", "is_household"]


class PersonSerializer(serializers.ModelSerializer):
    # include a compact nested party for client grouping
    party = PartySerializer(read_only=True)

    class Meta:
        model = Person
        fields = ["id", "name", "party"]


class ExpenseSerializer(serializers.ModelSerializer):
    # paid_by is a Person FK
    paid_by = serializers.PrimaryKeyRelatedField(
        queryset=Person.objects.select_related("party").all()
    )

    # convenience read-only fields for UI
    paid_by_display = serializers.SerializerMethodField()
    paid_by_party = serializers.SerializerMethodField()

    amount_cad = serializers.SerializerMethodField()
    share_household_cad = serializers.SerializerMethodField()
    share_bev_cad = serializers.SerializerMethodField()

    class Meta:
        model = Expense
        fields = [
            "id",
            "date",
            "description",
            "category",
            "currency",
            "fx_to_cad",
            "amount",
            "amount_cad",
            "paid_by",
            "paid_by_display",
            "paid_by_party",
            "weight_household",
            "weight_bev",
            "share_household_cad",
            "share_bev_cad",
            "notes",
        ]

    def validate_currency(self, v: str) -> str:
        v = (v or "").upper().strip()
        if len(v) != 3:
            raise serializers.ValidationError("Currency must be a 3-letter ISO code (e.g., CAD, THB).")
        return v

    def get_paid_by_display(self, obj) -> str:
        # "Chris (Household)"
        p = obj.paid_by
        party = getattr(p, "party", None)
        if not party:
            return p.name
        return f"{p.name} ({party.name})"

    def get_paid_by_party(self, obj) -> dict:
        party = getattr(obj.paid_by, "party", None)
        if not party:
            return None
        return {
            "id": party.id,
            "name": party.name,
            "slug": party.slug,
            "is_household": party.is_household,
        }

    def _cad_amount(self, obj) -> Decimal:
        # (amount * fx) in CAD using Decimal math
        amt = Decimal(obj.amount)
        fx = Decimal(obj.fx_to_cad)
        return q2(amt * fx)

    def get_amount_cad(self, obj):
        return self._cad_amount(obj)

    def _shares(self, obj):
        total = self._cad_amount(obj) or Decimal("0.00")
        wH = Decimal(obj.weight_household or 0)
        wB = Decimal(obj.weight_bev or 0)
        denom = (wH + wB) or Decimal(1)
        shareH = q2(total * (wH / denom))
        shareB = q2(total * (wB / denom))
        return shareH, shareB

    def get_share_household_cad(self, obj):
        h, _ = self._shares(obj)
        return h

    def get_share_bev_cad(self, obj):
        _, b = self._shares(obj)
        return b


class SettlementSerializer(serializers.ModelSerializer):
    # write-only inputs from the UI
    from_person_id = serializers.PrimaryKeyRelatedField(
        source="from_party",  # we’ll translate to party via to_internal_value()
        queryset=Person.objects.select_related("party").all(),
        write_only=True,
        required=False,
        allow_null=True,
    )
    to_person_id = serializers.PrimaryKeyRelatedField(
        source="to_party",
        queryset=Person.objects.select_related("party").all(),
        write_only=True,
        required=False,
        allow_null=True,
    )

    # optional display helpers (already present)
    from_party_name = serializers.SerializerMethodField(read_only=True)
    to_party_name = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Settlement
        fields = [
            "id",
            "date",
            # stored FKs (read-only to callers)
            "from_party",
            "to_party",
            # new write-only person inputs
            "from_person_id",
            "to_person_id",
            # display
            "from_party_name",
            "to_party_name",
            "amount_cad",
            "notes",
        ]
        extra_kwargs = {
            "from_party": {"read_only": True},
            "to_party": {"read_only": True},
        }

    def get_from_party_name(self, obj):
        return obj.from_party.name if obj.from_party_id else None

    def get_to_party_name(self, obj):
        return obj.to_party.name if obj.to_party_id else None

    # Map person → party during validation
    def validate(self, attrs):
        """
        Accept either:
          - from_person_id / to_person_id (preferred), or
          - (legacy) from_party / to_party already present in attrs.
        Translate people to their parties.
        """
        # When coming from our write-only Person PK fields, attrs["from_party"]
        # and attrs["to_party"] will temporarily be Person objects (because we
        # pointed source=from_party/to_party above). Convert them to the Person's party.
        fp = attrs.get("from_party")
        tp = attrs.get("to_party")

        if isinstance(fp, Person):
            party = getattr(fp, "party", None)
            if not party:
                raise serializers.ValidationError("From person must belong to a party.")
            attrs["from_party"] = party

        if isinstance(tp, Person):
            party = getattr(tp, "party", None)
            if not party:
                raise serializers.ValidationError("To person must belong to a party.")
            attrs["to_party"] = party

        # sanity
        if not attrs.get("from_party") or not attrs.get("to_party"):
            raise serializers.ValidationError("Both from and to parties (via people) are required.")

        return attrs