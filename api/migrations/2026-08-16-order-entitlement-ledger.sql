-- 주문별 결제 이행·이용권 원장 (무손실 호환 마이그레이션)
-- 적용 순서: Worker 배포 전에 이 파일을 D1에 먼저 적용한다.

CREATE TABLE IF NOT EXISTS entitlement_grants (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  payment_id  TEXT UNIQUE REFERENCES payments(payment_id) ON DELETE SET NULL,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  package     TEXT    NOT NULL,
  source      TEXT    NOT NULL DEFAULT 'order',
  status      TEXT    NOT NULL DEFAULT 'active',
  granted_at  INTEGER NOT NULL,
  starts_at   INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  ai_quota    INTEGER NOT NULL CHECK (ai_quota >= 0),
  ai_used     INTEGER NOT NULL DEFAULT 0 CHECK (ai_used >= 0 AND ai_used <= ai_quota),
  revoked_at  INTEGER
);
CREATE INDEX IF NOT EXISTS idx_entitlement_grants_active
  ON entitlement_grants(user_id, package, status, starts_at, expires_at);
CREATE INDEX IF NOT EXISTS idx_entitlement_grants_ai
  ON entitlement_grants(user_id, status, expires_at, ai_used, ai_quota);
CREATE UNIQUE INDEX IF NOT EXISTS idx_entitlement_grants_one_legacy
  ON entitlement_grants(user_id, package) WHERE source = 'legacy';

CREATE TABLE IF NOT EXISTS payment_fulfillments (
  payment_id       TEXT PRIMARY KEY REFERENCES payments(payment_id) ON DELETE CASCADE,
  state            TEXT NOT NULL,
  claim_token      TEXT,
  claim_expires_at INTEGER,
  attempts         INTEGER NOT NULL DEFAULT 0,
  last_error       TEXT,
  fulfilled_at     INTEGER,
  updated_at       INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS entitlement_locks (
  user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  package          TEXT NOT NULL,
  claim_token      TEXT NOT NULL,
  claim_expires_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, package)
);

-- 집계형 행을 한 덩어리의 legacy 원장으로 그대로 복사한다. 만료행도 보존하므로 과거의
-- 미사용 회수가 재구매 때 합쳐져 부활하지 않는다. 기존 entitlements 행은 삭제하지 않는다.
INSERT OR IGNORE INTO entitlement_grants
  (payment_id, user_id, package, source, status, granted_at, starts_at, expires_at,
   ai_quota, ai_used, revoked_at)
SELECT NULL, user_id, package, 'legacy', 'active', granted_at, granted_at, expires_at,
       ai_quota, MIN(ai_used, ai_quota), NULL
  FROM entitlements;

-- 이미 확정된 주문은 과거 집계값에 포함됐다고 표시해 새 Worker가 다시 부여하지 않게 한다.
-- 과거 집계에는 주문별 귀속 정보가 없으므로 이 행들은 환불 시 자동 비례 차감하지 않는다.
INSERT OR IGNORE INTO payment_fulfillments
  (payment_id, state, claim_token, claim_expires_at, attempts, last_error, fulfilled_at, updated_at)
SELECT payment_id, 'legacy', NULL, NULL, 0, NULL, COALESCE(paid_at, created_at),
       COALESCE(paid_at, created_at)
  FROM payments
 WHERE status IN ('paid', 'test')
   AND EXISTS (
     SELECT 1 FROM entitlements e
      WHERE e.user_id = payments.user_id AND e.package = payments.package
   );
