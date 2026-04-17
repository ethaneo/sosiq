-- ─────────────────────────────────────────────
-- Realations: 결제 시스템 고도화를 위한 컬럼 추가
-- Supabase SQL Editor에서 실행하거나 supabase db push로 적용
-- ─────────────────────────────────────────────

-- users 테이블
ALTER TABLE users ADD COLUMN IF NOT EXISTS pro_since       TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS imp_uid         TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS merchant_uid    TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS marketing_agree BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS free_count      INT DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS free_month      TEXT;

-- subscriptions 테이블이 없으면 생성
CREATE TABLE IF NOT EXISTS subscriptions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan         TEXT NOT NULL,                    -- 'basic' | 'pro'
  imp_uid      TEXT,
  merchant_uid TEXT,
  amount       INT,
  started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  status       TEXT NOT NULL DEFAULT 'active',   -- 'active' | 'grace' | 'cancelled' | 'expired'
  grace_until  TIMESTAMPTZ,                      -- 갱신 실패 유예기간 만료일
  failed_count INT DEFAULT 0,                    -- 연속 결제 실패 횟수
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- subscriptions에 신규 컬럼 추가 (이미 테이블이 있는 경우)
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS grace_until  TIMESTAMPTZ;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS failed_count INT DEFAULT 0;

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id   ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status    ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_imp_uid   ON subscriptions(imp_uid);

-- RLS 정책 (본인 데이터만 읽기 허용, 쓰기는 service_role만)
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subscriptions: 본인만 읽기" ON subscriptions;
CREATE POLICY "subscriptions: 본인만 읽기"
  ON subscriptions FOR SELECT
  USING (auth.uid() = user_id);
