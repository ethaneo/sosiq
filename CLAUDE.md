# Realations (구 sosiq)

## 서비스 개요
- **서비스명**: Realations (리얼레이션스)
- **도메인**: https://realation.world
- **설명**: Instagram / TikTok / X / Threads / LinkedIn 팔로워 관계 분석 SaaS
- **핵심 기능**: 맞팔 안 한 계정, 나만 팔로하는 팬, 차단·제한·뮤트 계정 분석

## 기술 스택
- **Frontend**: Vanilla JS, HTML5, CSS3 (단일 파일 SPA — `index.html`, 3,240줄)
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
| Basic | ₩5,900/월 | 무제한 분석, 전체 결과, 5개 플랫폼, 1개 계정 |
| Pro | ₩9,900/월 | Basic + 히스토리 비교, 멀티 계정(최대 10개) |

## 주의사항
- `index.html` 한 파일에 HTML/CSS/JS 전체 포함 (3,240줄) — 수정 시 라인 범위 확인 필수
- Supabase anon key가 소스에 노출되어 있음 — RLS 정책으로 보호 중
- 파일 분석은 클라이언트 사이드(브라우저)에서만 처리, 서버 전송 없음
- 포트원 IMP 코드: `imp45411646`, 채널키: `channel-key-350fcf6a-b7fa-4ed7-9724-e42a06c05d0c`

---

## DB 스키마

### users 테이블 추가 컬럼
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS pro_since TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS imp_uid TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS merchant_uid TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS marketing_agree BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS free_count INT DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS free_month TEXT;
```

### 마이그레이션 파일 목록
| 파일 | 내용 | 실행 여부 |
|------|------|----------|
| `001_payment_columns.sql` | `subscriptions.grace_until`, `subscriptions.failed_count` | ⚠️ 미실행 |
| `002_snapshots.sql` | `analysis_snapshots` 테이블 + RLS | ⚠️ 미실행 |
| `003_users_rls.sql` | `users` RLS + `subscriptions` UPDATE 정책 | ⚠️ 미실행 |
| `004_multi_account.sql` | `analysis_snapshots.account_label` (멀티 계정) | ⚠️ 미실행 |

---

## 완료된 기능 이력

### ✅ P1 Critical
1. 모든 플랫폼 결과 링크 instagram.com 하드코딩 수정 (`getUserProfileUrl` 헬퍼)
2. `confirmCancelPro()`, `confirmDeleteAccount()` 함수 구현
3. Instagram 분석에 `checkFreeMonthlyLimit()` 누락 추가
4. `updatePlanStatus()`에서 `subscriptions` 테이블 INSERT 추가
5. 업그레이드 모달 이중 onclick 논리 오류 수정

### ✅ P2 High
6. 프로그레스 바 손 ID 불일치 수정 (`progDotHandR` → `progDotHR` 등 5개)
7. `canSelectPlatform()` → `selectPlatform()` 호출 연결 + 조건 버그 수정
8. `copyResult()` Pro 전체 복사 / 무료 5명 + 안내 문구
9. 결제 내역 금액 하드코딩 → plan/amount 동적 표시
10. 결제 성공 모달 배경 클릭 + ESC 닫기

### ✅ P3 Medium
11. 무료 횟수 카운터: 로그인 유저 Supabase 저장, 비로그인 localStorage
12. 소셜 로그인 후 URL access_token 즉시 제거
13. X 플랫폼 숫자 ID 표시 시 안내 문구 추가
14. 언어 변경 시 분석 버튼 텍스트 조건 버그 수정
15. 모달 닫기 시 body overflow 복원 (`restoreOverflowIfClear` 헬퍼)
16. `unlockAll()` 플랫폼별 모든 탭 재렌더링

### ✅ 결제 시스템 고도화 (2026-04-17)
| 항목 | 방식 |
|------|------|
| 서버사이드 결제 검증 | Edge Function `verify-payment` — imp_uid 3중 검증 |
| 모바일 결제 리다이렉트 | `initAuth()`에서 쿼리파라미터 감지 후 `verifyAndActivate` 실행 |
| 자동갱신 웹훅 | Edge Function `payment-webhook` — paid/failed/cancelled 처리 |
| 갱신 실패 유예기간 | 실패 시 3일 유예, 로그인 시 만료 체크 후 다운그레이드 |
| 해지 시 빌링키 삭제 | Edge Function `cancel-subscription` — 빌링키 + 예약결제 취소 |
| 결제 실패 재시도 UI | `payRetryModalBg` — 플랜별 재시도 버튼 |
| 결제 완료 후 UI 갱신 | `showPaySuccess()`에 `updateAuthUI()` 추가 |
| 결제 내역 상태 텍스트 | grace→유예기간, cancelled→해지, expired→만료 |

### ✅ P4 기능 완성 (2026-04-19)
| 항목 | 내용 |
|------|------|
| 히스토리 비교 | 복구 계정(`recovered`)에 플랫폼별 프로필 링크 추가 |
| 히스토리 비교 | 각 스냅샷 행에 `✕` 삭제 버튼 (`deleteSnapshot`) |
| 멀티 계정 관리 | `analysis_snapshots.account_label` 컬럼 + `currentAccountLabel` 전역 변수 |
| 멀티 계정 관리 | 마이페이지 "내 계정 관리" 섹션 (Pro 전용): 현재 계정 표시, 선택/삭제, 새 계정 추가 |
| 멀티 계정 관리 | 계정 레이블별 히스토리 표시, 최대 10개 제한 |
| 회원탈퇴 Auth 삭제 | Edge Function `delete-account` — 빌링키 삭제 + DB + Auth 순서로 완전 삭제 |

---

## Edge Functions (supabase/functions/)
| 함수 | 경로 | 역할 |
|------|------|------|
| verify-payment | `/functions/v1/verify-payment` | imp_uid 서버 검증, 다음 달 자동갱신 예약 |
| payment-webhook | `/functions/v1/payment-webhook` | 포트원 웹훅 수신, 갱신/실패/취소 처리 |
| cancel-subscription | `/functions/v1/cancel-subscription` | 빌링키 삭제 + 예약결제 취소 |
| delete-account | `/functions/v1/delete-account` | 빌링키 → DB → Auth 순 완전 탈퇴 |
| _shared/iamport.ts | (공유) | 포트원 토큰 발급, 결제 조회, 예약, 빌링키 삭제 |

---

## ⚠️ 운영 전환 체크리스트 (미완료)
- [ ] SQL Editor에서 마이그레이션 4개 파일 순서대로 실행
- [ ] Supabase Secrets 3개 등록 (PORTONE_API_KEY, PORTONE_API_SECRET, SB_SERVICE_ROLE_KEY)
- [ ] Edge Functions 4개 배포 (`verify-payment`, `payment-webhook`, `cancel-subscription`, `delete-account`)
- [ ] 포트원 콘솔 웹훅 URL 등록: `https://jyiohkrbdjuwdjjatkgb.supabase.co/functions/v1/payment-webhook`
- [ ] 포트원 콘솔에서 운영 채널키 확인 후 `index.html` `channelKey` 교체

### Edge Function 배포 명령어
```bash
supabase login
supabase link --project-ref jyiohkrbdjuwdjjatkgb
supabase functions deploy verify-payment
supabase functions deploy payment-webhook
supabase functions deploy cancel-subscription
supabase functions deploy delete-account
```

---

## 다음 작업
1. **⚠️ 운영 전환 체크리스트** — 위 항목 완료 후 결제 시스템 실제 동작
2. **랜딩페이지 개선**: SEO 최적화, OG 이미지, 전환율 개선
