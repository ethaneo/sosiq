# Realations (구 sosiq)

## 서비스 개요
- **서비스명**: Realations (리얼레이션스)
- **도메인**: https://realation.world
- **설명**: Instagram / TikTok / X / Threads / LinkedIn 팔로워 관계 분석 SaaS
- **핵심 기능**: 맞팔 안 한 계정, 나만 팔로하는 팬, 차단·제한·뮤트 계정 분석

## 기술 스택
- **Frontend**: Vanilla JS, HTML5, CSS3 (단일 파일 SPA — `index.html`)
- **Backend**: Supabase (PostgreSQL + Auth)
- **결제**: 포트원(iamPort) + NHN KCP
- **인증**: 이메일/비밀번호, Google OAuth, Kakao OAuth
- **배포**: Vercel (GitHub push → 자동 배포)

## 인프라
- **GitHub**: ethaneo/sosiq
- **Supabase 프로젝트 ID**: jyiohkrbdjuwdjjatkgb
- **Vercel 프로젝트명**: realation
- **도메인**: realation.world

## 가격 정책
| 플랜 | 가격 | 주요 기능 |
|------|------|----------|
| FREE | 무료 | 월 3회 분석, 결과 5명, 1개 플랫폼 |
| Basic | ₩5,900/월 | 무제한 분석, 전체 결과, 5개 플랫폼 |
| Pro | ₩9,900/월 | Basic + 히스토리 비교, 10개 계정 |

## 주요 설정값 (코드 내)
- 포트원 IMP 코드: `imp45411646`
- 채널키: `channel-key-350fcf6a-b7fa-4ed7-9724-e42a06c05d0c` (실연동, KCP billing)
- 정기자동결제 그룹아이디: `IP7191056682`
- Supabase anon key: 소스에 노출 — RLS 정책으로 보호 중 (의도적)

## Supabase 스키마 메모
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS pro_since TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS imp_uid TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS merchant_uid TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS marketing_agree BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS free_count INT DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS free_month TEXT;
```

## Edge Functions (supabase/functions/)
| 함수 | 역할 | 배포 옵션 |
|------|------|----------|
| verify-payment | 초기 실청구 + 서버 검증 + 다음 달 자동갱신 예약 | --no-verify-jwt |
| payment-webhook | 포트원 웹훅 수신, 갱신/실패/취소 처리 | --no-verify-jwt |
| cancel-subscription | 빌링키 삭제 + 예약결제 취소 | --no-verify-jwt |
| delete-account | 계정 삭제 + Auth 삭제 | --no-verify-jwt |

> **--no-verify-jwt 이유**: Supabase ES256 JWT를 게이트웨이가 미지원.
> cancel-subscription, delete-account는 내부에서 `sbUser.auth.getUser()` + user_id 일치 확인으로 직접 검증.

### Edge Function 배포 명령어
```bash
supabase functions deploy verify-payment --no-verify-jwt
supabase functions deploy payment-webhook --no-verify-jwt
supabase functions deploy cancel-subscription --no-verify-jwt
supabase functions deploy delete-account --no-verify-jwt
```

### 포트원 콘솔 웹훅 URL
```
https://jyiohkrbdjuwdjjatkgb.supabase.co/functions/v1/payment-webhook
```

---

## ✅ 오픈 전 완료된 작업

### 핵심 기능
- [x] Instagram / TikTok / X / Threads / LinkedIn 5개 플랫폼 파일 파싱 및 분석
- [x] 맞팔 안 한 계정 / 나만 팔로하는 팬 / 차단·제한·대기·친한친구 탭 분리
- [x] 무료 플랜 제한 (월 3회, 결과 5명) + 페이월 UI
- [x] 히스토리 비교 기능 (Pro)
- [x] 멀티 계정 관리 (Pro)
- [x] 정렬 / 검색 / 복사 기능

### 인증
- [x] 이메일/비밀번호 로그인·회원가입
- [x] Google OAuth (PC + 모바일)
- [x] Kakao OAuth (PC + 모바일) — 카카오 콘솔 클라이언트 시크릿 OFF로 해결
- [x] 모바일 OAuth 세션 미반영 버그 수정 (flowType implicit + INITIAL_SESSION 처리)
- [x] 회원탈퇴 (Edge Function delete-account — Auth 완전 삭제)

### 결제 시스템
- [x] 서버사이드 결제 검증 (verify-payment, 3중 검증)
- [x] **KCP 빌링키 발급 성공 후 실제 첫 결제 승인 로직 추가**
- [x] 모바일 결제 리다이렉트 처리
- [x] 자동갱신 웹훅 (payment-webhook)
- [x] 갱신 실패 3일 유예기간
- [x] 해지 시 빌링키 삭제 (cancel-subscription)
- [x] Edge Function ES256 JWT 오류 → --no-verify-jwt로 해결
- [x] 포트원 API 실패(code != 0) 은닉 제거
- [x] paid 웹훅 중복 처리 시 다음 달 예약 중복 생성 방지

### SEO
- [x] robots.txt, sitemap.xml 생성
- [x] keywords 메타태그 추가
- [x] og:image 정상 서빙 확인 (200 OK)

### 반응형
- [x] 태블릿 @media(max-width:768px)
- [x] 모바일 @media(max-width:480px)

### UX
- [x] 로고 클릭 → 메인페이지 이동
- [x] 마이페이지 업그레이드 버튼 → '모든 기능 다 써보기' + 서비스 가격 모달
- [x] 회원탈퇴 → 최하단 왼쪽 작은 글씨로 이동

### 보안
- [x] RLS 실 테스트: anon key로 users/subscriptions/analysis_snapshots 조회 차단 확인
- [x] Git 히스토리 secrets 미포함 확인
- [x] Edge Function 내부 JWT 검증 + user_id 일치 확인
- [x] 개인정보처리방침 국외 이전 고지 추가 (Supabase/AWS)
- [x] XSS 방어: escapeHtml() + safeHref() 적용 (파일 파싱 데이터 innerHTML 삽입 전 이스케이핑)

### 버그 수정
- [x] 모든 플랫폼 결과 링크 instagram.com 하드코딩 수정
- [x] `onSignedIn()`의 `data.notback` 미정의 참조 오류 제거 → 로그인 후 UI 미반영 원인
- [x] Edge Function BOOT_ERROR → 재배포로 해결
- [x] **결제창은 완료인데 실제 청구가 안 되던 구조 수정**
- [x] 해지 API 실패 시 프론트가 사용자를 즉시 free로 내리던 잘못된 폴백 제거
- [x] 결제 SDK 미로드 시 프론트 런타임 에러 방지

---

## ⏳ 오픈 전 남은 작업

### 🔴 필수 (오픈 블로커)
- [ ] **NHN KCP 실연동/상점 설정 최종 확인** (코드상 초기 실청구 로직은 반영 완료, 이제 포트원/KCP 실승인 여부 확인 필요)
- [ ] **Basic 실결제 테스트** (실 카드 승인 → 포트원 결제내역 → subscriptions active 생성 확인)
- [ ] **Pro 실결제 테스트** (실 카드 승인 → 포트원 결제내역 → subscriptions active 생성 확인)
- [ ] **예약결제 생성 확인** (포트원 예약결제 목록에서 다음 달 청구 생성 확인)
- [ ] **구독 해지 테스트** (cancel-subscription 실행 후 예약결제 취소 및 빌링키 삭제 확인)

### 🟡 권장 (오픈 전 완료 권장)
- [ ] **Supabase 대시보드 → 월별 비용 알림 설정** (Settings → Billing → Usage alerts)
- [ ] **포트원 콘솔 → 비용 알림 설정**
- [ ] **GitHub → Settings → Security → Secret scanning 활성화**

### 🟢 나중에 (오픈 후 / Supabase Pro 업그레이드 시)
- [ ] Supabase 커스텀 도메인 → 구글 로그인 시 "realation.world(으)로 이동" 표시
- [ ] Supabase Pro 업그레이드 시 커스텀 도메인 연결

---

## 최근 변경사항 (2026-04-23)

### 결제 흐름 구조 수정
- 기존 문제: `IMP.request_pay(... customer_uid ...)` 성공이 실제 결제가 아니라 **KCP 빌링키 발급 성공**이었음
- 결과적으로 UI는 "완료"처럼 보였지만 실제 카드 승인/포트원 결제내역/KCP 결제내역이 생성되지 않았음
- 수정 후 흐름:
  1. 프론트에서 `kcp_billing` 결제창 호출
  2. 성공 시 `verify-payment` 호출
  3. `verify-payment`가 `subscribe/payments/again`으로 **실제 첫 결제 승인**
  4. 승인 성공 후 DB 반영 + 다음 달 예약결제 생성

### 배포 상태
- GitHub 최신 커밋: `c30e3d1` (`Fix KCP initial charge flow`)
- Supabase Functions 재배포 완료:
  - `verify-payment`
  - `payment-webhook`
  - `cancel-subscription`
- 프론트는 GitHub push 완료 기준 Vercel 자동 배포 트리거 상태

### 지금 테스트해야 할 것
- Basic 결제 1회
- Pro 결제 1회
- 포트원 콘솔 결제내역 확인
- Supabase `subscriptions` 확인
- 포트원 예약결제 생성 확인
- 해지 후 예약결제 취소 확인

---

## 보안 현황 요약

| 항목 | 상태 |
|------|------|
| RLS (anon key 차단) | ✅ 실 테스트 확인 |
| IDOR 방지 | ✅ RLS + Edge Function user_id 검증 |
| XSS 방어 | ✅ escapeHtml / safeHref 적용 |
| secrets Git 노출 | ✅ 미포함 확인 |
| service_role key | ✅ Supabase secrets에만 |
| 백엔드 인증 | ✅ Edge Function 내부 JWT 검증 |
| OAuth | ✅ Supabase 처리 |
| HTTPS / WAF | ✅ Vercel/Cloudflare 기본 |
| Brute Force | ✅ Supabase Auth 기본 제한 |
| 파일 분석 보안 | ✅ 클라이언트 전용, 서버 전송 없음 |
| 개인정보처리방침 | ✅ 국외 이전 고지 포함 |

---

## 주의사항
- `index.html` 한 파일에 HTML/CSS/JS 전체 포함 (3,200줄+) — 수정 시 라인 범위 확인 필수
- **코드 수정 후 반드시 Grep/Read로 검증 후 커밋**
- Supabase anon key 소스 노출 — RLS로 보호 중 (의도적 설계)
- 파일 분석은 클라이언트 사이드에서만 처리, 서버 전송 없음
- 새 터미널에서 바로 이어받을 때는 `SESSION_START.md` 먼저 읽고, 세부 운영 맥락은 `CLAUDE.md` 참고
