import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const navigate = useNavigate();

  return (
    <div style={{ maxWidth: "800px" }}>
      <h1
        style={{
          fontSize: "22px",
          fontWeight: 700,
          color: "#1a2332",
          marginBottom: "6px",
        }}
      >
        Dashboard
      </h1>
      <p
        style={{
          fontSize: "14px",
          color: "#6b7280",
          marginBottom: "28px",
        }}
      >
        Welcome to RERA — Real Estate Risk Assessment.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "16px",
          marginBottom: "28px",
        }}
      >
        {/* Quick-action card */}
        <div
          style={{
            backgroundColor: "#2b9f94",
            borderRadius: "12px",
            padding: "24px",
            color: "#fff",
          }}
        >
          <div
            style={{
              fontSize: "13px",
              fontWeight: 600,
              marginBottom: "8px",
              opacity: 0.85,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            New Evaluation
          </div>
          <p style={{ fontSize: "14px", opacity: 0.9, marginBottom: "18px", lineHeight: "1.5" }}>
            Assess the risk profile of a Philippine real estate project.
          </p>
          <button
            onClick={() => navigate("/new")}
            style={{
              padding: "9px 18px",
              backgroundColor: "#ffffff",
              color: "#2b9f94",
              border: "none",
              borderRadius: "8px",
              fontSize: "13.5px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Start Evaluation
          </button>
        </div>

        {/* Reports card */}
        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "12px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
            padding: "24px",
          }}
        >
          <div
            style={{
              fontSize: "13px",
              fontWeight: 600,
              color: "#9ca3af",
              marginBottom: "8px",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            Your Reports
          </div>
          <p
            style={{
              fontSize: "14px",
              color: "#6b7280",
              marginBottom: "18px",
              lineHeight: "1.5",
            }}
          >
            View all past evaluations and their risk assessments.
          </p>
          <button
            onClick={() => navigate("/reports")}
            style={{
              padding: "9px 18px",
              backgroundColor: "transparent",
              color: "#2b9f94",
              border: "1px solid #2b9f94",
              borderRadius: "8px",
              fontSize: "13.5px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            View Reports
          </button>
        </div>

        {/* Billing card */}
        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "12px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
            padding: "24px",
          }}
        >
          <div
            style={{
              fontSize: "13px",
              fontWeight: 600,
              color: "#9ca3af",
              marginBottom: "8px",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            Billing
          </div>
          <p
            style={{
              fontSize: "14px",
              color: "#6b7280",
              marginBottom: "18px",
              lineHeight: "1.5",
            }}
          >
            Buy credits and manage your subscription in one place.
          </p>
          <button
            onClick={() => navigate("/billing")}
            style={{
              padding: "9px 18px",
              backgroundColor: "transparent",
              color: "#2b9f94",
              border: "1px solid #2b9f94",
              borderRadius: "8px",
              fontSize: "13.5px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Buy Credits
          </button>
        </div>
      </div>
    </div>
  );
}