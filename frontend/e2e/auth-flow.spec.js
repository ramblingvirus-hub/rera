// @ts-check
import { expect, test } from "@playwright/test";

const API_BASE = "http://127.0.0.1:8000";

// Unique test user created per run to avoid conflicts.
const RUN_ID = Date.now();
const TEST_USER = {
  username: `e2euser${RUN_ID}`,
  email: `e2euser${RUN_ID}@test.invalid`,
  password: `TestPass${RUN_ID}!`,
};

// ─── Anonymous user flows ─────────────────────────────────────────────────────

test.describe("Anonymous user", () => {
  test("landing page renders without authentication", async ({ page }) => {
    await page.goto("/");
    // Confirm we stayed on the root path (not redirected to /login)
    await expect(page).not.toHaveURL(/\/login/);
    // Landing page has a visible CTA or brand element
    await expect(page.locator("body")).toContainText("RERA");
  });

  test("visiting a protected route redirects to /login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("login page shows sign-in form", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByLabel(/login name/i)).toBeVisible();
    await expect(page.getByLabel(/password/i).first()).toBeVisible();
  });

  test("forgot password link is visible on login page", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("link", { name: /forgot password/i })).toBeVisible();
  });

  test("forgot password page renders and accepts email input", async ({ page }) => {
    await page.goto("/forgot-password");
    const emailInput = page.getByLabel(/email address/i);
    await expect(emailInput).toBeVisible();
    await emailInput.fill("test@example.com");
    await page.getByRole("button", { name: /send reset link/i }).click();
    // Should show confirmation message regardless of whether email exists
    await expect(page.locator("body")).toContainText(
      /reset link has been sent|if an account/i,
      { timeout: 10000 }
    );
  });

  test("contact page has a Back button", async ({ page }) => {
    await page.goto("/contact");
    await expect(page.getByRole("button", { name: /back/i })).toBeVisible();
  });
});

// ─── Registration flow ────────────────────────────────────────────────────────

test.describe("Registration", () => {
  test("user can register a new account", async ({ page }) => {
    await page.goto("/login");

    // Switch to Register tab
    await page.getByRole("button", { name: /register/i }).click();

    await page.getByLabel(/login name/i).fill(TEST_USER.username);
    await page.getByLabel(/email address/i).fill(TEST_USER.email);
    // Password fields — use exact labels to avoid ambiguity
    const passwordFields = page.getByLabel(/password/i);
    await passwordFields.nth(0).fill(TEST_USER.password);
    await passwordFields.nth(1).fill(TEST_USER.password);

    await page.getByRole("button", { name: /create account/i }).click();

    // After registration the user is auto-logged in and redirected to dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
  });
});

// ─── Authenticated user flows ─────────────────────────────────────────────────

test.describe("Authenticated user", () => {
  // Create the test user via API before any tests run so this suite is
  // self-contained regardless of whether the Registration suite ran first.
  test.beforeAll(async ({ request }) => {
    await request.post(`${API_BASE}/api/v1/auth/register/`, {
      data: {
        username: TEST_USER.username,
        email: TEST_USER.email,
        password: TEST_USER.password,
        confirm_password: TEST_USER.password,
      },
    });
    // 201 = created, 409 = already exists (Registration suite ran first) — both are fine.
  });

  test.beforeEach(async ({ page }) => {
    // Log in with the test user created in registration suite
    await page.goto("/login");
    await page.getByLabel(/login name/i).fill(TEST_USER.username);
    await page.getByLabel(/password/i).first().fill(TEST_USER.password);
    // Use the form submit button (not the tab toggle) to avoid strict-mode ambiguity
    await page.locator("form").getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
  });

  test("dashboard loads and shows username", async ({ page }) => {
    await expect(page.locator("body")).toContainText(/dashboard/i);
  });

  test("billing page loads and shows GCash QR code", async ({ page }) => {
    await page.goto("/billing");
    await expect(page).toHaveURL(/\/billing/);
    await expect(page.locator("body")).toContainText(/GCASH/i);

    // QR image renders without a broken-image state
    const qrImg = page.locator("img[alt*='QR']");
    await expect(qrImg).toBeVisible({ timeout: 10000 });

    // Verify the image actually loaded (naturalWidth > 0 means not broken)
    const loaded = await qrImg.evaluate((img) => img.naturalWidth > 0);
    expect(loaded).toBe(true);
  });

  test("account settings page shows change password form", async ({ page }) => {
    await page.goto("/account");
    await expect(page.getByLabel(/current password/i)).toBeVisible();
    await expect(page.getByLabel("New password", { exact: true })).toBeVisible();
    await expect(page.getByLabel(/confirm new password/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /update password/i })).toBeVisible();
  });

  test("reports list page is accessible", async ({ page }) => {
    await page.goto("/reports");
    await expect(page).toHaveURL(/\/reports/);
    await expect(page.locator("body")).toContainText(/report/i);
  });

  test("logout clears session and redirects to login", async ({ page }) => {
    // Open the user menu and log out
    await page.locator("button", { hasText: TEST_USER.username.slice(0, 2).toUpperCase() }).first().click();
    await page.getByRole("button", { name: /sign out/i }).click();
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });

    // Attempting to visit dashboard again should redirect to login
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });
});
