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

// 필드가 DOM에 존재하고 보일 때만 채움 (로컬/CI 체크아웃 폼이 다를 수 있음)
async function fillIfVisible(page, selector, value) {
  const el = page.locator(selector);
  if (await el.count() > 0 && await el.isVisible({ timeout: 500 }).catch(() => false)) {
    await el.fill(value);
  }
}

async function fillGuestBilling(page) {
  await fillIfVisible(page, '#billing_first_name', '홍길동');
  await fillIfVisible(page, '#billing_last_name',  '테스트');
  await fillIfVisible(page, '#billing_address_1',  '강남구 테헤란로 123');
  await fillIfVisible(page, '#billing_city',       '서울');
  await fillIfVisible(page, '#billing_postcode',   '06234');
  await fillIfVisible(page, '#billing_phone',      '01012345678');
  await fillIfVisible(page, '#billing_email',      'guest@example.com');
}

async function submitCOD(page) {
  await page.click('label[for="payment_method_cod"]');
  await page.waitForLoadState('networkidle');
  const terms = page.locator('#terms');
  if (await terms.isVisible() && !(await terms.isChecked())) {
    await terms.check({ force: true });
  }
  await page.click('#place_order');
}

test('게스트 결제 완료 후 리다이렉트 URL로 즉시 이동', async ({ page }) => {
  await page.goto(`/?add-to-cart=${testData.productWithUrl}`, { waitUntil: 'domcontentloaded' });
  await page.goto('checkout/');
  await page.waitForLoadState('networkidle');
  await expect(page).toHaveURL(/checkout/);

  await fillGuestBilling(page);
  await submitCOD(page);

  await expect(page).toHaveURL(testData.redirectTarget, { timeout: 15_000 });
});

test('게스트 결제 — URL 없는 상품은 기존 감사 페이지 유지', async ({ page }) => {
  await page.goto(`/?add-to-cart=${testData.productWithoutUrl}`, { waitUntil: 'domcontentloaded' });
  await page.goto('checkout/');
  await page.waitForLoadState('networkidle');
  await expect(page).toHaveURL(/checkout/);

  await fillGuestBilling(page);
  await submitCOD(page);

  await expect(page).toHaveURL(/order-received/, { timeout: 15_000 });
});
