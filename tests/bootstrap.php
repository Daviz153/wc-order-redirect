<?php

define('ABSPATH', dirname(__DIR__) . '/');
define('DOING_AUTOSAVE', false);

// --- WordPress 훅 스텁 (생성자 등록용, 실제 발동 불필요) ---
function add_action(string $hook, callable $callback, int $priority = 10, int $args = 1): void {}
function add_filter(string $hook, callable $callback, int $priority = 10, int $args = 1): void {}
function add_meta_box(string $id, string $title, callable $callback, string $screen, string $context = 'advanced'): void {}
function get_current_screen(): ?object { return null; }
function plugin_dir_url(string $file): string { return 'http://example.com/plugins/wc-order-redirect/'; }
function wp_enqueue_style(string $handle, string $src = '', array $deps = [], $ver = false): void {}

// --- post_meta 인메모리 저장소 ---
$GLOBALS['_post_meta'] = [];

function get_post_meta(int $post_id, string $key, bool $single = false) {
    $value = $GLOBALS['_post_meta'][$post_id][$key] ?? '';
    return $single ? $value : [$value];
}

function update_post_meta(int $post_id, string $key, $value): bool {
    $GLOBALS['_post_meta'][$post_id][$key] = $value;
    return true;
}

function delete_post_meta_by_key(string $key): void {
    foreach ($GLOBALS['_post_meta'] as $post_id => $_) {
        unset($GLOBALS['_post_meta'][$post_id][$key]);
    }
}

// --- URL 처리 ---
function esc_url_raw(string $url): string {
    // http/https 외 scheme 차단
    if (!preg_match('/^https?:\/\//i', $url)) return '';
    return $url;
}

function esc_attr(string $text): string {
    return htmlspecialchars($text, ENT_QUOTES, 'UTF-8');
}

function wp_http_validate_url(string $url): string|false {
    return filter_var($url, FILTER_VALIDATE_URL) ? $url : false;
}

// --- 리다이렉트 ---
$GLOBALS['_wp_redirect_called'] = false;
$GLOBALS['_wp_redirect_url']    = '';

function wp_redirect(string $url, int $status = 302): void {
    $GLOBALS['_wp_redirect_called'] = true;
    $GLOBALS['_wp_redirect_url']    = $url;
}

// --- 보안 ---
function wp_nonce_field(string $action, string $name): void {}
function check_admin_referer(string $action, string $name = '_wpnonce'): bool { return true; }
function current_user_can(string $cap, ...$args): bool { return true; }
function wp_unslash($value) { return $value; }
function sanitize_text_field(string $str): string { return trim(strip_tags($str)); }
function absint($value): int { return abs((int) $value); }

// --- WooCommerce 스텁 ---
function is_order_received_page(): bool {
    return $GLOBALS['_is_order_received_page'] ?? false;
}

function wc_get_order(int $order_id): ?\WC_Order {
    return $GLOBALS['_wc_orders'][$order_id] ?? null;
}

function get_query_var(string $key): mixed {
    return $GLOBALS['_query_vars'][$key] ?? '';
}

class WC_Order {
    private array $items;

    public function __construct(array $items = []) {
        $this->items = $items;
    }

    public function get_items(): array {
        return $this->items;
    }

    public function key_is_valid(string $key): bool {
        return true;
    }
}

class WC_Order_Item_Product {
    public function __construct(
        private int $product_id,
        private float $total
    ) {}

    public function get_product_id(): int   { return $this->product_id; }
    public function get_total(): float      { return $this->total; }
}

class WooCommerce {}
