const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

// 전체 결제 흐름 테스트
// 실제 고객 경로: 상품 담기 → 체크아웃 → COD 결제 → order-received → 리다이렉트
// COD(상품 수령 후 결제)는 PG 없이 동일한 흐름을 재현

let testData;

test.beforeAll(() => {
    testData = JSON.parse(
        fs.readFileSync(path.join(__dirname, '.auth', 'test-data.json'), 'utf8')
    );
});

test.beforeEach(async ({ page }) => {
    await page.goto(`${testData.siteUrl}/cart/?empty-cart=1`, { waitUntil: 'domcontentloaded' });
});

test.setTimeout(60_000);

async function fillIfVisible(page, selector, value) {
    const el = page.locator(selector);
    if (await el.count() > 0 && await el.isVisible({ timeout: 500 }).catch(() => false)) {
        await el.fill(value);
    }
}

async function submitCheckoutWithCOD(page) {
    await page.waitForLoadState('networkidle');
    // 청구 필드 채우기 (서버 환경에 따라 미리 저장된 값이 없을 수 있음)
    await fillIfVisible(page, '#billing_first_name', '홍길동');
    await fillIfVisible(page, '#billing_last_name',  '테스트');
    await fillIfVisible(page, '#billing_address_1',  '강남구 테헤란로 123');
    await fillIfVisible(page, '#billing_city',       '서울');
    await fillIfVisible(page, '#billing_postcode',   '06234');
    await fillIfVisible(page, '#billing_phone',      '01012345678');
    await fillIfVisible(page, '#billing_email',      'test@example.com');
    // COD 선택: 라디오 버튼이 label로 가려져 있으므로 label 클릭 후 AJAX 안정화 대기
    await page.click('label[for="payment_method_cod"]');
    await page.waitForLoadState('networkidle');
    // 이용 약관 체크 (미체크 시 주문 거부됨)
    const terms = page.locator('#terms');
    if (await terms.isVisible() && !(await terms.isChecked())) {
        await terms.check({ force: true });
    }
    await page.click('#place_order');
}

test('COD 결제 완료 후 리다이렉트 URL로 즉시 이동', async ({ page }) => {
    await page.goto(`${testData.siteUrl}/?add-to-cart=${testData.productWithUrl}`, {
        waitUntil: 'domcontentloaded',
    });
    await page.goto(`${testData.siteUrl}/checkout/`);
    await submitCheckoutWithCOD(page);
    await expect(page).toHaveURL(testData.redirectTarget, { timeout: 15_000 });
});

test('URL 없는 상품은 COD 결제 후 기존 감사 페이지 유지', async ({ page }) => {
    await page.goto(`${testData.siteUrl}/?add-to-cart=${testData.productWithoutUrl}`, {
        waitUntil: 'domcontentloaded',
    });
    await page.goto(`${testData.siteUrl}/checkout/`);
    await submitCheckoutWithCOD(page);
    await expect(page).toHaveURL(/order-received/, { timeout: 15_000 });
});
