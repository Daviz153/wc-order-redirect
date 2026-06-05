<?php
if (!defined('WP_UNINSTALL_PLUGIN')) {
    exit;
}

delete_post_meta_by_key('_wc_order_redirect_enabled');
delete_post_meta_by_key('_wc_order_redirect_url');
