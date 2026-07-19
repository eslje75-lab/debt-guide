/**
 * 챔로드 백엔드 API — Cloudflare Worker + D1
 *
 * Phase 1: 회원·인증
 *   POST /api/auth/signup           {name, email, password}
 *   POST /api/auth/login            {email, password, remember}
 *   POST /api/auth/logout           (Authorization: Bearer <token>)
 *   GET  /api/auth/me               (Authorization: Bearer <token>)
 *   POST /api/auth/change-password  (Bearer) {currentPassword, newPassword}
 *
 * 보안 설계:
 *   - 비밀번호: PBKDF2-SHA256(iterations 아래 상수) + 서버 시크릿(PEPPER) HMAC 프리해시
 *   - 세션: 32바이트 랜덤 토큰. DB에는 SHA-256 해시만 저장 (DB 유출 시에도 토큰 무효)
 *   - 이름+이메일만으로 비밀번호 재설정은 계정 탈취 경로라 서버에서는 제공하지 않음
 *     (이메일 인증 링크 방식은 이메일 발송 연동 시 구현)
 */

const PBKDF2_ITERATIONS = 100000;
const SALT_BYTES = 16;
const TOKEN_BYTES = 32;
const DAY_MS = 86400000;
const MAX_BODY_BYTES = 10 * 1024;

// 사용자 데이터 동기화(Phase 2) 한도
const MAX_KEY_LEN = 64;
const MAX_VALUE_BYTES = 100 * 1024;   // 값 1개(JSON 문자열) 최대
const MAX_SYNC_KEYS = 60;             // 한 요청당 처리 키 수
const DATA_BODY_BYTES = 512 * 1024;   // /api/data/sync 본문 최대

// AI 서류검토(Phase 3)
const AI_MODEL = 'claude-sonnet-5';   // 검증됨(2026-07-19). 주의: 이 계열은 assistant 프리필 미지원 → messages는 user로 끝나야 함
const ANTHROPIC_VERSION = '2023-06-01';
const AI_MAX_TOKENS = 1024;
const DAILY_AI_LIMIT = 30;            // 사용자당 1일 검토 횟수(비용·남용 방지)
const AI_TEXT_MIN = 30;
const AI_TEXT_MAX = 6000;
const AI_BODY_BYTES = 32 * 1024;

// 결제(Phase 4, 포트원 PortOne V2). 금액은 이 표가 소스 오브 트루스 — 클라이언트 금액 신뢰 안 함.
const PACKAGES = {
  'rehab-full':          { name: '회생 완주 패키지',     amount: 149000, type: 'rehab' },
  'maintain':            { name: '변제기간 관리 패키지',   amount: 29000,  type: 'rehab' },
  'correction-rehab':    { name: '보정권고 추가 대응',     amount: 19000,  type: 'rehab' },
  'bankrupt-full':       { name: '파산 완주 패키지',       amount: 49000,  type: 'bankrupt' },
  'correction-bankrupt': { name: '보정명령 추가 대응',     amount: 19000,  type: 'bankrupt' },
};

// CORS 허용 오리진 — GitHub Pages 프로덕션 + 로컬 개발 서버
const ALLOWED_ORIGINS = new Set([
  'https://eslje75-lab.github.io',
  'http://localhost:3456',
  'http://127.0.0.1:3456',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
]);

/* ── 유틸 ── */

const enc = new TextEncoder();

function b64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}
function b64decode(s) {
  return Uint8Array.from(atob(s), c => c.charCodeAt(0));
}
function b64url(buf) {
  return b64(buf).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function hex(buf) {
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function sha256hex(s) {
  return hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));
}

/** PEPPER(서버 시크릿)로 비밀번호를 HMAC 프리해시 — DB 단독 유출 시 오프라인 크래킹 차단 */
async function pepperedPassword(password, pepper) {
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(pepper), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(password)));
}

async function pbkdf2(passwordBytes, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', passwordBytes, 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256
  );
}

async function hashPassword(password, pepper) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const peppered = await pepperedPassword(password, pepper);
  const derived = await pbkdf2(peppered, salt, PBKDF2_ITERATIONS);
  return `v1$${PBKDF2_ITERATIONS}$${b64(salt)}$${b64(derived)}`;
}

async function verifyPassword(password, stored, pepper) {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'v1') return false;
  const iterations = parseInt(parts[1], 10);
  const salt = b64decode(parts[2]);
  const expected = b64decode(parts[3]);
  const peppered = await pepperedPassword(password, pepper);
  const derived = new Uint8Array(await pbkdf2(peppered, salt, iterations));
  if (derived.byteLength !== expected.byteLength) return false;
  return crypto.subtle.timingSafeEqual(derived, expected);
}

/* ── 응답 헬퍼 ── */

function corsHeaders(origin) {
  const h = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
  if (origin && ALLOWED_ORIGINS.has(origin)) h['Access-Control-Allow-Origin'] = origin;
  return h;
}

function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders(origin) },
  });
}
const ok = (data, origin) => json({ ok: true, ...data }, 200, origin);
const err = (status, message, origin) => json({ ok: false, error: message }, status, origin);

async function readJson(request, maxBytes = MAX_BODY_BYTES) {
  const len = parseInt(request.headers.get('Content-Length') || '0', 10);
  if (len > maxBytes) return null;
  try { return await request.json(); } catch { return null; }
}

/* ── 세션 ── */

async function createSession(db, userId, remember) {
  const token = b64url(crypto.getRandomValues(new Uint8Array(TOKEN_BYTES)));
  const tokenHash = await sha256hex(token);
  const expiresAt = Date.now() + (remember ? 30 : 1) * DAY_MS;
  await db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(tokenHash, userId, expiresAt).run();
  return { token, expiresAt };
}

async function getSessionUser(db, request) {
  const auth = request.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7).trim();
  if (!token) return null;
  const tokenHash = await sha256hex(token);
  const row = await db.prepare(
    `SELECT s.token_hash, s.expires_at, u.id, u.email, u.name, u.created_at
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ?`
  ).bind(tokenHash).first();
  if (!row) return null;
  if (Date.now() > row.expires_at) {
    await db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash).run();
    return null;
  }
  return row;
}

/* ── 입력 검증 (프론트 mock과 동일 기준 + 이메일 형식 강화) ── */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// 비밀번호 정책: 8자 이상 + 영문·숫자·특수문자 포함. 위반 시 사유 문자열, 통과 시 null.
function passwordError(pw) {
  pw = pw || '';
  if (pw.length < 8) return '비밀번호는 8자 이상이어야 합니다.';
  if (pw.length > 128) return '비밀번호는 128자 이하로 입력해주세요.';
  if (!/[A-Za-z]/.test(pw)) return '비밀번호에 영문자를 포함해주세요.';
  if (!/[0-9]/.test(pw)) return '비밀번호에 숫자를 포함해주세요.';
  if (!/[^A-Za-z0-9]/.test(pw)) return '비밀번호에 특수문자(!@#$ 등)를 포함해주세요.';
  return null;
}

function validateSignup(body) {
  const name = (body.name || '').trim();
  const email = (body.email || '').toLowerCase().trim();
  const password = body.password || '';
  if (!name) return { error: '이름을 입력해주세요.' };
  if (name.length > 50) return { error: '이름은 50자 이하로 입력해주세요.' };
  if (!EMAIL_RE.test(email) || email.length > 254) return { error: '올바른 이메일 주소를 입력해주세요.' };
  const pwErr = passwordError(password);
  if (pwErr) return { error: pwErr };
  return { name, email, password };
}

/* ── 라우트 핸들러 ── */

async function handleSignup(request, env, origin) {
  const body = await readJson(request);
  if (!body) return err(400, '잘못된 요청입니다.', origin);
  const v = validateSignup(body);
  if (v.error) return err(400, v.error, origin);

  const exists = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(v.email).first();
  if (exists) return err(409, '이미 사용 중인 이메일입니다.', origin);

  const passwordHash = await hashPassword(v.password, env.PEPPER);
  const res = await env.DB.prepare(
    'INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)'
  ).bind(v.email, v.name, passwordHash).run();

  const userId = res.meta.last_row_id;
  const session = await createSession(env.DB, userId, false);
  return ok({
    token: session.token,
    user: { email: v.email, name: v.name, expiresAt: session.expiresAt },
  }, origin);
}

async function handleLogin(request, env, origin) {
  const body = await readJson(request);
  if (!body) return err(400, '잘못된 요청입니다.', origin);
  const email = (body.email || '').toLowerCase().trim();
  const password = body.password || '';
  const remember = !!body.remember;

  const user = await env.DB.prepare(
    'SELECT id, email, name, password_hash FROM users WHERE email = ?'
  ).bind(email).first();

  // 사용자 없음/비밀번호 불일치를 같은 메시지로 — 이메일 존재 여부 노출 방지
  const FAIL = '이메일 또는 비밀번호가 올바르지 않습니다.';
  if (!user) return err(401, FAIL, origin);
  const valid = await verifyPassword(password, user.password_hash, env.PEPPER);
  if (!valid) return err(401, FAIL, origin);

  const session = await createSession(env.DB, user.id, remember);
  return ok({
    token: session.token,
    user: { email: user.email, name: user.name, expiresAt: session.expiresAt },
  }, origin);
}

async function handleLogout(request, env, origin) {
  const auth = request.headers.get('Authorization') || '';
  if (auth.startsWith('Bearer ')) {
    const tokenHash = await sha256hex(auth.slice(7).trim());
    await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash).run();
  }
  return ok({}, origin);
}

async function handleMe(request, env, origin) {
  const session = await getSessionUser(env.DB, request);
  if (!session) return err(401, '로그인이 필요합니다.', origin);
  return ok({
    user: { email: session.email, name: session.name, expiresAt: session.expires_at },
  }, origin);
}

async function handleChangePassword(request, env, origin) {
  const session = await getSessionUser(env.DB, request);
  if (!session) return err(401, '로그인이 필요합니다.', origin);
  const body = await readJson(request);
  if (!body) return err(400, '잘못된 요청입니다.', origin);
  const current = body.currentPassword || '';
  const next = body.newPassword || '';
  const pwErr = passwordError(next);
  if (pwErr) return err(400, pwErr, origin);

  const user = await env.DB.prepare('SELECT password_hash FROM users WHERE id = ?')
    .bind(session.id).first();
  const valid = await verifyPassword(current, user.password_hash, env.PEPPER);
  if (!valid) return err(401, '현재 비밀번호가 올바르지 않습니다.', origin);

  const newHash = await hashPassword(next, env.PEPPER);
  await env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
    .bind(newHash, session.id).run();
  // 다른 기기 세션 전부 무효화 (현재 세션만 유지)
  await env.DB.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash != ?')
    .bind(session.id, session.token_hash).run();
  return ok({}, origin);
}

/* ── 사용자 데이터 저장 (Phase 2: 진단·plan·진행률 등) ── */
// 프론트 Storage(cdg_* 키)를 서버에 미러링. 값은 JSON 문자열로 보관.
// 로그인 사용자만. auth 키(cdg_auth*)는 프론트에서 동기화 대상에서 제외됨.

async function handleGetData(request, env, origin) {
  const session = await getSessionUser(env.DB, request);
  if (!session) return err(401, '로그인이 필요합니다.', origin);
  const rows = await env.DB.prepare('SELECT key, value FROM user_data WHERE user_id = ?')
    .bind(session.id).all();
  const data = {};
  for (const r of (rows.results || [])) {
    try { data[r.key] = JSON.parse(r.value); } catch { /* 손상 값은 건너뜀 */ }
  }
  return ok({ data }, origin);
}

async function handleSyncData(request, env, origin) {
  const session = await getSessionUser(env.DB, request);
  if (!session) return err(401, '로그인이 필요합니다.', origin);
  const body = await readJson(request, DATA_BODY_BYTES);
  if (!body) return err(400, '잘못된 요청이거나 용량이 초과되었습니다.', origin);

  const put = (body.put && typeof body.put === 'object' && !Array.isArray(body.put)) ? body.put : {};
  const del = Array.isArray(body.del) ? body.del : [];
  const clearAll = body.clearAll === true;

  const putKeys = Object.keys(put);
  if (putKeys.length + del.length > MAX_SYNC_KEYS)
    return err(400, '한 번에 동기화할 항목이 너무 많습니다.', origin);

  const now = Date.now();
  const stmts = [];

  if (clearAll) {
    stmts.push(env.DB.prepare('DELETE FROM user_data WHERE user_id = ?').bind(session.id));
  }
  for (const k of putKeys) {
    if (typeof k !== 'string' || k.length === 0 || k.length > MAX_KEY_LEN) continue;
    let serialized;
    try { serialized = JSON.stringify(put[k]); } catch { continue; }
    if (serialized == null) continue;                      // undefined 값은 스킵
    if (serialized.length > MAX_VALUE_BYTES)
      return err(413, '저장 용량이 초과되었습니다.', origin);
    stmts.push(env.DB.prepare(
      `INSERT INTO user_data (user_id, key, value, updated_at) VALUES (?1, ?2, ?3, ?4)
       ON CONFLICT(user_id, key) DO UPDATE SET value = ?3, updated_at = ?4`
    ).bind(session.id, k, serialized, now));
  }
  for (const k of del) {
    if (typeof k !== 'string' || !k) continue;
    stmts.push(env.DB.prepare('DELETE FROM user_data WHERE user_id = ? AND key = ?')
      .bind(session.id, k));
  }

  if (stmts.length) await env.DB.batch(stmts);   // D1 batch = 트랜잭션
  return ok({}, origin);
}

/* ── AI 서류검토 (Phase 3) ── */
// 실제 Claude API 호출. 법률 자문·결과 예측 금지, '서류 완성도 점검'으로만 제약.

const AI_SYSTEM_PROMPT = `당신은 대한민국 개인회생·파산 절차의 '서류 형식 점검 보조자'다. 사용자가 직접 작성한 법원 제출용 서류 초안을 검토한다.

절대 원칙(위반 금지):
1. 법률 자문·법률 상담·법률 대리를 제공하지 않는다. 당신은 변호사·법무사가 아니다.
2. 사건 결과(면책 여부, 인가 여부, 성공 가능성)를 예측하거나 단정하지 않는다.
3. "이렇게 하면 면책된다/기각된다" 같은 법적 결론을 내리지 않는다.
4. 오직 서류의 '완성도'만 본다: 필수 항목 누락, 내용의 불명확·모호, 숫자·날짜의 내부 불일치, 형식 미비, 개인정보(주민번호 등) 노출.
5. 확실하지 않으면 단정하지 말고 "확인 권장"으로 표현한다. 추측으로 사실을 만들지 않는다.
6. 모든 출력은 한국어. 실용적이고 차분한 톤. 사용자를 불안하게 하지 않는다.

반드시 아래 JSON 객체로만 응답한다. JSON 외 다른 텍스트를 절대 출력하지 않는다:
{
  "summary": "1~2문장 총평(법적 결론·예측 금지)",
  "issues": [{"severity": "high|medium|low", "message": "구체적 지적"}],
  "confirmed": ["잘 갖춰진 항목 요약"],
  "suggestions": ["개선 제안(형식·완성도 관점)"]
}`;

async function callClaude(apiKey, docLabel, checklist, text) {
  const userMsg =
    `검토 대상 서류: ${docLabel}\n` +
    (checklist && checklist.length ? `이 서류에 일반적으로 포함되는 항목(참고): ${checklist.join(', ')}\n` : '') +
    `\n아래는 사용자가 작성한 초안이다. 완성도 관점에서 검토하라.\n\n---\n${text}\n---`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: AI_MODEL,
      max_tokens: AI_MAX_TOKENS,
      system: AI_SYSTEM_PROMPT,
      messages: [
        { role: 'user', content: userMsg },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`anthropic ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  // text 블록만 추출(thinking 블록 등 대비)
  const raw = (Array.isArray(data.content) ? data.content.find(c => c.type === 'text')?.text : '') || '';
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // 코드펜스·서두 텍스트가 섞인 경우 첫 {...} 블록 추출 재시도
    const m = raw.match(/\{[\s\S]*\}/);
    parsed = m ? JSON.parse(m[0]) : { summary: '검토 결과를 형식화하지 못했습니다. 다시 시도해주세요.', issues: [], confirmed: [], suggestions: [] };
  }
  // 스키마 방어
  return {
    summary: typeof parsed.summary === 'string' ? parsed.summary : '',
    issues: Array.isArray(parsed.issues) ? parsed.issues.filter(i => i && typeof i.message === 'string')
      .map(i => ({ severity: ['high', 'medium', 'low'].includes(i.severity) ? i.severity : 'medium', message: i.message })) : [],
    confirmed: Array.isArray(parsed.confirmed) ? parsed.confirmed.filter(s => typeof s === 'string') : [],
    suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.filter(s => typeof s === 'string') : [],
  };
}

async function handleAiReview(request, env, origin) {
  const session = await getSessionUser(env.DB, request);
  if (!session) return err(401, '로그인이 필요합니다.', origin);
  if (!env.ANTHROPIC_API_KEY)
    return err(503, 'AI 검토 기능이 아직 준비 중입니다. 잠시 후 다시 시도해주세요.', origin);

  const body = await readJson(request, AI_BODY_BYTES);
  if (!body) return err(400, '잘못된 요청입니다.', origin);
  const docLabel = typeof body.docLabel === 'string' ? body.docLabel.slice(0, 100) : '서류';
  const checklist = Array.isArray(body.checklist)
    ? body.checklist.filter(s => typeof s === 'string').slice(0, 20) : [];
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (text.length < AI_TEXT_MIN) return err(400, '검토할 내용을 30자 이상 입력해주세요.', origin);
  if (text.length > AI_TEXT_MAX) return err(413, '입력이 너무 깁니다. 서류를 나누어 검토해주세요.', origin);

  // 일일 사용량 제한
  const day = new Date().toISOString().slice(0, 10);
  const row = await env.DB.prepare('SELECT count FROM ai_usage WHERE user_id = ? AND day = ?')
    .bind(session.id, day).first();
  const used = row ? row.count : 0;
  if (used >= DAILY_AI_LIMIT)
    return err(429, `오늘 이용 가능한 검토 횟수(${DAILY_AI_LIMIT}회)를 모두 사용했습니다. 내일 다시 이용해주세요.`, origin);

  let review;
  try {
    review = await callClaude(env.ANTHROPIC_API_KEY, docLabel, checklist, text);
  } catch (e) {
    console.error('ai review failed', e.message);
    return err(502, 'AI 검토 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.', origin);
  }

  // 성공 시에만 사용량 증가
  await env.DB.prepare(
    `INSERT INTO ai_usage (user_id, day, count) VALUES (?1, ?2, 1)
     ON CONFLICT(user_id, day) DO UPDATE SET count = count + 1`
  ).bind(session.id, day).run();

  return ok({ review, usage: { used: used + 1, limit: DAILY_AI_LIMIT } }, origin);
}

/* ── 결제 (Phase 4: 포트원 PortOne V2) ── */
// 흐름: prepare(서버가 주문·금액 확정) → 브라우저 PortOne.requestPayment → complete(서버가 포트원 조회로 금액·상태 검증 후 패키지 부여)

async function handlePaymentPrepare(request, env, origin) {
  const session = await getSessionUser(env.DB, request);
  if (!session) return err(401, '로그인이 필요합니다.', origin);
  if (!env.PORTONE_STORE_ID || !env.PORTONE_CHANNEL_KEY)
    return err(503, '결제 기능이 아직 준비 중입니다.', origin);
  const body = await readJson(request);
  const pkgKey = body && typeof body.package === 'string' ? body.package : '';
  const pkg = PACKAGES[pkgKey];
  if (!pkg) return err(400, '알 수 없는 상품입니다.', origin);

  const paymentId = 'chamroad-' + crypto.randomUUID();
  await env.DB.prepare(
    'INSERT INTO payments (payment_id, user_id, package, amount, status, created_at) VALUES (?,?,?,?,?,?)'
  ).bind(paymentId, session.id, pkgKey, pkg.amount, 'pending', Date.now()).run();

  return ok({
    paymentId,
    amount: pkg.amount,
    orderName: pkg.name,
    storeId: env.PORTONE_STORE_ID,
    channelKey: env.PORTONE_CHANNEL_KEY,
  }, origin);
}

// 검증된 결제 후 패키지를 user_data(plan*)에 부여. 부가옵션(correction-*)은 대표 패키지를 덮지 않음.
async function grantPackage(env, userId, pkgKey) {
  const info = PACKAGES[pkgKey];
  const rows = await env.DB.prepare(
    "SELECT key, value FROM user_data WHERE user_id = ? AND key IN ('plan_packages','plan_package')"
  ).bind(userId).all();
  const cur = {};
  for (const r of (rows.results || [])) { try { cur[r.key] = JSON.parse(r.value); } catch {} }

  const owned = Array.isArray(cur.plan_packages) ? cur.plan_packages.slice() : [];
  if (!owned.includes(pkgKey)) owned.push(pkgKey);

  const isAddon = pkgKey.startsWith('correction-');
  const prevIsMain = cur.plan_package && !String(cur.plan_package).startsWith('correction-');

  const puts = { plan: 'premium', plan_packages: owned };
  if (!(isAddon && prevIsMain)) {
    puts.plan_type = info.type;
    puts.plan_package = pkgKey;
    puts.plan_package_name = info.name;
  }
  const now = Date.now();
  const stmts = Object.entries(puts).map(([k, v]) =>
    env.DB.prepare(
      `INSERT INTO user_data (user_id, key, value, updated_at) VALUES (?1, ?2, ?3, ?4)
       ON CONFLICT(user_id, key) DO UPDATE SET value = ?3, updated_at = ?4`
    ).bind(userId, k, JSON.stringify(v), now));
  await env.DB.batch(stmts);
  return puts;   // 클라이언트가 localStorage에 즉시 반영
}

async function handlePaymentComplete(request, env, origin) {
  const session = await getSessionUser(env.DB, request);
  if (!session) return err(401, '로그인이 필요합니다.', origin);
  if (!env.PORTONE_API_SECRET)
    return err(503, '결제 기능이 아직 준비 중입니다.', origin);
  const body = await readJson(request);
  const paymentId = body && typeof body.paymentId === 'string' ? body.paymentId : '';
  if (!paymentId) return err(400, '결제 정보가 없습니다.', origin);

  // 본인 주문만
  const order = await env.DB.prepare('SELECT * FROM payments WHERE payment_id = ? AND user_id = ?')
    .bind(paymentId, session.id).first();
  if (!order) return err(404, '결제 주문을 찾을 수 없습니다.', origin);
  if (order.status === 'paid') {
    // 멱등: 이미 확정된 주문이면 재부여 없이 성공 응답
    return ok({ granted: { plan: 'premium', plan_package: order.package, plan_package_name: PACKAGES[order.package]?.name }, alreadyPaid: true }, origin);
  }

  // 포트원 결제 조회
  let payment;
  try {
    const r = await fetch(`https://api.portone.io/payments/${encodeURIComponent(paymentId)}`, {
      headers: { Authorization: `PortOne ${env.PORTONE_API_SECRET}` },
    });
    if (!r.ok) throw new Error('portone lookup ' + r.status + ' ' + (await r.text().catch(() => '')).slice(0, 150));
    payment = await r.json();
  } catch (e) {
    console.error('payment lookup failed', e.message);
    return err(502, '결제 확인 중 오류가 발생했습니다. 결제가 되었다면 잠시 후 마이페이지에서 확인됩니다.', origin);
  }

  // 검증: 상태 PAID + 금액 일치(위변조 방지)
  if (payment.status !== 'PAID') {
    await env.DB.prepare('UPDATE payments SET status = ? WHERE payment_id = ?').bind('failed', paymentId).run();
    return err(400, '결제가 완료되지 않았습니다.', origin);
  }
  if (!payment.amount || payment.amount.total !== order.amount) {
    await env.DB.prepare('UPDATE payments SET status = ? WHERE payment_id = ?').bind('failed', paymentId).run();
    console.error('amount mismatch', paymentId, payment.amount?.total, 'expected', order.amount);
    return err(400, '결제 금액이 일치하지 않습니다. 결제가 진행되었다면 문의해주세요.', origin);
  }

  await env.DB.prepare('UPDATE payments SET status = ?, paid_at = ? WHERE payment_id = ?')
    .bind('paid', Date.now(), paymentId).run();
  const granted = await grantPackage(env, session.id, order.package);
  return ok({ granted }, origin);
}

/* ── 관리자 (운영자 전용 대시보드) ── */
// 접근 권한: 로그인 세션의 이메일이 ADMIN_EMAIL과 일치할 때만.

async function requireAdmin(db, request, env) {
  const session = await getSessionUser(db, request);
  if (!session) return null;
  if (!env.ADMIN_EMAIL || session.email !== env.ADMIN_EMAIL.toLowerCase().trim()) return null;
  return session;
}

async function handleAdminOverview(request, env, origin) {
  const admin = await requireAdmin(env.DB, request, env);
  if (!admin) return err(403, '접근 권한이 없습니다.', origin);

  const userCount = await env.DB.prepare('SELECT COUNT(*) AS c FROM users').first();
  const payStats = await env.DB.prepare(
    "SELECT COUNT(*) AS c, COALESCE(SUM(amount), 0) AS s FROM payments WHERE status = 'paid'"
  ).first();
  const aiStat = await env.DB.prepare('SELECT COALESCE(SUM(count), 0) AS c FROM ai_usage').first();
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayUsers = await env.DB.prepare(
    "SELECT COUNT(*) AS c FROM users WHERE substr(created_at,1,10) = ?"
  ).bind(todayStr).first();

  const recentUsers = await env.DB.prepare(
    'SELECT id, email, name, created_at FROM users ORDER BY id DESC LIMIT 100'
  ).all();
  const recentPayments = await env.DB.prepare(
    `SELECT p.payment_id, p.package, p.amount, p.status, p.created_at, p.paid_at, u.email
     FROM payments p JOIN users u ON u.id = p.user_id
     ORDER BY p.created_at DESC LIMIT 100`
  ).all();

  return ok({
    stats: {
      users: userCount.c,
      todayUsers: todayUsers.c,
      paidCount: payStats.c,
      revenue: payStats.s,
      aiReviews: aiStat.c,
    },
    users: recentUsers.results || [],
    payments: recentPayments.results || [],
  }, origin);
}

/* ── 엔트리 ── */

const ROUTES = {
  'GET /api/admin/overview': handleAdminOverview,
  'POST /api/auth/signup': handleSignup,
  'POST /api/auth/login': handleLogin,
  'POST /api/auth/logout': handleLogout,
  'GET /api/auth/me': handleMe,
  'POST /api/auth/change-password': handleChangePassword,
  'GET /api/data': handleGetData,
  'POST /api/data/sync': handleSyncData,
  'POST /api/ai/review': handleAiReview,
  'POST /api/payment/prepare': handlePaymentPrepare,
  'POST /api/payment/complete': handlePaymentComplete,
};

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (!env.PEPPER) {
      return err(500, '서버 설정 오류(PEPPER 미설정)입니다.', origin);
    }

    const handler = ROUTES[`${request.method} ${url.pathname}`];
    if (!handler) return err(404, '요청한 API를 찾을 수 없습니다.', origin);

    try {
      return await handler(request, env, origin);
    } catch (e) {
      console.error('unhandled', url.pathname, e);
      return err(500, '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.', origin);
    }
  },
};
