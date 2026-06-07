const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

// 게스트(비로그인) 결제 흐름 테스트
// 실제 고객은 결제 전 비로그인 상태 — 이게 메인 케이스

let testData;

test.beforeAll(() => {
  testData = JSON.parse(
    fs.readFileSync(path.join(__dirname, '.auth', 'test-data.json'), 'utf8')
  );
});

test.beforeEach(async ({ page }) => {
  await page.goto('cart/?empty-cart=1', { waitUntil: 'domcontentloaded' });
});

test.setTimeout(60_000);

test('게스트 결제 완료 후 리다이렉트 URL로 즉시 이동', async ({ page }) => {
  // 1. 장바구니에 담기 (비로그인)
  await page.goto(`/?add-to-cart=${testData.productWithUrl}`, {
    waitUntil: 'domcontentloaded',
  });

  // 2. 체크아웃 이동
  await page.goto('checkout/');
  await page.waitForLoadState('networkidle');
  await expect(page).toHaveURL(/checkout/);

  // 3. 청구 정보 입력 (이 쇼핑몰은 이름·전화·이메일만 필수)
  await page.fill('#billing_first_name', '홍길동');
  await page.fill('#billing_phone', '01012345678');
  await page.fill('#billing_email', 'guest@example.com');

  // 4. COD 선택 후 주문 제출
  await page.click('label[for="payment_method_cod"]');
  await page.waitForLoadState('networkidle');
  const terms = page.locator('#terms');
  if (await terms.isVisible() && !(await terms.isChecked())) {
    await terms.check({ force: true });
  }
  await page.click('#place_order');

  // 5. 감사 페이지 없이 설정한 URL로 즉시 이동
  await expect(page).toHaveURL(testData.redirectTarget, { timeout: 15_000 });
});

test('게스트 결제 — URL 없는 상품은 기존 감사 페이지 유지', async ({ page }) => {
  await page.goto(`/?add-to-cart=${testData.productWithoutUrl}`, {
    waitUntil: 'domcontentloaded',
  });

  await page.goto('checkout/');
  await page.waitForLoadState('networkidle');
  await expect(page).toHaveURL(/checkout/);

  await page.fill('#billing_first_name', '홍길동');
  await page.fill('#billing_phone', '01012345678');
  await page.fill('#billing_email', 'guest@example.com');

  await page.click('label[for="payment_method_cod"]');
  await page.waitForLoadState('networkidle');
  const terms2 = page.locator('#terms');
  if (await terms2.isVisible() && !(await terms2.isChecked())) {
    await terms2.check({ force: true });
  }
  await page.click('#place_order');

  await expect(page).toHaveURL(/order-received/, { timeout: 15_000 });
});
