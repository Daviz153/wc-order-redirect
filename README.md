# WC Order Redirect

WooCommerce 결제 완료 후 상품별로 설정한 URL로 고객을 즉시 이동시키는 플러그인입니다.

## 기능

- **상품별 리다이렉트 URL 설정** — 상품 편집 화면의 "리다이렉트" 탭에서 URL을 지정합니다.
- **토글로 활성/비활성** — 상품마다 독립적으로 켜고 끌 수 있습니다.
- **다중 상품 주문 대응** — 주문에 여러 상품이 있을 경우, 리다이렉트가 활성화된 상품 중 **최고가 상품의 URL**로 이동합니다.
- **보안 검증** — order key 유효성 검사로 잘못된 접근 차단, 허용된 URL 스킴만 허용(javascript:/data: 차단).
- **HPOS 호환** — WooCommerce High-Performance Order Storage 완전 지원.
- **자동 업데이트** — GitHub 릴리즈 기반 자동 업데이트.

## 요구사항

| 항목 | 최소 버전 |
|---|---|
| PHP | 8.0 |
| WordPress | 6.0 |
| WooCommerce | 7.0 |

## 설치

1. [최신 릴리즈](https://github.com/Daviz153/wc-order-redirect/releases/latest)에서 `wc-order-redirect.zip` 다운로드
2. WordPress 관리자 → 플러그인 → 새 플러그인 추가 → 플러그인 업로드
3. 활성화

## 사용법

1. WooCommerce → 상품 → 상품 편집
2. 하단 **상품 데이터** 패널에서 **리다이렉트** 탭 선택
3. 토글을 켜고 리다이렉트 URL 입력 후 저장

결제 완료 시 `order-received` 페이지 대신 설정한 URL로 즉시 이동합니다.

## 동작 방식

```
결제 완료
  → order-received 페이지 로드
  → template_redirect 훅 발동
  → 주문 내 상품 확인 (리다이렉트 활성화 + URL 설정된 상품)
  → 최고가 상품 URL로 302 리다이렉트
```

URL이 설정된 상품이 없으면 기존 WooCommerce 감사 페이지(order-received)가 그대로 표시됩니다.

## 개발

```bash
# 의존성 설치
composer install
npm install

# PHPUnit
vendor/bin/phpunit

# E2E (Docker WordPress 필요)
npx playwright test
```

## 라이선스

GPL v2 or later
