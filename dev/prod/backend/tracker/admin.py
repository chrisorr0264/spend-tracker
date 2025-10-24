from django.contrib import admin
from .models import Party, Expense, Settlement
admin.site.register(Party)
admin.site.register(Expense)
admin.site.register(Settlement)