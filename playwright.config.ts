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
        // Aktiviere Web Workers falls möglich
        launchOptions: {
          // Die folgenden Flags deaktivieren Browser-Sicherheitsfeatures und
          // sind ausschließlich für Playwright-Tests gedacht, damit Worker-
          // basierte Szenarien ohne CORS-/Mischinhalts-Restriktionen laufen.
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
  // Global setup entfernt da es Browser-spezifische Probleme in CI/CD verursacht
  // Capability-Detection erfolgt jetzt direkt in den Tests
});
