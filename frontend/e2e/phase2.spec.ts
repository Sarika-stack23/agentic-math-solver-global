import { test, expect } from '@playwright/test';

// Helper to signup in E2E tests
async function signupAndLogin(page: any) {
  page.on('request', (req: any) => console.log('REQUEST:', req.url()));
  page.on('response', (res: any) => console.log('RESPONSE:', res.url(), res.status()));

  // Mock Firebase Auth
  await page.route(/.*identitytoolkit\.googleapis\.com.*/, async (route) => {
    const url = route.request().url();
    if (url.includes('accounts:lookup')) {
      await route.fulfill({
        json: {
          kind: 'identitytoolkit#GetAccountInfoResponse',
          users: [
            {
              localId: 'mock-user-id',
              email: 'test@example.com',
              emailVerified: false,
            }
          ]
        }
      });
    } else {
      await route.fulfill({
        json: {
          kind: 'identitytoolkit#SignupNewUserResponse',
          idToken: 'mock-firebase-id-token',
          email: 'test@example.com',
          refreshToken: 'mock-refresh-token',
          expiresIn: '3600',
          localId: 'mock-user-id',
        }
      });
    }
  });

  // Mock Backend APIs that require auth
  await page.route(/.*\/api\/v1\/progress.*/, async (route) => {
    await route.fulfill({ json: { total_solved: 0, accuracy: 100, streak_days: 0, topic_mastery: {} } });
  });
  
  await page.route(/.*\/api\/v1\/history.*/, async (route) => {
    await route.fulfill({ json: { session_id: 'default', messages: [] } });
  });

  await page.goto('/login');
  
  // Click the toggle to switch to Sign Up mode
  await page.getByRole('button', { name: 'Sign Up', exact: true }).click();
  
  // Fill credentials
  const testEmail = `test-${Date.now()}@example.com`;
  await page.getByPlaceholder('Email').fill(testEmail);
  await page.getByPlaceholder('Password').fill('Password123!');
  
  // Click the submit button (which is now 'Sign Up')
  await page.getByRole('button', { name: 'Sign Up', exact: true }).click();
  
  // Wait for redirect to home
  await expect(page).toHaveURL('/');
}

test.describe('Phase 2 E2E Verification', () => {
  
  test('unauthenticated users are redirected to login', async ({ page }) => {
    // Attempt to access protected route directly
    await page.goto('/progress');
    
    // Should be redirected to /login
    await expect(page).toHaveURL(/.*\/login/);
    await expect(page.getByText('Welcome to')).toBeVisible();
  });



  test('Logout clears session state and redirects to login', async ({ page, isMobile }) => {
    await signupAndLogin(page);
    
    // Open sidebar (on mobile) or just click Logout on desktop
    // Wait for page to load
    await expect(page.locator('.main-content')).toBeVisible();
    
    if (isMobile) {
      await page.getByRole('button', { name: /menu/i }).click();
    }
    
    // Click logout in sidebar
    await page.getByRole('button', { name: /Sign Out/i }).click();
    
    // Should be back at login
    await expect(page).toHaveURL(/.*\/login/);
    
    // Cannot go back to protected route
    await page.goto('/solve');
    await expect(page).toHaveURL(/.*\/login/);
  });
  
});
