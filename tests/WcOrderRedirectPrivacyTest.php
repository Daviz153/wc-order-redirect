<?php

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../includes/class-wc-order-redirect-privacy.php';

class WcOrderRedirectPrivacyTest extends TestCase {

    protected function setUp(): void {
        $GLOBALS['_options'] = [];
    }

    private function seedLog(): void {
        update_option('wcor_redirect_log', [
            ['ts' => 1000, 'order' => 1, 'url' => 'https://a.example.com', 'email' => 'user@example.com',  'customer' => '홍길동', 'phone' => '010-1234-5678', 'products' => '상품A'],
            ['ts' => 2000, 'order' => 2, 'url' => 'https://b.example.com', 'email' => 'other@example.com', 'customer' => '김철수', 'phone' => '010-9999-0000', 'products' => '상품B'],
            ['ts' => 3000, 'order' => 3, 'url' => 'https://c.example.com', 'email' => 'USER@EXAMPLE.COM',  'customer' => '이영희', 'phone' => '010-0000-1111', 'products' => '상품C'],
        ]);
    }

    // ── Exporter ─────────────────────────────────────────────────────────────

    public function test_exporter_registers(): void {
        $result = wcor_privacy_register_exporter([]);
        $this->assertArrayHasKey('wc-order-redirect', $result);
        $this->assertSame('wcor_privacy_exporter', $result['wc-order-redirect']['callback']);
    }

    public function test_exporter_returns_only_matching_email(): void {
        $this->seedLog();
        $result = wcor_privacy_exporter('user@example.com');

        $this->assertTrue($result['done']);
        $this->assertCount(2, $result['data']); // 대소문자 무관: user@ + USER@

        foreach ($result['data'] as $item) {
            $emails = array_column($item['data'], 'value', 'name');
            $this->assertSame('user@example.com', strtolower($emails['이메일']));
        }
    }

    public function test_exporter_returns_empty_for_unknown_email(): void {
        $this->seedLog();
        $result = wcor_privacy_exporter('nobody@example.com');

        $this->assertTrue($result['done']);
        $this->assertCount(0, $result['data']);
    }

    public function test_exporter_item_id_format(): void {
        $this->seedLog();
        $result = wcor_privacy_exporter('other@example.com');

        $this->assertCount(1, $result['data']);
        $this->assertSame('wcor-2000-2', $result['data'][0]['item_id']);
    }

    // ── Eraser ───────────────────────────────────────────────────────────────

    public function test_eraser_registers(): void {
        $result = wcor_privacy_register_eraser([]);
        $this->assertArrayHasKey('wc-order-redirect', $result);
        $this->assertSame('wcor_privacy_eraser', $result['wc-order-redirect']['callback']);
    }

    public function test_eraser_removes_matching_entries(): void {
        $this->seedLog();
        $result = wcor_privacy_eraser('user@example.com');

        $this->assertTrue($result['done']);
        $this->assertSame(2, $result['items_removed']); // user@ + USER@ (대소문자 무관)
        $this->assertFalse($result['items_retained']);

        $remaining = (array) get_option('wcor_redirect_log', []);
        $this->assertCount(1, $remaining);
        $this->assertSame('other@example.com', $remaining[0]['email']);
    }

    public function test_eraser_keeps_other_entries(): void {
        $this->seedLog();
        wcor_privacy_eraser('other@example.com');

        $remaining = (array) get_option('wcor_redirect_log', []);
        $this->assertCount(2, $remaining);

        $emails = array_column($remaining, 'email');
        $this->assertNotContains('other@example.com', $emails);
        $this->assertContains('user@example.com', $emails);
    }

    public function test_eraser_no_change_when_no_match(): void {
        $this->seedLog();
        $result = wcor_privacy_eraser('nobody@example.com');

        $this->assertSame(0, $result['items_removed']);

        $remaining = (array) get_option('wcor_redirect_log', []);
        $this->assertCount(3, $remaining);
    }

    public function test_eraser_handles_empty_log(): void {
        $result = wcor_privacy_eraser('user@example.com');

        $this->assertTrue($result['done']);
        $this->assertSame(0, $result['items_removed']);
    }
}
