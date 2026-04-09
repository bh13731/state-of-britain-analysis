import { defineConfig, devices } from '@playwright/test';

const PORT = 8080;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  timeout: 30_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'desktop',
      use: {
        browserName: 'chromium',
        viewport: { width: 1920, height: 1080 },
      },
    },
    {
      name: 'laptop',
      use: {
        browserName: 'chromium',
        viewport: { width: 1366, height: 768 },
      },
    },
    {
      name: 'tablet',
      use: {
        browserName: 'chromium',
        ...devices['iPad (gen 7)'],
        // Override defaultBrowserType to use chromium instead of webkit
        defaultBrowserType: undefined as unknown as string,
      },
    },
    {
      name: 'mobile',
      use: {
        browserName: 'chromium',
        ...devices['iPhone 14'],
        defaultBrowserType: undefined as unknown as string,
      },
    },
    {
      name: 'small-mobile',
      use: {
        browserName: 'chromium',
        ...devices['iPhone SE'],
        defaultBrowserType: undefined as unknown as string,
      },
    },
  ],

  webServer: {
    command: `npx http-server dist -p ${PORT} -c-1 --cors -s`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
    timeout: 15_000,
  },
});
