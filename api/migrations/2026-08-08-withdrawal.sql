-- 청약철회 신청 기록 테이블 — 2026-08-08.
-- 전자상거래법 제13조②5호(청약철회 서식)·제5조④(전자문서 청약철회) 충족용 접수 기록.
CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  payment_id TEXT    NOT NULL,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason     TEXT,
  status     TEXT    NOT NULL DEFAULT 'pending',  -- pending | auto_refunded | resolved
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_withdrawal_user ON withdrawal_requests(user_id);
