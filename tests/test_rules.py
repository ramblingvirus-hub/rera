# tests/test_rules.py

from rera_core.rules import check_ecc_present

def test_project_without_ecc_is_critical():
    project = {
        "name": "Sample Condo",
        "ecc": False
    }

    risk, code, message = check_ecc_present(project)

    assert risk == "CRITICAL_RISK"
    assert code == "ECC_MISSING"
    assert message == "ECC is missing"


def test_project_with_expired_ecc_is_critical():
    project = {
        "name": "Sample Condo",
        "ecc": True,
        "ecc_expired": True
    }

    risk, code, message = check_ecc_present(project)

    assert risk == "CRITICAL_RISK"
    assert code == "ECC_EXPIRED"
    assert message == "ECC has expired"


def test_aggregate_risk_with_one_critical():
    rule_results = [
        ("PASS", None, None),
        ("CRITICAL_RISK", "ECC_EXPIRED", "ECC has expired"),
        ("PASS", None, None)
    ]

    from rera_core.rules import aggregate_risk_v2

    final_risk, reasons = aggregate_risk_v2(rule_results)

    assert final_risk == "CRITICAL_RISK"
    assert reasons == [
        {"code": "ECC_EXPIRED", "message": "ECC has expired"}
    ]



def test_aggregate_risk_with_review_only():
    rule_results = [
        ("PASS", None, None),
        ("REVIEW", "ECC_EXPIRING_SOON", "ECC expiring soon"),
        ("PASS", None, None)
    ]

    from rera_core.rules import aggregate_risk_v2

    final_risk, reasons = aggregate_risk_v2(rule_results)

    assert final_risk == "REVIEW"
    assert reasons == [
        {"code": "ECC_EXPIRING_SOON", "message": "ECC expiring soon"}
    ]


def test_review_returns_reason():
    rule_results = [
        ("PASS", None, None),
        ("REVIEW", "ECC_EXPIRING_SOON", "ECC expiring soon"),
        ("PASS", None, None)
    ]

    from rera_core.rules import aggregate_risk_v2

    final_risk, reasons = aggregate_risk_v2(rule_results)

    assert final_risk == "REVIEW"
    assert reasons == [
        {"code": "ECC_EXPIRING_SOON", "message": "ECC expiring soon"}
    ]


def test_ecc_expiring_soon_is_review():
    project = {
        "ecc": True,
        "ecc_expired": False,
        "ecc_expiry_days": 60
    }

    from rera_core.rules import check_ecc_expiry_soon_v2

    risk, code, message = check_ecc_expiry_soon_v2(project)

    assert risk == "REVIEW"
    assert code == "ECC_EXPIRING_SOON"
    assert message == "ECC expiring soon"


def test_ecc_expiring_soon_returns_code_and_message():
    project = {
        "ecc": True,
        "ecc_expired": False,
        "ecc_expiry_days": 30
    }

    from rera_core.rules import check_ecc_expiry_soon_v2

    result, code, message = check_ecc_expiry_soon_v2(project)

    assert result == "REVIEW"
    assert code == "ECC_EXPIRING_SOON"
    assert message == "ECC expiring soon"

def test_aggregate_with_ecc_v2_reason():
    rule_results = [
        ("PASS", None, None),
        ("REVIEW", "ECC_EXPIRING_SOON", "ECC expiring soon"),
        ("PASS", None, None)
    ]

    from rera_core.rules import aggregate_risk_v2

    final_risk, reasons = aggregate_risk_v2(rule_results)

    assert final_risk == "REVIEW"
    assert reasons == [
        {"code": "ECC_EXPIRING_SOON", "message": "ECC expiring soon"}
    ]

def test_evaluate_project_with_ecc_expiring_soon():
    project = {
        "name": "Sample Condo",
        "ecc": True,
        "ecc_expired": False,
        "ecc_expiry_days": 45
    }

    from rera_core.rules import evaluate_project

    final_risk, gate_action, reasons = evaluate_project(project)

    assert gate_action == "REQUIRE_REVIEW"
    assert final_risk == "REVIEW"
    assert reasons == [
        {"code": "ECC_EXPIRING_SOON", "message": "ECC expiring soon"}
    ]

def test_barangay_clearance_missing_is_critical():
    project = {
        "barangay_clearance": False
    }

    from rera_core.rules import check_barangay_clearance_v2

    result, code, message = check_barangay_clearance_v2(project)

    assert result == "CRITICAL_RISK"
    assert code == "BARANGAY_CLEARANCE_MISSING"
    assert message == "Barangay clearance missing"

def test_evaluate_project_with_missing_barangay_clearance():
    project = {
        "name": "Sample Condo",
        "ecc": True,
        "ecc_expired": False,
        "ecc_expiry_days": 120,
        "barangay_clearance": False
    }

    from rera_core.rules import evaluate_project

    final_risk, gate_action, reasons = evaluate_project(project)

    assert gate_action == "BLOCK"
    assert final_risk == "CRITICAL_RISK"
    assert reasons == [
        {
            "code": "BARANGAY_CLEARANCE_MISSING",
            "message": "Barangay clearance missing"
        }
    ]

def test_severity_gating_for_review():
    final_risk = "REVIEW"

    from rera_core.rules import severity_gate

    action = severity_gate(final_risk)

    assert action == "REQUIRE_REVIEW"

def test_evaluate_project_returns_gate_action():
    project = {
        "name": "Sample Condo",
        "ecc": True,
        "ecc_expired": False,
        "ecc_expiry_days": 30
    }

    from rera_core.rules import evaluate_project

    final_risk, gate_action, reasons = evaluate_project(project)

    assert final_risk == "REVIEW"
    assert gate_action == "REQUIRE_REVIEW"
    assert reasons == [
        {"code": "ECC_EXPIRING_SOON", "message": "ECC expiring soon"}
    ]

def test_missing_project_name_triggers_review():
    project = {
        "ecc": True,
        "ecc_expired": False,
        "ecc_expiry_days": 120,
        "barangay_clearance": True,
    }

    from rera_core.rules import evaluate_project

    final_risk, gate_action, reasons = evaluate_project(project)

    assert final_risk == "REVIEW"
    assert gate_action == "REQUIRE_REVIEW"
    assert reasons == [
        {"code": "NAME_MISSING", "message": "Project name is missing"}
    ]
