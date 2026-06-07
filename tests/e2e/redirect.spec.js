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

test.beforeEach(() => {
    // 이전 테스트가 변경한 전역 옵션 초기화 (직렬 실행 전제)
    dockerPhp(`delete_option('wcor_default_url'); update_option('wcor_enabled', 'yes');`);
});

function frontendUrl(urlPath) {
    return testData.frontendBaseUrl.replace(/\/$/, '') + '/' + urlPath.replace(/^\//, '');
}

function createOrder(productId) {
    const result = dockerPhp(`
$order = wc_create_order();
$order->add_product(wc_get_product(${productId}), 1);
$order->set_status('processing');
$order->save();
echo $order->get_id() . ':' . $order->get_order_key();
`);
    const [id, key] = result.split(':');
    return { id, key };
}

test('URL 설정된 상품 결제 완료 → 리다이렉트 URL로 즉시 이동', async ({ page }) => {
    const { id, key } = createOrder(testData.productWithUrl);
    await page.goto(frontendUrl(`checkout/order-received/${id}/?key=${key}`));
    await expect(page).toHaveURL(testData.redirectTarget);
});

test('URL 없는 상품 결제 완료 → 기존 감사 페이지 유지', async ({ page }) => {
    const { id, key } = createOrder(testData.productWithoutUrl);
    await page.goto(frontendUrl(`checkout/order-received/${id}/?key=${key}`));
    await expect(page).toHaveURL(new RegExp(`order-received/${id}`));
});

test('다중 상품 주문 → 최고가 상품 URL로 이동', async ({ page }) => {
    const result = dockerPhp(`
$order = wc_create_order();
$order->add_product(wc_get_product(${testData.productWithUrl}),    1);
$order->add_product(wc_get_product(${testData.productWithoutUrl}), 1);
$order->set_status('processing');
$order->save();
echo $order->get_id() . ':' . $order->get_order_key();
`);
    const [id, key] = result.split(':');
    await page.goto(frontendUrl(`checkout/order-received/${id}/?key=${key}`));
    await expect(page).toHaveURL(testData.redirectTarget);
});

test('주문완료 페이지 재방문 시 로그 중복 방지', async ({ page }) => {
    const { id, key } = createOrder(testData.productWithUrl);

    // 로그 초기화 후 테스트 시작
    dockerPhp(`delete_option('wcor_redirect_log');`);

    const orderReceivedUrl = frontendUrl(`checkout/order-received/${id}/?key=${key}`);

    // 첫 방문 — 리다이렉트 + 로그 1건 기록
    await page.goto(orderReceivedUrl);
    await expect(page).toHaveURL(testData.redirectTarget);

    // 두 번째 방문 — 리다이렉트는 동일하나 로그 추가 없음
    await page.goto(orderReceivedUrl);
    await expect(page).toHaveURL(testData.redirectTarget);

    // 해당 주문의 로그 건수가 1건임을 확인
    const logCount = dockerPhp(`
$log = (array) get_option('wcor_redirect_log', []);
echo count(array_filter($log, fn($e) => (int)($e['order'] ?? 0) === ${id}));
`);
    expect(parseInt(logCount, 10)).toBe(1);
});
