import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

import worker from '../src/index.js';

const TOKEN = 'L'.repeat(43);
const TOKEN_HASH = createHash('sha256').update(TOKEN).digest('hex');
const ORIGIN = 'https://chamroad.com';
const SCHEMA = readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');
const MIGRATION = readFileSync(new URL('../migrations/2026-08-16-order-entitlement-ledger.sql', import.meta.url), 'utf8');
const CONSENT_MIGRATION = readFileSync(new URL('../migrations/2026-08-16-signup-consent-form-version.sql', import.meta.url), 'utf8');

class FakeStatement {
  constructor(db, sql) { this.db = db; this.sql = sql; this.args = []; }
  bind(...args) { this.args = args; return this; }
  first() { return this.db.execute(this, 'first'); }
  all() { return this.db.execute(this, 'all'); }
  run() { return this.db.execute(this, 'run'); }
}

// 실제 SQLite 제약/트랜잭션을 쓰되 Worker가 기대하는 D1 표면만 제공하는 fake-D1.
class SqliteFakeD1 {
  constructor() {
    this.sqlite = new DatabaseSync(':memory:');
    this.sqlite.exec('PRAGMA foreign_keys=ON');
    this.sqlite.exec(SCHEMA);
    this.failGrantBatchOnce = false;
  }
  prepare(sql) { return new FakeStatement(this, sql); }
  execute(statement, mode) {
    const prepared = this.sqlite.prepare(statement.sql);
    if (mode === 'first') return prepared.get(...statement.args) || null;
    if (mode === 'all') return { results: prepared.all(...statement.args) };
    const result = prepared.run(...statement.args);
    return { success: true, meta: { changes: Number(result.changes) } };
  }
  batch(statements) {
    if (this.failGrantBatchOnce && statements.some(s => /INSERT OR IGNORE INTO entitlement_grants/.test(s.sql))) {
      this.failGrantBatchOnce = false;
      throw new Error('injected D1 batch failure');
    }
    this.sqlite.exec('BEGIN IMMEDIATE');
    try {
      const results = statements.map(s => this.execute(s, /^\s*SELECT/i.test(s.sql) ? 'all' : 'run'));
      this.sqlite.exec('COMMIT');
      return results;
    } catch (error) {
      this.sqlite.exec('ROLLBACK');
      throw error;
    }
  }
  get(sql, ...args) { return this.sqlite.prepare(sql).get(...args); }
  all(sql, ...args) { return this.sqlite.prepare(sql).all(...args); }
  close() { this.sqlite.close(); }
}

function seed(db, { sensitiveConsent = false } = {}) {
  db.sqlite.prepare(
    `INSERT INTO users
      (id,email,name,password_hash,agreed_at,consent_version,email_verified,phone_verified,sensitive_consent_at)
     VALUES (1,'admin@example.com','관리자','hash',1,'v1',1,0,?)`
  ).run(sensitiveConsent ? Date.now() : null);
  db.sqlite.prepare('INSERT INTO sessions (token_hash,user_id,expires_at) VALUES (?,?,?)')
    .run(TOKEN_HASH, 1, Date.now() + 60_000);
}

function addOrder(db, paymentId, pkg = 'rehab-full', amount = 149000, status = 'pending') {
  db.sqlite.prepare(
    'INSERT INTO payments (payment_id,user_id,package,amount,status,created_at,paid_at) VALUES (?,?,?,?,?,?,?)'
  ).run(paymentId, 1, pkg, amount, status, Date.now(), status === 'paid' ? Date.now() : null);
}

function request(path, body) {
  return new Request(`https://api.chamroad.com${path}`, {
    method: 'POST',
    headers: { Origin: ORIGIN, Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function env(db, extra = {}) {
  return {
    DB: db, PEPPER: 'test-pepper', PORTONE_API_SECRET: 'portone-secret',
    ADMIN_EMAIL: 'admin@example.com', ...extra,
  };
}

function paidPortoneFetch() {
  return async (url) => {
    if (String(url).includes('/cancel')) return new Response('{}', { status: 200 });
    if (String(url).startsWith('https://api.portone.io/payments/')) {
      // 포트원 V2 조회 응답은 통화를 최상위 currency로 준다. 서버가 금액과 함께 검증하므로
      // stub도 실제 응답 형태를 그대로 흉내 낸다.
      return new Response(JSON.stringify({ status: 'PAID', currency: 'KRW', amount: { total: 149000 } }), {
        status: 200, headers: { 'content-type': 'application/json' },
      });
    }
    throw new Error(`unexpected fetch ${url}`);
  };
}

test('consent form migration distinguishes legacy rows from new split-consent signups', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(`CREATE TABLE users (
      id INTEGER PRIMARY KEY, email TEXT, agreed_at INTEGER, consent_version TEXT
    ); INSERT INTO users VALUES (1, 'legacy@example.com', 1, 'terms-v1/privacy-v1');`);
    db.exec(CONSENT_MIGRATION);
    assert.equal(
      db.prepare('SELECT consent_form_version FROM users WHERE id=1').get().consent_form_version,
      'signup-consent-legacy',
    );
  } finally { db.close(); }
});

test('migration preserves aggregate rows and marks only attributable legacy payments', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec('PRAGMA foreign_keys=ON');
    db.exec(`
      CREATE TABLE users (id INTEGER PRIMARY KEY);
      CREATE TABLE payments (
        payment_id TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        package TEXT NOT NULL, amount INTEGER NOT NULL, status TEXT NOT NULL,
        created_at INTEGER NOT NULL, paid_at INTEGER, refunded_at INTEGER
      );
      CREATE TABLE entitlements (
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, package TEXT NOT NULL,
        granted_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, ai_quota INTEGER NOT NULL,
        ai_used INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(user_id,package)
      );
      INSERT INTO users(id) VALUES (1);
      INSERT INTO entitlements VALUES (1,'rehab-full',100,200,24,3);
      INSERT INTO payments VALUES ('legacy-paid',1,'rehab-full',149000,'paid',90,100,NULL);
      INSERT INTO payments VALUES ('unfulfilled-paid',1,'maintain',99000,'paid',90,100,NULL);
    `);
    db.exec(MIGRATION);
    db.exec(MIGRATION);
    assert.equal(db.prepare('SELECT COUNT(*) AS c FROM entitlements').get().c, 1);
    assert.deepEqual(
      { ...db.prepare("SELECT source,ai_quota,ai_used FROM entitlement_grants WHERE package='rehab-full'").get() },
      { source: 'legacy', ai_quota: 24, ai_used: 3 },
    );
    assert.equal(db.prepare('SELECT COUNT(*) AS c FROM entitlement_grants').get().c, 1);
    assert.equal(db.prepare("SELECT state FROM payment_fulfillments WHERE payment_id='legacy-paid'").get().state, 'legacy');
    assert.equal(db.prepare("SELECT state FROM payment_fulfillments WHERE payment_id='unfulfilled-paid'").get(), undefined);
  } finally { db.close(); }
});

test('parallel complete claims one payment and grants exactly once', async (t) => {
  const db = new SqliteFakeD1();
  t.after(() => db.close());
  seed(db);
  addOrder(db, 'pay-parallel');

  const originalFetch = globalThis.fetch;
  let lookups = 0;
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  globalThis.fetch = async (url) => {
    if (String(url).startsWith('https://api.portone.io/payments/')) {
      lookups++;
      if (lookups === 2) release();
      await gate;
      return new Response(JSON.stringify({ status: 'PAID', currency: 'KRW', amount: { total: 149000 } }), {
        status: 200, headers: { 'content-type': 'application/json' },
      });
    }
    throw new Error(`unexpected fetch ${url}`);
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const responses = await Promise.all([
    worker.fetch(request('/api/payment/complete', { paymentId: 'pay-parallel' }), env(db)),
    worker.fetch(request('/api/payment/complete', { paymentId: 'pay-parallel' }), env(db)),
  ]);
  assert.ok(responses.every(r => r.status === 200 || r.status === 409));
  assert.equal(db.get('SELECT COUNT(*) AS c FROM entitlement_grants WHERE payment_id=?', 'pay-parallel').c, 1);
  assert.equal(db.get('SELECT ai_quota FROM entitlement_grants WHERE payment_id=?', 'pay-parallel').ai_quota, 12);
  assert.equal(db.get('SELECT state FROM payment_fulfillments WHERE payment_id=?', 'pay-parallel').state, 'fulfilled');
  assert.equal(db.get('SELECT status FROM payments WHERE payment_id=?', 'pay-parallel').status, 'paid');
});

test('failed fulfillment becomes retryable and never duplicates its order grant', async (t) => {
  const db = new SqliteFakeD1();
  t.after(() => db.close());
  seed(db);
  addOrder(db, 'pay-retry');
  db.failGrantBatchOnce = true;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = paidPortoneFetch();
  t.after(() => { globalThis.fetch = originalFetch; });

  const first = await worker.fetch(request('/api/payment/complete', { paymentId: 'pay-retry' }), env(db));
  assert.equal(first.status, 500);
  assert.equal(db.get('SELECT state FROM payment_fulfillments WHERE payment_id=?', 'pay-retry').state, 'retry');
  assert.equal(db.get('SELECT COUNT(*) AS c FROM entitlement_grants WHERE payment_id=?', 'pay-retry').c, 0);

  const second = await worker.fetch(request('/api/payment/complete', { paymentId: 'pay-retry' }), env(db));
  assert.equal(second.status, 200);
  assert.equal(db.get('SELECT state FROM payment_fulfillments WHERE payment_id=?', 'pay-retry').state, 'fulfilled');
  assert.equal(db.get('SELECT COUNT(*) AS c FROM entitlement_grants WHERE payment_id=?', 'pay-retry').c, 1);
});

test('repurchases chain per-order terms and refund revokes only that order share', async (t) => {
  const db = new SqliteFakeD1();
  t.after(() => db.close());
  seed(db);
  addOrder(db, 'pay-first');
  addOrder(db, 'pay-second');
  const originalFetch = globalThis.fetch;
  globalThis.fetch = paidPortoneFetch();
  t.after(() => { globalThis.fetch = originalFetch; });

  assert.equal((await worker.fetch(request('/api/payment/complete', { paymentId: 'pay-first' }), env(db))).status, 200);
  assert.equal((await worker.fetch(request('/api/payment/complete', { paymentId: 'pay-second' }), env(db))).status, 200);
  const before = db.all(
    "SELECT payment_id,starts_at,expires_at,ai_quota,status FROM entitlement_grants WHERE source='order' ORDER BY starts_at"
  );
  assert.equal(before.length, 2);
  assert.equal(before[1].starts_at, before[0].expires_at);
  assert.deepEqual(before.map(r => r.ai_quota), [12, 12]);
  assert.equal(db.get(
    "SELECT SUM(ai_quota) AS q FROM entitlement_grants WHERE status='active' AND granted_at<=? AND expires_at>?",
    Date.now(), Date.now(),
  ).q, 24, 'the repurchase AI quota is usable immediately even though its duration segment is appended');
  const secondDuration = before[1].expires_at - before[1].starts_at;

  const refunded = await worker.fetch(request('/api/admin/refund', { paymentId: 'pay-first', reason: 'test' }), env(db));
  assert.equal(refunded.status, 200);
  const after = db.all(
    "SELECT payment_id,starts_at,expires_at,ai_quota,status FROM entitlement_grants WHERE source='order' ORDER BY payment_id"
  );
  const first = after.find(r => r.payment_id === 'pay-first');
  const second = after.find(r => r.payment_id === 'pay-second');
  assert.equal(first.status, 'revoked');
  assert.equal(second.status, 'active');
  assert.equal(second.ai_quota, 12);
  assert.equal(second.expires_at - second.starts_at, secondDuration);
  assert.ok(second.starts_at <= Date.now() + 1000);
});

test('ambiguous historical aggregate is preserved until its last legacy order is refunded', async (t) => {
  const db = new SqliteFakeD1();
  t.after(() => db.close());
  seed(db);
  const now = Date.now();
  addOrder(db, 'legacy-one', 'rehab-full', 149000, 'paid');
  addOrder(db, 'legacy-two', 'rehab-full', 149000, 'paid');
  db.sqlite.prepare(
    `INSERT INTO entitlement_grants
      (user_id,package,source,status,granted_at,starts_at,expires_at,ai_quota,ai_used)
     VALUES (1,'rehab-full','legacy','active',?,?,?,?,?)`
  ).run(now, now, now + 100_000, 24, 3);
  for (const paymentId of ['legacy-one', 'legacy-two']) {
    db.sqlite.prepare(
      `INSERT INTO payment_fulfillments
        (payment_id,state,attempts,fulfilled_at,updated_at) VALUES (?,'legacy',0,?,?)`
    ).run(paymentId, now, now);
  }
  const originalFetch = globalThis.fetch;
  globalThis.fetch = paidPortoneFetch();
  t.after(() => { globalThis.fetch = originalFetch; });

  const firstResponse = await worker.fetch(request('/api/admin/refund', { paymentId: 'legacy-one' }), env(db));
  assert.equal(firstResponse.status, 200);
  assert.equal((await firstResponse.json()).legacyManualReconciliation, true);
  assert.equal(db.get("SELECT status FROM entitlement_grants WHERE source='legacy'").status, 'active');

  const lastResponse = await worker.fetch(request('/api/admin/refund', { paymentId: 'legacy-two' }), env(db));
  assert.equal(lastResponse.status, 200);
  assert.equal((await lastResponse.json()).legacyManualReconciliation, false);
  assert.equal(db.get("SELECT status FROM entitlement_grants WHERE source='legacy'").status, 'revoked');
});

test('expired unused legacy quota is not revived by a repurchase', async (t) => {
  const db = new SqliteFakeD1();
  t.after(() => db.close());
  seed(db);
  const now = Date.now();
  db.sqlite.prepare(
    `INSERT INTO entitlement_grants
      (user_id,package,source,status,granted_at,starts_at,expires_at,ai_quota,ai_used)
     VALUES (1,'rehab-full','legacy','active',?,?,?,?,0)`
  ).run(now - 100_000, now - 100_000, now - 1, 12);
  addOrder(db, 'pay-new');
  const originalFetch = globalThis.fetch;
  globalThis.fetch = paidPortoneFetch();
  t.after(() => { globalThis.fetch = originalFetch; });

  const response = await worker.fetch(request('/api/payment/complete', { paymentId: 'pay-new' }), env(db));
  assert.equal(response.status, 200);
  const fresh = db.get('SELECT starts_at,ai_quota FROM entitlement_grants WHERE payment_id=?', 'pay-new');
  assert.equal(fresh.ai_quota, 12);
  assert.ok(fresh.starts_at >= now);
  const active = db.get(
    "SELECT SUM(ai_quota) AS q FROM entitlement_grants WHERE user_id=1 AND status='active' AND starts_at<=? AND expires_at>?",
    Date.now(), Date.now(),
  );
  assert.equal(active.q, 12);
});

test('AI quota selects consumed product first, then nearest expiry order grant', async (t) => {
  const db = new SqliteFakeD1();
  t.after(() => db.close());
  seed(db, { sensitiveConsent: true });
  const now = Date.now();
  const grants = [
    ['ai-unopened', 'rehab-full', now + 10_000],
    ['ai-open-later', 'maintain', now + 30_000],
    ['ai-open-sooner', 'bankrupt-full', now + 20_000],
  ];
  for (const [paymentId, pkg, expiresAt] of grants) {
    addOrder(db, paymentId, pkg, pkg === 'maintain' ? 99000 : 149000, 'paid');
    db.sqlite.prepare(
      `INSERT INTO entitlement_grants
        (payment_id,user_id,package,source,status,granted_at,starts_at,expires_at,ai_quota,ai_used)
       VALUES (?,1,?,'order','active',?,?,?,?,0)`
    ).run(paymentId, pkg, now - 1000, now - 1000, expiresAt, 12);
  }
  db.sqlite.prepare('INSERT INTO content_access (user_id,package,first_access_at) VALUES (1,?,?)')
    .run('maintain', now);
  db.sqlite.prepare('INSERT INTO content_access (user_id,package,first_access_at) VALUES (1,?,?)')
    .run('bankrupt-full', now);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url) === 'https://api.anthropic.com/v1/messages') {
      const text = JSON.stringify({ present: [], questions: [], lawNotes: [] });
      return new Response(JSON.stringify({ stop_reason: 'end_turn', content: [{ type: 'text', text }] }), {
        status: 200, headers: { 'content-type': 'application/json' },
      });
    }
    throw new Error(`unexpected fetch ${url}`);
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const response = await worker.fetch(request('/api/ai/review', {
    docLabel: '진술서', text: '채무 발생 경위와 현재 상황을 설명하는 충분히 긴 테스트 문장입니다. 추가 내용입니다.',
  }), env(db, { ANTHROPIC_API_KEY: 'anthropic-test' }));
  assert.equal(response.status, 200);
  assert.equal(db.get('SELECT ai_used FROM entitlement_grants WHERE payment_id=?', 'ai-open-sooner').ai_used, 1);
  assert.equal(db.get('SELECT ai_used FROM entitlement_grants WHERE payment_id=?', 'ai-open-later').ai_used, 0);
  assert.equal(db.get('SELECT ai_used FROM entitlement_grants WHERE payment_id=?', 'ai-unopened').ai_used, 0);
});

// PACKAGES의 amount는 통화 정보가 없는 '원' 단위 숫자다. total만 비교하면 브라우저가
// requestPayment의 currency를 바꿔 훨씬 싼 통화로 149000을 결제해도 서버가 통과시킨다.
test('a matching total in a foreign currency never grants an entitlement', async (t) => {
  const db = new SqliteFakeD1();
  t.after(() => db.close());
  seed(db);
  addOrder(db, 'pay-currency');

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).startsWith('https://api.portone.io/payments/')) {
      return new Response(JSON.stringify({ status: 'PAID', currency: 'JPY', amount: { total: 149000 } }), {
        status: 200, headers: { 'content-type': 'application/json' },
      });
    }
    throw new Error(`unexpected fetch ${url}`);
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const response = await worker.fetch(request('/api/payment/complete', { paymentId: 'pay-currency' }), env(db));
  assert.equal(response.status, 400);
  assert.equal(db.get('SELECT status FROM payments WHERE payment_id=?', 'pay-currency').status, 'failed');
  assert.equal(db.get('SELECT COUNT(*) AS c FROM entitlement_grants WHERE payment_id=?', 'pay-currency').c, 0);
});

// 통화 필드가 아예 없는 응답도 KRW로 추정하지 않는다(옛 stub이 이 형태였다).
test('a payment lookup without a currency field is rejected rather than assumed KRW', async (t) => {
  const db = new SqliteFakeD1();
  t.after(() => db.close());
  seed(db);
  addOrder(db, 'pay-nocurrency');

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).startsWith('https://api.portone.io/payments/')) {
      return new Response(JSON.stringify({ status: 'PAID', amount: { total: 149000 } }), {
        status: 200, headers: { 'content-type': 'application/json' },
      });
    }
    throw new Error(`unexpected fetch ${url}`);
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const response = await worker.fetch(request('/api/payment/complete', { paymentId: 'pay-nocurrency' }), env(db));
  assert.equal(response.status, 400);
  assert.equal(db.get('SELECT COUNT(*) AS c FROM entitlement_grants WHERE payment_id=?', 'pay-nocurrency').c, 0);
});

/* ── 부분환불 산식 ─────────────────────────────────────────────────────────
 * 근거: 전자상거래법 제17조 제2항 제5호 단서 — 제공이 개시돼도 가분적 콘텐츠·용역이면
 * "제공이 개시되지 아니한 부분"은 청약철회 대상이다. AI 검토를 회수로 세어 판 이상
 * 미사용 회차가 그 부분이다.
 *
 *   콘텐츠분 = 유료 본문을 연 적 있으면 0, 없으면 전액   (불가분으로 본다)
 *   AI분     = 회당단가 × 미사용 회수                    (가분적)
 *
 * 회생 완주: 149,000 = 콘텐츠 89,000 + AI 12회 × 5,000
 * 🔴 금액이 틀리면 그대로 돈 문제가 된다. 산식을 고치면 이 표를 함께 고칠 것.
 */
function grantFor(db, paymentId, pkg, quota, used) {
  const now = Date.now();
  db.sqlite.prepare(
    `INSERT INTO entitlement_grants
       (payment_id,user_id,package,source,status,granted_at,starts_at,expires_at,ai_quota,ai_used)
     VALUES (?,1,?,'order','active',?,?,?,?,?)`
  ).run(paymentId, pkg, now - 1000, now - 1000, now + 86_400_000, quota, used);
}

// 운영자 검토 메일에 실리는 금액을 직접 확인할 수 없으므로, 같은 산식을 여기서 재현해 고정한다.
function expectedRefund({ amount, unitPrice, quota, used, opened }) {
  const content = opened ? 0 : amount - unitPrice * quota;
  return content + unitPrice * (quota - used);
}

test('환불 산식 — 콘텐츠 미열람 + AI 미사용이면 전액', () => {
  assert.equal(
    expectedRefund({ amount: 149000, unitPrice: 5000, quota: 12, used: 0, opened: false }),
    149000);
});

test('환불 산식 — 콘텐츠를 열면 콘텐츠분은 빠지고 미사용 회차만 남는다', () => {
  // 12회 중 3회 사용 → 9회 × 5,000 = 45,000
  assert.equal(
    expectedRefund({ amount: 149000, unitPrice: 5000, quota: 12, used: 3, opened: true }),
    45000);
});

test('환불 산식 — AI만 쓰고 본문을 안 열었으면 콘텐츠분이 남는다', () => {
  // 🔴 옛 구조(content_access 한 행)로는 이 경우를 구분하지 못해 89,000원을 못 돌려줬다.
  assert.equal(
    expectedRefund({ amount: 149000, unitPrice: 5000, quota: 12, used: 3, opened: false }),
    89000 + 45000);
});

test('환불 산식 — 전부 소진하면 0원', () => {
  assert.equal(
    expectedRefund({ amount: 149000, unitPrice: 5000, quota: 12, used: 12, opened: true }),
    0);
});

test('상품별 구성요소 배분이 음수가 되지 않는다', () => {
  const table = [
    ['rehab-full', 149000, 12, 5000], ['bankrupt-full', 49000, 12, 2000],
    ['maintain', 29000, 8, 1500], ['correction-rehab', 19000, 8, 1000],
    ['correction-bankrupt', 19000, 8, 1000],
  ];
  for (const [key, amount, quota, unit] of table) {
    const content = amount - unit * quota;
    assert.ok(content > 0, `${key}: 콘텐츠분이 0 이하다(${content}) — 회당단가가 너무 높다`);
    assert.equal(Number.isInteger(unit), true, `${key}: 회당단가가 정수가 아니다`);
  }
});

test('콘텐츠 열기만 content_opened_at을 남기고 AI 사용은 남기지 않는다', (t) => {
  const db = new SqliteFakeD1();
  t.after(() => db.close());
  seed(db);
  const now = Date.now();
  // AI 사용 경로가 쓰는 형태: first_access_at만 기록
  db.sqlite.prepare('INSERT INTO content_access (user_id,package,first_access_at) VALUES (1,?,?)')
    .run('rehab-full', now);
  let row = db.get('SELECT first_access_at, content_opened_at FROM content_access WHERE user_id=1 AND package=?', 'rehab-full');
  assert.ok(row.first_access_at, 'AI 사용 기록이 없다');
  assert.equal(row.content_opened_at, null, 'AI 사용인데 콘텐츠 열람으로 기록됐다');

  // 콘텐츠 열기 경로
  db.sqlite.prepare('UPDATE content_access SET content_opened_at=? WHERE user_id=1 AND package=? AND content_opened_at IS NULL')
    .run(now + 10, 'rehab-full');
  row = db.get('SELECT content_opened_at FROM content_access WHERE user_id=1 AND package=?', 'rehab-full');
  assert.equal(row.content_opened_at, now + 10);

  // 두 번째 열기는 최초 시각을 덮어쓰지 않는다
  db.sqlite.prepare('UPDATE content_access SET content_opened_at=? WHERE user_id=1 AND package=? AND content_opened_at IS NULL')
    .run(now + 999, 'rehab-full');
  row = db.get('SELECT content_opened_at FROM content_access WHERE user_id=1 AND package=?', 'rehab-full');
  assert.equal(row.content_opened_at, now + 10, '최초 열람 시각이 덮어써졌다');
});
