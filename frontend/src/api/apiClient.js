
function resolveDefaultBackendOrigin() {
  if (typeof window !== "undefined" && window.location?.hostname) {
    return `${window.location.protocol}//${window.location.hostname}:8000`;
  }
  return "http://127.0.0.1:8000";
}

function normalizeOrigin(origin) {
  return origin.replace(/\/$/, "");
}

function resolveBackendOrigin() {
  const configuredOrigin = import.meta.env.VITE_BACKEND_ORIGIN?.trim();

  if (configuredOrigin) {
    return normalizeOrigin(configuredOrigin);
  }

  const fallbackOrigin = resolveDefaultBackendOrigin();

  if (import.meta.env.PROD) {
    throw new Error(
      "Missing VITE_BACKEND_ORIGIN in production build. Configure it in your frontend deployment environment."
    );
  }

  console.warn(
    `[api] VITE_BACKEND_ORIGIN is not set. Falling back to ${fallbackOrigin} for local development.`
  );

  return fallbackOrigin;
}

const BACKEND_ORIGIN = resolveBackendOrigin();

const API_V1_BASE = `${BACKEND_ORIGIN}/api/v1`;
const TOKEN_OBTAIN_URL = `${BACKEND_ORIGIN}/api/token/`;
const TOKEN_REFRESH_URL = `${BACKEND_ORIGIN}/api/token/refresh/`;

export function getBackendOrigin() {
  return BACKEND_ORIGIN;
}

const ACCESS_TOKEN_KEY = "access_token";
const REFRESH_TOKEN_KEY = "refresh_token";

let refreshPromise = null;

function parseJwtPayload(token) {
  if (!token || typeof token !== "string") {
    return null;
  }

  try {
    const base64 = token.split(".")[1];
    if (!base64) {
      return null;
    }

    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

function buildApiUrl(path) {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_V1_BASE}${normalizedPath}`;
}

function storeTokens({ access, refresh }) {
  if (typeof access === "string" && access.length > 0) {
    localStorage.setItem(ACCESS_TOKEN_KEY, access);
  }

  if (typeof refresh === "string" && refresh.length > 0) {
    localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
  }
}

function parseResponsePayload(text) {
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

function createNetworkError(error) {
  return new ApiError(
    "Unable to reach the server. Check that the backend is running and try again.",
    0,
    error
  );
}

async function fetchWithNetworkHandling(url, options) {
  try {
    return await fetch(url, options);
  } catch (error) {
    throw createNetworkError(error);
  }
}

function normalizeApiError(response, payload) {
  const fallbackMessage = `Request failed with status ${response.status}`;

  if (payload && typeof payload === "object") {
    if (typeof payload.error === "string") {
      return payload.error;
    }

    if (payload.error && typeof payload.error === "object") {
      if (typeof payload.error.message === "string") {
        return payload.error.message;
      }

      if (typeof payload.error.type === "string") {
        return payload.error.type;
      }
    }

    if (typeof payload.detail === "string") {
      return payload.detail;
    }
  }

  if (typeof payload === "string" && payload.trim()) {
    return payload;
  }

  return fallbackMessage;
}

async function parseResponse(response) {
  const rawText = await response.text();
  const payload = parseResponsePayload(rawText);

  if (!response.ok) {
    throw new ApiError(
      normalizeApiError(response, payload),
      response.status,
      payload
    );
  }

  return payload;
}

async function refreshAccessToken() {
  const refresh = localStorage.getItem(REFRESH_TOKEN_KEY);

  if (!refresh) {
    clearAuthTokens();
    window.dispatchEvent(new CustomEvent("auth:session-expired"));
    return false;
  }

  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const response = await fetchWithNetworkHandling(TOKEN_REFRESH_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ refresh }),
        });

        if (!response.ok) {
          clearAuthTokens();
          window.dispatchEvent(new CustomEvent("auth:session-expired"));
          return false;
        }

        const payload = await parseResponse(response);
        storeTokens({ access: payload?.access, refresh: payload?.refresh });
        return true;
      } catch {
        return false;
      } finally {
        refreshPromise = null;
      }
    })();
  }

  return refreshPromise;
}

async function apiRequest(path, options = {}) {
  const {
    method = "GET",
    body,
    auth = true,
    headers = {},
    retryOn401 = true,
  } = options;

  const resolvedHeaders = { ...headers };
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);

  if (auth && token) {
    resolvedHeaders.Authorization = `Bearer ${token}`;
  }

  const isJsonBody = body !== undefined && !(body instanceof FormData);

  if (isJsonBody) {
    resolvedHeaders["Content-Type"] = "application/json";
  }

  const response = await fetchWithNetworkHandling(buildApiUrl(path), {
    method,
    headers: resolvedHeaders,
    body: isJsonBody ? JSON.stringify(body) : body,
  });

  if (response.status === 401 && auth && retryOn401) {
    const refreshed = await refreshAccessToken();

    if (refreshed) {
      return apiRequest(path, {
        ...options,
        retryOn401: false,
      });
    }

    // Refresh failed — session is fully expired; surface a clean error.
    throw new ApiError("Session expired. Please log in again.", 401, null);
  }

  return parseResponse(response);
}

export function getAuthTokens() {
  return {
    access: localStorage.getItem(ACCESS_TOKEN_KEY),
    refresh: localStorage.getItem(REFRESH_TOKEN_KEY),
  };
}

export function setAuthTokens(tokens) {
  storeTokens(tokens);
}

export function clearAuthTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function isAuthenticated() {
  return Boolean(localStorage.getItem(ACCESS_TOKEN_KEY));
}

export function getCurrentUser() {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  const payload = parseJwtPayload(token);
  if (!payload) {
    return null;
  }

  return {
    user_id: payload.user_id ?? null,
    username: payload.username || null,
    is_superuser: Boolean(payload.is_superuser),
  };
}

export async function register(username, email, password, confirmPassword) {
  return apiRequest("/auth/register/", {
    method: "POST",
    body: { username, email, password, confirm_password: confirmPassword },
  });
}

export async function forgotPassword(email) {
  return apiRequest("/auth/password/forgot/", {
    method: "POST",
    body: { email },
    auth: false,
  });
}

export async function resetPassword(uid, token, password, confirmPassword) {
  return apiRequest("/auth/password/reset/", {
    method: "POST",
    body: {
      uid,
      token,
      password,
      confirm_password: confirmPassword,
    },
    auth: false,
  });
}

export async function changePassword(currentPassword, password, confirmPassword) {
  return apiRequest("/auth/password/change/", {
    method: "POST",
    body: {
      current_password: currentPassword,
      password,
      confirm_password: confirmPassword,
    },
    auth: true,
  });
}

export async function submitContactMessage(payload) {
  return apiRequest("/contact/", {
    method: "POST",
    body: payload,
    auth: false,
  });
}

export async function login(username, password) {
  const response = await fetchWithNetworkHandling(TOKEN_OBTAIN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ username, password }),
  });

  const payload = await parseResponse(response);
  storeTokens({ access: payload?.access, refresh: payload?.refresh });
  return payload;
}

export async function refreshSession() {
  const refreshed = await refreshAccessToken();

  if (!refreshed) {
    throw new ApiError("Session refresh failed", 401, null);
  }

  return getAuthTokens();
}

export async function startInterview() {
  return apiRequest("/interview/start/", {
    method: "POST",
    auth: true,
  });
}

export async function getInterview(interviewId) {
  return apiRequest(`/interview/${interviewId}/`, {
    auth: true,
  });
}

export async function saveInterview(interviewId, responses) {
  return apiRequest(`/interview/${interviewId}/save/`, {
    method: "PATCH",
    body: { responses },
    auth: true,
  });
}

export async function submitInterview(interviewId) {
  return apiRequest(`/interview/${interviewId}/submit/`, {
    method: "POST",
    auth: true,
  });
}

export async function getReport(requestId) {
  return apiRequest(`/reports/${requestId}/`, {
    auth: true,
  });
}

export async function listReports() {
  return apiRequest("/reports/", {
    auth: true,
  });
}

export async function initiateCreditPurchase(packageKey, { successUrl, cancelUrl } = {}) {
  return apiRequest("/billing/credits/purchase/initiate/", {
    method: "POST",
    body: {
      package: packageKey,
      ...(successUrl ? { success_url: successUrl, cancel_url: cancelUrl } : {}),
    },
    auth: true,
  });
}

export async function confirmCreditPurchase(purchaseId) {
  return apiRequest("/billing/credits/purchase/confirm/", {
    method: "POST",
    body: { purchase_id: purchaseId },
    auth: true,
  });
}

export async function getCreditBalance() {
  return apiRequest("/billing/credits/balance/", {
    auth: true,
  });
}

export async function getManualPaymentConfig() {
  return apiRequest("/billing/manual-payments/config/", {
    auth: true,
  });
}

export async function listManualPayments() {
  return apiRequest("/billing/manual-payments/", {
    auth: true,
  });
}

export async function reconcileManualPayments() {
  return apiRequest("/billing/manual-payments/reconcile/", {
    method: "POST",
    auth: true,
  });
}

export async function listAdminManualPayments(filters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }
    params.set(key, String(value));
  });

  const suffix = params.toString() ? `?${params.toString()}` : "";
  return apiRequest(`/billing/admin/manual-payments/${suffix}`, {
    auth: true,
  });
}

export async function submitManualPayment({ packageKey, paymentMethod, referenceNumber, referenceNote, proofFile }) {
  const form = new FormData();
  form.append("package", packageKey);
  form.append("payment_method", paymentMethod);
  form.append("reference_number", referenceNumber);
  if (referenceNote) {
    form.append("reference_note", referenceNote);
  }
  form.append("proof_file", proofFile);

  return apiRequest("/billing/manual-payments/", {
    method: "POST",
    body: form,
    auth: true,
  });
}

export async function reviewManualPayment(paymentId, action, adminNotes = "") {
  return apiRequest(`/billing/admin/manual-payments/${paymentId}/review/`, {
    method: "POST",
    auth: true,
    body: {
      action,
      admin_notes: adminNotes,
    },
  });
}

export async function activateSubscription(paymongoSubscriptionId, periodDays = 30) {
  return apiRequest("/billing/subscription/activate/", {
    method: "POST",
    body: {
      paymongo_subscription_id: paymongoSubscriptionId,
      period_days: periodDays,
    },
    auth: true,
  });
}

export async function getAdminAuditEvents(filters = {}) {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }
    params.set(key, String(value));
  });

  const suffix = params.toString() ? `?${params.toString()}` : "";
  const payload = await apiRequest(`/ops/events/${suffix}`, {
    auth: true,
  });

  if (Array.isArray(payload)) {
    return {
      count: payload.length,
      limit: Number(filters.limit || payload.length || 0),
      offset: Number(filters.offset || 0),
      next_offset: null,
      results: payload,
    };
  }

  return payload;
}

export async function getAdminSystemFlags() {
  return apiRequest("/ops/system-flags/", {
    auth: true,
  });
}

export async function logAuditEvent(eventType, metadata = {}, options = {}) {
  const { requestId = null, severity = "INFO" } = options;
  return apiRequest("/events/log/", {
    method: "POST",
    auth: true,
    body: {
      event_type: eventType,
      severity,
      request_id: requestId,
      metadata,
    },
  });
}

export { ApiError };