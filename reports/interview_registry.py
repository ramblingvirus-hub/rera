CURRENT_INTERVIEW_VERSION = "1.1"

ANSWER_SCORE_MAP = {
    "yes": 100,
    "no": 0,
    "not_sure": 50,
}

INTERVIEW_REGISTRY_V1 = {

    "q7": {
        "category": "developer_legitimacy",
        "weight": 0.7
    },

    "q8": {
        "category": "developer_legitimacy",
        "weight": 0.3
    },

    "q9": {
        "category": "project_compliance",
        "weight": 0.6
    },

    "q10": {
        "category": "project_compliance",
        "weight": 0.4
    },

    "q11": {
        "category": "title_land",
        "weight": 0.6
    },

    "q12": {
        "category": "title_land",
        "weight": 0.4
    },

    "q13": {
        "category": "financial_exposure",
        "weight": 0.4
    },

    "q14": {
        "category": "financial_exposure",
        "weight": 0.6
    },

    "q15": {
        "category": "lgu_environment",
        "weight": 0.5
    },

    "q16": {
        "category": "lgu_environment",
        "weight": 0.5
    }
}

INTERVIEW_REGISTRIES = {
    "1.1": INTERVIEW_REGISTRY_V1
}

def get_registry(version):
    try:
        return INTERVIEW_REGISTRIES[version]
    except KeyError:
        raise ValueError(f"Unsupported interview version: {version}")
