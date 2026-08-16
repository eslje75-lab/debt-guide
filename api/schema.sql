-- 챔로드 D1 스키마 (프로덕션 DB에 2026-07-19 적용됨)
-- 로컬 적용: npx wrangler d1 execute chamroad --local --file=schema.sql

-- agreed_at·consent_version: 가입 시 받은 동의(이용약관·개인정보처리방침 + 만 14세 이상 확인)의
-- 시각과 판본. 화면 체크박스만으로는 동의 사실이 남지 않아 「개인정보 보호법」 제22조 제3항
-- (동의 없이 처리할 수 있다는 입증책임은 개인정보처리자 부담)·제22조의2 제1항(만 14세 미만은
-- 법정대리인 동의)에 대응할 근거가 없다. 서버가 동의를 필수로 요구하고 여기에 기록한다.
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL, -- 형식: v1$<iterations>$<salt_b64>$<hash_b64> (PBKDF2-SHA256 + pepper)
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  agreed_at INTEGER,           -- unix ms
  consent_version TEXT,        -- 예: 'terms-2026-07-29/privacy-2026-08-06'
  email_verified INTEGER NOT NULL DEFAULT 0,  -- 이메일 인증 여부(소프트). 로그인·이용은 인증과 무관, 안내만.
  phone TEXT,                                 -- 연락처(휴대폰, 선택). 마이페이지 선택 입력 또는 결제 시 SMS 인증으로 확정.
  phone_verified INTEGER NOT NULL DEFAULT 0,  -- 결제 시 SMS 인증으로 진위 확인된 번호인지. 성인 '검증'은 아님(자기신고).
  -- 민감정보(건강 등) 처리에 대한 별도 동의 시각(unix ms). NULL = 미동의 또는 철회.
  -- 「개인정보 보호법」 제23조 제1항 제1호는 다른 동의와 '별도로' 받을 것을 요구하고,
  -- 제22조 제3항은 그 입증책임을 처리자에게 지운다. AI 서류검토·서류 간 대조의 전제 조건.
  sensitive_consent_at INTEGER
);
-- 기존 DB 반영: ALTER TABLE users ADD COLUMN agreed_at INTEGER;
--               ALTER TABLE users ADD COLUMN consent_version TEXT;
--               ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0;
--               ALTER TABLE users ADD COLUMN phone TEXT;
--               ALTER TABLE users ADD COLUMN phone_verified INTEGER NOT NULL DEFAULT 0;
--               ALTER TABLE users ADD COLUMN sensitive_consent_at INTEGER;

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
  status     TEXT    NOT NULL DEFAULT 'pending',  -- pending | paid | failed | refunded
  created_at INTEGER NOT NULL,
  paid_at    INTEGER,
  refunded_at INTEGER                              -- 청약철회·환불 처리 시각(unix ms). null이면 미환불.
);
CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);

-- 탈퇴 후 결제기록 보존용. 회원 삭제 시 payments는 CASCADE로 지워지므로,
-- 「전자상거래 등에서의 소비자보호에 관한 법률」 시행령 제6조(계약·청약철회 5년,
-- 대금결제 5년)를 지키기 위해 완료된 결제만 이 표로 옮겨 보관한다.
-- users를 참조하지 않는다(FK 없음) — 회원이 사라져도 남아야 하는 기록이므로.
-- 로그인 무차별 대입(brute-force) 방어 — 이메일 기준 실패 카운트·잠금.
-- 존재하지 않는 이메일도 카운트해 계정 존재 여부가 새지 않게 한다.
CREATE TABLE IF NOT EXISTS login_attempts (
  email        TEXT PRIMARY KEY,
  fail_count   INTEGER NOT NULL DEFAULT 0,
  window_start INTEGER NOT NULL,      -- 현재 실패 윈도우 시작(unix ms)
  locked_until INTEGER               -- 잠금 해제 시각(unix ms). null이면 미잠금.
);

-- 자체 익명 분석 — 개인·세션·IP를 저장하지 않고 날짜별 이벤트 카운트만 집계.
-- 개인정보가 아니며(식별 불가), 서비스 개선(이탈 구간·전환율 파악)에만 쓴다.
CREATE TABLE IF NOT EXISTS analytics (
  day   TEXT    NOT NULL,               -- 'YYYY-MM-DD'
  event TEXT    NOT NULL,               -- pageview | diag_step | diag_complete | pay_start | pay_complete
  label TEXT    NOT NULL DEFAULT '',    -- 페이지 id, 단계 번호 등 비개인 세부값
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, event, label)
);

CREATE TABLE IF NOT EXISTS payments_archive (
  payment_id  TEXT PRIMARY KEY,
  email       TEXT NOT NULL,       -- 거래 당사자 식별용(전상법상 보존 목적에 한해 유지)
  package     TEXT NOT NULL,
  amount      INTEGER NOT NULL,
  status      TEXT NOT NULL,       -- paid | refunded (환불건도 대금결제 기록이라 함께 보존)
  created_at  INTEGER NOT NULL,
  paid_at     INTEGER,
  refunded_at INTEGER,             -- 환불 시각(unix ms). null이면 미환불.
  archived_at INTEGER NOT NULL     -- 탈퇴 시각(unix ms). 보존기간 만료 판단 기준.
);

-- 탈퇴 후 청약철회 신청기록 보존용. withdrawal_requests는 회원 삭제 시 CASCADE로 사라지므로,
-- 시행령 제6조의 '계약 또는 청약철회등에 관한 기록 5년'을 지키기 위해 신청 사실만 옮겨 둔다.
-- 신청 사유(reason)는 옮기지 않는다 — 청약철회에 사유가 필요 없어 보존 대상이 아니고,
-- 자유서술 텍스트를 5년 보관하면 최소수집 원칙에 어긋난다.
CREATE TABLE IF NOT EXISTS withdrawal_archive (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  payment_id  TEXT    NOT NULL,
  email       TEXT    NOT NULL,    -- 거래 당사자 식별용
  status      TEXT    NOT NULL,    -- pending | auto_refunded | resolved
  created_at  INTEGER NOT NULL,    -- 청약철회 신청 시각(= 의사표시 발송일, 법 제17조④)
  archived_at INTEGER NOT NULL     -- 탈퇴 시각(unix ms)
);

-- 유료 콘텐츠를 실제로 처음 연 시각.
-- 「전자상거래 등에서의 소비자보호에 관한 법률」 제17조 제2항 제5호의 '디지털콘텐츠의
-- 제공이 개시된 경우'에 해당하는지를 판단하는 근거(= 청약철회 가능 여부의 기준일).
-- 최초 1회만 기록한다(INSERT OR IGNORE). 이 기록이 없으면 '미개시'로 보아 전액 환불
-- (약관 제6조 ① — 결제일부터 14일).
CREATE TABLE IF NOT EXISTS content_access (
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  package         TEXT    NOT NULL,
  first_access_at INTEGER NOT NULL,   -- unix ms
  PRIMARY KEY (user_id, package)
);

-- 이용권(entitlement) — 패키지별 이용기간과 AI 검토 잔여 회수를 한곳에서 관리한다.
-- plan_packages(user_data의 JSON 배열)는 클라이언트 캐시·하위호환용으로 계속 쓰되,
-- 만료·회수 판정의 최종 근거는 이 표다.
--
-- expires_at 근거(2026-07-29 확정):
--   rehab-full  24개월 — 준비 3개월 + 신청~인가 6개월(법 제596조① 개시 1월 + 이의기간 2월 + 집회 1월) + 여유
--   bankrupt-full 24개월 — 준비 3개월 + 신청~면책 6~8개월 + 관재인 조사 지연 여유
--   maintain    84개월 — 변제기간이 최대 5년(법 제611조⑤)인 상품이라 짧게 잡으면 광고와 이행이 어긋난다
--   correction-* 12개월 — 보정을 받은 뒤 구매하는 반응형 상품(보정기한은 통상 2주~1개월)
-- ⚠️ 이용기간은 결제 전 고지가 필수다(전자상거래법 제13조②). pricing.html 카드·결제 전 확인창·
--    terms.html 제5조를 함께 고쳐야 하며, 이 표만 바꾸면 고지 없는 소멸이 되어 더 큰 문제가 된다.
CREATE TABLE IF NOT EXISTS entitlements (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  package    TEXT    NOT NULL,
  granted_at INTEGER NOT NULL,          -- unix ms
  expires_at INTEGER NOT NULL,          -- unix ms. 이 시각 이후 접근 불가
  ai_quota   INTEGER NOT NULL,          -- 부여된 AI 서류검토 회수
  ai_used    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, package)
);
CREATE INDEX IF NOT EXISTS idx_entitlements_user ON entitlements(user_id);

-- ※ ai_trial(미구매자 AI 검토 체험 1회) 테이블은 2026-08-08 폐지·삭제됨.
--    탈퇴 시 users FK CASCADE로 함께 지워져 재가입만 하면 체험이 무한 반복됐고,
--    검토 1회마다 Anthropic API 실비가 나가 비용이 새는 구조였다.
--    법 제17조⑥ 단서의 시험사용 조치는 시행령 제21조의2 각 호 중 하나 이상이면 되고,
--    제1호(일부 이용의 허용 = 유료 콘텐츠 미리보기)를 유지하므로 요건은 그대로 충족된다.
--    다시 만들지 말 것. 서류검토 AI는 entitlements(패키지 회수)로만 판정한다.

-- 가입 전 이메일 인증 코드(2026-08-09). 계정이 아직 없으므로 user_id가 아니라 이메일로 키를 잡는다.
-- 가입 폼에서 코드를 받아 확인한 뒤에야 계정이 만들어지므로, 미인증 계정이 아예 생기지 않는다.
-- verified_at = 코드 확인에 성공한 시각. 가입은 이 시각으로부터 일정 시간 안에만 허용한다.
CREATE TABLE IF NOT EXISTS email_otp (
  email        TEXT PRIMARY KEY,
  code_hash    TEXT    NOT NULL,      -- SHA-256(코드) hex. 원문은 저장하지 않는다.
  expires_at   INTEGER NOT NULL,
  attempts     INTEGER NOT NULL DEFAULT 0,
  last_sent    INTEGER NOT NULL,      -- 재발송 쿨다운 기준
  window_start INTEGER NOT NULL,      -- 발송횟수 제한 윈도우 시작
  send_count   INTEGER NOT NULL DEFAULT 0,
  verified_at  INTEGER                -- null이면 아직 미인증
);

-- Phase 5(이메일 인프라): 비밀번호 재설정·이메일 인증용 일회성 토큰.
-- 세션과 동일하게 원본 토큰은 저장하지 않고 SHA-256 해시만 보관한다(DB 유출 시 무효).
-- purpose='reset'(비밀번호 재설정) | 'verify'(가입 이메일 인증). 사용 시 used_at 기록 → 재사용 차단.
CREATE TABLE IF NOT EXISTS email_tokens (
  token_hash TEXT PRIMARY KEY,       -- SHA-256(토큰) hex
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose    TEXT    NOT NULL,       -- 'reset' | 'verify'
  expires_at INTEGER NOT NULL,       -- unix ms
  created_at INTEGER NOT NULL,       -- unix ms (재발송 쿨다운 판단)
  used_at    INTEGER                 -- 사용 시각(unix ms). null이면 미사용.
);
CREATE INDEX IF NOT EXISTS idx_email_tokens_user ON email_tokens(user_id, purpose);

-- 청약철회 신청 기록 — 전자상거래법 제13조 제2항 제5호(청약철회 서식)·제5조 제4항(전자문서로
-- 청약철회 가능)을 충족하는 이용자 신청의 접수 기록. 14일 이내·미개시면 자동 환불(status
-- 'auto_refunded'), 그 외는 운영자 검토(pending → resolved). 실제 환불 사실 자체는
-- payments.status='refunded'(및 탈퇴 시 payments_archive)에 남으므로 법정 보존은 그쪽이 담당한다.
CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  payment_id TEXT    NOT NULL,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason     TEXT,
  status     TEXT    NOT NULL DEFAULT 'pending',  -- pending | auto_refunded | resolved
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_withdrawal_user ON withdrawal_requests(user_id);

-- 결제 시 휴대폰 SMS 인증(솔라피)용 일회성 코드. 사용자당 1행(재발송 시 덮어씀).
-- 코드는 원문이 아닌 SHA-256 해시만 저장. last_sent=쿨다운, window_start/send_count=발송횟수 제한.
CREATE TABLE IF NOT EXISTS phone_otp (
  user_id      INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  phone        TEXT    NOT NULL,
  code_hash    TEXT    NOT NULL,       -- SHA-256(코드) hex
  expires_at   INTEGER NOT NULL,       -- unix ms
  attempts     INTEGER NOT NULL DEFAULT 0,
  last_sent    INTEGER NOT NULL,       -- 마지막 발송(unix ms) — 재발송 쿨다운
  window_start INTEGER NOT NULL,       -- 발송횟수 제한 윈도우 시작(unix ms)
  send_count   INTEGER NOT NULL DEFAULT 0
);

-- 수신번호 기준 발송 한도 (2026-08-16 보안감사). phone_otp의 한도는 전부 '계정당'이라
-- 계정을 여러 개 만들면 같은 번호로 계속 문자를 보낼 수 있었다. 이 표는 **번호 하나당** 센다.
-- 개인정보 최소화: 번호 외에는 아무것도 남기지 않는다(누가 보냈는지 기록하지 않는다).
CREATE TABLE IF NOT EXISTS phone_send_log (
  phone        TEXT    PRIMARY KEY,      -- 숫자만(정규화된 수신번호)
  window_start INTEGER NOT NULL,         -- 24시간 창 시작(unix ms)
  send_count   INTEGER NOT NULL DEFAULT 0
);
