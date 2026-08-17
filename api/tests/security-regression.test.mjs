import assert from 'node:assert/strict';
import test from 'node:test';

import worker, { maskIdNumbers as maskServerIdNumbers } from '../src/index.js';
// CI가 이 파일을 명시 실행하므로 주문별 결제 원장 회귀군도 함께 등록한다.
import './payment-ledger.test.mjs';

const TOKEN = 'A'.repeat(43);
const ORIGIN = 'https://chamroad.com';

class FakeStatement {
  constructor(db, sql) {
    this.db = db;
    this.sql = sql.replace(/\s+/g, ' ').trim();
    this.args = [];
  }

  bind(...args) {
    this.args = args;
    return this;
  }

  first() { return this.db.execute(this, 'first'); }
  all() { return this.db.execute(this, 'all'); }
  run() { return this.db.execute(this, 'run'); }
}

class FakeD1 {
  constructor({ entitled = true, entitlements } = {}) {
    this.entitlements = entitlements || (entitled ? ['rehab-full'] : []);
    this.access = new Map();
    this.userData = new Map();
    this.calls = [];
    this.batchCount = 0;
  }

  prepare(sql) { return new FakeStatement(this, sql); }

  async batch(statements) {
    this.batchCount++;
    const snapshotAccess = new Map(this.access);
    const snapshotData = new Map(this.userData);
    try {
      const out = [];
      for (const statement of statements) out.push(await this.execute(statement, 'batch'));
      return out;
    } catch (error) {
      this.access = snapshotAccess;
      this.userData = snapshotData;
      throw error;
    }
  }

  async execute(statement, mode) {
    const { sql, args } = statement;
    this.calls.push({ sql, args, mode });

    if (sql.includes('FROM sessions s JOIN users u')) {
      return {
        token_hash: 'hash', expires_at: Date.now() + 60_000, id: 7,
        email: 'user@example.com', name: '테스트', created_at: Date.now(),
        email_verified: 1, phone: null, phone_verified: 0, sensitive_consent_at: null,
      };
    }

    if (sql.includes('FROM entitlement_grants') && sql.includes('GROUP BY package')) {
      return {
        results: this.entitlements.map(pkg => ({
          package: pkg, expires_at: Date.now() + 60_000, ai_quota: 8, ai_used: 0,
        })),
      };
    }

    if (sql.startsWith('INSERT OR IGNORE INTO content_access')) {
      const [userId, pkg, firstAccessAt] = args;
      const key = `${userId}:${pkg}`;
      if (!this.access.has(key)) this.access.set(key, firstAccessAt);
      return { success: true, meta: { changes: 1 } };
    }

    if (sql.startsWith('SELECT first_access_at FROM content_access')) {
      const firstAccessAt = this.access.get(`${args[0]}:${args[1]}`);
      const row = firstAccessAt ? { first_access_at: firstAccessAt } : null;
      return mode === 'batch' ? { results: row ? [row] : [] } : row;
    }

    if (sql.startsWith('SELECT package FROM content_access')) {
      const userPrefix = `${args[0]}:`;
      return {
        results: [...this.access.keys()]
          .filter(key => key.startsWith(userPrefix))
          .map(key => ({ package: key.slice(userPrefix.length) })),
      };
    }

    if (sql.startsWith('INSERT INTO user_data')) {
      this.userData.set(`${args[0]}:${args[1]}`, args[2]);
      return { success: true, meta: { changes: 1 } };
    }

    if (sql.startsWith('DELETE FROM user_data')) {
      if (args.length >= 2) this.userData.delete(`${args[0]}:${args[1]}`);
      return { success: true, meta: { changes: 1 } };
    }

    if (sql.startsWith('DELETE FROM ai_usage')) {
      return { success: true, meta: { changes: 1 } };
    }

    throw new Error(`Unexpected fake-D1 query (${mode}): ${sql}`);
  }
}

function env(db = new FakeD1()) {
  return { DB: db, PEPPER: 'test-pepper' };
}

function request(path, { method = 'GET', body, token = TOKEN } = {}) {
  const headers = { Origin: ORIGIN };
  if (token !== null) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  return new Request(`https://api.chamroad.com${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

test('API responses carry private-cache and browser hardening headers', async () => {
  const response = await worker.fetch(request('/api/content/steps?type=rehab'), env());
  assert.equal(response.status, 409);
  assert.match(response.headers.get('cache-control') || '', /no-store/);
  assert.equal(response.headers.get('vary'), 'Origin');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
  assert.equal(response.headers.get('access-control-allow-origin'), ORIGIN);
});

test('signup rejects the former bundled consent and requires the split consent contract', async () => {
  const db = new FakeD1();
  const response = await worker.fetch(request('/api/auth/signup', {
    method: 'POST',
    token: null,
    body: {
      name: '테스트', email: 'new@example.com', password: 'Strong!234', agree: true,
    },
  }), env(db));
  const payload = await response.json();
  assert.equal(response.status, 400);
  assert.match(payload.error, /만 14세 이상/);
  assert.equal(db.calls.length, 0);
});

test('legacy automatic GET never returns or consumes paid content', async () => {
  const db = new FakeD1();
  const response = await worker.fetch(request('/api/content/steps?type=rehab'), env(db));
  const payload = await response.json();
  assert.equal(response.status, 409);
  assert.equal(payload.code, 'EXPLICIT_CONTENT_OPEN_REQUIRED');
  assert.equal(payload.requiredEndpoint, '/api/content/open');
  assert.equal(payload.steps, undefined);
  assert.equal(db.access.size, 0);
  assert.equal(db.calls.length, 0);
});

test('content open requires the exact explicit consent contract', async () => {
  const db = new FakeD1();
  const response = await worker.fetch(request('/api/content/open', {
    method: 'POST', body: { type: 'rehab', consent: true, consentVersion: 'old-version' },
  }), env(db));
  const payload = await response.json();
  assert.equal(response.status, 400);
  assert.equal(payload.code, 'CONTENT_OPEN_CONSENT_REQUIRED');
  assert.equal(db.access.size, 0);
});

test('explicit content open records consumption transactionally before returning body', async () => {
  const db = new FakeD1();
  const response = await worker.fetch(request('/api/content/open', {
    method: 'POST',
    body: { type: 'rehab', consent: true, consentVersion: 'content-open-v1' },
  }), env(db));
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.ok(Array.isArray(payload.steps));
  assert.ok(payload.steps.length > 0);
  assert.equal(typeof payload.firstAccessAt, 'number');
  assert.equal(db.batchCount, 1);
  assert.equal(db.access.get('7:rehab-full'), payload.firstAccessAt);
});

test('maintenance content consumes the active maintain entitlement only after explicit open', async () => {
  const db = new FakeD1({ entitlements: ['maintain'] });
  const response = await worker.fetch(request('/api/content/open', {
    method: 'POST',
    body: { type: 'maintain', consent: true, consentVersion: 'content-open-v1' },
  }), env(db));
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.contentType, 'maintain');
  assert.equal(payload.consumedPackage, 'maintain');
  assert.ok(payload.steps.length > 0);
  assert.ok(payload.docExamples.length > 0);
  assert.equal(db.access.has('7:maintain'), true);
});

test('an unrelated entitlement cannot open maintenance content', async () => {
  const db = new FakeD1({ entitlements: ['rehab-full'] });
  const response = await worker.fetch(request('/api/content/open', {
    method: 'POST',
    body: { type: 'maintain', consent: true, consentVersion: 'content-open-v1' },
  }), env(db));
  assert.equal(response.status, 403);
  assert.equal(db.access.size, 0);
});

test('supplement content records the correction entitlement actually held', async () => {
  const db = new FakeD1({ entitlements: ['correction-rehab'] });
  const response = await worker.fetch(request('/api/content/open', {
    method: 'POST',
    body: { type: 'supplement-rehab', consent: true, consentVersion: 'content-open-v1' },
  }), env(db));
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.consumedPackage, 'correction-rehab');
  assert.equal(db.access.has('7:correction-rehab'), true);
  assert.equal(db.access.has('7:rehab-full'), false);
});

test('bankruptcy supplement records the active bankruptcy correction entitlement', async () => {
  const db = new FakeD1({ entitlements: ['correction-bankrupt'] });
  const response = await worker.fetch(request('/api/content/open', {
    method: 'POST',
    body: { type: 'supplement-bankrupt', consent: true, consentVersion: 'content-open-v1' },
  }), env(db));
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.contentType, 'supplement-bankrupt');
  assert.equal(payload.consumedPackage, 'correction-bankrupt');
  assert.equal(db.access.has('7:correction-bankrupt'), true);
  assert.equal(db.access.has('7:bankrupt-full'), false);
});

test('supplement with two entitlements reuses an already-consumed package', async () => {
  const db = new FakeD1({ entitlements: ['rehab-full', 'correction-rehab'] });
  db.access.set('7:correction-rehab', 123456);
  const response = await worker.fetch(request('/api/content/open', {
    method: 'POST',
    body: { type: 'supplement-rehab', consent: true, consentVersion: 'content-open-v1' },
  }), env(db));
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.consumedPackage, 'correction-rehab');
  assert.equal(payload.firstAccessAt, 123456);
  assert.equal(db.access.has('7:rehab-full'), false);
});

test('deprecated access beacon is read-only and cannot establish refund consumption', async () => {
  const db = new FakeD1();
  const response = await worker.fetch(request('/api/content/access', {
    method: 'POST', body: { package: 'rehab-full' },
  }), env(db));
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.deprecated, true);
  assert.equal(payload.recorded, false);
  assert.equal(db.access.size, 0);
  assert.equal(db.calls.some(call => call.sql.startsWith('INSERT OR IGNORE INTO content_access')), false);
});

test('sync rejects unknown keys and never writes them', async () => {
  const db = new FakeD1();
  const response = await worker.fetch(request('/api/data/sync', {
    method: 'POST', body: { put: { attacker_controlled_key: { value: 'x' } }, del: [] },
  }), env(db));
  assert.equal(response.status, 400);
  assert.equal(db.userData.size, 0);
  assert.equal(db.batchCount, 0);
});

test('sync strips sensitive and prototype-shaped fields recursively before storage', async () => {
  const db = new FakeD1();
  const response = await worker.fetch(request('/api/data/sync', {
    method: 'POST',
    body: {
      put: {
        diagnosis_data: {
          income: 2_000_000,
          hasHealthIssues: true,
          nested: { debt_causes: '도박', constructor: { polluted: true }, safe: 'ok' },
        },
      },
      del: [],
    },
  }), env(db));
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.droppedSensitiveFields, 3);
  const stored = JSON.parse(db.userData.get('7:diagnosis_data'));
  assert.deepEqual(stored, { income: 2_000_000, nested: { safe: 'ok' } });
});

test('sync masks line-broken identifiers before JSON serialization', async () => {
  const db = new FakeD1();
  const response = await worker.fetch(request('/api/data/sync', {
    method: 'POST',
    body: {
      put: { diagnosis_data: { note: '주민등록번호: 900101\n1234567' } },
      del: [],
    },
  }), env(db));
  assert.equal(response.status, 200);
  const serialized = db.userData.get('7:diagnosis_data');
  assert.ok(!serialized.includes('900101'));
  assert.deepEqual(JSON.parse(serialized), { note: '주민등록번호: ○○○○○○-○○○○○○○' });
});

test('legacy score and level writes are accepted for rollout compatibility but deleted instead of stored', async () => {
  const db = new FakeD1();
  db.userData.set('7:diagnosis_scores', JSON.stringify({ rehab: 99 }));
  db.userData.set('7:diagnosis_levels', JSON.stringify({ rehab: 'high' }));
  const response = await worker.fetch(request('/api/data/sync', {
    method: 'POST',
    body: {
      put: {
        diagnosis_scores: { rehab: 100 },
        diagnosis_levels: { rehab: 'winner' },
      },
      del: [],
    },
  }), env(db));
  assert.equal(response.status, 200);
  assert.equal(db.userData.has('7:diagnosis_scores'), false);
  assert.equal(db.userData.has('7:diagnosis_levels'), false);
});

test('oversized/invalid bearer tokens are rejected before a database lookup', async () => {
  const db = new FakeD1();
  const response = await worker.fetch(request('/api/auth/me', { token: 'A'.repeat(5000) }), env(db));
  assert.equal(response.status, 401);
  assert.equal(db.calls.length, 0);
});

test('server masks spaced, dotted and line-broken resident identifiers without corrupting amount lists', () => {
  assert.equal(maskServerIdNumbers('900101 1234568'), '○○○○○○-○○○○○○○');
  assert.equal(maskServerIdNumbers('900101.1234568'), '○○○○○○-○○○○○○○');
  assert.equal(maskServerIdNumbers('900101 5234561'), '○○○○○○-○○○○○○○');
  assert.equal(maskServerIdNumbers('900101 1234567'), '○○○○○○-○○○○○○○');
  assert.match(maskServerIdNumbers('주민등록번호: 900101\n1234567'), /○○○○○○-○○○○○○○/);
  assert.match(maskServerIdNumbers('외국인 등록 번호 900101 \n 5234567'), /○○○○○○-○○○○○○○/);
  assert.equal(maskServerIdNumbers('잔액 500000 1200000원'), '잔액 500000 1200000원');
  assert.equal(maskServerIdNumbers('원금 500000\n- 1234567원'), '원금 500000\n- 1234567원');
});
