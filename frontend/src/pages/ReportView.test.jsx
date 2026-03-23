import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import ReportView from "./ReportView";

vi.mock("../api/apiClient", () => ({
  getReport: vi.fn(),
  listReports: vi.fn(),
  getCreditBalance: vi.fn(),
  initiateCreditPurchase: vi.fn(),
  confirmCreditPurchase: vi.fn(),
  activateSubscription: vi.fn(),
  login: vi.fn(),
  isAuthenticated: vi.fn(),
}));

import {
  activateSubscription,
  confirmCreditPurchase,
  getCreditBalance,
  getReport,
  initiateCreditPurchase,
  isAuthenticated,
  listReports,
  login,
} from "../api/apiClient";

function LoginProbe() {
  const location = useLocation();
  return <div>Login redirect: {location.state?.from || "missing"}</div>;
}

const teaserReport = {
  total_score: 67,
  risk_band: "HIGH_RISK",
  category_breakdown: {
    developer_legitimacy: 60,
    project_compliance: 52,
    title_land: 58,
    financial_exposure: 47,
    lgu_environment: 61,
  },
};

const teaserContext = {
  project_name: "Sample Towers",
  city: "Makati",
};

describe("ReportView teaser hardening", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders an anonymous teaser without fetching the full report", () => {
    isAuthenticated.mockReturnValue(false);

    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: "/report/req-123",
            search: "?src=teaser",
            state: {
              anonymousPreview: true,
              submittedReport: teaserReport,
              submittedContext: teaserContext,
            },
          },
        ]}
      >
        <Routes>
          <Route path="/report/:request_id" element={<ReportView />} />
          <Route path="/login" element={<LoginProbe />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText(/sample towers/i)).toBeInTheDocument();
    expect(screen.getByText(/full report locked/i)).toBeInTheDocument();
    expect(screen.getByText(/unlock to view category scores/i)).toBeInTheDocument();
    expect(getReport).not.toHaveBeenCalled();
  });

  it("preserves the report path when an anonymous user starts an unlock action", () => {
    isAuthenticated.mockReturnValue(false);

    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: "/report/req-123",
            search: "?src=teaser",
            state: {
              anonymousPreview: true,
              submittedReport: teaserReport,
              submittedContext: teaserContext,
            },
          },
        ]}
      >
        <Routes>
          <Route path="/report/:request_id" element={<ReportView />} />
          <Route path="/login" element={<LoginProbe />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(screen.getAllByRole("button", { name: /buy credits/i })[0]);

    expect(screen.getByText("Login redirect: /report/req-123?src=teaser")).toBeInTheDocument();
    expect(initiateCreditPurchase).not.toHaveBeenCalled();
    expect(confirmCreditPurchase).not.toHaveBeenCalled();
    expect(activateSubscription).not.toHaveBeenCalled();
    expect(getCreditBalance).not.toHaveBeenCalled();
    expect(listReports).not.toHaveBeenCalled();
    expect(login).not.toHaveBeenCalled();
  });

  it("fetches the full report for an authenticated user on teaser route", async () => {
    isAuthenticated.mockReturnValue(true);
    getReport.mockResolvedValue({
      report: {
        ...teaserReport,
        signals: ["Signal A"],
        information_gaps: ["Gap A"],
        suggestions: ["Suggestion A"],
      },
      access: {
        can_view_full_report: true,
        credit_balance: 0,
        subscription_active: false,
        subscription_days_remaining: 0,
        locked_sections: [],
      },
      context: teaserContext,
    });

    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: "/report/req-123",
            state: {
              anonymousPreview: true,
              submittedReport: teaserReport,
              submittedContext: teaserContext,
            },
          },
        ]}
      >
        <Routes>
          <Route path="/report/:request_id" element={<ReportView />} />
          <Route path="/login" element={<LoginProbe />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(getReport).toHaveBeenCalledWith("req-123");
    });
  });
})