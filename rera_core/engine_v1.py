# rera_core/engine_v1.py

# =====================
# STRUCTURE VERSION
# =====================

STRUCTURE_VERSION = "1.0"


# =====================
# CATEGORY WEIGHTS
# =====================

CATEGORY_WEIGHTS = {
    "developer_legitimacy": 0.25,
    "project_compliance": 0.30,
    "title_land": 0.25,
    "financial_exposure": 0.10,
    "lgu_environment": 0.10,
    
}

REQUIRED_CATEGORIES = set(CATEGORY_WEIGHTS.keys())


# =====================
# RISK BAND LOGIC
# =====================

def determine_risk_band(score, severe_override=False):
    """
    Determines final risk band based on total score.
    Severe override forces SEVERE_RISK.
    """

    if severe_override:
        return "SEVERE_RISK"

    if score >= 80:
        return "LOW_RISK"
    elif score >= 60:
        return "MODERATE_RISK"
    elif score >= 40:
        return "HIGH_RISK"
    else:
        return "SEVERE_RISK"

# =====================
# CORE EVALUATION ENGINE
# =====================

def evaluate_project_v1(category_scores, license_to_sell_present=True):
        # =====================
    # INPUT VALIDATION
    # =====================

    if not isinstance(category_scores, dict):
        raise ValueError("category_scores must be a dictionary")

    provided_categories = set(category_scores.keys())

    if provided_categories != REQUIRED_CATEGORIES:
        missing = REQUIRED_CATEGORIES - provided_categories
        extra = provided_categories - REQUIRED_CATEGORIES

        raise ValueError(
            f"Invalid categories. Missing: {missing}, Extra: {extra}"
        )

    for category, score in category_scores.items():
        if not isinstance(score, (int, float)):
            raise ValueError(f"Score for '{category}' must be a number")

        if score < 0 or score > 100:
            raise ValueError(f"Score for '{category}' must be between 0 and 100")
    
    
    """
    category_scores: dict with 5 category keys (0–100 each)
    license_to_sell_present: boolean
    """

    # Severe structural override
    severe_override = not license_to_sell_present

    total_score = 0

    for category, weight in CATEGORY_WEIGHTS.items():
        score = category_scores.get(category, 0)

        # Safety clamp
        if score < 0:
            score = 0
        if score > 100:
            score = 100

        weighted_score = score * weight
        total_score += weighted_score

    final_band = determine_risk_band(total_score, severe_override)

    return {
        "structure_version": STRUCTURE_VERSION,
        "total_score": round(total_score, 2),
        "risk_band": final_band,
        "category_breakdown": category_scores,
        "license_to_sell_present": license_to_sell_present
    }
