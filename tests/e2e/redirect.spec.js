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
