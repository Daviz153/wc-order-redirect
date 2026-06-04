const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

// 전체 결제 흐름 테스트
// 실제 고객 경로: 상품 담기 → 체크아웃 → 결제 → order-received → 리다이렉트
// COD(대금상환)는 PG 없이 동일한 흐름을 재현 — template_redirect 발동 경로가 같음
//
// 관리자 billing 주소는 CI 환경(e2e.yml)에서 미리 세팅됨
// → 폼 입력 불필요, WC AJAX 타이밍 문제 회피

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

test('COD 결제 완료 후 리다이렉트 URL로 즉시 이동', async ({ page }) => {
  // 1. 장바구니에 담기
  await page.goto(`/?add-to-cart=${testData.productWithUrl}`, {
    waitUntil: 'domcontentloaded',
  });

  // 2. 체크아웃 이동 — billing 주소 미리 세팅됨, AJAX 완료까지 대기
  await page.goto('checkout/');
  await page.waitForLoadState('networkidle');
  await expect(page).toHaveURL(/checkout/);

  // 3. place_order 버튼이 활성화될 때까지 대기 후 제출
  await page.waitForSelector('#place_order:not([disabled])', { timeout: 30_000 });
  await page.click('#place_order');

  // 4. order-received를 거치지 않고 설정한 URL로 즉시 이동
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

  // 3. 주문 제출
  await page.waitForSelector('#place_order:not([disabled])', { timeout: 30_000 });
  await page.click('#place_order');

  // order-received 페이지에 머물러야 함
  await expect(page).toHaveURL(/order-received/, { timeout: 15_000 });
});
