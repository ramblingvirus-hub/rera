import { useEffect, useMemo, useState } from "react";

import { getAdminAuditEvents } from "../api/apiClient";

const EVENT_WINDOW_FOR_ALERTS = 100;

function parseTimestamp(value) {
  const parsed = new Date(value || "");
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function severityColor(severity) {
  if (severity === "CRITICAL") {
    return { color: "#991b1b", bg: "#fee2e2", border: "#fecaca" };
  }
  if (severity === "WARNING") {
    return { color: "#92400e", bg: "#fef3c7", border: "#fde68a" };
  }
  return { color: "#4b5563", bg: "#f3f4f6", border: "#e5e7eb" };
}

function buildAlerts(events) {
  const latest = events.slice(0, EVENT_WINDOW_FOR_ALERTS);
  const alerts = [];

  const byRequest = latest.reduce((acc, event) => {
    if (!event.request_id) {
      return acc;
    }
    if (!acc[event.request_id]) {
      acc[event.request_id] = [];
    }
    acc[event.request_id].push(event);
    return acc;
  }, {});

  Object.entries(byRequest).forEach(([requestId, requestEvents]) => {
    const hasDeducted = requestEvents.some((event) => event.event_type === "BILLING_CREDIT_DEDUCTED");
    const hasSuccess = requestEvents.some((event) => event.event_type === "EVALUATION_SUCCESS");
    const deductionCount = requestEvents.filter((event) => event.event_type === "BILLING_CREDIT_DEDUCTED").length;

    if (hasDeducted && !hasSuccess) {
      alerts.push({
        id: `refund-${requestId}`,
        level: "RED",
        title: "Refund Risk",
        message: "Credit deducted but no successful evaluation was recorded.",
        requestId,
      });
    }

    if (deductionCount > 1) {
      alerts.push({
        id: `duplicate-billing-${requestId}`,
        level: "RED",
        title: "Duplicate Billing Anomaly",
        message: "Multiple credit deduction events were recorded for the same request.",
        requestId,
      });
    }
  });

  if (latest.some((event) => event.event_type === "PAYMENT_FAILED")) {
    alerts.push({
      id: "payment-failed",
      level: "RED",
      title: "Payment Failure Detected",
      message: "One or more payment flows failed before credits were issued.",
    });
  }

  const paymentVerified = latest.filter((event) => event.event_type === "PAYMENT_VERIFIED");
  const purchaseCreatedByUser = new Set(
    latest
      .filter((event) => event.event_type === "CREDIT_PURCHASE_CREATED")
      .map((event) => event.user_id)
      .filter(Boolean)
  );

  if (paymentVerified.some((event) => event.user_id && !purchaseCreatedByUser.has(event.user_id))) {
    alerts.push({
      id: "verified-no-credit",
      level: "RED",
      title: "Payment Verified Without Credit Issuance",
      message: "At least one verified payment has no corresponding credit-creation record.",
    });
  }

  const validationFailures = latest.filter((event) => event.event_type === "EVALUATION_VALIDATION_FAIL");
  if (validationFailures.length >= 4) {
    alerts.push({
      id: "validation-failures",
      level: "ORANGE",
      title: "Validation Failure Spike",
      message: `Detected ${validationFailures.length} validation failures in recent activity.`,
    });
  }

  if (latest.some((event) => event.event_type === "REPORT_VIEW_FAILED")) {
    alerts.push({
      id: "report-view-failed",
      level: "ORANGE",
      title: "Report View Failure",
      message: "Users experienced report view failures.",
    });
  }

  const interviewStarted = latest.filter((event) => event.event_type === "INTERVIEW_STARTED").length;
  const interviewSubmitted = latest.filter((event) => event.event_type === "INTERVIEW_SUBMITTED").length;
  const interviewAbandoned = latest.filter((event) => event.event_type === "INTERVIEW_ABANDONED").length;

  if (interviewStarted >= 4) {
    const dropoffRate = interviewAbandoned / interviewStarted;
    const conversionRate = interviewSubmitted / interviewStarted;

    if (dropoffRate > 0.5) {
      alerts.push({
        id: "abandonment",
        level: "ORANGE",
        title: "High Interview Abandonment",
        message: `Drop-off rate reached ${(dropoffRate * 100).toFixed(0)}%.`,
      });
    }

    if (conversionRate < 0.4) {
      alerts.push({
        id: "low-conversion",
        level: "ORANGE",
        title: "Low Conversion",
        message: `Submission conversion is ${(conversionRate * 100).toFixed(0)}% in recent traffic.`,
      });
    }
  }

  const loginFailed = latest.filter((event) => event.event_type === "LOGIN_FAILED").length;
  const throttleCount = latest.filter((event) => event.event_type === "THROTTLE_TRIGGERED").length;

  if (loginFailed > 3 || throttleCount > 2 || latest.some((event) => ["SUSPICIOUS_ACTIVITY", "BOT_SUSPECTED", "RAPID_PAGE_REQUESTS"].includes(event.event_type))) {
    alerts.push({
      id: "security",
      level: "YELLOW",
      title: "Security Warning",
      message: "Potential brute-force, scraping, or suspicious activity detected.",
    });
  }

  const pageViews = latest.filter((event) => event.event_type === "PAGE_VIEW").length;
  const sessions = latest.filter((event) => event.event_type === "SESSION_STARTED").length;
  if (pageViews > 80 || (sessions >= 8 && interviewStarted / sessions < 0.3)) {
    alerts.push({
      id: "usage-spike",
      level: "ORANGE",
      title: "Usage Anomaly",
      message: "Traffic pattern suggests unusual flow progression or page-view spike.",
    });
  }

  return alerts;
}

function formatTimestamp(timestamp) {
  const parsed = parseTimestamp(timestamp);
  if (!parsed) {
    return "-";
  }
  return parsed.toLocaleString();
}

export default function AuditDashboard() {
  const [events, setEvents] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [nextOffset, setNextOffset] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedRequestId, setSelectedRequestId] = useState("");
  const [selectedTimelineSource, setSelectedTimelineSource] = useState(null);
  const [filters, setFilters] = useState({
    request_id: "",
    user_id: "",
    event_type: "",
    severity: "",
    timestamp_from: "",
    timestamp_to: "",
    limit: 100,
  });

  const alerts = useMemo(() => buildAlerts(events), [events]);

  const usageSnapshot = useMemo(() => {
    const count = (type) => events.filter((event) => event.event_type === type).length;

    const started = count("INTERVIEW_STARTED");
    const submitted = count("INTERVIEW_SUBMITTED");
    const abandoned = count("INTERVIEW_ABANDONED");

    return {
      activeSessions: count("SESSION_STARTED"),
      pageViews: count("PAGE_VIEW"),
      interviewsStarted: started,
      interviewsSubmitted: submitted,
      reportsViewed: count("REPORT_VIEWED"),
      paymentsInitiated: count("CREDIT_PURCHASE_INITIATED"),
      conversionRate: started > 0 ? (submitted / started) * 100 : 0,
      dropoffRate: started > 0 ? (abandoned / started) * 100 : 0,
    };
  }, [events]);

  const trafficSnapshot = useMemo(() => {
    const ipCounts = {};
    const pageCounts = {};

    events.forEach((event) => {
      const metadata = event.metadata || {};
      if (metadata.ip) {
        ipCounts[metadata.ip] = (ipCounts[metadata.ip] || 0) + 1;
      }
      if (metadata.path) {
        pageCounts[metadata.path] = (pageCounts[metadata.path] || 0) + 1;
      }
    });

    const topIps = Object.entries(ipCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const topPages = Object.entries(pageCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return { topIps, topPages };
  }, [events]);

  const groupedByRequestId = useMemo(() => {
    const grouped = {};
    events.forEach((event) => {
      if (!event.request_id) {
        return;
      }
      if (!grouped[event.request_id]) {
        grouped[event.request_id] = [];
      }
      grouped[event.request_id].push(event);
    });

    Object.values(grouped).forEach((timeline) => {
      timeline.sort((a, b) => {
        const left = parseTimestamp(a.timestamp)?.getTime() || 0;
        const right = parseTimestamp(b.timestamp)?.getTime() || 0;
        return left - right;
      });
    });

    return grouped;
  }, [events]);

  async function loadEvents(nextFilters = filters) {
    setLoading(true);
    setError("");

    try {
      const payload = await getAdminAuditEvents(nextFilters);
      const resultItems = Array.isArray(payload?.results) ? payload.results : [];
      const sorted = [...resultItems].sort((a, b) => {
            const left = parseTimestamp(a.timestamp)?.getTime() || 0;
            const right = parseTimestamp(b.timestamp)?.getTime() || 0;
            return right - left;
          });

      setEvents(sorted);
      setTotalCount(Number(payload?.count || sorted.length || 0));
      setNextOffset(payload?.next_offset ?? null);
    } catch (loadError) {
      setError(loadError?.message || "Failed to load audit events.");
      setTotalCount(0);
      setNextOffset(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const availableEventTypes = useMemo(
    () => [...new Set(events.map((event) => event.event_type))].sort(),
    [events]
  );

  const selectedTimeline = selectedRequestId
    ? groupedByRequestId[selectedRequestId] || []
    : [];

  const maxAlertLevel = alerts.some((alert) => alert.level === "RED")
    ? "RED"
    : alerts.some((alert) => alert.level === "ORANGE")
      ? "ORANGE"
      : alerts.some((alert) => alert.level === "YELLOW")
        ? "YELLOW"
        : null;

  const alertBannerStyle =
    maxAlertLevel === "RED"
      ? { border: "#fecaca", background: "#fef2f2", color: "#991b1b" }
      : maxAlertLevel === "ORANGE"
        ? { border: "#fed7aa", background: "#fff7ed", color: "#9a3412" }
        : maxAlertLevel === "YELLOW"
          ? { border: "#fde68a", background: "#fffbeb", color: "#854d0e" }
          : { border: "#bfdbfe", background: "#eff6ff", color: "#1d4ed8" };

  return (
    <div style={{ display: "grid", gap: "16px" }}>
      <div
        style={{
          position: "sticky",
          top: "78px",
          zIndex: 30,
          border: `1px solid ${alertBannerStyle.border}`,
          backgroundColor: alertBannerStyle.background,
          color: alertBannerStyle.color,
          borderRadius: "12px",
          padding: "12px 14px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
          <div style={{ fontWeight: 800, fontSize: "13px", letterSpacing: "0.04em" }}>
            {maxAlertLevel ? `${maxAlertLevel} ALERT` : "SYSTEM HEALTHY"}
          </div>
          <button
            type="button"
            onClick={() => loadEvents({ ...filters, limit: EVENT_WINDOW_FOR_ALERTS })}
            style={{
              border: "1px solid rgba(15,23,42,0.15)",
              backgroundColor: "#ffffff",
              borderRadius: "8px",
              fontSize: "12px",
              fontWeight: 700,
              padding: "6px 10px",
              cursor: "pointer",
            }}
          >
            Refresh Alerts
          </button>
        </div>

        <div style={{ marginTop: "8px", display: "grid", gap: "8px" }}>
          {alerts.length === 0 && (
            <div style={{ fontSize: "13px", color: "#0f766e" }}>
              No critical alert conditions detected in the latest window.
            </div>
          )}

          {alerts.slice(0, 4).map((alert) => (
            <div key={alert.id} style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: "13px", fontWeight: 700 }}>{alert.title}</div>
                <div style={{ fontSize: "12px" }}>{alert.message}</div>
                {alert.requestId && (
                  <div style={{ fontSize: "12px", marginTop: "2px" }}>Request ID: {alert.requestId}</div>
                )}
              </div>
              {alert.requestId && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedRequestId(alert.requestId);
                    setSelectedTimelineSource("alert");
                  }}
                  style={{
                    border: "1px solid rgba(15,23,42,0.18)",
                    backgroundColor: "#ffffff",
                    borderRadius: "8px",
                    padding: "6px 10px",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  View Timeline
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
        {[
          ["Active Sessions", usageSnapshot.activeSessions],
          ["Page Views", usageSnapshot.pageViews],
          ["Interviews Started", usageSnapshot.interviewsStarted],
          ["Interviews Submitted", usageSnapshot.interviewsSubmitted],
          ["Reports Viewed", usageSnapshot.reportsViewed],
          ["Payments Initiated", usageSnapshot.paymentsInitiated],
          ["Conversion Rate", `${usageSnapshot.conversionRate.toFixed(1)}%`],
          ["Drop-off Rate", `${usageSnapshot.dropoffRate.toFixed(1)}%`],
        ].map(([label, value]) => (
          <div
            key={label}
            style={{
              backgroundColor: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: "10px",
              padding: "12px",
            }}
          >
            <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", letterSpacing: "0.05em" }}>{label}</div>
            <div style={{ marginTop: "6px", fontSize: "22px", fontWeight: 800, color: "#0f172a" }}>{value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        <div style={{ backgroundColor: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "10px", padding: "12px" }}>
          <div style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a", marginBottom: "8px" }}>Top IPs</div>
          {trafficSnapshot.topIps.length === 0 && <div style={{ fontSize: "12px", color: "#94a3b8" }}>No IP traffic metadata available.</div>}
          {trafficSnapshot.topIps.map(([ip, count]) => (
            <div key={ip} style={{ fontSize: "12px", color: "#334155", marginBottom: "4px" }}>
              {ip} - {count} requests
            </div>
          ))}
        </div>

        <div style={{ backgroundColor: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "10px", padding: "12px" }}>
          <div style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a", marginBottom: "8px" }}>Top Pages</div>
          {trafficSnapshot.topPages.length === 0 && <div style={{ fontSize: "12px", color: "#94a3b8" }}>No page path metadata available.</div>}
          {trafficSnapshot.topPages.map(([path, count]) => (
            <div key={path} style={{ fontSize: "12px", color: "#334155", marginBottom: "4px" }}>
              {path} - {count} views
            </div>
          ))}
        </div>
      </div>

      <div style={{ backgroundColor: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "10px", padding: "12px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "8px" }}>
          <input
            placeholder="Request ID"
            value={filters.request_id}
            onChange={(event) => setFilters((prev) => ({ ...prev, request_id: event.target.value }))}
            style={{ border: "1px solid #d1d5db", borderRadius: "8px", padding: "8px" }}
          />
          <input
            placeholder="User ID"
            value={filters.user_id}
            onChange={(event) => setFilters((prev) => ({ ...prev, user_id: event.target.value }))}
            style={{ border: "1px solid #d1d5db", borderRadius: "8px", padding: "8px" }}
          />
          <select
            value={filters.event_type}
            onChange={(event) => setFilters((prev) => ({ ...prev, event_type: event.target.value }))}
            style={{ border: "1px solid #d1d5db", borderRadius: "8px", padding: "8px" }}
          >
            <option value="">All Event Types</option>
            {availableEventTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          <select
            value={filters.severity}
            onChange={(event) => setFilters((prev) => ({ ...prev, severity: event.target.value }))}
            style={{ border: "1px solid #d1d5db", borderRadius: "8px", padding: "8px" }}
          >
            <option value="">All Severities</option>
            <option value="INFO">INFO</option>
            <option value="WARNING">WARNING</option>
            <option value="CRITICAL">CRITICAL</option>
          </select>
          <input
            type="datetime-local"
            value={filters.timestamp_from}
            onChange={(event) => setFilters((prev) => ({ ...prev, timestamp_from: event.target.value ? new Date(event.target.value).toISOString() : "" }))}
            style={{ border: "1px solid #d1d5db", borderRadius: "8px", padding: "8px" }}
          />
          <input
            type="datetime-local"
            value={filters.timestamp_to}
            onChange={(event) => setFilters((prev) => ({ ...prev, timestamp_to: event.target.value ? new Date(event.target.value).toISOString() : "" }))}
            style={{ border: "1px solid #d1d5db", borderRadius: "8px", padding: "8px" }}
          />
          <input
            type="number"
            min={1}
            max={200}
            value={filters.limit}
            onChange={(event) => setFilters((prev) => ({ ...prev, limit: Number(event.target.value) || 100 }))}
            style={{ border: "1px solid #d1d5db", borderRadius: "8px", padding: "8px" }}
          />
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              onClick={() => loadEvents(filters)}
              style={{
                flex: 1,
                border: "none",
                backgroundColor: "#0f766e",
                color: "#ffffff",
                borderRadius: "8px",
                padding: "8px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Search
            </button>
            <button
              type="button"
              onClick={() => {
                const resetFilters = {
                  request_id: "",
                  user_id: "",
                  event_type: "",
                  severity: "",
                  timestamp_from: "",
                  timestamp_to: "",
                  limit: 100,
                };
                setFilters(resetFilters);
                loadEvents(resetFilters);
              }}
              style={{
                flex: 1,
                border: "1px solid #cbd5e1",
                backgroundColor: "#ffffff",
                color: "#334155",
                borderRadius: "8px",
                padding: "8px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      <div style={{ backgroundColor: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "10px", overflowX: "auto" }}>
        {loading && <div style={{ padding: "14px", fontSize: "13px", color: "#64748b" }}>Loading audit events...</div>}
        {error && <div style={{ padding: "14px", fontSize: "13px", color: "#b91c1c" }}>{error}</div>}

        {!loading && !error && (
          <>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "840px" }}>
              <thead>
                <tr style={{ backgroundColor: "#f8fafc", textAlign: "left" }}>
                  <th style={{ padding: "10px", borderBottom: "1px solid #e2e8f0", fontSize: "12px" }}>Timestamp</th>
                  <th style={{ padding: "10px", borderBottom: "1px solid #e2e8f0", fontSize: "12px" }}>Event Type</th>
                  <th style={{ padding: "10px", borderBottom: "1px solid #e2e8f0", fontSize: "12px" }}>Severity</th>
                  <th style={{ padding: "10px", borderBottom: "1px solid #e2e8f0", fontSize: "12px" }}>Request ID</th>
                  <th style={{ padding: "10px", borderBottom: "1px solid #e2e8f0", fontSize: "12px" }}>User ID</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => {
                  const palette = severityColor(event.severity);
                  return (
                    <tr
                      key={event.id}
                      onClick={() => {
                        if (event.request_id) {
                          setSelectedRequestId(event.request_id);
                          setSelectedTimelineSource("table");
                        }
                      }}
                      style={{
                        cursor: event.request_id ? "pointer" : "default",
                        borderBottom: "1px solid #f1f5f9",
                      }}
                    >
                      <td style={{ padding: "10px", fontSize: "12px", color: "#334155" }}>{formatTimestamp(event.timestamp)}</td>
                      <td style={{ padding: "10px", fontSize: "12px", color: "#0f172a", fontWeight: 600 }}>{event.event_type}</td>
                      <td style={{ padding: "10px" }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "2px 8px",
                            borderRadius: "999px",
                            border: `1px solid ${palette.border}`,
                            backgroundColor: palette.bg,
                            color: palette.color,
                            fontSize: "11px",
                            fontWeight: 700,
                          }}
                        >
                          {event.severity}
                        </span>
                      </td>
                      <td style={{ padding: "10px", fontSize: "12px", color: "#334155" }}>{event.request_id || "-"}</td>
                      <td style={{ padding: "10px", fontSize: "12px", color: "#334155" }}>{event.user_id || "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "10px",
                borderTop: "1px solid #e2e8f0",
              }}
            >
              <div style={{ fontSize: "12px", color: "#64748b" }}>
                Showing {events.length} of {totalCount} events
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  disabled={filters.offset <= 0}
                  onClick={() => {
                    const previousOffset = Math.max(0, Number(filters.offset || 0) - Number(filters.limit || 100));
                    const nextFilters = { ...filters, offset: previousOffset };
                    setFilters(nextFilters);
                    loadEvents(nextFilters);
                  }}
                  style={{
                    border: "1px solid #cbd5e1",
                    backgroundColor: filters.offset <= 0 ? "#f8fafc" : "#ffffff",
                    color: "#334155",
                    borderRadius: "8px",
                    padding: "6px 10px",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: filters.offset <= 0 ? "not-allowed" : "pointer",
                  }}
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={nextOffset === null}
                  onClick={() => {
                    if (nextOffset === null) {
                      return;
                    }
                    const nextFilters = { ...filters, offset: nextOffset };
                    setFilters(nextFilters);
                    loadEvents(nextFilters);
                  }}
                  style={{
                    border: "1px solid #cbd5e1",
                    backgroundColor: nextOffset === null ? "#f8fafc" : "#ffffff",
                    color: "#334155",
                    borderRadius: "8px",
                    padding: "6px 10px",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: nextOffset === null ? "not-allowed" : "pointer",
                  }}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {selectedRequestId && (
        <div style={{ backgroundColor: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "10px", padding: "12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: "12px", color: "#64748b", fontWeight: 700 }}>Request Timeline</div>
              <div style={{ fontSize: "14px", color: "#0f172a", fontWeight: 800 }}>{selectedRequestId}</div>
              {selectedTimelineSource && (
                <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "2px" }}>
                  Opened from {selectedTimelineSource}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedRequestId("");
                setSelectedTimelineSource(null);
              }}
              style={{
                border: "1px solid #cbd5e1",
                backgroundColor: "#ffffff",
                borderRadius: "8px",
                padding: "6px 10px",
                fontSize: "12px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Close
            </button>
          </div>

          <div style={{ marginTop: "10px", display: "grid", gap: "8px" }}>
            {selectedTimeline.length === 0 && (
              <div style={{ fontSize: "12px", color: "#94a3b8" }}>No events found for this request.</div>
            )}

            {selectedTimeline.map((event) => (
              <div
                key={event.id}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                  padding: "8px 10px",
                  backgroundColor: "#f8fafc",
                }}
              >
                <div style={{ fontSize: "12px", color: "#334155", fontWeight: 700 }}>
                  [{formatTimestamp(event.timestamp)}] {event.event_type}
                </div>
                <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
                  Severity: {event.severity} | User: {event.user_id || "-"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
