const { test, expect } = require('@playwright/test');

// 상품 편집 페이지에 메타박스가 렌더되는지 확인
// URL 저장/검증은 PHPUnit (test_meta_saved_with_esc_url_raw)이 담당
test('product edit page renders redirect meta box', async ({ page }) => {
  await page.goto('wp-admin/post-new.php?post_type=product');

  const metaBox = page.locator('#wc_order_redirect');
  await expect(metaBox).toBeVisible();
  await expect(metaBox.locator('h2')).toContainText('결제 후 리다이렉트');
  await expect(page.locator('#wc_order_redirect_enabled')).toBeVisible();
  await expect(page.locator('#wc_order_redirect_url')).toBeVisible();
});
