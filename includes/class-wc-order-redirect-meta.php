<?php

if (!defined('ABSPATH')) {
    exit;
}

class WC_Order_Redirect_Meta {

    public function __construct() {
        add_action('add_meta_boxes', [$this, 'add_meta_box']);
        add_action('save_post_product', [$this, 'save_meta_box']);
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

    public function add_meta_box(): void {
        add_meta_box(
            'wc_order_redirect',
            '결제 후 리다이렉트',
            [$this, 'render_meta_box'],
            'product',
            'side'
        );
    }

    public function render_meta_box(\WP_Post $post): void {
        wp_nonce_field('wc_order_redirect_save', 'wc_order_redirect_nonce');
        $enabled = get_post_meta($post->ID, '_wc_order_redirect_enabled', true);
        $url     = get_post_meta($post->ID, '_wc_order_redirect_url', true);
        ?>
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
        <label for="wc_order_redirect_url" style="display:block; margin-bottom:4px;">
            결제 완료 시 이동할 URL
        </label>
        <input type="url"
               id="wc_order_redirect_url"
               name="wc_order_redirect_url"
               value="<?php echo esc_attr($url); ?>"
               placeholder="https://example.com"
               style="width:100%;">
        <p style="margin-top:4px; color:#666; font-size:12px;">
            활성화 시 결제 완료 후 즉시 이동합니다.
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

        $enabled = isset($_POST['wc_order_redirect_enabled']) ? 'yes' : 'no';
        $url     = esc_url_raw(wp_unslash($_POST['wc_order_redirect_url'] ?? ''));

        update_post_meta($post_id, '_wc_order_redirect_enabled', $enabled);
        update_post_meta($post_id, '_wc_order_redirect_url', $url);
    }
}
