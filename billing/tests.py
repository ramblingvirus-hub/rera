import hashlib
import hmac
import json

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from billing.models import CreditPurchase, CreditTransaction, ManualPayment


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


class ManualPaymentFlowTests(TestCase):
	def setUp(self):
		self.client = APIClient()
		self.user = User.objects.create_user(username="manual_user", password="x")
		self.admin = User.objects.create_superuser(username="manual_admin", email="admin@example.com", password="x")

	def _proof_file(self, name="proof.png"):
		return SimpleUploadedFile(name, b"file-bytes", content_type="image/png")

	def test_submit_manual_payment_creates_pending_record(self):
		self.client.force_authenticate(user=self.user)
		response = self.client.post(
			"/api/v1/billing/manual-payments/",
			data={
				"package": "bundle_3",
				"payment_method": "GCASH",
				"reference_number": "ABC 123 456",
				"proof_file": self._proof_file(),
			},
			format="multipart",
		)

		self.assertEqual(response.status_code, 201)
		payment = ManualPayment.objects.get(user=self.user)
		self.assertEqual(payment.status, ManualPayment.STATUS_PENDING)
		self.assertEqual(payment.package_key, "bundle_3")
		self.assertEqual(payment.payment_method, "GCASH")

	def test_submit_manual_payment_rejects_duplicate_reference(self):
		ManualPayment.objects.create(
			user=self.user,
			package_key="single",
			amount_php=550,
			credits_purchased=1,
			payment_method="GCASH",
			reference_number="ABC123",
			reference_number_normalized="ABC123",
			proof_file=self._proof_file("existing.png"),
		)

		self.client.force_authenticate(user=self.user)
		response = self.client.post(
			"/api/v1/billing/manual-payments/",
			data={
				"package": "single",
				"payment_method": "MAYA",
				"reference_number": "abc 123",
				"proof_file": self._proof_file("new.png"),
			},
			format="multipart",
		)

		self.assertEqual(response.status_code, 400)
		self.assertIn("reference_number", response.data)

	def test_admin_approve_grants_credit_once(self):
		payment = ManualPayment.objects.create(
			user=self.user,
			package_key="single",
			amount_php=550,
			credits_purchased=1,
			payment_method="GCASH",
			reference_number="MANUAL-OK-1",
			reference_number_normalized="MANUAL-OK-1",
			proof_file=self._proof_file("approve.png"),
		)

		self.client.force_authenticate(user=self.admin)
		first = self.client.post(
			f"/api/v1/billing/admin/manual-payments/{payment.id}/review/",
			data={"action": "approve", "admin_notes": "verified"},
			format="json",
		)
		second = self.client.post(
			f"/api/v1/billing/admin/manual-payments/{payment.id}/review/",
			data={"action": "approve", "admin_notes": "retry"},
			format="json",
		)

		payment.refresh_from_db()
		self.assertEqual(first.status_code, 200)
		self.assertEqual(second.status_code, 200)
		self.assertEqual(payment.status, ManualPayment.STATUS_APPROVED)
		self.assertEqual(CreditTransaction.objects.filter(user=self.user, type="purchase").count(), 1)
		self.assertEqual(CreditPurchase.objects.filter(user=self.user, status="completed").count(), 1)


@override_settings(GCASH_QR_URL="/media/qr/gcash.png", MAYA_QR_URL="https://cdn.example.com/maya.png")
class ManualPaymentConfigTests(TestCase):
	def setUp(self):
		self.client = APIClient()
		self.user = User.objects.create_user(username="config_user", password="x")
		self.client.force_authenticate(user=self.user)

	def test_config_resolves_relative_qr_url_to_absolute(self):
		response = self.client.get("/api/v1/billing/manual-payments/config/")

		self.assertEqual(response.status_code, 200)
		gcash_qr = response.data["instructions"]["GCASH"]["qr_url"]
		self.assertTrue(gcash_qr.startswith("http://testserver/media/qr/gcash.png"))

	def test_config_preserves_absolute_qr_url(self):
		response = self.client.get("/api/v1/billing/manual-payments/config/")

		self.assertEqual(response.status_code, 200)
		maya_qr = response.data["instructions"]["MAYA"]["qr_url"]
		self.assertEqual(maya_qr, "https://cdn.example.com/maya.png")


@override_settings(PAYMONGO_ENABLED=False)
class PayMongoDisabledTests(TestCase):
	def setUp(self):
		self.client = APIClient()
		self.user = User.objects.create_user(username="paymongo_off_user", password="x")
		self.client.force_authenticate(user=self.user)

	def test_initiate_credit_purchase_returns_503_when_disabled(self):
		response = self.client.post(
			"/api/v1/billing/credits/purchase/initiate/",
			data={"package": "single"},
			format="json",
		)
		self.assertEqual(response.status_code, 503)

	def test_confirm_credit_purchase_returns_503_when_disabled(self):
		response = self.client.post(
			"/api/v1/billing/credits/purchase/confirm/",
			data={"purchase_id": 1},
			format="json",
		)
		self.assertEqual(response.status_code, 503)
