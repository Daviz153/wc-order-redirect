<?php

if (!defined('ABSPATH')) {
    exit;
}

class WC_Order_Redirect {

    public function __construct() {
        add_action('template_redirect', [$this, 'maybe_redirect']);
    }

    public function maybe_redirect(): void {
        if (!is_order_received_page()) {
            return;
        }

        $order = $this->get_order();
        if (!$order) {
            return;
        }

        $url = $this->get_redirect_url($order);
        if (!$url) {
            return;
        }

        wp_redirect(esc_url_raw($url), 302);
        exit();
    }

    private function get_order(): ?\WC_Order {
        $order_id = absint(get_query_var('order-received'));
        if (!$order_id) {
            return null;
        }

        $order = wc_get_order($order_id);
        if (!($order instanceof \WC_Order)) {
            return null;
        }

        $key = isset($_GET['key']) ? sanitize_text_field(wp_unslash($_GET['key'])) : '';
        if (!$order->key_is_valid($key)) {
            return null;
        }

        return $order;
    }

    public function get_redirect_url(\WC_Order $order): string {
        $items = $order->get_items();

        // 리다이렉트 활성화된 상품만 추출
        $enabled_items = array_filter($items, function ($item) {
            return 'yes' === get_post_meta($item->get_product_id(), '_wc_order_redirect_enabled', true);
        });

        if (empty($enabled_items)) {
            return '';
        }

        // 활성화된 상품 중 최고가 우선
        uasort($enabled_items, fn($a, $b) => $b->get_total() <=> $a->get_total());

        foreach ($enabled_items as $item) {
            $url = get_post_meta($item->get_product_id(), '_wc_order_redirect_url', true);
            if ($url && wp_http_validate_url($url)) {
                return $url;
            }
        }

        return '';
    }
}
