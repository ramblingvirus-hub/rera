import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation, useParams } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import InterviewPage from "./InterviewPage";

vi.mock("../interview/questions", () => ({
  getQuestionsForContext: vi.fn(() => [
    {
      id: "q1",
      label: "Property reference or name",
      type: "text",
      section: "Project Information",
    },
  ]),
  PRIVATE_SALE_SUPPLEMENTAL_QUESTION_IDS: [],
  getContextProfile: vi.fn(() => "developer_project"),
}));

vi.mock("../interview/QuestionRenderer", () => ({
  default: ({ question, value, onChange }) => (
    <div>
      <label htmlFor={question.id}>{question.label}</label>
      <input
        id={question.id}
        value={value || ""}
        onChange={(event) => onChange(question.id, event.target.value)}
      />
    </div>
  ),
}));

vi.mock("../api/apiClient", () => ({
  startInterview: vi.fn(),
  getInterview: vi.fn(),
  saveInterview: vi.fn(),
  submitInterview: vi.fn(),
}));

import {
  getInterview,
  saveInterview,
  startInterview,
  submitInterview,
} from "../api/apiClient";

function ReportProbe() {
  const location = useLocation();
  const params = useParams();

  return (
    <div>
      <div>Report route: {params.request_id}</div>
      <div>Preview: {location.state?.anonymousPreview ? "yes" : "no"}</div>
      <div>Interview ID: {location.state?.interviewId || "missing"}</div>
    </div>
  );
}

describe("InterviewPage preview submission", () => {
  afterEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("preserves interview state and navigates with preview metadata for anonymous teaser submissions", async () => {
    startInterview.mockResolvedValue({ id: "iv-1" });
    getInterview.mockResolvedValue({
      id: "iv-1",
      responses: { q1: "Sample Towers" },
    });
    saveInterview.mockResolvedValue({ ok: true });
    submitInterview.mockResolvedValue({
      request_id: "req-789",
      preview: true,
      report: { total_score: 27.75, risk_band: "HIGH_RISK" },
      context: { project_name: "Sample Towers" },
    });

    render(
      <MemoryRouter initialEntries={["/new"]}>
        <Routes>
          <Route path="/new" element={<InterviewPage />} />
          <Route path="/report/:request_id" element={<ReportProbe />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: /start evaluation/i }));

    await screen.findByDisplayValue("Sample Towers");

    fireEvent.click(screen.getByRole("button", { name: /review answers/i }));
    fireEvent.click(screen.getByRole("button", { name: /run evaluation/i }));

    await waitFor(() => {
      expect(submitInterview).toHaveBeenCalledWith("iv-1");
      expect(screen.getByText("Report route: req-789")).toBeInTheDocument();
      expect(screen.getByText("Preview: yes")).toBeInTheDocument();
      expect(screen.getByText("Interview ID: iv-1")).toBeInTheDocument();
      expect(localStorage.getItem("rera_interview_id")).toBe("iv-1");
    });
  });

  it("does not auto-load a stale interview ID when opening a new evaluation", async () => {
    localStorage.setItem("rera_interview_id", "old-draft-id");
    startInterview.mockResolvedValue({ id: "iv-fresh" });
    getInterview.mockResolvedValue({
      id: "iv-fresh",
      responses: {},
    });

    render(
      <MemoryRouter initialEntries={["/new"]}>
        <Routes>
          <Route path="/new" element={<InterviewPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(getInterview).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /start evaluation/i }));

    await waitFor(() => {
      expect(startInterview).toHaveBeenCalled();
      expect(getInterview).toHaveBeenCalledWith("iv-fresh");
      expect(localStorage.getItem("rera_interview_id")).toBe("iv-fresh");
    });
  });
})