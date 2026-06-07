/**
 * 플러그인 공존 E2E 테스트
 *
 * wc-order-redirect와 wc-order-webhook이 동시에 활성화된 상태에서
 * 두 플러그인이 서로 간섭 없이 독립적으로 동작하는지 검증합니다.
 */

const { test, expect } = require('@playwright/test');
const { dockerPhp }    = require('./helpers');
const fs               = require('fs');
const path             = require('path');

let testData;
let webhookTestUrl;
let webhookPluginActive = false;

test.beforeAll(() => {
    testData = JSON.parse(
        fs.readFileSync(path.join(__dirname, '.auth', 'test-data.json'), 'utf8')
    );
    const adminBase = process.env.WP_BASE_URL || 'http://localhost:8080/';
    webhookTestUrl  = adminBase.replace(/\/$/, '') + '/wp-admin/admin-ajax.php';
    // 다른 테스트가 설정한 default URL이 남아있으면 제거
    dockerPhp(`delete_option('wcor_default_url'); update_option('wcor_enabled', 'yes');`);

    try {
        const result = dockerPhp(`
include_once ABSPATH . 'wp-admin/includes/plugin.php';
echo is_plugin_active('wc-order-webhook/wc-order-webhook.php') ? '1' : '0';
`);
        webhookPluginActive = result.trim() === '1';
    } catch {
        webhookPluginActive = false;
    }
});

test.beforeEach(() => {
    // 이전 테스트가 변경한 전역 옵션 초기화 (직렬 실행 전제)
    dockerPhp(`delete_option('wcor_default_url'); update_option('wcor_enabled', 'yes');`);
});

function frontendUrl(urlPath) {
    return testData.frontendBaseUrl.replace(/\/$/, '') + '/' + urlPath.replace(/^\//, '');
}

function adminUrl(adminPath) {
    const siteBase = (testData.siteUrl || testData.frontendBaseUrl).replace(/\/$/, '');
    return siteBase + '/wp-admin/' + adminPath.replace(/^\/?(wp-admin\/)?/, '');
}

function getLatestWebhookLog(orderId) {
    return dockerPhp(`
global $wpdb;
$row = $wpdb->get_row(
    $wpdb->prepare(
        "SELECT * FROM {$wpdb->prefix}wcmw_logs WHERE order_id = %d ORDER BY id DESC LIMIT 1",
        ${orderId}
    ),
    ARRAY_A
);
echo $row ? json_encode($row) : 'null';
`);
}

test('두 플러그인 동시 활성 → 상품 편집 화면에서 탭 공존 및 PHP 오류 없음', async ({ page }) => {
    test.skip(!webhookPluginActive, 'wc-order-webhook 미설치 — 탭 공존 테스트 건너뜀');
    await page.goto(adminUrl(`post.php?post=${testData.productWithUrl}&action=edit`));
    await expect(page).toHaveURL(/post\.php.*action=edit/);
    await expect(page.locator('body')).not.toContainText('Fatal error');
    await expect(page.locator('body')).not.toContainText('Parse error');
    await expect(page.locator('body')).not.toContainText('Warning:');
    await expect(page.locator('a[href="#wcor_product_data"]')).toBeVisible();
    await expect(page.locator('a[href="#wcmw_product_data"]')).toBeVisible();
    await page.locator('a[href="#wcor_product_data"]').click();
    await expect(page.locator('#wcor_product_data')).toBeVisible();
    await expect(page.locator('#wcmw_product_data')).not.toBeVisible();
    await page.locator('a[href="#wcmw_product_data"]').click();
    await expect(page.locator('#wcmw_product_data')).toBeVisible();
    await expect(page.locator('#wcor_product_data')).not.toBeVisible();
});

test('리다이렉트 전용 상품 → 리다이렉트 발동 (웹훅 설정 없음)', async ({ page }) => {
    const result = dockerPhp(`
$order = wc_create_order();
$order->add_product(wc_get_product(${testData.productWithUrl}), 1);
$order->set_status('processing');
$order->save();
echo $order->get_id() . ':' . $order->get_order_key();
`);
    const [id, key] = result.split(':');
    await page.goto(frontendUrl(`checkout/order-received/${id}/?key=${key}`));
    await expect(page).toHaveURL(testData.redirectTarget);
});

test('웹훅 전용 상품 → payment_complete 시 웹훅 발송 로그 기록됨', async () => {
    test.skip(!webhookPluginActive, 'wc-order-webhook 미설치 — 웹훅 로그 테스트 건너뜀');
    const orderId = dockerPhp(`
$id = wp_insert_post([
    'post_title'  => 'Webhook Only Product (coex test)',
    'post_type'   => 'product',
    'post_status' => 'publish',
]);
wp_set_object_terms($id, 'simple', 'product_type');
update_post_meta($id, '_price',            '50000');
update_post_meta($id, '_regular_price',    '50000');
update_post_meta($id, '_stock_status',     'instock');
update_post_meta($id, '_virtual',          'yes');
update_post_meta($id, '_wcmw_product_enabled', '1');
update_post_meta($id, '_wcmw_product_url', '${webhookTestUrl}');
update_post_meta($id, '_wc_order_redirect_enabled', 'no');
$order = wc_create_order();
$order->add_product(wc_get_product($id), 1);
$order->payment_complete();
echo $order->get_id();
`).trim();

    const logJson = getLatestWebhookLog(orderId);
    expect(logJson).not.toBe('null');
    const log = JSON.parse(logJson);
    expect(log.order_id).toBe(orderId);
    expect(['success', 'failed']).toContain(log.status);
});

test('두 플러그인 모두 활성 → 리다이렉트 발동 + 웹훅 발송 시도 (상호 간섭 없음)', async ({ page }) => {
    test.skip(!webhookPluginActive, 'wc-order-webhook 미설치 — 공존 동작 테스트 건너뜀');
    const setupResult = dockerPhp(`
$id = wp_insert_post([
    'post_title'  => 'Both Plugins Active Product',
    'post_type'   => 'product',
    'post_status' => 'publish',
]);
wp_set_object_terms($id, 'simple', 'product_type');
update_post_meta($id, '_price',            '80000');
update_post_meta($id, '_regular_price',    '80000');
update_post_meta($id, '_stock_status',     'instock');
update_post_meta($id, '_virtual',          'yes');
update_post_meta($id, '_wc_order_redirect_enabled', 'yes');
update_post_meta($id, '_wc_order_redirect_url',     '${testData.redirectTarget}');
update_post_meta($id, '_wcmw_product_enabled', '1');
update_post_meta($id, '_wcmw_product_url',     '${webhookTestUrl}');
$order = wc_create_order();
$order->add_product(wc_get_product($id), 1);
$order->payment_complete();
echo $order->get_id() . ':' . $order->get_order_key();
`);
    const [orderId, orderKey] = setupResult.split(':');

    const logJson = getLatestWebhookLog(orderId);
    expect(logJson).not.toBe('null');
    const log = JSON.parse(logJson);
    expect(log.order_id).toBe(orderId);
    expect(['success', 'failed']).toContain(log.status);

    await page.goto(frontendUrl(`checkout/order-received/${orderId}/?key=${orderKey}`));
    await expect(page).toHaveURL(testData.redirectTarget);
});

test('웹훅 활성 + 리다이렉트 비활성 → 감사 페이지 유지', async ({ page }) => {
    const result = dockerPhp(`
$id = wp_insert_post([
    'post_title'  => 'Webhook ON Redirect OFF (coex test)',
    'post_type'   => 'product',
    'post_status' => 'publish',
]);
wp_set_object_terms($id, 'simple', 'product_type');
update_post_meta($id, '_price',            '30000');
update_post_meta($id, '_regular_price',    '30000');
update_post_meta($id, '_stock_status',     'instock');
update_post_meta($id, '_virtual',          'yes');
update_post_meta($id, '_wcmw_product_enabled', '1');
update_post_meta($id, '_wcmw_product_url', '${webhookTestUrl}');
update_post_meta($id, '_wc_order_redirect_enabled', 'no');
$order = wc_create_order();
$order->add_product(wc_get_product($id), 1);
$order->set_status('processing');
$order->save();
echo $order->get_id() . ':' . $order->get_order_key();
`);
    const [id, key] = result.split(':');
    await page.goto(frontendUrl(`checkout/order-received/${id}/?key=${key}`));
    await expect(page).toHaveURL(new RegExp(`order-received/${id}`));
});
