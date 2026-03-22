# reports/risk_band.py

"""
Risk Band Classification

Translates numeric evaluation score
into a consumer-readable risk band.
"""


def classify_risk_band(score: float) -> str:

    if score >= 80:
        return "Lower Risk"

    if score >= 60:
        return "Moderate Risk"

    if score >= 40:
        return "Elevated Risk"

    return "High Risk"