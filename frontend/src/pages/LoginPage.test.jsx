import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import LoginPage from "./LoginPage";

vi.mock("../api/apiClient", () => ({
  login: vi.fn(),
  register: vi.fn(),
  initiateCreditPurchase: vi.fn(),
}));

import { login } from "../api/apiClient";

describe("LoginPage", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns the user to the requested page after login", async () => {
    login.mockResolvedValue({ access: "token" });

    render(
      <MemoryRouter initialEntries={[{ pathname: "/login", state: { from: "/billing" } }]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/billing" element={<div>Billing page</div>} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/login name/i), {
      target: { value: "linus" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "secret" },
    });
    fireEvent.click(screen.getByText("Sign In", { selector: "button[type='submit']" }));

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith("linus", "secret");
      expect(screen.getByText("Billing page")).toBeInTheDocument();
    });
  });
})