import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  getReport,
  listReports,
  getCreditBalance,
  initiateCreditPurchase,
  confirmCreditPurchase,
  activateSubscription,
  login,
  isAuthenticated,
} from "../api/apiClient";

const CREDIT_PACKAGE_OPTIONS = [
  { value: "single", label: "1 credit — PHP 550" },
  { value: "bundle_3", label: "3 credits — PHP 1,500" },
  { value: "bundle_5", label: "5 credits — PHP 2,000" },
];

const LOCKED_SECTION_LABELS = {
  category_breakdown: "Category Breakdown",
  category_interpretations: "Category Interpretation",
  assessment_summary: "Assessment Summary",
  strengths: "Strength Indicators",
  signals: "Key Risk Signals",
  information_gaps: "Information Gaps",
  suggestions: "Recommended Next Steps",
};

const LOCKED_SECTION_PREVIEW_LINES = {
  category_breakdown: [
    "Developer Legitimacy: 64.5",
    "Project Compliance: 52.0",
    "Title & Land: 58.5",
    "Financial Exposure: 47.0",
    "LGU & Environmental: 61.0",
  ],
  signals: [
    "License to sell not clearly verifiable",
    "Development permit evidence appears incomplete",
    "Early deposit requested before full disclosure",
  ],
  information_gaps: [
    "No complete title chain copy was attached",
    "Environmental clearance document was not provided",
    "LGU zoning verification record is missing",
  ],
  suggestions: [
    "Request certified true copies before payment commitment",
    "Validate permit numbers directly with issuing agencies",
    "Seek independent legal review of land title history",
  ],
};

const RISK_STYLE = {
  LOW_RISK:      { color: "#16a34a", bg: "#f0fdf4", label: "Lower Risk" },
  MODERATE_RISK: { color: "#d97706", bg: "#fffbeb", label: "Moderate Risk" },
  HIGH_RISK:     { color: "#dc2626", bg: "#fef2f2", label: "High Risk" },
  SEVERE_RISK:   { color: "#991b1b", bg: "#fef2f2", label: "Severe Risk" },
};

function riskStyle(band) {
  return RISK_STYLE[band] || { color: "#6b7280", bg: "#f3f4f6", label: band || "Unknown" };
}

function RiskBadge({ band }) {
  const rs = riskStyle(band);
  return (
    <span
      style={{
        display: "inline-block",
        padding: "4px 12px",
        borderRadius: "999px",
        fontSize: "12px",
        fontWeight: 700,
        letterSpacing: "0.04em",
        color: rs.color,
        backgroundColor: rs.bg,
        textTransform: "uppercase",
      }}
    >
      {rs.label}
    </span>
  );
}

function ScoreBar({ value }) {
  const pct = Math.min(Math.max((value ?? 0), 0), 100);
  const color = pct >= 80 ? "#16a34a" : pct >= 60 ? "#d97706" : "#dc2626";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
      <div
        style={{
          flex: 1,
          height: "6px",
          backgroundColor: "#e5e7eb",
          borderRadius: "3px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            backgroundColor: color,
            borderRadius: "3px",
          }}
        />
      </div>
      <span style={{ fontSize: "13px", fontWeight: 600, color: "#374151", minWidth: "32px", textAlign: "right" }}>
        {value != null ? Number(value).toFixed(1) : "—"}
      </span>
    </div>
  );
}

function categoryLabel(score) {
  const value = Number(score ?? 0);
  if (value >= 80) return "Strong";
  if (value >= 60) return "Moderate";
  if (value >= 40) return "Weak";
  return "High Risk";
}

function LockedSectionPreview({ sectionKey }) {
  const title = LOCKED_SECTION_LABELS[sectionKey] || "Locked Section";
  const previewLines = LOCKED_SECTION_PREVIEW_LINES[sectionKey] || [
    "Detailed content available after unlock.",
    "This section is intentionally blurred.",
    "Purchase required to reveal full details.",
  ];

  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: "10px",
        padding: "16px 20px",
        marginBottom: "12px",
        backgroundColor: "#fafafa",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "10px",
        }}
      >
        <span style={{ fontSize: "14px", fontWeight: 600, color: "#1a2332" }}>
          {title}
        </span>
        <span
          style={{
            fontSize: "11px",
            fontWeight: 700,
            letterSpacing: "0.05em",
            color: "#7a5600",
            backgroundColor: "#fff3cd",
            border: "1px solid #e6b800",
            borderRadius: "999px",
            padding: "3px 10px",
          }}
        >
          LOCKED
        </span>
      </div>
      <div
        style={{
          position: "relative",
          borderRadius: "6px",
          overflow: "hidden",
          border: "1px solid #ececec",
          background: "#f7f7f7",
        }}
      >
        <div
          aria-hidden="true"
          style={{
            filter: "blur(5px)",
            userSelect: "none",
            pointerEvents: "none",
            opacity: 0.85,
            padding: "8px 12px",
          }}
        >
          <ul style={{ margin: 0, paddingLeft: "18px" }}>
            {previewLines.map((line, index) => (
              <li key={`${sectionKey}-${index}`} style={{ fontSize: "13px", lineHeight: "1.6" }}>
                {line}
              </li>
            ))}
          </ul>
        </div>
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.65) 100%)",
            pointerEvents: "none",
          }}
        />
      </div>
    </div>
  );
}

export default function ReportView() {
  const { request_id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const returnPath = `${location.pathname}${location.search}${location.hash}`;
  const submittedReport = location.state?.submittedReport || null;
  const submittedContext = location.state?.submittedContext || null;
  const anonymousPreview = Boolean(location.state?.anonymousPreview);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(isAuthenticated());

  const [report, setReport] = useState(submittedReport);
  const [access, setAccess] = useState(
    submittedReport
      ? {
          can_view_full_report: false,
          credit_balance: null,
          subscription_active: false,
          subscription_days_remaining: 0,
          locked_sections: ["category_breakdown", "signals", "information_gaps", "suggestions"],
        }
      : null
  );
  const [context, setContext] = useState(submittedContext);
  const [creditBalance, setCreditBalance] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isReportNotFound, setIsReportNotFound] = useState(false);

  const [billingMessage, setBillingMessage] = useState("");
  const [selectedPackage, setSelectedPackage] = useState("single");
  const [purchaseId, setPurchaseId] = useState("");
  const [isBillingLoading, setIsBillingLoading] = useState(false);

  const [subscriptionId, setSubscriptionId] = useState("");
  const [subscriptionPeriodDays, setSubscriptionPeriodDays] = useState(30);

  const [paymentSuccess, setPaymentSuccess] = useState(false);

  // Detect ?payment=success after returning from PayMongo checkout
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("payment") === "success") {
      setPaymentSuccess(true);
      navigate(location.pathname, { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const canViewFullReport = Boolean(access?.can_view_full_report);
  const subscriptionActive = Boolean(access?.subscription_active);
  const subscriptionDaysRemaining = Number(access?.subscription_days_remaining ?? 0);
  const lockedSections =
    access?.locked_sections && access.locked_sections.length > 0
      ? access.locked_sections
      : ["category_breakdown", "signals", "information_gaps", "suggestions"];

  const loadReport = useCallback(async (force = false) => {
    if (anonymousPreview && !isLoggedIn && !force) {
      return;
    }

    setLoading(true);
    setErrorMessage("");
    setIsReportNotFound(false);

    try {
      const data = await getReport(request_id);
      const backendReport = data?.report || null;
      const canView = Boolean(data?.access?.can_view_full_report);

      const mergedReport =
        canView && backendReport && submittedReport
          ? {
              ...submittedReport,
              ...backendReport,
              category_breakdown:
                backendReport.category_breakdown ?? submittedReport.category_breakdown,
              signals: backendReport.signals ?? submittedReport.signals,
              information_gaps:
                backendReport.information_gaps ?? submittedReport.information_gaps,
              suggestions: backendReport.suggestions ?? submittedReport.suggestions,
            }
          : backendReport;

      setReport(mergedReport);
      setAccess(data?.access || null);
      setContext(data?.context || null);
      setCreditBalance(data?.access?.credit_balance ?? null);
      setAuthError("");
      setIsReportNotFound(false);
    } catch (error) {
      if (error?.status === 404) {
        setReport(null);
        setAccess(null);
        setCreditBalance(null);
        setIsReportNotFound(true);
        setErrorMessage("Report not found.");
      } else {
        setIsReportNotFound(false);
        setErrorMessage(error.message || "Error loading report");
      }
      if (error?.status === 401) {
        setIsLoggedIn(false);
      }
    } finally {
      setLoading(false);
    }
  }, [anonymousPreview, isLoggedIn, request_id, submittedReport]);

  const refreshBalance = useCallback(async () => {
    try {
      const data = await getCreditBalance();
      setCreditBalance(data?.credit_balance ?? 0);
    } catch {
      // Silently ignore balance refresh failures.
    }
  }, []);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [request_id]);

  async function handleLogin(event) {
    event.preventDefault();
    setAuthError("");
    try {
      await login(username, password);
      setIsLoggedIn(true);
      setUsername("");
      setPassword("");
      await loadReport(true);
    } catch (error) {
      setAuthError(error.message || "Login failed");
    }
  }

  async function handleLoadLatestReport() {
    if (!isLoggedIn) {
      setErrorMessage("Please sign in first.");
      return;
    }
    setLoading(true);
    setErrorMessage("");
    try {
      const reports = await listReports();
      if (!Array.isArray(reports) || reports.length === 0) {
        setIsReportNotFound(true);
        setErrorMessage("No reports found.");
        return;
      }
      const latestRequestId = reports[0]?.request_id;
      if (!latestRequestId) {
        setIsReportNotFound(true);
        setErrorMessage("No reports found.");
        return;
      }
      navigate(`/report/${latestRequestId}`);
    } catch (error) {
      setErrorMessage(error.message || "Error loading latest report");
    } finally {
      setLoading(false);
    }
  }

  async function handleInitiatePurchase() {
    if (!isLoggedIn) {
      setBillingMessage("Please sign in or register to continue purchase.");
      navigate("/login", { state: { from: returnPath, pendingPackage: selectedPackage } });
      return;
    }

    setIsBillingLoading(true);
    setBillingMessage("");
    try {
      const data = await initiateCreditPurchase(selectedPackage);
      const nextPurchaseId = data?.purchase_id || "";
      const checkoutUrl = data?.checkout_url || "";
      setPurchaseId(nextPurchaseId);

      if (checkoutUrl) {
        setBillingMessage("Redirecting to PayMongo checkout...");
        window.location.assign(checkoutUrl);
        return;
      }

      setBillingMessage("Purchase initialized but checkout URL is missing.");
      await refreshBalance();
    } catch (error) {
      setBillingMessage(error.message || "Failed to initiate purchase");
    } finally {
      setIsBillingLoading(false);
    }
  }

  async function handleConfirmPurchase() {
    if (!isLoggedIn) {
      setBillingMessage("Please sign in or register to continue purchase.");
      navigate("/login", { state: { from: returnPath } });
      return;
    }

    if (!purchaseId) {
      setBillingMessage("Purchase ID is required before confirmation.");
      return;
    }
    setIsBillingLoading(true);
    setBillingMessage("");
    try {
      const data = await confirmCreditPurchase(purchaseId.trim());
      const status = data?.status || "unknown";
      setBillingMessage(`Purchase check complete. Status: ${status}.`);
      await refreshBalance();
      await loadReport();
    } catch (error) {
      setBillingMessage(error.message || "Failed to confirm purchase");
    } finally {
      setIsBillingLoading(false);
    }
  }

  async function handleActivateSubscription() {
    if (!isLoggedIn) {
      setBillingMessage("Please sign in or register to continue subscription activation.");
      navigate("/login", { state: { from: returnPath } });
      return;
    }

    if (!subscriptionId.trim()) {
      setBillingMessage("PayMongo subscription ID is required.");
      return;
    }
    setIsBillingLoading(true);
    setBillingMessage("");
    try {
      await activateSubscription(subscriptionId.trim(), Number(subscriptionPeriodDays));
      setBillingMessage("Subscription activated or renewed.");
      await refreshBalance();
      await loadReport();
    } catch (error) {
      setBillingMessage(error.message || "Failed to activate subscription");
    } finally {
      setIsBillingLoading(false);
    }
  }

  function handlePrintReport() {
    window.print();
  }

  function handleEmailReport() {
    const subject = encodeURIComponent(`RERA Evaluation Report - ${projectTitle}`);
    const body = encodeURIComponent(
      [
        `Project: ${projectTitle}`,
        context?.city || context?.location
          ? `Location: ${[context?.city, context?.location].filter(Boolean).join(", ")}`
          : "",
        report?.risk_band ? `Risk Band: ${report.risk_band}` : "",
        report?.total_score != null ? `Total Score: ${Number(report.total_score).toFixed(1)}` : "",
        "",
        `Report Link: ${window.location.href}`,
      ]
        .filter(Boolean)
        .join("\n")
    );

    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }

  const rs = riskStyle(report?.risk_band);
  const projectTitle = context?.project_name || "Evaluation Report";

  // ── Loading / error states ──
  if (loading && !report) {
    return (
      <div style={{ color: "#6b7280", fontSize: "14px" }}>Loading report…</div>
    );
  }

  // ── Auth gate (not logged in, report not loaded) ──
  if (!isLoggedIn && !report && !loading) {
    return (
      <div style={{ maxWidth: "420px" }}>
        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "12px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
            padding: "32px 36px",
          }}
        >
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#1a2332", marginBottom: "8px" }}>
            Sign In / Register to view this report
          </h2>
          <p style={{ fontSize: "14px", color: "#6b7280", marginBottom: "20px" }}>
            {errorMessage || "Authentication is required to access this report."}
          </p>
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: "14px" }}>
              <label
                htmlFor="report_username"
                style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "#374151", marginBottom: "5px" }}
              >
                Username
              </label>
              <input
                id="report_username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  border: "1px solid #d1d5db",
                  borderRadius: "8px",
                  fontSize: "14px",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div style={{ marginBottom: "18px" }}>
              <label
                htmlFor="report_password"
                style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "#374151", marginBottom: "5px" }}
              >
                Password
              </label>
              <input
                id="report_password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  border: "1px solid #d1d5db",
                  borderRadius: "8px",
                  fontSize: "14px",
                  boxSizing: "border-box",
                }}
              />
            </div>
            {authError && (
              <p style={{ color: "#dc2626", fontSize: "13px", marginBottom: "12px" }}>{authError}</p>
            )}
            <button
              type="submit"
              style={{
                width: "100%",
                padding: "10px",
                backgroundColor: "#2b9f94",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Sign In
            </button>
            <p style={{ marginTop: "12px", fontSize: "12px", color: "#6b7280", textAlign: "center" }}>
              New here?{" "}
              <Link to="/login" state={{ from: returnPath }} style={{ color: "#0f766e", fontWeight: 600 }}>
                Register on the Sign In / Register page
              </Link>
            </p>
          </form>
        </div>
      </div>
    );
  }

  // ── Report not found ──
  if (isReportNotFound) {
    return (
      <div style={{ maxWidth: "480px" }}>
        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "12px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
            padding: "32px 36px",
            textAlign: "center",
          }}
        >
          <p style={{ fontSize: "15px", color: "#374151", marginBottom: "18px" }}>
            Report not found.
          </p>
          {isLoggedIn && (
            <button
              onClick={handleLoadLatestReport}
              disabled={loading}
              style={{
                padding: "9px 20px",
                backgroundColor: "#2b9f94",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                fontSize: "13.5px",
                fontWeight: 600,
                cursor: "pointer",
                marginRight: "10px",
              }}
            >
              Load My Latest Report
            </button>
          )}
          <button
            onClick={() => navigate("/new")}
            style={{
              padding: "9px 20px",
              backgroundColor: "#ffffff",
              color: "#374151",
              border: "1px solid #d1d5db",
              borderRadius: "8px",
              fontSize: "13.5px",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            New Evaluation
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "900px" }}>
      {paymentSuccess && (
        <div
          style={{
            backgroundColor: "#dcfce7",
            border: "1px solid #86efac",
            borderRadius: "10px",
            padding: "14px 18px",
            marginBottom: "20px",
            fontSize: "14px",
            color: "#166534",
            fontWeight: 500,
          }}
        >
          Payment received! Your full report is being loaded below.
        </div>
      )}
      {/* ── Page header ── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "24px",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "24px",
              fontWeight: 700,
              color: "#1a2332",
              marginBottom: "4px",
            }}
          >
            {projectTitle}
          </h1>
          {(context?.city || context?.location) && (
            <p style={{ fontSize: "13px", color: "#6b7280" }}>
              {[context.city, context.location].filter(Boolean).join(" · ")}
            </p>
          )}
          {report && (
            <p style={{ fontSize: "12px", color: "#9ca3af", marginTop: "4px" }}>
              Evaluation ID: {request_id}
            </p>
          )}
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
          {!isLoggedIn && (
            <button
              onClick={() => navigate("/login", { state: { from: returnPath } })}
              style={{
                padding: "7px 14px",
                backgroundColor: "#2b9f94",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Sign In / Register to Unlock
            </button>
          )}
          <button
            onClick={() => navigate("/new")}
            style={{
              padding: "7px 14px",
              backgroundColor: "#ffffff",
              color: "#374151",
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            New Evaluation
          </button>
          <button
            onClick={loadReport}
            disabled={loading}
            style={{
              padding: "7px 14px",
              backgroundColor: "#ffffff",
              color: "#374151",
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
              fontSize: "13px",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? "…" : "Reload"}
          </button>
          {canViewFullReport && (
            <>
              <button
                onClick={handlePrintReport}
                style={{
                  padding: "7px 14px",
                  backgroundColor: "#ffffff",
                  color: "#374151",
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                Print Report
              </button>
              <button
                onClick={handleEmailReport}
                style={{
                  padding: "7px 14px",
                  backgroundColor: "#ffffff",
                  color: "#374151",
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                Email Report
              </button>
            </>
          )}
        </div>
      </div>

      {errorMessage && !isReportNotFound && (
        <p style={{ color: "#dc2626", fontSize: "13px", marginBottom: "16px" }}>
          {errorMessage}
        </p>
      )}

      {report && (
        <>
          {/* ── Top two-panel grid ── */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "16px",
              marginBottom: "20px",
            }}
          >
            {/* Left: Risk Score */}
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
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "#9ca3af",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  marginBottom: "16px",
                }}
              >
                Risk Score
              </div>
              <div
                style={{
                  fontSize: "52px",
                  fontWeight: 800,
                  color: rs.color,
                  lineHeight: 1,
                  marginBottom: "10px",
                }}
              >
                {report.total_score != null
                  ? Number(report.total_score).toFixed(0)
                  : "—"}
              </div>
              <RiskBadge band={report.risk_band} />

              <div style={{ marginTop: "20px", paddingTop: "16px", borderTop: "1px solid #f3f4f6" }}>
                <div style={{ fontSize: "12px", fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" }}>
                  Access
                </div>
                {subscriptionActive ? (
                  <p style={{ fontSize: "13.5px", color: "#374151" }}>
                    Subscription active ·{" "}
                    <span style={{ color: "#16a34a", fontWeight: 600 }}>
                      {subscriptionDaysRemaining} day{subscriptionDaysRemaining === 1 ? "" : "s"} remaining
                    </span>
                  </p>
                ) : (
                  <p style={{ fontSize: "13.5px", color: "#374151" }}>
                    Credits:{" "}
                    <span style={{ fontWeight: 600 }}>{creditBalance ?? "—"}</span>
                    <button
                      onClick={refreshBalance}
                      disabled={isBillingLoading}
                      style={{
                        marginLeft: "8px",
                        padding: "2px 8px",
                        fontSize: "11px",
                        backgroundColor: "transparent",
                        color: "#2b9f94",
                        border: "1px solid #2b9f94",
                        borderRadius: "4px",
                        cursor: "pointer",
                      }}
                    >
                      Refresh
                    </button>
                  </p>
                )}
              </div>
            </div>

            {/* Right: Category Breakdown */}
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
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "#9ca3af",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  marginBottom: "16px",
                }}
              >
                Category Scores
              </div>

              {canViewFullReport ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {[
                    { label: "Developer Legitimacy", key: "developer_legitimacy" },
                    { label: "Project Compliance", key: "project_compliance" },
                    { label: "Title / Land Integrity", key: "title_land" },
                    { label: "Financial Exposure", key: "financial_exposure" },
                    { label: "LGU / Environmental", key: "lgu_environment" },
                  ].map(({ label, key }) => (
                    <div key={key}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: "13px",
                          color: "#374151",
                          marginBottom: "4px",
                        }}
                      >
                        <span>{label}</span>
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 700,
                            letterSpacing: "0.04em",
                            textTransform: "uppercase",
                            color: "#6b7280",
                          }}
                        >
                          {report.category_interpretations?.[key]?.label || categoryLabel(report.category_breakdown?.[key])}
                        </span>
                      </div>
                      <ScoreBar value={report.category_breakdown?.[key]} />
                    </div>
                  ))}
                </div>
              ) : (
                <div>
                  {["developer_legitimacy", "project_compliance", "title_land", "financial_exposure", "lgu_environment"].map(
                    (key) => (
                      <div
                        key={key}
                        style={{
                          height: "24px",
                          backgroundColor: "#f3f4f6",
                          borderRadius: "4px",
                          marginBottom: "10px",
                          filter: "blur(3px)",
                        }}
                      />
                    )
                  )}
                  <p style={{ fontSize: "12px", color: "#9ca3af", textAlign: "center", marginTop: "6px" }}>
                    Unlock to view category scores
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ── Full-report sections OR locked paywall ── */}
          {canViewFullReport ? (
            <div
              style={{
                backgroundColor: "#ffffff",
                borderRadius: "12px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                padding: "28px 32px",
              }}
            >
              {/* Assessment Summary */}
              <div style={{ marginBottom: "28px" }}>
                <h2
                  style={{
                    fontSize: "15px",
                    fontWeight: 700,
                    color: "#1a2332",
                    marginBottom: "12px",
                    paddingBottom: "8px",
                    borderBottom: "1px solid #f3f4f6",
                  }}
                >
                  Assessment Summary
                </h2>
                <p style={{ fontSize: "14px", color: "#374151", lineHeight: "1.6", whiteSpace: "pre-line" }}>
                  {report.assessment_summary || "Assessment summary is not available for this report yet."}
                </p>
              </div>

              {/* Strength Indicators */}
              <div style={{ marginBottom: "28px" }}>
                <h2
                  style={{
                    fontSize: "15px",
                    fontWeight: 700,
                    color: "#1a2332",
                    marginBottom: "12px",
                    paddingBottom: "8px",
                    borderBottom: "1px solid #f3f4f6",
                  }}
                >
                  Strength Indicators
                </h2>
                {report.strengths && report.strengths.length > 0 ? (
                  <ul style={{ paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "6px" }}>
                    {report.strengths.map((strength, index) => (
                      <li key={index} style={{ fontSize: "14px", color: "#166534", lineHeight: "1.5" }}>
                        {strength}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p style={{ fontSize: "13.5px", color: "#9ca3af" }}>No major risk indicators detected.</p>
                )}
              </div>

              {/* HIGH/SEVERE risk fallback */}
              {(["HIGH_RISK", "SEVERE_RISK"].includes(report.risk_band)) &&
                (!report.signals || report.signals.length === 0) &&
                (!report.information_gaps || report.information_gaps.length === 0) &&
                (!report.suggestions || report.suggestions.length === 0) && (
                  <div
                    style={{
                      border: "1px solid #dc2626",
                      borderRadius: "8px",
                      padding: "14px 18px",
                      backgroundColor: "#fef2f2",
                      marginBottom: "24px",
                    }}
                  >
                    <strong style={{ color: "#dc2626", fontSize: "14px" }}>
                      High-Risk Project
                    </strong>
                    <p style={{ margin: "8px 0 0", fontSize: "13.5px", color: "#374151", lineHeight: "1.6" }}>
                      This project received a high-risk score based on the answers provided.
                      Specific risk signals could not be automatically generated from the responses,
                      but the overall score indicates significant concern. We strongly recommend
                      requesting and reviewing all RERA registration documents, licenses to sell,
                      and title documents from the developer before making any financial commitment.
                    </p>
                  </div>
                )}

              {/* Signals */}
              <div style={{ marginBottom: "28px" }}>
                <h2
                  style={{
                    fontSize: "15px",
                    fontWeight: 700,
                    color: "#1a2332",
                    marginBottom: "12px",
                    paddingBottom: "8px",
                    borderBottom: "1px solid #f3f4f6",
                  }}
                >
                  Key Risk Signals
                </h2>
                {report.signals && report.signals.length > 0 ? (
                  <ul style={{ paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "6px" }}>
                    {report.signals.map((signal, index) => (
                      <li key={index} style={{ fontSize: "14px", color: "#374151", lineHeight: "1.5" }}>
                        {signal}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p style={{ fontSize: "13.5px", color: "#9ca3af" }}>None identified.</p>
                )}
              </div>

              {/* Information Gaps */}
              <div style={{ marginBottom: "28px" }}>
                <h2
                  style={{
                    fontSize: "15px",
                    fontWeight: 700,
                    color: "#1a2332",
                    marginBottom: "12px",
                    paddingBottom: "8px",
                    borderBottom: "1px solid #f3f4f6",
                  }}
                >
                  Information Gaps
                </h2>
                {report.information_gaps && report.information_gaps.length > 0 ? (
                  <ul style={{ paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "6px" }}>
                    {report.information_gaps.map((gap, index) => (
                      <li key={index} style={{ fontSize: "14px", color: "#374151", lineHeight: "1.5" }}>
                        {gap}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p style={{ fontSize: "13.5px", color: "#9ca3af" }}>None identified.</p>
                )}
              </div>

              {/* Suggestions */}
              <div style={{ marginBottom: "16px" }}>
                <h2
                  style={{
                    fontSize: "15px",
                    fontWeight: 700,
                    color: "#1a2332",
                    marginBottom: "12px",
                    paddingBottom: "8px",
                    borderBottom: "1px solid #f3f4f6",
                  }}
                >
                  Recommended Next Steps
                </h2>
                {report.suggestions && report.suggestions.length > 0 ? (
                  <ul style={{ paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "6px" }}>
                    {report.suggestions.map((suggestion, index) => (
                      <li key={index} style={{ fontSize: "14px", color: "#374151", lineHeight: "1.5" }}>
                        {suggestion}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p style={{ fontSize: "13.5px", color: "#9ca3af" }}>None available.</p>
                )}
              </div>
            </div>
          ) : (
            /* ── Locked paywall ── */
            <div
              style={{
                backgroundColor: "#ffffff",
                borderRadius: "12px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                padding: "28px 32px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "18px",
                }}
              >
                <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#1a2332" }}>
                  Full Report Locked
                </h2>
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "#d97706",
                    backgroundColor: "#fffbeb",
                    border: "1px solid #fcd34d",
                    borderRadius: "999px",
                    padding: "4px 12px",
                    letterSpacing: "0.04em",
                  }}
                >
                  UNLOCK REQUIRED
                </span>
              </div>

              <p style={{ fontSize: "13.5px", color: "#6b7280", marginBottom: "20px", lineHeight: "1.6" }}>
                Activate a subscription or use a credit to reveal the full category
                breakdown, risk signals, information gaps, and due diligence suggestions.
              </p>

              <div style={{ marginBottom: "24px" }}>
                {lockedSections.map((sectionKey) => (
                  <LockedSectionPreview key={sectionKey} sectionKey={sectionKey} />
                ))}
              </div>

              {/* Separator */}
              <div
                style={{
                  borderTop: "1px solid #e5e7eb",
                  paddingTop: "22px",
                }}
              >
                {/* Buy Credits */}
                <div style={{ marginBottom: "22px" }}>
                  <h3 style={{ fontSize: "14px", fontWeight: 600, color: "#1a2332", marginBottom: "10px" }}>
                    Buy Credits
                  </h3>
                  <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                    <select
                      value={selectedPackage}
                      onChange={(e) => setSelectedPackage(e.target.value)}
                      style={{
                        padding: "9px 12px",
                        border: "1px solid #d1d5db",
                        borderRadius: "8px",
                        fontSize: "13.5px",
                        color: "#374151",
                        flex: "1 1 200px",
                      }}
                    >
                      {CREDIT_PACKAGE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={handleInitiatePurchase}
                      disabled={isBillingLoading}
                      style={{
                        padding: "9px 18px",
                        backgroundColor: "#2b9f94",
                        color: "#fff",
                        border: "none",
                        borderRadius: "8px",
                        fontSize: "13.5px",
                        fontWeight: 600,
                        cursor: isBillingLoading ? "not-allowed" : "pointer",
                        opacity: isBillingLoading ? 0.7 : 1,
                      }}
                    >
                      Buy Credits
                    </button>
                  </div>
                </div>

                {/* Confirm Purchase */}
                <div style={{ marginBottom: "22px" }}>
                  <h3 style={{ fontSize: "14px", fontWeight: 600, color: "#1a2332", marginBottom: "10px" }}>
                    Refresh Purchase Status
                  </h3>
                  <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                    <input
                      placeholder="purchase_id"
                      value={purchaseId}
                      onChange={(e) => setPurchaseId(e.target.value)}
                      style={{
                        padding: "9px 12px",
                        border: "1px solid #d1d5db",
                        borderRadius: "8px",
                        fontSize: "13.5px",
                        flex: "1 1 260px",
                      }}
                    />
                    <button
                      onClick={handleConfirmPurchase}
                      disabled={isBillingLoading}
                      style={{
                        padding: "9px 18px",
                        backgroundColor: "#ffffff",
                        color: "#374151",
                        border: "1px solid #d1d5db",
                        borderRadius: "8px",
                        fontSize: "13.5px",
                        fontWeight: 500,
                        cursor: isBillingLoading ? "not-allowed" : "pointer",
                        opacity: isBillingLoading ? 0.7 : 1,
                      }}
                    >
                      Confirm
                    </button>
                  </div>
                </div>

                {/* Subscription Activation */}
                <div style={{ marginBottom: "10px" }}>
                  <h3 style={{ fontSize: "14px", fontWeight: 600, color: "#1a2332", marginBottom: "10px" }}>
                    Activate Subscription
                  </h3>
                  <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap", marginBottom: "10px" }}>
                    <input
                      placeholder="paymongo_subscription_id"
                      value={subscriptionId}
                      onChange={(e) => setSubscriptionId(e.target.value)}
                      style={{
                        padding: "9px 12px",
                        border: "1px solid #d1d5db",
                        borderRadius: "8px",
                        fontSize: "13.5px",
                        flex: "1 1 260px",
                      }}
                    />
                    <select
                      id="period_days"
                      value={subscriptionPeriodDays}
                      onChange={(e) => setSubscriptionPeriodDays(Number(e.target.value))}
                      style={{
                        padding: "9px 12px",
                        border: "1px solid #d1d5db",
                        borderRadius: "8px",
                        fontSize: "13.5px",
                        color: "#374151",
                      }}
                    >
                      <option value={30}>30 days</option>
                      <option value={365}>365 days</option>
                    </select>
                    <button
                      onClick={handleActivateSubscription}
                      disabled={isBillingLoading}
                      style={{
                        padding: "9px 18px",
                        backgroundColor: "#ffffff",
                        color: "#374151",
                        border: "1px solid #d1d5db",
                        borderRadius: "8px",
                        fontSize: "13.5px",
                        fontWeight: 500,
                        cursor: isBillingLoading ? "not-allowed" : "pointer",
                        opacity: isBillingLoading ? 0.7 : 1,
                      }}
                    >
                      Activate
                    </button>
                  </div>
                </div>

                {billingMessage && (
                  <p style={{ fontSize: "13px", color: "#374151", marginTop: "12px", lineHeight: "1.5" }}>
                    {billingMessage}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Disclaimer */}
          <p
            style={{
              fontSize: "12px",
              color: "#9ca3af",
              marginTop: "20px",
              lineHeight: "1.6",
            }}
          >
            RERA provides structured risk indicators based on disclosed project information.
            Results do not constitute legal or financial advice.
          </p>
        </>
      )}
    </div>
  );
}

