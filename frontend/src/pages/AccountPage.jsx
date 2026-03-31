import { useState } from "react";
import { changePassword } from "../api/apiClient";

export default function AccountPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const payload = await changePassword(currentPassword, newPassword, confirmPassword);
      setMessage(payload?.message || "Password updated successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err?.message || "Unable to change password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: "560px" }}>
      <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#1a2332", marginBottom: "8px" }}>
        Account Settings
      </h1>
      <p style={{ fontSize: "14px", color: "#6b7280", marginBottom: "16px" }}>
        Update your password below.
      </p>

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: "12px" }}>
        <label style={{ display: "grid", gap: "6px" }}>
          <span style={{ fontSize: "13px", color: "#374151", fontWeight: 600 }}>Current password</span>
          <input
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            autoComplete="current-password"
            required
            style={{ border: "1px solid #d1d5db", borderRadius: "8px", padding: "10px 12px" }}
          />
        </label>

        <label style={{ display: "grid", gap: "6px" }}>
          <span style={{ fontSize: "13px", color: "#374151", fontWeight: 600 }}>New password</span>
          <input
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            autoComplete="new-password"
            required
            style={{ border: "1px solid #d1d5db", borderRadius: "8px", padding: "10px 12px" }}
          />
        </label>

        <label style={{ display: "grid", gap: "6px" }}>
          <span style={{ fontSize: "13px", color: "#374151", fontWeight: 600 }}>Confirm new password</span>
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete="new-password"
            required
            style={{ border: "1px solid #d1d5db", borderRadius: "8px", padding: "10px 12px" }}
          />
        </label>

        <p style={{ fontSize: "12px", color: "#6b7280", lineHeight: 1.5 }}>
          Min. 8 characters, at least 1 capital letter, 1 number, and 1 symbol.
        </p>

        {error && <p style={{ color: "#dc2626", fontSize: "13px" }}>{error}</p>}
        {message && <p style={{ color: "#166534", fontSize: "13px" }}>{message}</p>}

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "fit-content",
            padding: "10px 16px",
            backgroundColor: loading ? "#a0c4c1" : "#2b9f94",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            fontSize: "14px",
            fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Updating..." : "Update Password"}
        </button>
      </form>
    </div>
  );
}
