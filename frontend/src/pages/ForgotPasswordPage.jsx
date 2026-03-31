import { useState } from "react";
import { Link } from "react-router-dom";
import { forgotPassword } from "../api/apiClient";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const payload = await forgotPassword(email);
      setMessage(payload?.message || "If an account with that email exists, a reset link has been sent.");
    } catch (err) {
      setError(err?.message || "Unable to start password reset.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#f4f6f9",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "14px",
          boxShadow: "0 4px 20px rgba(0,0,0,0.09)",
          padding: "36px 40px",
          width: "100%",
          maxWidth: "420px",
        }}
      >
        <h1 style={{ fontSize: "21px", fontWeight: 700, color: "#1a2332", marginBottom: "8px" }}>
          Forgot Password
        </h1>
        <p style={{ fontSize: "14px", color: "#6b7280", marginBottom: "22px" }}>
          Enter your account email and we will send a password reset link.
        </p>

        <form onSubmit={handleSubmit}>
          <label
            htmlFor="forgot_email"
            style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "#374151", marginBottom: "6px" }}
          >
            Email address
          </label>
          <input
            id="forgot_email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoComplete="email"
            placeholder="you@example.com"
            style={{
              width: "100%",
              padding: "10px 13px",
              border: "1px solid #d1d5db",
              borderRadius: "8px",
              fontSize: "14px",
              color: "#1a2332",
              marginBottom: "16px",
              boxSizing: "border-box",
            }}
          />

          {error && (
            <p style={{ color: "#dc2626", fontSize: "13px", marginBottom: "12px" }}>
              {error}
            </p>
          )}

          {message && (
            <p style={{ color: "#166534", fontSize: "13px", marginBottom: "12px" }}>
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "11px",
              backgroundColor: loading ? "#a0c4c1" : "#2b9f94",
              color: "#ffffff",
              border: "none",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Sending..." : "Send Reset Link"}
          </button>

          <p style={{ marginTop: "14px", textAlign: "center", fontSize: "13px", color: "#6b7280" }}>
            <Link to="/login" style={{ color: "#0f766e" }}>
              Back to Sign In
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
