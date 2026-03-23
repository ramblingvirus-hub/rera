import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  getQuestionsForContext,
  PRIVATE_SALE_SUPPLEMENTAL_QUESTION_IDS,
  getContextProfile,
} from "../interview/questions";
import QuestionRenderer from "../interview/QuestionRenderer";
import {
  startInterview as startInterviewRequest,
  getInterview as getInterviewRequest,
  saveInterview as saveInterviewRequest,
  submitInterview,
} from "../api/apiClient";

const BTN_PRIMARY = {
  padding: "10px 22px",
  backgroundColor: "#2b9f94",
  color: "#ffffff",
  border: "none",
  borderRadius: "8px",
  fontSize: "14px",
  fontWeight: 600,
  cursor: "pointer",
};

const BTN_SECONDARY = {
  padding: "10px 22px",
  backgroundColor: "#ffffff",
  color: "#374151",
  border: "1px solid #d1d5db",
  borderRadius: "8px",
  fontSize: "14px",
  fontWeight: 500,
  cursor: "pointer",
};

export default function InterviewPage() {
  const navigate = useNavigate();

  const [interview, setInterview] = useState(null);
  const [responses, setResponses] = useState({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [reviewMode, setReviewMode] = useState(false);
  const [flowMessage, setFlowMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const interviewQuestions = getQuestionsForContext(responses);
  const currentQuestion = interviewQuestions[currentIndex];
  const contextProfile = getContextProfile(responses);
  const hasSaleModeAnswer = Boolean(responses.q6);
  const saveTimer = useRef(null);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  async function handleStartNew() {
    // Clear any saved interview and start fresh
    localStorage.removeItem("rera_interview_id");
    setInterview(null);
    setResponses({});
    setCurrentIndex(0);
    setReviewMode(false);
    setFlowMessage("");
    try {
      const data = await startInterviewRequest();
      const id = data.id || data.interview_id;
      localStorage.setItem("rera_interview_id", id);
      await loadInterview(id);
    } catch (error) {
      setFlowMessage(error.message || "Failed to start evaluation");
    }
  }

  async function loadInterview(id) {
    try {
      const data = await getInterviewRequest(id);
      setInterview(data);
      setResponses(data.responses || {});
      setFlowMessage("");
    } catch (error) {
      setFlowMessage(error.message || "Failed to load evaluation");
    }
  }

  async function saveInterview(id, nextResponses) {
    try {
      await saveInterviewRequest(id, nextResponses);
    } catch {
      // Autosave errors are surfaced only when user takes explicit actions.
    }
  }

  function handleAnswerChange(questionId, value) {
    let updated = { ...responses, [questionId]: value };

    if (
      questionId === "q6" &&
      getContextProfile({ ...updated, q6: value }) !== "private_sale"
    ) {
      // Keep response payload consistent with visible questions.
      PRIVATE_SALE_SUPPLEMENTAL_QUESTION_IDS.forEach((id) => {
        delete updated[id];
      });
    }

    setResponses(updated);

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      if (!interview?.id) return;
      saveInterview(interview.id, updated);
    }, 300);
  }

  useEffect(() => {
    if (currentIndex > interviewQuestions.length - 1) {
      setCurrentIndex(Math.max(interviewQuestions.length - 1, 0));
    }
  }, [currentIndex, interviewQuestions.length]);

  async function handleSubmit() {
    if (!interview?.id) return;
    setIsSubmitting(true);
    setFlowMessage("");

    try {
      const result = await submitInterview(interview.id);
      const requestId = result?.request_id;
      if (!requestId) throw new Error("Submission succeeded but no request_id was returned.");

      const anonymousPreview = Boolean(result?.preview);
      if (!anonymousPreview) {
        localStorage.removeItem("rera_interview_id");
      }

      navigate(`/report/${requestId}`, {
        state: {
          submittedReport: result?.report || null,
          submittedContext: result?.context || null,
          anonymousPreview,
          interviewId: interview.id,
        },
      });
    } catch (error) {
      setFlowMessage(error.message || "Failed to submit evaluation");
    } finally {
      setIsSubmitting(false);
    }
  }

  const progressPct = interviewQuestions.length
    ? ((currentIndex + 1) / interviewQuestions.length) * 100
    : 0;

  // ── Not started ──
  if (!interview) {
    return (
      <div style={{ maxWidth: "680px" }}>
        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "12px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
            padding: "36px 40px",
          }}
        >
          <h1
            style={{
              fontSize: "22px",
              fontWeight: 700,
              color: "#1a2332",
              marginBottom: "10px",
            }}
          >
            New Evaluation
          </h1>
          <p
            style={{
              fontSize: "14px",
              color: "#6b7280",
              marginBottom: "28px",
              lineHeight: "1.6",
            }}
          >
            Answer a short series of questions about the property and developer.
            RERA will generate a risk assessment report based on your responses.
          </p>
          <button style={BTN_PRIMARY} onClick={handleStartNew}>
            Start Evaluation
          </button>
          {flowMessage && (
            <p style={{ color: "#dc2626", fontSize: "13px", marginTop: "16px" }}>
              {flowMessage}
            </p>
          )}
        </div>
      </div>
    );
  }

  // ── Review mode ──
  if (reviewMode) {
    return (
      <div style={{ maxWidth: "720px" }}>
        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "12px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
            padding: "32px 36px",
            marginBottom: "20px",
          }}
        >
          <h2
            style={{
              fontSize: "18px",
              fontWeight: 700,
              color: "#1a2332",
              marginBottom: "20px",
            }}
          >
            Review Your Answers
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {interviewQuestions.map((q) => (
              <div
                key={q.id}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "3px",
                  paddingBottom: "14px",
                  borderBottom: "1px solid #f3f4f6",
                }}
              >
                <span
                  style={{ fontSize: "13px", color: "#6b7280", fontWeight: 500 }}
                >
                  {q.section || "General"}
                </span>
                <span
                  style={{ fontSize: "14px", color: "#1a2332", fontWeight: 500 }}
                >
                  {q.label}
                </span>
                <span
                  style={{
                    fontSize: "14px",
                    color: responses[q.id] ? "#1a2332" : "#9ca3af",
                  }}
                >
                  {responses[q.id] || "Not answered"}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <button style={BTN_SECONDARY} onClick={() => setReviewMode(false)}>
            ← Edit Answers
          </button>
          <button
            style={{
              ...BTN_PRIMARY,
              opacity: isSubmitting ? 0.7 : 1,
              cursor: isSubmitting ? "not-allowed" : "pointer",
            }}
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Submitting…" : "Run Evaluation →"}
          </button>
        </div>

        {flowMessage && (
          <p
            style={{
              color: "#dc2626",
              fontSize: "13px",
              marginTop: "14px",
            }}
          >
            {flowMessage}
          </p>
        )}
      </div>
    );
  }

  // ── Question mode ──
  return (
    <div style={{ maxWidth: "680px" }}>
      {/* Header bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "6px",
        }}
      >
        <span
          style={{
            fontSize: "12px",
            fontWeight: 600,
            letterSpacing: "0.06em",
            color: "#2b9f94",
            textTransform: "uppercase",
          }}
        >
          {currentQuestion?.section || "Interview"}
        </span>
        <span style={{ fontSize: "13px", color: "#9ca3af" }}>
          {currentIndex + 1} / {interviewQuestions.length}
        </span>
      </div>

      {hasSaleModeAnswer && (
        <div
          style={{
            fontSize: "12.5px",
            color: contextProfile === "private_sale" ? "#2b9f94" : "#1d4ed8",
            backgroundColor:
              contextProfile === "private_sale" ? "#ecfdfb" : "#eff6ff",
            border:
              contextProfile === "private_sale"
                ? "1px solid #99f6e4"
                : "1px solid #bfdbfe",
            borderRadius: "8px",
            padding: "8px 10px",
            marginBottom: "12px",
            lineHeight: "1.5",
          }}
        >
          {contextProfile === "private_sale"
            ? "Private Sale context active: additional ownership and transfer verification questions are enabled."
            : "Developer/Broker context active: standard regulatory and compliance interpretation is applied."}
        </div>
      )}

      {/* Progress bar */}
      <div
        style={{
          height: "4px",
          backgroundColor: "#e5e7eb",
          borderRadius: "2px",
          marginBottom: "20px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${progressPct}%`,
            height: "100%",
            backgroundColor: "#2b9f94",
            borderRadius: "2px",
            transition: "width 0.2s ease",
          }}
        />
      </div>

      {/* Question card */}
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "12px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
          padding: "30px 32px",
          marginBottom: "20px",
        }}
      >
        <QuestionRenderer
          key={currentQuestion.id}
          question={currentQuestion}
          value={responses[currentQuestion.id] || ""}
          onChange={handleAnswerChange}
        />
      </div>

      {/* Navigation */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        {currentIndex > 0 ? (
          <button
            style={BTN_SECONDARY}
            onClick={() => setCurrentIndex(currentIndex - 1)}
          >
            ← Back
          </button>
        ) : (
          <div />
        )}

        <button
          style={BTN_PRIMARY}
          onClick={() => {
            if (currentIndex === interviewQuestions.length - 1) {
              setReviewMode(true);
            } else {
              setCurrentIndex(currentIndex + 1);
            }
          }}
        >
          {currentIndex === interviewQuestions.length - 1 ? "Review Answers →" : "Next →"}
        </button>
      </div>
    </div>
  );
}
