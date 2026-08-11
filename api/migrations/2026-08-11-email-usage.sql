-- 일자별 이메일 발송 수 — Resend 무료 한도(일 100통) 감시용
--
-- 왜 필요한가: 가입이 인증메일에 의존하므로(2026-08-09 도입) 한도가 소진되면
-- **신규 가입이 조용히 중단된다.** Resend 콘솔을 매일 들여다볼 수는 없으니
-- 우리가 보낸 수를 직접 세어 관리자 대시보드에 띄운다.
--
-- 사용자별이 아니라 **계정 전체 합계**다(한도가 Resend 계정 단위라서). day는 UTC 기준 'YYYY-MM-DD'.
--
-- ⚠️ 적용(원격은 --file이 인증오류를 내므로 --command):
--    cd api && npx wrangler@4.120.0 d1 execute chamroad --remote \
--      --command "CREATE TABLE IF NOT EXISTS email_usage (day TEXT PRIMARY KEY, count INTEGER NOT NULL DEFAULT 0);"
--
-- 배포 순서는 자유(코드가 이 표를 못 찾아도 카운트만 건너뛰고 메일은 정상 발송된다 — 방어적으로 감쌌다).

CREATE TABLE IF NOT EXISTS email_usage (
  day   TEXT PRIMARY KEY,           -- 'YYYY-MM-DD' (UTC)
  count INTEGER NOT NULL DEFAULT 0
);
