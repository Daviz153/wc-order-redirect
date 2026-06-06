const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: 'tests/e2e',
  globalSetup: 'tests/e2e/global-setup.js',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    // trailing slash 필수 — spec 파일에서 leading slash 없이 경로 작성
    baseURL: process.env.WP_BASE_URL || 'http://localhost:8080/',
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
      testIgnore: '**/guest-checkout.spec.js',
    },
    {
      // 비로그인 게스트 — storageState 없음 (실제 고객 환경)
      name: 'guest',
      use: {
        ...devices['Desktop Chrome'],
      },
      testMatch: '**/guest-checkout.spec.js',
    },
  ],
  reporter: [['list'], ['html', { open: 'never' }]],
});
