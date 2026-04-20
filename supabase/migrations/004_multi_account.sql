-- ─────────────────────────────────────────────
-- Realations: 멀티 계정 관리 — 분석 히스토리에 계정 레이블 추가
-- ─────────────────────────────────────────────

-- analysis_snapshots에 account_label 컬럼 추가
-- Pro 플랜: 최대 10개 계정 레이블 지원
ALTER TABLE analysis_snapshots ADD COLUMN IF NOT EXISTS account_label TEXT DEFAULT '기본 계정';

-- 기존 데이터 기본값 설정
UPDATE analysis_snapshots SET account_label = '기본 계정' WHERE account_label IS NULL;
