import { test, expect } from '@playwright/test';

// Configuration
const BASE_URL = 'http://localhost:5173';
const TEST_EMAIL = `test_${Date.now()}@example.com`;
const TEST_PASSWORD = 'Password123!';

test.describe('Real-Browser Reliability Audit', () => {

  // We want tests to run sequentially in this file to simulate the soak test
  test.describe.configure({ mode: 'serial' });

  let page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('Phases 4-7: Interactive Features Audit', async () => {
    test.setTimeout(180000);
    
    // Login
    await page.goto(`${BASE_URL}/login`);
    const isSignUpMode = await page.isVisible('text="Already have an account?"');
    if (isSignUpMode) {
        await page.click('text="Log In"');
    }
    await page.getByPlaceholder('Email').fill(TEST_EMAIL);
    await page.getByPlaceholder('Password').fill(TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(BASE_URL, { timeout: 15000 });
    await page.goto(`${BASE_URL}/solve`);
    await page.waitForURL('**/solve', { timeout: 15000 });

    // Send a query
    const chatInput = page.getByPlaceholder('Ask a math question...');
    await chatInput.fill('Solve x/2 + 5 = 15');
    await chatInput.press('Enter');

    // Wait for the action chips to appear
    await expect(page.locator('button:has-text("Check My Work")').last()).toBeVisible({ timeout: 30000 });

    // Phase 4: Check My Work
    await page.locator('button:has-text("Check My Work")').last().click();
    await expect(page.locator('text="Check your work"')).toBeVisible({ timeout: 10000 });
    const workInput = page.getByPlaceholder('Enter your step-by-step working...');
    await workInput.fill("I subtracted 5 to get 10, then multiplied by 2 to get 20");
    await page.locator('button:has-text("Verify")').click();
    await expect(page.locator('.verification-result')).toBeVisible({ timeout: 30000 });
    await page.click('button.close-modal');

    // Phase 5: Hints
    await page.locator('button:has-text("Give me a hint")').last().click();
    await expect(page.locator('.hint-response').last()).toBeVisible({ timeout: 30000 });

    // Phase 6: Teach Me
    await page.locator('button:has-text("Teach me (don\'t solve)")').last().click();
    await expect(page.locator('.teach-me-response').last()).toBeVisible({ timeout: 30000 });

    // Phase 7: Practice mode
    await page.click('a:has-text("Practice")');
    await page.waitForURL('**/practice', { timeout: 15000 });
    await page.click('button:has-text("Start Practice")');
    await expect(page.locator('.practice-question')).toBeVisible({ timeout: 30000 });
  });

});
