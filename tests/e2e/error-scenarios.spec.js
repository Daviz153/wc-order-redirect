/**
 * 오류 시나리오 E2E 테스트
 *
 * 결제가 정상적으로 완료되지 않은 경우 또는 잘못된 요청에서
 * wc-order-redirect 플러그인이 올바르게 동작하는지 검증합니다.
 *
 * ⚠️ 주문 상태 게이팅:
 *  코드 레벨에서 maybe_redirect()는 주문 상태를 검사하지 않습니다.
 *  그러나 WooCommerce 실제 환경에서는 pending/on-hold 주문에 대해
 *  order-received 페이지가 올바르게 처리되지 않아 리다이렉트가 발동되지 않습니다.
 *  (PHPUnit 단위 테스트에서 코드 레벨 동작이 별도 문서화됨)
 */

const { test, expect } = require('@playwright/test');
const { execSync }     = require('child_process');
const fs               = require('fs');
const path             = require('path');

const WP_PATH = process.env.WP_PATH || '/tmp/wordpress';

function wpEval(phpCode) {
  const tmpFile = `/tmp/wc-err-${Date.now()}.php`;
  fs.writeFileSync(tmpFile, phpCode);
  try {
    return execSync(`wp eval-file ${tmpFile} --path=${WP_PATH} 2>/dev/null`)
      .toString().trim();
  } finally {
    fs.unlinkSync(tmpFile);
  }
}

let testData;

test.beforeAll(() => {
  testData = JSON.parse(
    fs.readFileSync(path.join(__dirname, '.auth', 'test-data.json'), 'utf8')
  );
});

// 프론트엔드 URL 빌더 — WP 홈 기준 (Playwright baseURL /wordpress/ 와 분리)
function frontendUrl(urlPath) {
  return testData.frontendBaseUrl.replace(/\/$/, '') + '/' + urlPath.replace(/^\//, '');
}

// ── 잘못된 order key ────────────────────────────────────────────────────────

test('잘못된 order key → 리다이렉트 미발동 (감사 페이지 또는 WC 오류)', async ({ page }) => {
  // 실제 주문 생성 후 키를 의도적으로 틀리게 사용
  const result = wpEval(`<?php
    $order = wc_create_order();
    $order->add_product(wc_get_product(${testData.productWithUrl}), 1);
    $order->set_status('processing');
    $order->save();
    echo $order->get_id();
  `);
  const orderId = result.trim();

  await page.goto(
    frontendUrl(`checkout/order-received/${orderId}/?key=wc_order_INVALID_KEY_XXXX`),
    { waitUntil: 'domcontentloaded' }
  );

  // 플러그인 리다이렉트 대상으로 이동하면 안 됨
  expect(page.url()).not.toBe(testData.redirectTarget);
});

// ── 존재하지 않는 주문 ─────────────────────────────────────────────────────

test('존재하지 않는 주문 ID → 리다이렉트 미발동', async ({ page }) => {
  await page.goto(
    frontendUrl('checkout/order-received/999999/?key=wc_order_NONEXISTENT'),
    { waitUntil: 'domcontentloaded' }
  );

  expect(page.url()).not.toBe(testData.redirectTarget);
});

// ── key 파라미터 누락 ──────────────────────────────────────────────────────

test('order key 파라미터 없이 접근 → 리다이렉트 미발동', async ({ page }) => {
  const result = wpEval(`<?php
    $order = wc_create_order();
    $order->add_product(wc_get_product(${testData.productWithUrl}), 1);
    $order->set_status('processing');
    $order->save();
    echo $order->get_id();
  `);
  const orderId = result.trim();

  await page.goto(
    frontendUrl(`checkout/order-received/${orderId}/`),
    { waitUntil: 'domcontentloaded' }
  );

  expect(page.url()).not.toBe(testData.redirectTarget);
});

// ── 주문 상태별 실제 동작 문서화 ─────────────────────────────────────────
// ⚠️ 미결제 주문 리다이렉트 주의:
//  pending/on-hold(무통장입금) 상태 주문도 유효한 key로 접근하면 리다이렉트가 발동됩니다.
//  이는 코드 레벨 상태 게이팅이 없기 때문입니다 (PHPUnit 테스트에 문서화됨).
//  무통장입금을 사용하는 경우, 실제로 입금 확인 전에 리다이렉트가 발동될 수 있습니다.

test('⚠️ pending 주문 + 유효 key → 리다이렉트 발동됨 (상태 게이팅 없음)', async ({ page }) => {
  const result = wpEval(`<?php
    $order = wc_create_order();
    $order->add_product(wc_get_product(${testData.productWithUrl}), 1);
    $order->set_status('pending');
    $order->save();
    echo $order->get_id() . ':' . $order->get_order_key();
  `);
  const [id, key] = result.split(':');

  await page.goto(
    frontendUrl(`checkout/order-received/${id}/?key=${key}`),
    { waitUntil: 'domcontentloaded', timeout: 10_000 }
  );

  // 현재 동작: pending 주문도 리다이렉트 발동됨 — 상태 게이팅 추가 검토 필요
  await expect(page).toHaveURL(testData.redirectTarget, { timeout: 5_000 });
});

test('⚠️ on-hold 주문 + 유효 key → 리다이렉트 발동됨 (무통장입금 미결제 시에도)', async ({ page }) => {
  const result = wpEval(`<?php
    $order = wc_create_order();
    $order->add_product(wc_get_product(${testData.productWithUrl}), 1);
    $order->set_status('on-hold');
    $order->save();
    echo $order->get_id() . ':' . $order->get_order_key();
  `);
  const [id, key] = result.split(':');

  await page.goto(
    frontendUrl(`checkout/order-received/${id}/?key=${key}`),
    { waitUntil: 'domcontentloaded', timeout: 10_000 }
  );

  // 현재 동작: on-hold(무통장입금) 주문도 리다이렉트 발동됨 — 상태 게이팅 추가 검토 필요
  await expect(page).toHaveURL(testData.redirectTarget, { timeout: 5_000 });
});
