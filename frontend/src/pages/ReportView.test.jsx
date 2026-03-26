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
  logAuditEvent: vi.fn(() => Promise.resolve({})),
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

  it("shows QA unlock button on a locked report when test_unlock flag is present", async () => {
    isAuthenticated.mockReturnValue(false);
    getReport.mockRejectedValue({ status: 401, message: "Unauthorized" });

    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: "/report/req-123",
            search: "?test_unlock=1",
            state: {
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

    expect(await screen.findByRole("button", { name: /continue to full report \(qa\)/i })).toBeInTheDocument();
  });

  it("allows QA unlock from auth gate on direct deep link with no preloaded report", async () => {
    isAuthenticated.mockReturnValue(false);
    getReport.mockRejectedValue({ status: 401, message: "Unauthorized" });

    render(
      <MemoryRouter
        initialEntries={["/report/req-123?test_unlock=1"]}
      >
        <Routes>
          <Route path="/report/:request_id" element={<ReportView />} />
          <Route path="/login" element={<LoginProbe />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole("button", { name: /continue to full report \(qa\)/i }));

    expect(await screen.findByText(/qa preview report/i)).toBeInTheDocument();
    expect(screen.getByText(/assessment summary/i)).toBeInTheDocument();
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

  it("renders assessment summary and strengths when full report is unlocked", async () => {
    isAuthenticated.mockReturnValue(true);
    getReport.mockResolvedValue({
      report: {
        ...teaserReport,
        assessment_summary:
          "This project appears to present a MODERATE level of risk based on the information provided.",
        strengths: [
          "Developer has presented a valid License to Sell.",
          "No environmental hazard concerns were indicated.",
        ],
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

    expect(await screen.findByText(/assessment summary/i)).toBeInTheDocument();
    expect(screen.getByText(/strength indicators/i)).toBeInTheDocument();
    expect(screen.getByText(/developer has presented a valid license to sell/i)).toBeInTheDocument();
    expect(screen.getByText(/recommended next steps/i)).toBeInTheDocument();
  });

  it("renders category interpretation labels in category scores", async () => {
    isAuthenticated.mockReturnValue(true);
    getReport.mockResolvedValue({
      report: {
        ...teaserReport,
        category_interpretations: {
          developer_legitimacy: { label: "Strong" },
          project_compliance: { label: "Moderate" },
          title_land: { label: "Weak" },
          financial_exposure: { label: "High Risk" },
          lgu_environment: { label: "Moderate" },
        },
        assessment_summary: "Summary",
        strengths: ["Strength A"],
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

    expect(await screen.findByText(/category scores/i)).toBeInTheDocument();
    expect(screen.getByText("Strong")).toBeInTheDocument();
    expect(screen.getAllByText("Moderate").length).toBeGreaterThan(0);
    expect(screen.getByText("Weak")).toBeInTheDocument();
    expect(screen.getAllByText("High Risk").length).toBeGreaterThan(0);
  });

  it("renders Not Applicable categories with hidden numeric scores", async () => {
    isAuthenticated.mockReturnValue(true);
    getReport.mockResolvedValue({
      report: {
        ...teaserReport,
        category_interpretations: {
          developer_legitimacy: { label: "Not Applicable" },
          project_compliance: { label: "Not Applicable" },
          title_land: { label: "Moderate" },
          financial_exposure: { label: "Moderate" },
          lgu_environment: { label: "Weak" },
        },
        category_applicability: {
          developer_legitimacy: false,
          project_compliance: false,
          title_land: true,
          financial_exposure: true,
          lgu_environment: true,
        },
        assessment_summary: "Summary",
        strengths: ["Strength A"],
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

    expect(await screen.findByText(/category scores/i)).toBeInTheDocument();
    expect(screen.getAllByText("Not Applicable").length).toBe(2);
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(2);
  });
})