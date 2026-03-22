import hashlib
import json


def generate_request_hash(data: dict) -> str:
    """
    Generates a deterministic SHA256 hash of request payload.
    Ensures same payload produces same hash regardless of key order.
    """

    # Sort keys for deterministic ordering
    normalized = json.dumps(data, sort_keys=True, separators=(",", ":"))

    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()