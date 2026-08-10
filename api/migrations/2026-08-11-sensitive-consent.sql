-- 민감정보 처리에 대한 '별도 동의' 기록 (개인정보 보호법 제23조 제1항 제1호)
--
-- 왜 필요한가: 진술서·경위서에는 질병·치료 같은 건강에 관한 정보가 사실상 반드시 들어간다
-- (채무가 왜 생겼는지를 써야 하므로). 이는 제23조의 민감정보이고, 처리하려면 다른 동의와
-- **별도로** 동의를 받아야 한다. 동의 사실의 입증책임은 처리자에게 있으므로(제22조 제3항)
-- 화면 체크박스만으로는 부족해 시각을 남긴다. NULL = 동의하지 않음(또는 철회함).
--
-- ⚠️ 적용 방법(원격은 --file이 인증오류를 내므로 --command를 쓸 것):
--    cd api && npx wrangler d1 execute chamroad --remote \
--      --command "ALTER TABLE users ADD COLUMN sensitive_consent_at INTEGER;"
--
-- ⚠️ 배포 순서: 이 마이그레이션을 **먼저** 적용한 뒤 Worker를 배포할 것.
--    새 코드는 users.sensitive_consent_at을 SELECT하므로, 컬럼이 없으면 로그인 세션 조회가 전부 실패한다.

ALTER TABLE users ADD COLUMN sensitive_consent_at INTEGER;
