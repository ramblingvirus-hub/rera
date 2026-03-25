# reports/explanation_engine.py

"""
Explanation Engine

Generates structured explanations for the evaluation report
based on interview answers.
"""

from .context_rules import get_context_profile


def _append_unique(target, value):
    if value not in target:
        target.append(value)


def _normalize(value):
    return str(value or "").strip().lower()


def category_strength_label(score):
    if score >= 80:
        return "Strong"
    if score >= 60:
        return "Moderate"
    if score >= 40:
        return "Weak"
    return "High Risk"


def build_category_interpretations(category_breakdown):
    descriptions = {
        "developer_legitimacy": "Reflects developer credibility and proof of legal authority to sell.",
        "project_compliance": "Measures permit and regulatory compliance readiness of the project.",
        "title_land": "Assesses title quality and land ownership clarity for safer transfer.",
        "financial_exposure": "Represents buyer payment exposure based on payment structure and safeguards.",
        "lgu_environment": "Indicates local government and environmental risk conditions affecting the property.",
    }
    interpretations = {}
    for key, score in (category_breakdown or {}).items():
        if score is None:
            continue
        interpretations[key] = {
            "score": score,
            "label": category_strength_label(score),
            "explanation": descriptions.get(key, "Category assessment derived from the provided interview responses."),
        }
    return interpretations


def generate_strengths(answers: dict, context_profile: str | None = None):
    strengths = []
    context = context_profile or get_context_profile(answers)

    if context != "private_sale" and answers.get("q7") == "Yes":
        _append_unique(strengths, "Developer has presented a valid License to Sell.")

    if context != "private_sale" and answers.get("q9") == "Yes":
        _append_unique(strengths, "Development permit evidence appears available.")

    if answers.get("q11") in {"TCT", "CCT"}:
        _append_unique(strengths, "Property title type appears to be strong and verifiable.")

    if answers.get("q12") == "No known issues":
        _append_unique(strengths, "No known title disputes or encumbrance issues were reported.")

    if answers.get("q16") == "No":
        _append_unique(strengths, "No environmental hazard concerns were indicated.")

    if not strengths:
        strengths.append("No major risk indicators detected.")

    return strengths


def generate_assessment_summary(total_score, risk_band, strengths, signals):
    risk_map = {
        "LOW_RISK": "LOW",
        "MODERATE_RISK": "MODERATE",
        "HIGH_RISK": "HIGH",
        "SEVERE_RISK": "HIGH",
    }
    level = risk_map.get(risk_band, "MODERATE")

    summary_lines = [
        f"This project appears to present a {level} level of risk based on the information provided.",
        "",
        "Key strengths include:",
    ]
    for item in (strengths or [])[:4]:
        summary_lines.append(f"- {item}")

    if signals:
        summary_lines.append("")
        summary_lines.append("Potential concerns include:")
        for item in signals[:3]:
            summary_lines.append(f"- {item}")

    summary_lines.append("")
    if total_score is not None:
        summary_lines.append(
            f"Current weighted score: {float(total_score):.1f}/100. Buyers are still encouraged to verify all documents independently before proceeding."
        )
    else:
        summary_lines.append(
            "While no major red flags are identified, buyers are still encouraged to verify all documents independently before proceeding."
        )

    return "\n".join(summary_lines)


def _is_development_oriented_property(answers):
    return answers.get("q5") in [
        "Subdivision",
        "Vacant Land",
        "Agricultural Land",
        "Mixed-Use",
    ]


def _apply_private_sale_logic(answers, signals, gaps, suggestions):
    # Private sale baseline context signal.
    _append_unique(
        signals,
        "Transaction is structured as a private sale without developer regulatory safeguards.",
    )

    ps1 = answers.get("ps1")
    ps2 = answers.get("ps2")
    ps4 = answers.get("ps4")
    q11 = answers.get("q11")

    weak_title_types = {"Tax Declaration", "Rights Only", "No title shown", "Not Sure"}

    if ps1 in ["No", "Not Sure"] or answers.get("q12") != "No known issues":
        _append_unique(signals, "Ownership of the property has not been clearly verified.")
        _append_unique(gaps, "Registered ownership has not been confirmed.")

    if ps2 in ["No", "Not Sure"] or q11 in weak_title_types:
        _append_unique(signals, "Title documentation may be incomplete or unclear.")
        _append_unique(gaps, "Title authenticity has not been verified.")

    if ps4 in ["No", "Not Sure"]:
        _append_unique(gaps, "Transfer process is unclear.")

    # In private sales, LTS is generally not expected. Presence can indicate mismatch.
    if answers.get("q7") == "Yes":
        _append_unique(
            signals,
            "A License to Sell was indicated in a private-sale context; verify transaction classification and seller authority.",
        )

    # Development permits/ECC are lower-importance unless property context suggests development.
    if _is_development_oriented_property(answers):
        if answers.get("q9") in ["No", "No documents shown"]:
            _append_unique(
                gaps,
                "Development permit evidence appears incomplete for a potentially development-oriented property.",
            )
        if answers.get("q10") in ["No", "No documents shown", "Not Sure"]:
            _append_unique(
                gaps,
                "Environmental approval context is unclear for a potentially development-oriented property.",
            )

    for suggestion in [
        "Request a certified true copy of the title.",
        "Verify ownership with the Registry of Deeds.",
        "Ensure a notarized Deed of Sale is prepared.",
        "Engage a licensed real estate broker or legal professional.",
    ]:
        _append_unique(suggestions, suggestion)


def generate_explanations(answers: dict):

    signals = []
    gaps = []
    suggestions = []
    context_profile = get_context_profile(answers)
    strengths = generate_strengths(answers, context_profile=context_profile)

    # -----------------------------
    # License to Sell
    # -----------------------------

    if context_profile != "private_sale":
        if answers.get("q7") in ["No", "No documents shown"]:
            signals.append("The developer has not shown a valid License to Sell for this project.")
            suggestions.append("Verify the License to Sell through the DHSUD registry before committing to any purchase.")

        if answers.get("q7") == "Not Sure":
            gaps.append("It is unclear whether the project has a valid License to Sell.")
            suggestions.append("Ask the developer or broker for a copy of the License to Sell.")

    # -----------------------------
    # Development Permit
    # -----------------------------

    if context_profile != "private_sale":
        if answers.get("q9") in ["No", "No documents shown"]:
            signals.append("No development permit has been shown for the project.")
            suggestions.append("Verify the development permit with the local government planning office.")

        if answers.get("q9") == "Not Sure":
            gaps.append("Development permit status is unclear.")
            suggestions.append("Ask the developer for proof of local government development approval.")

    # -----------------------------
    # Environmental Compliance
    # -----------------------------

    if context_profile != "private_sale":
        if answers.get("q10") in ["No", "No documents shown"]:
            signals.append("Environmental approval documentation has not been shown.")
            suggestions.append("Verify whether an Environmental Compliance Certificate is required for the project.")

        if answers.get("q10") == "Not Sure":
            gaps.append("Environmental approval status is unclear.")
            suggestions.append("Confirm ECC requirements through the DENR or the developer.")

    # -----------------------------
    # Title Issues
    # -----------------------------

    if answers.get("q12") == "Issues disclosed":
        signals.append("The property title reportedly has disclosed legal issues.")
        suggestions.append("Consult a qualified real estate lawyer before proceeding.")

    if answers.get("q12") == "Seller claims title is clean but no proof shown":
        signals.append("The seller claims the title is clean but no proof was shown.")
        suggestions.append("Request a certified true copy of the title from the Registry of Deeds.")

    if answers.get("q12") == "Not Sure":
        gaps.append("The legal status of the property title is unclear.")
        suggestions.append("Verify the title status with the local Registry of Deeds.")

    # -----------------------------
    # Early Buyer Payments
    # -----------------------------

    if answers.get("q14") == "Yes":
        signals.append("Buyers may be asked to make payments before key permits are fully verified.")
        suggestions.append("Ensure permits and ownership documents are validated before making large payments.")

    if answers.get("q14") == "Not Sure":
        gaps.append("Payment conditions before permit verification are unclear.")
        suggestions.append("Clarify the payment schedule and documentation requirements with the seller.")

    # -----------------------------
    # Environmental Risk
    # -----------------------------

    if answers.get("q16") == "Yes":
        signals.append("The property may be located in an environmentally sensitive or hazard-prone area.")
        suggestions.append("Check hazard maps and local government environmental assessments.")

    if answers.get("q16") == "Not Sure":
        gaps.append("Environmental risk exposure for the property is unclear.")
        suggestions.append("Review local hazard maps and environmental assessments.")

    if context_profile == "private_sale":
        _apply_private_sale_logic(answers, signals, gaps, suggestions)

    return {
        "strengths": strengths,
        "signals": signals,
        "information_gaps": gaps,
        "suggestions": suggestions,
    }