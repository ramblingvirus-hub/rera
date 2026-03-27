import { useEffect, useState } from "react";
import { listManualPayments, reviewManualPayment } from "../api/apiClient";

const CARD_STYLE = {
  backgroundColor: "#ffffff",
  borderRadius: "12px",
  boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
  padding: "24px",
};

function statusBadge(status) {
  const styles = {
    pending: { bg: "#fef3c7", color: "#92400e" },
    approved: { bg: "#dcfce7", color: "#166534" },
    rejected: { bg: "#fee2e2", color: "#991b1b" },
  };
  const style = styles[status] || styles.pending;
  return (
    <span
      style={{
        display: "inline-block",
        backgroundColor: style.bg,
        color: style.color,
        padding: "4px 12px",
        borderRadius: "999px",
        fontSize: "12px",
        fontWeight: 700,
        textTransform: "capitalize",
      }}
    >
      {status}
    </span>
  );
}

export default function AdminPaymentsPage() {
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState([]);
  const [filter, setFilter] = useState("pending");
  const [reviewingId, setReviewingId] = useState(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadPayments();
  }, []);

  async function loadPayments() {
    setLoading(true);
    setMessage("");
    try {
      const data = await listManualPayments();
      setPayments(Array.isArray(data) ? data : []);
    } catch (error) {
      setMessage(error?.message || "Failed to load payments.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(paymentId, action) {
    setMessage("");
    try {
      await reviewManualPayment(paymentId, action, reviewNotes);
      setReviewingId(null);
      setReviewNotes("");
      await loadPayments();
      setMessage(`Payment ${action} successfully.`);
    } catch (error) {
      setMessage(error?.message || `Failed to ${action} payment.`);
    }
  }

  const filtered = filter === "all" ? payments : payments.filter((p) => p.status === filter);

  return (
    <div style={{ maxWidth: "1000px", display: "grid", gap: "18px" }}>
      <div style={CARD_STYLE}>
        <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#1a2332", marginBottom: "8px" }}>
          Manual Payments Review
        </h1>
        <p style={{ fontSize: "14px", color: "#6b7280" }}>
          Review, approve, or reject manual payment submissions.
        </p>
      </div>

      <div style={CARD_STYLE}>
        <div style={{ display: "flex", gap: "10px", marginBottom: "16px", alignItems: "center" }}>
          <label style={{ fontSize: "13px", fontWeight: 600, color: "#374151" }}>Filter:</label>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{ border: "1px solid #d1d5db", borderRadius: "6px", padding: "8px 10px", fontSize: "13px" }}
          >
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="all">All</option>
          </select>
        </div>

        {message && (
          <p
            style={{
              marginBottom: "12px",
              fontSize: "13px",
              color: message.toLowerCase().includes("failed") ? "#dc2626" : "#065f46",
              backgroundColor: message.toLowerCase().includes("failed") ? "#fee2e2" : "#dcfce7",
              padding: "10px 12px",
              borderRadius: "6px",
            }}
          >
            {message}
          </p>
        )}

        {loading ? (
          <p style={{ color: "#6b7280", fontSize: "14px" }}>Loading payments...</p>
        ) : filtered.length === 0 ? (
          <p style={{ color: "#6b7280", fontSize: "14px" }}>No payments found.</p>
        ) : (
          <div style={{ display: "grid", gap: "12px" }}>
            {filtered.map((payment) => (
              <div
                key={payment.id}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: "10px",
                  padding: "14px",
                  backgroundColor: "#fafbfc",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    gap: "12px",
                    marginBottom: "10px",
                    alignItems: "start",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "14px", fontWeight: 600, color: "#111827", marginBottom: "4px" }}>
                      {payment.package_key.toUpperCase()} • PHP {payment.amount_php}
                    </div>
                    <div style={{ fontSize: "12px", color: "#374151", display: "grid", gap: "2px" }}>
                      <div>
                        <strong>User:</strong> {payment.user_username || payment.user}
                      </div>
                      <div>
                        <strong>Method:</strong> {payment.payment_method}
                      </div>
                      <div>
                        <strong>Reference:</strong> {payment.reference_number}
                      </div>
                      {payment.reference_note && (
                        <div>
                          <strong>Note:</strong> {payment.reference_note}
                        </div>
                      )}
                      <div>
                        <strong>Submitted:</strong> {new Date(payment.created_at).toLocaleString()}
                      </div>
                      {payment.admin_notes && (
                        <div>
                          <strong>Admin notes:</strong> {payment.admin_notes}
                        </div>
                      )}
                    </div>
                  </div>
                  <div>{statusBadge(payment.status)}</div>
                </div>

                {payment.proof_file && (
                  <div style={{ marginBottom: "10px" }}>
                    <a
                      href={payment.proof_file}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontSize: "12px", color: "#0ea5e9", fontWeight: 600 }}
                    >
                      View Proof File
                    </a>
                  </div>
                )}

                {payment.status === "pending" && (
                  <div style={{ marginTop: "10px", display: "grid", gap: "8px" }}>
                    {reviewingId === payment.id ? (
                      <div style={{ display: "grid", gap: "8px" }}>
                        <textarea
                          value={reviewNotes}
                          onChange={(e) => setReviewNotes(e.target.value)}
                          placeholder="Admin review notes (optional)"
                          style={{
                            border: "1px solid #d1d5db",
                            borderRadius: "6px",
                            padding: "8px 10px",
                            fontSize: "12px",
                            fontFamily: "monospace",
                            minHeight: "60px",
                          }}
                        />
                        <div style={{ display: "flex", gap: "6px" }}>
                          <button
                            onClick={() => handleAction(payment.id, "approve")}
                            style={{
                              flex: 1,
                              border: "none",
                              borderRadius: "6px",
                              padding: "8px 10px",
                              backgroundColor: "#10b981",
                              color: "#fff",
                              fontSize: "12px",
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleAction(payment.id, "reject")}
                            style={{
                              flex: 1,
                              border: "none",
                              borderRadius: "6px",
                              padding: "8px 10px",
                              backgroundColor: "#ef4444",
                              color: "#fff",
                              fontSize: "12px",
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            Reject
                          </button>
                          <button
                            onClick={() => {
                              setReviewingId(null);
                              setReviewNotes("");
                            }}
                            style={{
                              border: "1px solid #d1d5db",
                              borderRadius: "6px",
                              padding: "8px 10px",
                              backgroundColor: "#f3f4f6",
                              color: "#374151",
                              fontSize: "12px",
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setReviewingId(payment.id)}
                        style={{
                          border: "1px solid #0f766e",
                          borderRadius: "6px",
                          padding: "8px 10px",
                          backgroundColor: "#f0f9f9",
                          color: "#0f766e",
                          fontSize: "12px",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        Review
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
