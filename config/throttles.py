from rest_framework.throttling import SimpleRateThrottle


class TokenRateThrottle(SimpleRateThrottle):
    scope = "token"

    def get_cache_key(self, request, view):
        return self.get_ident(request)