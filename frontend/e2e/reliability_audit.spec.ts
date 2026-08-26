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

  test('Phase 2: Authentication Reliability', async () => {
    test.setTimeout(120000); // 2 minutes for 3 loops
    for (let i = 1; i <= 3; i++) {
      console.log(`\n--- Auth Cycle ${i} ---`);
      
      // 1. Open application
      await page.goto(BASE_URL);
      
      // 2. Login/Signup
      if (i === 1) {
        // First cycle: Ensure we are on Sign Up mode
        const isLoginMode = await page.isVisible('text="Don\'t have an account?"');
        if (isLoginMode) {
            await page.click('text="Sign Up"');
        }
        
        await page.getByPlaceholder('Email').fill(TEST_EMAIL);
        await page.getByPlaceholder('Password').fill(TEST_PASSWORD);
        await page.click('button[type="submit"]');
        // Wait for redirect to /solve
        await page.waitForURL('**/solve', { timeout: 15000 });
      } else {
        // Subsequent cycles: Log In mode
        const isSignUpMode = await page.isVisible('text="Already have an account?"');
        if (isSignUpMode) {
            await page.click('text="Log In"');
        }
        
        await page.getByPlaceholder('Email').fill(TEST_EMAIL);
        await page.getByPlaceholder('Password').fill(TEST_PASSWORD);
        await page.click('button[type="submit"]');
        await page.waitForURL('**/solve', { timeout: 15000 });
      }
      
      // 3. Verify authenticated state
      await expect(page.locator('text="Test User"')).toBeVisible({ timeout: 10000 });

      // 4. Logout
      // Clicking the user profile button to reveal logout
      await page.click('.profile-button');
      await page.click('button:has-text("Logout")');
      await page.waitForURL(BASE_URL);
      
      // 5. Verify protected route is inaccessible
      await page.goto(`${BASE_URL}/solve`);
      await page.waitForURL(BASE_URL); // Should redirect back
    }

    // Final login to leave session active for next phases
    await page.goto(BASE_URL);
    const isSignUpMode = await page.isVisible('text="Already have an account?"');
    if (isSignUpMode) {
        await page.click('text="Log In"');
    }
    await page.getByPlaceholder('Email').fill(TEST_EMAIL);
    await page.getByPlaceholder('Password').fill(TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/solve', { timeout: 15000 });
  });

  test('Phase 3: Core Chat Reliability (Real API)', async () => {
    test.setTimeout(180000); // 3 minutes for chat loop
    const mathQueries = [
      "What is 2 + 2?",
      "Solve 3x + 15 = 45",
      "Calculate the derivative of x^2",
      "Find the area of a circle with radius 5",
      "If a train travels 60 mph for 2 hours, how far did it go?"
    ];

    for (let i = 0; i < mathQueries.length; i++) {
      console.log(`\n--- Chat Interaction ${i + 1}: ${mathQueries[i]} ---`);
      
      const chatInput = page.getByPlaceholder('Ask a math question...');
      await chatInput.fill(mathQueries[i]);
      await chatInput.press('Enter');

      // Wait for the streaming response to complete.
      // We look for the action chips which appear after the stream finishes.
      await expect(page.locator('button:has-text("Check My Work")').last()).toBeVisible({ timeout: 30000 });
      
      // Verify standard rendering elements
      const messages = page.locator('.message-content');
      await expect(messages.last()).toBeVisible();
    }
  });

  test('Phase 4: Check My Work & Phase 5: Hints', async () => {
    test.setTimeout(120000);
    // Click Check My Work on the last message
    await page.locator('button:has-text("Check My Work")').last().click();
    // Wait for validation overlay or response
    await expect(page.locator('text="Check your work"')).toBeVisible({ timeout: 10000 });
    
    // Fill in a partially correct answer
    const workInput = page.getByPlaceholder('Enter your step-by-step working...');
    await workInput.fill("I think the answer is 120");
    await page.locator('button:has-text("Verify")').click();

    // Wait for AI validation response
    await expect(page.locator('.verification-result')).toBeVisible({ timeout: 30000 });
    
    // Close overlay
    await page.click('button.close-modal');

    // Ask for a hint
    await page.locator('button:has-text("Give me a hint")').last().click();
    // Wait for the hint to stream in
    await expect(page.locator('.hint-response').last()).toBeVisible({ timeout: 30000 });
  });

});
