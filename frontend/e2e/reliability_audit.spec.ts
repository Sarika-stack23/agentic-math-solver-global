import { test, expect, Page } from '@playwright/test';

// Configuration
const BASE_URL = 'http://localhost:3000';
const TEST_PASSWORD = 'Password123!';

/**
 * Helper: create a unique test email per worker to avoid cross-test collisions.
 * Uses a module-level counter + timestamp so serial tests share the same account.
 */
const TEST_EMAIL = `audit_test_user_1@example.com`;

/**
 * Helper: perform sign-up or login for the test user.
 * The form defaults to "Log In" mode. If the user doesn't exist, Firebase
 * returns 400 on signInWithPassword; we detect this and switch to Sign Up.
 */
async function authenticateUser(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/login`);

  // Determine current mode
  const isSignUpMode = await page.isVisible('text="Already have an account?"');

  // If we're in sign-up mode but user probably exists (not first call), switch to Log In
  if (isSignUpMode) {
    // Switch to Login mode first
    const loginToggle = page.locator('button', { hasText: 'Log In' });
    if (await loginToggle.isVisible()) {
      await loginToggle.click();
      await page.waitForTimeout(300);
    }
  }

  await page.locator('input[type="email"]').fill(TEST_EMAIL);
  await page.locator('input[type="password"]').fill(TEST_PASSWORD);
  await page.click('button[type="submit"]');

  // Wait for either: successful redirect to "/" OR an error message
  const successOrError = await Promise.race([
    page.waitForURL(/\/$/, { timeout: 15000 }).then(() => 'success' as const),
    page.locator('text=/error|invalid|not found/i').waitFor({ timeout: 15000 }).then(() => 'error' as const),
  ]).catch(() => 'timeout' as const);

  if (successOrError === 'success') {
    return; // Already logged in
  }

  // Login failed (user doesn't exist) — switch to Sign Up and create account
  console.log('Login failed, switching to Sign Up mode to create account...');
  await page.goto(`${BASE_URL}/login`);

  // Ensure we're in Sign Up mode
  const signUpToggle = page.getByTestId('auth-toggle');
  const toggleText = await signUpToggle.textContent();
  if (toggleText?.includes('Create one now')) {
    await signUpToggle.click();
    await page.waitForTimeout(300);
  }

  await page.locator('input[type="email"]').fill(TEST_EMAIL);
  await page.locator('input[type="password"]').fill(TEST_PASSWORD);
  await page.click('button[type="submit"]');

  // Wait for successful redirect after sign up
  await page.waitForURL(/\/$/, { timeout: 20000 });
}

test.describe('Real-Browser Reliability Audit', () => {

  /**
   * Phase 2: Authentication Reliability
   * Tests sign-up, login, logout, and protected route redirection.
   * Each test gets its own page via Playwright fixtures — no shared state.
   */
  test('Phase 2: Authentication Reliability', async ({ page }) => {
    test.setTimeout(120000);

    page.on('console', msg => {
      if (msg.type() === 'error') console.log('BROWSER ERROR:', msg.text());
    });

    // --- Cycle 1: Initial Sign Up ---
    console.log('\n--- Auth Cycle 1: Sign Up ---');
    await authenticateUser(page);

    // Verify we're on the home page (authenticated)
    await expect(page).toHaveURL(/\/$/);

    // Navigate to /solve to verify protected route access
    await page.goto(`${BASE_URL}/solve`);
    await expect(page).toHaveURL(/\/solve/);

    // Logout via sidebar
    // On desktop the sidebar is always visible; on mobile we need to open it
    const mobileMenuBtn = page.locator('button[aria-label="Open menu"]');
    const isMobile = page.viewportSize()?.width !== undefined && page.viewportSize()!.width < 1024;
    if (isMobile) {
      await mobileMenuBtn.click();
      await page.waitForTimeout(500);
      await page.getByTestId('sign-out-btn-mobile').click();
    } else {
      await page.getByTestId('sign-out-btn').click();
    }
    await page.waitForURL(/\/login/, { timeout: 10000 });
    console.log('Logout successful');

    // Verify protected route redirects to login
    await page.goto(`${BASE_URL}/solve`);
    await page.waitForURL(/\/login/, { timeout: 10000 });
    console.log('Protected route redirect verified');

    // --- Cycle 2: Re-login with existing account ---
    console.log('\n--- Auth Cycle 2: Re-login ---');
    await authenticateUser(page);
    await expect(page).toHaveURL(/\/$/);
    console.log('Re-login successful');

    // --- Cycle 3: Another login cycle ---
    console.log('\n--- Auth Cycle 3: Another re-login ---');

    // Open sidebar and sign out again
    await page.goto(`${BASE_URL}/solve`);
    if (isMobile) {
      await mobileMenuBtn.click();
      await page.waitForTimeout(500);
      await page.getByTestId('sign-out-btn-mobile').click();
    } else {
      await page.getByTestId('sign-out-btn').click();
    }
    await page.waitForURL(/\/login/, { timeout: 10000 });

    await authenticateUser(page);
    await expect(page).toHaveURL(/\/$/);
    console.log('Auth Cycle 3 login successful');

    // Leave session active — navigate to /solve for subsequent use
    await page.goto(`${BASE_URL}/solve`);
    await expect(page).toHaveURL(/\/solve/);
    console.log('Phase 2 PASSED');
  });

  /**
   * Phase 3: Core Chat Reliability (Real API)
   * Tests sending math questions and receiving streaming responses.
   */
  test('Phase 3: Core Chat Reliability (Real API)', async ({ page }) => {
    test.setTimeout(180000);

    // Login first
    await authenticateUser(page);
    await page.goto(`${BASE_URL}/solve`);
    await expect(page).toHaveURL(/\/solve/);

    const mathQueries = [
      'What is 2 + 2?',
      'Solve 3x + 15 = 45',
      'Calculate the derivative of x^2',
    ];

    for (let i = 0; i < mathQueries.length; i++) {
      console.log(`\n--- Chat Interaction ${i + 1}: ${mathQueries[i]} ---`);

      // The placeholder text is "Enter a math problem..." or "Ask a follow-up question..."
      const chatInput = page.getByPlaceholder(/Enter a math problem|Ask a follow-up question/);
      await expect(chatInput).toBeVisible({ timeout: 10000 });
      await chatInput.fill(mathQueries[i]);
      await chatInput.press('Enter');

      // Wait for the streaming response to complete.
      // The action chips (Check My Work, etc.) appear after the stream finishes.
      await expect(
        page.locator('.action-chip').first()
      ).toBeVisible({ timeout: 60000 });

      console.log(`Chat ${i + 1} response received`);

      // Verify that message content rendered
      const messages = page.locator('.message');
      await expect(messages.last()).toBeVisible();
    }

    console.log('Phase 3 PASSED');
  });

  /**
   * Phase 4: Action Chips (Check My Work / Hints / Another Method)
   * Tests that action chip buttons are clickable and produce responses.
   */
  test('Phase 4: Action Chips', async ({ page }) => {
    test.setTimeout(120000);

    // Login and go to solve
    await authenticateUser(page);
    await page.goto(`${BASE_URL}/solve`);
    await expect(page).toHaveURL(/\/solve/);

    // Ask a question first
    const chatInput = page.getByPlaceholder(/Enter a math problem|Ask a follow-up question/);
    await chatInput.fill('What is the area of a circle with radius 5?');
    await chatInput.press('Enter');

    // Wait for action chips to appear
    await expect(page.locator('.action-chip').first()).toBeVisible({ timeout: 60000 });
    console.log('Initial answer received');

    // Get the count of messages before clicking an action chip
    const initialMessageCount = await page.locator('.message').count();

    // Click the first action chip (e.g., "Check My Work")
    const firstChip = page.locator('.action-chip').first();
    const chipText = await firstChip.textContent();
    console.log(`Clicking action chip: "${chipText}"`);
    await firstChip.click();

    // Wait for a new response to appear (message count should increase)
    await expect(async () => {
      const newCount = await page.locator('.message').count();
      expect(newCount).toBeGreaterThan(initialMessageCount);
    }).toPass({ timeout: 60000 });

    console.log('Action chip response received');
    console.log('Phase 4 PASSED');
  });

});
