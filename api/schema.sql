-- 챔로드 D1 스키마 (프로덕션 DB에 2026-07-19 적용됨)
-- 로컬 적용: npx wrangler d1 execute chamroad --local --file=schema.sql

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL, -- 형식: v1$<iterations>$<salt_b64>$<hash_b64> (PBKDF2-SHA256 + pepper)
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,          -- SHA-256(토큰) hex — 원본 토큰은 저장하지 않음
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,          -- unix ms
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- Phase 2: 사용자 데이터(진단결과·plan·진행률·서류체크·프로필 등)
-- 프론트 Storage의 cdg_* 키를 미러링. value는 JSON 문자열.
CREATE TABLE IF NOT EXISTS user_data (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key        TEXT    NOT NULL,
  value      TEXT    NOT NULL,
  updated_at INTEGER NOT NULL,       -- unix ms
  PRIMARY KEY (user_id, key)
);

-- Phase 3: AI 서류검토 일일 사용량(비용·남용 방지)
CREATE TABLE IF NOT EXISTS ai_usage (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day     TEXT    NOT NULL,          -- 'YYYY-MM-DD'
  count   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);

-- Phase 4: 결제(포트원 PortOne V2). 금액은 서버 PACKAGES가 소스.
CREATE TABLE IF NOT EXISTS payments (
  payment_id TEXT PRIMARY KEY,       -- 서버 생성 UUID (포트원 paymentId)
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  package    TEXT    NOT NULL,
  amount     INTEGER NOT NULL,       -- 주문 시점 서버 확정 금액(원)
  status     TEXT    NOT NULL DEFAULT 'pending',  -- pending | paid | failed
  created_at INTEGER NOT NULL,
  paid_at    INTEGER
);
CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);
