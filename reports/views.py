import json
import uuid

from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework.test import APIRequestFactory

from django.shortcuts import get_object_or_404

from rera_core.engine_v1 import evaluate_project_v1, determine_risk_band
from .models import Report
from django.db import transaction
from billing.services import has_active_subscription, has_sufficient_credit, deduct_credit, user_has_admin_bypass, has_unlimited_report_access
from billing.services import calculate_user_balance
from audit.services import log_audit_event
from audit.constants import EVALUATION_ATTEMPT
from idempotency.models import IdempotencyKey
from idempotency.utils import generate_request_hash
from django.db import IntegrityError

from .interview_scoring import calculate_category_scores, calculate_final_score, get_category_applicability
from .risk_band import classify_risk_band
from .explanation_engine import (
    generate_explanations,
    generate_assessment_summary,
    build_category_interpretations,
    optimize_suggestions_for_report,
)

from .models import InterviewSession, InterviewStatus
from .serializers import InterviewSessionSerializer
from rest_framework.permissions import AllowAny
from django.utils import timezone

from billing.report_access import ReportAccessControl


APIView
class EvaluateProjectView(APIView):

    http_method_names = ['post']

    @staticmethod
    def _normalize_sale_mode(value):
        return str(value or "").strip().lower().replace("-", "_").replace(" ", "_")

    def post(self, request):
            
        try:
                        # === IDEMPOTENCY CHECK ===
            idempotency_key = request.headers.get("Idempotency-Key")

            if idempotency_key:

                request_hash = generate_request_hash(request.data)

                existing_entry = IdempotencyKey.objects.filter(
                    key=idempotency_key,
                    user=request.user
                ).first()

                if existing_entry:

                    # Same key used before
                    if existing_entry.request_hash != request_hash:
                        return Response(
                            {"error": "Idempotency key reuse with different payload."},
                            status=status.HTTP_409_CONFLICT
                        )

                    # Return stored response
                    return Response(
                        existing_entry.response_snapshot,
                        status=status.HTTP_200_OK
                    )
            
            request_id = str(uuid.uuid4())
            log_audit_event(
                user=request.user,
                event_type="EVALUATION_ATTEMPT",
                severity="INFO",
                request_id=request_id,
                metadata={
                    "endpoint": "EvaluateProjectView",
                },
        )
            # === SUBSCRIPTION CHECK ===
            subscription_active = has_active_subscription(request.user)
            admin_bypass = user_has_admin_bypass(request.user)
            unlimited_access = has_unlimited_report_access(request.user)

            # === CREDIT CHECK (NO DEDUCTION YET) ===
            if not unlimited_access:
                if not has_sufficient_credit(request.user):

                    log_audit_event(
                        user=request.user,
                        event_type="BILLING_INSUFFICIENT_CREDIT",
                        severity="WARNING",
                        request_id=request_id,
                        metadata={
                            "current_balance": calculate_user_balance(request.user)
                        }
                    )

                    return Response(
                        {"error": "Insufficient credits"},
                        status=status.HTTP_402_PAYMENT_REQUIRED
                    )

            data = request.data

            answers = data.get("answers")
            if not answers:
                return Response(
                    {"error": "Interview answers are required"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            category_scores = calculate_category_scores(answers)
            category_applicability = get_category_applicability(answers)

            final_score = calculate_final_score(category_scores, category_applicability)

            risk_band = classify_risk_band(final_score)

            explanations = generate_explanations(answers)

            license_to_sell_present = data.get("license_to_sell_present", True)

                        
            # === ENGINE EVALUATION ===
            result = evaluate_project_v1(
                category_scores,
                license_to_sell_present=license_to_sell_present,
                category_applicability=category_applicability,
            )
            sale_mode = self._normalize_sale_mode(answers.get("q6"))
            is_non_developer = sale_mode not in {"", "developer_project"}
            category_interpretations = build_category_interpretations(
                result.get("category_breakdown", {}),
                is_non_developer=is_non_developer,
            )
            assessment_summary = generate_assessment_summary(
                result.get("total_score"),
                result.get("risk_band"),
                explanations.get("strengths", []),
                explanations.get("signals", []),
            )

            # === SAVE + DEDUCT (ATOMIC) ===
            with transaction.atomic():

                timestamp = timezone.now()

                Report.objects.create(
                    request_id=request_id,
                    timestamp_utc=timestamp,
                    user=request.user,
                    structure_version=result["structure_version"],
                    total_score=result["total_score"],
                    risk_band=result["risk_band"],
                    category_breakdown=result["category_breakdown"],
                    license_to_sell_present=result["license_to_sell_present"],
                      strengths=explanations.get("strengths", []),
                    signals=explanations.get("signals", []),
                    information_gaps=explanations.get("information_gaps", []),
                    suggestions=explanations.get("suggestions", []),
                      assessment_summary=assessment_summary,
                    project_name=answers.get("q1", ""),
                          city=answers.get("q3", ""),
                          location=answers.get("q4", ""),
                )

                billing_type = "subscription"

                if admin_bypass:

                    billing_type = "admin"

                elif subscription_active:

                    log_audit_event(
                        user=request.user,
                        event_type="BILLING_SUBSCRIPTION_APPLIED",
                        severity="INFO",
                        request_id=request_id,
                        metadata={}
                    )

                    billing_type = "subscription"

                elif unlimited_access:

                    log_audit_event(
                        user=request.user,
                        event_type="BILLING_QA_BYPASS_APPLIED",
                        severity="INFO",
                        request_id=request_id,
                        metadata={"qa_bypass_unlock": True}
                    )

                    billing_type = "qa_bypass"

                else:

                    deduct_credit(request.user)

                    log_audit_event(
                        user=request.user,
                        event_type="BILLING_CREDIT_DEDUCTED",
                        severity="INFO",
                        request_id=str(request_id),
                        metadata={"amount": -1}
                    )

                    billing_type = "credit"

            response_payload = {
                "request_id": str(request_id),
                "timestamp_utc": timestamp.isoformat(),
                "report": result,
                "billing_type": billing_type
            }

            log_audit_event(
                user=request.user,
                event_type="EVALUATION_SUCCESS",
                severity="INFO",
                request_id=request_id,
                metadata={
                    "risk_band": response_payload.get("report", {}).get("risk_band"),
                    "billing_type": response_payload.get("billing_type"),
                },
            )
            # === STORE IDEMPOTENCY RECORD ===
            if idempotency_key:
                try:
                    IdempotencyKey.objects.create(
                        user=request.user,
                        key=idempotency_key,
                        request_hash=request_hash,
                        response_snapshot=response_payload
                    )
                except IntegrityError:
                    # Rare race condition protection
                    pass

            response_payload["report"]["signals"] = explanations["signals"]
            response_payload["report"]["information_gaps"] = explanations["information_gaps"]
            response_payload["report"]["suggestions"] = explanations["suggestions"]
            response_payload["report"]["strengths"] = explanations.get("strengths", [])
            response_payload["report"]["assessment_summary"] = assessment_summary
            response_payload["report"]["category_interpretations"] = category_interpretations

            response_payload["context"] = {
                "project_name": answers.get("q1", ""),
                "city": answers.get("q3", ""),
                "location": answers.get("q4", ""),
            }


            return Response(response_payload, status=status.HTTP_200_OK)

        except ValueError as e:
            log_audit_event(
                user=request.user,
                event_type="EVALUATION_VALIDATION_FAIL",
                severity="WARNING",
                request_id=request_id,
                metadata={
                    "error": str(e)
                }
            )
            return Response(
                {"error": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

        
        except Exception:
            return Response(
                {"error": "Unexpected error occurred."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )



class GetReportView(APIView):
    permission_classes = [IsAuthenticated]

    @staticmethod
    def _infer_non_developer_context(report):
        signals = report.signals or []
        suggestions = report.suggestions or []
        category_breakdown = report.category_breakdown or {}

        if any("private sale" in str(item).lower() for item in signals):
            return True

        has_lts_hint = any(
            ("license to sell" in str(item).lower()) or ("dhsud" in str(item).lower())
            for item in suggestions
        )
        if has_lts_hint:
            return False

        developer_legitimacy = category_breakdown.get("developer_legitimacy")
        project_compliance = category_breakdown.get("project_compliance")
        return developer_legitimacy == 100 and project_compliance == 100

    def get(self, request, request_id):
        report = get_object_or_404(
            Report,
            request_id=request_id,
            user=request.user
        )

        can_view_full = ReportAccessControl.can_access_full_report(request.user)
        active_subscription = ReportAccessControl.get_active_subscription(request.user)
        subscription_days_remaining = ReportAccessControl.get_subscription_days_remaining(request.user)

        signals = report.signals or []
        information_gaps = report.information_gaps or []
        suggestions = report.suggestions or []
        is_non_developer = self._infer_non_developer_context(report)

        suggestions = optimize_suggestions_for_report(
            suggestions,
            is_non_developer=is_non_developer,
        )

        if not information_gaps:
            information_gaps = ["No major information gaps identified."]

        if not suggestions:
            suggestions = [
                "Verify the License to Sell with DHSUD or the relevant regulator before making payments.",
                "Request and review certified true copies of title and ownership records.",
                "Confirm permit and zoning status directly with the local government unit.",
            ]

        report_payload = {
            "structure_version": report.structure_version,
            "total_score": report.total_score,
            "risk_band": report.risk_band,
        }

        if can_view_full:
            category_applicability = {
                "developer_legitimacy": not is_non_developer,
                "project_compliance": not is_non_developer,
                "title_land": True,
                "financial_exposure": True,
                "lgu_environment": True,
            }

            adjusted_total_score = calculate_final_score(
                report.category_breakdown or {},
                category_applicability,
            )
            adjusted_risk_band = determine_risk_band(adjusted_total_score, severe_override=False)

            report_payload.update({
                "category_breakdown": report.category_breakdown,
                "category_applicability": category_applicability,
                "category_interpretations": build_category_interpretations(
                    report.category_breakdown,
                    is_non_developer=is_non_developer,
                ),
                "license_to_sell_present": report.license_to_sell_present,
                "strengths": report.strengths,
                "signals": signals,
                "information_gaps": information_gaps,
                "suggestions": suggestions,
                "assessment_summary": report.assessment_summary,
                "total_score": adjusted_total_score,
                "risk_band": adjusted_risk_band,
            })

        response_payload = {
            "request_id": str(report.request_id),
            "timestamp_utc": report.timestamp_utc.isoformat(),
            "report": report_payload,
            "access": {
                "can_view_full_report": can_view_full,
                "credit_balance": ReportAccessControl.get_user_credit_balance(request.user),
                "subscription_active": bool(active_subscription),
                "subscription_days_remaining": subscription_days_remaining,
                "locked_sections": [] if can_view_full else ReportAccessControl.PAID_SECTIONS,
            },
            "context": {
                "project_name": report.project_name or "",
                "city": report.city or "",
                "location": report.location or "",
            },
        }

        return Response(response_payload, status=status.HTTP_200_OK)


class ListReportsView(APIView):

    def get(self, request):

        reports = (
            Report.objects
            .filter(user=request.user)
            .only("request_id", "timestamp_utc", "risk_band")
            .order_by("-timestamp_utc")
        )

        response_payload = []

        for report in reports:
            response_payload.append({
                "request_id": str(report.request_id),
                "timestamp_utc": report.timestamp_utc.isoformat(),
                "risk_band": report.risk_band,
            })

        return Response(response_payload, status=status.HTTP_200_OK)

class StartInterviewView(APIView):

    permission_classes = [AllowAny]

    def post(self, request):

          
        interview = InterviewSession.objects.create(
            user=None if not request.user.is_authenticated else request.user,
            interview_version="v1.1",
            responses={},
            status="draft"
        )

        serializer = InterviewSessionSerializer(interview)

        return Response(serializer.data, status=status.HTTP_201_CREATED)

class SaveInterviewView(APIView):

    permission_classes = [AllowAny]

    def patch(self, request, interview_id):

        interview = get_object_or_404(
            InterviewSession,
            id=interview_id,
            
        )

        if interview.status == InterviewStatus.SUBMITTED:
            return Response(
            {"error": "Interview already submitted"},
            status=status.HTTP_400_BAD_REQUEST
        )

        responses = request.data.get("responses")

        if responses is None:
            return Response(
                {"error": "responses field required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        interview.responses.update(responses)
        interview.save()

        serializer = InterviewSessionSerializer(interview)

        return Response(serializer.data, status=status.HTTP_200_OK)

class GetInterviewView(APIView):

    permission_classes = [AllowAny]

    def get(self, request, interview_id):

        interview = get_object_or_404(
            InterviewSession,
            id=interview_id,
            
        )

        serializer = InterviewSessionSerializer(interview)

        return Response(serializer.data, status=status.HTTP_200_OK)


class SubmitInterviewView(APIView):

    permission_classes = [AllowAny]

    from .views import EvaluateProjectView

    @staticmethod
    def _normalize_sale_mode(value):
        return str(value or "").strip().lower().replace("-", "_").replace(" ", "_")

    @staticmethod
    def _recover_existing_request_id(interview, user):
        if user is None or not getattr(user, "is_authenticated", False):
            return None

        answers = interview.responses or {}
        project_name = str(answers.get("q1") or "").strip()
        city = str(answers.get("q3") or "").strip()
        location = str(answers.get("q4") or "").strip()

        queryset = Report.objects.filter(user=user)

        if project_name or city or location:
            exact = queryset.filter(
                project_name=project_name,
                city=city,
                location=location,
            ).order_by("-created_at").first()
            if exact:
                return str(exact.request_id)

        nearest = queryset.filter(created_at__gte=interview.created_at).order_by("created_at").first()
        if nearest:
            return str(nearest.request_id)

        latest = queryset.order_by("-created_at").first()
        if latest:
            return str(latest.request_id)

        return None

    def post(self, request, interview_id):

        interview = get_object_or_404(
            InterviewSession,
            id=interview_id,
            
        )

        if interview.status == InterviewStatus.SUBMITTED:
            recovered_request_id = self._recover_existing_request_id(interview, request.user)
            if recovered_request_id:
                return Response(
                    {
                        "request_id": recovered_request_id,
                        "recovered": True,
                    },
                    status=status.HTTP_200_OK,
                )

            return Response(
                {"error": "Interview already submitted"},
                status=status.HTTP_400_BAD_REQUEST
            )

        answers = interview.responses

        answers = interview.responses

        if not answers:
            return Response(
                {"error": "Interview has no responses"},
                status=status.HTTP_400_BAD_REQUEST
            )

        sale_mode = self._normalize_sale_mode(answers.get("q6"))
        is_developer_project = sale_mode == "developer_project"

        required_questions = ["q11", "q12", "q13", "q14", "q15", "q16"]
        if is_developer_project:
            required_questions = ["q7", "q8", "q9", "q10", *required_questions]

        missing = [q for q in required_questions if q not in answers]

        if missing:
            return Response(
                {
                    "error": "Interview incomplete",
                    "missing_questions": missing
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        if not request.user.is_authenticated:
            category_scores = calculate_category_scores(answers)
            category_applicability = get_category_applicability(answers)
            final_score = calculate_final_score(category_scores, category_applicability)
            risk_band = classify_risk_band(final_score)

            teaser_request_id = str(uuid.uuid4())

            return Response(
                {
                    "request_id": teaser_request_id,
                    "preview": True,
                    "report": {
                        "total_score": final_score,
                        "risk_band": risk_band,
                    },
                    "context": {
                        "project_name": answers.get("q1", ""),
                        "city": answers.get("q3", ""),
                        "location": answers.get("q4", ""),
                    },
                },
                status=status.HTTP_200_OK,
            )

        payload = {
            "answers": answers
        }

        factory = APIRequestFactory()

        internal_request = factory.post(
            "/api/v1/evaluate/",
            payload,
            format="json",
            HTTP_AUTHORIZATION=request.META.get("HTTP_AUTHORIZATION")
        )

        internal_request.user = request.user

        response = EvaluateProjectView.as_view()(internal_request)

        if response.status_code == 200:
            interview.status = InterviewStatus.SUBMITTED
            if request.user.is_authenticated and interview.user_id is None:
                interview.user = request.user
            interview.save()

        return response






