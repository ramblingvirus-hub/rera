import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { listReports, submitInterview } from "../api/apiClient";

const RISK_COLORS = {
  LOW_RISK: { color: "#16a34a", bg: "#f0fdf4" },
  MODERATE_RISK: { color: "#d97706", bg: "#fffbeb" },
  HIGH_RISK: { color: "#dc2626", bg: "#fef2f2" },
  SEVERE_RISK: { color: "#991b1b", bg: "#fef2f2" },
};

function RiskBadge({ band }) {
  const style = RISK_COLORS[band] || { color: "#6b7280", bg: "#f3f4f6" };
  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 10px",
        borderRadius: "999px",
        fontSize: "12px",
        fontWeight: 600,
        color: style.color,
        backgroundColor: style.bg,
        whiteSpace: "nowrap",
      }}
    >
      {band?.replace(/_/g, " ") || "—"}
    </span>
  );
}

export default function ReportsListPage() {
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [recovering, setRecovering] = useState(false);
  const [recoverMessage, setRecoverMessage] = useState("");

  const savedInterviewId = (() => {
    try {
      return localStorage.getItem("rera_interview_id") || "";
    } catch {
      return "";
    }
  })();

  useEffect(() => {
    async function fetchReports() {
      try {
        const data = await listReports();
        setReports(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err.message || "Failed to load reports");
      } finally {
        setLoading(false);
      }
    }
    fetchReports();
  }, []);

  if (loading) {
    return (
      <p style={{ fontSize: "14px", color: "#6b7280" }}>Loading reports…</p>
    );
  }

  if (error) {
    return (
      <p style={{ fontSize: "14px", color: "#dc2626" }}>{error}</p>
    );
  }

  async function handleRecoverTeaser() {
    if (!savedInterviewId) {
      setRecoverMessage("No recoverable teaser draft found in this browser.");
      return;
    }

    setRecovering(true);
    setRecoverMessage("");
    try {
      const result = await submitInterview(savedInterviewId);
      const nextRequestId = result?.request_id;
      if (!nextRequestId) {
        throw new Error("Recovery failed: no request id returned.");
      }
      localStorage.removeItem("rera_interview_id");
      navigate(`/report/${nextRequestId}`);
    } catch (err) {
      if (err?.status === 402) {
        setRecoverMessage("This draft is valid, but credits are required to finalize it. After payment approval, click recover again.");
      } else if (err?.message?.toLowerCase().includes("already submitted")) {
        setRecoverMessage("This draft was already submitted. Please open Reports and refresh.");
      } else {
        setRecoverMessage(err?.message || "Unable to recover teaser draft.");
      }
    } finally {
      setRecovering(false);
    }
  }

  return (
    <div style={{ maxWidth: "860px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
        }}
      >
        <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#1a2332" }}>
          Reports
        </h1>
        <button
          onClick={() => navigate("/new")}
          style={{
            padding: "9px 20px",
            backgroundColor: "#2b9f94",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            fontSize: "13.5px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          + New Evaluation
        </button>
      </div>

      {reports.length === 0 ? (
        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "12px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
            padding: "48px 40px",
            textAlign: "center",
            color: "#6b7280",
          }}
        >
          <p style={{ fontSize: "15px", marginBottom: "16px" }}>
            No evaluations yet.
          </p>
          {savedInterviewId && (
            <div style={{ marginBottom: "14px" }}>
              <button
                onClick={handleRecoverTeaser}
                disabled={recovering}
                style={{
                  padding: "10px 22px",
                  backgroundColor: "#0f766e",
                  color: "#fff",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: recovering ? "not-allowed" : "pointer",
                  opacity: recovering ? 0.7 : 1,
                }}
              >
                {recovering ? "Recovering..." : "Recover My Last Teaser Report"}
              </button>
              {recoverMessage && (
                <p style={{ marginTop: "10px", fontSize: "12px", color: "#475569" }}>
                  {recoverMessage}
                </p>
              )}
            </div>
          )}
          <button
            onClick={() => navigate("/new")}
            style={{
              padding: "10px 22px",
              backgroundColor: "#2b9f94",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Start Your First Evaluation
          </button>
        </div>
      ) : (
        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "12px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
            overflow: "hidden",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr
                style={{
                  backgroundColor: "#f9fafb",
                  borderBottom: "1px solid #e5e7eb",
                }}
              >
                <th
                  style={{
                    textAlign: "left",
                    padding: "12px 20px",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "#6b7280",
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                  }}
                >
                  Date
                </th>
                <th
                  style={{
                    textAlign: "left",
                    padding: "12px 20px",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "#6b7280",
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                  }}
                >
                  Risk Band
                </th>
                <th
                  style={{
                    textAlign: "right",
                    padding: "12px 20px",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "#6b7280",
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                  }}
                >
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r, i) => (
                <tr
                  key={r.request_id}
                  style={{
                    borderBottom:
                      i < reports.length - 1 ? "1px solid #f3f4f6" : "none",
                    cursor: "pointer",
                  }}
                  onClick={() => navigate(`/report/${r.request_id}`)}
                >
                  <td
                    style={{
                      padding: "14px 20px",
                      fontSize: "13.5px",
                      color: "#374151",
                    }}
                  >
                    {r.timestamp_utc
                      ? new Date(r.timestamp_utc).toLocaleDateString("en-PH", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })
                      : "—"}
                  </td>
                  <td style={{ padding: "14px 20px" }}>
                    <RiskBadge band={r.risk_band} />
                  </td>
                  <td
                    style={{
                      padding: "14px 20px",
                      textAlign: "right",
                      fontSize: "13px",
                      color: "#2b9f94",
                      fontWeight: 500,
                    }}
                  >
                    View →
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
