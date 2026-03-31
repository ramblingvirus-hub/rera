import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { resetPassword } from "../api/apiClient";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const uid = useMemo(() => (searchParams.get("uid") || "").trim(), [searchParams]);
  const token = useMemo(() => (searchParams.get("token") || "").trim(), [searchParams]);

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const payload = await resetPassword(uid, token, password, confirmPassword);
      setMessage(payload?.message || "Password has been reset successfully.");
      setPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err?.message || "Unable to reset password.");
    } finally {
      setLoading(false);
    }
  }

  if (!uid || !token) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", backgroundColor: "#f4f6f9", padding: "24px" }}>
        <div style={{ maxWidth: "460px", background: "#fff", borderRadius: "12px", padding: "28px", boxShadow: "0 4px 20px rgba(0,0,0,0.09)" }}>
          <h1 style={{ fontSize: "21px", fontWeight: 700, color: "#1a2332", marginBottom: "8px" }}>Invalid Reset Link</h1>
          <p style={{ fontSize: "14px", color: "#6b7280", marginBottom: "14px" }}>
            This password reset link is missing required parameters.
          </p>
          <Link to="/forgot-password" style={{ color: "#0f766e", fontSize: "14px", fontWeight: 600 }}>
            Request a new reset link
          </Link>
        </div>
      </div>
    );
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
          Reset Password
        </h1>
        <p style={{ fontSize: "14px", color: "#6b7280", marginBottom: "22px" }}>
          Set a new password for your account.
        </p>

        <form onSubmit={handleSubmit}>
          <label
            htmlFor="reset_password"
            style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "#374151", marginBottom: "6px" }}
          >
            New password
          </label>
          <input
            id="reset_password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            autoComplete="new-password"
            style={{
              width: "100%",
              padding: "10px 13px",
              border: "1px solid #d1d5db",
              borderRadius: "8px",
              fontSize: "14px",
              color: "#1a2332",
              marginBottom: "12px",
              boxSizing: "border-box",
            }}
          />

          <label
            htmlFor="reset_confirm_password"
            style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "#374151", marginBottom: "6px" }}
          >
            Confirm new password
          </label>
          <input
            id="reset_confirm_password"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
            autoComplete="new-password"
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
            {loading ? "Resetting..." : "Reset Password"}
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
