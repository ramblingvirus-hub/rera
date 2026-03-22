import requests
import base64
from django.conf import settings
from decimal import Decimal


class PayMongoService:
    """
    Integration with PayMongo payment gateway.
    Handles credit purchases and subscriptions.
    """
    
    BASE_URL = "https://api.paymongo.com/v1"
    
    def __init__(self):
        self.secret_key = settings.PAYMONGO_SECRET_KEY
        self.public_key = settings.PAYMONGO_PUBLIC_KEY
        self.headers = self._get_headers()
    
    def _get_headers(self):
        """Create authorization headers for PayMongo API"""
        auth_string = base64.b64encode(f"{self.secret_key}:".encode()).decode()
        return {
            "Authorization": f"Basic {auth_string}",
            "Content-Type": "application/json"
        }
    
    # ...existing code...

    def create_payment_intent(self, amount_cents, description, metadata=None):
        """
        Create a PayMongo payment intent.
        amount_cents is in centavos (PHP 550 = 55000)
        """
        payload = {
            "data": {
                "attributes": {
                    "amount": int(amount_cents),
                    "currency": "PHP",
                    "capture_type": "automatic",
                    "payment_method_allowed": ["card"],
                    "payment_method_options": {
                        "card": {
                            "request_three_d_secure": "any"
                        }
                    },
                    "description": description,
                    
                }
            }
        }

        try:
            response = requests.post(
                f"{self.BASE_URL}/payment_intents",
                json=payload,
                headers=self.headers,
                timeout=15
            )
            if response.status_code >= 400:
                raise PayMongoException(
                    f"PayMongo create_payment_intent failed "
                    f"({response.status_code}): {response.text}"
                )
            return response.json()["data"]
        except requests.exceptions.RequestException as e:
            raise PayMongoException(f"Failed to create payment intent: {str(e)}")

    
    def create_payment_method(self, token):
        """
        Create a PayMongo payment method from a token.
        
        Args:
            token: Payment method token from PayMongo client library
        
        Returns:
            dict with payment_method_id
        """
        payload = {
            "data": {
                "attributes": {
                    "details": {
                        "card_token": token
                    },
                    "type": "card"
                }
            }
        }
        
        try:
            response = requests.post(
                f"{self.BASE_URL}/payment_methods",
                json=payload,
                headers=self.headers,
                timeout=10
            )
            response.raise_for_status()
            return response.json()["data"]
        except requests.exceptions.RequestException as e:
            raise PayMongoException(f"Failed to create payment method: {str(e)}")
    
    def attach_payment_method(self, payment_intent_id, payment_method_id):
        """
        Attach a payment method to a payment intent to process the payment.
        
        Args:
            payment_intent_id: ID of the payment intent
            payment_method_id: ID of the payment method
        
        Returns:
            dict with payment confirmation
        """
        payload = {
            "data": {
                "attributes": {
                    "payment_method": payment_method_id
                }
            }
        }
        
        try:
            response = requests.post(
                f"{self.BASE_URL}/payment_intents/{payment_intent_id}/attach",
                json=payload,
                headers=self.headers,
                timeout=10
            )
            response.raise_for_status()
            return response.json()["data"]
        except requests.exceptions.RequestException as e:
            raise PayMongoException(f"Failed to attach payment method: {str(e)}")
    
    def retrieve_payment_intent(self, payment_intent_id):
        """
        Retrieve the status of a payment intent.
        
        Args:
            payment_intent_id: ID of the payment intent
        
        Returns:
            dict with payment intent details
        """
        try:
            response = requests.get(
                f"{self.BASE_URL}/payment_intents/{payment_intent_id}",
                headers=self.headers,
                timeout=10
            )
            response.raise_for_status()
            return response.json()["data"]
        except requests.exceptions.RequestException as e:
            raise PayMongoException(f"Failed to retrieve payment intent: {str(e)}")


class PayMongoException(Exception):
    """PayMongo service error"""
    pass