-- 회원가입 시 이메일 인증(코드 입력 방식) 도입 (2026-08-09, 사용자 결정)
--
-- 왜: 종전에는 인증이 '소프트'(안내 배너만)여서 오타난 주소로도 가입·결제가 됐다.
--     그러면 ①비밀번호 재설정이 영영 불가능해 계정·데이터를 잃고
--     ②전자상거래법 제13조②의 계약내용 서면(주문확인 메일)이 도달하지 않으며
--     ③환불·청약철회 결과 통지도 못 받는다.
--
-- 방식: 가입 폼에서 이메일로 6자리 코드를 보내고, 확인한 뒤에야 계정을 만든다.
--       계정이 아직 없으므로 user_id가 아니라 이메일을 키로 잡는다.
--       기존 미인증 계정은 그대로 둔다(사용자 결정) — 새로 가입하는 사람부터 적용.
--
-- ⚠️ 원격 D1은 `--file`이 인증오류(10000) → `--command`로 실행할 것.

CREATE TABLE IF NOT EXISTS email_otp (
  email        TEXT PRIMARY KEY,
  code_hash    TEXT    NOT NULL,
  expires_at   INTEGER NOT NULL,
  attempts     INTEGER NOT NULL DEFAULT 0,
  last_sent    INTEGER NOT NULL,
  window_start INTEGER NOT NULL,
  send_count   INTEGER NOT NULL DEFAULT 0,
  verified_at  INTEGER
);
