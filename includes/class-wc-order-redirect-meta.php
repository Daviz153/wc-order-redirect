<?php

if (!defined('ABSPATH')) {
    exit;
}

class WC_Order_Redirect_Meta {

    public function __construct() {
        add_filter('woocommerce_product_data_tabs', [$this, 'add_product_tab']);
        add_action('woocommerce_product_data_panels', [$this, 'render_product_panel']);
        add_action('woocommerce_process_product_meta', [$this, 'save_product_meta']);
        add_action('admin_enqueue_scripts', [$this, 'enqueue_styles']);
    }

    public function enqueue_styles(string $hook): void {
        if (!in_array($hook, ['post.php', 'post-new.php'], true)) {
            return;
        }
        $screen = get_current_screen();
        if (!$screen || $screen->post_type !== 'product') {
            return;
        }
        wp_enqueue_style(
            'wcor-meta-box',
            plugin_dir_url(dirname(__FILE__)) . 'assets/css/meta-box.css',
            [],
            '1.0.0'
        );
    }

    public function add_product_tab(array $tabs): array {
        $tabs['wcor'] = [
            'label'  => '리다이렉트',
            'target' => 'wcor_product_data',
            'class'  => [],
        ];
        return $tabs;
    }

    public function render_product_panel(): void {
        $product_id = get_the_ID();
        $enabled    = get_post_meta($product_id, '_wc_order_redirect_enabled', true);
        $url        = get_post_meta($product_id, '_wc_order_redirect_url', true);
        ?>
        <div id="wcor_product_data" class="panel woocommerce_options_panel">
            <div class="options_group" style="padding:12px 16px">
                <div class="wcor-toggle-wrap">
                    <label class="wcor-toggle">
                        <input type="checkbox"
                               id="wc_order_redirect_enabled"
                               name="wc_order_redirect_enabled"
                               value="yes"
                               <?php checked($enabled, 'yes'); ?>>
                        <span class="wcor-slider"></span>
                    </label>
                    <span style="font-weight:600;">리다이렉트 사용</span>
                </div>
                <p style="margin-top:10px; margin-bottom:4px;">
                    <label for="wc_order_redirect_url">결제 완료 시 이동할 URL</label>
                </p>
                <input type="url"
                       id="wc_order_redirect_url"
                       name="wc_order_redirect_url"
                       value="<?php echo esc_attr($url); ?>"
                       placeholder="https://example.com"
                       style="width:100%; max-width:420px;">
                <p style="margin-top:4px; color:#666; font-size:12px;">
                    활성화 시 결제 완료 후 즉시 이동합니다.
                </p>
            </div>
        </div>
        <?php
    }

    public function save_product_meta(int $post_id): void {
        if (!current_user_can('edit_post', $post_id)) {
            return;
        }
        // phpcs:ignore WordPress.Security.NonceVerification.Missing -- WooCommerce already verifies nonce in woocommerce_process_product_meta
        $enabled = isset($_POST['wc_order_redirect_enabled']) ? 'yes' : 'no';
        // phpcs:ignore WordPress.Security.NonceVerification.Missing
        $url = esc_url_raw(wp_unslash($_POST['wc_order_redirect_url'] ?? ''));

        update_post_meta($post_id, '_wc_order_redirect_enabled', $enabled);
        update_post_meta($post_id, '_wc_order_redirect_url', $url);
    }
}
