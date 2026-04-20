-- ─────────────────────────────────────────────
-- Realations: users 테이블 RLS 정책
-- subscriptions UPDATE 정책 추가
-- ─────────────────────────────────────────────

-- ── users 테이블 RLS ──
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users: 본인만 읽기" ON users;
CREATE POLICY "users: 본인만 읽기"
  ON users FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "users: 본인만 수정" ON users;
CREATE POLICY "users: 본인만 수정"
  ON users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- INSERT는 회원가입 시 1회 허용 (본인 id만)
DROP POLICY IF EXISTS "users: 본인만 생성" ON users;
CREATE POLICY "users: 본인만 생성"
  ON users FOR INSERT
  WITH CHECK (auth.uid() = id);

-- DELETE는 service_role만 허용 (탈퇴는 Edge Function에서 처리)
-- (RLS 활성화 + 정책 없음 = 기본 차단이므로 별도 정책 불필요)

-- ── subscriptions UPDATE 정책 ──
-- 로그인 시 유예기간 만료 체크에서 클라이언트가 status='expired' 업데이트를 함
-- 업그레이드(active) 조작을 막기 위해 expired로의 변경만 허용
DROP POLICY IF EXISTS "subscriptions: 유예기간 만료 처리" ON subscriptions;
CREATE POLICY "subscriptions: 유예기간 만료 처리"
  ON subscriptions FOR UPDATE
  USING (auth.uid() = user_id AND status = 'grace')
  WITH CHECK (auth.uid() = user_id AND status = 'expired');
