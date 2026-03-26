from django.test import TestCase

from reports.explanation_engine import (
	build_category_interpretations,
	generate_assessment_summary,
	generate_explanations,
)
from reports.interview_scoring import calculate_category_scores
from reports.interview_scoring import calculate_final_score, get_category_applicability


class ExplanationEngineEnhancementTests(TestCase):
	def test_generate_explanations_includes_strengths(self):
		answers = {
			"q7": "Yes",
			"q9": "Yes",
			"q11": "TCT",
			"q12": "No known issues",
			"q16": "No",
		}

		result = generate_explanations(answers)

		self.assertIn("strengths", result)
		self.assertGreaterEqual(len(result["strengths"]), 1)

	def test_category_interpretations_label_thresholds(self):
		interpretations = build_category_interpretations(
			{
				"developer_legitimacy": 85,
				"project_compliance": 65,
				"title_land": 45,
				"financial_exposure": 20,
			}
		)

		self.assertEqual(interpretations["developer_legitimacy"]["label"], "Strong")
		self.assertEqual(interpretations["project_compliance"]["label"], "Moderate")
		self.assertEqual(interpretations["title_land"]["label"], "Weak")
		self.assertEqual(interpretations["financial_exposure"]["label"], "High Risk")

	def test_category_interpretations_marks_non_developer_categories_not_applicable(self):
		interpretations = build_category_interpretations(
			{
				"developer_legitimacy": 100,
				"project_compliance": 100,
				"title_land": 70,
			},
			is_non_developer=True,
		)

		self.assertEqual(interpretations["developer_legitimacy"]["label"], "Not Applicable")
		self.assertEqual(interpretations["project_compliance"]["label"], "Not Applicable")
		self.assertEqual(interpretations["title_land"]["label"], "Moderate")

	def test_assessment_summary_renders_strengths_and_concerns(self):
		summary = generate_assessment_summary(
			72.5,
			"MODERATE_RISK",
			["Developer has presented a valid License to Sell."],
			["No development permit has been shown for the project."],
		)

		self.assertIn("MODERATE level of risk", summary)
		self.assertIn("Key strengths include", summary)
		self.assertIn("Potential concerns include", summary)


class ConditionalScoringTests(TestCase):
	def test_non_developer_sale_neutralizes_q7_to_q10(self):
		answers = {
			"q6": "Private Sale",
			"q7": "No",
			"q8": "No",
			"q9": "No",
			"q10": "No",
			"q11": "TCT",
			"q12": "No known issues",
			"q13": "No",
			"q14": "No",
			"q15": "No",
			"q16": "No",
		}

		scores = calculate_category_scores(answers)

		self.assertEqual(scores["developer_legitimacy"], 100)
		self.assertEqual(scores["project_compliance"], 100)

	def test_developer_sale_uses_q7_to_q10_answers(self):
		answers = {
			"q6": "Developer Project",
			"q7": "No",
			"q8": "No",
			"q9": "No",
			"q10": "No",
			"q11": "TCT",
			"q12": "No known issues",
			"q13": "No",
			"q14": "No",
			"q15": "No",
			"q16": "No",
		}

		scores = calculate_category_scores(answers)

		self.assertEqual(scores["developer_legitimacy"], 0)
		self.assertEqual(scores["project_compliance"], 0)


class SuggestionOptimizationTests(TestCase):
	def test_non_developer_flow_excludes_lts_suggestions(self):
		answers = {
			"q6": "Private Sale",
			"q12": "Not Sure",
			"q14": "Not Sure",
			"q16": "Not Sure",
		}

		result = generate_explanations(answers)
		suggestions = result["suggestions"]

		self.assertLessEqual(len(suggestions), 5)
		self.assertFalse(any("license to sell" in s.lower() or "dhsud" in s.lower() for s in suggestions))

	def test_developer_flow_includes_lts_baseline_suggestion(self):
		answers = {
			"q6": "Developer Project",
			"q7": "Not Sure",
			"q9": "Not Sure",
			"q10": "Not Sure",
			"q12": "Not Sure",
			"q14": "Not Sure",
			"q16": "Not Sure",
		}

		result = generate_explanations(answers)
		suggestions = result["suggestions"]

		self.assertLessEqual(len(suggestions), 5)
		self.assertTrue(any("license to sell" in s.lower() or "dhsud" in s.lower() for s in suggestions))

	def test_semantic_title_repetitions_collapse_to_single_action(self):
		answers = {
			"q6": "Private Sale",
			"q12": "Seller claims title is clean but no proof shown",
			"ps2": "No",
		}

		result = generate_explanations(answers)
		suggestions = result["suggestions"]

		title_like_count = sum(
			1 for s in suggestions
			if any(token in s.lower() for token in ["title", "registry of deeds", "ownership"])
		)

		self.assertLessEqual(len(suggestions), 5)
		self.assertEqual(title_like_count, 1)


class DynamicReweightingTests(TestCase):
	def test_private_sale_reweights_excluding_non_applicable_categories(self):
		category_scores = {
			"developer_legitimacy": 100,
			"project_compliance": 100,
			"title_land": 76,
			"financial_exposure": 100,
			"lgu_environment": 50,
		}
		applicability = {
			"developer_legitimacy": False,
			"project_compliance": False,
			"title_land": True,
			"financial_exposure": True,
			"lgu_environment": True,
		}

		final_score = calculate_final_score(category_scores, applicability)

		self.assertGreaterEqual(final_score, 75)
		self.assertLessEqual(final_score, 76)

	def test_developer_project_keeps_standard_weighting(self):
		category_scores = {
			"developer_legitimacy": 80,
			"project_compliance": 70,
			"title_land": 60,
			"financial_exposure": 50,
			"lgu_environment": 40,
		}
		final_score = calculate_final_score(category_scores)

		self.assertEqual(final_score, 67.0)

	def test_applicability_map_marks_non_developer_categories(self):
		applicability = get_category_applicability({"q6": "Private Sale"})

		self.assertFalse(applicability["developer_legitimacy"])
		self.assertFalse(applicability["project_compliance"])
		self.assertTrue(applicability["title_land"])
