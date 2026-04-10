import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
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
import ContactPage from "./pages/ContactPage";
import RegisterPage from "./pages/RegisterPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import AuditDashboard from "./pages/AuditDashboard";
import AdminPaymentsPage from "./pages/AdminPaymentsPage";
import { isAuthenticated, logAuditEvent } from "./api/apiClient";

function SessionExpiryWatcher() {
  const navigate = useNavigate();

  useEffect(() => {
    function handleSessionExpired() {
      navigate("/login", { replace: true, state: { sessionExpired: true } });
    }

    window.addEventListener("auth:session-expired", handleSessionExpired);
    return () => {
      window.removeEventListener("auth:session-expired", handleSessionExpired);
    };
  }, [navigate]);

  return null;
}

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
      <SessionExpiryWatcher />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
        <Route path="/terms-of-service" element={<TermsOfServicePage />} />
        <Route path="/contact" element={<ContactPage />} />
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
          path="/forgot-password"
          element={
            <GuestRoute>
              <ForgotPasswordPage />
            </GuestRoute>
          }
        />

        <Route
          path="/reset-password"
          element={
            <GuestRoute>
              <ResetPasswordPage />
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
            <ProtectedRoute>
              <AppShell breadcrumb={{ parent: "Dashboard", current: "New Evaluation" }}>
                <InterviewPage />
              </AppShell>
            </ProtectedRoute>
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

        <Route
          path="/admin/payments"
          element={
            <SuperadminRoute>
              <AppShell breadcrumb={{ parent: "Dashboard", current: "Manual Payments" }}>
                <AdminPaymentsPage />
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
