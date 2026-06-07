<?php
/**
 * Plugin Name: WC Order Redirect
 * Plugin URI:  https://github.com/Daviz153-wpPlugins/wc-order-redirect
 * Description: 결제 완료 후 상품별로 설정한 URL로 즉시 이동합니다.
 * Version:     1.0.2
 * Author:      CRMBiz
 * Author URI:  https://github.com/Daviz153-wpPlugins
 * License:     GPL-2.0-or-later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: wc-order-redirect
 * Requires at least: 6.0
 * Tested up to: 6.8
 * Requires PHP: 8.0
 * Requires Plugins: woocommerce
 * WC requires at least: 8.0
 * WC tested up to: 9.8
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

    // GDPR: 개인정보 내보내기/삭제 API 등록
    add_filter('wp_privacy_personal_data_exporters', 'wcor_privacy_register_exporter');
    add_filter('wp_privacy_personal_data_erasers',   'wcor_privacy_register_eraser');
});

// ── GDPR Privacy API ─────────────────────────────────────────────────────────

function wcor_privacy_register_exporter(array $exporters): array {
    $exporters['wc-order-redirect'] = [
        'exporter_friendly_name' => 'WC Order Redirect 리다이렉트 로그',
        'callback'               => 'wcor_privacy_exporter',
    ];
    return $exporters;
}

/**
 * 이메일로 리다이렉트 로그 엔트리를 내보냅니다.
 * 로그는 최근 50건의 2차 복사본이며, 주문 원본 데이터는 WooCommerce 자체 툴로 처리됩니다.
 */
function wcor_privacy_exporter(string $email, int $page = 1): array {
    $log  = (array) get_option('wcor_redirect_log', []);
    $data = [];

    foreach ($log as $entry) {
        if (strtolower($entry['email'] ?? '') !== strtolower($email)) {
            continue;
        }
        $data[] = [
            'group_id'    => 'wcor-redirect-log',
            'group_label' => '리다이렉트 로그',
            'item_id'     => 'wcor-' . ($entry['ts'] ?? '') . '-' . ($entry['order'] ?? ''),
            'data'        => [
                ['name' => '주문번호', 'value' => (string) ($entry['order']    ?? '')],
                ['name' => '이동 URL', 'value' => (string) ($entry['url']     ?? '')],
                ['name' => '시간',     'value' => $entry['ts'] ? (string) wp_date('Y-m-d H:i', (int) $entry['ts']) : ''],
                ['name' => '이름',     'value' => (string) ($entry['customer'] ?? '')],
                ['name' => '이메일',   'value' => (string) ($entry['email']    ?? '')],
                ['name' => '전화번호', 'value' => (string) ($entry['phone']    ?? '')],
            ],
        ];
    }

    return ['data' => $data, 'done' => true];
}

function wcor_privacy_register_eraser(array $erasers): array {
    $erasers['wc-order-redirect'] = [
        'eraser_friendly_name' => 'WC Order Redirect 리다이렉트 로그',
        'callback'             => 'wcor_privacy_eraser',
    ];
    return $erasers;
}

function wcor_privacy_eraser(string $email, int $page = 1): array {
    $log     = (array) get_option('wcor_redirect_log', []);
    $removed = 0;
    $new_log = array_values(array_filter($log, function (array $entry) use ($email, &$removed): bool {
        if (strtolower($entry['email'] ?? '') === strtolower($email)) {
            $removed++;
            return false;
        }
        return true;
    }));

    if ($removed > 0) {
        update_option('wcor_redirect_log', $new_log, false);
    }

    return [
        'items_removed'  => $removed,
        'items_retained' => false,
        'messages'       => [],
        'done'           => true,
    ];
}
