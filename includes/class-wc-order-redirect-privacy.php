<?php

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

function wcor_privacy_register_exporter( array $exporters ): array {
	$exporters['wc-order-redirect'] = array(
		'exporter_friendly_name' => 'WC Order Redirect 리다이렉트 로그',
		'callback'               => 'wcor_privacy_exporter',
	);
	return $exporters;
}

/**
 * 이메일로 리다이렉트 로그 엔트리를 내보냅니다.
 * wcor_redirect_log는 최근 50건의 2차 복사본이며, 주문 원본은 WooCommerce 자체 툴로 처리됩니다.
 */
function wcor_privacy_exporter( string $email, int $page = 1 ): array {
	$log  = (array) get_option( 'wcor_redirect_log', array() );
	$data = array();

	foreach ( $log as $entry ) {
		if ( strtolower( $entry['email'] ?? '' ) !== strtolower( $email ) ) {
			continue;
		}
		$data[] = array(
			'group_id'    => 'wcor-redirect-log',
			'group_label' => '리다이렉트 로그',
			'item_id'     => 'wcor-' . ( $entry['ts'] ?? '' ) . '-' . ( $entry['order'] ?? '' ),
			'data'        => array(
				array(
					'name'  => '주문번호',
					'value' => (string) ( $entry['order'] ?? '' ),
				),
				array(
					'name'  => '이동 URL',
					'value' => (string) ( $entry['url'] ?? '' ),
				),
				array(
					'name'  => '시간',
					'value' => $entry['ts'] ? (string) wp_date( 'Y-m-d H:i', (int) $entry['ts'] ) : '',
				),
				array(
					'name'  => '이름',
					'value' => (string) ( $entry['customer'] ?? '' ),
				),
				array(
					'name'  => '이메일',
					'value' => (string) ( $entry['email'] ?? '' ),
				),
				array(
					'name'  => '전화번호',
					'value' => (string) ( $entry['phone'] ?? '' ),
				),
			),
		);
	}

	return array(
		'data' => $data,
		'done' => true,
	);
}

function wcor_privacy_register_eraser( array $erasers ): array {
	$erasers['wc-order-redirect'] = array(
		'eraser_friendly_name' => 'WC Order Redirect 리다이렉트 로그',
		'callback'             => 'wcor_privacy_eraser',
	);
	return $erasers;
}

function wcor_privacy_eraser( string $email, int $page = 1 ): array {
	$log     = (array) get_option( 'wcor_redirect_log', array() );
	$removed = 0;
	$new_log = array_values(
		array_filter(
			$log,
			function ( array $entry ) use ( $email, &$removed ): bool {
				if ( strtolower( $entry['email'] ?? '' ) === strtolower( $email ) ) {
					$removed++;
					return false;
				}
				return true;
			}
		)
	);

	if ( $removed > 0 ) {
		update_option( 'wcor_redirect_log', $new_log, false );
	}

	return array(
		'items_removed'  => $removed,
		'items_retained' => false,
		'messages'       => array(),
		'done'           => true,
	);
}
