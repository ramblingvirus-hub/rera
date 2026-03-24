import hashlib
import hmac
import json

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from billing.models import CreditPurchase, CreditTransaction


def _signature(secret, payload_bytes, timestamp="1710000000"):
	signed = f"{timestamp}.".encode("utf-8") + payload_bytes
	digest = hmac.new(secret.encode("utf-8"), signed, hashlib.sha256).hexdigest()
	return f"t={timestamp},v1={digest}"


@override_settings(PAYMONGO_WEBHOOK_SECRET="whsec_test_secret")
class PayMongoWebhookTests(TestCase):
	def setUp(self):
		self.client = APIClient()
		self.user = User.objects.create_user(username="webhook_user", password="x")
		self.purchase = CreditPurchase.objects.create(
			user=self.user,
			credits_purchased=3,
			amount_php=1500,
			payment_method="paymongo",
			paymongo_payment_id="pi_test_123",
			status="pending",
		)

	def test_rejects_invalid_signature(self):
		payload = {
			"data": {
				"attributes": {
					"type": "payment_intent.succeeded",
					"data": {"id": "pi_test_123"},
				}
			}
		}
		raw = json.dumps(payload).encode("utf-8")

		response = self.client.post(
			"/api/v1/billing/webhooks/paymongo/",
			data=raw,
			content_type="application/json",
			HTTP_X_PAYMONGO_SIGNATURE="t=1710000000,v1=bad",
		)

		self.assertEqual(response.status_code, 401)
		self.assertEqual(CreditTransaction.objects.count(), 0)

	def test_processes_success_event_once(self):
		payload = {
			"data": {
				"attributes": {
					"type": "payment_intent.succeeded",
					"data": {"id": "pi_test_123"},
				}
			}
		}
		raw = json.dumps(payload).encode("utf-8")
		signature = _signature("whsec_test_secret", raw)

		first = self.client.post(
			"/api/v1/billing/webhooks/paymongo/",
			data=raw,
			content_type="application/json",
			HTTP_X_PAYMONGO_SIGNATURE=signature,
		)
		second = self.client.post(
			"/api/v1/billing/webhooks/paymongo/",
			data=raw,
			content_type="application/json",
			HTTP_X_PAYMONGO_SIGNATURE=signature,
		)

		self.purchase.refresh_from_db()
		self.assertEqual(first.status_code, 200)
		self.assertEqual(second.status_code, 200)
		self.assertEqual(self.purchase.status, "completed")
		self.assertEqual(CreditTransaction.objects.count(), 1)
		txn = CreditTransaction.objects.first()
		self.assertEqual(txn.user_id, self.user.id)
		self.assertEqual(txn.amount, 3)
		self.assertEqual(txn.type, "purchase")
		self.assertEqual(txn.reference_id, "paymongo-pi_test_123")
