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
# Basic Yes / No / Not Sure scoring
# -----------------------------

BASIC_SCORE_MAP = {
    "Yes": 100,
    "No": 0,
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
# Generic Scoring Function
# -----------------------------

def score_basic(answer: str) -> int:
    return BASIC_SCORE_MAP.get(answer, 50)


def score_title(answer: str) -> int:
    return TITLE_SCORE_MAP.get(answer, 40)


def score_title_issue(answer: str) -> int:
    return TITLE_ISSUE_MAP.get(answer, 50)


# -----------------------------
# Category Calculations
# -----------------------------

def calculate_category_scores(answers: Dict[str, str]) -> Dict[str, float]:

    q7 = score_basic(answers.get("q7"))
    q8 = score_basic(answers.get("q8"))

    q9 = score_basic(answers.get("q9"))
    q10 = score_basic(answers.get("q10"))

    q11 = score_title(answers.get("q11"))
    q12 = score_title_issue(answers.get("q12"))

    q13 = score_basic(answers.get("q13"))
    q14 = score_basic(answers.get("q14"))

    q15 = score_basic(answers.get("q15"))
    q16 = score_basic(answers.get("q16"))

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

def calculate_final_score(category_scores: Dict[str, float]) -> float:

    return (
        category_scores["developer_legitimacy"] * 0.25
        + category_scores["project_compliance"] * 0.30
        + category_scores["title_land"] * 0.25
        + category_scores["financial_exposure"] * 0.10
        + category_scores["lgu_environment"] * 0.10
    )