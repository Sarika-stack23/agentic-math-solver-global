import { test, expect } from '@playwright/test';

// Helper to signup in E2E tests with mocked Firebase
async function signupAndLogin(page: any) {
  await page.route(/.*identitytoolkit\.googleapis\.com.*/, async (route) => {
    const url = route.request().url();
    if (url.includes('accounts:lookup')) {
      await route.fulfill({
        json: { kind: 'identitytoolkit#GetAccountInfoResponse', users: [{ localId: 'mock-user-id', email: 'test@example.com', emailVerified: false }] }
      });
    } else {
      await route.fulfill({
        json: { kind: 'identitytoolkit#SignupNewUserResponse', idToken: 'mock-firebase-id-token', email: 'test@example.com', refreshToken: 'mock-refresh-token', expiresIn: '3600', localId: 'mock-user-id' }
      });
    }
  });
  await page.goto('/login');
  await page.getByTestId('auth-toggle').click();
  const testEmail = `test-${Date.now()}@example.com`;
  await page.getByPlaceholder('name@example.com').fill(testEmail);
  await page.getByPlaceholder('••••••••').fill('Password123!');
  await page.getByRole('button', { name: 'Create Account', exact: true }).click();
  await page.waitForURL('**/')
  await page.goto('/solve');
}

// Helper to mock the chat stream endpoint with a deterministic SSE response
async function mockChatStream(page: any) {
  await page.route(/.*\/api\/v1\/chat\/stream.*/, async (route) => {
    const sseBody = [
      'data: {"content":"**Step 1** — Subtract 5 from both sides\\n","type":"token"}\n\n',
      'data: {"content":"   2x + 5 - 5 = 15 - 5\\n","type":"token"}\n\n',
      'data: {"content":"   2x = 10\\n\\n","type":"token"}\n\n',
      'data: {"content":"**Step 2** — Divide both sides by 2\\n","type":"token"}\n\n',
      'data: {"content":"   x = 5\\n\\n","type":"token"}\n\n',
      'data: {"content":"✅ **Answer: x = 5**","type":"token"}\n\n',
      'data: [DONE]\n\n',
    ].join('');

    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
      body: sseBody,
    });
  });

  // Also mock progress increment
  await page.route(/.*\/api\/v1\/progress\/increment.*/, async (route) => {
    await route.fulfill({ json: { status: 'ok' } });
  });
}

test.describe('Global AI Math Tutor - Core E2E', () => {
  test.beforeEach(async ({ page }) => {
    await signupAndLogin(page);
  });

  test('Application startup and UI', async ({ page }) => {
    // Verify title
    await expect(page).toHaveTitle(/AI_MATH_TUTOR/i);
    // Verify main input is visible
    await expect(page.locator('input[placeholder*="Enter a math problem"]')).toBeVisible({ timeout: 10000 });
  });

  test('Basic Chat Flow', async ({ page }) => {
    const input = page.locator('input[placeholder*="Enter a math problem"]');
    await expect(input).toBeVisible({ timeout: 10000 });
    await input.fill('2x + 5 = 15');
    await input.press('Enter');
    
    // Check that response stream initializes
    const responseArea = page.locator('.message-assistant').last();
    await expect(responseArea).toBeVisible({ timeout: 60000 });
  });

  test('Check My Work', async ({ page }) => {
    // Mock the backend to avoid LLM quota issues
    await mockChatStream(page);

    const input = page.locator('input[placeholder*="Enter a math problem"]');
    await expect(input).toBeVisible({ timeout: 10000 });
    await input.fill('2x + 5 = 15');
    await input.press('Enter');
    
    const responseArea = page.locator('.message-assistant').last();
    await expect(responseArea).toBeVisible({ timeout: 30000 });
    
    const btn = page.locator('text=Check My Work').first();
    await expect(btn).toBeVisible({ timeout: 30000 });
    await btn.click();
    
    await expect(responseArea).toBeVisible({ timeout: 15000 });
  });

  test('Two-User Browser Isolation', async ({ browser }) => {
    // Context A
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    await pageA.goto('/');
    await pageA.evaluate(() => localStorage.setItem('TEST_ISOLATION', 'USER_A'));

    // Context B
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    await pageB.goto('/');
    const flagB = await pageB.evaluate(() => localStorage.getItem('TEST_ISOLATION'));
    
    expect(flagB).toBeNull(); // Contexts are strictly isolated
  });



  test('XSS Escape Verification', async ({ page }) => {
    const input = page.locator('input[placeholder*="Enter a math problem"]');
    await expect(input).toBeVisible({ timeout: 10000 });
    await input.fill('<script>alert("xss")</script>');
    await input.press('Enter');

    // Make sure alert is NOT triggered
    let dialogTriggered = false;
    page.on('dialog', () => { dialogTriggered = true; });

    const responseArea = page.locator('.message-user').last();
    await expect(responseArea).toContainText('<script>alert("xss")</script>', { timeout: 10000 });
    expect(dialogTriggered).toBe(false);
  });
});
