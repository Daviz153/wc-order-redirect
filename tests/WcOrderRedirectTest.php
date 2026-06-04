<?php

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../includes/class-wc-order-redirect.php';
require_once __DIR__ . '/../includes/class-wc-order-redirect-meta.php';

class WcOrderRedirectTest extends TestCase {

    protected function setUp(): void {
        $GLOBALS['_post_meta']               = [];
        $GLOBALS['_wp_redirect_called']      = false;
        $GLOBALS['_wp_redirect_url']         = '';
        $GLOBALS['_is_order_received_page']  = false;
        $GLOBALS['_wc_orders']               = [];
        $GLOBALS['_query_vars']              = [];
    }

    // --- [Feature B] 리다이렉트 로직 ---

    public function test_no_redirect_when_not_thankyou_page(): void {
        $GLOBALS['_is_order_received_page'] = false;

        (new WC_Order_Redirect())->maybe_redirect();

        $this->assertFalse($GLOBALS['_wp_redirect_called']);
    }

    public function test_no_redirect_when_url_empty(): void {
        $GLOBALS['_is_order_received_page'] = true;
        $GLOBALS['_query_vars']['order-received'] = 1;

        $item  = new WC_Order_Item_Product(10, 50.0);
        $order = new WC_Order([$item]);
        $GLOBALS['_wc_orders'][1] = $order;

        // 상품에 URL 없음
        $GLOBALS['_post_meta'][10]['_wc_order_redirect_url'] = '';

        (new WC_Order_Redirect())->maybe_redirect();

        $this->assertFalse($GLOBALS['_wp_redirect_called']);
    }

    public function test_redirects_to_product_url(): void {
        $GLOBALS['_is_order_received_page'] = true;
        $GLOBALS['_query_vars']['order-received'] = 1;

        $item  = new WC_Order_Item_Product(10, 50.0);
        $order = new WC_Order([$item]);
        $GLOBALS['_wc_orders'][1] = $order;

        $GLOBALS['_post_meta'][10]['_wc_order_redirect_url'] = 'https://example.com/next';

        // exit()을 피하기 위해 get_redirect_url로 직접 검증
        $redirect = new WC_Order_Redirect();
        $url = $redirect->get_redirect_url($order);

        $this->assertSame('https://example.com/next', $url);
    }

    public function test_uses_most_expensive_product_url(): void {
        $itemA = new WC_Order_Item_Product(10, 30.0);  // 저가
        $itemB = new WC_Order_Item_Product(20, 80.0);  // 고가 — 이쪽 URL이 선택되어야 함
        $order = new WC_Order([$itemA, $itemB]);

        $GLOBALS['_post_meta'][10]['_wc_order_redirect_url'] = 'https://example.com/cheap';
        $GLOBALS['_post_meta'][20]['_wc_order_redirect_url'] = 'https://example.com/expensive';

        $url = (new WC_Order_Redirect())->get_redirect_url($order);

        $this->assertSame('https://example.com/expensive', $url);
    }

    public function test_skips_invalid_url(): void {
        $item  = new WC_Order_Item_Product(10, 50.0);
        $order = new WC_Order([$item]);

        $GLOBALS['_post_meta'][10]['_wc_order_redirect_url'] = 'not-a-valid-url';

        $url = (new WC_Order_Redirect())->get_redirect_url($order);

        $this->assertSame('', $url);
    }

    // --- [Feature A] 메타박스 저장 ---

    public function test_meta_saved_with_esc_url_raw(): void {
        $_POST['wc_order_redirect_nonce'] = 'test';
        $_POST['wc_order_redirect_url']   = 'https://example.com/thank-you';

        (new WC_Order_Redirect_Meta())->save_meta_box(42);

        $saved = get_post_meta(42, '_wc_order_redirect_url', true);
        $this->assertSame('https://example.com/thank-you', $saved);
    }

    public function test_invalid_url_is_sanitized_on_save(): void {
        $_POST['wc_order_redirect_nonce'] = 'test';
        $_POST['wc_order_redirect_url']   = 'javascript:alert(1)';

        (new WC_Order_Redirect_Meta())->save_meta_box(42);

        $saved = get_post_meta(42, '_wc_order_redirect_url', true);
        $this->assertSame('', $saved);
    }

    // --- [Feature C] uninstall ---

    public function test_uninstall_removes_all_meta(): void {
        $GLOBALS['_post_meta'][1]['_wc_order_redirect_url'] = 'https://example.com/a';
        $GLOBALS['_post_meta'][2]['_wc_order_redirect_url'] = 'https://example.com/b';

        delete_post_meta_by_key('_wc_order_redirect_url');

        $this->assertSame('', get_post_meta(1, '_wc_order_redirect_url', true));
        $this->assertSame('', get_post_meta(2, '_wc_order_redirect_url', true));
    }
}
