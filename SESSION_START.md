# Realations — Session Start

새 세션 시작 시 이 파일 먼저 읽고, 세부 내용은 `CLAUDE.md` 참고.

## 현재 상태 요약
- **경로**: `/Users/mac/Desktop/리얼레이션스`
- **GitHub**: `ethaneo/sosiq` / **배포**: Vercel 자동배포
- **최신 커밋**: `52447eb`
- **결제**: Paddle Billing v2 (PortOne/KCP 완전 제거)
- **인증**: 이메일 + Google OAuth (Kakao 제거)
- **언어**: 영어 단일 서비스 (i18n 제거)

## 이번까지 완료된 것
- `index.html` 전체 UI 영어 전환 완료 (가이드, 모달, 통계 카드, 알림, 가격 안내 등)
- Paddle Billing v2 클라이언트 결제 흐름 구현 (`Paddle.Checkout.open` + 폴링 방식 활성화)
- `_shared/paddle.ts` 생성 (웹훅 서명 검증 HMAC-SHA256, 구독 취소 API)
- `payment-webhook` Edge Function 재작성 (subscription.created/canceled, transaction.completed/payment_failed)
- `cancel-subscription`, `delete-account` Edge Function Paddle로 교체
- `005_paddle.sql` 마이그레이션 파일 생성 (paddle 컬럼 + 인덱스)
- Kakao 로그인 제거, 언어 전환기 제거

## 지금 당장 해야 할 것 (라이브 전)
1. **Supabase SQL Editor** → `005_paddle.sql` 실행
2. **Supabase Secrets** 등록: `PADDLE_API_KEY`, `PADDLE_WEBHOOK_SECRET`, `PADDLE_BASIC_PRICE_ID`, `PADDLE_PRO_PRICE_ID`
3. **`index.html` ~1450번 줄** → `PADDLE_CLIENT_TOKEN`, `PADDLE_BASIC_PRICE_ID`, `PADDLE_PRO_PRICE_ID` 값 입력
4. **Edge Function 배포**: `supabase functions deploy payment-webhook cancel-subscription delete-account`
5. **Paddle 대시보드** → Notifications → 웹훅 URL 등록
6. 결제 E2E 테스트, 구독 해지 테스트

## 빠른 확인 명령어
```
git log --oneline -3
git status --short
```
