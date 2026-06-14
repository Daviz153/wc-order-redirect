/**
 * 메타박스 UI 저장 E2E 테스트
 *
 * 기존 meta-box.spec.js는 패널 렌더만 확인한다.
 * 이 파일은 관리자가 상품 편집 화면에서 URL을 직접 입력·저장했을 때
 * DB에 반영되고 실제 리다이렉트가 발동하는 전체 흐름을 검증한다.
 */

const { test, expect } = require('@playwright/test');
const { dockerPhp }    = require('./helpers');
const fs               = require('fs');
const path             = require('path');

let testData;
let productId;

test.beforeAll(() => {
    testData = JSON.parse(
        fs.readFileSync(path.join(__dirname, '.auth', 'test-data.json'), 'utf8')
    );

    productId = dockerPhp(`
$id = wp_insert_post([
    'post_title'  => 'Meta-box Save UI Test',
    'post_type'   => 'product',
    'post_status' => 'publish',
]);
wp_set_object_terms($id, 'simple', 'product_type');
update_post_meta($id, '_price',         '10000');
update_post_meta($id, '_regular_price', '10000');
update_post_meta($id, '_stock_status',  'instock');
update_post_meta($id, '_virtual',       'yes');
echo $id;
`);
});

test.beforeEach(() => {
    // 각 테스트 시작 전 메타 초기화 → 독립 실행 보장
    if (productId) {
        dockerPhp(`
delete_post_meta(${productId}, '_wc_order_redirect_enabled');
delete_post_meta(${productId}, '_wc_order_redirect_url');
`);
    }
});

test.afterAll(() => {
    if (productId) {
        dockerPhp(`wp_delete_post(${productId}, true);`);
    }
});

function adminUrl(adminPath) {
    const base = (testData.siteUrl || testData.frontendBaseUrl).replace(/\/$/, '');
    return `${base}/wp-admin/${adminPath.replace(/^\//, '')}`;
}

function frontendUrl(urlPath) {
    return testData.frontendBaseUrl.replace(/\/$/, '') + '/' + urlPath.replace(/^\//, '');
}

test.setTimeout(60_000);

// ── 1. 토글 ON + URL 입력 → 저장 → DB 반영 ─────────────────────────────────

test('메타박스 토글 ON + URL 저장 → DB에 enabled=yes, URL 반영됨', async ({ page }) => {
    const TARGET_URL = 'https://example.com/metabox-ui-test';

    await page.goto(adminUrl(`post.php?post=${productId}&action=edit`));

    // 리다이렉트 탭 클릭
    await page.click('a[href="#wcor_product_data"]');
    await expect(page.locator('#wcor_product_data')).toBeVisible();

    // 토글 켜기 (checkbox는 display:none — wrap 클릭으로 제어)
    await page.click('#wcor-toggle-wrap');
    await expect(page.locator('#wcor-url-field')).toBeVisible();

    // URL 입력
    await page.locator('#wc_order_redirect_url').fill(TARGET_URL);

    // 상품 저장(Update)
    await page.click('#publish');
    await expect(page).toHaveURL(new RegExp(`post=${productId}`), { timeout: 15_000 });

    // DB 확인
    const savedEnabled = dockerPhp(`echo get_post_meta(${productId}, '_wc_order_redirect_enabled', true);`);
    const savedUrl     = dockerPhp(`echo get_post_meta(${productId}, '_wc_order_redirect_url', true);`);

    expect(savedEnabled).toBe('yes');
    expect(savedUrl).toBe(TARGET_URL);
});

// ── 2. UI 저장 → 실제 리다이렉트 발동 ──────────────────────────────────────

test('메타박스 UI로 저장한 URL → 결제 완료 후 리다이렉트 발동', async ({ page }) => {
    // UI로 저장
    await page.goto(adminUrl(`post.php?post=${productId}&action=edit`));
    await page.click('a[href="#wcor_product_data"]');
    await page.click('#wcor-toggle-wrap');
    await expect(page.locator('#wcor-url-field')).toBeVisible();
    await page.locator('#wc_order_redirect_url').fill(testData.redirectTarget);
    await page.click('#publish');
    await expect(page).toHaveURL(new RegExp(`post=${productId}`), { timeout: 15_000 });

    // 주문 생성
    const result = dockerPhp(`
$order = wc_create_order();
$order->add_product(wc_get_product(${productId}), 1);
$order->set_status('processing');
$order->save();
echo $order->get_id() . ':' . $order->get_order_key();
`);
    const [id, key] = result.split(':');

    // order-received → 리다이렉트 발동
    await page.goto(frontendUrl(`checkout/order-received/${id}/?key=${key}`));
    await expect(page).toHaveURL(testData.redirectTarget, { timeout: 15_000 });
});

// ── 3. 토글 OFF → enabled=no 저장 ───────────────────────────────────────────

test('메타박스 토글 OFF로 저장하면 enabled=no로 저장됨', async ({ page }) => {
    // 메타 미설정(beforeEach 초기화) → 토글은 OFF 상태
    await page.goto(adminUrl(`post.php?post=${productId}&action=edit`));
    await page.click('a[href="#wcor_product_data"]');
    await expect(page.locator('#wcor_product_data')).toBeVisible();

    // 토글 OFF인 채로 저장
    const isChecked = await page.locator('#wc_order_redirect_enabled').isChecked();
    expect(isChecked).toBe(false);

    await page.click('#publish');
    await expect(page).toHaveURL(new RegExp(`post=${productId}`), { timeout: 15_000 });

    const savedEnabled = dockerPhp(`echo get_post_meta(${productId}, '_wc_order_redirect_enabled', true);`);
    expect(savedEnabled).toBe('no');
});
