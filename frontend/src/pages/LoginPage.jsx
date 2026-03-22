import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { login } from "../api/apiClient";
import { resolveRedirectTarget } from "../utils/navigation";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(username, password);
      navigate(resolveRedirectTarget(location.state, "/dashboard"), {
        replace: true,
      });
    } catch (err) {
      setError(err.message || "Login failed. Check your credentials.");
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
        {/* Logo */}
        <div style={{ marginBottom: "30px" }}>
          <img
            src="/rera-logo.png"
            alt="RERA"
            style={{ height: "40px", width: "auto", display: "block" }}
          />
        </div>

        <h1
          style={{
            fontSize: "21px",
            fontWeight: 700,
            color: "#1a2332",
            marginBottom: "6px",
          }}
        >
          Sign in
        </h1>
        <p
          style={{
            fontSize: "14px",
            color: "#6b7280",
            marginBottom: "26px",
          }}
        >
          Enter your credentials to access your account.
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "16px" }}>
            <label
              htmlFor="login_username"
              style={{
                display: "block",
                fontSize: "13px",
                fontWeight: 500,
                color: "#374151",
                marginBottom: "6px",
              }}
            >
              Username
            </label>
            <input
              id="login_username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
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
              htmlFor="login_password"
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
            <input
              id="login_password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
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
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
