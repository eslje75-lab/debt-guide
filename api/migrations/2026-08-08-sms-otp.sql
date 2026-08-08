-- 결제 시 SMS 번호 인증 — 2026-08-08. (원격 적용은 --command로: --file은 import 엔드포인트 인증오류)
ALTER TABLE users ADD COLUMN phone_verified INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS phone_otp (
  user_id      INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  phone        TEXT    NOT NULL,
  code_hash    TEXT    NOT NULL,
  expires_at   INTEGER NOT NULL,
  attempts     INTEGER NOT NULL DEFAULT 0,
  last_sent    INTEGER NOT NULL,
  window_start INTEGER NOT NULL,
  send_count   INTEGER NOT NULL DEFAULT 0
);
