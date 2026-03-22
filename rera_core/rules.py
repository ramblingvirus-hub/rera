# rera_core/rules.py

# =====================
# ECC RULES
# =====================

def check_ecc_present(project):
    """
    - No ECC → CRITICAL_RISK
    - ECC expired → CRITICAL_RISK
    - Valid ECC → PASS
    """
    if project.get("ecc") is not True:
        return "CRITICAL_RISK", "ECC_MISSING", "ECC is missing"

    if project.get("ecc_expired") is True:
        return "CRITICAL_RISK", "ECC_EXPIRED", "ECC has expired"

    return "PASS", None, None


def check_ecc_expiry_soon_v2(project):
    """
    - ECC valid but expires in ≤ 90 days → REVIEW
    """
    if project.get("ecc") is not True:
        return "PASS", None, None

    if project.get("ecc_expired") is True:
        return "PASS", None, None

    expiry_days = project.get("ecc_expiry_days")
    if expiry_days is not None and expiry_days <= 90:
        return "REVIEW", "ECC_EXPIRING_SOON", "ECC expiring soon"

    return "PASS", None, None


# =====================
# BARANGAY RULES
# =====================

def check_barangay_clearance_v2(project):
    """
    - Explicitly missing barangay clearance → CRITICAL_RISK
    """
    if "barangay_clearance" not in project:
        return "PASS", None, None

    if project.get("barangay_clearance") is False:
        return (
            "CRITICAL_RISK",
            "BARANGAY_CLEARANCE_MISSING",
            "Barangay clearance missing",
        )

    return "PASS", None, None


# =====================
# AGGREGATION
# =====================

def aggregate_risk_v2(rule_results):
    """
    rule_results: list of (result, code, message)
    """
    results_only = []
    reasons = []

    for result, code, message in rule_results:
        results_only.append(result)
        if code and message:
            reasons.append({
                "code": code,
                "message": message
            })

    if "CRITICAL_RISK" in results_only:
        return "CRITICAL_RISK", reasons

    if "REVIEW" in results_only:
        return "REVIEW", reasons

    return "PASS", []


# =====================
# SEVERITY GATE
# =====================

def severity_gate(final_risk):
    if final_risk == "PASS":
        return "AUTO_APPROVE"

    if final_risk == "REVIEW":
        return "REQUIRE_REVIEW"

    if final_risk == "CRITICAL_RISK":
        return "BLOCK"

    return "REQUIRE_REVIEW"

def check_project_name(project):
    """
    Rule:
    - Missing name → REVIEW
    """
    if not project.get("name"):
        return ("REVIEW", "NAME_MISSING", "Project name is missing")

    return ("PASS", None, None)

# =====================
# PIPELINE
# =====================

RULES = [
    check_ecc_present,
    check_ecc_expiry_soon_v2,
    check_barangay_clearance_v2,
    check_project_name
]


def run_rules(project):
    results = []
    for rule in RULES:
        result = rule(project)
        if result:
            results.append(result)
    return results


def evaluate_project(project):
    """
    External entry point.
    Returns:
    final_risk, gate_action, reasons
    """
    rule_results = run_rules(project)
    final_risk, reasons = aggregate_risk_v2(rule_results)
    gate_action = severity_gate(final_risk)

    return final_risk, gate_action, reasons
