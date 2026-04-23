# Realations Session Start

새 터미널에서 이 파일 먼저 읽고 시작하면 된다.

## 서비스 상태
- 프로젝트명: Realations (구 sosiq)
- 경로: `/Users/mac/sosiq`
- 배포: Vercel (GitHub push → 자동 배포)
- 백엔드: Supabase
- 결제: PortOne + NHN KCP 정기결제

## 지금 가장 중요한 상태
- 최근 핵심 수정: **KCP 빌링키 발급만 되고 실제 첫 결제가 빠져 있던 구조를 수정함**
- 최신 커밋: `c30e3d1` (`Fix KCP initial charge flow`)
- 2026-04-23 기준 Supabase 함수 재배포 완료:
  - `verify-payment`
  - `payment-webhook`
  - `cancel-subscription`
- GitHub `main` push 완료

## 현재 결제 구조
1. 프론트 `index.html`에서 `IMP.request_pay()`로 `pg:'kcp_billing'` + `customer_uid` 사용
2. 이 단계는 빌링키 발급 창 성격이며, 성공 후 서버 함수 `verify-payment` 호출
3. `verify-payment`가 PortOne REST API `subscribe/payments/again`으로 실제 첫 결제 승인
4. 승인 성공 시:
   - `users` 업데이트
   - `subscriptions`에 `active` insert
   - 다음 달 예약결제 생성
5. 이후 갱신은 `payment-webhook`에서 처리

## 오픈 전 남은 핵심 업무
- Basic 실결제 테스트
- Pro 실결제 테스트
- 포트원 결제내역 확인
- Supabase `subscriptions` / `users` 반영 확인
- 포트원 예약결제 생성 확인
- 해지 후 예약결제 취소 확인
- KCP 실연동/상점 설정 이슈가 있으면 포트원 응답 메시지와 Supabase 함수 로그로 원인 확인

## 새 터미널에서 바로 확인할 것
- `git -C /Users/mac/sosiq log --oneline -5`
- `git -C /Users/mac/sosiq status --short`
- `sed -n '1,260p' /Users/mac/sosiq/CLAUDE.md`
- 결제 관련 소스:
  - `/Users/mac/sosiq/index.html`
  - `/Users/mac/sosiq/supabase/functions/verify-payment/index.ts`
  - `/Users/mac/sosiq/supabase/functions/payment-webhook/index.ts`
  - `/Users/mac/sosiq/supabase/functions/cancel-subscription/index.ts`
  - `/Users/mac/sosiq/supabase/functions/_shared/iamport.ts`

## 테스트 체크리스트
1. Basic 결제
2. 카드 실승인 확인
3. 포트원 결제내역 확인
4. `subscriptions.status='active'` 확인
5. 예약결제 생성 확인
6. Pro 반복
7. 해지 확인

## 주의
- `index.html` 단일 파일 SPA라 결제/인증/분석 UI가 한 파일에 몰려 있음
- 결제 관련 수정 후에는 반드시 프론트와 Edge Function 둘 다 확인
- 실제 실결제는 외부 설정 영향이 있으므로 코드 수정과 운영 이슈를 분리해서 판단
- 장문 파악이 필요하면 `CLAUDE.md`, 빠른 handoff만 필요하면 이 파일 기준으로 작업
