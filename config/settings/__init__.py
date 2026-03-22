import os

environment = os.environ.get("RERA_ENV", "prod")

if environment == "dev":
    from .settings_dev import *
else:
    from .settings_prod import *