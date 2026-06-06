const { test, expect } = require('@playwright/test');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const WP_PATH = process.env.WP_PATH || '/tmp/wordpress';

function wpEval(phpCode) {
  const tmpFile = `/tmp/wc-e2e-${Date.now()}.php`;
  fs.writeFileSync(tmpFile, phpCode);
  try {
    return execSync(`wp eval-file ${tmpFile} --path=${WP_PATH} 2>/dev/null`)
      .toString()
      .trim();
  } finally {
    fs.unlinkSync(tmpFile);
  }
}

function createOrder(productId) {
  const result = wpEval(`<?php
    $order = wc_create_order();
    $order->add_product(wc_get_product(${productId}), 1);
    $order->set_status('processing');
    $order->save();
    echo $order->get_id() . ':' . $order->get_order_key();
  `);
  const [id, key] = result.split(':');
  return { id, key };
}

let testData;

test.beforeAll(() => {
  testData = JSON.parse(
    fs.readFileSync(path.join(__dirname, '.auth', 'test-data.json'), 'utf8')
  );
});

// 프론트엔드 URL 빌더 — WP 홈 기준 (baseURL /wordpress/ 와 분리)
function frontendUrl(path) {
  return testData.frontendBaseUrl.replace(/\/$/, '') + '/' + path.replace(/^\//, '');
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
  // 고가(URL 있음) + 저가(URL 없음) 함께 주문
  const result = wpEval(`<?php
    $order = wc_create_order();
    $order->add_product(wc_get_product(${testData.productWithUrl}),    1); // 100,000원 URL 있음
    $order->add_product(wc_get_product(${testData.productWithoutUrl}), 1); //  30,000원 URL 없음
    $order->set_status('processing');
    $order->save();
    echo $order->get_id() . ':' . $order->get_order_key();
  `);
  const [id, key] = result.split(':');

  await page.goto(frontendUrl(`checkout/order-received/${id}/?key=${key}`));

  await expect(page).toHaveURL(testData.redirectTarget);
});
