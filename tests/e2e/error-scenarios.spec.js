/**
 * 오류 시나리오 E2E 테스트
 *
 * 결제가 정상적으로 완료되지 않은 경우 또는 잘못된 요청에서
 * wc-order-redirect 플러그인이 올바르게 동작하는지 검증합니다.
 */

const { test, expect } = require('@playwright/test');
const { dockerPhp }    = require('./helpers');
const fs               = require('fs');
const path             = require('path');

let testData;

test.beforeAll(() => {
    testData = JSON.parse(
        fs.readFileSync(path.join(__dirname, '.auth', 'test-data.json'), 'utf8')
    );
});

function frontendUrl(urlPath) {
    return testData.frontendBaseUrl.replace(/\/$/, '') + '/' + urlPath.replace(/^\//, '');
}

test('잘못된 order key → 리다이렉트 미발동', async ({ page }) => {
    const orderId = dockerPhp(`
$order = wc_create_order();
$order->add_product(wc_get_product(${testData.productWithUrl}), 1);
$order->set_status('processing');
$order->save();
echo $order->get_id();
`).trim();

    await page.goto(
        frontendUrl(`checkout/order-received/${orderId}/?key=wc_order_INVALID_KEY_XXXX`),
        { waitUntil: 'domcontentloaded' }
    );
    expect(page.url()).not.toBe(testData.redirectTarget);
});

test('존재하지 않는 주문 ID → 리다이렉트 미발동', async ({ page }) => {
    await page.goto(
        frontendUrl('checkout/order-received/999999/?key=wc_order_NONEXISTENT'),
        { waitUntil: 'domcontentloaded' }
    );
    expect(page.url()).not.toBe(testData.redirectTarget);
});

test('order key 파라미터 없이 접근 → 리다이렉트 미발동', async ({ page }) => {
    const orderId = dockerPhp(`
$order = wc_create_order();
$order->add_product(wc_get_product(${testData.productWithUrl}), 1);
$order->set_status('processing');
$order->save();
echo $order->get_id();
`).trim();

    await page.goto(
        frontendUrl(`checkout/order-received/${orderId}/`),
        { waitUntil: 'domcontentloaded' }
    );
    expect(page.url()).not.toBe(testData.redirectTarget);
});

// 카드 전용 플러그인 — pending/on-hold 상태 케이스는 실제 운영에서 발생하지 않으므로 생략
