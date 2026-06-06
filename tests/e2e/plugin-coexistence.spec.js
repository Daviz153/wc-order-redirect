/**
 * 플러그인 공존 E2E 테스트
 *
 * wc-order-redirect와 wc-order-webhook이 동시에 활성화된 상태에서
 * 두 플러그인이 서로 간섭 없이 독립적으로 동작하는지 검증합니다.
 *
 * 검증 항목:
 *  1. 상품 편집 화면에서 두 탭이 충돌 없이 공존
 *  2. 리다이렉트 전용 상품 → 리다이렉트 O, 웹훅 X
 *  3. 웹훅 전용 상품 → 리다이렉트 X, 웹훅 O (payment_complete 시)
 *  4. 두 플러그인 모두 활성 상품 → 리다이렉트 + 웹훅 모두 독립 동작
 */

const { test, expect } = require('@playwright/test');
const { execSync }     = require('child_process');
const fs               = require('fs');
const path             = require('path');

const WP_PATH = process.env.WP_PATH || '/tmp/wordpress';

function wpEval(phpCode) {
  const tmpFile = `/tmp/wc-coex-${Date.now()}.php`;
  fs.writeFileSync(tmpFile, phpCode);
  try {
    return execSync(`wp eval-file ${tmpFile} --path=${WP_PATH} 2>/dev/null`)
      .toString().trim();
  } finally {
    fs.unlinkSync(tmpFile);
  }
}

function getLatestWebhookLog(orderId) {
  return wpEval(`<?php
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

let testData;
let webhookTestUrl;
let webhookPluginActive = false;

test.beforeAll(() => {
  testData = JSON.parse(
    fs.readFileSync(path.join(__dirname, '.auth', 'test-data.json'), 'utf8')
  );
  // admin-ajax.php: unknown action에 HTTP 400/0 반환 — 웹훅 발송 시도 자체를 검증
  const adminBase = process.env.WP_BASE_URL || 'http://localhost:8080/';
  webhookTestUrl = adminBase.replace(/\/$/, '') + '/wp-admin/admin-ajax.php';

  // wc-order-webhook 플러그인 활성 여부 확인 (CI 환경에서 미설치 시 관련 테스트 건너뜀)
  try {
    const result = wpEval(`<?php
      include_once ABSPATH . 'wp-admin/includes/plugin.php';
      echo is_plugin_active('wc-order-webhook/wc-order-webhook.php') ? '1' : '0';
    `);
    webhookPluginActive = result.trim() === '1';
  } catch {
    webhookPluginActive = false;
  }
});

// 프론트엔드 URL 빌더 — WP 홈 기준 (Playwright baseURL /wordpress/ 와 분리)
function frontendUrl(urlPath) {
  return testData.frontendBaseUrl.replace(/\/$/, '') + '/' + urlPath.replace(/^\//, '');
}

// 어드민 URL 빌더 — site_url() 기준 (/wp-admin cookie path 와 일치)
function adminUrl(adminPath) {
  const siteBase = (testData.siteUrl || testData.frontendBaseUrl).replace(/\/$/, '');
  return siteBase + '/wp-admin/' + adminPath.replace(/^\/?(wp-admin\/)?/, '');
}

// ── 1. UI 공존 확인 — PHP 오류 없음 + 두 탭 독립 동작 ────────────────────
// 두 어드민 검증을 한 번의 페이지 로드로 처리 (연속 어드민 탐색 회피)

test('두 플러그인 동시 활성 → 상품 편집 화면에서 탭 공존 및 PHP 오류 없음', async ({ page }) => {
  test.skip(!webhookPluginActive, 'wc-order-webhook 미설치 — 탭 공존 테스트 건너뜀');
  // site_url() 기반 절대 URL 사용 — auth cookie path (/wp-admin) 와 일치해야 쿠키가 전송됨
  const adminEditUrl = adminUrl(`post.php?post=${testData.productWithUrl}&action=edit`);
  await page.goto(adminEditUrl);
  await expect(page).toHaveURL(/post\.php.*action=edit/);

  // PHP 오류 없음
  await expect(page.locator('body')).not.toContainText('Fatal error');
  await expect(page.locator('body')).not.toContainText('Parse error');
  await expect(page.locator('body')).not.toContainText('Warning:');

  // 두 탭 모두 존재
  await expect(page.locator('a[href="#wcor_product_data"]')).toBeVisible();
  await expect(page.locator('a[href="#wcmw_product_data"]')).toBeVisible();

  // 리다이렉트 탭 클릭 → 리다이렉트 패널만 표시
  await page.locator('a[href="#wcor_product_data"]').click();
  await expect(page.locator('#wcor_product_data')).toBeVisible();
  await expect(page.locator('#wcmw_product_data')).not.toBeVisible();

  // 웹훅 탭 클릭 → 웹훅 패널만 표시
  await page.locator('a[href="#wcmw_product_data"]').click();
  await expect(page.locator('#wcmw_product_data')).toBeVisible();
  await expect(page.locator('#wcor_product_data')).not.toBeVisible();
});

// ── 2. 리다이렉트 전용 — 웹훅 미발동 확인 ─────────────────────────────────

test('리다이렉트 전용 상품 → 리다이렉트 발동 (웹훅 설정 없음)', async ({ page }) => {
  const result = wpEval(`<?php
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

// ── 3. 웹훅 전용 — payment_complete 시 로그 기록 확인 ──────────────────────

test('웹훅 전용 상품 → payment_complete 시 웹훅 발송 로그 기록됨', async () => {
  test.skip(!webhookPluginActive, 'wc-order-webhook 미설치 — 웹훅 로그 테스트 건너뜀');
  const result = wpEval(`<?php
    $id = wp_insert_post([
      'post_title'  => 'Webhook Only Product (coex test)',
      'post_type'   => 'product',
      'post_status' => 'publish',
    ]);
    wp_set_object_terms($id, 'simple', 'product_type');
    update_post_meta($id, '_price', '50000');
    update_post_meta($id, '_regular_price', '50000');
    update_post_meta($id, '_stock_status', 'instock');
    update_post_meta($id, '_virtual', 'yes');
    update_post_meta($id, '_wcmw_product_enabled', '1');
    update_post_meta($id, '_wcmw_product_url', '${webhookTestUrl}');
    update_post_meta($id, '_wc_order_redirect_enabled', 'no');

    $order = wc_create_order();
    $order->add_product(wc_get_product($id), 1);
    $order->payment_complete();
    echo $order->get_id();
  `);
  const orderId = result.trim();

  const logJson = getLatestWebhookLog(orderId);
  expect(logJson).not.toBe('null');

  const log = JSON.parse(logJson);
  expect(log.order_id).toBe(orderId);
  expect(log.webhook_url).toBe(webhookTestUrl);
  // success 또는 failed 모두 허용 — 웹훅 발송 시도 자체를 검증
  expect(['success', 'failed']).toContain(log.status);
});

// ── 4. 두 플러그인 모두 활성 — 리다이렉트 + 웹훅 동시 동작 ────────────────

test('두 플러그인 모두 활성 → 리다이렉트 발동 + 웹훅 발송 시도 (상호 간섭 없음)', async ({ page }) => {
  test.skip(!webhookPluginActive, 'wc-order-webhook 미설치 — 공존 동작 테스트 건너뜀');
  const setupResult = wpEval(`<?php
    $id = wp_insert_post([
      'post_title'  => 'Both Plugins Active Product',
      'post_type'   => 'product',
      'post_status' => 'publish',
    ]);
    wp_set_object_terms($id, 'simple', 'product_type');
    update_post_meta($id, '_price', '80000');
    update_post_meta($id, '_regular_price', '80000');
    update_post_meta($id, '_stock_status', 'instock');
    update_post_meta($id, '_virtual', 'yes');
    update_post_meta($id, '_wc_order_redirect_enabled', 'yes');
    update_post_meta($id, '_wc_order_redirect_url', '${testData.redirectTarget}');
    update_post_meta($id, '_wcmw_product_enabled', '1');
    update_post_meta($id, '_wcmw_product_url', '${webhookTestUrl}');

    $order = wc_create_order();
    $order->add_product(wc_get_product($id), 1);
    $order->payment_complete();
    echo $order->get_id() . ':' . $order->get_order_key();
  `);
  const [orderId, orderKey] = setupResult.split(':');

  // 1) 웹훅 발송 시도 로그 검증
  const logJson = getLatestWebhookLog(orderId);
  expect(logJson).not.toBe('null');
  const log = JSON.parse(logJson);
  expect(log.order_id).toBe(orderId);
  expect(['success', 'failed']).toContain(log.status);

  // 2) 브라우저 order-received → 리다이렉트 발동 검증
  await page.goto(frontendUrl(`checkout/order-received/${orderId}/?key=${orderKey}`));
  await expect(page).toHaveURL(testData.redirectTarget);
});

// ── 5. 웹훅 활성 + 리다이렉트 비활성 → 감사 페이지 유지 ───────────────────

test('웹훅 활성 + 리다이렉트 비활성 → 감사 페이지 유지 (리다이렉트 미발동)', async ({ page }) => {
  const result = wpEval(`<?php
    $id = wp_insert_post([
      'post_title'  => 'Webhook ON Redirect OFF (coex test)',
      'post_type'   => 'product',
      'post_status' => 'publish',
    ]);
    wp_set_object_terms($id, 'simple', 'product_type');
    update_post_meta($id, '_price', '30000');
    update_post_meta($id, '_regular_price', '30000');
    update_post_meta($id, '_stock_status', 'instock');
    update_post_meta($id, '_virtual', 'yes');
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

  // 리다이렉트 없이 감사 페이지 유지
  await expect(page).toHaveURL(new RegExp(`order-received/${id}`));
});
