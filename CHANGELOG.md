# Changelog

## [1.0.2] - 2026-06-06

### 개선
- 리다이렉트 설정을 WooCommerce 상품 데이터 탭으로 이동 (기존 별도 메타박스 → 탭 통합)
- 토글 UI 개선 — 비활성 시 URL 입력 필드 자동 숨김, 활성 시 자동 표시

### 테스트
- PHPUnit 오류 시나리오 테스트 추가 (잘못된 key, 존재하지 않는 주문, javascript:/data: URL 차단 등)
- E2E 오류 시나리오 테스트 추가 (브라우저 레벨 리다이렉트 미발동 경로 검증)
- E2E 플러그인 공존 테스트 추가 (wc-order-webhook과 상호 간섭 없음 확인)

---

## [1.0.1] - 2026-06-05

### 추가
- 상품별 리다이렉트 활성/비활성 토글

### 보안
- order key 유효성 검증 추가 — 잘못된 key로 접근 시 리다이렉트 차단

### 개선
- 인라인 CSS를 `wp_enqueue_style`로 분리
- `usort` → `uasort` 변경으로 배열 키 보존

---

## [1.0.0] - 2026-06-04

### 최초 릴리즈
- 결제 완료 후 상품별 URL로 리다이렉트
- 다중 상품 주문 시 최고가 상품 URL 우선 적용
- WooCommerce HPOS 호환
- GitHub 릴리즈 기반 자동 업데이트
- GitHub Actions CI (PHPUnit + Playwright E2E)
