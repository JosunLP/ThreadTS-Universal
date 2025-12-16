import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Enable Web Workers where possible
        launchOptions: {
          // The following flags disable browser security features and are
          // intended ONLY for Playwright tests so worker-based scenarios can run
          // without CORS / mixed-content restrictions.
          args: [
            '--enable-web-workers',
            '--allow-running-insecure-content',
            '--disable-web-security',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
          ],
        },
      },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
  ],
  // Global setup removed because it caused browser-specific issues in CI/CD.
  // Capability detection is now done directly in the tests.
});
