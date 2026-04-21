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
| verify-payment | imp_uid 서버 검증, 다음 달 자동갱신 예약 | --no-verify-jwt |
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

## ✅ 완료된 작업 전체

### 핵심 버그 수정
- 모든 플랫폼 결과 링크 instagram.com 하드코딩 수정
- `onSignedIn()`에서 미정의 변수 `data.notback` 참조 오류 제거 → 로그인 후 UI 미반영 원인
- 모바일 OAuth 로그인 세션 미반영 → INITIAL_SESSION 이벤트 처리 + flowType implicit + 해시 조기 제거 삭제
- 카카오 로그인 실패 → 카카오 개발자 콘솔 클라이언트 시크릿 비활성화(OFF)로 해결

### 결제 시스템
- 서버사이드 결제 검증 (Edge Function verify-payment, 3중 검증)
- 모바일 결제 리다이렉트 처리
- 자동갱신 웹훅 (payment-webhook)
- 갱신 실패 3일 유예기간
- 해지 시 빌링키 삭제 (cancel-subscription)
- Edge Function BOOT_ERROR → 재배포로 해결
- ES256 JWT 오류 → --no-verify-jwt로 해결
- ⚠️ KCP 실연동 심사 중 (F0004 오류 — NHN KCP 문의 완료, 심사 대기)

### P4 기능
- 히스토리 비교 기능
- 멀티 계정 관리
- 회원탈퇴 Auth 삭제 (Edge Function delete-account)

### SEO
- robots.txt, sitemap.xml 생성
- keywords 메타태그 추가
- og:image 정상 서빙 확인

### 반응형
- @media(max-width:768px) 태블릿
- @media(max-width:480px) 모바일 전체

### UX
- 로고 클릭 → 메인페이지 이동
- 마이페이지 업그레이드 버튼 → '모든 기능 다 써보기' + 서비스 가격 모달
- 회원탈퇴 → 최하단 왼쪽 작은 글씨

### 보안
- RLS 실제 테스트: anon key로 users/subscriptions/analysis_snapshots 조회 차단 확인 ✅
- Git 히스토리 secrets 미포함 확인 ✅
- Edge Function 내부 JWT 검증 + user_id 일치 확인 구현 ✅
- 개인정보처리방침 국외 이전 고지 추가 (Supabase/AWS)

---

## ⏳ 남은 작업

### 필수 (KCP 심사 완료 후)
- [ ] NHN KCP 실연동 심사 완료 대기
- [ ] 심사 완료 후 실결제 최종 테스트

### 대시보드 직접 설정 (권장)
- [ ] Supabase 대시보드 → 월별 비용 알림 설정
- [ ] 포트원 콘솔 → 비용 알림 설정

### 나중에 (Supabase Pro 업그레이드 시)
- [ ] Supabase 커스텀 도메인 → 구글 로그인 시 "realation.world(으)로 이동" 표시

---

## 보안 현황 요약

| 항목 | 상태 |
|------|------|
| RLS (anon key 차단) | ✅ 실 테스트 확인 |
| IDOR 방지 | ✅ RLS + Edge Function user_id 검증 |
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
