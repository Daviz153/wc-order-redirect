const { test, expect } = require('@playwright/test');

// WooCommerce 호환성 확인
// - PHP fatal error 없음
// - 플러그인 활성 상태에서 WC 핵심 화면 정상 로드

test('WC 상태 페이지가 fatal error 없이 로드된다', async ({ page }) => {
  await page.goto('wp-admin/admin.php?page=wc-status');

  await expect(page).toHaveURL(/wc-status/);
  await expect(page.locator('body')).not.toContainText('Fatal error');
  await expect(page.locator('body')).not.toContainText('Parse error');
});

test('WC 설정 페이지가 fatal error 없이 로드된다', async ({ page }) => {
  await page.goto('wp-admin/admin.php?page=wc-settings');

  await expect(page).toHaveURL(/wc-settings/);
  await expect(page.locator('body')).not.toContainText('Fatal error');
});

test('플러그인 목록에서 WC Order Redirect가 활성 상태다', async ({ page }) => {
  await page.goto('wp-admin/plugins.php');

  const row = page.locator('tr[data-slug="wc-order-redirect"]');
  await expect(row).toBeVisible();
  // 비활성 행이면 class에 'inactive'가 붙음
  await expect(row).not.toHaveClass(/inactive/);
});
