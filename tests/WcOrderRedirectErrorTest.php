<?php

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../includes/class-wc-order-redirect.php';
require_once __DIR__ . '/../includes/class-wc-order-redirect-meta.php';

// 잘못된 key 시뮬레이션
class WC_Order_InvalidKey extends WC_Order {
    public function key_is_valid(string $key): bool { return false; }
}

// 주문 상태 시뮬레이션
class WC_Order_WithStatus extends WC_Order {
    public function __construct(array $items = [], private string $status = 'processing') {
        parent::__construct($items);
    }
    public function get_status(): string { return $this->status; }
}

class WcOrderRedirectErrorTest extends TestCase {

    protected function setUp(): void {
        $GLOBALS['_post_meta']              = [];
        $GLOBALS['_wp_redirect_called']     = false;
        $GLOBALS['_wp_redirect_url']        = '';
        $GLOBALS['_is_order_received_page'] = true;
        $GLOBALS['_wc_orders']              = [];
        $GLOBALS['_query_vars']             = [];
        $_GET = [];
    }

    // ── 잘못된 요청 시나리오 ─────────────────────────────────────────────────

    public function test_no_redirect_when_order_key_invalid(): void {
        $GLOBALS['_query_vars']['order-received'] = 42;
        $_GET['key'] = 'wc_order_WRONG';

        $item  = new WC_Order_Item_Product(10, 100.0);
        $order = new WC_Order_InvalidKey([$item]);
        $GLOBALS['_wc_orders'][42] = $order;

        $GLOBALS['_post_meta'][10]['_wc_order_redirect_enabled'] = 'yes';
        $GLOBALS['_post_meta'][10]['_wc_order_redirect_url']     = 'https://example.com/target';

        (new WC_Order_Redirect())->maybe_redirect();

        $this->assertFalse($GLOBALS['_wp_redirect_called'], '잘못된 key → 리다이렉트 차단');
    }

    public function test_no_redirect_when_order_does_not_exist(): void {
        $GLOBALS['_query_vars']['order-received'] = 9999;
        $_GET['key'] = 'wc_order_abc';

        (new WC_Order_Redirect())->maybe_redirect();

        $this->assertFalse($GLOBALS['_wp_redirect_called'], '존재하지 않는 주문 → 리다이렉트 없음');
    }

    public function test_no_redirect_when_order_id_is_zero(): void {
        $GLOBALS['_query_vars']['order-received'] = 0;

        (new WC_Order_Redirect())->maybe_redirect();

        $this->assertFalse($GLOBALS['_wp_redirect_called'], 'order-received=0 → 리다이렉트 없음');
    }

    public function test_no_redirect_when_order_has_no_items(): void {
        $GLOBALS['_query_vars']['order-received'] = 1;
        $_GET['key'] = 'wc_order_valid';

        $order = new WC_Order([]);
        $GLOBALS['_wc_orders'][1] = $order;

        (new WC_Order_Redirect())->maybe_redirect();

        $this->assertFalse($GLOBALS['_wp_redirect_called'], '아이템 없는 주문 → 리다이렉트 없음');
    }

    public function test_redirect_url_rejects_javascript_scheme(): void {
        $item  = new WC_Order_Item_Product(10, 50.0);
        $order = new WC_Order([$item]);

        $GLOBALS['_post_meta'][10]['_wc_order_redirect_enabled'] = 'yes';
        $GLOBALS['_post_meta'][10]['_wc_order_redirect_url']     = 'javascript:alert(1)';

        $url = (new WC_Order_Redirect())->get_redirect_url($order);

        $this->assertSame('', $url, 'javascript: scheme → URL 반환 안 함');
    }

    public function test_redirect_url_rejects_data_scheme(): void {
        $item  = new WC_Order_Item_Product(10, 50.0);
        $order = new WC_Order([$item]);

        $GLOBALS['_post_meta'][10]['_wc_order_redirect_enabled'] = 'yes';
        $GLOBALS['_post_meta'][10]['_wc_order_redirect_url']     = 'data:text/html,<script>alert(1)</script>';

        $url = (new WC_Order_Redirect())->get_redirect_url($order);

        $this->assertSame('', $url, 'data: scheme → URL 반환 안 함');
    }

    // ── 주문 상태별 동작 (현재 동작 문서화)
    // ⚠️ NOTE: maybe_redirect()는 현재 주문 상태를 검사하지 않음.
    //           pending/failed 주문도 order-received URL에 직접 접근 시 리다이렉트됨.
    //           이는 무통장입금(on-hold) 등 미결제 주문에서 의도치 않게 발동할 수 있으므로
    //           운영 환경에 맞게 상태 게이팅 추가를 검토해야 함.
    // ─────────────────────────────────────────────────────────────────────────

    public function test_current_behavior_returns_url_regardless_of_pending_status(): void {
        $item  = new WC_Order_Item_Product(10, 50.0);
        $order = new WC_Order_WithStatus([$item], 'pending');

        $GLOBALS['_post_meta'][10]['_wc_order_redirect_enabled'] = 'yes';
        $GLOBALS['_post_meta'][10]['_wc_order_redirect_url']     = 'https://example.com/target';

        // get_redirect_url()는 주문 상태를 검사하지 않음
        $url = (new WC_Order_Redirect())->get_redirect_url($order);

        // 현재 동작: pending 상태 주문도 리다이렉트 URL 반환됨 (상태 게이팅 없음)
        $this->assertSame('https://example.com/target', $url,
            '⚠️ pending 상태도 URL 반환됨 — 무통장입금 등 미결제 주문 리다이렉트 검토 필요');
    }

    public function test_current_behavior_returns_url_regardless_of_failed_status(): void {
        $item  = new WC_Order_Item_Product(10, 50.0);
        $order = new WC_Order_WithStatus([$item], 'failed');

        $GLOBALS['_post_meta'][10]['_wc_order_redirect_enabled'] = 'yes';
        $GLOBALS['_post_meta'][10]['_wc_order_redirect_url']     = 'https://example.com/target';

        $url = (new WC_Order_Redirect())->get_redirect_url($order);

        // 현재 동작: failed 상태 주문도 리다이렉트 URL 반환됨
        $this->assertSame('https://example.com/target', $url,
            '⚠️ failed 상태도 URL 반환됨 — 결제 실패 주문 리다이렉트 검토 필요');
    }

    // ── 플러그인 공존 — 메타 키 독립성 ─────────────────────────────────────

    public function test_redirect_reads_only_own_meta_keys(): void {
        $item  = new WC_Order_Item_Product(10, 50.0);
        $order = new WC_Order([$item]);

        // 웹훅 플러그인 메타만 설정 (리다이렉트 메타 없음)
        $GLOBALS['_post_meta'][10]['_wcmw_product_enabled'] = '1';
        $GLOBALS['_post_meta'][10]['_wcmw_product_url']     = 'https://hook.example.com/webhook';

        $url = (new WC_Order_Redirect())->get_redirect_url($order);

        $this->assertSame('', $url, '웹훅 메타만 있을 때 → 리다이렉트 플러그인 미발동');
    }

    public function test_redirect_works_when_both_plugin_metas_coexist(): void {
        $item  = new WC_Order_Item_Product(10, 50.0);
        $order = new WC_Order([$item]);

        // 두 플러그인 메타 모두 설정
        $GLOBALS['_post_meta'][10]['_wcmw_product_enabled']      = '1';
        $GLOBALS['_post_meta'][10]['_wcmw_product_url']          = 'https://hook.example.com/webhook';
        $GLOBALS['_post_meta'][10]['_wc_order_redirect_enabled'] = 'yes';
        $GLOBALS['_post_meta'][10]['_wc_order_redirect_url']     = 'https://example.com/thank-you';

        $url = (new WC_Order_Redirect())->get_redirect_url($order);

        $this->assertSame('https://example.com/thank-you', $url,
            '두 플러그인 메타 공존 시 → 리다이렉트 URL 정확히 반환');
    }

    public function test_webhook_enabled_does_not_activate_redirect(): void {
        $item  = new WC_Order_Item_Product(10, 50.0);
        $order = new WC_Order([$item]);

        // 웹훅 활성 + 리다이렉트 비활성
        $GLOBALS['_post_meta'][10]['_wcmw_product_enabled']      = '1';
        $GLOBALS['_post_meta'][10]['_wcmw_product_url']          = 'https://hook.example.com/webhook';
        $GLOBALS['_post_meta'][10]['_wc_order_redirect_enabled'] = 'no';
        $GLOBALS['_post_meta'][10]['_wc_order_redirect_url']     = 'https://example.com/thank-you';

        $url = (new WC_Order_Redirect())->get_redirect_url($order);

        $this->assertSame('', $url,
            '웹훅 활성 + 리다이렉트 비활성 → 리다이렉트 미발동');
    }
}
