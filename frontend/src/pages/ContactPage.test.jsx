import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import ContactPage from "./ContactPage";

vi.mock("../api/apiClient", () => ({
  submitContactMessage: vi.fn(),
}));

import { submitContactMessage } from "../api/apiClient";

describe("ContactPage", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("submits and shows success state", async () => {
    submitContactMessage.mockResolvedValue({ message: "ok" });

    render(
      <MemoryRouter>
        <ContactPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "linus@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/subject/i), {
      target: { value: "Need support now" },
    });
    fireEvent.change(screen.getByLabelText(/message/i), {
      target: { value: "Hello team, I need support with my request." },
    });

    fireEvent.click(screen.getByRole("button", { name: /send message/i }));

    await waitFor(() => {
      expect(submitContactMessage).toHaveBeenCalled();
      expect(screen.getByText(/message received\. our team will review your inquiry\./i)).toBeInTheDocument();
    });
  });
});
