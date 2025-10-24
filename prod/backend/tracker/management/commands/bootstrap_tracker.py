# --- backend/tracker/management/commands/bootstrap_tracker.py ---
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from tracker.models import Party

class Command(BaseCommand):
    help = "Create default parties (Household, Bev) and an admin user if missing."

    def add_arguments(self, parser):
        parser.add_argument("--admin-email", default="chris@example.com")
        parser.add_argument("--admin-password", default="changeme")

    def handle(self, *args, **opts):
        # Parties
        Party.objects.get_or_create(name="Household (Chris+Tressa)", slug="household", defaults={"is_household": True})
        Party.objects.get_or_create(name="Bev", slug="bev", defaults={"is_household": False})
        self.stdout.write(self.style.SUCCESS("Parties ensured."))
        # Admin
        if not User.objects.filter(username="admin").exists():
            u = User.objects.create_user("admin", opts["admin_email"], opts["admin_password"]) 
            u.is_staff = True
            u.is_superuser = True
            u.save()
            self.stdout.write(self.style.SUCCESS("Admin user created: admin / <provided>"))
        else:
            self.stdout.write("Admin user already exists.")
