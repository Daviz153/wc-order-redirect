<?php
if (!defined('WP_UNINSTALL_PLUGIN')) {
    exit;
}

delete_post_meta_by_key('_wc_order_redirect_enabled');
delete_post_meta_by_key('_wc_order_redirect_url');
delete_option('wcor_enabled');
delete_option('wcor_default_url');
delete_option('wcor_redirect_log');
