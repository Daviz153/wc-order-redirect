<?php

if (!defined('ABSPATH')) {
    exit;
}

class WC_Order_Redirect_Meta {

    public function __construct() {
        add_action('add_meta_boxes', [$this, 'add_meta_box']);
        add_action('save_post_product', [$this, 'save_meta_box']);
    }

    public function add_meta_box(): void {
        add_meta_box(
            'wc_order_redirect',
            '결제 후 리다이렉트 URL',
            [$this, 'render_meta_box'],
            'product',
            'side'
        );
    }

    public function render_meta_box(\WP_Post $post): void {
        wp_nonce_field('wc_order_redirect_save', 'wc_order_redirect_nonce');
        $url = get_post_meta($post->ID, '_wc_order_redirect_url', true);
        ?>
        <label for="wc_order_redirect_url">결제 완료 시 이동할 URL</label>
        <input type="url"
               id="wc_order_redirect_url"
               name="wc_order_redirect_url"
               value="<?php echo esc_attr($url); ?>"
               placeholder="https://example.com"
               style="width:100%; margin-top:4px;">
        <p style="margin-top:4px; color:#666; font-size:12px;">
            비워두면 기본 감사 페이지가 표시됩니다.
        </p>
        <?php
    }

    public function save_meta_box(int $post_id): void {
        if (!isset($_POST['wc_order_redirect_nonce'])) {
            return;
        }
        if (!check_admin_referer('wc_order_redirect_save', 'wc_order_redirect_nonce')) {
            return;
        }
        if (!current_user_can('edit_post', $post_id)) {
            return;
        }
        if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) {
            return;
        }

        $url = esc_url_raw(wp_unslash($_POST['wc_order_redirect_url'] ?? ''));
        update_post_meta($post_id, '_wc_order_redirect_url', $url);
    }
}
