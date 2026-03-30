import math
import time

from django.core.cache import cache
from rest_framework.throttling import BaseThrottle


class ContactMessageSubmitRateThrottle(BaseThrottle):
    """Limits contact submissions per IP to reduce spam pressure."""

    max_requests = 3
    window_seconds = 10 * 60

    def _cache_key(self, request):
        ident = self.get_ident(request) or "unknown"
        return f"throttle:contact-message-submit:{ident}"

    def allow_request(self, request, view):
        key = self._cache_key(request)
        now = time.time()

        entries = cache.get(key, [])
        entries = [stamp for stamp in entries if (now - stamp) < self.window_seconds]

        if len(entries) >= self.max_requests:
            self.history = entries
            self.now = now
            return False

        entries.append(now)
        cache.set(key, entries, timeout=self.window_seconds)

        self.history = entries
        self.now = now
        return True

    def wait(self):
        if not getattr(self, "history", None):
            return None

        oldest = min(self.history)
        remaining = self.window_seconds - (self.now - oldest)
        if remaining <= 0:
            return None
        return math.ceil(remaining)
