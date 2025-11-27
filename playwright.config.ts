import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for waveform-playlist E2E tests
 *
 * Tests run against the Docusaurus dev server at localhost:3000
 * Start the server with: cd website && pnpm start
 *
 * Environment variables:
 * - BASE_PATH: URL path prefix (default: '/waveform-playlist')
 * - PORT: Dev server port (default: 3000)
 */

const port = process.env.PORT || '3000';
const basePath = process.env.BASE_PATH || '/waveform-playlist';
const baseURL = `http://localhost:${port}${basePath}`;

export default defineConfig({
  testDir: './e2e',

  /* Run tests in parallel */
  fullyParallel: true,

  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env.CI,

  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,

  /* Limit parallel workers on CI */
  workers: process.env.CI ? 1 : undefined,

  /* Reporter to use */
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
  ],

  /* Shared settings for all projects */
  use: {
    /* Base URL for navigation */
    baseURL,

    /* Collect trace when retrying the failed test */
    trace: 'on-first-retry',

    /* Take screenshot on failure */
    screenshot: 'only-on-failure',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /* Run local dev server before starting the tests */
  webServer: {
    command: 'cd website && pnpm start',
    url: baseURL,
    reuseExistingServer: true, // Always reuse if server is running
    timeout: 180 * 1000,
    stdout: 'pipe',
  },
});
