from .settings_base import *

DEBUG = True

ALLOWED_HOSTS = ["127.0.0.1", "localhost"]

# Enable browsable API in development
REST_FRAMEWORK["DEFAULT_RENDERER_CLASSES"] = (
    "rest_framework.renderers.JSONRenderer",
    "rest_framework.renderers.BrowsableAPIRenderer",
)

