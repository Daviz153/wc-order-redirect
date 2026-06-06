const { test, expect } = require('@playwright/test');

// 상품 데이터 탭에 리다이렉트 패널이 렌더되는지 확인
// URL 저장/검증은 PHPUnit (test_meta_saved_with_esc_url_raw)이 담당
test('product edit page renders redirect tab panel', async ({ page }) => {
  await page.goto('wp-admin/post-new.php?post_type=product');

  const tab = page.locator('a[href="#wcor_product_data"]');
  await expect(tab).toBeVisible();
  await tab.click();

  const panel = page.locator('#wcor_product_data');
  await expect(panel).toBeVisible();
  await expect(page.locator('#wc_order_redirect_enabled')).toBeVisible();
  await expect(page.locator('#wc_order_redirect_url')).toBeVisible();
});
