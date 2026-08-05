-- Phase 5(이메일 인프라) 마이그레이션 — 2026-08-06 프로덕션 적용.
-- ⚠️ ALTER TABLE ADD COLUMN은 멱등이 아니다(컬럼이 이미 있으면 오류). 1회만 적용할 것.
ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS email_tokens (
  token_hash TEXT PRIMARY KEY,       -- SHA-256(토큰) hex
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose    TEXT    NOT NULL,       -- 'reset' | 'verify'
  expires_at INTEGER NOT NULL,       -- unix ms
  created_at INTEGER NOT NULL,       -- unix ms
  used_at    INTEGER                 -- 사용 시각(unix ms). null이면 미사용.
);
CREATE INDEX IF NOT EXISTS idx_email_tokens_user ON email_tokens(user_id, purpose);
