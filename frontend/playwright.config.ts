import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  timeout: 90000,
  forbidOnly: !!process.env.CI,
  retries: 1,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-375',
      use: { ...devices['iPhone 12'], defaultBrowserType: 'chromium', viewport: { width: 375, height: 812 } },
    },
    {
      name: 'mobile-390',
      use: { ...devices['iPhone 12 Pro'], defaultBrowserType: 'chromium', viewport: { width: 390, height: 844 } },
    },
    {
      name: 'mobile-768',
      use: { ...devices['iPad Mini'], defaultBrowserType: 'chromium', viewport: { width: 768, height: 1024 } },
    }
  ],
  webServer: [
    {
      command: 'cd .. && PYTHONPATH=. QDRANT_URL=":memory:" USE_FIREBASE=false ENVIRONMENT=test uvicorn backend.src.main:app --host 127.0.0.1 --port 8080',
      url: 'http://127.0.0.1:8080/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: 'npm run dev',
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
      stdout: 'pipe',
      stderr: 'pipe',
    }
  ],
});
