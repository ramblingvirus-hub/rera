import { useEffect, useMemo, useState } from "react";

import {
  getCreditBalance,
  getManualPaymentConfig,
  listManualPayments,
  logAuditEvent,
  submitManualPayment,
} from "../api/apiClient";

const CARD_STYLE = {
  backgroundColor: "#ffffff",
  borderRadius: "12px",
  boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
  padding: "24px",
};

function statusStyle(status) {
  if (status === "approved") {
    return { color: "#166534", backgroundColor: "#dcfce7" };
  }
  if (status === "rejected") {
    return { color: "#991b1b", backgroundColor: "#fee2e2" };
  }
  return { color: "#92400e", backgroundColor: "#fef3c7" };
}

export default function BillingPage() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [flowMessage, setFlowMessage] = useState("");
  const [creditBalance, setCreditBalance] = useState(null);
  const [config, setConfig] = useState(null);
  const [payments, setPayments] = useState([]);

  const [packageKey, setPackageKey] = useState("single");
  const [paymentMethod, setPaymentMethod] = useState("GCASH");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [referenceNote, setReferenceNote] = useState("");
  const [proofFile, setProofFile] = useState(null);

  const selectedPackage = useMemo(() => {
    if (!config?.packages) {
      return null;
    }
    return config.packages[packageKey] || null;
  }, [config, packageKey]);

  useEffect(() => {
    Promise.resolve(logAuditEvent("BILLING_PAGE_VIEWED", {
      path: "/billing",
    })).catch(() => {});
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setFlowMessage("");
      try {
        const [balancePayload, configPayload, paymentsPayload] = await Promise.all([
          getCreditBalance(),
          getManualPaymentConfig(),
          listManualPayments(),
        ]);

        setCreditBalance(balancePayload?.credit_balance ?? 0);
        setConfig(configPayload || null);
        setPayments(Array.isArray(paymentsPayload) ? paymentsPayload : []);

        if (configPayload?.methods?.includes("GCASH")) {
          setPaymentMethod("GCASH");
        } else if (configPayload?.methods?.[0]) {
          setPaymentMethod(configPayload.methods[0]);
        }
      } catch (error) {
        setFlowMessage(error?.message || "Failed to load billing data.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  async function refreshPayments() {
    try {
      const [balancePayload, paymentsPayload] = await Promise.all([
        getCreditBalance(),
        listManualPayments(),
      ]);
      setCreditBalance(balancePayload?.credit_balance ?? 0);
      setPayments(Array.isArray(paymentsPayload) ? paymentsPayload : []);
    } catch {
      // Silent refresh failure should not break the page after submission.
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!proofFile) {
      setFlowMessage("Please upload your payment proof (image or PDF).");
      return;
    }

    setSubmitting(true);
    setFlowMessage("");
    try {
      await submitManualPayment({
        packageKey,
        paymentMethod,
        referenceNumber,
        referenceNote,
        proofFile,
      });

      setReferenceNumber("");
      setReferenceNote("");
      setProofFile(null);
      setFlowMessage("Payment submitted for review. Your payment is now pending admin verification.");
      await refreshPayments();
    } catch (error) {
      setFlowMessage(error?.message || "Failed to submit manual payment.");
    } finally {
      setSubmitting(false);
    }
  }

  const methodInstructions = config?.instructions?.[paymentMethod] || {};

  return (
    <div style={{ maxWidth: "860px", display: "grid", gap: "18px" }}>
      <div style={CARD_STYLE}>
        <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#1a2332", marginBottom: "8px" }}>
          Billing
        </h1>
        <p style={{ fontSize: "14px", color: "#6b7280", marginBottom: "14px" }}>
          {config?.paymongo_enabled
            ? "PayMongo checkout is active. Manual payment is also available with admin review."
            : "PayMongo checkout is temporarily disabled while we validate product-market fit. Manual payment is active using fixed bundles and admin review."}
        </p>
        <div style={{ fontSize: "14px", color: "#1f2937", fontWeight: 600 }}>
          Current Credits: {creditBalance ?? "-"}
        </div>
      </div>

      <div style={CARD_STYLE}>
        <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#1a2332", marginBottom: "14px" }}>
          Submit Manual Payment
        </h2>

        {loading ? (
          <p style={{ color: "#6b7280", fontSize: "14px" }}>Loading billing configuration...</p>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "grid", gap: "14px" }}>
            <label style={{ display: "grid", gap: "6px" }}>
              <span style={{ fontSize: "13px", color: "#374151", fontWeight: 600 }}>Credit Bundle</span>
              <select
                value={packageKey}
                onChange={(event) => setPackageKey(event.target.value)}
                style={{ border: "1px solid #d1d5db", borderRadius: "8px", padding: "10px 12px" }}
              >
                {Object.entries(config?.packages || {}).map(([key, info]) => (
                  <option key={key} value={key}>
                    {info.description}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: "grid", gap: "6px" }}>
              <span style={{ fontSize: "13px", color: "#374151", fontWeight: 600 }}>Payment Method</span>
              <select
                value={paymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value)}
                style={{ border: "1px solid #d1d5db", borderRadius: "8px", padding: "10px 12px" }}
              >
                {(config?.methods || []).map((method) => (
                  <option key={method} value={method}>{method}</option>
                ))}
              </select>
            </label>

            <div
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: "10px",
                padding: "12px",
                backgroundColor: "#f9fafb",
                display: "grid",
                gap: "4px",
              }}
            >
              <div style={{ fontSize: "13px", color: "#111827", fontWeight: 600 }}>
                {paymentMethod} Payment Instructions
              </div>
              <div style={{ fontSize: "13px", color: "#374151" }}>Account: {methodInstructions.name || "Not configured"}</div>
              <div style={{ fontSize: "13px", color: "#374151" }}>Number: {methodInstructions.number || "Not configured"}</div>
              {methodInstructions.qr_url && (
                <div style={{ marginTop: "6px" }}>
                  <img
                    src={methodInstructions.qr_url}
                    alt={`${paymentMethod} QR Code`}
                    style={{ width: "160px", height: "160px", objectFit: "contain", border: "1px solid #e5e7eb", borderRadius: "8px", padding: "6px", backgroundColor: "#fff", display: "block" }}
                  />
                </div>
              )}
              <div style={{ marginTop: "6px", fontSize: "12px", color: "#6b7280" }}>
                Send the exact bundle amount and upload a clear screenshot or PDF receipt.
              </div>
            </div>

            <label style={{ display: "grid", gap: "6px" }}>
              <span style={{ fontSize: "13px", color: "#374151", fontWeight: 600 }}>Reference Number</span>
              <input
                value={referenceNumber}
                onChange={(event) => setReferenceNumber(event.target.value)}
                required
                placeholder="Example: 1234567890"
                style={{ border: "1px solid #d1d5db", borderRadius: "8px", padding: "10px 12px" }}
              />
            </label>

            <label style={{ display: "grid", gap: "6px" }}>
              <span style={{ fontSize: "13px", color: "#374151", fontWeight: 600 }}>Reference Note (optional)</span>
              <input
                value={referenceNote}
                onChange={(event) => setReferenceNote(event.target.value)}
                placeholder="Optional internal note"
                style={{ border: "1px solid #d1d5db", borderRadius: "8px", padding: "10px 12px" }}
              />
            </label>

            <label style={{ display: "grid", gap: "6px" }}>
              <span style={{ fontSize: "13px", color: "#374151", fontWeight: 600 }}>Upload Proof (PNG/JPG/PDF, max 10MB)</span>
              <input
                type="file"
                accept=".png,.jpg,.jpeg,.pdf,image/png,image/jpeg,application/pdf"
                onChange={(event) => setProofFile(event.target.files?.[0] || null)}
                required
              />
            </label>

            <div style={{ fontSize: "13px", color: "#111827", fontWeight: 600 }}>
              Selected bundle: {selectedPackage ? `${selectedPackage.credits} credit(s) for PHP ${selectedPackage.amount_php}` : "-"}
            </div>

            <button
              type="submit"
              disabled={submitting}
              style={{
                border: "none",
                borderRadius: "8px",
                padding: "11px 14px",
                backgroundColor: submitting ? "#94a3b8" : "#0f766e",
                color: "#fff",
                fontWeight: 600,
                cursor: submitting ? "not-allowed" : "pointer",
              }}
            >
              {submitting ? "Submitting..." : "Submit Payment for Review"}
            </button>
          </form>
        )}

        {flowMessage && (
          <p style={{ marginTop: "12px", fontSize: "13px", color: flowMessage.toLowerCase().includes("failed") || flowMessage.toLowerCase().includes("error") ? "#dc2626" : "#065f46" }}>
            {flowMessage}
          </p>
        )}
      </div>

      <div style={CARD_STYLE}>
        <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#1a2332", marginBottom: "14px" }}>
          My Payment Submissions
        </h2>

        {payments.length === 0 ? (
          <p style={{ fontSize: "14px", color: "#6b7280" }}>No manual payments submitted yet.</p>
        ) : (
          <div style={{ display: "grid", gap: "10px" }}>
            {payments.map((payment) => {
              const badge = statusStyle(payment.status);
              return (
                <div
                  key={payment.id}
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: "10px",
                    padding: "12px",
                    display: "grid",
                    gap: "4px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                    <span style={{ fontSize: "13px", fontWeight: 600, color: "#111827" }}>
                      {payment.package_key} • PHP {payment.amount_php}
                    </span>
                    <span
                      style={{
                        fontSize: "12px",
                        fontWeight: 700,
                        borderRadius: "999px",
                        padding: "3px 10px",
                        ...badge,
                      }}
                    >
                      {payment.status}
                    </span>
                  </div>
                  <div style={{ fontSize: "13px", color: "#374151" }}>
                    {payment.payment_method} • Ref {payment.reference_number}
                  </div>
                  <div style={{ fontSize: "12px", color: "#6b7280" }}>
                    Submitted: {new Date(payment.created_at).toLocaleString()}
                  </div>
                  {payment.admin_notes && (
                    <div style={{ fontSize: "12px", color: "#6b7280" }}>Admin note: {payment.admin_notes}</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
