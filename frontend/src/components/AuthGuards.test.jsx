import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GuestRoute, ProtectedRoute, SuperadminRoute } from "./AuthGuards";

vi.mock("../api/apiClient", () => ({
  isAuthenticated: vi.fn(),
  getCurrentUser: vi.fn(),
}));

import { getCurrentUser, isAuthenticated } from "../api/apiClient";

describe("auth guards", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("redirects anonymous users to login and preserves the target path", () => {
    isAuthenticated.mockReturnValue(false);

    render(
      <MemoryRouter initialEntries={["/billing?mode=credits#top"]}>
        <Routes>
          <Route
            path="/billing"
            element={
              <ProtectedRoute>
                <div>Protected billing</div>
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<div>Login screen</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("Login screen")).toBeInTheDocument();
  });

  it("renders protected content for authenticated users", () => {
    isAuthenticated.mockReturnValue(true);

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <div>Dashboard content</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("Dashboard content")).toBeInTheDocument();
  });

  it("redirects authenticated users away from the login page", () => {
    isAuthenticated.mockReturnValue(true);

    render(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route
            path="/login"
            element={
              <GuestRoute>
                <div>Login screen</div>
              </GuestRoute>
            }
          />
          <Route path="/dashboard" element={<div>Dashboard content</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("Dashboard content")).toBeInTheDocument();
  });

  it("redirects non-superusers away from admin audit page", () => {
    isAuthenticated.mockReturnValue(true);
    getCurrentUser.mockReturnValue({ is_superuser: false });

    render(
      <MemoryRouter initialEntries={["/admin/audit"]}>
        <Routes>
          <Route
            path="/admin/audit"
            element={
              <SuperadminRoute>
                <div>Audit dashboard</div>
              </SuperadminRoute>
            }
          />
          <Route path="/dashboard" element={<div>Dashboard content</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("Dashboard content")).toBeInTheDocument();
  });

  it("renders admin page for superusers", () => {
    isAuthenticated.mockReturnValue(true);
    getCurrentUser.mockReturnValue({ is_superuser: true });

    render(
      <MemoryRouter initialEntries={["/admin/audit"]}>
        <Routes>
          <Route
            path="/admin/audit"
            element={
              <SuperadminRoute>
                <div>Audit dashboard</div>
              </SuperadminRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("Audit dashboard")).toBeInTheDocument();
  });
})