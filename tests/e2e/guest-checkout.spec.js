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

  // 3. 청구 정보 입력 (게스트는 저장된 주소 없음)
  await page.fill('#billing_first_name', '홍');
  await page.fill('#billing_last_name', '길동');
  await page.fill('#billing_address_1', '강남구 테헤란로 123');
  await page.fill('#billing_city', '서울');
  await page.fill('#billing_postcode', '06234');
  await page.fill('#billing_phone', '01012345678');
  await page.fill('#billing_email', 'guest@example.com');

  // 4. 주문 제출
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

  await page.fill('#billing_first_name', '홍');
  await page.fill('#billing_last_name', '길동');
  await page.fill('#billing_address_1', '강남구 테헤란로 123');
  await page.fill('#billing_city', '서울');
  await page.fill('#billing_postcode', '06234');
  await page.fill('#billing_phone', '01012345678');
  await page.fill('#billing_email', 'guest@example.com');

  await page.click('#place_order');

  await expect(page).toHaveURL(/order-received/, { timeout: 15_000 });
});
