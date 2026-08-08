-- 탈퇴 시 법정 보존기록 누락 보완 (2026-08-08)
-- 전자상거래법 시행령 제6조: 계약·청약철회 기록 5년, 대금결제 기록 5년.
--   ① payments_archive가 status='paid'만 담아 환불건이 탈퇴와 함께 소멸하던 문제
--      → refunded_at 컬럼 추가 + 애플리케이션에서 'refunded'도 아카이브.
--   ② withdrawal_requests가 CASCADE로 삭제돼 청약철회 신청기록이 남지 않던 문제
--      → withdrawal_archive 신설(사유 텍스트는 보존 대상 아니므로 제외).
--
-- ⚠️ 원격 D1은 `--file`이 인증오류(10000)를 내므로 `--command`로 한 줄씩 실행할 것.
--    npx wrangler d1 execute chamroad-db --remote --command "ALTER TABLE ..."

ALTER TABLE payments_archive ADD COLUMN refunded_at INTEGER;

CREATE TABLE IF NOT EXISTS withdrawal_archive (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  payment_id  TEXT    NOT NULL,
  email       TEXT    NOT NULL,
  status      TEXT    NOT NULL,
  created_at  INTEGER NOT NULL,
  archived_at INTEGER NOT NULL
);
