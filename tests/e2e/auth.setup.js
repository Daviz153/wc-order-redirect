const { test: setup, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

setup('WP 관리자 로그인 저장', async ({ page }) => {
  const authDir = path.join(__dirname, '.auth');
  const authFile = path.join(authDir, 'admin.json');

  // 이미 유효한 세션 파일이 있으면 건너뜀 (로컬 PHP 쿠키 생성 방식 지원)
  if (fs.existsSync(authFile)) {
    const state = JSON.parse(fs.readFileSync(authFile, 'utf8'));
    if (state.cookies && state.cookies.length > 0) return;
  }

  const base = process.env.WP_BASE_URL || 'http://localhost:8080/wordpress/';

  await page.goto(base + 'wp-login.php', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.fill('#user_login', process.env.WP_ADMIN_USER || 'admin');
  await page.fill('#user_pass',  process.env.WP_ADMIN_PASS  || 'password');
  await page.click('#wp-submit');
  await page.waitForURL(/wp-admin/, { timeout: 30_000 });

  fs.mkdirSync(authDir, { recursive: true });
  await page.context().storageState({ path: authFile });
});
