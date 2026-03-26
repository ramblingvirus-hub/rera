import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useLocation } from "react-router-dom";

import AppShell from "./layouts/AppShell";
import { GuestRoute, ProtectedRoute, SuperadminRoute } from "./components/AuthGuards";
import LoginPage from "./pages/LoginPage";
import Dashboard from "./pages/Dashboard";
import LandingPage from "./pages/LandingPage";
import InterviewPage from "./pages/InterviewPage";
import ReportsListPage from "./pages/ReportsListPage";
import ReportView from "./pages/ReportView";
import AccountPage from "./pages/AccountPage";
import BillingPage from "./pages/BillingPage";
import PrivacyPolicyPage from "./pages/PrivacyPolicyPage";
import TermsOfServicePage from "./pages/TermsOfServicePage";
import RegisterPage from "./pages/RegisterPage";
import AuditDashboard from "./pages/AuditDashboard";
import { isAuthenticated, logAuditEvent } from "./api/apiClient";

function AuditRouteTracker() {
  const location = useLocation();

  useEffect(() => {
    if (!isAuthenticated()) {
      return;
    }

    Promise.resolve(logAuditEvent("PAGE_VIEW", {
      path: `${location.pathname}${location.search}`,
    })).catch(() => {
      // Logging failures must not block navigation.
    });
  }, [location.pathname, location.search]);

  return null;
}

function App() {
  return (
    <BrowserRouter>
      <AuditRouteTracker />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
        <Route path="/terms-of-service" element={<TermsOfServicePage />} />
        <Route
          path="/login"
          element={
            <GuestRoute>
              <LoginPage />
            </GuestRoute>
          }
        />
        <Route
          path="/register"
          element={
            <GuestRoute>
              <RegisterPage />
            </GuestRoute>
          }
        />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <AppShell breadcrumb={{ current: "Dashboard", parent: "Dashboard" }}>
                <Dashboard />
              </AppShell>
            </ProtectedRoute>
          }
        />

        <Route
          path="/new"
          element={
            <AppShell breadcrumb={{ parent: "Dashboard", current: "New Evaluation" }}>
              <InterviewPage />
            </AppShell>
          }
        />

        <Route
          path="/reports"
          element={
            <ProtectedRoute>
              <AppShell breadcrumb={{ parent: "Dashboard", current: "Reports" }}>
                <ReportsListPage />
              </AppShell>
            </ProtectedRoute>
          }
        />

        <Route
          path="/report/:request_id"
          element={
            <AppShell>
              <ReportView />
            </AppShell>
          }
        />

        <Route
          path="/billing"
          element={
            <ProtectedRoute>
              <AppShell breadcrumb={{ parent: "Dashboard", current: "Billing" }}>
                <BillingPage />
              </AppShell>
            </ProtectedRoute>
          }
        />

        <Route
          path="/account"
          element={
            <ProtectedRoute>
              <AppShell breadcrumb={{ parent: "Dashboard", current: "Account" }}>
                <AccountPage />
              </AppShell>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/audit"
          element={
            <SuperadminRoute>
              <AppShell breadcrumb={{ parent: "Dashboard", current: "Audit Dashboard" }}>
                <AuditDashboard />
              </AppShell>
            </SuperadminRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
