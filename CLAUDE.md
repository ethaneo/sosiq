# Realations (구 sosiq)

## 서비스 개요
- **서비스명**: Realations (리얼레이션스)
- **도메인**: https://realation.world
- **설명**: Instagram / TikTok / X / Threads / LinkedIn 팔로워 관계 분석 SaaS
- **핵심 기능**: 맞팔 안 한 계정, 나만 팔로하는 팬, 차단·제한·뮤트 계정 분석
- **현황**: 미국 런칭 준비 중 — 영어 전환 + Paddle 결제 마이그레이션 완료

## 현재 작업 기준
- **작업 경로**: `/Users/mac/Desktop/리얼레이션스`
- **GitHub**: `ethaneo/sosiq`
- **배포**: Vercel (GitHub push → 자동 배포)
- **Supabase 프로젝트 ID**: `jyiohkrbdjuwdjjatkgb`
- **Vercel 프로젝트명**: `realation`
- **최신 커밋**: `52447eb`

## 기술 스택
- **Frontend**: Vanilla JS, HTML5, CSS3 (단일 파일 SPA — `index.html`)
- **Backend**: Supabase (PostgreSQL + Auth)
- **결제**: Paddle Billing v2 (구독형, Merchant of Record)
- **인증**: 이메일/비밀번호, Google OAuth (Kakao 제거됨)
- **언어**: 영어 단일 (i18n 시스템 제거됨)

## 문서/답변 규칙
- `CLAUDE.md`와 `SESSION_START.md`는 누적 노트가 아니라 현재 상태 기준 문서로 관리한다.
- 같은 내용은 두 파일에 중복으로 쌓지 말고, 한 번만 정리해서 최신 상태로 덮어쓴다.
- 코드 생성이나 개발 관련 작업을 끝낸 뒤에는 답변을 내기 전에 반드시 검증한다.

## Paddle 결제 구조
1. 프론트에서 `Paddle.Initialize({token, eventCallback})`으로 초기화한다.
2. `handleBasicPay()` / `handleProPay()`에서 `Paddle.Checkout.open({items, customer, customData:{userId}})`를 호출한다.
3. `checkout.completed` 이벤트 수신 후 `startPollingForActivation(plan)`으로 Supabase DB를 2초 간격 최대 15회 폴링한다.
4. 서버 측에서 Paddle 웹훅 `subscription.created`이 수신되면 `users`와 `subscriptions`를 갱신한다.
5. 갱신(`transaction.completed`), 실패(`transaction.payment_failed` → 3일 유예기간), 취소(`subscription.canceled`)도 웹훅으로 처리한다.

### Paddle 프론트 설정 변수 (index.html ~1450번 줄)
```javascript
var PADDLE_CLIENT_TOKEN = '';      // Paddle 대시보드 → Developer Tools → Client-side token
var PADDLE_BASIC_PRICE_ID = '';    // Paddle 대시보드 → Catalog → Prices
var PADDLE_PRO_PRICE_ID = '';
```

### Paddle Supabase Secrets (Edge Function 환경변수)
```
PADDLE_API_KEY            # Paddle 대시보드 → Developer Tools → Authentication
PADDLE_WEBHOOK_SECRET     # Paddle 대시보드 → Notifications → webhook secret key
PADDLE_BASIC_PRICE_ID
PADDLE_PRO_PRICE_ID
```

## 핵심 운영 포인트
- `index.html`은 단일 파일이라 수정 시 영향 범위가 넓다.
- 결제 관련 수정은 프론트와 Edge Function을 같이 확인한다.
- `sb.auth.getSession()`을 세션 토큰 획득 기준으로 사용한다.
- `refreshSession()`은 네트워크 에러를 유발할 수 있어 사용하지 않는다.
- `SESSION_START.md`는 새 세션용 요약본이고, 세부 이력은 이 파일에서 관리한다.

## 가격 정책
| 플랜 | 가격 | 주요 기능 |
|------|------|----------|
| Free | $0 | 1개 플랫폼, 월 3회, 결과 5명 |
| Basic | $4.99/mo | 5개 플랫폼, 무제한 분석, 전체 결과, 1개 계정 |
| Pro | $7.99/mo | Basic + 히스토리, 10개 계정 |

## DB 스키마

### users
```sql
id, email, is_pro, plan, pro_since,
marketing_agree, free_count, free_month, account_label,
paddle_customer_id
```

### subscriptions
```sql
id, user_id, plan, status, amount,
started_at (timestamp without time zone),
grace_until, failed_count,
paddle_subscription_id, paddle_transaction_id
```
> `started_at`은 timezone 없는 타입이라 ISO 문자열 직접 삽입 가능하다.

## 마이그레이션
| 파일 | 내용 | 상태 |
|------|------|------|
| `001_payment_columns.sql` | `subscriptions` 테이블 + 컬럼 추가 | 완료 |
| `002_snapshots.sql` | `analysis_snapshots` 테이블 + RLS | 완료 |
| `003_users_rls.sql` | `users` RLS + `subscriptions` UPDATE 정책 | 완료 |
| `004_multi_account.sql` | `analysis_snapshots.account_label` | 완료 |
| `005_paddle.sql` | `paddle_customer_id`, `paddle_subscription_id` 등 컬럼 + 인덱스 | **미실행** |

## Edge Functions
| 함수 | 역할 |
|------|------|
| `payment-webhook` | Paddle 웹훅 수신 — 구독 생성/갱신/실패/취소 처리 |
| `cancel-subscription` | Paddle 구독 취소 + DB 업데이트 |
| `delete-account` | Paddle 구독 취소 → DB 삭제 → Auth 삭제 |
| `_shared/paddle.ts` | HMAC-SHA256 웹훅 검증, 구독 취소 API, priceId→plan 매핑 |

> `verify-payment`는 Paddle 구조에서 불필요 — 웹훅이 activation 처리 담당.

## 라이브 전 체크리스트
- [ ] Supabase SQL Editor에서 `005_paddle.sql` 실행
- [ ] Supabase Secrets 4개 등록 (`PADDLE_API_KEY`, `PADDLE_WEBHOOK_SECRET`, `PADDLE_BASIC_PRICE_ID`, `PADDLE_PRO_PRICE_ID`)
- [ ] `index.html` ~1450번 줄 Paddle 변수 3개 채우기
- [ ] Edge Functions 3개 배포 (`payment-webhook`, `cancel-subscription`, `delete-account`)
- [ ] Paddle 대시보드 → Notifications → 웹훅 URL 등록
- [ ] 결제 E2E 테스트 (Basic + Pro 체크아웃 → DB 활성화 확인)
- [ ] 구독 해지 테스트
- [ ] 유예기간 로직 테스트 (결제 실패 시나리오)
