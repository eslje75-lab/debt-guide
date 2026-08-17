-- 가입 동의 UI/서버 계약 판본을 계정별로 구분한다.
-- 기존 행은 legacy로 남기고, 새 분리동의 가입만 signup-consent-v1로 INSERT한다.
-- 운영 DB에는 한 번만 적용할 것(적용 전 D1 백업 필수).
ALTER TABLE users
  ADD COLUMN consent_form_version TEXT NOT NULL DEFAULT 'signup-consent-legacy';
