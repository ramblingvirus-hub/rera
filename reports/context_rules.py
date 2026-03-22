"""
Interview context rules.

This module determines context profiles from interview responses without
changing scoring inputs, schema, or API contracts.
"""


def normalize_sale_mode(value):
    if value is None:
        return ""

    normalized = str(value).strip().lower().replace("-", "_").replace(" ", "_")

    aliases = {
        "developer_project": "developer_project",
        "private_sale": "private_sale",
        "broker_listing": "broker_listing",
    }

    return aliases.get(normalized, normalized)


def get_context_profile(responses):
    sale_mode = normalize_sale_mode((responses or {}).get("q6"))

    if sale_mode == "private_sale":
        return "private_sale"

    return "default"
