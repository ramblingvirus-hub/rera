import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { submitContactMessage } from "../api/apiClient";

const CATEGORY_OPTIONS = [
  { value: "GENERAL", label: "General Question" },
  { value: "REPORT_INQUIRY", label: "Report Inquiry" },
  { value: "PAYMENT_CONCERN", label: "Payment Concern" },
  { value: "SUGGESTION", label: "Suggestion / Feedback" },
  { value: "TECHNICAL_ISSUE", label: "Technical Issue" },
];

const INITIAL_FORM = {
  name: "",
  email: "",
  category: "GENERAL",
  subject: "",
  message: "",
  request_id: "",
};

export default function ContactPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  function handleBack() {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate("/");
  }

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  useEffect(() => {
    if (!successMessage) return;
    const t = setTimeout(() => setSuccessMessage(""), 5000);
    return () => clearTimeout(t);
  }, [successMessage]);

  useEffect(() => {
    if (!errorMessage) return;
    const t = setTimeout(() => setErrorMessage(""), 5000);
    return () => clearTimeout(t);
  }, [errorMessage]);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setSuccessMessage("");
    setErrorMessage("");

    try {
      await submitContactMessage({
        name: form.name.trim(),
        email: form.email.trim(),
        category: form.category,
        subject: form.subject.trim(),
        message: form.message.trim(),
        request_id: form.request_id.trim() || null,
      });
      setSuccessMessage("Message received. Our team will review your inquiry.");
      setForm(INITIAL_FORM);
    } catch {
      setErrorMessage("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(145deg, #f0fdfa 0%, #ecfeff 45%, #f8fafc 100%)",
        padding: "40px 16px",
      }}
    >
      <div
        style={{
          maxWidth: "760px",
          margin: "0 auto",
          backgroundColor: "#ffffff",
          border: "1px solid #dbeafe",
          borderRadius: "18px",
          boxShadow: "0 20px 45px rgba(15, 23, 42, 0.07)",
          padding: "28px",
        }}
      >
        <button
          type="button"
          onClick={handleBack}
          style={{
            marginBottom: "14px",
            backgroundColor: "transparent",
            color: "#0f766e",
            border: "1px solid #99f6e4",
            borderRadius: "10px",
            fontWeight: 700,
            padding: "8px 12px",
            cursor: "pointer",
          }}
        >
          Back
        </button>

        <h1 style={{ fontSize: "30px", lineHeight: 1.2, marginBottom: "10px", color: "#0f172a", fontWeight: 800 }}>
          Contact RERA
        </h1>
        <p style={{ color: "#334155", fontSize: "15px", marginBottom: "22px" }}>
          Have a question, suggestion, or need assistance? Send us a message and we will review it as soon as possible.
        </p>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: "14px" }}>
          <label style={{ display: "grid", gap: "6px" }}>
            <span style={{ fontSize: "13px", fontWeight: 700, color: "#334155" }}>Category</span>
            <select
              name="category"
              value={form.category}
              onChange={handleChange}
              required
              style={{ border: "1px solid #cbd5e1", borderRadius: "10px", padding: "10px 12px" }}
            >
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: "6px" }}>
            <span style={{ fontSize: "13px", fontWeight: 700, color: "#334155" }}>Name (optional)</span>
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              style={{ border: "1px solid #cbd5e1", borderRadius: "10px", padding: "10px 12px" }}
            />
          </label>

          <label style={{ display: "grid", gap: "6px" }}>
            <span style={{ fontSize: "13px", fontWeight: 700, color: "#334155" }}>Email</span>
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              required
              style={{ border: "1px solid #cbd5e1", borderRadius: "10px", padding: "10px 12px" }}
            />
          </label>

          <label style={{ display: "grid", gap: "6px" }}>
            <span style={{ fontSize: "13px", fontWeight: 700, color: "#334155" }}>Subject</span>
            <input
              name="subject"
              value={form.subject}
              onChange={handleChange}
              required
              minLength={5}
              style={{ border: "1px solid #cbd5e1", borderRadius: "10px", padding: "10px 12px" }}
            />
          </label>

          <label style={{ display: "grid", gap: "6px" }}>
            <span style={{ fontSize: "13px", fontWeight: 700, color: "#334155" }}>Request ID (optional)</span>
            <input
              name="request_id"
              value={form.request_id}
              onChange={handleChange}
              placeholder="e.g. 2a924d24-xxxx..."
              style={{ border: "1px solid #cbd5e1", borderRadius: "10px", padding: "10px 12px" }}
            />
          </label>

          <label style={{ display: "grid", gap: "6px" }}>
            <span style={{ fontSize: "13px", fontWeight: 700, color: "#334155" }}>Message</span>
            <textarea
              name="message"
              value={form.message}
              onChange={handleChange}
              required
              minLength={10}
              rows={6}
              style={{ border: "1px solid #cbd5e1", borderRadius: "10px", padding: "10px 12px", resize: "vertical" }}
            />
          </label>

          <button
            type="submit"
            disabled={submitting}
            style={{
              marginTop: "4px",
              backgroundColor: submitting ? "#94a3b8" : "#0f766e",
              color: "#ffffff",
              border: "none",
              borderRadius: "10px",
              fontWeight: 700,
              padding: "11px 14px",
              cursor: submitting ? "not-allowed" : "pointer",
            }}
          >
            {submitting ? "Sending..." : "Send Message"}
          </button>
        </form>

        {successMessage && (
          <div style={{ marginTop: "14px", color: "#166534", backgroundColor: "#dcfce7", borderRadius: "10px", padding: "10px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>{successMessage}</span>
            <button onClick={() => setSuccessMessage("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#166534", fontWeight: 700, fontSize: "16px", lineHeight: 1, padding: "0 0 0 12px" }}>✕</button>
          </div>
        )}

        {errorMessage && (
          <div style={{ marginTop: "14px", color: "#991b1b", backgroundColor: "#fee2e2", borderRadius: "10px", padding: "10px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>{errorMessage}</span>
            <button onClick={() => setErrorMessage("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#991b1b", fontWeight: 700, fontSize: "16px", lineHeight: 1, padding: "0 0 0 12px" }}>✕</button>
          </div>
        )}

        <p style={{ marginTop: "16px", fontSize: "12px", color: "#64748b" }}>
          We typically respond within 24-48 hours. For payment-related concerns, include your reference number for faster review.
        </p>
      </div>
    </div>
  );
}
