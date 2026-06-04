const { test: setup, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

setup('WP 관리자 로그인 저장', async ({ page }) => {
  const base = process.env.WP_BASE_URL || 'http://localhost:8080/wordpress/';

  await page.goto(base + 'wp-login.php', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.fill('#user_login', process.env.WP_ADMIN_USER || 'admin');
  await page.fill('#user_pass',  process.env.WP_ADMIN_PASS  || 'password');
  await page.click('#wp-submit');
  await page.waitForURL(/wp-admin/, { timeout: 30_000 });

  const authDir = path.join(__dirname, '.auth');
  fs.mkdirSync(authDir, { recursive: true });
  await page.context().storageState({ path: path.join(authDir, 'admin.json') });
});
