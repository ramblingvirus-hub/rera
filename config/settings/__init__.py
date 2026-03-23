import os

environment = os.environ.get("RERA_ENV", "prod").lower()

if environment == "dev":
    from .settings_dev import *
elif environment in {"stage", "staging"}:
    from .settings_stage import *
else:
    from .settings_prod import *