import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { register, login } from "../api/apiClient";
import { resolveRedirectTarget } from "../utils/navigation";

export default function RegisterPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function validatePassword(pw) {
    if (pw.length < 8) return "Password must be at least 8 characters.";
    if (!/[A-Z]/.test(pw)) return "Password must contain at least one capital letter.";
    if (!/[0-9]/.test(pw)) return "Password must contain at least one number.";
    if (!/[^A-Za-z0-9]/.test(pw)) return "Password must contain at least one symbol (e.g. @, #, !, $).";
    return null;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    const pwError = validatePassword(password);
    if (pwError) {
      setError(pwError);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await register(username, email, password, confirmPassword);
      await login(username, password);

      const pendingPackage = location.state?.pendingPackage;

      // PayMongo is disabled — send users with a pending purchase to billing
      if (pendingPackage) {
        navigate("/billing", { replace: true });
        return;
      }

      navigate(resolveRedirectTarget(location.state, "/dashboard"), {
        replace: true,
      });
    } catch (err) {
      setError(err.message || "Registration failed. Please try again.");
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
          padding: "40px 44px",
          width: "100%",
          maxWidth: "400px",
        }}
      >
        <div style={{ marginBottom: "30px", display: "flex", alignItems: "center", gap: "12px" }}>
          <img
            src="/rera-logo.png"
            alt="RERA"
            style={{ height: "52px", width: "auto", display: "block" }}
          />
          <span
            style={{
              borderRadius: "999px",
              padding: "4px 10px",
              backgroundColor: "#ccfbf1",
              color: "#115e59",
              fontSize: "10px",
              fontWeight: 800,
              letterSpacing: "0.16em",
            }}
          >
            BETA
          </span>
        </div>

        <h1
          style={{
            fontSize: "21px",
            fontWeight: 700,
            color: "#1a2332",
            marginBottom: "6px",
          }}
        >
          Create an account
        </h1>
        <p
          style={{
            fontSize: "14px",
            color: "#6b7280",
            marginBottom: "26px",
          }}
        >
          Enter your email address and choose a password.
        </p>

        <div
          style={{
            marginBottom: "18px",
            padding: "10px 12px",
            borderRadius: "8px",
            border: "1px solid #fed7aa",
            backgroundColor: "#fff7ed",
            color: "#9a3412",
            fontSize: "12px",
            fontWeight: 600,
          }}
        >
          Disclaimer: RERA provides structured risk indicators and not legal or financial advice.
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "16px" }}>
            <label
              htmlFor="reg_username"
              style={{
                display: "block",
                fontSize: "13px",
                fontWeight: 500,
                color: "#374151",
                marginBottom: "6px",
              }}
            >
              Login name
            </label>
            <input
              id="reg_username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
              placeholder="choose a username"
              style={{
                width: "100%",
                padding: "10px 13px",
                border: "1px solid #d1d5db",
                borderRadius: "8px",
                fontSize: "14px",
                color: "#1a2332",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label
              htmlFor="reg_email"
              style={{
                display: "block",
                fontSize: "13px",
                fontWeight: 500,
                color: "#374151",
                marginBottom: "6px",
              }}
            >
              Email address
            </label>
            <input
              id="reg_email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label
              htmlFor="reg_password"
              style={{
                display: "block",
                fontSize: "13px",
                fontWeight: 500,
                color: "#374151",
                marginBottom: "6px",
              }}
            >
              Password
            </label>
            <p style={{ fontSize: "12px", color: "#6b7280", marginBottom: "6px", lineHeight: 1.5 }}>
              Min. 8 characters · 1 capital letter · 1 number · 1 symbol
            </p>
            <input
              id="reg_password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              style={{
                width: "100%",
                padding: "10px 13px",
                border: "1px solid #d1d5db",
                borderRadius: "8px",
                fontSize: "14px",
                color: "#1a2332",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ marginBottom: "22px" }}>
            <label
              htmlFor="reg_confirm"
              style={{
                display: "block",
                fontSize: "13px",
                fontWeight: 500,
                color: "#374151",
                marginBottom: "6px",
              }}
            >
              Confirm password
            </label>
            <input
              id="reg_confirm"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
              style={{
                width: "100%",
                padding: "10px 13px",
                border: "1px solid #d1d5db",
                borderRadius: "8px",
                fontSize: "14px",
                color: "#1a2332",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {error && (
            <p
              style={{
                color: "#dc2626",
                fontSize: "13px",
                marginBottom: "16px",
                lineHeight: "1.4",
              }}
            >
              {error}
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
              transition: "background-color 0.15s",
            }}
          >
            {loading ? "Creating account…" : "Create Account"}
          </button>

          <p
            style={{
              marginTop: "18px",
              textAlign: "center",
              fontSize: "13px",
              color: "#6b7280",
            }}
          >
            Already have an account?{" "}
            <Link
              to="/login"
              state={location.state}
              style={{ color: "#0f766e", fontWeight: 600 }}
            >
              Sign in
            </Link>
          </p>

          <div
            style={{
              marginTop: "14px",
              textAlign: "center",
              fontSize: "12px",
              color: "#6b7280",
              lineHeight: 1.6,
            }}
          >
            <Link to="/privacy-policy" style={{ color: "#0f766e" }}>
              Privacy Policy
            </Link>
            <span style={{ margin: "0 8px" }}>•</span>
            <Link to="/terms-of-service" style={{ color: "#0f766e" }}>
              Terms of Service
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
