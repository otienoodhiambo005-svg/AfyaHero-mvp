import { defineConfig, devices } from '@playwright/test';

/**
 * @see https://playwright.dev/docs/test-configuration
 */
const authMatrixAppsJson = JSON.stringify([
  {
    appId: 'patient-mobile-app',
    appKey: 'patient-key',
    signingSecret: 'patient-signing-secret',
    hospitalId: 'hospital_test',
    appType: 'patient_app',
    scopes: ['fhir:read'],
  },
  {
    appId: 'chp-mobile-app',
    appKey: 'chp-key',
    signingSecret: 'chp-signing-secret',
    hospitalId: 'hospital_test',
    appType: 'chp_app',
    scopes: ['fhir:read', 'fhir:write'],
  },
  {
    appId: 'chp-readonly-app',
    appKey: 'chp-readonly-key',
    signingSecret: 'chp-readonly-signing-secret',
    hospitalId: 'hospital_test',
    appType: 'chp_app',
    scopes: ['fhir:read'],
  },
]);

export default defineConfig({
  testDir: './tests',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: 'http://localhost:3003',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    /* Test against mobile viewports. */
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },

    /* Test against branded browsers. */
    {
      name: 'Microsoft Edge',
      use: { ...devices['Desktop Edge'], channel: 'msedge' },
    },
    {
      name: 'Google Chrome',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'npm run dev -- --port 3003',
    url: 'http://localhost:3003',
    reuseExistingServer: false,
    env: {
      ...process.env,
      ENABLE_DEMO_LOGIN: process.env.ENABLE_DEMO_LOGIN ?? '1',
      AFYAHERO_V1_APP_TOKEN_SECRET: process.env.AFYAHERO_V1_APP_TOKEN_SECRET ?? 'test-token-secret-0123456789abcdef-0123456789abcdef',
      AFYAHERO_DEVELOPER_APPS_JSON: process.env.AFYAHERO_DEVELOPER_APPS_JSON ?? authMatrixAppsJson,
      TEST_RATE_LIMIT_OVERRIDE_ENABLED: process.env.TEST_RATE_LIMIT_OVERRIDE_ENABLED ?? '1',
      USSD_WEBHOOK_SECRET: process.env.USSD_WEBHOOK_SECRET ?? 'test-ussd-webhook-secret',
      WHATSAPP_WEBHOOK_SECRET: process.env.WHATSAPP_WEBHOOK_SECRET ?? 'test-whatsapp-webhook-secret',
    },
  },
});