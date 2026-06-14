const { dockerPhp } = require('./helpers');
const fs   = require('fs');
const path = require('path');

module.exports = async function globalSetup() {
    const authDir = path.join(__dirname, '.auth');
    fs.mkdirSync(authDir, { recursive: true });

    const frontendBaseUrl = dockerPhp(`echo trailingslashit(home_url());`);
    const siteUrl         = dockerPhp(`echo untrailingslashit(site_url());`);
    const REDIRECT_TARGET = frontendBaseUrl;

    // 리다이렉트 URL 설정 상품 (고가)
    const productWithUrl = dockerPhp(`
$id = wp_insert_post([
    'post_title'  => 'E2E Coaching Product',
    'post_type'   => 'product',
    'post_status' => 'publish',
]);
wp_set_object_terms($id, 'simple', 'product_type');
update_post_meta($id, '_price',            '100000');
update_post_meta($id, '_regular_price',    '100000');
update_post_meta($id, '_stock_status',     'instock');
update_post_meta($id, '_virtual',          'yes');
update_post_meta($id, '_wc_order_redirect_enabled', 'yes');
update_post_meta($id, '_wc_order_redirect_url',     '${REDIRECT_TARGET}');
echo $id;
`);

    // 리다이렉트 URL 미설정 상품 (저가)
    const productWithoutUrl = dockerPhp(`
$id = wp_insert_post([
    'post_title'  => 'E2E Basic Product',
    'post_type'   => 'product',
    'post_status' => 'publish',
]);
wp_set_object_terms($id, 'simple', 'product_type');
update_post_meta($id, '_price',         '30000');
update_post_meta($id, '_regular_price', '30000');
update_post_meta($id, '_stock_status',  'instock');
update_post_meta($id, '_virtual',       'yes');
echo $id;
`);

    fs.writeFileSync(
        path.join(authDir, 'test-data.json'),
        JSON.stringify({ productWithUrl, productWithoutUrl, redirectTarget: REDIRECT_TARGET, frontendBaseUrl, siteUrl })
    );

    // checkout-flow 스펙이 COD(착불결제)를 사용하므로 활성화 보장
    dockerPhp(`
update_option('woocommerce_cod_settings', [
    'enabled'            => 'yes',
    'enable_for_virtual' => 'yes',
    'title'              => 'Cash on Delivery',
    'description'        => '',
    'instructions'       => '',
]);
`);

    console.log(`[global-setup] productWithUrl=${productWithUrl}, productWithoutUrl=${productWithoutUrl}, frontendBaseUrl=${frontendBaseUrl}`);
};
