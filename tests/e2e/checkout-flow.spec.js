const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

// 전체 결제 흐름 테스트
// 실제 고객 경로: 상품 담기 → 체크아웃 → 결제 → order-received → 리다이렉트
// COD(대금상환)는 PG 없이 동일한 흐름을 재현 — template_redirect 발동 경로가 같음

let testData;

test.beforeAll(() => {
  testData = JSON.parse(
    fs.readFileSync(path.join(__dirname, '.auth', 'test-data.json'), 'utf8')
  );
});

test.setTimeout(60_000);

test.beforeEach(async ({ page }) => {
  // 각 테스트 전 장바구니 비우기
  await page.goto('cart/?empty-cart=1', { waitUntil: 'domcontentloaded' });
});

test('COD 결제 완료 후 리다이렉트 URL로 즉시 이동', async ({ page }) => {
  // 1. 장바구니에 담기
  await page.goto(`/?add-to-cart=${testData.productWithUrl}`, {
    waitUntil: 'domcontentloaded',
  });

  // 2. 체크아웃 이동
  await page.goto('checkout/');
  await page.waitForLoadState('networkidle');
  await expect(page).toHaveURL(/checkout/);

  // 3. 청구 정보 입력
  await page.fill('#billing_first_name', '테스트');
  await page.fill('#billing_last_name', '고객');
  await page.fill('#billing_address_1', '강남구 테헤란로 123');
  await page.fill('#billing_city', '서울');
  await page.fill('#billing_postcode', '06234');
  await page.fill('#billing_phone', '01012345678');
  await page.fill('#billing_email', 'e2e-test@example.com');

  // 4. COD가 유일한 결제 수단 → 자동 선택됨 (라디오 hidden 처리)
  // 주문 제출
  await page.click('#place_order');

  // 6. order-received를 거치지 않고 설정한 URL로 즉시 이동
  await expect(page).toHaveURL(testData.redirectTarget, { timeout: 15_000 });
});

test('URL 없는 상품은 COD 결제 후 기존 감사 페이지 유지', async ({ page }) => {
  // 1. URL 없는 상품 담기
  await page.goto(`/?add-to-cart=${testData.productWithoutUrl}`, {
    waitUntil: 'domcontentloaded',
  });

  // 2. 체크아웃
  await page.goto('checkout/');
  await page.waitForLoadState('networkidle');
  await expect(page).toHaveURL(/checkout/);

  await page.fill('#billing_first_name', '테스트');
  await page.fill('#billing_last_name', '고객');
  await page.fill('#billing_address_1', '강남구 테헤란로 123');
  await page.fill('#billing_city', '서울');
  await page.fill('#billing_postcode', '06234');
  await page.fill('#billing_phone', '01012345678');
  await page.fill('#billing_email', 'e2e-test@example.com');

  await page.click('#place_order');

  // order-received 페이지에 머물러야 함
  await expect(page).toHaveURL(/order-received/, { timeout: 15_000 });
});
