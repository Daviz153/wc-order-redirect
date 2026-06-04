<?php
/**
 * Plugin Name: WC Order Redirect
 * Description: 결제 완료 후 상품별로 설정한 URL로 즉시 이동합니다.
 * Version:     1.0.0
 * Requires Plugins: woocommerce
 * Requires at least: 6.0
 * Requires PHP: 8.0
 */

if (!defined('ABSPATH')) {
    exit;
}

add_action('plugins_loaded', function () {
    if (!class_exists('WooCommerce')) {
        add_action('admin_notices', function () {
            echo '<div class="notice notice-error"><p>'
               . 'WC Order Redirect: WooCommerce가 활성화되어 있어야 합니다.'
               . '</p></div>';
        });
        return;
    }

    require_once __DIR__ . '/includes/class-wc-order-redirect-meta.php';
    require_once __DIR__ . '/includes/class-wc-order-redirect.php';

    new WC_Order_Redirect_Meta();
    new WC_Order_Redirect();
});
