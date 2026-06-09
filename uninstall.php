<?php
if (!defined('WP_UNINSTALL_PLUGIN')) {
    exit;
}

delete_post_meta_by_key('_wc_order_redirect_enabled');
delete_post_meta_by_key('_wc_order_redirect_url');
delete_option('wcor_enabled');
delete_option('wcor_default_url');
delete_option('wcor_redirect_log');

// HPOS 주문 메타 삭제 (legacy postmeta는 위 delete_post_meta_by_key로 처리됨)
global $wpdb;
$hpos_table = $wpdb->prefix . 'wc_orders_meta';
if ($wpdb->get_var($wpdb->prepare('SHOW TABLES LIKE %s', $hpos_table)) === $hpos_table) {
    $wpdb->delete($hpos_table, ['meta_key' => '_wcor_redirected'], ['%s']);
}
