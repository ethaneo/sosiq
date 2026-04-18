-- ─────────────────────────────────────────────
-- Realations: 히스토리 비교 — 분석 스냅샷 테이블
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS analysis_snapshots (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform     TEXT NOT NULL,          -- 'instagram'|'tiktok'|'threads'|'linkedin'|'x'
  notback      JSONB NOT NULL DEFAULT '[]', -- username 배열
  fans         JSONB NOT NULL DEFAULT '[]', -- username 배열
  notback_count INT NOT NULL DEFAULT 0,
  fans_count    INT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_snapshots_user_platform
  ON analysis_snapshots(user_id, platform, created_at DESC);

-- RLS
ALTER TABLE analysis_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "snapshots: 본인만 읽기" ON analysis_snapshots;
CREATE POLICY "snapshots: 본인만 읽기"
  ON analysis_snapshots FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "snapshots: 본인만 쓰기" ON analysis_snapshots;
CREATE POLICY "snapshots: 본인만 쓰기"
  ON analysis_snapshots FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "snapshots: 본인만 삭제" ON analysis_snapshots;
CREATE POLICY "snapshots: 본인만 삭제"
  ON analysis_snapshots FOR DELETE
  USING (auth.uid() = user_id);
