<?php
/**
 * Plugin Name: WC Order Redirect
 * Description: 결제 완료 후 상품별로 설정한 URL로 즉시 이동합니다.
 * Version:     1.0.2
 * Requires Plugins: woocommerce
 * Requires at least: 6.0
 * Requires PHP: 8.0
 */

if (!defined('ABSPATH')) {
    exit;
}

// 자동 업데이트 — GitHub 릴리즈 기반 (vendor/가 있을 때만 로드)
if (file_exists(__DIR__ . '/vendor/autoload.php')) {
    require_once __DIR__ . '/vendor/autoload.php';

    $checker = YahnisElsts\PluginUpdateChecker\v5\PucFactory::buildUpdateChecker(
        'https://github.com/Daviz153-wpPlugins/wc-order-redirect/',
        __FILE__,
        'wc-order-redirect'
    );
    // 릴리즈에 첨부된 ZIP을 다운로드 (vendor/ 포함)
    $checker->getVcsApi()->enableReleaseAssets();
}

// WooCommerce HPOS 호환성 선언
add_action('before_woocommerce_init', function () {
    if (class_exists(\Automattic\WooCommerce\Utilities\FeaturesUtil::class)) {
        \Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility(
            'custom_order_tables',
            __FILE__,
            true
        );
    }
});

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

    add_filter('woocommerce_get_settings_pages', function (array $pages): array {
        require_once __DIR__ . '/includes/class-wc-order-redirect-settings.php';
        $pages[] = new WC_Order_Redirect_Settings();
        return $pages;
    });
});
