from django.test import TestCase

from reports.explanation_engine import (
	build_category_interpretations,
	generate_assessment_summary,
	generate_explanations,
)


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
