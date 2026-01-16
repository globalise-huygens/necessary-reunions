import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for annotation loading health checks
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report' }]],

  webServer: (() => {
    const port = Number.parseInt(process.env.PLAYWRIGHT_PORT || '3000', 10);
    const configuredBaseURL = process.env.PLAYWRIGHT_TEST_BASE_URL;
    const baseURL =
      configuredBaseURL ||
      (process.env.CI
        ? `http://localhost:${port}`
        : 'https://necessaryreunions.netlify.app');

    const useWebServer =
      process.env.PLAYWRIGHT_USE_WEBSERVER === 'true' ||
      (!process.env.PLAYWRIGHT_USE_WEBSERVER &&
        (baseURL.includes('127.0.0.1') || baseURL.includes('localhost')));

    if (!useWebServer) return undefined;

    return {
      command: process.env.CI
        ? `pnpm build && pnpm exec next start --port ${port}`
        : 'pnpm dev',
      url: baseURL,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    };
  })(),

  use: {
    baseURL:
      process.env.PLAYWRIGHT_TEST_BASE_URL ||
      (process.env.CI
        ? 'http://localhost:3000'
        : 'https://necessaryreunions.netlify.app'),
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Timeout settings
  timeout: 30000,
  expect: {
    timeout: 10000,
  },
});
