const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: 'tests/e2e',
  globalSetup: 'tests/e2e/global-setup.js',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    // trailing slash 필수 — spec 파일에서 leading slash 없이 경로 작성
    baseURL: process.env.WP_BASE_URL || 'http://localhost:8080/wordpress/',
  },
  projects: [
    {
      name: 'setup',
      testMatch: '**/auth.setup.js',
    },
    {
      name: 'chromium',
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/e2e/.auth/admin.json',
      },
    },
  ],
  reporter: [['list'], ['html', { open: 'never' }]],
});
