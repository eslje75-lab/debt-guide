/**
 * 챔로드 백엔드 API — Cloudflare Worker + D1
 *
 * Phase 1: 회원·인증
 *   POST /api/auth/signup           {name, email, password}
 *   POST /api/auth/login            {email, password, remember}
 *   POST /api/auth/logout           (Authorization: Bearer <token>)
 *   GET  /api/auth/me               (Authorization: Bearer <token>)
 *   POST /api/auth/change-password  (Bearer) {currentPassword, newPassword}
 *   POST /api/auth/delete-account   (Bearer) {password}   — 회원탈퇴(전 데이터 삭제)
 *
 * Phase 5: 이메일 인프라 (발송 = Resend)
 *   POST /api/auth/request-reset        {email}            — 비밀번호 재설정 메일 요청(항상 200, 계정 열거 방지)
 *   POST /api/auth/reset-password       {token, password}  — 토큰으로 새 비밀번호 설정
 *   POST /api/auth/verify-email         {token}            — 가입 이메일 인증 완료
 *   POST /api/auth/resend-verification  (Bearer)           — 인증 메일 재발송
 *
 * 보안 설계:
 *   - 비밀번호: PBKDF2-SHA256(iterations 아래 상수) + 서버 시크릿(PEPPER) HMAC 프리해시
 *   - 세션: 32바이트 랜덤 토큰. DB에는 SHA-256 해시만 저장 (DB 유출 시에도 토큰 무효)
 *   - 비밀번호 재설정: 이메일 인증 링크(일회성 토큰 30분). 토큰도 SHA-256 해시만 저장.
 *     이름+이메일만으로 재설정하는 방식은 계정 탈취 경로라 쓰지 않는다.
 */

// 로그인 무차별 대입 방어 — 윈도우 내 실패 한도 초과 시 잠금.
const LOGIN_MAX_FAILS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;   // 실패 누적 윈도우 15분
const LOGIN_LOCK_MS = 15 * 60 * 1000;     // 초과 시 잠금 15분

const PBKDF2_ITERATIONS = 100000;
const SALT_BYTES = 16;
const TOKEN_BYTES = 32;
const DAY_MS = 86400000;
const MAX_BODY_BYTES = 10 * 1024;

// 이메일 인프라(Phase 5) — 발송(Resend) + 일회성 토큰.
const EMAIL_FROM = '챔로드 <no-reply@chamroad.com>';   // Resend에서 chamroad.com 루트 도메인 인증 필요
const SITE_URL = 'https://chamroad.com';
const RESET_TTL_MS = 30 * 60 * 1000;   // 비밀번호 재설정 토큰 유효 30분
const VERIFY_TTL_MS = 3 * DAY_MS;      // 이메일 인증 토큰 유효 3일
const EMAIL_COOLDOWN_MS = 60 * 1000;   // 같은 목적 재발송 최소 간격(메일 폭탄 방지)

// 자동 가입 방지(Cloudflare Turnstile). 가입은 1건마다 인증메일이 1통 나가므로,
// 제한이 없으면 스크립트로 Resend 일일 한도(약 100통)를 태워 정상 이용자의
// 비밀번호 재설정 메일까지 막을 수 있다. 그 경로를 캡차로 끊는다.
// 시크릿 TURNSTILE_SECRET이 없으면 검증을 건너뛴다(설정 전에도 가입이 막히지 않도록).
// 프론트 사이트 키는 js/main.js의 TURNSTILE_SITE_KEY — 둘 다 설정해야 실제로 작동한다.
const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

// 판매 잠금(서버측). 프론트 js/main.js의 PAYMENTS_ENABLED와 짝이며, API를 직접
// 호출하는 우회를 막는다. ⚠️판매 오픈 시 이 값과 main.js 값을 함께 true로 바꿀 것
// (LAUNCH-CHECKLIST 2단계). 한쪽만 바꾸면 결제가 503으로 막힌다.
const PAYMENTS_ENABLED = false;

// 사업자 신원 — 전자상거래법 제10조(표시)·제13조②(계약내용 서면)에 들어갈 값.
// ⚠️ 사업자등록 후 실값으로 교체할 것. 판매(PAYMENTS_ENABLED)는 사업자등록 후에 열리므로
//    실제 결제·주문확인 메일이 나가는 시점엔 아래가 실값이어야 한다. terms 제11조·privacy 12항과 일치시킬 것.
const BUSINESS_INFO = {
  name:        '(상호: 사업자등록 후 기재)',
  ceo:         '최은식',
  regNo:       '(사업자등록번호: 등록 후 기재)',
  mailOrderNo: '(통신판매업 신고번호: 신고 후 기재 / 면제 시 그 취지)',
  address:     '(사업장 주소: 등록 후 기재)',
  tel:         '(연락처: 등록 후 기재)',
  email:       'eslje75@gmail.com',
};
const REFUND_WINDOW_MS = 14 * DAY_MS;   // 청약철회 기간: 결제일부터 14일(약관 제6조)

// 결제 시 SMS 번호 인증(솔라피). 성인 '검증'은 하지 않고(자기신고), 유료 고객 연락처 진위만 확인.
const OTP_TTL_MS = 3 * 60 * 1000;       // 인증코드 유효 3분(화면 카운트다운과 같은 값이어야 함)
const SIGNUP_VERIFIED_TTL_MS = 30 * 60 * 1000;   // 이메일 인증 후 가입 완료까지 허용 시간
const OTP_COOLDOWN_MS = 60 * 1000;      // 재발송 쿨다운 60초
const OTP_WINDOW_MS = 60 * 60 * 1000;   // 발송횟수 제한 윈도우 1시간
const OTP_MAX_SENDS = 5;                // 윈도우 내 최대 발송
const OTP_MAX_ATTEMPTS = 5;             // 코드 검증 최대 시도

// 사용자 데이터 동기화(Phase 2) 한도
const MAX_KEY_LEN = 64;
const MAX_VALUE_BYTES = 100 * 1024;   // 값 1개(JSON 문자열) 최대
const MAX_SYNC_KEYS = 60;             // 한 요청당 처리 키 수
const DATA_BODY_BYTES = 512 * 1024;   // /api/data/sync 본문 최대

// AI 서류검토(Phase 3)
const AI_MODEL = 'claude-sonnet-5';   // 검증됨(2026-07-19). 주의: 이 계열은 assistant 프리필 미지원 → messages는 user로 끝나야 함
const ANTHROPIC_VERSION = '2023-06-01';
// ⚠️ claude-sonnet-5는 thinking을 생략하면 adaptive thinking이 기본 동작이고,
//    max_tokens는 사고 토큰 + 응답 토큰을 함께 제한한다. 1024로는 구조화 출력이 중간에 잘린다.
const AI_MAX_TOKENS = 4096;
// 추론이 도는 지역. 기본값 'global'은 "어느 지역에서든 돌 수 있다"는 뜻이라, 방침에 적은
// "이전되는 국가: 미국"이 사실과 달라진다. 'us'로 고정해 **방침 기재와 실제를 일치**시킨다.
// (저장 위치(workspace geo)는 현재 미국만 제공된다. 요금은 표준의 1.1배.)
// ⚠️ Claude 4.6 이상 모델에서만 지원 — 구형 모델로 되돌리면 400이 난다.
const AI_INFERENCE_GEO = 'us';
const AI_EFFORT = 'medium';           // 형식·누락 점검 작업 — low는 얕고 high는 과함
const DAILY_AI_LIMIT = 10;            // 남용 방지용 1일 상한. 실제 배분은 패키지 총량제(PACKAGE_TERMS.aiQuota)
// Resend 무료 플랜의 하루 발송 한도(대략). 관리자 화면의 경고 임계값 기준일 뿐,
// 실제 한도는 Resend가 판정한다 — 넘치면 Pro($20/월)로 올리면 되고 수탁자가 같아 방침 개정은 불필요.
const EMAIL_DAILY_FREE = 100;
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

// 패키지별 이용기간·AI 검토 회수. 근거는 api/schema.sql의 entitlements 주석 참조.
// ⚠️ 이 값을 바꾸면 pricing.html 카드·결제 전 확인창·terms.html 제5조의 고지도 함께 바꿔야 한다
//    (전자상거래법 제13조② 거래조건 고지). 고지 없는 소멸은 소멸 자체보다 큰 문제가 된다.
const PACKAGE_TERMS = {
  'rehab-full':          { months: 24, aiQuota: 12 },
  'bankrupt-full':       { months: 24, aiQuota: 12 },
  'maintain':            { months: 84, aiQuota: 8 },
  'correction-rehab':    { months: 12, aiQuota: 8 },
  'correction-bankrupt': { months: 12, aiQuota: 8 },
};
// ※ 미구매자 AI 체험 1회는 2026-08-08 폐지. 탈퇴→재가입으로 무한 반복이 가능해
//    Anthropic API 실비가 새는 경로였다(ai_trial이 users FK CASCADE라 탈퇴 시 초기화됨).
//    법 제17조⑥ 단서의 '시험 사용 상품 제공' 조치는 시행령 제21조의2 각 호 중
//    하나 이상이면 충족되고, 본 서비스는 제1호(일부 이용의 허용 = 유료 콘텐츠 미리보기)를
//    유지하므로 체험 폐지로 조치 요건이 깨지지 않는다. 자세한 근거는 js/main.js requirePackage 주석.

// unix ms에 개월을 더한다. 말일 보정(1/31 + 1개월 = 2/28)까지 처리.
function addMonths(ms, months) {
  const d = new Date(ms);
  const day = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + months);
  if (d.getUTCDate() < day) d.setUTCDate(0);   // 넘어간 만큼 되돌려 말일로
  return d.getTime();
}

// 이용권 관련 키 — 서버(결제 검증)만 쓰기 가능. 클라이언트 동기화(put)에서는 거부된다.
const PLAN_KEYS = new Set(['plan', 'plan_packages', 'plan_type', 'plan_package', 'plan_package_name', 'plan_expires_at']);

// 자체 익명 분석 — 허용된 이벤트만 집계(임의 값 오염 방지). 개인·세션·IP는 저장하지 않는다.
const ANALYTICS_EVENTS = new Set(['pageview', 'diag_step', 'diag_complete', 'pay_start', 'pay_complete']);

// CORS 허용 오리진 — 커스텀 도메인 + GitHub Pages(전환기 병행) + 로컬 개발 서버
const ALLOWED_ORIGINS = new Set([
  'https://chamroad.com',
  'https://www.chamroad.com',
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
  // 만료된 세션 행은 재접속이 없으면 남는다 — 새 세션을 만들 때 이 사용자 것부터 정리.
  await db.prepare('DELETE FROM sessions WHERE user_id = ? AND expires_at < ?')
    .bind(userId, Date.now()).run();
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
    `SELECT s.token_hash, s.expires_at, u.id, u.email, u.name, u.created_at, u.email_verified, u.phone, u.phone_verified,
            u.sensitive_consent_at
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

/* ── 이메일 발송(Resend) + 일회성 토큰 (Phase 5) ── */

// Resend HTTP API로 트랜잭션 메일 발송. 키 미설정·실패 시 false를 반환하되
// 가입·요청 흐름을 막지 않는다(메일 실패로 회원가입이 실패하면 안 된다).
async function sendEmail(env, to, subject, html) {
  if (!env.RESEND_API_KEY) { console.error('email: RESEND_API_KEY 미설정'); return false; }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: EMAIL_FROM, to, subject, html }),
    });
    if (!res.ok) { console.error('email send fail', res.status, await res.text().catch(() => '')); return false; }
    // 발송 수 집계 — Resend 무료 한도(일 100통)를 관리자 화면에서 감시하기 위한 것.
    // ⚠️ 집계 실패가 메일 발송을 깨면 안 되므로 통째로 삼킨다(표가 없어도 메일은 나간다).
    try {
      await env.DB.prepare(
        `INSERT INTO email_usage (day, count) VALUES (?1, 1)
         ON CONFLICT(day) DO UPDATE SET count = count + 1`
      ).bind(new Date().toISOString().slice(0, 10)).run();
    } catch (e) { console.error('email usage count skipped', e.message); }
    return true;
  } catch (e) { console.error('email send error', e); return false; }
}

// 일회성 토큰 발급 — 원본은 반환만, DB엔 SHA-256 해시만 저장(세션과 동일 원칙).
async function createEmailToken(db, userId, purpose, ttlMs) {
  const token = b64url(crypto.getRandomValues(new Uint8Array(TOKEN_BYTES)));
  const tokenHash = await sha256hex(token);
  const now = Date.now();
  await db.prepare(
    'INSERT INTO email_tokens (token_hash, user_id, purpose, expires_at, created_at) VALUES (?,?,?,?,?)'
  ).bind(tokenHash, userId, purpose, now + ttlMs, now).run();
  return token;
}

// 같은 사용자·목적의 토큰을 최근 EMAIL_COOLDOWN_MS 내 발급했으면 true(재발송 억제).
async function recentlySent(db, userId, purpose, now) {
  const row = await db.prepare(
    'SELECT created_at FROM email_tokens WHERE user_id = ? AND purpose = ? ORDER BY created_at DESC LIMIT 1'
  ).bind(userId, purpose).first();
  return !!(row && (now - row.created_at) < EMAIL_COOLDOWN_MS);
}

// 메일에 삽입하는 사용자 값(이름 등) HTML 이스케이프 — 메일 클라이언트 XSS 방지.
function escHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// 공통 메일 틀 — 메일 클라이언트는 외부 CSS/클래스를 무시하므로 인라인 스타일만 쓴다.
function emailShell(title, bodyHtml) {
  // word-break:keep-all — 한글이 어절 중간에서 끊기지 않게(메일 클라이언트 기본은 음절 단위로 끊는다).
  // overflow-wrap:break-word — 주문번호·URL처럼 긴 문자열은 예외적으로 끊어서 넘침을 막는다.
  return `<div style="font-family:-apple-system,'Malgun Gothic',sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1a1a2e;line-height:1.6;word-break:keep-all;overflow-wrap:break-word">
  <div style="font-size:20px;font-weight:700;color:#533afd;margin-bottom:16px">챔로드</div>
  <h1 style="font-size:18px;margin:0 0 12px">${escHtml(title)}</h1>
  ${bodyHtml}
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
  <p style="font-size:12px;color:#6b7280">본 메일은 발신 전용입니다. 문의: eslje75@gmail.com<br>챔로드 — 개인회생·파산 셀프 진행 지원</p>
</div>`;
}

// 링크 버튼 조각(버튼 + 안 될 때용 평문 URL). url은 서버가 만든 값이라 이스케이프 불필요.
function emailButton(label, url) {
  return `<p style="margin:20px 0"><a href="${url}" style="background:#533afd;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:600">${escHtml(label)}</a></p>
  <p style="font-size:13px;color:#6b7280;word-break:break-all">버튼이 안 되면 이 주소를 브라우저에 붙여넣으세요:<br>${url}</p>`;
}

// 가입 이메일 인증 메일 발송(가입·재발송 공용). 쿨다운 확인은 호출부에서.
async function sendVerifyEmail(env, userId, email, name) {
  const token = await createEmailToken(env.DB, userId, 'verify', VERIFY_TTL_MS);
  const url = `${SITE_URL}/verify-email.html?token=${token}`;
  return sendEmail(env, email, '[챔로드] 이메일 주소를 인증해주세요',
    emailShell('이메일 인증', `<p>${escHtml(name)}님, 챔로드 가입을 환영합니다.</p>
    <p>아래 버튼을 눌러 이메일 주소를 인증해주세요. (3일 내 유효)</p>
    ${emailButton('이메일 인증하기', url)}`));
}

/* ── SMS 발송(솔라피) ── */

async function hmacHex(secret, msg) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, enc.encode(msg)));
}

// 솔라피 단문(SMS) 1건 발송. 키/발신번호 미설정·실패 시 false.
// 인증: Authorization: HMAC-SHA256 apiKey, date, salt, signature=HMAC-SHA256(apiSecret, date+salt) hex.
// 다른 서비스(알리고 등)로 바꿀 땐 이 함수만 교체하면 된다.
async function sendSms(env, to, text) {
  if (!env.SOLAPI_API_KEY || !env.SOLAPI_API_SECRET || !env.SMS_SENDER) {
    console.error('sms: 솔라피 시크릿(SOLAPI_API_KEY/SECRET/SMS_SENDER) 미설정'); return false;
  }
  const date = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
  const signature = await hmacHex(env.SOLAPI_API_SECRET, date + salt);
  try {
    const r = await fetch('https://api.solapi.com/messages/v4/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `HMAC-SHA256 apiKey=${env.SOLAPI_API_KEY}, date=${date}, salt=${salt}, signature=${signature}`,
      },
      body: JSON.stringify({ message: { to, from: env.SMS_SENDER, text } }),
    });
    if (!r.ok) { console.error('sms send fail', r.status, (await r.text().catch(() => '')).slice(0, 200)); return false; }
    return true;
  } catch (e) { console.error('sms send error', e); return false; }
}

// unix ms → 'YYYY. MM. DD. HH:MM (KST)'. Workers는 UTC로 도므로 +9시간 보정 후 UTC 게터 사용.
function fmtDate(ms) {
  const d = new Date(ms + 9 * 3600 * 1000);
  const p = n => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}. ${p(d.getUTCMonth() + 1)}. ${p(d.getUTCDate())}. ${p(d.getUTCHours())}:${p(d.getUTCMinutes())} (KST)`;
}

// 결제 완료 시 계약 내용에 관한 서면(주문 확인 메일) — 전자상거래법 제13조② 교부의무.
// 담는 항목: 사업자 신원 / 상품·가격·지급 / 공급 방법·시기 / 청약철회 기한·방법·효과 + 서식 / 분쟁처리.
async function sendOrderConfirmation(env, toEmail, toName, order, paidAt) {
  const pkg = PACKAGES[order.package] || {};
  const term = PACKAGE_TERMS[order.package] || {};
  const won = String(order.amount || 0).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const b = BUSINESS_INFO;
  const row = (k, v) => `<tr><td style="padding:6px 10px;color:#6b7280;white-space:nowrap;vertical-align:top">${k}</td><td style="padding:6px 10px;color:#1a1a2e">${v}</td></tr>`;
  const termDesc = term.months ? `이용기간 ${term.months}개월 · AI 서류검토 ${term.aiQuota}회 포함` : '';
  const body = `
    <p>${escHtml(toName)}님, 결제가 완료되었습니다. 아래는 「전자상거래 등에서의 소비자보호에 관한 법률」 제13조에 따른 계약 내용입니다.</p>
    <table style="width:100%;border-collapse:collapse;font-size:13px;margin:12px 0;border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb">
      ${row('판매자', `${escHtml(b.name)} · 대표 ${escHtml(b.ceo)}`)}
      ${row('사업자등록번호', escHtml(b.regNo))}
      ${row('통신판매업', escHtml(b.mailOrderNo))}
      ${row('주소 / 연락처', `${escHtml(b.address)}<br>${escHtml(b.tel)} · ${escHtml(b.email)}`)}
      ${row('상품', `${escHtml(pkg.name || order.package)}${termDesc ? '<br>' + termDesc : ''}`)}
      ${row('결제 금액', `${won}원`)}
      ${row('결제수단 / 일시', `신용카드 등 · ${fmtDate(paidAt)}`)}
      ${row('공급 방법 / 시기', '온라인 디지털 콘텐츠 · 결제 즉시 이용 개시')}
      ${row('주문번호', escHtml(order.payment_id))}
    </table>
    <p style="font-size:13px;color:#374151;line-height:1.8"><strong>청약철회 안내</strong><br>
      · 기한: <strong>결제일부터 14일 이내</strong>(~${fmtDate(paidAt + REFUND_WINDOW_MS)}). 법정 기간보다 긴 기간을 약정한 것입니다.<br>
      · 방법: 마이페이지 &gt; 결제 내역의 <strong>[청약철회 신청]</strong> 또는 ${escHtml(b.email)}로 신청.<br>
      · 효과: 아직 <strong>이용을 시작하지 않은 부분</strong>은 전액 환불됩니다. 이미 제공이 개시된 디지털 콘텐츠는 「전자상거래법」 제17조 제2항 제5호에 따라 청약철회가 제한될 수 있습니다(미리보기·체험 제공 및 사전 고지 완료).<br>
      · 환불 지연 시 지연배상금은 연 15%(시행령 제21조의3)입니다.</p>
    <p style="font-size:13px;color:#6b7280">약관: ${SITE_URL}/terms.html · 개인정보처리방침: ${SITE_URL}/privacy.html<br>
      분쟁이 있으면 소비자상담센터(국번없이 1372)·한국소비자원·전자거래분쟁조정위원회를 통해 도움받으실 수 있습니다.</p>`;
  return sendEmail(env, toEmail, '[챔로드] 결제 확인 및 계약 내용 안내', emailShell('결제 완료 · 계약 내용', body));
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

// 가입 시 받는 동의의 버전. 약관·방침을 개정하면 이 값을 함께 올려,
// 어느 판본에 동의했는지 계정별로 남긴다(재동의가 필요한 회원을 가려낼 근거).
const CONSENT_VERSION = 'terms-2026-08-10/privacy-2026-08-11';

function validateSignup(body) {
  const name = (body.name || '').trim();
  const email = (body.email || '').toLowerCase().trim();
  const password = body.password || '';
  if (!name) return { error: '이름을 입력해주세요.' };
  if (name.length > 50) return { error: '이름은 50자 이하로 입력해주세요.' };
  if (!EMAIL_RE.test(email) || email.length > 254) return { error: '올바른 이메일 주소를 입력해주세요.' };
  const pwErr = passwordError(password);
  if (pwErr) return { error: pwErr };
  // 동의는 서버에서 필수로 확인한다. 화면 체크박스만 두면 ①동의 사실이 어디에도 남지 않고
  // ②API를 직접 호출해 동의 없이 가입할 수 있다.
  // 「개인정보 보호법」 제22조 제3항은 동의 없이 처리할 수 있는 개인정보라는 입증책임을
  // 개인정보처리자에게 지우고, 제22조의2 제1항은 만 14세 미만 아동의 개인정보 처리에
  // 법정대리인 동의를 요구한다 — 만 14세 이상 확인 기록이 없으면 이를 다툴 근거가 없다.
  if (body.agree !== true)
    return { error: '이용약관·개인정보처리방침 동의와 만 14세 이상 확인이 필요합니다.' };
  return { name, email, password };
}

/* ── 라우트 핸들러 ── */

// 가입 인증코드 발송 — 계정이 만들어지기 전 단계다.
// 메일이 실제로 나가는 지점이므로 Turnstile은 여기서 검증한다(가입 요청 자체는
// 확인된 코드가 없으면 통과하지 못하므로, 캡차를 두 번 풀게 하지 않는다).
async function handleSendSignupCode(request, env, origin) {
  const body = await readJson(request);
  const email = (body && typeof body.email === 'string' ? body.email : '').toLowerCase().trim();
  if (!EMAIL_RE.test(email) || email.length > 254)
    return err(400, '올바른 이메일 주소를 입력해주세요.', origin);

  const human = await verifyTurnstile(env, body && body.turnstileToken, request.headers.get('CF-Connecting-IP'));
  if (!human) return err(403, '자동 가입 방지 확인에 실패했습니다. 페이지를 새로고침한 뒤 다시 시도해주세요.', origin);

  // 이미 가입된 주소는 여기서 알려준다. 어차피 가입 요청이 409로 같은 사실을 드러내고,
  // 코드가 오지 않는 이유를 모른 채 기다리게 하는 편이 더 나쁘다(Turnstile 뒤라 자동 열거는 어렵다).
  const exists = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  if (exists) return err(409, '이미 가입된 이메일입니다.', origin);

  const now = Date.now();
  const prev = await env.DB.prepare('SELECT * FROM email_otp WHERE email = ?').bind(email).first();
  let windowStart = now, sendCount = 0;
  if (prev) {
    if (now - prev.last_sent < OTP_COOLDOWN_MS)
      return err(429, `잠시 후 다시 시도해주세요. (${Math.ceil((OTP_COOLDOWN_MS - (now - prev.last_sent)) / 1000)}초)`, origin);
    if (now - prev.window_start < OTP_WINDOW_MS) {
      if (prev.send_count >= OTP_MAX_SENDS)
        return err(429, '인증 요청이 많습니다. 1시간 후 다시 시도해주세요.', origin);
      windowStart = prev.window_start; sendCount = prev.send_count;
    }
  }

  const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, '0');
  const codeHash = await sha256hex(code);
  const sent = await sendEmail(env, email, '[챔로드] 가입 인증번호',
    emailShell('가입 인증번호', `<p>아래 인증번호를 가입 화면에 입력해주세요. <strong>${Math.floor(OTP_TTL_MS / 60000)}분</strong> 안에 입력하셔야 합니다.</p>
    <p style="font-size:30px;font-weight:700;letter-spacing:6px;color:#533afd;margin:20px 0">${code}</p>
    <p style="font-size:13px;color:#6b7280">본인이 요청하지 않았다면 이 메일을 무시하세요. 인증번호를 타인에게 알려주지 마세요.</p>`));
  if (!sent) return err(502, '인증 메일 발송에 실패했습니다. 주소를 확인하고 잠시 후 다시 시도해주세요.', origin);

  await env.DB.prepare(
    `INSERT INTO email_otp (email, code_hash, expires_at, attempts, last_sent, window_start, send_count, verified_at)
     VALUES (?1, ?2, ?3, 0, ?4, ?5, ?6, NULL)
     ON CONFLICT(email) DO UPDATE SET code_hash=?2, expires_at=?3, attempts=0, last_sent=?4,
       window_start=?5, send_count=?6, verified_at=NULL`
  ).bind(email, codeHash, now + OTP_TTL_MS, now, windowStart, sendCount + 1).run();

  return ok({ sent: true, expiresIn: Math.floor(OTP_TTL_MS / 1000) }, origin);
}

// 가입 인증코드 확인 — 성공하면 verified_at을 남긴다. 실제 계정 생성은 signup에서.
async function handleVerifySignupCode(request, env, origin) {
  const body = await readJson(request);
  const email = (body && typeof body.email === 'string' ? body.email : '').toLowerCase().trim();
  const code = (body && typeof body.code === 'string' ? body.code : '').replace(/\D/g, '');
  if (!email || !code) return err(400, '인증번호를 입력해주세요.', origin);

  const row = await env.DB.prepare('SELECT * FROM email_otp WHERE email = ?').bind(email).first();
  if (!row) return err(400, '인증번호를 먼저 요청해주세요.', origin);
  const now = Date.now();
  if (now > row.expires_at) return err(400, '인증번호가 만료되었습니다. 재발송을 눌러주세요.', origin);
  if (row.attempts >= OTP_MAX_ATTEMPTS)
    return err(429, '입력 시도가 많습니다. 재발송 후 다시 시도해주세요.', origin);

  if (await sha256hex(code) !== row.code_hash) {
    await env.DB.prepare('UPDATE email_otp SET attempts = attempts + 1 WHERE email = ?').bind(email).run();
    return err(400, '인증번호가 올바르지 않습니다.', origin);
  }

  await env.DB.prepare('UPDATE email_otp SET verified_at = ? WHERE email = ?').bind(now, email).run();
  return ok({ verified: true }, origin);
}

async function handleSignup(request, env, origin) {
  const body = await readJson(request);
  if (!body) return err(400, '잘못된 요청입니다.', origin);
  const v = validateSignup(body);
  if (v.error) return err(400, v.error, origin);

  // 이메일 인증 확인 — 확인된 코드 없이는 계정을 만들지 않는다.
  // (메일 발송 단계에서 Turnstile을 이미 통과했으므로 여기서 캡차를 다시 요구하지 않는다.)
  const otp = await env.DB.prepare('SELECT verified_at FROM email_otp WHERE email = ?')
    .bind(v.email).first();
  if (!otp || !otp.verified_at)
    return err(400, '이메일 인증을 먼저 완료해주세요.', origin);
  if (Date.now() - otp.verified_at > SIGNUP_VERIFIED_TTL_MS)
    return err(400, '이메일 인증이 만료되었습니다. 인증번호를 다시 받아주세요.', origin);

  const exists = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(v.email).first();
  if (exists) return err(409, '이미 사용 중인 이메일입니다.', origin);

  const passwordHash = await hashPassword(v.password, env.PEPPER);
  // 코드 확인을 마친 주소로만 계정이 생기므로 email_verified를 1로 시작한다.
  // 가입 후 인증 메일을 따로 보내지 않는다(이미 인증된 상태다).
  const res = await env.DB.prepare(
    `INSERT INTO users (email, name, password_hash, agreed_at, consent_version, email_verified)
     VALUES (?, ?, ?, ?, ?, 1)`
  ).bind(v.email, v.name, passwordHash, Date.now(), CONSENT_VERSION).run();

  const userId = res.meta.last_row_id;
  // 쓴 코드는 지운다 — 남겨 두면 같은 인증으로 다른 계정을 또 만들 수 있다.
  await env.DB.prepare('DELETE FROM email_otp WHERE email = ?').bind(v.email).run();

  const session = await createSession(env.DB, userId, false);
  return ok({
    token: session.token,
    user: { email: v.email, name: v.name, expiresAt: session.expiresAt, emailVerified: true, isAdmin: isAdminEmail(env, v.email) },
  }, origin);
}

// 로그인 실패 1건 기록. 윈도우 내면 누적, 지났으면 리셋. 한도 도달 시 잠금 설정.
// Turnstile 토큰 검증. 시크릿 미설정이면 통과시킨다(기능 도입 전/설정 전에도 가입은 되어야 함).
// 토큰은 1회용이라 실패 시 프론트에서 위젯을 reset해야 재시도가 된다.
// 네트워크 오류로 Cloudflare에 못 물어본 경우도 통과시킨다 — 캡차 장애가 가입 전면 중단이 되면 안 된다.
async function verifyTurnstile(env, token, ip) {
  if (!env.TURNSTILE_SECRET) return true;
  if (!token || typeof token !== 'string') return false;
  try {
    const form = new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token });
    if (ip) form.set('remoteip', ip);
    const r = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
    const j = await r.json();
    if (!j.success) console.error('turnstile rejected', JSON.stringify(j['error-codes'] || []));
    return j.success === true;
  } catch (e) {
    console.error('turnstile verify error', e.message);
    return true;
  }
}

async function recordLoginFail(env, email, att, now) {
  let failCount, windowStart;
  if (att && att.window_start && (now - att.window_start) < LOGIN_WINDOW_MS) {
    failCount = att.fail_count + 1;
    windowStart = att.window_start;
  } else {
    failCount = 1;
    windowStart = now;
  }
  const lockedUntil = failCount >= LOGIN_MAX_FAILS ? now + LOGIN_LOCK_MS : null;
  await env.DB.prepare(
    `INSERT INTO login_attempts (email, fail_count, window_start, locked_until) VALUES (?1, ?2, ?3, ?4)
     ON CONFLICT(email) DO UPDATE SET fail_count = ?2, window_start = ?3, locked_until = ?4`
  ).bind(email, failCount, windowStart, lockedUntil).run();
}

async function handleLogin(request, env, origin) {
  const body = await readJson(request);
  if (!body) return err(400, '잘못된 요청입니다.', origin);
  const email = (body.email || '').toLowerCase().trim();
  const password = body.password || '';
  const remember = !!body.remember;

  const now = Date.now();
  // 존재하지 않는 이메일도 카운트 대상 — 잠금 여부로 계정 존재가 새지 않게 한다.
  const att = await env.DB.prepare(
    'SELECT fail_count, window_start, locked_until FROM login_attempts WHERE email = ?'
  ).bind(email).first();
  if (att && att.locked_until && att.locked_until > now) {
    const mins = Math.ceil((att.locked_until - now) / 60000);
    return err(429, `로그인 시도가 많아 약 ${mins}분간 제한되었습니다. 잠시 후 다시 시도해주세요.`, origin);
  }

  const user = await env.DB.prepare(
    'SELECT id, email, name, password_hash, email_verified, sensitive_consent_at FROM users WHERE email = ?'
  ).bind(email).first();

  // 사용자 없음/비밀번호 불일치를 같은 메시지로 — 이메일 존재 여부 노출 방지
  const FAIL = '이메일 또는 비밀번호가 올바르지 않습니다.';
  const valid = user && await verifyPassword(password, user.password_hash, env.PEPPER);
  if (!valid) {
    await recordLoginFail(env, email, att, now);
    return err(401, FAIL, origin);
  }

  // 성공 — 실패 기록 리셋
  await env.DB.prepare('DELETE FROM login_attempts WHERE email = ?').bind(email).run();
  // 동시 세션 1개 — 기존 세션을 모두 끊는다. 계정을 여러 명이 돌려쓰면 서로 로그아웃되어
  // 실질적으로 공유가 성가셔진다. IP·기기 정보를 수집하지 않으므로 개인정보 방침은 그대로 유지된다.
  // (시간을 나눠 쓰는 순차 양도까지는 막지 못한다 — 그건 본인확인 없이는 불가능하다.)
  await env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(user.id).run();
  const session = await createSession(env.DB, user.id, remember);
  return ok({
    token: session.token,
    user: { email: user.email, name: user.name, expiresAt: session.expiresAt, emailVerified: !!user.email_verified, sensitiveConsent: !!user.sensitive_consent_at, isAdmin: isAdminEmail(env, user.email) },
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
    user: { email: session.email, name: session.name, expiresAt: session.expires_at, emailVerified: !!session.email_verified, phone: session.phone || '', phoneVerified: !!session.phone_verified, sensitiveConsent: !!session.sensitive_consent_at, isAdmin: isAdminEmail(env, session.email) },
  }, origin);
}

// 연락처(휴대폰) 저장 — 문제 발생 시 연락용(선택 입력). SMS 인증 아님(본인확인 미도입 방침 유지).
// 빈 값이면 삭제. 국내 휴대폰 형식만 느슨히 확인.
async function handleSavePhone(request, env, origin) {
  const session = await getSessionUser(env.DB, request);
  if (!session) return err(401, '로그인이 필요합니다.', origin);
  const body = await readJson(request);
  const raw = body && typeof body.phone === 'string' ? body.phone : '';
  const digits = raw.replace(/\D/g, '');
  if (digits && !/^01\d{7,9}$/.test(digits))
    return err(400, '올바른 휴대폰 번호를 입력해주세요. (예: 010-1234-5678)', origin);
  await env.DB.prepare('UPDATE users SET phone = ? WHERE id = ?').bind(digits || null, session.id).run();
  return ok({ phone: digits || '' }, origin);
}

// 결제 시 휴대폰 SMS 인증 — 코드 발송. 재발송 쿨다운 + 시간당 발송 제한.
async function handleSendCode(request, env, origin) {
  const session = await getSessionUser(env.DB, request);
  if (!session) return err(401, '로그인이 필요합니다.', origin);
  if (!env.SOLAPI_API_KEY) return err(503, '문자 인증이 아직 준비 중입니다.', origin);
  const body = await readJson(request);
  const phone = (body && typeof body.phone === 'string' ? body.phone : '').replace(/\D/g, '');
  if (!/^01\d{7,9}$/.test(phone)) return err(400, '올바른 휴대폰 번호를 입력해주세요.', origin);

  const now = Date.now();
  const prev = await env.DB.prepare('SELECT last_sent, window_start, send_count FROM phone_otp WHERE user_id = ?')
    .bind(session.id).first();
  let windowStart = now, sendCount = 0;
  if (prev) {
    if (now - prev.last_sent < OTP_COOLDOWN_MS)
      return err(429, '인증번호를 방금 보냈습니다. 잠시 후 다시 시도해주세요.', origin);
    if (now - prev.window_start < OTP_WINDOW_MS) {
      if (prev.send_count >= OTP_MAX_SENDS)
        return err(429, '인증 요청이 많습니다. 1시간 후 다시 시도해주세요.', origin);
      windowStart = prev.window_start; sendCount = prev.send_count;
    }
  }

  const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, '0');
  const codeHash = await sha256hex(code);
  const sent = await sendSms(env, phone, `[챔로드] 인증번호 ${code} (3분 내 입력). 타인에게 알려주지 마세요.`);
  if (!sent) return err(502, '문자 발송에 실패했습니다. 번호를 확인하고 잠시 후 다시 시도해주세요.', origin);

  await env.DB.prepare(
    `INSERT INTO phone_otp (user_id, phone, code_hash, expires_at, attempts, last_sent, window_start, send_count)
     VALUES (?1, ?2, ?3, ?4, 0, ?5, ?6, ?7)
     ON CONFLICT(user_id) DO UPDATE SET phone=?2, code_hash=?3, expires_at=?4, attempts=0, last_sent=?5, window_start=?6, send_count=?7`
  ).bind(session.id, phone, codeHash, now + OTP_TTL_MS, now, windowStart, sendCount + 1).run();

  // expiresIn(초)을 함께 준다 — 화면 카운트다운이 서버 유효시간과 어긋나지 않도록.
  return ok({ sent: true, expiresIn: Math.floor(OTP_TTL_MS / 1000), message: '인증번호를 문자로 보냈습니다.' }, origin);
}

// SMS 인증 코드 검증 — 성공 시 users.phone + phone_verified 설정, OTP 행 삭제.
async function handleVerifyCode(request, env, origin) {
  const session = await getSessionUser(env.DB, request);
  if (!session) return err(401, '로그인이 필요합니다.', origin);
  const body = await readJson(request);
  const code = (body && typeof body.code === 'string' ? body.code : '').replace(/\D/g, '');
  if (!code) return err(400, '인증번호를 입력해주세요.', origin);

  const row = await env.DB.prepare('SELECT phone, code_hash, expires_at, attempts FROM phone_otp WHERE user_id = ?')
    .bind(session.id).first();
  const now = Date.now();
  if (!row || now > row.expires_at)
    return err(400, '인증번호가 만료되었습니다. 다시 요청해주세요.', origin);
  if (row.attempts >= OTP_MAX_ATTEMPTS)
    return err(429, '인증 시도가 많습니다. 인증번호를 다시 요청해주세요.', origin);

  const codeHash = await sha256hex(code);
  if (codeHash !== row.code_hash) {
    await env.DB.prepare('UPDATE phone_otp SET attempts = attempts + 1 WHERE user_id = ?').bind(session.id).run();
    return err(400, '인증번호가 올바르지 않습니다.', origin);
  }

  await env.DB.batch([
    env.DB.prepare('UPDATE users SET phone = ?, phone_verified = 1 WHERE id = ?').bind(row.phone, session.id),
    env.DB.prepare('DELETE FROM phone_otp WHERE user_id = ?').bind(session.id),
  ]);
  return ok({ verified: true, phone: row.phone }, origin);
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

// 회원탈퇴 — 개인정보보호법 제36조(삭제 요구권) 행사 창구.
// users 삭제 시 sessions·user_data·ai_usage·payments가 FK CASCADE로 함께 삭제된다.
// 단, 전자상거래법 시행령 제6조는 '계약 또는 청약철회등에 관한 기록'과 '대금결제에 관한 기록'을
// 5년 보존하게 하므로, 아래 둘은 삭제 전에 회원정보와 분리된 별도 표로 옮긴다.
//   ① payments → payments_archive : 완료(paid) + 환불(refunded) 결제. 환불건도 대금결제 기록이다.
//   ② withdrawal_requests → withdrawal_archive : 청약철회 신청 사실·시각·처리결과.
//      ⚠️ 신청 사유(reason)는 옮기지 않는다 — 청약철회는 사유를 요하지 않아 보존 의무 대상이 아니고,
//      이용자가 자유서술한 텍스트를 5년 보관하는 것은 개인정보 최소수집 원칙에 어긋난다.
async function handleDeleteAccount(request, env, origin) {
  const session = await getSessionUser(env.DB, request);
  if (!session) return err(401, '로그인이 필요합니다.', origin);
  const body = await readJson(request);
  if (!body) return err(400, '잘못된 요청입니다.', origin);
  const password = body.password || '';
  if (!password) return err(400, '탈퇴하려면 비밀번호를 입력해주세요.', origin);

  const user = await env.DB.prepare('SELECT password_hash FROM users WHERE id = ?')
    .bind(session.id).first();
  if (!user) return err(404, '계정을 찾을 수 없습니다.', origin);
  const valid = await verifyPassword(password, user.password_hash, env.PEPPER);
  if (!valid) return err(401, '비밀번호가 올바르지 않습니다.', origin);

  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT OR REPLACE INTO payments_archive
         (payment_id, email, package, amount, status, created_at, paid_at, refunded_at, archived_at)
       SELECT payment_id, ?1, package, amount, status, created_at, paid_at, refunded_at, ?2
         FROM payments WHERE user_id = ?3 AND status IN ('paid', 'refunded')`
    ).bind(session.email, now, session.id),
    env.DB.prepare(
      `INSERT INTO withdrawal_archive
         (payment_id, email, status, created_at, archived_at)
       SELECT payment_id, ?1, status, created_at, ?2
         FROM withdrawal_requests WHERE user_id = ?3`
    ).bind(session.email, now, session.id),
    env.DB.prepare('DELETE FROM users WHERE id = ?').bind(session.id),
  ]);
  return ok({}, origin);
}

/* ── 비밀번호 재설정 / 이메일 인증 (Phase 5) ── */

// 재설정 요청 — 계정 존재 여부를 노출하지 않도록 항상 200(같은 메시지).
// 계정이 있고 최근 발송 이력이 없으면 30분 유효 토큰을 만들어 메일 발송.
async function handleRequestReset(request, env, origin) {
  const body = await readJson(request);
  if (!body) return err(400, '잘못된 요청입니다.', origin);
  const email = (body.email || '').toLowerCase().trim();
  const DONE = { message: '입력하신 주소로 가입된 계정이 있으면 재설정 메일을 보냈습니다. 메일함을 확인해주세요.' };
  if (!EMAIL_RE.test(email)) return ok(DONE, origin);   // 형식 불량도 동일 응답(계정 열거 방지)

  const user = await env.DB.prepare('SELECT id, name FROM users WHERE email = ?').bind(email).first();
  if (user) {
    const now = Date.now();
    if (!(await recentlySent(env.DB, user.id, 'reset', now))) {
      const token = await createEmailToken(env.DB, user.id, 'reset', RESET_TTL_MS);
      const url = `${SITE_URL}/reset-password.html?token=${token}`;
      await sendEmail(env, email, '[챔로드] 비밀번호 재설정 안내',
        emailShell('비밀번호 재설정', `<p>${escHtml(user.name)}님, 비밀번호를 재설정하려면 아래 버튼을 눌러주세요. (30분 내 유효)</p>
    ${emailButton('비밀번호 재설정', url)}
    <p style="font-size:13px;color:#6b7280">본인이 요청하지 않았다면 이 메일을 무시하세요. 비밀번호는 변경되지 않습니다.</p>`));
    }
  }
  return ok(DONE, origin);
}

// 토큰으로 새 비밀번호 설정 — 검증 후 비번 교체 + 재설정 토큰 소진 + 전 세션 무효화.
async function handleResetPassword(request, env, origin) {
  const body = await readJson(request);
  if (!body) return err(400, '잘못된 요청입니다.', origin);
  const token = (body.token || '').trim();
  const next = body.password || '';
  if (!token) return err(400, '유효하지 않은 링크입니다.', origin);
  const pwErr = passwordError(next);
  if (pwErr) return err(400, pwErr, origin);

  const tokenHash = await sha256hex(token);
  const row = await env.DB.prepare(
    "SELECT user_id, expires_at, used_at FROM email_tokens WHERE token_hash = ? AND purpose = 'reset'"
  ).bind(tokenHash).first();
  const now = Date.now();
  if (!row || row.used_at || now > row.expires_at) {
    return err(400, '링크가 만료되었거나 이미 사용되었습니다. 재설정을 다시 요청해주세요.', origin);
  }

  const newHash = await hashPassword(next, env.PEPPER);
  const urow = await env.DB.prepare('SELECT email FROM users WHERE id = ?').bind(row.user_id).first();
  await env.DB.batch([
    env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(newHash, row.user_id),
    // 이 사용자의 미사용 재설정 토큰 전부 소진(방금 쓴 것 포함)
    env.DB.prepare("UPDATE email_tokens SET used_at = ? WHERE user_id = ? AND purpose = 'reset' AND used_at IS NULL").bind(now, row.user_id),
    // 비번이 바뀌었으니 기존 세션 전부 종료 → 재로그인 유도
    env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(row.user_id),
  ]);
  // 재설정 성공 = 이메일 통제 입증 → 로그인 실패 잠금도 해제
  if (urow) await env.DB.prepare('DELETE FROM login_attempts WHERE email = ?').bind(urow.email).run();
  return ok({ message: '비밀번호가 변경되었습니다. 새 비밀번호로 로그인해주세요.' }, origin);
}

// 이메일 인증 토큰 소진 → email_verified = 1. 만료만 아니면 멱등(이미 인증돼도 성공).
async function handleVerifyEmail(request, env, origin) {
  const body = await readJson(request);
  if (!body) return err(400, '잘못된 요청입니다.', origin);
  const token = (body.token || '').trim();
  if (!token) return err(400, '유효하지 않은 링크입니다.', origin);
  const tokenHash = await sha256hex(token);
  const row = await env.DB.prepare(
    "SELECT user_id, expires_at FROM email_tokens WHERE token_hash = ? AND purpose = 'verify'"
  ).bind(tokenHash).first();
  const now = Date.now();
  if (!row || now > row.expires_at) {
    return err(400, '인증 링크가 만료되었습니다. 로그인 후 인증 메일을 다시 받아주세요.', origin);
  }
  await env.DB.batch([
    env.DB.prepare('UPDATE users SET email_verified = 1 WHERE id = ?').bind(row.user_id),
    env.DB.prepare('UPDATE email_tokens SET used_at = ? WHERE token_hash = ? AND used_at IS NULL').bind(now, tokenHash),
  ]);
  return ok({ message: '이메일 인증이 완료되었습니다.' }, origin);
}

// 인증 메일 재발송(로그인 필요). 이미 인증됐으면 알림만, 쿨다운 내면 조용히 통과.
async function handleResendVerification(request, env, origin) {
  const session = await getSessionUser(env.DB, request);
  if (!session) return err(401, '로그인이 필요합니다.', origin);
  if (session.email_verified) return ok({ message: '이미 인증된 계정입니다.', alreadyVerified: true }, origin);
  const now = Date.now();
  if (!(await recentlySent(env.DB, session.id, 'verify', now))) {
    await sendVerifyEmail(env, session.id, session.email, session.name);
  }
  return ok({ message: '인증 메일을 보냈습니다. 메일함을 확인해주세요.' }, origin);
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

  // ⚠️ plan_packages를 만료되지 않은 이용권으로 덮어쓴다.
  //    프론트 requirePackage()가 이 값으로 유료 콘텐츠 접근을 판정하므로, 여기서 거르지 않으면
  //    이용기간이 지나도 계속 열린다. user_data의 원본은 건드리지 않고 응답만 필터링한다.
  const ents = await activeEntitlements(env.DB, session.id);
  const activeKeys = ents.map(e => e.package);
  const known = new Set(Object.keys(PACKAGE_TERMS));
  const owned = Array.isArray(data.plan_packages) ? data.plan_packages : [];
  // PACKAGE_TERMS에 없는 레거시 키는 만료 개념이 없으므로 그대로 통과시킨다
  data.plan_packages = owned.filter(k => !known.has(k) || activeKeys.includes(k));
  // 이미 제공이 개시된 패키지 목록 — 프론트가 '열면 환불 제외' 사전 고지를
  // 다시 띄울지 판단하는 데 쓴다(이미 개시된 뒤라면 물을 이유가 없다).
  try {
    const acc = await env.DB.prepare('SELECT package FROM content_access WHERE user_id = ?')
      .bind(session.id).all();
    data.content_access = (acc.results || []).map(r => r.package);
  } catch (e) { data.content_access = []; }

  data.entitlements = ents.map(e => ({
    package: e.package,
    expiresAt: e.expires_at,
    aiQuota: e.ai_quota,
    aiUsed: e.ai_used,
    aiLeft: Math.max(0, e.ai_quota - e.ai_used),
  }));

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
    // '저장된 데이터 전체 초기화'는 AI 검토 이용 이력까지 지운다 — 방침상 삭제 요청 대상.
    stmts.push(env.DB.prepare('DELETE FROM ai_usage WHERE user_id = ?').bind(session.id));
  }
  for (const k of putKeys) {
    if (typeof k !== 'string' || k.length === 0 || k.length > MAX_KEY_LEN) continue;
    // 이용권(plan*) 키는 결제 검증을 거친 서버(grantPackage/revokePackage)만 쓸 수 있다.
    // 클라이언트가 localStorage에 심어 올려도 무시 — 결제 없이 프리미엄 위조 차단.
    if (PLAN_KEYS.has(k)) continue;
    let serialized;
    try { serialized = JSON.stringify(put[k]); } catch { continue; }
    if (serialized == null) continue;                      // undefined 값은 스킵
    // 주민등록번호는 어떤 경로로도 서버에 남지 않게 한다(개인정보 보호법 제24조의2 — 동의로도 처리 불가).
    // 여기는 모든 앱데이터가 지나가는 길목이라, 앞으로 새 기능이 추가돼도 자동으로 보호된다.
    serialized = maskIdNumbers(serialized);
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

/* ── 주민등록번호 자동 가리기 (진짜 경계선) ──
   「개인정보 보호법」 제24조의2: 법령에 구체적 근거가 없으면 주민등록번호는 **동의를 받아도** 처리할 수 없다.
   화면(js/main.js maskIdNumbers)에서도 가리지만 클라이언트는 우회할 수 있으므로, 외부(Anthropic)로
   나가기 전과 저장 전에 서버가 다시 지운다. 한쪽만 고치지 말 것 — 두 곳의 정규식은 같아야 한다. */
const RRN_MASK = '○○○○○○-○○○○○○○';
const RRN_RE = /(?<![0-9])[0-9]{6}-?[1-8][0-9]{6}(?![0-9])/g;

function maskIdNumbers(text) {
  return typeof text === 'string' ? text.replace(RRN_RE, RRN_MASK) : text;
}

/* ── AI 서류검토 (Phase 3) ── */
// 실제 Claude API 호출. 법률 자문·결과 예측 금지, '서류 완성도 점검'으로만 제약.

// 출력 스키마 — '판정'과 '대필'이 물리적으로 들어갈 자리가 없도록 설계했다.
//
// 법무사법 제2조 제1항 제1호는 '법원에 제출하는 서류의 작성'을, 변호사법 제109조 제1호는
// '감정·법률상담·법률관계 문서 작성'을 금지한다. 두 조문 어디에도 '점검'과 '질문'은 없다.
// 그래서 이 도구는 판정하지 않고 질문한다:
//   · 대체 문장을 담을 필드가 없다        → 대필(서류 작성)이 구조적으로 불가능
//   · 적합/부적합·점수·등급 필드가 없다   → 감정이 구조적으로 불가능
//   · 지적은 반드시 question을 동반한다    → 문장은 언제나 이용자가 쓴다
// 프롬프트로만 금지하면 모델이 넘어가므로 스키마로 강제한다. 필드를 추가할 때 이 원칙을 깨지 말 것.
const AI_REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    present: {
      type: 'array',
      description: '초안에 이미 들어 있는 것. 사실 확인 수준으로만 적는다.',
      items: { type: 'string' },
    },
    questions: {
      type: 'array',
      description: '법원이 추가로 물을 수 있는데 초안에 없는 내용. 반드시 이용자에게 던지는 질문 형태.',
      items: {
        type: 'object',
        properties: {
          topic:    { type: 'string', description: '무엇이 빠졌는지 (예: 2020~2022년 채무 증가 사정)' },
          question: { type: 'string', description: '이용자가 답을 직접 쓰도록 던지는 질문. 예시 문장을 대신 써 주지 말 것.' },
        },
        required: ['topic', 'question'],
        additionalProperties: false,
      },
    },
    lawNotes: {
      type: 'array',
      description: '초안의 특정 표현이 법령상 검토 대상이 될 수 있어 관련 조문을 안내하는 항목. 적용 여부를 판단하지 말 것.',
      items: {
        type: 'object',
        properties: {
          excerpt:  { type: 'string', description: '초안에서 그대로 인용한 표현' },
          statute:  { type: 'string', description: '관련 조문 (예: 채무자회생법 제564조 제1항 제6호)' },
          note:     { type: 'string', description: '그 조문이 무엇을 정하고 있는지의 사실 서술' },
          question: { type: 'string', description: '이용자에게 던지는 확인 질문' },
        },
        required: ['excerpt', 'statute', 'note', 'question'],
        additionalProperties: false,
      },
    },
  },
  required: ['present', 'questions', 'lawNotes'],
  additionalProperties: false,
};

const AI_SYSTEM_PROMPT = `당신은 대한민국 개인회생·파산 절차에서 이용자가 **스스로** 서류를 완성하도록 돕는 점검 보조자다. 이용자가 직접 작성한 법원 제출용 서류 초안을 읽고, 빠진 것을 '질문'으로 돌려준다.

## 당신이 하는 일
초안에 **들어 있는 것**을 확인하고, **법원이 추가로 물을 만한데 빠진 것**을 질문으로 만들고, 초안의 표현 중 **관련 조문을 알아 둘 필요가 있는 것**을 안내한다.

## 절대 금지 (구조적 이유가 있다)
1. **대체 문장을 쓰지 않는다.** "이렇게 쓰세요: ~", "예: 2019년 5월경 생활비 부족으로…" 같이 이용자가 그대로 옮겨 적을 문장을 만들어 주는 것은 법원 제출 서류의 '작성'에 해당한다(법무사법 제2조 제1항 제1호). 무엇이 빠졌는지 알려주고 질문만 한다.
2. **판정하지 않는다.** "미흡하다", "충분하다", "제출해도 된다", "통과 가능성이 높다" 같은 평가·등급·점수를 내지 않는다. 이는 감정에 해당한다(변호사법 제109조 제1호).
3. **결과를 예측하지 않는다.** 면책·인가 여부, 성공 가능성을 말하지 않는다.
4. **이 사람의 사정에 법을 적용해 결론 내지 않는다.** "이 경우는 재량면책 대상이다" 같은 판단은 법률상담이다. 조문이 무엇을 정하는지의 **사실**만 전하고, 적용 여부는 이용자가 판단하게 한다.
5. 추측으로 사실을 만들지 않는다. 초안에 없는 내용을 있는 것처럼 쓰지 않는다.
6. **숫자를 계산하지 않는다.** 합계·차액·비율(안분율)·곱셈(가용소득×변제횟수)을 직접 계산하거나 "합계가 맞지 않습니다", "합계는 ○○원입니다" 같이 검산 결과를 말하지 않는다. 언어모델의 산술은 틀려도 그럴듯해 보이고, 이 서비스는 그 검산을 별도의 계산 코드(숫자 검산기)로 처리한다. 금액이 걸린 항목은 계산하지 말고 **질문으로만** 돌려준다 — 예: "채권자별 금액의 합계가 목록 맨 아래 합계 칸과 같은지 확인하셨나요? (사이트의 '숫자 검산기'에서 계산해 볼 수 있습니다)"

## 질문을 만드는 법
- 나쁜 예(판정): "채무 발생 경위가 불충분합니다."
- 나쁜 예(대필): "'2020년 코로나로 매출이 급감하여'라고 쓰세요."
- **좋은 예(질문)**: topic="2020~2022년 채무가 늘어난 사정", question="이 기간에 어떤 일이 있었나요? 채무가 늘어난 계기를 적어 두셨나요?"
- 질문은 이용자가 답을 **직접 쓰도록** 유도한다. 답의 예시를 주지 않는다.

## lawNotes를 쓰는 법
초안에 면책불허가 사유·부인 대상 등으로 검토될 수 있는 표현(도박, 주식·코인 투자, 사치성 소비, 특정 채권자에게만 변제, 재산 처분 등)이 있을 때만 만든다.
- excerpt: 초안에서 **그대로** 인용
- statute: 조문 번호
- note: 그 조문이 무엇을 정하는지의 사실 서술. "이 표현은 위험하다"가 아니라 "이 조항은 …을 면책불허가 사유로 정합니다"
- question: "관련 사정을 함께 적으셨나요?" 형태의 확인 질문
초안에 해당 표현이 없으면 lawNotes는 빈 배열로 둔다. 없는 위험을 만들어내지 않는다.

## 톤
한국어. 차분하고 실용적으로. 이용자를 불안하게 하지 않는다. 이미 잘 적힌 부분은 present에 담아 알려준다.
질문할 것을 찾지 못했다면 questions를 빈 배열로 둔다 — 그것은 "제출해도 된다"는 뜻이 아니며, 그런 말을 덧붙이지도 않는다.`;

// 진술서·경위서 계열에만 붙이는 보강 지침. 이 서류들은 정답 양식이 없어 이용자가 가장 막히고,
// 자기도 모르게 면책불허가 사유를 자백하는 사고가 실제로 나는 지점이다.
const AI_NARRATIVE_HINT = `

## 이 서류(진술서·경위서 계열) 점검 시 특히 볼 것
법원이 채무 발생 경위에서 통상 확인하는 요소들이다. 초안에 없으면 질문으로 만든다.
- 채무가 시작된 시기와 계기
- 채무가 늘어난 기간과 그 사이의 사정 (실직·질병·폐업·사고 등)
- 빌린 돈의 사용처
- 갚기 위해 시도한 노력 (추가 근로, 자산 처분, 채무조정 상담 등)
- 현재의 소득·생활 상황
- 시기가 앞뒤로 어긋나 보이는 곳은 questions로 되물어 확인하게 한다(직접 계산하거나 정정하지 말고, 어긋나 보이는 두 곳을 그대로 인용해 되물을 것)`;

// 진술서·경위서 계열인지 — 서술형 서류에만 보강 지침을 붙인다
function isNarrativeDoc(docLabel) {
  return /진술서|경위|사정|생활상황/.test(docLabel || '');
}

/* ── 이용자의 절차 상황(맥락) ──
   챗봇에 서류를 붙여넣는 사람은 매번 상황을 설명해야 하지만, 이 서비스는 진단 답변으로 이미 알고 있다.
   그 상황을 함께 넘기면 **이 사람에게 법원이 실제로 물을 것**을 질문에 반영할 수 있다.

   ⚠️ 클라이언트가 보낸 것을 그대로 쓰지 않는다. 아래 사전에 있는 키만 통과시킨다.
      ①방침(privacy.html)에 적은 이전 항목과 실제 전송 항목을 같게 유지하기 위해
      ②이용자가 만든 문자열이 그대로 프롬프트에 섞여 지시로 읽히는 것을 막기 위해(프롬프트 인젝션)
   ⚠️ 건강상태·채무 발생 원인·연령·금액은 여기에 **없다**. js/aicontext.js 상단 주석 참조 — 그쪽 목록을
      늘리면 이 사전과 privacy.html을 함께 고쳐야 한다. */
const CTX_INCOME = {
  employed_insured:   '급여소득자(4대보험 가입)',
  employed_uninsured: '급여소득자(4대보험 미가입 — 소득 증빙이 어려울 수 있음)',
  freelance:          '프리랜서',
  self:               '자영업자',
  pension:            '연금·기타 소득',
  none:               '소득 없음',
};
const CTX_LEGAL = {
  seizure: '압류·추심을 받음', provisional: '가압류를 받음', order: '지급명령을 받음',
  lawsuit: '소송이 진행 중', auction: '경매가 진행 중',
};
const CTX_PRIOR = {
  'rehab-done-recent':    '개인회생 면책을 받은 지 5년이 지나지 않음',
  'rehab-done-ok':        '개인회생 면책 이력 있음(5년 경과)',
  'rehab-cancel':         '개인회생 폐지·취소 이력 있음',
  'rehab-ongoing':        '개인회생이 진행 중',
  'bankrupt-done-recent': '파산 면책을 받은 지 7년이 지나지 않음',
  'bankrupt-done-ok':     '파산 면책 이력 있음(7년 경과)',
  'bankrupt-denied':      '면책 불허가를 받은 이력 있음',
  'bankrupt-cancel':      '파산 취소 이력 있음',
  'bankrupt-ongoing':     '파산이 진행 중',
};
const CTX_RECENT_LOAN = {
  'within-3m': '최근 3개월 이내에 새로 대출을 받음',
  'within-1y': '최근 1년 이내에 새로 대출을 받음',
};
const CTX_FLAGS = {
  employed:     '현재 재직 중(예상 퇴직금의 1/2이 재산에 산입된다)',
  sideIncome:   '부수입이 있음',
  personalDebt: '지인·개인 간 채무가 있음',
  securedDebt:  '담보가 있는 채무가 있음',
  closedBiz:    '폐업한 이력이 있음',
  disposed:     '최근 재산을 처분한 이력이 있음',
};

function sanitizeContext(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const out = {};
  if (raw.procedure === 'rehab' || raw.procedure === 'bankrupt') out.procedure = raw.procedure;
  if (typeof raw.hasIncome === 'boolean') out.hasIncome = raw.hasIncome;
  if (CTX_INCOME[raw.incomeType]) out.incomeType = raw.incomeType;

  const dep = Number(raw.dependents);
  if (Number.isFinite(dep) && dep >= 0 && dep <= 20) out.dependents = Math.round(dep);

  const arr = Number(raw.arrearsMonths);
  if (Number.isFinite(arr) && arr > 0 && arr <= 600) out.arrearsMonths = Math.round(arr);

  if (CTX_RECENT_LOAN[raw.recentLoan]) out.recentLoan = raw.recentLoan;

  const legal = (Array.isArray(raw.legalActions) ? raw.legalActions : []).filter(v => CTX_LEGAL[v]);
  if (legal.length) out.legalActions = legal.slice(0, 5);

  const prior = (Array.isArray(raw.priorAdjustments) ? raw.priorAdjustments : []).filter(v => CTX_PRIOR[v]);
  if (prior.length) out.priorAdjustments = prior.slice(0, 9);

  for (const k of Object.keys(CTX_FLAGS)) if (raw[k] === true) out[k] = true;

  return Object.keys(out).length ? out : null;
}

function contextToText(c) {
  if (!c) return '';
  const lines = [];
  if (c.procedure) lines.push(`- 준비 중인 절차: ${c.procedure === 'rehab' ? '개인회생' : '개인파산·면책'}`);
  if (c.incomeType)          lines.push(`- 소득 형태: ${CTX_INCOME[c.incomeType]}`);
  else if (c.hasIncome === false) lines.push('- 소득 형태: 소득 없음');
  if (c.dependents != null)  lines.push(`- 부양가족 ${c.dependents}명`);
  if (c.arrearsMonths)       lines.push(`- 연체 기간 약 ${c.arrearsMonths}개월`);
  if (c.recentLoan)          lines.push(`- ${CTX_RECENT_LOAN[c.recentLoan]}`);
  if (c.legalActions)        lines.push(`- ${c.legalActions.map(v => CTX_LEGAL[v]).join(', ')}`);
  if (c.priorAdjustments)    lines.push(`- ${c.priorAdjustments.map(v => CTX_PRIOR[v]).join(' / ')}`);
  for (const k of Object.keys(CTX_FLAGS)) if (c[k]) lines.push(`- ${CTX_FLAGS[k]}`);
  return lines.join('\n');
}

// 맥락이 있을 때만 붙이는 지침. 맥락을 '사실 인정'으로 쓰지 않게 선을 그어 둔다.
const AI_CONTEXT_HINT = `

## 함께 제공되는 '이용자가 답한 절차 상황'을 쓰는 법
이용자가 사전 진단에서 스스로 답한 내용이며, 초안과 별개의 정보다.
- **쓰는 방향**: 그 상황에서 법원이 통상 확인하는 것이 초안에 있는지 보고, 없으면 questions로 만든다.
  예) 폐업 이력이 있다고 답했는데 초안에 폐업 이야기가 없다 → "폐업하신 경위와 시기를 적어 두셨나요?"
  예) 지인 채무가 있다고 답했는데 초안에 그 이야기가 없다 → 관련 질문
- **하지 말 것**: ①이 상황을 초안에 이미 쓰인 사실인 것처럼 present에 담지 않는다(초안에 없으면 없는 것이다)
  ②이 상황에 법을 적용해 결론 내지 않는다("면책이 어렵다" 등 금지) ③상황과 초안이 다르면 어느 쪽이 틀렸다고
  판정하지 말고, 어느 쪽이 맞는지 **되묻는 질문**으로 만든다(진단은 대략 답한 것일 수 있다).
- 상황 항목이 초안과 무관하면 그냥 넘어간다. 억지로 질문을 만들지 않는다.`;

async function callClaude(apiKey, docLabel, checklist, text, context) {
  const ctxText = contextToText(context);
  const system = AI_SYSTEM_PROMPT
    + (isNarrativeDoc(docLabel) ? AI_NARRATIVE_HINT : '')
    + (ctxText ? AI_CONTEXT_HINT : '');
  const userMsg =
    `검토 대상 서류: ${docLabel}\n` +
    (checklist && checklist.length ? `이 서류에 일반적으로 포함되는 항목(참고): ${checklist.join(', ')}\n` : '') +
    (ctxText ? `\n## 이용자가 사전 진단에서 답한 절차 상황\n${ctxText}\n` : '') +
    `\n아래는 이용자가 직접 작성한 초안이다. 들어 있는 것을 확인하고, 빠진 것을 질문으로 만들라.\n` +
    `대체 문장을 써 주지 말 것.\n\n---\n${text}\n---`;

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
      inference_geo: AI_INFERENCE_GEO,
      system,
      // 출력 형식을 스키마로 강제 — 프롬프트 준수에 기대지 않는다(AI_REVIEW_SCHEMA 주석 참조)
      output_config: {
        effort: AI_EFFORT,
        format: { type: 'json_schema', schema: AI_REVIEW_SCHEMA },
      },
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

  // 구조화 출력을 켜면 첫 text 블록이 유효한 JSON이다. 다만 max_tokens 초과로 잘리면
  // 불완전한 JSON이 오므로 stop_reason을 먼저 확인한다.
  if (data.stop_reason === 'max_tokens') throw new Error('anthropic: output truncated (max_tokens)');
  if (data.stop_reason === 'refusal') throw new Error('anthropic: refused');

  const raw = (Array.isArray(data.content) ? data.content.find(c => c.type === 'text')?.text : '') || '';
  const parsed = JSON.parse(raw);   // 스키마가 보장 — 실패 시 502로 올려 재시도를 안내한다

  // 방어적 정규화. 스키마가 형태를 보장하지만 길이·개수는 제한하지 않으므로 여기서 자른다.
  const str = (v) => (typeof v === 'string' ? v.trim() : '');
  const arr = (v) => (Array.isArray(v) ? v : []);
  return {
    present: arr(parsed.present).map(str).filter(Boolean).slice(0, 12),
    questions: arr(parsed.questions)
      .filter(q => q && str(q.question))
      .map(q => ({ topic: str(q.topic), question: str(q.question) }))
      .slice(0, 12),
    lawNotes: arr(parsed.lawNotes)
      .filter(n => n && str(n.excerpt) && str(n.statute))
      .map(n => ({ excerpt: str(n.excerpt), statute: str(n.statute), note: str(n.note), question: str(n.question) }))
      .slice(0, 6),
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
  // ⚠️ 마스킹은 길이 검사보다 **먼저** — 외부로 나갈 수 있는 경로에 원문이 남지 않게.
  const text = maskIdNumbers(typeof body.text === 'string' ? body.text.trim() : '');
  if (text.length < AI_TEXT_MIN) return err(400, '검토할 내용을 30자 이상 입력해주세요.', origin);
  if (text.length > AI_TEXT_MAX) return err(413, '입력이 너무 깁니다. 서류를 나누어 검토해주세요.', origin);

  const context = sanitizeContext(body.context);

  // 회수를 깎기 전에 동의부터 — 동의가 없어 되돌려보내는 요청이 회수를 소모하면 안 된다.
  const consentErr = await requireSensitiveConsent(env, session, body, origin);
  if (consentErr) return consentErr;

  const gate = await checkAiQuota(env, session, origin);
  if (gate.error) return gate.error;

  let review;
  try {
    review = await callClaude(env.ANTHROPIC_API_KEY, docLabel, checklist, text, context);
  } catch (e) {
    console.error('ai review failed', e.message);
    return err(502, 'AI 검토 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.', origin);
  }

  const spent = await consumeAiQuota(env, session, gate);
  return ok({ review, ...spent }, origin);
}

/* ── 민감정보 처리에 대한 별도 동의 (개인정보 보호법 제23조) ──
   진술서·경위서에는 질병·치료 같은 **건강에 관한 정보**가 사실상 반드시 들어간다(채무가 왜 생겼는지를
   써야 하므로). 이는 제23조 제1항의 민감정보이고, 처리하려면 "정보주체에게 처리사실을 알리고
   **다른 개인정보 처리에 대한 동의와 별도로** 동의를 받은 경우"여야 한다.

   종전에는 동의 절차가 없어 "개인정보는 지우고 넣으세요"로 막았는데, 그러면 채무 발생 경위를
   제대로 쓸 수 없어 검토가 의미를 잃는다. 그래서 **동의를 제대로 받고 있는 그대로 받는다.**

   ⚠️ 주민등록번호는 이 동의로도 처리할 수 없다(제24조의2) — 그쪽은 maskIdNumbers가 지운다.
   ⚠️ 동의 사실의 입증책임은 처리자에게 있으므로(제22조 제3항) 화면 체크만으로는 부족하다.
      users.sensitive_consent_at에 시각을 남기고, 이용자는 언제든 철회할 수 있다. */
async function requireSensitiveConsent(env, session, body, origin) {
  if (session.sensitive_consent_at) return null;           // 이미 동의함
  if (body && body.sensitiveConsent === true) {
    await env.DB.prepare('UPDATE users SET sensitive_consent_at = ? WHERE id = ?')
      .bind(Date.now(), session.id).run();
    return null;
  }
  return err(400, '건강 등 민감정보가 포함될 수 있다는 점에 대한 별도 동의가 필요합니다. 화면의 동의 항목을 확인해주세요.', origin);
}

// 동의 기록·철회. 철회하면 이후 AI 검토·대조를 이용할 수 없다(그 처리에 동의가 필요하므로).
async function handleSensitiveConsent(request, env, origin) {
  const session = await getSessionUser(env.DB, request);
  if (!session) return err(401, '로그인이 필요합니다.', origin);

  const body = await readJson(request, 2 * 1024);
  if (!body || typeof body.consent !== 'boolean') return err(400, '잘못된 요청입니다.', origin);

  await env.DB.prepare('UPDATE users SET sensitive_consent_at = ? WHERE id = ?')
    .bind(body.consent ? Date.now() : null, session.id).run();
  return ok({ sensitiveConsent: body.consent }, origin);
}

/* ── AI 회수 판정·차감 (서류검토와 서류 간 대조가 같은 회수를 쓴다) ──
   두 기능이 같은 Anthropic 실비를 태우므로 회수도 한 주머니에서 나간다.
   나눠서 관리하면 이용자도 헷갈리고 잔여 표시도 두 벌이 된다. */
async function checkAiQuota(env, session, origin) {
  // 유효한 이용권의 잔여 회수(패키지 총량제)만 인정한다. 여러 패키지를 보유하면 잔여가 많은 쪽부터 쓴다.
  // 미구매자 체험 1회는 폐지됨(위 PACKAGES 아래 주석 참조) — 이용권이 없으면 여기서 끝난다.
  const now = Date.now();
  const ents = await activeEntitlements(env.DB, session.id, now);
  const usable = ents.filter(e => e.ai_quota - e.ai_used > 0)
    .sort((a, b) => (b.ai_quota - b.ai_used) - (a.ai_quota - a.ai_used));
  const ent = usable[0] || null;

  if (!ent) {
    return { error: err(403, ents.length
      ? '보유하신 패키지의 서류검토 AI 회수를 모두 사용했습니다. 추가 회수는 요금제에서 구매하실 수 있습니다.'
      : '서류검토 AI는 패키지를 구매하신 회원만 이용할 수 있습니다.', origin) };
  }

  // 남용 방지용 일일 상한(총량제와 별개). 스크립트로 총량을 한 번에 태우는 것을 막는다.
  const day = new Date(now).toISOString().slice(0, 10);
  const row = await env.DB.prepare('SELECT count FROM ai_usage WHERE user_id = ? AND day = ?')
    .bind(session.id, day).first();
  const usedToday = row ? row.count : 0;
  if (usedToday >= DAILY_AI_LIMIT)
    return { error: err(429, `오늘 이용 가능한 검토 횟수(${DAILY_AI_LIMIT}회)를 모두 사용했습니다. 내일 다시 이용해주세요.`, origin) };

  return { ent, day, usedToday };
}

// 성공 시에만 차감 — 실패한 호출은 회수를 소모하지 않는다
async function consumeAiQuota(env, session, gate) {
  const { ent, day, usedToday } = gate;
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO ai_usage (user_id, day, count) VALUES (?1, ?2, 1)
       ON CONFLICT(user_id, day) DO UPDATE SET count = count + 1`
    ).bind(session.id, day),
    env.DB.prepare(
      'UPDATE entitlements SET ai_used = ai_used + 1 WHERE user_id = ? AND package = ? AND ai_used < ai_quota'
    ).bind(session.id, ent.package),
  ]);
  return {
    quota: { type: 'package', package: ent.package, used: ent.ai_used + 1, limit: ent.ai_quota, left: ent.ai_quota - ent.ai_used - 1 },
    usage: { used: usedToday + 1, limit: DAILY_AI_LIMIT },
  };
}

/* ── 서류 간 대조 (서술 ↔ 숫자) ──
   숫자끼리의 대조는 브라우저의 js/crosscheck.js가 이미 코드로 한다. 여기서 하는 것은
   **코드로는 불가능한 것 하나** — 진술서에 글로 쓴 이야기가 목록의 숫자와 어긋나는지 보는 일이다.
   ("2022년에 처음 대출받았다"고 썼는데 채권자목록의 최초 발생일이 2020년인 경우 등)

   숫자는 이미 계산되어 입력으로 들어온다. 모델은 **계산하지 않고 인용만** 한다 —
   AI_SYSTEM_PROMPT 금지 6번과 같은 이유다. */
const AI_CROSSCHECK_SCHEMA = {
  type: 'object',
  properties: {
    conflicts: {
      type: 'array',
      description: '진술서의 서술과 제공된 숫자가 서로 어긋나 보이는 곳. 반드시 원문 인용과 질문을 함께 담는다.',
      items: {
        type: 'object',
        properties: {
          excerpt:  { type: 'string', description: '진술서에서 그대로 인용한 표현' },
          figure:   { type: 'string', description: '대조한 숫자 사실. 제공된 값을 그대로 옮겨 적고 새로 계산하지 말 것.' },
          question: { type: 'string', description: '어느 쪽이 맞는지 이용자가 확인하도록 던지는 질문' },
        },
        required: ['excerpt', 'figure', 'question'],
        additionalProperties: false,
      },
    },
    unexplained: {
      type: 'array',
      description: '숫자에는 있는데 진술서가 설명하지 않은 것. 법원이 되물을 만한 것만.',
      items: {
        type: 'object',
        properties: {
          figure:   { type: 'string', description: '설명이 없는 숫자 사실' },
          question: { type: 'string', description: '이용자가 직접 답을 쓰도록 던지는 질문' },
        },
        required: ['figure', 'question'],
        additionalProperties: false,
      },
    },
  },
  required: ['conflicts', 'unexplained'],
  additionalProperties: false,
};

const AI_CROSSCHECK_PROMPT = `당신은 대한민국 개인회생 절차에서 이용자가 낸 **진술서(글)**와 **목록에 적힌 숫자**가 서로 맞는지만 대조하는 보조자다.

## 입력
- 이용자가 직접 쓴 진술서 초안
- 같은 사건의 목록에서 이미 계산된 숫자들(채권자와 금액, 총 채무액, 소득·지출·가용소득, 재산 합계, 변제 횟수 등)

## 당신이 하는 일 — 이 둘뿐이다
1. **conflicts**: 진술서의 서술과 숫자가 어긋나 보이는 곳을 찾는다. 예) 진술서에 "2022년에 처음 대출을 받았다"고 썼는데 채권자 목록에 2020년 채권이 있는 경우, "직장을 그만두었다"고 썼는데 소득이 잡혀 있는 경우, "가진 재산이 없다"고 썼는데 재산 합계가 0이 아닌 경우, 진술서에 언급된 채권자가 목록에 없는 경우.
2. **unexplained**: 숫자에는 있는데 진술서가 설명하지 않은 것 중, 법원이 통상 되물을 만한 것. 예) 채권자가 7곳인데 진술서는 2곳만 언급, 재산에 임차보증금이 있는데 주거 이야기가 없음.

## 절대 금지
1. **계산하지 않는다.** 합계·차액·비율을 새로 구하지 말고, 주어진 숫자를 **그대로 인용**만 한다. 주어지지 않은 수치를 만들어 내지 않는다.
2. **대체 문장을 쓰지 않는다.** "이렇게 고쳐 쓰세요" 금지(법무사법 제2조 제1항 제1호). 무엇이 어긋나 보이는지 알려주고 질문만 한다.
3. **판정하지 않는다.** "잘못됐다", "허위다", "불일치로 기각된다" 같은 평가·예측 금지(변호사법 제109조 제1호). 어느 쪽이 맞는지는 이용자만 안다.
4. **추측으로 사실을 만들지 않는다.** 진술서에 없는 내용을 있는 것처럼 쓰지 않는다.
5. 어긋남을 억지로 찾지 않는다. 없으면 빈 배열로 둔다 — 그것은 "서류가 맞다"는 뜻이 아니며, 그런 말을 덧붙이지도 않는다.

## 질문을 만드는 법
- 나쁜 예(판정): "진술서와 채권자목록이 불일치합니다."
- 나쁜 예(대필): "'2020년부터 대출을 받기 시작하여'로 고쳐 쓰세요."
- **좋은 예**: excerpt="2022년경 처음 대출을 받았습니다", figure="채권자목록의 ○○은행 채권 발생일 2020. 3. 15.", question="2020년에 받은 대출이 목록에 있습니다. 진술서의 시작 시점을 다시 확인해 보시겠어요?"

## 톤
한국어. 차분하게. 이용자를 불안하게 하지 않는다. 어긋나 보이는 것이 곧 잘못이라는 인상을 주지 않는다 — 표기 방식이 달라서 그렇게 보이는 경우도 많다.`;

// 이용자에게 보여 줄 숫자 요약을 사람이 읽는 문장으로 만든다.
// (JSON을 그대로 던지는 것보다 대조 정확도가 높고, 무엇이 전송되는지도 눈으로 확인하기 쉽다)
function figuresToText(f) {
  const won = (n) => Number(n || 0).toLocaleString('ko-KR') + '원';
  const lines = [];
  if (Array.isArray(f.creditors) && f.creditors.length) {
    lines.push('[채권자목록]');
    f.creditors.forEach((c, i) => lines.push(`  ${i + 1}. ${c.name || '(이름 없음)'} — ${won(c.amount)}`));
    lines.push(`  총 채권액 ${won(f.creditorTotal)} (채권자 ${f.creditors.length}건)`);
  }
  if (f.income) {
    lines.push('[수입·지출]');
    lines.push(`  월 수입 합계 ${won(f.income.total)} / 월 지출 합계 ${won(f.income.expense)}`);
    lines.push(`  가구원 ${f.income.household}인, 월 가용소득 ${won(f.income.disposable)}`);
  }
  if (f.plan) {
    lines.push('[변제계획안·재산]');
    lines.push(`  월 변제액 ${won(f.plan.disposable)} × ${f.plan.months}회 = 총 ${won(f.plan.totalRepay)}`);
    lines.push(`  재산 합계(청산가치) ${won(f.plan.liquidation)}`);
  }
  return lines.join('\n');
}

async function callClaudeCrosscheck(apiKey, docLabel, text, figures, context) {
  const ctxText = contextToText(context);
  const userMsg =
    `이용자가 쓴 서류: ${docLabel}\n\n` +
    `## 같은 사건의 목록에서 이미 계산된 숫자\n${figuresToText(figures)}\n\n` +
    (ctxText ? `## 이용자가 사전 진단에서 답한 절차 상황\n${ctxText}\n\n` : '') +
    `## 이용자가 직접 쓴 초안\n---\n${text}\n---\n\n` +
    `위 초안의 서술이 숫자·상황과 어긋나 보이는 곳, 숫자나 상황에는 있는데 초안이 설명하지 않은 것을 찾아 질문으로 돌려 달라. 숫자를 새로 계산하지 말 것.`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': ANTHROPIC_VERSION, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: AI_MODEL,
      max_tokens: AI_MAX_TOKENS,
      inference_geo: AI_INFERENCE_GEO,
      system: AI_CROSSCHECK_PROMPT + (ctxText ? AI_CONTEXT_HINT : ''),
      output_config: { effort: AI_EFFORT, format: { type: 'json_schema', schema: AI_CROSSCHECK_SCHEMA } },
      messages: [{ role: 'user', content: userMsg }],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`anthropic ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  if (data.stop_reason === 'max_tokens') throw new Error('anthropic: output truncated (max_tokens)');
  if (data.stop_reason === 'refusal') throw new Error('anthropic: refused');

  const parsed = JSON.parse((Array.isArray(data.content) ? data.content.find(c => c.type === 'text')?.text : '') || '');
  const str = (v) => (typeof v === 'string' ? v.trim() : '');
  const arr = (v) => (Array.isArray(v) ? v : []);
  return {
    conflicts: arr(parsed.conflicts)
      .filter(c => c && str(c.excerpt) && str(c.question))
      .map(c => ({ excerpt: str(c.excerpt), figure: str(c.figure), question: str(c.question) }))
      .slice(0, 10),
    unexplained: arr(parsed.unexplained)
      .filter(u => u && str(u.question))
      .map(u => ({ figure: str(u.figure), question: str(u.question) }))
      .slice(0, 8),
  };
}

// 서버로 받는 숫자 요약의 형태를 강제한다. 클라이언트를 믿지 않고, 여기 없는 필드는 버린다
// (그래야 '이전되는 개인정보 항목'이 방침에 적힌 것과 실제로 같다 — privacy.html 국외이전 ② 참조).
function sanitizeFigures(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const num = (v) => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : 0);
  const out = {};

  if (Array.isArray(raw.creditors)) {
    out.creditors = raw.creditors
      .filter(c => c && typeof c === 'object')
      .slice(0, 50)
      .map(c => ({ name: String(c.name || '').slice(0, 60), amount: num(c.amount) }));
    out.creditorTotal = num(raw.creditorTotal);
  }
  if (raw.income && typeof raw.income === 'object') {
    out.income = {
      total: num(raw.income.total), expense: num(raw.income.expense),
      disposable: num(raw.income.disposable), household: Math.min(20, Math.max(1, num(raw.income.household) || 1)),
    };
  }
  if (raw.plan && typeof raw.plan === 'object') {
    out.plan = {
      disposable: num(raw.plan.disposable), months: Math.min(120, Math.max(0, num(raw.plan.months))),
      totalRepay: num(raw.plan.totalRepay), liquidation: num(raw.plan.liquidation),
    };
  }
  return Object.keys(out).length ? out : null;
}

async function handleAiCrosscheck(request, env, origin) {
  const session = await getSessionUser(env.DB, request);
  if (!session) return err(401, '로그인이 필요합니다.', origin);
  if (!env.ANTHROPIC_API_KEY)
    return err(503, 'AI 검토 기능이 아직 준비 중입니다. 잠시 후 다시 시도해주세요.', origin);

  const body = await readJson(request, AI_BODY_BYTES);
  if (!body) return err(400, '잘못된 요청입니다.', origin);

  const docLabel = typeof body.docLabel === 'string' ? body.docLabel.slice(0, 100) : '진술서';
  const text = maskIdNumbers(typeof body.text === 'string' ? body.text.trim() : '');
  if (text.length < AI_TEXT_MIN) return err(400, '대조할 내용을 30자 이상 입력해주세요.', origin);
  if (text.length > AI_TEXT_MAX) return err(413, '입력이 너무 깁니다. 서류를 나누어 대조해주세요.', origin);

  const figures = sanitizeFigures(body.figures);
  if (!figures) return err(400, '먼저 숫자 검산기에서 채권자목록·수입지출·변제계획안 중 하나 이상을 계산해주세요.', origin);
  const context = sanitizeContext(body.context);

  const consentErr = await requireSensitiveConsent(env, session, body, origin);
  if (consentErr) return consentErr;

  const gate = await checkAiQuota(env, session, origin);
  if (gate.error) return gate.error;

  let result;
  try {
    result = await callClaudeCrosscheck(env.ANTHROPIC_API_KEY, docLabel, text, figures, context);
  } catch (e) {
    console.error('ai crosscheck failed', e.message);
    return err(502, 'AI 대조 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.', origin);
  }

  const spent = await consumeAiQuota(env, session, gate);
  return ok({ result, ...spent }, origin);
}

/* ── 운영 상태 (관리자 대시보드) ──
   1인 운영에서 조용히 서비스가 멈추는 경로는 셋이고, 셋 다 성격이 다르다.

   | 항목            | 소진되면            | 조회 방법                                    |
   |-----------------|---------------------|----------------------------------------------|
   | 솔라피 잔액     | 결제 시 번호 인증 중단 | **실시간 API로 조회 가능** (아래 fetchSmsBalance) |
   | Resend 일 100통 | **신규 가입 중단**   | 우리가 보낸 수를 직접 셈(email_usage)         |
   | Anthropic 크레딧 | AI 검토·대조 중단   | ⚠️**잔액 조회 API가 없다** — 콘솔에서만 확인   |

   ⚠️ Anthropic은 남은 크레딧을 조회하는 공개 API를 제공하지 않는다(2026-08-11 확인).
      사용량·비용은 Admin API(`/v1/organizations/usage_report`, `/cost_report`)로 볼 수 있지만
      **조직(Organization) 계정과 별도의 Admin API 키**가 필요해 개인 계정에서는 쓸 수 없다.
      그래서 여기서는 **우리 DB의 호출 횟수**(비용에 비례하는 대리 지표)만 보여 주고
      실제 잔액은 콘솔 링크로 넘긴다. 없는 숫자를 지어내지 말 것. */

// 솔라피 잔액 조회. 인증 방식은 문자 발송(sendSms)과 동일한 HMAC-SHA256.
async function fetchSmsBalance(env) {
  if (!env.SOLAPI_API_KEY || !env.SOLAPI_API_SECRET) return { error: '시크릿 미설정' };
  const date = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
  const signature = await hmacHex(env.SOLAPI_API_SECRET, date + salt);
  try {
    const r = await fetch('https://api.solapi.com/cash/v1/balance', {
      headers: { Authorization: `HMAC-SHA256 apiKey=${env.SOLAPI_API_KEY}, date=${date}, salt=${salt}, signature=${signature}` },
    });
    const body = await r.text().catch(() => '');
    if (!r.ok) return { error: `조회 실패 (${r.status})`, detail: body.slice(0, 160) };
    let j; try { j = JSON.parse(body); } catch { return { error: '응답을 해석하지 못했습니다', detail: body.slice(0, 160) }; }
    // 응답 필드명이 바뀌어도 화면이 죽지 않도록 방어적으로 읽는다.
    const balance = Number(j.balance ?? j.cash ?? j.amount);
    const point = Number(j.point ?? 0);
    if (!Number.isFinite(balance)) return { error: '잔액 필드를 찾지 못했습니다', detail: body.slice(0, 160) };
    return { balance, point: Number.isFinite(point) ? point : 0 };
  } catch (e) { return { error: '연결 실패', detail: String(e.message || e).slice(0, 160) }; }
}

async function handleAdminOpsStatus(request, env, origin) {
  const session = await getSessionUser(env.DB, request);
  if (!session) return err(401, '로그인이 필요합니다.', origin);
  if (!isAdminEmail(env, session.email)) return err(403, '권한이 없습니다.', origin);

  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 8) + '01';

  const [sms, emailToday, emailMonth, aiToday, aiMonth] = await Promise.all([
    fetchSmsBalance(env),
    env.DB.prepare('SELECT count FROM email_usage WHERE day = ?').bind(today).first().catch(() => null),
    env.DB.prepare('SELECT SUM(count) AS n FROM email_usage WHERE day >= ?').bind(monthStart).first().catch(() => null),
    env.DB.prepare('SELECT SUM(count) AS n FROM ai_usage WHERE day = ?').bind(today).first().catch(() => null),
    env.DB.prepare('SELECT SUM(count) AS n FROM ai_usage WHERE day >= ?').bind(monthStart).first().catch(() => null),
  ]);

  return ok({
    sms,                                                    // { balance, point } 또는 { error }
    email: { today: (emailToday && emailToday.count) || 0, month: (emailMonth && emailMonth.n) || 0, dailyLimit: EMAIL_DAILY_FREE },
    ai:    { today: (aiToday && aiToday.n) || 0, month: (aiMonth && aiMonth.n) || 0 },
    // Anthropic 잔액은 조회 API가 없다 — 화면이 이 사실을 그대로 표시한다(위 주석 참조).
    anthropic: { balanceApi: false, reason: '남은 크레딧을 조회하는 공개 API가 없습니다. 콘솔에서 확인해 주세요.' },
    checkedAt: Date.now(),
  }, origin);
}

// 판매 잠금 예외 명단 — 운영자 + TEST_PAY_EMAILS(쉼표 구분).
// 이메일은 개인정보라 저장소(공개 GitHub)에 두지 않고 Worker 시크릿으로만 관리한다.
function payAllowlisted(env, email) {
  if (!email) return false;
  const raw = (env.ADMIN_EMAIL || '') + ',' + (env.TEST_PAY_EMAILS || '');
  const allow = new Set(raw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean));
  return allow.has(email.toLowerCase());
}

/* ── 결제 (Phase 4: 포트원 PortOne V2) ── */
// 흐름: prepare(서버가 주문·금액 확정) → 브라우저 PortOne.requestPayment → complete(서버가 포트원 조회로 금액·상태 검증 후 패키지 부여)

async function handlePaymentPrepare(request, env, origin) {
  const session = await getSessionUser(env.DB, request);
  if (!session) return err(401, '로그인이 필요합니다.', origin);
  // 판매 잠금 — 프론트 버튼만 막으면 API 직접 호출로 우회되므로 여기서도 막는다.
  // 예외: 운영자(ADMIN_EMAIL)와 점검용 허용 계정(TEST_PAY_EMAILS)만 잠금 중에도 주문을 만들 수 있다.
  // 판매를 공개로 열지 않고 결제→환불→탈퇴 E2E를 돌리기 위한 통로다(포트원은 아직 테스트 채널).
  // ⚠️판매 오픈 후에는 TEST_PAY_EMAILS 시크릿을 지울 것 — 남겨 둘 이유가 없다.
  if (!PAYMENTS_ENABLED && !payAllowlisted(env, session.email))
    return err(503, '현재는 결제를 받지 않고 있습니다. 정식 오픈 준비 중입니다.', origin);
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

// 만료되지 않은 이용권만 반환. 접근 판정의 최종 근거.
async function activeEntitlements(db, userId, now = Date.now()) {
  const rows = await db.prepare(
    'SELECT package, expires_at, ai_quota, ai_used FROM entitlements WHERE user_id = ? AND expires_at > ?'
  ).bind(userId, now).all();
  return rows.results || [];
}

// 이용권 부여(또는 연장). 같은 패키지를 다시 사면 기간은 남은 기간에 이어 붙이고 회수는 더한다.
// 보정 추가 대응처럼 여러 번 사는 상품이 있으므로 덮어쓰기가 아니라 누적이어야 한다.
async function grantEntitlement(db, userId, pkgKey, now = Date.now()) {
  const term = PACKAGE_TERMS[pkgKey];
  if (!term) return null;
  const cur = await db.prepare(
    'SELECT expires_at, ai_quota FROM entitlements WHERE user_id = ? AND package = ?'
  ).bind(userId, pkgKey).first();

  // 아직 유효하면 남은 기간 끝에서 연장, 만료됐거나 처음이면 지금부터
  const base = cur && cur.expires_at > now ? cur.expires_at : now;
  const expiresAt = addMonths(base, term.months);
  const quota = (cur ? cur.ai_quota : 0) + term.aiQuota;

  await db.prepare(
    `INSERT INTO entitlements (user_id, package, granted_at, expires_at, ai_quota, ai_used)
     VALUES (?1, ?2, ?3, ?4, ?5, 0)
     ON CONFLICT(user_id, package) DO UPDATE SET expires_at = ?4, ai_quota = ?5`
  ).bind(userId, pkgKey, now, expiresAt, quota).run();
  return { package: pkgKey, expiresAt, aiQuota: quota };
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

  // 이용기간·AI 회수 부여. plan_packages는 캐시일 뿐이고 실제 판정 근거는 entitlements다.
  // 만료일도 서버가 함께 저장한다 — 클라이언트가 쓰게 두면 PLAN_KEYS 보호를 못 받아
  // 위조가 가능하고, 환불 시 revokePackage가 지우지도 못한 채 남는다(2026-08-10 수정).
  const ent = await grantEntitlement(env.DB, userId, pkgKey, now);
  if (ent) puts.plan_expires_at = ent.expiresAt;

  const stmts = Object.entries(puts).map(([k, v]) =>
    env.DB.prepare(
      `INSERT INTO user_data (user_id, key, value, updated_at) VALUES (?1, ?2, ?3, ?4)
       ON CONFLICT(user_id, key) DO UPDATE SET value = ?3, updated_at = ?4`
    ).bind(userId, k, JSON.stringify(v), now));
  await env.DB.batch(stmts);

  return puts;   // 클라이언트가 localStorage에 즉시 반영
}

// 본인 결제 내역 조회 — 마이페이지 열람용. 완료·환불·무료지급만(미완료 pending/failed 제외).
async function handlePaymentHistory(request, env, origin) {
  const session = await getSessionUser(env.DB, request);
  if (!session) return err(401, '로그인이 필요합니다.', origin);
  const rows = await env.DB.prepare(
    // first_access_at = 콘텐츠를 처음 연 시각. 환불 가능 여부(전상법 제17조②5호) 판단 근거로 함께 내려준다.
    // first_access_at = 콘텐츠를 처음 연 시각. 환불 가능 여부(전상법 제17조②5호) 판단 근거.
    // withdrawal_* = 청약철회 신청의 접수·처리 상태. 신청자가 "지금 어디까지 왔는지"를
    // 마이페이지에서 확인할 수 있어야 해서 함께 내려준다(같은 주문의 최신 신청 1건).
    `SELECT p.payment_id, p.package, p.amount, p.status, p.created_at, p.paid_at, p.refunded_at,
            c.first_access_at,
            (SELECT w.status     FROM withdrawal_requests w
              WHERE w.payment_id = p.payment_id ORDER BY w.created_at DESC LIMIT 1) AS withdrawal_status,
            (SELECT w.created_at FROM withdrawal_requests w
              WHERE w.payment_id = p.payment_id ORDER BY w.created_at DESC LIMIT 1) AS withdrawal_at
     FROM payments p
     LEFT JOIN content_access c ON c.user_id = p.user_id AND c.package = p.package
     WHERE p.user_id = ? AND p.status IN ('paid','refunded','test')
     ORDER BY p.created_at DESC LIMIT 50`
  ).bind(session.id).all();
  return ok({ payments: rows.results || [] }, origin);
}

// 유료 콘텐츠를 처음 연 시각을 기록한다(최초 1회만).
// 전자상거래법 제17조 제2항 제5호의 '제공 개시' 시점 = 청약철회 가능 여부의 기준.
// 프론트(main.js markContentAccess)가 잠금 해제 직후 호출한다.
async function handleContentAccess(request, env, origin) {
  const session = await getSessionUser(env.DB, request);
  if (!session) return err(401, '로그인이 필요합니다.', origin);
  const body = await readJson(request);
  const pkgKey = body && typeof body.package === 'string' ? body.package : '';
  if (!PACKAGES[pkgKey]) return err(400, '알 수 없는 패키지입니다.', origin);

  // 보유자만 기록한다 — 미구매자의 미리보기는 '제공 개시'가 아니다.
  const owned = await env.DB.prepare(
    `SELECT 1 FROM payments WHERE user_id = ? AND package = ? AND status IN ('paid','test') LIMIT 1`
  ).bind(session.id, pkgKey).first();
  if (!owned) return ok({ recorded: false }, origin);

  await env.DB.prepare(
    'INSERT OR IGNORE INTO content_access (user_id, package, first_access_at) VALUES (?,?,?)'
  ).bind(session.id, pkgKey, Date.now()).run();

  const row = await env.DB.prepare(
    'SELECT first_access_at FROM content_access WHERE user_id = ? AND package = ?'
  ).bind(session.id, pkgKey).first();
  return ok({ recorded: true, firstAccessAt: row ? row.first_access_at : null }, origin);
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

  const paidAt = Date.now();
  await env.DB.prepare('UPDATE payments SET status = ?, paid_at = ? WHERE payment_id = ?')
    .bind('paid', paidAt, paymentId).run();
  const granted = await grantPackage(env, session.id, order.package);
  // 계약 내용 서면(주문 확인 메일) — 전상법 제13조② 교부의무. 실패해도 결제 확정에는 영향 없음.
  await sendOrderConfirmation(env, session.email, session.name, order, paidAt).catch(() => {});
  return ok({ granted }, origin);
}

// 청약철회 신청 — 전자상거래법 제13조②5호(서식)·제5조④(전자문서). 본인 결제만.
// 결제일부터 14일 이내 + 미개시(content_access 없음)면 자동 전액환불, 그 외는 접수 후 운영자 검토.
async function handleWithdraw(request, env, origin) {
  const session = await getSessionUser(env.DB, request);
  if (!session) return err(401, '로그인이 필요합니다.', origin);
  const body = await readJson(request);
  const paymentId = body && typeof body.paymentId === 'string' ? body.paymentId : '';
  const reason = (body && typeof body.reason === 'string' ? body.reason : '').trim().slice(0, 500);
  if (!paymentId) return err(400, '결제 정보가 없습니다.', origin);

  const order = await env.DB.prepare('SELECT * FROM payments WHERE payment_id = ? AND user_id = ?')
    .bind(paymentId, session.id).first();
  if (!order) return err(404, '결제 주문을 찾을 수 없습니다.', origin);
  if (order.status === 'refunded') return ok({ status: 'already_refunded', message: '이미 환불된 결제입니다.' }, origin);
  if (order.status !== 'paid') return err(400, '완료된 결제만 청약철회할 수 있습니다.', origin);

  const now = Date.now();
  // 신청 접수 기록(서식 요건 충족 + 운영자 검토 근거)
  await env.DB.prepare(
    'INSERT INTO withdrawal_requests (payment_id, user_id, reason, status, created_at) VALUES (?,?,?,?,?)'
  ).bind(paymentId, session.id, reason || null, 'pending', now).run();

  const access = await env.DB.prepare(
    'SELECT first_access_at FROM content_access WHERE user_id = ? AND package = ?'
  ).bind(session.id, order.package).first();
  const within14 = order.paid_at && (now - order.paid_at) <= REFUND_WINDOW_MS;
  const started = !!(access && access.first_access_at);
  const cancelReason = reason || '고객 청약철회(이용약관 제6조)';

  // 자동 전액환불: 14일 이내 + 미개시 + PG 설정됨
  if (within14 && !started && env.PORTONE_API_SECRET) {
    const res = await portoneCancel(env, paymentId, cancelReason);
    if (res !== 'fail') {
      await env.DB.prepare("UPDATE payments SET status='refunded', refunded_at=? WHERE payment_id=? AND status='paid'")
        .bind(now, paymentId).run();
      await env.DB.prepare("UPDATE withdrawal_requests SET status='auto_refunded' WHERE payment_id=? AND status='pending'")
        .bind(paymentId).run();
      try {
        const remain = await env.DB.prepare("SELECT COUNT(*) AS c FROM payments WHERE user_id=? AND package=? AND status='paid'")
          .bind(session.id, order.package).first();
        if (!remain || remain.c === 0) await revokePackage(env, session.id, order.package);
      } catch (e) { console.error('revoke after withdraw failed', e.message); }
      await sendEmail(env, session.email, '[챔로드] 청약철회 · 환불 처리 완료',
        emailShell('청약철회 처리 완료', `<p>${escHtml(session.name)}님, 요청하신 청약철회가 접수되어 <strong>전액 환불</strong> 처리되었습니다.</p>
        <p style="font-size:13px;color:#6b7280">카드 결제 취소는 카드사 정책에 따라 영업일 기준 수일이 걸릴 수 있습니다.</p>`)).catch(() => {});
      return ok({ status: 'refunded', message: '청약철회가 접수되어 전액 환불 처리되었습니다.' }, origin);
    }
    // portone 실패 → 아래 운영자 검토로 폴백
  }

  // 자동 대상 아님(개시분 있음/기간 경과/PG 미설정/PG 실패) → 운영자 알림 + 이용자 접수 안내
  const admin = env.ADMIN_EMAIL || BUSINESS_INFO.email;
  const days = Math.floor((now - (order.paid_at || now)) / DAY_MS);
  await sendEmail(env, admin, '[챔로드] 청약철회 신청 접수(검토 필요)',
    emailShell('청약철회 신청(검토 필요)', `<p>주문번호: ${escHtml(paymentId)}<br>회원: ${escHtml(session.email)}<br>패키지: ${escHtml(order.package)}<br>제공 개시: ${started ? '있음' : '없음'} · 결제 후 ${days}일 경과</p>
    <p>사유: ${escHtml(reason || '(미기재)')}</p>
    <p style="font-size:13px;color:#6b7280">관리자 페이지에서 검토 후 환불 처리하세요.</p>`)).catch(() => {});
  await sendEmail(env, session.email, '[챔로드] 청약철회 신청이 접수되었습니다',
    emailShell('청약철회 접수', `<p>${escHtml(session.name)}님, 청약철회 신청이 접수되었습니다.</p>
    <p style="font-size:13px;color:#374151">이미 이용을 시작한 부분이 있거나 확인이 필요한 경우가 있어, 검토 후 처리 결과를 이메일로 안내드립니다.</p>`)).catch(() => {});
  return ok({ status: 'received', message: '청약철회 신청이 접수되었습니다. 검토 후 이메일로 안내드리겠습니다.' }, origin);
}

// 환불 시 이용권 회수 — grantPackage의 역. 해당 패키지를 보유목록에서 빼고 대표 패키지를 재계산한다.
// 남은 패키지가 없으면 plan 관련 키를 전부 삭제한다.
async function revokePackage(env, userId, pkgKey) {
  const rows = await env.DB.prepare(
    "SELECT key, value FROM user_data WHERE user_id = ? AND key IN ('plan_packages','plan_package')"
  ).bind(userId).all();
  const cur = {};
  for (const r of (rows.results || [])) { try { cur[r.key] = JSON.parse(r.value); } catch {} }

  const owned = (Array.isArray(cur.plan_packages) ? cur.plan_packages : []).filter(k => k !== pkgKey);
  const now = Date.now();

  // 환불·회수 시 이용권도 함께 삭제 — 남겨 두면 만료 전까지 AI 회수가 계속 살아 있다
  await env.DB.prepare('DELETE FROM entitlements WHERE user_id = ? AND package = ?')
    .bind(userId, pkgKey).run();

  if (owned.length === 0) {
    // 보유 패키지 없음 — 이용권 전체 회수
    await env.DB.batch([...PLAN_KEYS].map(k =>
      env.DB.prepare('DELETE FROM user_data WHERE user_id = ? AND key = ?').bind(userId, k)));
    return;
  }
  // 대표 패키지 재설정 — 남은 것 중 부가옵션(correction-*)이 아닌 것을 우선.
  const rep = owned.find(k => !k.startsWith('correction-')) || owned[0];
  const info = PACKAGES[rep] || {};
  const puts = {
    plan: 'premium',
    plan_packages: owned,
    plan_type: info.type,
    plan_package: rep,
    plan_package_name: info.name,
  };
  await env.DB.batch(Object.entries(puts).map(([k, v]) =>
    env.DB.prepare(
      `INSERT INTO user_data (user_id, key, value, updated_at) VALUES (?1, ?2, ?3, ?4)
       ON CONFLICT(user_id, key) DO UPDATE SET value = ?3, updated_at = ?4`
    ).bind(userId, k, JSON.stringify(v), now)));
}

/* ── 자체 익명 분석 ── */
// 인증 불필요(익명). 개인·세션·IP를 저장하지 않고 (날짜, 이벤트, 라벨) 카운트만 올린다.
async function handleAnalytics(request, env, origin) {
  const body = await readJson(request, 2048);
  if (!body || typeof body.event !== 'string' || !ANALYTICS_EVENTS.has(body.event))
    return ok({}, origin);   // 조용히 무시 — 분석은 부가 기능이라 실패해도 사용자 흐름을 막지 않는다.
  // 라벨은 페이지 id·단계 번호 등 비개인 세부값만. 안전 문자로 제한하고 길이 컷.
  const label = (typeof body.label === 'string' ? body.label : '')
    .replace(/[^\w\-./]/g, '').slice(0, 40);
  const day = new Date().toISOString().slice(0, 10);
  try {
    await env.DB.prepare(
      `INSERT INTO analytics (day, event, label, count) VALUES (?1, ?2, ?3, 1)
       ON CONFLICT(day, event, label) DO UPDATE SET count = count + 1`
    ).bind(day, body.event, label).run();
  } catch (e) { /* 분석 실패는 무시 */ }
  return ok({}, origin);
}

/* ── 관리자 (운영자 전용 대시보드) ── */
// 접근 권한: 로그인 세션의 이메일이 ADMIN_EMAIL과 일치할 때만.

// 세션 이메일이 운영자인지. 화면에 관리자 메뉴를 보여줄지 판단하는 용도로만 쓴다.
// ⚠️ 이 값으로 권한을 결정하지 않는다 — 실제 인가는 매 요청 requireAdmin이 서버에서 판정한다.
function isAdminEmail(env, email) {
  return !!env.ADMIN_EMAIL && !!email && email.toLowerCase() === env.ADMIN_EMAIL.toLowerCase().trim();
}

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
    'SELECT id, email, name, phone, created_at FROM users ORDER BY id DESC LIMIT 100'
  ).all();
  const recentPayments = await env.DB.prepare(
    `SELECT p.payment_id, p.package, p.amount, p.status, p.created_at, p.paid_at, u.email
     FROM payments p JOIN users u ON u.id = p.user_id
     ORDER BY p.created_at DESC LIMIT 100`
  ).all();

  // 청약철회 신청 — 미처리(pending)를 위로. 사유·개시 여부까지 한 번에 보여
  // 운영자가 결제 내역을 따로 뒤지지 않고 판단할 수 있게 한다.
  const withdrawals = await env.DB.prepare(
    `SELECT w.payment_id, w.reason, w.status, w.created_at,
            u.email, p.package, p.amount, p.paid_at, p.status AS payment_status,
            c.first_access_at
     FROM withdrawal_requests w
     JOIN users u ON u.id = w.user_id
     LEFT JOIN payments p ON p.payment_id = w.payment_id
     LEFT JOIN content_access c ON c.user_id = w.user_id AND c.package = p.package
     ORDER BY (w.status = 'pending') DESC, w.created_at DESC LIMIT 50`
  ).all();

  // 최근 30일 익명 분석 집계 — 이벤트·라벨별 합계.
  const since = new Date(Date.now() - 30 * DAY_MS).toISOString().slice(0, 10);
  const analytics = await env.DB.prepare(
    'SELECT event, label, SUM(count) AS c FROM analytics WHERE day >= ? GROUP BY event, label ORDER BY c DESC'
  ).bind(since).all();

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
    withdrawals: withdrawals.results || [],
    analytics: analytics.results || [],
  }, origin);
}

// 포트원 결제취소(전액). amount 미지정 = 전액 취소.
// 반환: 'ok'(취소됨) | 'already'(이미 취소됨 — 멱등 성공) | 'fail'(실패).
async function portoneCancel(env, paymentId, reason) {
  try {
    const r = await fetch(`https://api.portone.io/payments/${encodeURIComponent(paymentId)}/cancel`, {
      method: 'POST',
      headers: { Authorization: `PortOne ${env.PORTONE_API_SECRET}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    if (r.ok) return 'ok';
    const t = (await r.text().catch(() => '')).slice(0, 300);
    // 이미 취소된 결제는 성공으로 간주 — 재시도가 502 무한루프로 빠지지 않게.
    if (/ALREADY_CANCELLED|ALREADY_PAID_OR_CANCELLED|이미.*취소/i.test(t)) return 'already';
    console.error('portone cancel failed', paymentId, r.status, t);
    return 'fail';
  } catch (e) {
    console.error('portone cancel error', e.message);
    return 'fail';
  }
}

// 테스트 지급 — 결제 없이 회원에게 패키지 부여(개발·지인 테스트용).
// payments에 status='test'로 기록하므로 매출(status='paid')에는 잡히지 않고, 결제 내역에서 회수할 수 있다.
async function handleAdminGrant(request, env, origin) {
  const admin = await requireAdmin(env.DB, request, env);
  if (!admin) return err(403, '접근 권한이 없습니다.', origin);
  const body = await readJson(request);
  const email = body && typeof body.email === 'string' ? body.email.toLowerCase().trim() : '';
  const pkgKey = body && typeof body.package === 'string' ? body.package : '';
  if (!email) return err(400, '이메일을 입력해주세요.', origin);
  const pkg = PACKAGES[pkgKey];
  if (!pkg) return err(400, '알 수 없는 상품입니다.', origin);

  const user = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  if (!user) return err(404, '해당 이메일의 회원을 찾을 수 없습니다. 먼저 회원가입이 되어 있어야 합니다.', origin);

  const now = Date.now();
  const paymentId = 'test-' + crypto.randomUUID();
  await env.DB.prepare(
    'INSERT INTO payments (payment_id, user_id, package, amount, status, created_at, paid_at) VALUES (?,?,?,?,?,?,?)'
  ).bind(paymentId, user.id, pkgKey, pkg.amount, 'test', now, now).run();
  const granted = await grantPackage(env, user.id, pkgKey);
  return ok({ granted }, origin);
}

// 테스트 지급 회수 — 포트원 취소 없이 이용권만 회수(실결제가 아니므로).
async function handleAdminRevokeTest(request, env, origin) {
  const admin = await requireAdmin(env.DB, request, env);
  if (!admin) return err(403, '접근 권한이 없습니다.', origin);
  const body = await readJson(request);
  const paymentId = body && typeof body.paymentId === 'string' ? body.paymentId : '';
  if (!paymentId) return err(400, '주문 정보가 없습니다.', origin);
  const order = await env.DB.prepare('SELECT * FROM payments WHERE payment_id = ?').bind(paymentId).first();
  if (!order) return err(404, '주문을 찾을 수 없습니다.', origin);
  if (order.status !== 'test') return err(400, '테스트 지급 건만 회수할 수 있습니다.', origin);

  await env.DB.prepare("UPDATE payments SET status = 'revoked' WHERE payment_id = ?").bind(paymentId).run();
  // 같은 패키지의 다른 활성(실결제 또는 테스트) 이용권이 없을 때만 회수.
  try {
    const remain = await env.DB.prepare(
      "SELECT COUNT(*) AS c FROM payments WHERE user_id = ? AND package = ? AND status IN ('paid','test')"
    ).bind(order.user_id, order.package).first();
    if (!remain || remain.c === 0) await revokePackage(env, order.user_id, order.package);
  } catch (e) { console.error('revoke test failed', e.message); }
  return ok({ revoked: true }, origin);
}

// 운영자 환불 — 이용약관 제6조(결제일부터 14일 청약철회) 실행 창구.
// 포트원 결제취소(전액) → status='refunded' → 이용권 회수(같은 패키지 잔여 결제 없을 때만).
async function handleAdminRefund(request, env, origin) {
  const admin = await requireAdmin(env.DB, request, env);
  if (!admin) return err(403, '접근 권한이 없습니다.', origin);
  if (!env.PORTONE_API_SECRET) return err(503, '결제 기능이 설정되지 않았습니다.', origin);

  const body = await readJson(request);
  const paymentId = body && typeof body.paymentId === 'string' ? body.paymentId : '';
  if (!paymentId) return err(400, '결제 정보가 없습니다.', origin);
  const reason = (body && typeof body.reason === 'string' && body.reason) || '고객 청약철회(이용약관 제6조)';

  const order = await env.DB.prepare('SELECT * FROM payments WHERE payment_id = ?')
    .bind(paymentId).first();

  // 탈퇴한 회원의 결제 — payments 원본은 CASCADE 삭제되고 payments_archive에만 남는다.
  if (!order) {
    const arch = await env.DB.prepare('SELECT * FROM payments_archive WHERE payment_id = ?')
      .bind(paymentId).first();
    if (!arch) return err(404, '결제 주문을 찾을 수 없습니다.', origin);
    if (arch.status === 'refunded') return ok({ alreadyRefunded: true }, origin);
    const res = await portoneCancel(env, paymentId, reason);
    if (res === 'fail') return err(502, '결제대행사 취소 처리에 실패했습니다. 포트원 콘솔에서 상태를 확인해주세요.', origin);
    await env.DB.prepare("UPDATE payments_archive SET status = 'refunded', refunded_at = ? WHERE payment_id = ?")
      .bind(Date.now(), paymentId).run();
    return ok({ refunded: true, archived: true }, origin);   // 이미 탈퇴 — 회수할 이용권 없음
  }

  if (order.status === 'refunded') return ok({ alreadyRefunded: true }, origin);
  if (order.status !== 'paid') return err(400, '완료된 결제만 환불할 수 있습니다.', origin);

  const res = await portoneCancel(env, paymentId, reason);
  if (res === 'fail') return err(502, '결제대행사 취소 처리에 실패했습니다. 포트원 콘솔에서 상태를 확인해주세요.', origin);

  // 포트원 취소 성공 — DB 갱신. WHERE status='paid'로 동시 요청의 이중 처리 방지.
  try {
    await env.DB.prepare("UPDATE payments SET status = 'refunded', refunded_at = ? WHERE payment_id = ? AND status = 'paid'")
      .bind(Date.now(), paymentId).run();
  } catch (e) {
    // 취소는 됐으나 기록 갱신 실패. status가 paid로 남아도 재요청 시 포트원이 'already'로 성공 → 회복 가능.
    console.error('refund db update failed', paymentId, e.message);
    return err(500, '환불은 처리되었으나 기록 갱신에 실패했습니다. 잠시 후 다시 시도하면 상태가 반영됩니다.', origin);
  }

  // 이용권 회수 — 같은 패키지의 다른 활성(paid) 결제가 남아있으면 유지(회당 상품 중복구매 대비).
  try {
    const remain = await env.DB.prepare(
      "SELECT COUNT(*) AS c FROM payments WHERE user_id = ? AND package = ? AND status = 'paid'"
    ).bind(order.user_id, order.package).first();
    if (!remain || remain.c === 0) await revokePackage(env, order.user_id, order.package);
  } catch (e) { console.error('revoke after refund failed', e.message); }

  // 청약철회 신청 건이 있으면 종결 처리한다. 안 그러면 처리했는데도 'pending'으로 남아
  // 관리자가 같은 건을 다시 검토하게 된다.
  try {
    await env.DB.prepare("UPDATE withdrawal_requests SET status='resolved' WHERE payment_id=? AND status='pending'")
      .bind(paymentId).run();
  } catch (e) { console.error('withdrawal resolve failed', e.message); }

  // 처리 결과 통지 — 접수 메일에서 "검토 후 처리 결과를 이메일로 안내드립니다"라고 약속했으므로
  // 운영자가 손으로 메일을 쓰지 않아도 자동으로 나가야 한다(약속과 구현의 일치).
  try {
    const buyer = await env.DB.prepare('SELECT email, name FROM users WHERE id = ?')
      .bind(order.user_id).first();
    if (buyer && buyer.email) {
      await sendEmail(env, buyer.email, '[챔로드] 환불 처리 완료',
        emailShell('환불 처리 완료', `<p>${escHtml(buyer.name || '')}님, 요청하신 건이 <strong>전액 환불</strong> 처리되었습니다.</p>
        <p style="font-size:13px;color:#374151">주문번호: ${escHtml(paymentId)}<br>금액: ${Number(order.amount).toLocaleString()}원</p>
        <p style="font-size:13px;color:#6b7280">카드 결제 취소는 카드사 정책에 따라 영업일 기준 수일이 걸릴 수 있습니다.
        해당 패키지의 이용권은 함께 회수되었습니다.</p>`)).catch(() => {});
    }
  } catch (e) { console.error('refund notice mail failed', e.message); }

  return ok({ refunded: true }, origin);
}

/* ── 엔트리 ── */

const ROUTES = {
  'GET /api/admin/overview': handleAdminOverview,
  'GET /api/admin/ops-status': handleAdminOpsStatus,
  'POST /api/admin/refund': handleAdminRefund,
  'POST /api/admin/grant': handleAdminGrant,
  'POST /api/admin/revoke-test': handleAdminRevokeTest,
  'POST /api/auth/send-signup-code': handleSendSignupCode,
  'POST /api/auth/verify-signup-code': handleVerifySignupCode,
  'POST /api/auth/signup': handleSignup,
  'POST /api/auth/login': handleLogin,
  'POST /api/auth/logout': handleLogout,
  'GET /api/auth/me': handleMe,
  'POST /api/auth/change-password': handleChangePassword,
  'POST /api/auth/delete-account': handleDeleteAccount,
  'POST /api/auth/request-reset': handleRequestReset,
  'POST /api/auth/reset-password': handleResetPassword,
  'POST /api/auth/verify-email': handleVerifyEmail,
  'POST /api/auth/resend-verification': handleResendVerification,
  'POST /api/user/phone': handleSavePhone,
  'POST /api/phone/send-code': handleSendCode,
  'POST /api/phone/verify-code': handleVerifyCode,
  'GET /api/data': handleGetData,
  'POST /api/data/sync': handleSyncData,
  'POST /api/ai/review': handleAiReview,
  'POST /api/ai/crosscheck': handleAiCrosscheck,
  'POST /api/user/sensitive-consent': handleSensitiveConsent,
  'POST /api/payment/prepare': handlePaymentPrepare,
  'POST /api/payment/complete': handlePaymentComplete,
  'GET /api/payment/history': handlePaymentHistory,
  'POST /api/payment/withdraw': handleWithdraw,
  'POST /api/content/access': handleContentAccess,
  'POST /api/analytics': handleAnalytics,
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
