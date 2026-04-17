# Realations (구 sosiq)

## 서비스 개요
- **서비스명**: Realations (리얼레이션스)
- **도메인**: https://realation.world
- **설명**: Instagram / TikTok / X / Threads / LinkedIn 팔로워 관계 분석 SaaS
- **핵심 기능**: 맞팔 안 한 계정, 나만 팔로하는 팬, 차단·제한·뮤트 계정 분석

## 기술 스택
- **Frontend**: Vanilla JS, HTML5, CSS3 (단일 파일 SPA — `index.html`)
- **Backend**: Supabase (PostgreSQL + Auth)
- **결제**: 포트원(iamPort) + Toss Payments / KCP
- **인증**: 이메일/비밀번호, Google OAuth, Kakao OAuth
- **배포**: Vercel

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

## Supabase 스키마 메모
`users` 테이블 필요 컬럼 (없으면 SQL Editor에서 실행):
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS pro_since TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS imp_uid TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS merchant_uid TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS marketing_agree BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS free_count INT DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS free_month TEXT;
```

## 버그 수정 이력

### ✅ P1 Critical — 완료
1. 모든 플랫폼 결과 링크 instagram.com 하드코딩 수정 (`getUserProfileUrl` 헬퍼 추가)
2. `confirmCancelPro()`, `confirmDeleteAccount()` 함수 구현
3. Instagram 분석에 `checkFreeMonthlyLimit()` 누락 추가
4. `updatePlanStatus()`에서 `subscriptions` 테이블 INSERT 추가
5. 업그레이드 모달 이중 onclick 논리 오류 수정

### ✅ P2 High — 완료
6. 프로그레스 바 손 ID 불일치 수정 (`progDotHandR` → `progDotHR` 등 5개)
7. `canSelectPlatform()` → `selectPlatform()`에서 실제 호출 연결 (+ 조건 버그 `!==null` → `.length>0` 수정)
8. `copyResult()` Pro 유저 전체 복사 / 무료 5명 + 안내 문구
9. 결제 내역 금액 `₩5,900` 하드코딩 → plan/amount 동적 표시
10. 결제 성공 모달 배경 클릭 + ESC 닫기 추가

### ✅ P3 Medium — 완료
11. 무료 횟수 카운터: 로그인 유저는 Supabase 서버 저장, 비로그인은 localStorage
12. 소셜 로그인 후 URL access_token 즉시 제거 (setTimeout 1초 제거)
13. X 플랫폼 숫자 ID 표시 시 안내 문구 추가
14. 언어 변경 시 분석 버튼 텍스트 조건 버그 수정 (activeTexts 배열 방식으로 단순화)
15. 모달 닫기 시 body overflow 복원 완전화 (`isAnyModalOpen` / `restoreOverflowIfClear` 헬퍼)
16. `unlockAll()` 플랫폼별 모든 탭 재렌더링

## 결제 시스템 고도화 — 완료

### Edge Functions (supabase/functions/)
| 함수 | 경로 | 역할 |
|------|------|------|
| verify-payment | `/functions/v1/verify-payment` | 결제 후 imp_uid 서버 검증, 다음 달 예약 |
| payment-webhook | `/functions/v1/payment-webhook` | 포트원 웹훅 수신, 갱신/실패/취소 처리 |
| cancel-subscription | `/functions/v1/cancel-subscription` | 빌링키 삭제 + 예약결제 취소 |

### 필요한 Supabase Secrets (대시보드 → Edge Functions → Secrets)
```
PORTONE_API_KEY      포트원 콘솔 → REST API 키
PORTONE_API_SECRET   포트원 콘솔 → REST API 시크릿
SB_SERVICE_ROLE_KEY        Supabase 프로젝트 설정 → API
```

### 포트원 콘솔 웹훅 URL 설정
```
https://jyiohkrbdjuwdjjatkgb.supabase.co/functions/v1/payment-webhook
```

### Edge Function 배포 명령어
```bash
supabase login
supabase link --project-ref jyiohkrbdjuwdjjatkgb
supabase functions deploy verify-payment
supabase functions deploy payment-webhook
supabase functions deploy cancel-subscription
```

### DB 마이그레이션 (Supabase SQL Editor에서 실행)
파일: `supabase/migrations/001_payment_columns.sql`
추가 컬럼: `subscriptions.grace_until`, `subscriptions.failed_count`

### 남은 작업
- [ ] 포트원 콘솔에서 운영 채널키로 교체 (현재 테스트 채널키 추정)
- [ ] Supabase Secrets 3개 등록
- [ ] 포트원 웹훅 URL 등록
- [ ] Edge Functions 배포
- [ ] 001_payment_columns.sql 실행

## 다음 작업 순서
1. **P4 미완성 기능**: 히스토리 비교, 멀티 계정 관리, 회원탈퇴 Auth 삭제
2. **랜딩페이지 개선**: SEO, OG 이미지, 전환율 개선
3. **포트원 실결제 전환**: 위 배포 체크리스트 완료

## 주의사항
- `index.html` 한 파일에 HTML/CSS/JS 전체 포함 (2,700줄+) — 수정 시 라인 범위 확인 필수
- Supabase anon key가 소스에 노출되어 있음 — RLS 정책으로 보호 중
- 파일 분석은 클라이언트 사이드(브라우저)에서만 처리, 서버 전송 없음
- 포트원 IMP 코드: `imp45411646`, 채널키: `channel-key-350fcf6a-b7fa-4ed7-9724-e42a06c05d0c`
