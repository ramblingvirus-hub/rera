# reports/interview_scoring.py

"""
Interview Scoring Engine

Converts structured interview answers into
category scores required by the evaluation engine.
"""

from typing import Dict
from .interview_registry import (
    get_registry,
    ANSWER_SCORE_MAP
)


def _normalize_sale_mode(value: str | None) -> str:
    return str(value or "").strip().lower().replace("-", "_").replace(" ", "_")


def _is_developer_project(answers: Dict[str, str]) -> bool:
    return _normalize_sale_mode(answers.get("q6")) == "developer_project"


def get_category_applicability(answers: Dict[str, str]) -> Dict[str, bool]:
    is_developer_project = _is_developer_project(answers)
    return {
        "developer_legitimacy": is_developer_project,
        "project_compliance": is_developer_project,
        "title_land": True,
        "financial_exposure": True,
        "lgu_environment": True,
    }

def initialize_category_scores():
    return {
        "developer_legitimacy": 0,
        "project_compliance": 0,
        "title_land": 0,
        "financial_exposure": 0,
        "lgu_environment": 0,
    }

def compute_category_scores(responses, interview_version):

    registry = get_registry(interview_version)

    category_scores = initialize_category_scores()

    for question_id, answer in responses.items():

        if question_id not in registry:
            continue

        question = registry[question_id]

        category = question["category"]
        weight = question["weight"]

        score = ANSWER_SCORE_MAP.get(answer, 50)

        category_scores[category] += score * weight

    return category_scores


# -----------------------------
# Positive Question Scoring (Good if YES)
# Q7, Q8, Q9, Q10
# -----------------------------

POSITIVE_QUESTION_MAP = {
    "Yes": 100,
    "No": 0,
    "Not Sure": 50,
}


# -----------------------------
# Risk Question Scoring (Bad if YES)
# Q13, Q14, Q15, Q16
# -----------------------------

RISK_QUESTION_MAP = {
    "Yes": 0,
    "No": 100,
    "Not Sure": 50,
}


# -----------------------------
# Title Type Scoring (Q11)
# -----------------------------

TITLE_SCORE_MAP = {
    "TCT": 100,
    "CCT": 95,
    "Mother Title": 60,
    "Tax Declaration": 30,
    "Agrarian Reform Title": 70,
    "Rights Only": 10,
    "No title shown": 0,
    "Not Sure": 40,
}


# -----------------------------
# Title Issue Scoring (Q12)
# -----------------------------

TITLE_ISSUE_MAP = {
    "No known issues": 100,
    "Issues disclosed": 40,
    "Seller claims title is clean but no proof shown": 30,
    "Not Sure": 50,
}


# -----------------------------
# Generic Scoring Functions
# -----------------------------

def score_positive(answer: str) -> int:
    """Score for positive questions (Yes = good)"""
    return POSITIVE_QUESTION_MAP.get(answer, 50)


def score_risk(answer: str) -> int:
    """Score for risk questions (No = good, Yes = bad)"""
    return RISK_QUESTION_MAP.get(answer, 50)


def score_title(answer: str) -> int:
    return TITLE_SCORE_MAP.get(answer, 40)


def score_title_issue(answer: str) -> int:
    return TITLE_ISSUE_MAP.get(answer, 50)


# -----------------------------
# Category Calculations
# -----------------------------

def calculate_category_scores(answers: Dict[str, str]) -> Dict[str, float]:

    is_developer_project = _is_developer_project(answers)

    # For non-developer flows, developer-only categories are treated as neutral-positive.
    q7 = score_positive(answers.get("q7")) if is_developer_project else 100
    q8 = score_positive(answers.get("q8")) if is_developer_project else 100

    q9 = score_positive(answers.get("q9")) if is_developer_project else 100
    q10 = score_positive(answers.get("q10")) if is_developer_project else 100

    q11 = score_title(answers.get("q11"))
    q12 = score_title_issue(answers.get("q12"))

    q13 = score_risk(answers.get("q13"))
    q14 = score_risk(answers.get("q14"))

    q15 = score_risk(answers.get("q15"))
    q16 = score_risk(answers.get("q16"))

    developer_legitimacy = (q7 * 0.7) + (q8 * 0.3)

    project_compliance = (q9 * 0.6) + (q10 * 0.4)

    title_land = (q11 * 0.6) + (q12 * 0.4)

    financial_exposure = (q13 * 0.4) + (q14 * 0.6)

    lgu_environment = (q15 * 0.5) + (q16 * 0.5)

    return {
        "developer_legitimacy": developer_legitimacy,
        "project_compliance": project_compliance,
        "title_land": title_land,
        "financial_exposure": financial_exposure,
        "lgu_environment": lgu_environment,
    }
    

    # -----------------------------
# Registry-Driven Category Calculation (Phase 4B)
# -----------------------------

def compute_category_scores(responses: Dict[str, str], interview_version: str) -> Dict[str, float]:

    registry = get_registry(interview_version)

    category_scores = {
        "developer_legitimacy": 0,
        "project_compliance": 0,
        "title_land": 0,
        "financial_exposure": 0,
        "lgu_environment": 0,
    }

    for question_id, answer in responses.items():

        if question_id not in registry:
            continue

        question = registry[question_id]

        category = question["category"]
        weight = question["weight"]

        score = ANSWER_SCORE_MAP.get(answer, 50)

        category_scores[category] += score * weight

    return category_scores


# -----------------------------
# Final Score Calculation
# -----------------------------

def calculate_final_score(
    category_scores: Dict[str, float],
    category_applicability: Dict[str, bool] | None = None,
) -> float:

    weights = {
        "developer_legitimacy": 0.25,
        "project_compliance": 0.30,
        "title_land": 0.25,
        "financial_exposure": 0.10,
        "lgu_environment": 0.10,
    }

    weighted_sum = 0.0
    active_weight_total = 0.0

    for category, weight in weights.items():
        applicable = True if category_applicability is None else category_applicability.get(category, True)
        if not applicable:
            continue

        score = float(category_scores.get(category, 0))
        score = max(0.0, min(100.0, score))

        weighted_sum += score * weight
        active_weight_total += weight

    if active_weight_total == 0:
        return 0.0

    return round(weighted_sum / active_weight_total, 2)