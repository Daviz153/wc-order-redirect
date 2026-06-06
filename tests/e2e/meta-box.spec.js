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

  // 토글 컨트롤이 보임 (체크박스 자체는 display:none 처리)
  await expect(page.locator('#wcor-toggle-wrap')).toBeVisible();

  // 체크박스·URL 입력은 DOM에 존재함 (toggle OFF 시 URL 필드는 숨겨짐)
  await expect(page.locator('#wc_order_redirect_enabled')).toBeAttached();
  await expect(page.locator('#wc_order_redirect_url')).toBeAttached();
});
