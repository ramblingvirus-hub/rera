import { useEffect } from "react";

import { logAuditEvent } from "../api/apiClient";

export default function BillingPage() {
  useEffect(() => {
    Promise.resolve(logAuditEvent("BILLING_PAGE_VIEWED", {
      path: "/billing",
    })).catch(() => {});
  }, []);

  return (
    <div style={{ maxWidth: "560px" }}>
      <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#1a2332", marginBottom: "8px" }}>
        Billing
      </h1>
      <p style={{ fontSize: "14px", color: "#6b7280" }}>
        Manage credits and subscriptions from the Report view. A dedicated billing
        dashboard is coming soon.
      </p>
    </div>
  );
}
