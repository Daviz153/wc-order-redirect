const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const WP_PATH = process.env.WP_PATH || '/tmp/wordpress';
// CI에서 리다이렉트 타깃은 WP 홈페이지 (로컬 URL — 외부 네트워크 불필요)
const REDIRECT_TARGET = process.env.WP_BASE_URL || 'http://localhost:8080/wordpress/';

function wpEval(phpCode) {
  const tmpFile = `/tmp/wc-e2e-setup-${Date.now()}.php`;
  fs.writeFileSync(tmpFile, phpCode);
  try {
    return execSync(`wp eval-file ${tmpFile} --path=${WP_PATH} 2>/dev/null`)
      .toString()
      .trim();
  } finally {
    fs.unlinkSync(tmpFile);
  }
}

module.exports = async function globalSetup() {
  const authDir = path.join(__dirname, '.auth');
  fs.mkdirSync(authDir, { recursive: true });

  // 리다이렉트 URL이 있는 상품 (고가)
  const productWithUrl = wpEval(`<?php
    $id = wp_insert_post([
      'post_title'  => 'E2E Coaching Product',
      'post_type'   => 'product',
      'post_status' => 'publish',
    ]);
    wp_set_object_terms($id, 'simple', 'product_type');
    update_post_meta($id, '_price', '100000');
    update_post_meta($id, '_regular_price', '100000');
    update_post_meta($id, '_stock_status', 'instock');
    update_post_meta($id, '_virtual', 'yes');
    update_post_meta($id, '_wc_order_redirect_url', '${REDIRECT_TARGET}');
    echo $id;
  `);

  // 리다이렉트 URL이 없는 상품 (저가)
  const productWithoutUrl = wpEval(`<?php
    $id = wp_insert_post([
      'post_title'  => 'E2E Basic Product',
      'post_type'   => 'product',
      'post_status' => 'publish',
    ]);
    wp_set_object_terms($id, 'simple', 'product_type');
    update_post_meta($id, '_price', '30000');
    update_post_meta($id, '_regular_price', '30000');
    update_post_meta($id, '_stock_status', 'instock');
    update_post_meta($id, '_virtual', 'yes');
    echo $id;
  `);

  fs.writeFileSync(
    path.join(authDir, 'test-data.json'),
    JSON.stringify({ productWithUrl, productWithoutUrl, redirectTarget: REDIRECT_TARGET })
  );

  console.log(`[global-setup] productWithUrl=${productWithUrl}, productWithoutUrl=${productWithoutUrl}`);
};
