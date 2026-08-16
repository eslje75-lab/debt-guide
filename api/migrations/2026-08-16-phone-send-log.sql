-- 수신번호 기준 SMS 발송 한도 (2026-08-16 보안감사)
--
-- phone_otp는 PK가 user_id라 한도가 전부 '계정당'이었다. 그래서 계정을 여러 개 만들면
-- 같은 번호로 계속 인증 문자를 보낼 수 있었다(문자 폭탄 + 솔라피 선불 잔액 소모).
-- 가입에 Turnstile·이메일 OTP가 걸려 있어 규모는 작지만, 피해자 쪽에 상한이 아예 없던 것이 문제다.
--
-- 이 표는 **번호 하나당** 24시간 창의 발송 수를 센다. 계정이 몇 개든 합산된다.
-- 개인정보 최소화: 번호 외에 아무것도 넣지 않는다(누가 보냈는지는 기록하지 않는다).
CREATE TABLE IF NOT EXISTS phone_send_log (
  phone        TEXT    PRIMARY KEY,      -- 숫자만(정규화된 수신번호)
  window_start INTEGER NOT NULL,         -- 24시간 창 시작(unix ms)
  send_count   INTEGER NOT NULL DEFAULT 0
);
