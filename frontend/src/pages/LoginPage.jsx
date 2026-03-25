import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { login, register, initiateCreditPurchase } from "../api/apiClient";
import { resolveRedirectTarget } from "../utils/navigation";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState("signin");
  const [username, setUsername] = useState("");
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
    setLoading(true);

    try {
      if (mode === "register") {
        const pwError = validatePassword(password);
        if (pwError) {
          setError(pwError);
          return;
        }

        if (password !== confirmPassword) {
          setError("Passwords do not match.");
          return;
        }

        await register(username, password, confirmPassword);
      }

      await login(username, password);

      const pendingPackage = location.state?.pendingPackage;
      const from = location.state?.from || "/dashboard";

      if (pendingPackage) {
        const origin = window.location.origin;
        const cancelUrl = `${origin}${from}`;
        const successBase = new URL(from, origin);
        successBase.searchParams.set("payment", "success");
        const data = await initiateCreditPurchase(pendingPackage, {
          successUrl: successBase.toString(),
          cancelUrl,
        });
        if (data?.checkout_url) {
          window.location.assign(data.checkout_url);
          return;
        }
      }

      navigate(resolveRedirectTarget(location.state, "/dashboard"), {
        replace: true,
      });
    } catch (err) {
      if (mode === "signin") {
        setError(
          err.message ||
            "No active account found with the given credentials. Use Register if this is a new email."
        );
      } else {
        setError(err.message || "Registration failed. Please try again.");
      }
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
          Sign In / Register
        </h1>
        <p
          style={{
            fontSize: "14px",
            color: "#6b7280",
            marginBottom: "26px",
          }}
        >
          Sign in if you already have an account, or register if you are new.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            backgroundColor: "#f3f4f6",
            borderRadius: "8px",
            padding: "3px",
            marginBottom: "18px",
          }}
        >
          <button
            type="button"
            onClick={() => {
              setMode("signin");
              setError("");
            }}
            style={{
              padding: "8px 10px",
              borderRadius: "6px",
              border: "none",
              backgroundColor: mode === "signin" ? "#ffffff" : "transparent",
              color: "#1a2332",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("register");
              setError("");
            }}
            style={{
              padding: "8px 10px",
              borderRadius: "6px",
              border: "none",
              backgroundColor: mode === "register" ? "#ffffff" : "transparent",
              color: "#1a2332",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Register
          </button>
        </div>

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
              Email address
            </label>
            <input
              id="login_username"
              type="email"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
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

          {mode === "register" && (
            <>
              <p style={{ fontSize: "12px", color: "#6b7280", marginBottom: "6px", lineHeight: 1.5 }}>
                Min. 8 characters · 1 capital letter · 1 number · 1 symbol
              </p>
              <div style={{ marginBottom: "22px" }}>
                <label
                  htmlFor="login_confirm_password"
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
                  id="login_confirm_password"
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
            </>
          )}

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
            {loading
              ? mode === "register"
                ? "Creating account…"
                : "Signing in…"
              : mode === "register"
                ? "Create Account"
                : "Sign In"}
          </button>

          <p
            style={{
              marginTop: "18px",
              textAlign: "center",
              fontSize: "13px",
              color: "#6b7280",
            }}
          >
            {mode === "signin" ? "New here? Select Register above." : "Already have an account? Select Sign In above."}
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
