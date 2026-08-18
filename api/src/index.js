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

// 유료 본문(회생·파산 완주 패키지의 2단계 이후). 정적 HTML에 두면 결제 없이 읽히므로 여기로 옮겼다.
// 콘텐츠를 고치면 화면이 아니라 Worker가 배포돼야 반영된다 — 자세한 것은 handleContentOpen 주석.
import * as REHAB_CONTENT from './content/rehab-steps.js';
import * as BANKRUPT_CONTENT from './content/bankrupt-steps.js';
import * as MAINTAIN_CONTENT from './content/maintain-steps.js';
import * as SUPPLEMENT_REHAB_CONTENT from './content/supplement-rehab-steps.js';
import * as SUPPLEMENT_BANKRUPT_CONTENT from './content/supplement-bankrupt-steps.js';

// 로그인 무차별 대입 방어 — 윈도우 내 실패 한도 초과 시 잠금.
const LOGIN_MAX_FAILS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;   // 실패 누적 윈도우 15분
const LOGIN_LOCK_MS = 15 * 60 * 1000;     // 초과 시 잠금 15분

const PBKDF2_ITERATIONS = 100000;
const SALT_BYTES = 16;
const TOKEN_BYTES = 32;
const DAY_MS = 86400000;
const MAX_BODY_BYTES = 10 * 1024;
const MAX_EMAIL_LEN = 254;
const MAX_BEARER_TOKEN_LEN = 128;
const MAX_OPAQUE_TOKEN_LEN = 256;

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
// 유료 본문을 처음 열기 전에 화면이 받아야 하는 명시적 동의 계약 버전.
// 단순 페이지 진입/자동 preload는 이 값과 consent:true를 보낼 수 없게 해야 한다.
const CONTENT_OPEN_CONSENT_VERSION = 'content-open-v1';

// 결제 시 SMS 번호 인증(솔라피). 성인 '검증'은 하지 않고(자기신고), 유료 고객 연락처 진위만 확인.
const OTP_TTL_MS = 3 * 60 * 1000;       // 인증코드 유효 3분(화면 카운트다운과 같은 값이어야 함)
const SIGNUP_VERIFIED_TTL_MS = 30 * 60 * 1000;   // 이메일 인증 후 가입 완료까지 허용 시간
const OTP_COOLDOWN_MS = 60 * 1000;      // 재발송 쿨다운 60초
const OTP_WINDOW_MS = 60 * 60 * 1000;   // 발송횟수 제한 윈도우 1시간
const OTP_MAX_SENDS = 5;                // 윈도우 내 최대 발송(계정당)
// 수신번호 기준 한도 — 위 셋은 전부 '계정당'이라 계정을 여러 개 만들면 같은 번호로 계속 보낼 수 있었다
// (2026-08-16 보안감사). 피해자 쪽에 상한을 두는 것이 목적이고, 정상 이용자는 하루 10통에 닿지 않는다.
const PHONE_WINDOW_MS = 24 * 60 * 60 * 1000;
const PHONE_MAX_PER_NUMBER = 10;
const OTP_MAX_ATTEMPTS = 5;             // 코드 검증 최대 시도

// 사용자 데이터 동기화(Phase 2) 한도. 클라이언트가 임의 키를 D1에 만들 수 있으면
// 계정 하나로도 저장공간·쓰기 한도를 소진할 수 있으므로 실제 화면이 쓰는 키만 허용한다.
// plan*은 여기에 없다 — 결제 검증을 통과한 서버 코드만 쓴다.
const SYNC_KEY_RULES = new Map([
  ['diagnosis_data',              { type: 'object', maxBytes: 64 * 1024 }],
  ['diagnosis_scores',            { type: 'object', maxBytes: 8 * 1024 }],
  ['diagnosis_levels',            { type: 'object', maxBytes: 8 * 1024 }],
  ['diagnosis_repay',             { type: 'object', maxBytes: 16 * 1024 }],
  ['diagnosis_date',              { type: 'string', maxBytes: 256 }],
  ['rehab_checks',                { type: 'object', maxBytes: 64 * 1024 }],
  ['bankrupt_checks',             { type: 'object', maxBytes: 64 * 1024 }],
  ['docs_checks',                 { type: 'object', maxBytes: 64 * 1024 }],
  ['maintain_checks',             { type: 'object', maxBytes: 64 * 1024 }],
  ['supplement_checks_rehab',     { type: 'object', maxBytes: 64 * 1024 }],
  ['supplement_checks_bankrupt',  { type: 'object', maxBytes: 64 * 1024 }],
  ['profile',                     { type: 'object', maxBytes: 32 * 1024 }],
  ['ai_reviewed',                 { type: 'object', maxBytes: 32 * 1024 }],
  ['ai_records',                  { type: 'array',  maxBytes: 64 * 1024 }],
]);
// 구버전 호환을 위해 요청 자체는 받아들이되 더 이상 저장·반환하지 않는 판정 데이터.
// 새 화면은 점수·등급을 만들지 않으며, 옛 화면이 잠깐 함께 떠 있어도 서버에서 즉시 삭제한다.
const DEPRECATED_SYNC_KEYS = new Set(['diagnosis_scores', 'diagnosis_levels']);
const FORBIDDEN_SYNC_FIELDS = new Set([
  'hashealthissues', 'debtcauses', 'proto', 'prototype', 'constructor',
]);
const MAX_SYNC_KEYS = 60;             // 한 요청당 put+del 항목 수
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
// 🔴 가입 인증메일 차단선. 하루 총 발송량이 이 값을 넘으면 **가입 메일만** 끊는다.
//
// 왜 필요한가: send-signup-code는 이메일 주소별로만 제한(60초 쿨다운·시간당 5회)하므로,
// 서로 다른 주소 200개를 넣으면 200통이 나간다. 유일한 방벽인 Turnstile은 시크릿 미설정·
// 네트워크 오류 시 **통과(fail-open)** 설계라, 캡차가 흔들리면 하루 한도가 통째로 탄다.
// 그러면 **기존 회원의 비밀번호 재설정 메일**과 **결제 주문확인 메일**(전자상거래법 제13조②의
// 계약내용 서면 — 법정 의무다)까지 함께 멈춘다. 남이 만든 트래픽 때문에 우리 의무가 깨지는 구조다.
//
// 그래서 100통 중 40통을 재설정·주문확인 몫으로 남긴다. 신규 가입은 미뤄져도 되지만
// 이미 돈을 낸 사람의 서면 교부와 로그인 복구는 미뤄지면 안 된다는 판단이다.
// ⚠️ IP를 저장하지 않는다 — 이 방식은 '하루 몇 통 나갔나'만 보므로 개인정보가 늘지 않는다.
//    IP 기준 차단이 필요하면 애플리케이션이 아니라 Cloudflare 인프라 레벨에서 건다 — 절차는 OPERATIONS-COST.md 0절.
const SIGNUP_EMAIL_DAILY_CAP = 60;
const AI_TEXT_MIN = 30;
// 실제 법원 서류 기준으로 잡은 값. A4 한 장이 한글 1,600~1,800자이므로 20,000자면 약 11~12장 —
// 진술서·경위서·보정서 어느 것도 한 건이 이 분량을 넘지 않는다. 6,000자(3~4장)였을 때는
// 채무 발생 경위를 상세히 쓴 진술서가 잘렸다.
// 모델 한계와는 무관하다(claude-sonnet-5 컨텍스트 1M 토큰). 이 상한의 목적은 비용·남용 방지뿐이고,
// 회수가 패키지당 8~12회로 묶여 있어(PACKAGE_TERMS.aiQuota) 상한을 올려도 총액이 튀지 않는다.
const AI_TEXT_MAX = 20000;
// 한글은 UTF-8 3바이트 → 20,000자 = 60KB. 여기에 checklist·context·JSON 이스케이프가 더 붙으므로
// AI_TEXT_MAX × 3바이트의 두 배로 잡는다. 이 값이 모자라면 readJson이 null을 반환해
// "입력이 너무 깁니다"(413) 대신 "잘못된 요청입니다"(400)가 나가 원인을 알 수 없게 된다.
const AI_BODY_BYTES = 128 * 1024;

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
    // API에는 세션·진단·결제 정보가 있으므로 브라우저·중간 캐시에 남기지 않는다.
    'Cache-Control': 'no-store, max-age=0',
    'Pragma': 'no-cache',
    'Vary': 'Origin',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
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

/* 본문 크기 상한은 **실제로 읽은 바이트**로 판단한다.
   종전에는 `Content-Length` 헤더만 봤는데, 그 헤더는 클라이언트가 주는 값이고 HTTP/2에는 필수도 아니라
   생략하면 `len=0`이 되어 검사를 그냥 통과했다(2026-08-16 보안감사). 상한을 두고도 안 걸리는 상태였다.
   ⚠️ text()로 먼저 받으므로 판단 전에 본문이 메모리에 올라온다 — Cloudflare 자체 본문 상한과
      Worker CPU 제한이 그 바깥 울타리다. 여기서 막는 것은 '상한을 넘긴 본문의 파싱·저장'이다. */
async function readJson(request, maxBytes = MAX_BODY_BYTES) {
  let text;
  try { text = await request.text(); } catch { return null; }
  // 한글은 UTF-8에서 3바이트다 — 글자 수가 아니라 바이트로 재야 상한이 의도대로 걸린다.
  if (new TextEncoder().encode(text).length > maxBytes) return null;
  try { return JSON.parse(text); } catch { return null; }
}

/* ── 세션 ── */

// 발급 토큰은 base64url 43자다. 비정상적으로 긴 Authorization 값을 그대로 해시하지 않는다.
function bearerToken(request) {
  const auth = request.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return '';
  const token = auth.slice(7).trim();
  if (token.length < 32 || token.length > MAX_BEARER_TOKEN_LEN) return '';
  return /^[A-Za-z0-9_-]+$/.test(token) ? token : '';
}

async function createSession(db, userId, remember) {
  const token = b64url(crypto.getRandomValues(new Uint8Array(TOKEN_BYTES)));
  const tokenHash = await sha256hex(token);
  const expiresAt = Date.now() + (remember ? 30 : 1) * DAY_MS;
  // 삭제와 발급이 서로 다른 D1 요청이면 동시 로그인 둘이 모두 DELETE를 마친 뒤 각각
  // INSERT해 '세션 1개' 불변식이 깨질 수 있다. 한 batch 트랜잭션에서 교체한다.
  await db.batch([
    db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(userId),
    db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
      .bind(tokenHash, userId, expiresAt),
  ]);
  return { token, expiresAt };
}

async function getSessionUser(db, request) {
  const token = bearerToken(request);
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
async function sendEmail(env, to, subject, html, { usageReserved = false } = {}) {
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
    if (!res.ok) {
      // ⚠️ 응답 본문을 그대로 남기지 말 것 — Resend의 오류 메시지에는 **수신 주소가 들어올 수 있다**.
      //    Worker는 observability가 켜져 있어 그 로그가 그대로 보관된다(2026-08-16 보안감사).
      //    원인 파악에 필요한 것은 상태코드와 오류 유형이지 누구에게 보내려 했는지가 아니다.
      //    `message`는 쓰지 않는다 — Resend는 "Invalid `to` field: ..." 처럼 주소를 문장에 넣는다.
      //    `name`은 'validation_error' 같은 오류 유형 코드뿐이라 안전하다.
      let kind = '';
      try { const j = await res.json(); kind = String(j.name || '').slice(0, 40); } catch (e) {}
      console.error('email send fail', res.status, kind);
      return false;
    }
    // 발송 수 집계 — Resend 무료 한도(일 100통)를 관리자 화면에서 감시하기 위한 것.
    // ⚠️ 집계 실패가 메일 발송을 깨면 안 되므로 통째로 삼킨다(표가 없어도 메일은 나간다).
    if (!usageReserved) {
      try {
        await env.DB.prepare(
          `INSERT INTO email_usage (day, count) VALUES (?1, 1)
           ON CONFLICT(day) DO UPDATE SET count = count + 1`
        ).bind(new Date().toISOString().slice(0, 10)).run();
      } catch (e) { console.error('email usage count skipped', e.message); }
    }
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
  return { token, tokenHash };
}

// 오늘 나간 메일 수. 조회 실패 시 0을 돌려준다(집계가 안 된다고 가입을 막지는 않는다 — fail-open).
async function todayEmailCount(env) {
  try {
    const row = await env.DB.prepare('SELECT count FROM email_usage WHERE day = ?')
      .bind(new Date().toISOString().slice(0, 10)).first();
    return (row && row.count) || 0;
  } catch (e) { console.error('email usage read skipped', e.message); return 0; }
}

// 가입 메일은 보내기 전에 일일 몫을 원자적으로 선점한다. 단순 SELECT 후 발송이면
// 동시 요청이 모두 같은 count를 읽고 SIGNUP_EMAIL_DAILY_CAP을 한꺼번에 넘는다.
async function reserveEmailUsage(env, cap) {
  const day = new Date().toISOString().slice(0, 10);
  try {
    const r = await env.DB.prepare(
      `INSERT INTO email_usage (day, count) VALUES (?1, 1)
       ON CONFLICT(day) DO UPDATE SET count = count + 1 WHERE email_usage.count < ?2`
    ).bind(day, cap).run();
    return { allowed: r.meta.changes === 1, reserved: r.meta.changes === 1, day };
  } catch (e) {
    // 마이그레이션 직후처럼 표가 잠시 없을 때 가입 전체를 막지는 않는다. 이 경우 sendEmail이 사후 집계한다.
    console.error('email usage reserve skipped', e.message);
    return { allowed: (await todayEmailCount(env)) < cap, reserved: false, day };
  }
}

async function releaseEmailUsage(env, reservation) {
  if (!reservation || !reservation.reserved) return;
  try {
    await env.DB.prepare('UPDATE email_usage SET count = count - 1 WHERE day = ? AND count > 0')
      .bind(reservation.day).run();
  } catch (e) { console.error('email usage release skipped', e.message); }
}

// 사용자·목적별 고정 PK 행을 조건부 UPSERT해 메일 쿨다운을 원자적으로 선점한다.
// 실제 reset/verify 토큰과 purpose가 달라 토큰 검증 쿼리에는 절대 매치되지 않는다.
async function claimEmailCooldown(db, userId, purpose, now) {
  const tokenHash = await sha256hex(`email-rate:${userId}:${purpose}`);
  const marker = crypto.getRandomValues(new Uint32Array(1))[0] + 1;
  const r = await db.prepare(
    `INSERT INTO email_tokens (token_hash, user_id, purpose, expires_at, created_at, used_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6)
     ON CONFLICT(token_hash) DO UPDATE SET expires_at=?4, created_at=?5, used_at=?6
       WHERE email_tokens.created_at <= ?7`
  ).bind(tokenHash, userId, `rate:${purpose}`, now + EMAIL_COOLDOWN_MS, now, marker,
    now - EMAIL_COOLDOWN_MS).run();
  return r.meta.changes === 1 ? { tokenHash, marker } : null;
}

async function releaseEmailCooldown(db, claim) {
  if (!claim) return;
  await db.prepare('DELETE FROM email_tokens WHERE token_hash = ? AND used_at = ?')
    .bind(claim.tokenHash, claim.marker).run();
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

// 가입 이메일 인증 메일 발송(가입·재발송 공용). 쿨다운 선점도 이 함수가 맡는다.
async function sendVerifyEmail(env, userId, email, name) {
  const claim = await claimEmailCooldown(env.DB, userId, 'verify', Date.now());
  if (!claim) return true; // 쿨다운 중 재요청은 기존과 같이 조용히 성공 처리
  const created = await createEmailToken(env.DB, userId, 'verify', VERIFY_TTL_MS);
  const url = `${SITE_URL}/verify-email.html?token=${created.token}`;
  const sent = await sendEmail(env, email, '[챔로드] 이메일 주소를 인증해주세요',
    emailShell('이메일 인증', `<p>${escHtml(name)}님, 챔로드 가입을 환영합니다.</p>
    <p>아래 버튼을 눌러 이메일 주소를 인증해주세요. (3일 내 유효)</p>
    ${emailButton('이메일 인증하기', url)}`));
  if (!sent) {
    await env.DB.prepare('DELETE FROM email_tokens WHERE token_hash = ?').bind(created.tokenHash).run();
    await releaseEmailCooldown(env.DB, claim);
  }
  return sent;
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
    // 메일과 같은 이유로 응답 본문을 그대로 남기지 않는다 — 솔라피 오류 응답에는 수신번호가 들어온다.
    // 오류 코드(errorCode)만 남기면 원인 파악에는 충분하다.
    if (!r.ok) {
      let kind = '';
      try { const j = await r.json(); kind = String(j.errorCode || j.status || '').slice(0, 40); } catch (e) {}
      console.error('sms send fail', r.status, kind);
      return false;
    }
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
      ${row('판매자 · 제작자', `${escHtml(b.name)} · 대표 ${escHtml(b.ceo)}<br><span style="color:#6b7280">콘텐츠의 제작자와 공급자도 같습니다.</span>`)}
      ${row('사업자등록번호', escHtml(b.regNo))}
      ${row('통신판매업', escHtml(b.mailOrderNo))}
      ${row('주소 / 연락처', `${escHtml(b.address)}<br>${escHtml(b.tel)} · ${escHtml(b.email)}`)}
      ${row('상품', `${escHtml(pkg.name || order.package)}${termDesc ? '<br>' + termDesc : ''}`)}
      ${row('결제 금액', `${won}원`)}
      ${row('결제수단 / 일시', `신용카드 등 · ${fmtDate(paidAt)}`)}
      ${row('공급 방법 / 시기', '온라인 디지털 콘텐츠 · 결제 즉시 이용 개시')}
      ${row('제공 방식', '웹 브라우저에서 열람하는 방식 · 다운로드·설치 파일이나 실물 매체(CD 등) 없음 · 배송 없음')}
      ${row('이용 환경', '인터넷에 연결된 PC·태블릿·스마트폰과 최신 웹 브라우저(자바스크립트 켜짐)<br>따로 설치하실 프로그램은 없습니다.')}
      ${row('이용조건', '결제한 회원 본인의 계정으로 이용 · 계정 공유·양도 불가')}
      ${row('추가 비용', '없음 (접속에 드는 데이터·통신 요금은 가입하신 통신사 요금제에 따릅니다)')}
      ${row('주문번호', escHtml(order.payment_id))}
    </table>
    <p style="font-size:13px;color:#374151;line-height:1.8"><strong>청약철회 안내</strong><br>
      · 기한: <strong>결제일부터 14일 이내</strong>(~${fmtDate(paidAt + REFUND_WINDOW_MS)}). 법정 기간보다 긴 기간을 약정한 것입니다.<br>
      · 방법: 마이페이지 &gt; 결제 내역의 <strong>[청약철회 신청]</strong> 또는 ${escHtml(b.email)}로 신청.<br>
      · 효과: 아직 <strong>이용을 시작하지 않은 부분</strong>은 전액 환불됩니다. 이미 제공이 개시된 디지털 콘텐츠는 「전자상거래법」 제17조 제2항 제5호에 따라 청약철회가 제한될 수 있습니다(미리보기·체험 제공 및 사전 고지 완료).<br>
      · 환불 지연 시 지연배상금은 연 15%(시행령 제21조의3)입니다.</p>
    <p style="font-size:13px;color:#374151;line-height:1.8"><strong>청약철회 신청서(서식)</strong><br>
      <span style="color:#6b7280">버튼으로 신청하시면 아래 내용이 자동으로 채워집니다. 메일로 신청하실 경우 이 부분을 복사해 채워 보내주세요.</span></p>
    <table style="width:100%;border-collapse:collapse;font-size:13px;margin:0 0 12px;border:1px solid #e5e7eb">
      ${row('주문번호', escHtml(order.payment_id))}
      ${row('결제 이메일', escHtml(toEmail))}
      ${row('신청인', escHtml(toName))}
      ${row('철회 대상', `${escHtml(pkg.name || order.package)} (전부 / 아직 이용하지 않은 부분 중 선택해 적어주세요)`)}
      ${row('신청일', '(작성하신 날짜)')}
      ${row('신청 문구', '위 계약에 대하여 청약을 철회합니다.')}
    </table>
    <p style="font-size:13px;color:#374151;line-height:1.8"><strong>미성년자 계약</strong><br>
      미성년자가 법정대리인의 동의 없이 결제한 경우에는, <strong>미성년자 본인 또는 법정대리인이 그 계약을 취소</strong>할 수 있습니다.</p>
    <p style="font-size:13px;color:#6b7280">약관: ${SITE_URL}/terms.html · 개인정보처리방침: ${SITE_URL}/privacy.html<br>
      분쟁이 있으면 소비자상담센터(국번없이 1372)·한국소비자원·전자거래분쟁조정위원회를 통해 도움받으실 수 있습니다.</p>`;
  return sendEmail(env, toEmail, '[챔로드] 결제 확인 및 계약 내용 안내', emailShell('결제 완료 · 계약 내용', body));
}

/* ── 입력 검증 (프론트 mock과 동일 기준 + 이메일 형식 강화) ── */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(value) {
  return typeof value === 'string' ? value.toLowerCase().trim() : '';
}

function validEmail(email) {
  return email.length <= MAX_EMAIL_LEN && EMAIL_RE.test(email);
}

function validOpaqueToken(value) {
  return typeof value === 'string' && value.length >= 32 && value.length <= MAX_OPAQUE_TOKEN_LEN
    && /^[A-Za-z0-9_-]+$/.test(value);
}

// 비밀번호 정책: 8자 이상 + 영문·숫자·특수문자 포함. 위반 시 사유 문자열, 통과 시 null.
function passwordError(pw) {
  if (typeof pw !== 'string') return '비밀번호 형식이 올바르지 않습니다.';
  if (pw.length < 8) return '비밀번호는 8자 이상이어야 합니다.';
  if (pw.length > 128) return '비밀번호는 128자 이하로 입력해주세요.';
  if (!/[A-Za-z]/.test(pw)) return '비밀번호에 영문자를 포함해주세요.';
  if (!/[0-9]/.test(pw)) return '비밀번호에 숫자를 포함해주세요.';
  if (!/[^A-Za-z0-9]/.test(pw)) return '비밀번호에 특수문자(!@#$ 등)를 포함해주세요.';
  return null;
}

// 가입 시 받는 동의의 버전. 약관·방침을 개정하면 이 값을 함께 올려,
// 어느 판본에 동의했는지 계정별로 남긴다(재동의가 필요한 회원을 가려낼 근거).
// 약관·방침의 시행일과 반드시 일치시킬 것(terms.html·privacy.html 상단).
// ⚠️ 유료 판매 개시 전까지는 준비 과정의 문구 정비를 개별 개정 이력으로 남기지 않기로 했다(2026-08-13, 사용자).
//    정식 개시 시점에 두 문서의 시행일을 새로 정하고 이 값도 함께 올린 뒤, 그때부터 부칙에 이력을 기록한다.
const CONSENT_VERSION = 'terms-2026-08-13/privacy-2026-08-13';
const SIGNUP_CONSENT_FORM_VERSION = 'signup-consent-v1';

function validateSignup(body) {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = normalizeEmail(body.email);
  const password = body.password;
  if (!name) return { error: '이름을 입력해주세요.' };
  if (name.length > 50) return { error: '이름은 50자 이하로 입력해주세요.' };
  if (!validEmail(email)) return { error: '올바른 이메일 주소를 입력해주세요.' };
  const pwErr = passwordError(password);
  if (pwErr) return { error: pwErr };
  // 세 필수 항목은 화면에서 분리해 표시하고 서버에서도 각각 확인한다. 화면 체크만 검사하면
  // API 직접 호출로 우회할 수 있으므로 정확한 form version과 세 boolean을 모두 요구한다.
  // 「개인정보 보호법」 제22조 제3항은 동의 없이 처리할 수 있는 개인정보라는 입증책임을
  // 개인정보처리자에게 지우고, 제22조의2 제1항은 만 14세 미만 아동의 개인정보 처리에
  // 법정대리인 동의를 요구한다 — 만 14세 이상 확인 기록이 없으면 이를 다툴 근거가 없다.
  if (body.consentFormVersion !== SIGNUP_CONSENT_FORM_VERSION
      || body.ageConfirmed !== true || body.termsAgreed !== true || body.privacyAgreed !== true)
    return { error: '만 14세 이상 확인, 이용약관 동의, 개인정보 수집·이용 동의가 모두 필요합니다.' };
  return { name, email, password, consentFormVersion: SIGNUP_CONSENT_FORM_VERSION };
}

/* ── 라우트 핸들러 ── */

// 가입 인증코드 발송 — 계정이 만들어지기 전 단계다.
// 메일이 실제로 나가는 지점이므로 Turnstile은 여기서 검증한다(가입 요청 자체는
// 확인된 코드가 없으면 통과하지 못하므로, 캡차를 두 번 풀게 하지 않는다).
async function handleSendSignupCode(request, env, origin) {
  const body = await readJson(request);
  const email = normalizeEmail(body && body.email);
  if (!validEmail(email))
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

  // 하루 총 발송량과 주소별 OTP 행을 **보내기 전에** 선점한다. 둘 중 하나라도 실패하면 메일은 안 나간다.
  const usageReservation = await reserveEmailUsage(env, SIGNUP_EMAIL_DAILY_CAP);
  if (!usageReservation.allowed)
    return err(429, `오늘 가입 인증 메일 발송이 많아 잠시 제한되었습니다. 내일 다시 시도해주시거나 ${BUSINESS_INFO.email}로 문의해주세요.`, origin);

  const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, '0');
  const codeHash = await sha256hex(code);
  const otpReservation = await env.DB.prepare(
    `INSERT INTO email_otp (email, code_hash, expires_at, attempts, last_sent, window_start, send_count, verified_at)
     VALUES (?1, ?2, ?3, 0, ?4, ?5, ?6, NULL)
     ON CONFLICT(email) DO UPDATE SET code_hash=?2, expires_at=?3, attempts=0, last_sent=?4,
       window_start=?5, send_count=?6, verified_at=NULL
       WHERE email_otp.last_sent <= ?7
         AND (email_otp.window_start <= ?8 OR email_otp.send_count < ?9)`
  ).bind(email, codeHash, now + OTP_TTL_MS, now, windowStart, sendCount + 1,
    now - OTP_COOLDOWN_MS, now - OTP_WINDOW_MS, OTP_MAX_SENDS).run();
  if (otpReservation.meta.changes !== 1) {
    await releaseEmailUsage(env, usageReservation);
    return err(429, '인증 요청이 많습니다. 잠시 후 다시 시도해주세요.', origin);
  }

  const sent = await sendEmail(env, email, '[챔로드] 가입 인증번호',
    emailShell('가입 인증번호', `<p>아래 인증번호를 가입 화면에 입력해주세요. <strong>${Math.floor(OTP_TTL_MS / 60000)}분</strong> 안에 입력하셔야 합니다.</p>
    <p style="font-size:30px;font-weight:700;letter-spacing:6px;color:#533afd;margin:20px 0">${code}</p>
    <p style="font-size:13px;color:#6b7280">본인이 요청하지 않았다면 이 메일을 무시하세요. 인증번호를 타인에게 알려주지 마세요.</p>`),
    { usageReserved: usageReservation.reserved });
  if (!sent) {
    // 방금 선점한 코드만 지운다. 다른 요청이 새 코드를 만든 경우에는 건드리지 않는다.
    await env.DB.prepare('DELETE FROM email_otp WHERE email = ? AND code_hash = ? AND last_sent = ?')
      .bind(email, codeHash, now).run();
    await releaseEmailUsage(env, usageReservation);
    return err(502, '인증 메일 발송에 실패했습니다. 주소를 확인하고 잠시 후 다시 시도해주세요.', origin);
  }

  return ok({ sent: true, expiresIn: Math.floor(OTP_TTL_MS / 1000) }, origin);
}

// 가입 인증코드 확인 — 성공하면 verified_at을 남긴다. 실제 계정 생성은 signup에서.
async function handleVerifySignupCode(request, env, origin) {
  const body = await readJson(request);
  const email = normalizeEmail(body && body.email);
  const code = (body && typeof body.code === 'string' ? body.code : '').replace(/\D/g, '');
  if (!validEmail(email) || !/^\d{6}$/.test(code)) return err(400, '인증번호를 입력해주세요.', origin);

  const row = await env.DB.prepare('SELECT * FROM email_otp WHERE email = ?').bind(email).first();
  if (!row) return err(400, '인증번호를 먼저 요청해주세요.', origin);
  const now = Date.now();
  if (now > row.expires_at) return err(400, '인증번호가 만료되었습니다. 재발송을 눌러주세요.', origin);
  if (row.verified_at) return ok({ verified: true }, origin);
  if (row.attempts >= OTP_MAX_ATTEMPTS)
    return err(429, '입력 시도가 많습니다. 재발송 후 다시 시도해주세요.', origin);

  // 정답 여부를 보기 전에 시도 1회를 원자적으로 선점한다. code_hash를 WHERE에 넣어
  // 재발송과 경합할 때 예전 코드를 새 OTP 행에 적용하는 것도 막는다.
  const reserved = await env.DB.prepare(
    `UPDATE email_otp SET attempts = attempts + 1
     WHERE email = ? AND code_hash = ? AND verified_at IS NULL AND expires_at >= ? AND attempts < ?`
  ).bind(email, row.code_hash, now, OTP_MAX_ATTEMPTS).run();
  if (reserved.meta.changes !== 1)
    return err(429, '입력 시도가 많거나 인증번호가 변경되었습니다. 재발송 후 다시 시도해주세요.', origin);

  if (await sha256hex(code) !== row.code_hash) {
    return err(400, '인증번호가 올바르지 않습니다.', origin);
  }

  await env.DB.prepare('UPDATE email_otp SET verified_at = ? WHERE email = ? AND code_hash = ? AND verified_at IS NULL')
    .bind(now, email, row.code_hash).run();
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
    `INSERT INTO users
       (email, name, password_hash, agreed_at, consent_version, consent_form_version, email_verified)
     VALUES (?, ?, ?, ?, ?, ?, 1)`
  ).bind(v.email, v.name, passwordHash, Date.now(), CONSENT_VERSION, v.consentFormVersion).run();

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
/* 캡차 검증. **통과시키는 실패(fail-open)를 최대한 좁힌다.**

   원래는 오류가 나면 무조건 true였다. 그래서 siteverify가 잠깐 흔들리는 동안 캡차가 통째로 열리고,
   그때 `send-signup-code`의 409 응답으로 회원 이메일을 자동 열거할 수 있었다(2026-08-16 보안감사).
   회생·파산 서비스의 회원 명단은 "누가 도산 절차를 준비 중인가"라는 신호라 그 자체로 민감하다.

   그래서 이렇게 바꿨다:
   ① 3초 타임아웃을 걸고 **한 번 재시도**한다. 순간적인 흔들림은 여기서 대부분 흡수된다.
   ② 두 번 다 실패해야 통과시킨다. 실제 장애일 때 가입이 전면 중단되는 것은 여전히 막는다
      — 이 서비스는 1인 운영이라 한밤중 장애를 사람이 즉시 알아채지 못한다.
   ③ 통과시킬 때는 `TURNSTILE_FAIL_OPEN`으로 로그를 남긴다. 무슨 일이 있었는지 사후에 셀 수 있어야 한다.
   ⚠️ 시크릿 미설정도 통과다(로컬 개발용). 운영에서 빠지면 캡차가 통째로 무효이므로
      운영 대시보드(handleAdminOpsStatus)가 설정 여부를 보여 준다. */
const TURNSTILE_TIMEOUT_MS = 3000;

async function verifyTurnstile(env, token, ip) {
  if (!env.TURNSTILE_SECRET) return true;
  if (!token || typeof token !== 'string') return false;

  const form = new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token });
  if (ip) form.set('remoteip', ip);

  let lastErr = '';
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const r = await fetch(TURNSTILE_VERIFY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
        signal: AbortSignal.timeout(TURNSTILE_TIMEOUT_MS),
      });
      const j = await r.json();
      // 응답이 왔다면 그 판정을 따른다 — 거절은 거절이다(여기서 통과시키면 캡차가 없는 것과 같다).
      if (!j.success) console.error('turnstile rejected', JSON.stringify(j['error-codes'] || []));
      return j.success === true;
    } catch (e) {
      lastErr = e.message;
      // 첫 번째 실패는 조용히 다시 시도한다.
    }
  }
  console.error('TURNSTILE_FAIL_OPEN 캡차 검증 2회 실패 — 통과시킴:', lastErr);
  return true;
}

async function recordLoginFail(env, email, now) {
  // 읽은 fail_count를 계산해 덮어쓰면 동시 요청이 전부 같은 값으로 저장된다.
  // 증가·윈도우 리셋·잠금을 한 UPSERT 안에서 계산해 D1 쓰기 자체를 원자화한다.
  await env.DB.prepare(
    `INSERT INTO login_attempts (email, fail_count, window_start, locked_until) VALUES (?1, 1, ?2, NULL)
     ON CONFLICT(email) DO UPDATE SET
       fail_count = CASE WHEN (?2 - login_attempts.window_start) < ${LOGIN_WINDOW_MS}
                         THEN login_attempts.fail_count + 1 ELSE 1 END,
       window_start = CASE WHEN (?2 - login_attempts.window_start) < ${LOGIN_WINDOW_MS}
                           THEN login_attempts.window_start ELSE ?2 END,
       locked_until = CASE WHEN
         (CASE WHEN (?2 - login_attempts.window_start) < ${LOGIN_WINDOW_MS}
               THEN login_attempts.fail_count + 1 ELSE 1 END) >= ${LOGIN_MAX_FAILS}
         THEN ?2 + ${LOGIN_LOCK_MS} ELSE NULL END`
  ).bind(email, now).run();
}

async function handleLogin(request, env, origin) {
  const body = await readJson(request);
  if (!body) return err(400, '잘못된 요청입니다.', origin);
  const email = normalizeEmail(body.email);
  const password = typeof body.password === 'string' && body.password.length <= 128 ? body.password : null;
  const remember = !!body.remember;

  // 형식이 틀린 임의 문자열을 login_attempts의 영구 PK로 만들지 않는다.
  const FAIL = '이메일 또는 비밀번호가 올바르지 않습니다.';
  if (!validEmail(email)) return err(401, FAIL, origin);

  const now = Date.now();
  // 존재하지 않는 이메일도 카운트 대상 — 잠금 여부로 계정 존재가 새지 않게 한다.
  const att = await env.DB.prepare(
    'SELECT fail_count, window_start, locked_until FROM login_attempts WHERE email = ?'
  ).bind(email).first();
  // ⚠️ 잠금 키가 이메일이라 **남의 이메일로 일부러 틀려 표적 계정을 잠글 수 있다**(2026-08-16 보안감사).
  //    IP를 키에 넣는 방법은 CGNAT·공용 와이파이에서 정상 이용자를 무더기로 막아 더 나쁘다.
  //    그래서 잠금은 그대로 두되 **복구 경로를 안내에 명시**한다 — 비밀번호 재설정에 성공하면
  //    이메일 통제를 입증한 것이므로 잠금도 함께 풀린다(handleResetPassword의 login_attempts 삭제).
  //    피해자가 15분을 기다리는 것 말고 할 수 있는 일이 있다는 것을 화면에서 알 수 있어야 한다.
  if (att && att.locked_until && att.locked_until > now) {
    const mins = Math.ceil((att.locked_until - now) / 60000);
    return err(429, `로그인 시도가 많아 약 ${mins}분간 제한되었습니다. 잠시 후 다시 시도하시거나, 지금 바로 이용하시려면 비밀번호 재설정을 진행해주세요(재설정하면 제한이 해제됩니다).`, origin);
  }

  const user = await env.DB.prepare(
    'SELECT id, email, name, password_hash, email_verified, sensitive_consent_at FROM users WHERE email = ?'
  ).bind(email).first();

  // 사용자 없음/비밀번호 불일치를 같은 메시지로 — 이메일 존재 여부 노출 방지
  const valid = !!(password !== null && user && await verifyPassword(password, user.password_hash, env.PEPPER));
  if (!valid) {
    await recordLoginFail(env, email, now);
    return err(401, FAIL, origin);
  }

  // 성공 — 실패 기록 리셋. createSession이 기존 세션 삭제와 새 토큰 삽입을 한 트랜잭션으로
  // 처리하므로 병렬 로그인에서도 마지막으로 발급된 세션 하나만 남는다.
  await env.DB.prepare('DELETE FROM login_attempts WHERE email = ?').bind(email).run();
  // 동시 세션 1개 — 계정을 여러 명이 돌려쓰면 서로 로그아웃되어
  // 실질적으로 공유가 성가셔진다. IP·기기 정보를 수집하지 않으므로 개인정보 방침은 그대로 유지된다.
  // (시간을 나눠 쓰는 순차 양도까지는 막지 못한다 — 그건 본인확인 없이는 불가능하다.)
  const session = await createSession(env.DB, user.id, remember);
  return ok({
    token: session.token,
    user: { email: user.email, name: user.name, expiresAt: session.expiresAt, emailVerified: !!user.email_verified, sensitiveConsent: !!user.sensitive_consent_at, isAdmin: isAdminEmail(env, user.email) },
  }, origin);
}

async function handleLogout(request, env, origin) {
  const token = bearerToken(request);
  if (token) {
    const tokenHash = await sha256hex(token);
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

  // 수신번호 기준 한도. 위 검사는 전부 세션(계정) 기준이라 계정을 갈아타면 무력화된다.
  // 회수 예약과 같은 방식으로 **보내기 전에** 원자적으로 선점한다 — 조건부 UPDATE의 changes로 판정.
  await env.DB.prepare(
    `INSERT INTO phone_send_log (phone, window_start, send_count) VALUES (?1, ?2, 0)
     ON CONFLICT(phone) DO UPDATE SET window_start = ?2, send_count = 0 WHERE window_start < ?3`
  ).bind(phone, now, now - PHONE_WINDOW_MS).run();
  const slot = await env.DB.prepare(
    'UPDATE phone_send_log SET send_count = send_count + 1 WHERE phone = ? AND send_count < ?'
  ).bind(phone, PHONE_MAX_PER_NUMBER).run();
  if (slot.meta.changes !== 1)
    return err(429, '이 번호로 보낸 인증 문자가 많습니다. 24시간 후 다시 시도해주세요.', origin);

  const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, '0');
  const codeHash = await sha256hex(code);
  const sent = await sendSms(env, phone, `[챔로드] 인증번호 ${code} (3분 내 입력). 타인에게 알려주지 마세요.`);
  if (!sent) {
    // 나가지 않은 문자는 한도를 쓰지 않는다(선점했으니 되돌린다).
    await env.DB.prepare('UPDATE phone_send_log SET send_count = send_count - 1 WHERE phone = ? AND send_count > 0')
      .bind(phone).run().catch(() => {});
    return err(502, '문자 발송에 실패했습니다. 번호를 확인하고 잠시 후 다시 시도해주세요.', origin);
  }

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
  if (!/^\d{6}$/.test(code)) return err(400, '인증번호를 입력해주세요.', origin);

  const row = await env.DB.prepare('SELECT phone, code_hash, expires_at, attempts FROM phone_otp WHERE user_id = ?')
    .bind(session.id).first();
  const now = Date.now();
  if (!row || now > row.expires_at)
    return err(400, '인증번호가 만료되었습니다. 다시 요청해주세요.', origin);
  if (row.attempts >= OTP_MAX_ATTEMPTS)
    return err(429, '인증 시도가 많습니다. 인증번호를 다시 요청해주세요.', origin);

  const codeHash = await sha256hex(code);
  const reserved = await env.DB.prepare(
    `UPDATE phone_otp SET attempts = attempts + 1
     WHERE user_id = ? AND code_hash = ? AND expires_at >= ? AND attempts < ?`
  ).bind(session.id, row.code_hash, now, OTP_MAX_ATTEMPTS).run();
  if (reserved.meta.changes !== 1)
    return err(429, '인증 시도가 많거나 인증번호가 변경되었습니다. 다시 요청해주세요.', origin);

  if (codeHash !== row.code_hash) {
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
  const current = typeof body.currentPassword === 'string' && body.currentPassword.length <= 128
    ? body.currentPassword : '';
  const next = body.newPassword;
  const pwErr = passwordError(next);
  if (pwErr) return err(400, pwErr, origin);

  const user = await env.DB.prepare('SELECT password_hash FROM users WHERE id = ?')
    .bind(session.id).first();
  const valid = await verifyPassword(current, user.password_hash, env.PEPPER);
  if (!valid) return err(401, '현재 비밀번호가 올바르지 않습니다.', origin);

  const newHash = await hashPassword(next, env.PEPPER);
  await env.DB.batch([
    env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(newHash, session.id),
    // 다른 기기 세션 전부 무효화 (현재 세션만 유지)
    env.DB.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash != ?')
      .bind(session.id, session.token_hash),
    // 비밀번호를 직접 바꾼 뒤에도 예전에 발급된 재설정 링크가 살아 있으면 다시 탈취될 수 있다.
    env.DB.prepare("UPDATE email_tokens SET used_at = ? WHERE user_id = ? AND purpose = 'reset' AND used_at IS NULL")
      .bind(Date.now(), session.id),
  ]);
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
  const password = typeof body.password === 'string' && body.password.length <= 128 ? body.password : '';
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
  const email = normalizeEmail(body.email);
  const DONE = { message: '입력하신 주소로 가입된 계정이 있으면 재설정 메일을 보냈습니다. 메일함을 확인해주세요.' };
  if (!validEmail(email)) return ok(DONE, origin);   // 형식 불량도 동일 응답(계정 열거 방지)

  const user = await env.DB.prepare('SELECT id, name FROM users WHERE email = ?').bind(email).first();
  if (user) {
    const now = Date.now();
    const claim = await claimEmailCooldown(env.DB, user.id, 'reset', now);
    if (claim) {
      const created = await createEmailToken(env.DB, user.id, 'reset', RESET_TTL_MS);
      const url = `${SITE_URL}/reset-password.html?token=${created.token}`;
      const sent = await sendEmail(env, email, '[챔로드] 비밀번호 재설정 안내',
        emailShell('비밀번호 재설정', `<p>${escHtml(user.name)}님, 비밀번호를 재설정하려면 아래 버튼을 눌러주세요. (30분 내 유효)</p>
    ${emailButton('비밀번호 재설정', url)}
    <p style="font-size:13px;color:#6b7280">본인이 요청하지 않았다면 이 메일을 무시하세요. 비밀번호는 변경되지 않습니다.</p>`));
      if (sent) {
        // 최신 메일 하나만 유효하게 한다. 오래된 링크가 나중에 사용되는 경로를 닫는다.
        await env.DB.prepare(
          "UPDATE email_tokens SET used_at = ? WHERE user_id = ? AND purpose = 'reset' AND token_hash != ? AND used_at IS NULL"
        ).bind(now, user.id, created.tokenHash).run();
      } else {
        await env.DB.prepare('DELETE FROM email_tokens WHERE token_hash = ?').bind(created.tokenHash).run();
        await releaseEmailCooldown(env.DB, claim);
      }
    }
  }
  return ok(DONE, origin);
}

// 토큰으로 새 비밀번호 설정 — 검증 후 비번 교체 + 재설정 토큰 소진 + 전 세션 무효화.
async function handleResetPassword(request, env, origin) {
  const body = await readJson(request);
  if (!body) return err(400, '잘못된 요청입니다.', origin);
  const token = typeof body.token === 'string' ? body.token.trim() : '';
  const next = body.password;
  if (!validOpaqueToken(token)) return err(400, '유효하지 않은 링크입니다.', origin);
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
  // 같은 링크를 병렬로 보내도 이 조건부 UPDATE에 성공한 한 요청만 비밀번호를 바꿀 수 있다.
  const claimed = await env.DB.prepare(
    "UPDATE email_tokens SET used_at = ? WHERE token_hash = ? AND purpose = 'reset' AND used_at IS NULL AND expires_at >= ?"
  ).bind(now, tokenHash, now).run();
  if (claimed.meta.changes !== 1)
    return err(400, '링크가 만료되었거나 이미 사용되었습니다. 재설정을 다시 요청해주세요.', origin);

  try {
    await env.DB.batch([
      env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(newHash, row.user_id),
      // 이 사용자의 다른 미사용 재설정 토큰도 전부 소진
      env.DB.prepare("UPDATE email_tokens SET used_at = ? WHERE user_id = ? AND purpose = 'reset' AND used_at IS NULL").bind(now, row.user_id),
      // 비번이 바뀌었으니 기존 세션 전부 종료 → 재로그인 유도
      env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(row.user_id),
    ]);
  } catch (e) {
    // 토큰은 이미 소진됐으므로 재사용시키지 않는다. 이용자는 새 링크를 요청하면 된다.
    console.error('reset finalize failed', e.message);
    return err(500, '비밀번호 변경을 완료하지 못했습니다. 재설정 메일을 다시 요청해주세요.', origin);
  }
  // 재설정 성공 = 이메일 통제 입증 → 로그인 실패 잠금도 해제
  if (urow) await env.DB.prepare('DELETE FROM login_attempts WHERE email = ?').bind(urow.email).run();
  return ok({ message: '비밀번호가 변경되었습니다. 새 비밀번호로 로그인해주세요.' }, origin);
}

// 이메일 인증 토큰 소진 → email_verified = 1. 만료만 아니면 멱등(이미 인증돼도 성공).
async function handleVerifyEmail(request, env, origin) {
  const body = await readJson(request);
  if (!body) return err(400, '잘못된 요청입니다.', origin);
  const token = typeof body.token === 'string' ? body.token.trim() : '';
  if (!validOpaqueToken(token)) return err(400, '유효하지 않은 링크입니다.', origin);
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
  await sendVerifyEmail(env, session.id, session.email, session.name);
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
  const deprecated = [];
  for (const r of (rows.results || [])) {
    if (DEPRECATED_SYNC_KEYS.has(r.key)) { deprecated.push(r.key); continue; }
    try { data[r.key] = JSON.parse(r.value); } catch { /* 손상 값은 건너뜀 */ }
  }
  if (deprecated.length) {
    // 응답에서는 이미 제외했다. 정리용 쓰기 실패가 정상적인 데이터 조회까지 막지 않게 한다.
    try {
      await env.DB.batch(deprecated.map(key =>
        env.DB.prepare('DELETE FROM user_data WHERE user_id = ? AND key = ?').bind(session.id, key)));
    } catch (e) {
      console.error('deprecated sync-key cleanup failed');
    }
  }

  // ⚠️ plan_packages를 주문 원장의 만료되지 않은 이용권으로 덮어쓴다.
  //    프론트 requirePackage()가 이 값으로 유료 콘텐츠 접근을 판정하므로, 여기서 거르지 않으면
  //    이용기간이 지나도 계속 열린다. user_data의 원본은 건드리지 않고 응답만 필터링한다.
  const ents = await activeEntitlements(env.DB, session.id);
  const activeKeys = ents.map(e => e.package);
  const known = new Set(Object.keys(PACKAGE_TERMS));
  const owned = Array.isArray(data.plan_packages) ? data.plan_packages : [];
  // PACKAGE_TERMS에 없는 레거시 키는 만료 개념이 없으므로 그대로 통과시킨다.
  // ⚠️ **유효한 이용권(activeKeys)은 user_data에 무엇이 남아 있든 항상 합집합으로 넣는다.**
  //    마이페이지의 '저장된 데이터 삭제'가 user_data의 plan_* 키까지 지워 버리면
  //    정상 구매자가 유료 콘텐츠에서 잠기는데(결제는 살아 있는데 화면만 닫힌다),
  //    entitlement_grants가 진짜 원본이므로 여기서 되살린다.
  data.plan_packages = [...new Set([
    ...owned.filter(k => !known.has(k) || activeKeys.includes(k)),
    ...activeKeys,
  ])];
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

function syncValueHasType(value, type) {
  if (type === 'array') return Array.isArray(value);
  if (type === 'object') return !!value && typeof value === 'object' && !Array.isArray(value);
  return typeof value === type;
}

// 민감·prototype 관련 필드는 깊이에 관계없이 제거한다. 프런트의 top-level 제거만 믿으면
// API 직접 호출이나 이전 버전 클라이언트가 건강·채무원인을 D1에 남길 수 있다.
function sanitizeSyncTree(value, state, depth = 0) {
  if (depth > 20 || ++state.nodes > 5000) throw new Error('sync value too complex');
  if (Array.isArray(value)) return value.map(v => sanitizeSyncTree(v, state, depth + 1));
  // 문자열 leaf 상태에서 먼저 가려야 실제 줄바꿈이 JSON.stringify 후 "\\n"으로 바뀌어
  // 정규식 경계를 우회하는 것을 막을 수 있다. 직렬화 뒤에도 한 번 더 마스킹한다.
  if (!value || typeof value !== 'object') return typeof value === 'string' ? maskIdNumbers(value) : value;

  const out = Object.create(null);
  for (const [key, child] of Object.entries(value)) {
    const normalized = key.toLowerCase().replace(/[^a-z]/g, '');
    if (FORBIDDEN_SYNC_FIELDS.has(normalized)) {
      state.dropped++;
      continue;
    }
    out[key] = sanitizeSyncTree(child, state, depth + 1);
  }
  return out;
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
  let droppedSensitiveFields = 0;

  if (clearAll) {
    // 결제로 만든 plan* 캐시만 보존하고 나머지를 모두 지운다. 허용목록 도입 전에 저장된
    // 임의/민감 키도 이때 함께 없어져야 '전체 초기화'라는 이용자 기대와 일치한다.
    const planKeys = [...PLAN_KEYS];
    const placeholders = planKeys.map(() => '?').join(',');
    stmts.push(env.DB.prepare(`DELETE FROM user_data WHERE user_id = ? AND key NOT IN (${placeholders})`)
      .bind(session.id, ...planKeys));
    // '저장된 데이터 전체 초기화'는 AI 검토 이용 이력까지 지운다 — 방침상 삭제 요청 대상.
    stmts.push(env.DB.prepare('DELETE FROM ai_usage WHERE user_id = ?').bind(session.id));
  }
  for (const k of putKeys) {
    // 이용권(plan*) 키는 결제 검증을 거친 서버 원장 코드만 쓸 수 있다.
    // 클라이언트가 localStorage에 심어 올려도 무시 — 결제 없이 프리미엄 위조 차단.
    if (PLAN_KEYS.has(k)) continue;
    const rule = SYNC_KEY_RULES.get(k);
    if (!rule) return err(400, '저장할 수 없는 데이터 항목이 포함되어 있습니다.', origin);
    if (DEPRECATED_SYNC_KEYS.has(k)) {
      stmts.push(env.DB.prepare('DELETE FROM user_data WHERE user_id = ? AND key = ?')
        .bind(session.id, k));
      continue;
    }
    if (!syncValueHasType(put[k], rule.type))
      return err(400, `${k} 데이터 형식이 올바르지 않습니다.`, origin);

    const state = { nodes: 0, dropped: 0 };
    let safeValue;
    try { safeValue = sanitizeSyncTree(put[k], state); }
    catch { return err(400, `${k} 데이터 구조가 너무 복잡합니다.`, origin); }
    droppedSensitiveFields += state.dropped;

    let serialized;
    try { serialized = JSON.stringify(safeValue); }
    catch { return err(400, `${k} 데이터를 저장할 수 없습니다.`, origin); }
    if (serialized == null) return err(400, `${k} 데이터를 저장할 수 없습니다.`, origin);
    // 주민등록번호는 어떤 경로로도 서버에 남지 않게 한다(개인정보 보호법 제24조의2 — 동의로도 처리 불가).
    // 여기는 모든 앱데이터가 지나가는 길목이라, 앞으로 새 기능이 추가돼도 자동으로 보호된다.
    serialized = maskIdNumbers(serialized);
    if (new TextEncoder().encode(serialized).length > rule.maxBytes)
      return err(413, `${k} 저장 용량이 초과되었습니다.`, origin);
    stmts.push(env.DB.prepare(
      `INSERT INTO user_data (user_id, key, value, updated_at) VALUES (?1, ?2, ?3, ?4)
       ON CONFLICT(user_id, key) DO UPDATE SET value = ?3, updated_at = ?4`
    ).bind(session.id, k, serialized, now));
  }
  for (const k of del) {
    if (typeof k !== 'string' || !k)
      return err(400, '삭제할 데이터 항목이 올바르지 않습니다.', origin);
    // put 루프와 같은 이유로 이용권 키는 클라이언트가 지울 수 없다 —
    // 지우게 두면 '저장된 데이터 삭제'가 결제한 접근권까지 없앤다.
    if (PLAN_KEYS.has(k)) continue;
    if (!SYNC_KEY_RULES.has(k))
      return err(400, '삭제할 수 없는 데이터 항목이 포함되어 있습니다.', origin);
    stmts.push(env.DB.prepare('DELETE FROM user_data WHERE user_id = ? AND key = ?')
      .bind(session.id, k));
  }

  if (stmts.length) await env.DB.batch(stmts);   // D1 batch = 트랜잭션
  return ok({ droppedSensitiveFields }, origin);
}

/* ── 주민등록번호 자동 가리기 (진짜 경계선) ──
   「개인정보 보호법」 제24조의2: 법령에 구체적 근거가 없으면 주민등록번호는 **동의를 받아도** 처리할 수 없다.
   화면(js/main.js maskIdNumbers)에서도 가리지만 클라이언트는 우회할 수 있으므로, 외부(Anthropic)로
   나가기 전과 저장 전에 서버가 다시 지운다. 한쪽만 고치지 말 것 — 두 곳의 정규식은 같아야 한다.

   ⚠️ 구분자를 하이픈 하나로만 보면 안 된다(2026-08-15 보안감사에서 11/14 통과). HWP·Word는 숫자 사이
      하이픈을 자동으로 en dash(–)로 바꾸고 PDF 복사는 U+2010을 낳는다. 즉 법원 서류를 붙여넣는
      정상 경로가 곧 우회 경로였다. 전각 숫자(０~９)도 같은 이유로 함께 본다.
   ⚠️ 뒤 7자리 첫 글자는 [1-8]을 유지한다(1~4 내국인 / 5~8 외국인등록번호). 9·0은 1900년 이전 출생이라
      사실상 없는데, 넣으면 6자리+7자리 형식의 계좌번호를 잘못 가린다.
   하이픈류·붙여쓴 형식은 형식 자체가 강한 신호라 항상 가린다. 공백·점·줄바꿈 형식은 금액 목록을
   잘못 가릴 수 있으므로 생년월일과 뒷자리 구분자가 그럴듯한 경우에 가린다. OCR 오류로 검증번호가
   틀린 식별번호도 남기지 않는 쪽을 택한다. 이 규칙은 화면과 서버가 같아야 하며 최종 신뢰 경계는 서버다. */
const RRN_MASK = '○○○○○○-○○○○○○○';
const RRN_RE = /(?<![0-9０-９])[0-9０-９]{6}[-­‐-―−－]?[1-8１-８][0-9０-９]{6}(?![0-9０-９])/g;
const RRN_FLEX_RE = /(?<![0-9０-９])([0-9０-９]{6})([ \t.\r\n]{1,8})([1-8１-８][0-9０-９]{6})(?![0-9０-９])/g;

function idAsciiDigits(value) {
  return String(value || '').replace(/[０-９]/g, ch => String(ch.charCodeAt(0) - 0xFF10));
}
function idDatePlausible(digits) {
  const month = Number(digits.slice(2, 4));
  const day = Number(digits.slice(4, 6));
  const max = [0, 31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month] || 0;
  return day >= 1 && day <= max;
}
function idChecksumValid(value) {
  const digits = idAsciiDigits(value).replace(/\D/g, '');
  if (digits.length !== 13 || !idDatePlausible(digits.slice(0, 6))) return false;
  const weights = [2, 3, 4, 5, 6, 7, 8, 9, 2, 3, 4, 5];
  const sum = weights.reduce((total, weight, i) => total + Number(digits[i]) * weight, 0);
  const base = (11 - (sum % 11)) % 10;
  const expected = Number(digits[6]) >= 5 ? (base + 2) % 10 : base;
  return expected === Number(digits[12]);
}
function idShapePlausible(value) {
  const digits = idAsciiDigits(value).replace(/\D/g, '');
  return digits.length === 13
    && idDatePlausible(digits.slice(0, 6))
    && /^[1-8]$/.test(digits[6]);
}
function idLabelNearby(text, offset, length) {
  const around = text.slice(Math.max(0, offset - 48), Math.min(text.length, offset + length + 24));
  return /주민\s*(?:등록\s*)?번호|외국인\s*등록\s*번호/.test(around);
}

function maskIdNumbers(text) {
  if (typeof text !== 'string') return text;
  const strictMasked = text.replace(RRN_RE, RRN_MASK);
  return strictMasked.replace(RRN_FLEX_RE, (match, first, separator, second, offset, whole) =>
    (idChecksumValid(first + second) || idShapePlausible(first + second)
      || idLabelNearby(whole, offset, match.length)) ? RRN_MASK : match
  );
}

/* ── AI 서류검토 (Phase 3) ── */
// 실제 Claude API 호출. 법률 자문·결과 예측 금지, '서류 완성도 점검'으로만 제약.

// 출력 스키마 — '판정'과 '대필'이 물리적으로 들어갈 자리가 없도록 설계했다.
//
//   · 대체 문장을 담을 필드가 없다        → 대필(서류 작성)이 구조적으로 불가능
//   · 적합/부적합·점수·등급 필드가 없다   → 감정이 구조적으로 불가능
//   · 지적은 반드시 question을 동반한다    → 문장은 언제나 이용자가 쓴다
// 프롬프트로만 금지하면 모델이 넘어가므로 스키마로 강제한다. 필드를 추가할 때 이 원칙을 깨지 말 것.
//
// ⛔ 옛 주석은 "법무사법 제2조 제1항 제1호와 변호사법 제109조 제1호 어디에도 '점검'과 '질문'은
//    없으므로 허용된다"고 적고 있었다. **이 가정에 기대지 말 것** — 2026-08-18 판례 조사에서
//    무너졌다. 법무사법 제2조 제1항 **제8호**가 "제1호부터 제7호까지의 사무를 처리하기 위하여
//    필요한 **상담·자문** 등 부수되는 사무"를 법무사 업무로 명시하고, 헌재 2020헌마1491(2025-08-21)이
//    이를 전원일치 합헌으로 확정했다. 즉 '작성'을 피해도 '상담·자문' 축은 남는다.
//    스키마 제약은 위험을 **낮추는** 장치이지 적법성을 보장하는 근거가 아니다.
//
// 🔴 lawNotes(조문 인용 + 확인 질문) 필드는 2026-08-18에 **제거했다. 되살리지 말 것.** 이유 둘:
//    ① 이용자가 쓴 문구 옆에 조문을 붙이는 형태가 '개별 사실에 대한 법 적용'에 가장 가까웠다.
//    ② 실측에서 조문 번호가 틀렸다 — 30건 평가에서 lawNotes 11건 중 5건이 도박·낭비를
//       제564조 제1항 '제4호'로 인용했다(정답 제6호, 제4호는 면책 재신청 제한).
//       숫자 계산을 numcheck로 뺀 것과 같은 이유다: 언어모델이 만든 번호는 틀려도 그럴듯하다.
//    조문 정보는 사람이 검증해 정적 페이지에 둔다 — bankruptcy.html#discharge-denial.
//    AI는 그 자리로 보내기만 한다(ai-review.html의 안내 문구).
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
  },
  required: ['present', 'questions'],
  additionalProperties: false,
};

const AI_SYSTEM_PROMPT = `당신은 대한민국 개인회생·파산 절차에서 이용자가 **스스로** 서류를 완성하도록 돕는 점검 보조자다. 이용자가 직접 작성한 법원 제출용 서류 초안을 읽고, 빠진 것을 '질문'으로 돌려준다.

## 당신이 하는 일
초안에 **들어 있는 것**을 확인하고, **법원이 추가로 물을 만한데 빠진 것**을 질문으로 만든다. 그 둘뿐이다.

## 절대 금지 (구조적 이유가 있다)
1. **대체 문장을 쓰지 않는다.** "이렇게 쓰세요: ~", "예: 2019년 5월경 생활비 부족으로…" 같이 이용자가 그대로 옮겨 적을 문장을 만들어 주는 것은 법원 제출 서류의 '작성'에 해당한다(법무사법 제2조 제1항 제1호). 무엇이 빠졌는지 알려주고 질문만 한다.
2. **판정하지 않는다.** "미흡하다", "충분하다", "제출해도 된다", "통과 가능성이 높다" 같은 평가·등급·점수를 내지 않는다. 이는 감정에 해당한다(변호사법 제109조 제1호).
3. **결과를 예측하지 않는다.** 면책·인가 여부, 성공 가능성을 말하지 않는다.
4. **이 사람의 사정에 법을 적용해 결론 내지 않는다.** "이 경우는 재량면책 대상이다" 같은 판단은 법률상담이다.
7. 🔴**조문 번호를 쓰지 않는다.** "제564조", "제1항 제6호", "채무자회생법 제○조" 같은 조·항·호 번호를 출력에 절대 담지 않는다. 법령 이름만 스치듯 언급하는 것도 하지 않는다. 조문 정보는 사람이 검증해 사이트의 안내 페이지에 두었고, 화면이 그 링크를 따로 보여준다. 언어모델이 기억에서 꺼낸 조문 번호는 **틀려도 그럴듯해서** 이용자가 엉뚱한 조항을 찾아가게 만든다(실측에서 실제로 5건이 틀렸다). 숫자 계산을 하지 않는 것과 같은 이유다.
5. 추측으로 사실을 만들지 않는다. 초안에 없는 내용을 있는 것처럼 쓰지 않는다.
6. **숫자를 계산하지 않는다.** 합계·차액·비율(안분율)·곱셈(가용소득×변제횟수)을 직접 계산하거나 "합계가 맞지 않습니다", "합계는 ○○원입니다" 같이 검산 결과를 말하지 않는다. 언어모델의 산술은 틀려도 그럴듯해 보이고, 이 서비스는 그 검산을 별도의 계산 코드(숫자 검산기)로 처리한다. 금액이 걸린 항목은 계산하지 말고 **질문으로만** 돌려준다 — 예: "채권자별 금액의 합계가 목록 맨 아래 합계 칸과 같은지 확인하셨나요? (사이트의 '숫자 검산기'에서 계산해 볼 수 있습니다)"

## 질문을 만드는 법
- 나쁜 예(판정): "채무 발생 경위가 불충분합니다."
- 나쁜 예(대필): "'2020년 코로나로 매출이 급감하여'라고 쓰세요."
- **좋은 예(질문)**: topic="2020~2022년 채무가 늘어난 사정", question="이 기간에 어떤 일이 있었나요? 채무가 늘어난 계기를 적어 두셨나요?"
- 질문은 이용자가 답을 **직접 쓰도록** 유도한다. 답의 예시를 주지 않는다.

## 법원이 특히 눈여겨보는 표현이 초안에 있을 때
도박, 주식·코인 투자, 사치성 소비, 특정 채권자에게만 변제, 재산 처분처럼 법원이 경위를 더 물을 수 있는 내용이 초안에 있으면 **그냥 넘기지 말고 questions로 만든다.** 이용자가 그 사정을 스스로 적어 둘 기회를 놓치면 나중에 보정으로 돌아온다.

다만 **조문 번호를 붙이지 않는다**(금지 7). 판정도 하지 않는다.
- 나쁜 예: "이는 채무자회생법 제564조 제1항 제6호의 면책불허가 사유에 해당합니다."
- 나쁜 예: "도박 채무는 면책이 어렵습니다."
- **좋은 예**: topic="도박으로 채무가 늘어난 사정", question="언제부터 언제까지였고 지금은 어떤 상태인지, 중단한 계기와 그 뒤의 생활을 적어 두셨나요?"

초안에 그런 표현이 없으면 **만들어내지 않는다.** 없는 위험을 지어내지 않는다.

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
  employed:     '현재 재직 중(퇴직급여 제도 종류와 예상액의 반영 여부를 확인할 필요가 있다)',
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
  const str = (v) => (typeof v === 'string' ? stripStatuteRefs(v.trim()) : '');
  const arr = (v) => (Array.isArray(v) ? v : []);
  return {
    present: arr(parsed.present).map(str).filter(Boolean).slice(0, 12),
    questions: arr(parsed.questions)
      .filter(q => q && str(q.question))
      .map(q => ({ topic: str(q.topic), question: str(q.question) }))
      .slice(0, 12),
  };
}

/* 조문 번호 제거 — 프롬프트 금지 7의 서버측 백스톱.
 *
 * 프롬프트로만 금지하면 모델이 넘어간다는 것이 이 코드베이스의 전제다(AI_REVIEW_SCHEMA 주석).
 * 조문 번호는 lawNotes를 없앤 뒤에도 questions·present의 자유 문자열로 새어 나올 수 있고,
 * 언어모델이 기억에서 꺼낸 번호는 틀려도 그럴듯하다 — 실측에서 도박·낭비를 제564조 제1항
 * '제4호'로 인용한 것이 11건 중 5건이었다(정답 제6호).
 *
 * 그래서 조·항·호 번호를 통째로 '관련 법령'으로 바꾼다. 항목을 통째로 버리지 않는 이유는
 * 질문 자체는 쓸모가 있기 때문이다 — 번호만 지우면 이용자는 검증된 안내 페이지로 가게 된다.
 * ⚠️ 이 함수를 지우려면 AI_REVIEW_SCHEMA 주석의 lawNotes 제거 사유부터 다시 읽을 것.
 */
const STATUTE_REF_RE =
  /(?:「[^」]{2,30}」\s*)?(?:[가-힣]{2,15}법(?:률)?\s*)?제\s*\d+\s*조(?:\s*의\s*\d+)?(?:\s*제\s*\d+\s*항)?(?:\s*제\s*\d+\s*호)?/g;

function stripStatuteRefs(text) {
  if (!text || !text.includes('조')) return text;
  let hit = 0;
  const out = text.replace(STATUTE_REF_RE, () => { hit++; return '관련 법령'; });
  // 괄호만 남는 경우 정리: "…사정 (관련 법령)" → "…사정"
  const tidied = out.replace(/\s*[(（]\s*관련 법령\s*[)）]/g, '').replace(/\s{2,}/g, ' ').trim();
  if (hit) console.warn('AI_STATUTE_REF_STRIPPED', hit);   // 새는 빈도를 재기 위한 로그(본문은 남기지 않는다)
  return tidied;
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

  // 회수는 **부르기 전에** 깎는다. 실패하면 아래에서 되돌린다(reserveAiQuota 주석 참조).
  const gate = await reserveAiQuota(env, session, origin);
  if (gate.error) return gate.error;

  let review;
  try {
    review = await callClaude(env.ANTHROPIC_API_KEY, docLabel, checklist, text, context);
  } catch (e) {
    await gate.rollback();
    console.error('ai review failed', e.message);
    return err(502, 'AI 검토 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.', origin);
  }

  try {
    // 결과를 보내기 전에 유료 서비스 제공 개시를 기록한다. 기록 실패 시 결과도 보내지 않는다.
    await recordPackageConsumption(env.DB, session.id, gate.ent.package);
  } catch (e) {
    await gate.rollback();
    console.error('ai consumption record failed', e.message);
    return err(503, '이용 기록을 저장하지 못해 검토 결과를 제공하지 않았습니다. 잠시 후 다시 시도해주세요.', origin);
  }

  return ok({ review, ...gate.spent }, origin);
}

/* ── 민감정보 처리에 대한 별도 동의 (개인정보 보호법 제23조) ──
   진술서·경위서에는 질병·치료 같은 **건강에 관한 정보**가 사실상 반드시 들어간다(채무가 왜 생겼는지를
   써야 하므로). 이는 제23조 제1항의 민감정보이고, 처리하려면 "정보주체에게 처리사실을 알리고
   **다른 개인정보 처리에 대한 동의와 별도로** 동의를 받은 경우"여야 한다.

   종전에는 동의 절차가 없어 "개인정보는 지우고 넣으세요"로 막았는데, 그러면 채무 발생 경위를
   제대로 쓸 수 없어 검토가 의미를 잃는다. 그래서 **동의를 제대로 받고 있는 그대로 받는다.**

   ⚠️ 주민등록번호는 이 동의로도 처리할 수 없다(제24조의2) — 그쪽은 maskIdNumbers가 지운다.
   ⚠️ 동의 사실의 입증책임은 처리자에게 있으므로(제23조 제1항 제1호의 '별도 동의' 요건 + 제22조 제1항 제5호)
      화면 체크만으로는 부족하다. 🔴제22조 **제3항**을 이 근거로 인용하지 말 것 — 그 항의 입증책임은
      "**동의 없이** 처리할 수 있는 개인정보라는 것"에 대한 입증책임이지 동의 취득의 입증책임이 아니다
      (2026-08-12 반박 검증에서 정정. CLAUDE.md「개인정보」②와 같은 내용이다).
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

/* ── AI 회수 예약·환원 (서류검토와 서류 간 대조가 같은 회수를 쓴다) ──
   두 기능이 같은 Anthropic 실비를 태우므로 회수도 한 주머니에서 나간다.
   나눠서 관리하면 이용자도 헷갈리고 잔여 표시도 두 벌이 된다.

   🔴 **먼저 깎고 부르고, 실패하면 되돌린다.** 종전에는 "검사 → Claude 호출 → 차감" 순서였는데,
   검사와 차감 사이에 Anthropic 왕복(수 초)이 통째로 들어가 그 사이 도착한 동시 요청이 **전부 검사를
   통과**했다(2026-08-15 보안감사·반박검증 CONFIRMED). 차감은 `ai_used < ai_quota` 가드가 12에서
   멈추지만 **이미 발사된 API 호출의 실비는 되돌아오지 않는다.** Anthropic은 선불이라 잔액이 마르면
   정상 구매자의 검토가 즉시 중단된다. 버튼 두 번 누르기로도 회수 1회에 2건이 나갔다.

   원자성은 조건부 UPDATE의 `meta.changes`로 만든다 — SELECT로 읽고 판단하면 그 사이가 다시 열린다.
   Workers는 `fetch()` 대기 중에도 다른 요청을 받고(대기는 CPU 시간에 잡히지 않는다), D1은
   요청 간 트랜잭션을 걸어 주지 않으므로 애플리케이션 층에서 이렇게 막아야 한다.

   ⚠️ `DAILY_AI_LIMIT`은 **이용자 1인당**이다. 앱 전체 상한(전역 백스톱)은 존재하지 않는다 —
   OPERATIONS-COST.md가 "앱 전체 일 30회"라고 적은 것은 사실과 다르다. 비용 상한을 계산할 때 주의. */
async function reserveAiQuota(env, session, origin) {
  // 주문별 원장에서만 차감한다. 이미 제공이 개시된 상품을 먼저, 그 안에서는 만료 임박순으로
  // 소진해 새 주문의 회수가 오래된/만료된 주문과 섞이거나 재구매 때 부활하지 않게 한다.
  const now = Date.now();
  const ents = await activeEntitlements(env.DB, session.id, now);
  const candidates = await env.DB.prepare(
    `SELECT g.id, g.package, g.expires_at, g.ai_quota, g.ai_used
       FROM entitlement_grants g
       WHERE g.user_id=? AND g.status='active' AND g.granted_at<=? AND g.expires_at>?
        AND g.ai_used<g.ai_quota
      ORDER BY CASE WHEN EXISTS (
                 SELECT 1 FROM content_access c
                  WHERE c.user_id=g.user_id AND c.package=g.package
               ) THEN 0 ELSE 1 END,
               g.expires_at ASC, g.granted_at ASC, g.id ASC`
  ).bind(session.id, now, now).all();

  if (!(candidates.results || []).length) {
    return { error: err(403, ents.length
      ? '보유하신 패키지의 서류검토 AI 회수를 모두 사용했습니다. 추가 회수는 요금제에서 구매하실 수 있습니다.'
      : '서류검토 AI는 패키지를 구매하신 회원만 이용할 수 있습니다.', origin) };
  }

  // 남용 방지용 1인 1일 상한(총량제와 별개). 스크립트로 총량을 한 번에 태우는 것을 막는다.
  // 행을 먼저 0으로 만들어 두고(경합해도 ON CONFLICT DO NOTHING으로 하나만 성공) 조건부 증가로 게이트를 건다.
  const day = new Date(now).toISOString().slice(0, 10);
  await env.DB.prepare(
    'INSERT INTO ai_usage (user_id, day, count) VALUES (?1, ?2, 0) ON CONFLICT(user_id, day) DO NOTHING'
  ).bind(session.id, day).run();
  const daily = await env.DB.prepare(
    'UPDATE ai_usage SET count = count + 1 WHERE user_id = ? AND day = ? AND count < ?'
  ).bind(session.id, day, DAILY_AI_LIMIT).run();
  if (daily.meta.changes !== 1)
    return { error: err(429, `오늘 이용 가능한 검토 횟수(${DAILY_AI_LIMIT}회)를 모두 사용했습니다. 내일 다시 이용해주세요.`, origin) };
  // 화면에 "오늘 이용 N/10회"를 그리므로 증가 후 값을 다시 읽는다(표시용이라 경합해도 무해).
  const after = await env.DB.prepare('SELECT count FROM ai_usage WHERE user_id = ? AND day = ?')
    .bind(session.id, day).first();
  const usedToday = after ? after.count : 1;

  // 조회 뒤 다른 요청이 선점할 수 있으므로 후보를 순서대로 조건부 UPDATE한다.
  let ent = null;
  for (const candidate of (candidates.results || [])) {
    const taken = await env.DB.prepare(
      `UPDATE entitlement_grants SET ai_used=ai_used+1
        WHERE id=? AND user_id=? AND status='active' AND granted_at<=? AND expires_at>?
          AND ai_used<ai_quota`
    ).bind(candidate.id, session.id, now, now).run();
    if (d1Changes(taken) === 1) { ent = candidate; break; }
  }
  if (!ent) {
    await releaseDaily(env, session.id, day);
    return { error: err(403, '보유하신 패키지의 서류검토 AI 회수를 모두 사용했습니다. 추가 회수는 요금제에서 구매하실 수 있습니다.', origin) };
  }

  return {
    ent, day,
    // 이미 깎은 상태의 값이다(예약 성공 = 사용 확정). 호출이 실패하면 rollback이 되돌린다.
    spent: {
      quota: { type: 'package', package: ent.package, used: ent.ai_used + 1, limit: ent.ai_quota, left: ent.ai_quota - ent.ai_used - 1 },
      usage: { used: usedToday, limit: DAILY_AI_LIMIT },
    },
    // Claude 호출이 실패했을 때만 부른다 — 실패한 호출이 회수를 소모하면 안 된다.
    rollback: async () => {
      try {
        await env.DB.batch([
          env.DB.prepare('UPDATE ai_usage SET count = count - 1 WHERE user_id = ? AND day = ? AND count > 0')
            .bind(session.id, day),
          env.DB.prepare('UPDATE entitlement_grants SET ai_used=ai_used-1 WHERE id=? AND user_id=? AND ai_used>0')
            .bind(ent.id, session.id),
        ]);
      } catch (e) {
        // 환원 실패는 이용자에게 알리지 않는다(원 오류가 더 중요하다). 회수 1회를 손해 보는 쪽이 안전하다.
        console.error('ai quota rollback failed', e.message);
      }
    },
  };
}

async function releaseDaily(env, userId, day) {
  try {
    await env.DB.prepare('UPDATE ai_usage SET count = count - 1 WHERE user_id = ? AND day = ? AND count > 0')
      .bind(userId, day).run();
  } catch (e) {
    console.error('ai daily release failed', e.message);
  }
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

  // 서류검토와 같은 주머니를 쓴다 — 여기도 선차감이다.
  const gate = await reserveAiQuota(env, session, origin);
  if (gate.error) return gate.error;

  let result;
  try {
    result = await callClaudeCrosscheck(env.ANTHROPIC_API_KEY, docLabel, text, figures, context);
  } catch (e) {
    await gate.rollback();
    console.error('ai crosscheck failed', e.message);
    return err(502, 'AI 대조 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.', origin);
  }

  try {
    await recordPackageConsumption(env.DB, session.id, gate.ent.package);
  } catch (e) {
    await gate.rollback();
    console.error('ai consumption record failed', e.message);
    return err(503, '이용 기록을 저장하지 못해 대조 결과를 제공하지 않았습니다. 잠시 후 다시 시도해주세요.', origin);
  }

  return ok({ result, ...gate.spent }, origin);
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
    // signupCap: 이 수를 넘으면 **가입 인증메일만** 끊긴다(재설정·주문확인 몫을 남기기 위해).
    // 화면이 "67/100"만 보여 주면 운영자는 이미 가입이 막힌 줄 모른다 — 그래서 임계값을 함께 내려보낸다.
    email: { today: (emailToday && emailToday.count) || 0, month: (emailMonth && emailMonth.n) || 0,
             dailyLimit: EMAIL_DAILY_FREE, signupCap: SIGNUP_EMAIL_DAILY_CAP },
    ai:    { today: (aiToday && aiToday.n) || 0, month: (aiMonth && aiMonth.n) || 0 },
    // Anthropic 잔액은 조회 API가 없다 — 화면이 이 사실을 그대로 표시한다(위 주석 참조).
    anthropic: { balanceApi: false, reason: '남은 크레딧을 조회하는 공개 API가 없습니다. 콘솔에서 확인해 주세요.' },
    // 시크릿이 빠지면 조용히 무효가 되는 것들. **값은 절대 내보내지 않고 설정 여부만** 본다.
    // Turnstile 시크릿이 없으면 verifyTurnstile이 무조건 통과라 자동 가입 방지가 통째로 사라지는데,
    // 화면에는 아무 표시가 없어 알아챌 방법이 없었다(2026-08-16 보안감사에서 '확인 불가'로 남았던 항목).
    secrets: {
      turnstile: !!env.TURNSTILE_SECRET,
      resend: !!env.RESEND_API_KEY,
      anthropic: !!env.ANTHROPIC_API_KEY,
      solapi: !!(env.SOLAPI_API_KEY && env.SOLAPI_API_SECRET && env.SMS_SENDER),
      portone: !!(env.PORTONE_STORE_ID && env.PORTONE_CHANNEL_KEY && env.PORTONE_API_SECRET),
    },
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
    `SELECT package, MAX(expires_at) AS expires_at,
            SUM(ai_quota) AS ai_quota, SUM(ai_used) AS ai_used
       FROM entitlement_grants
      WHERE user_id = ? AND status = 'active' AND granted_at <= ? AND expires_at > ?
      GROUP BY package`
  ).bind(userId, now, now).all();
  return rows.results || [];
}

const FULFILLMENT_LEASE_MS = 60_000;

function d1Changes(result) {
  return Number(result && result.meta && result.meta.changes) || 0;
}

// 결제별 claim. INSERT/조건부 UPSERT 한 문장이라 같은 paymentId의 병렬 요청 중 하나만 임대를 얻는다.
// Worker가 중간 종료되면 lease 만료 후 retry/processing 행을 다른 요청이 이어받는다.
async function claimPaymentFulfillment(db, paymentId, now = Date.now()) {
  const token = crypto.randomUUID();
  const claimed = await db.prepare(
    `INSERT INTO payment_fulfillments
       (payment_id, state, claim_token, claim_expires_at, attempts, last_error, updated_at)
     VALUES (?1, 'processing', ?2, ?3, 1, NULL, ?4)
     ON CONFLICT(payment_id) DO UPDATE SET
       state='processing', claim_token=?2, claim_expires_at=?3,
       attempts=payment_fulfillments.attempts+1, last_error=NULL, updated_at=?4
     WHERE payment_fulfillments.state='retry'
        OR (payment_fulfillments.state='processing' AND payment_fulfillments.claim_expires_at < ?4)`
  ).bind(paymentId, token, now + FULFILLMENT_LEASE_MS, now).run();
  if (d1Changes(claimed) === 1) return { claimed: true, token };
  const state = await db.prepare(
    'SELECT state, fulfilled_at FROM payment_fulfillments WHERE payment_id = ?'
  ).bind(paymentId).first();
  return { claimed: false, state: state && state.state, fulfilledAt: state && state.fulfilled_at };
}

async function markFulfillmentRetry(db, paymentId, token, error, now = Date.now()) {
  await db.prepare(
    `UPDATE payment_fulfillments
        SET state='retry', claim_token=NULL, claim_expires_at=NULL, last_error=?, updated_at=?
      WHERE payment_id=? AND state='processing' AND claim_token=?`
  ).bind(String(error || 'fulfillment failed').slice(0, 500), now, paymentId, token).run();
}

async function claimEntitlementLock(db, userId, pkgKey, token, now = Date.now()) {
  const result = await db.prepare(
    `INSERT INTO entitlement_locks (user_id, package, claim_token, claim_expires_at)
     VALUES (?1, ?2, ?3, ?4)
     ON CONFLICT(user_id, package) DO UPDATE SET claim_token=?3, claim_expires_at=?4
     WHERE entitlement_locks.claim_expires_at < ?5`
  ).bind(userId, pkgKey, token, now + FULFILLMENT_LEASE_MS, now).run();
  return d1Changes(result) === 1;
}

async function releaseEntitlementLock(db, userId, pkgKey, token) {
  await db.prepare(
    'DELETE FROM entitlement_locks WHERE user_id=? AND package=? AND claim_token=?'
  ).bind(userId, pkgKey, token).run();
}

// 주문 한 건을 기간·AI 회수 한 덩어리로 확정한다. payment_id UNIQUE와 D1 batch가 최종
// 중복 방어선이다. 서로 다른 동시 주문은 패키지 잠금으로 기간이 같은 시작점에서 겹치지 않는다.
async function fulfillOrderGrant(env, order, targetStatus = 'paid', now = Date.now()) {
  const term = PACKAGE_TERMS[order.package];
  if (!term) throw new Error('unknown package term');

  const existing = await env.DB.prepare(
    'SELECT starts_at, expires_at, ai_quota FROM entitlement_grants WHERE payment_id = ?'
  ).bind(order.payment_id).first();
  if (existing) {
    return { newlyFulfilled: false, entitlement: existing };
  }

  const claim = await claimPaymentFulfillment(env.DB, order.payment_id, now);
  if (!claim.claimed) {
    if (claim.state === 'fulfilled' || claim.state === 'legacy') {
      return { newlyFulfilled: false, legacy: claim.state === 'legacy' };
    }
    const busy = new Error('payment fulfillment is already processing');
    busy.code = 'FULFILLMENT_BUSY';
    throw busy;
  }

  let locked = false;
  try {
    locked = await claimEntitlementLock(env.DB, order.user_id, order.package, claim.token, now);
    if (!locked) {
      await markFulfillmentRetry(env.DB, order.payment_id, claim.token, 'package grant lock busy', now);
      const busy = new Error('package grant is already processing');
      busy.code = 'FULFILLMENT_BUSY';
      throw busy;
    }

    const tail = await env.DB.prepare(
      `SELECT MAX(expires_at) AS expires_at FROM entitlement_grants
        WHERE user_id=? AND package=? AND status='active' AND expires_at>?`
    ).bind(order.user_id, order.package, now).first();
    const startsAt = tail && Number(tail.expires_at) > now ? Number(tail.expires_at) : now;
    const expiresAt = addMonths(startsAt, term.months);
    const source = targetStatus === 'test' ? 'test' : 'order';

    const results = await env.DB.batch([
      env.DB.prepare(
        `INSERT OR IGNORE INTO entitlement_grants
          (payment_id,user_id,package,source,status,granted_at,starts_at,expires_at,ai_quota,ai_used)
         SELECT ?1,?2,?3,?4,'active',?5,?6,?7,?8,0
          WHERE EXISTS (SELECT 1 FROM payment_fulfillments
                         WHERE payment_id=?1 AND state='processing' AND claim_token=?9)`
      ).bind(order.payment_id, order.user_id, order.package, source, now, startsAt, expiresAt, term.aiQuota, claim.token),
      env.DB.prepare(
        `UPDATE payments SET status=?, paid_at=COALESCE(paid_at,?)
          WHERE payment_id=? AND user_id=? AND status IN ('pending','failed',?)`
      ).bind(targetStatus, now, order.payment_id, order.user_id, targetStatus),
      env.DB.prepare(
        `UPDATE payment_fulfillments
            SET state='fulfilled', claim_token=NULL, claim_expires_at=NULL,
                fulfilled_at=?, updated_at=?, last_error=NULL
          WHERE payment_id=? AND state='processing' AND claim_token=?`
      ).bind(now, now, order.payment_id, claim.token),
      env.DB.prepare(
        'DELETE FROM entitlement_locks WHERE user_id=? AND package=? AND claim_token=?'
      ).bind(order.user_id, order.package, claim.token),
    ]);
    locked = false;
    if (d1Changes(results[0]) !== 1 || d1Changes(results[2]) !== 1)
      throw new Error('order grant finalization lost its claim');
    return {
      newlyFulfilled: true,
      entitlement: { starts_at: startsAt, expires_at: expiresAt, ai_quota: term.aiQuota },
    };
  } catch (error) {
    // batch 실패는 D1에서 전체 롤백된다. claim을 retry로 바꾸면 동일 주문 재요청으로 복구 가능하다.
    try { await markFulfillmentRetry(env.DB, order.payment_id, claim.token, error.message, Date.now()); } catch {}
    if (locked) { try { await releaseEntitlementLock(env.DB, order.user_id, order.package, claim.token); } catch {} }
    throw error;
  }
}

// user_data의 plan_*는 하위호환 캐시일 뿐이다. 주문 원장에서 현재 활성 상품을 재구성한다.
async function syncPlanCache(env, userId, preferredPackage) {
  const ents = await activeEntitlements(env.DB, userId);
  const owned = ents.map(e => e.package);
  const rows = await env.DB.prepare(
    "SELECT key, value FROM user_data WHERE user_id = ? AND key IN ('plan_packages','plan_package')"
  ).bind(userId).all();
  const cur = {};
  for (const r of (rows.results || [])) { try { cur[r.key] = JSON.parse(r.value); } catch {} }

  if (owned.length === 0) {
    await env.DB.batch([...PLAN_KEYS].map(k =>
      env.DB.prepare('DELETE FROM user_data WHERE user_id = ? AND key = ?').bind(userId, k)));
    return { plan_packages: [] };
  }

  const pkgKey = owned.includes(preferredPackage) ? preferredPackage
    : (owned.find(k => !k.startsWith('correction-')) || owned[0]);
  const info = PACKAGES[pkgKey] || {};
  const isAddon = pkgKey.startsWith('correction-');
  const prevIsMain = cur.plan_package && !String(cur.plan_package).startsWith('correction-');

  const puts = { plan: 'premium', plan_packages: owned };
  if (!(isAddon && prevIsMain)) {
    puts.plan_type = info.type;
    puts.plan_package = pkgKey;
    puts.plan_package_name = info.name;
  }
  const now = Date.now();

  const ent = ents.find(e => e.package === pkgKey);
  if (ent) puts.plan_expires_at = ent.expires_at;

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

// 유료 콘텐츠 또는 AI 서비스를 처음 제공한 시각을 기록한다(패키지별 최초 1회).
// 프런트 이벤트는 유실될 수 있으므로 **서버가 결과를 반환하기 전에** 반드시 이 함수를 끝낸다.
async function recordPackageConsumption(db, userId, pkgKey, now = Date.now()) {
  // D1 batch는 한 트랜잭션으로 실행된다. INSERT와 확인 SELECT 중 하나라도 실패하면
  // 본문/AI 결과를 반환하지 않아 '기록 없는 제공' 상태가 생기지 않는다.
  const results = await db.batch([
    db.prepare(
      'INSERT OR IGNORE INTO content_access (user_id, package, first_access_at) VALUES (?,?,?)'
    ).bind(userId, pkgKey, now),
    db.prepare(
      'SELECT first_access_at FROM content_access WHERE user_id = ? AND package = ?'
    ).bind(userId, pkgKey),
  ]);
  const row = results[1] && results[1].results && results[1].results[0];
  if (!row || !row.first_access_at) throw new Error('content access record missing after insert');
  return row.first_access_at;
}

/* ── 유료 본문 내려주기 (2026-08-16 신설) ──
   🔴 종전에는 `rehabilitation.html`·`bankruptcy.html`의 스크립트 안에 8단계 본문이 **평문으로 전부**
   들어 있었고 잠금은 클라이언트 렌더 분기뿐이었다. `curl https://chamroad.com/rehabilitation.html`
   한 번이면 149,000원 패키지의 전문이 읽혔다(2026-08-16 보안감사, 반박검증에서도 반박 실패).
   `pricing.html`이 "가이드·예시 **열람**"을 판매 항목으로 적고 있으므로 이것은 매출과 직결된다.

   이제 2단계 이후 본문은 이 엔드포인트만 준다. 1단계는 정적으로 남는데, 그 미리보기 범위가
   전상법 시행령 제21조의2 제1호의 '일부 이용 허용'에 해당해 환불 제한의 근거이기 때문이다.
   경계를 옮기려면 약관·pricing의 환불 문구를 함께 봐야 한다.

   ⚠️ 판정은 `activeEntitlements`(기간이 살아 있는 주문별 grant)로 한다 — 환불 시 해당 주문
   grant가 revoked가 되므로, 다른 유효 주문이 없으면 본문도 즉시 닫힌다. */
const CONTENT_SETS = {
  rehab: { packages: ['rehab-full'], mod: REHAB_CONTENT },
  bankrupt: { packages: ['bankrupt-full'], mod: BANKRUPT_CONTENT },
  maintain: { packages: ['maintain'], mod: MAINTAIN_CONTENT },
  'supplement-rehab': {
    packages: ['rehab-full', 'correction-rehab'],
    mod: SUPPLEMENT_REHAB_CONTENT,
  },
  'supplement-bankrupt': {
    packages: ['bankrupt-full', 'correction-bankrupt'],
    mod: SUPPLEMENT_BANKRUPT_CONTENT,
  },
};

// 이전 GET은 페이지 진입 시 자동 호출되던 경로라, 여기서 기록하면 이용자가 사전 고지를
// 확인하거나 '열기'를 누르기도 전에 환불 제한 근거가 생긴다. 본문은 절대 반환하지 않고
// 새 명시적-open 계약만 안내한다.
async function handleContentSteps(_request, _env, origin) {
  return json({
    ok: false,
    error: '유료 콘텐츠는 환불 제한 안내를 확인하고 직접 열어야 합니다.',
    code: 'EXPLICIT_CONTENT_OPEN_REQUIRED',
    requiredEndpoint: '/api/content/open',
    consentVersion: CONTENT_OPEN_CONSENT_VERSION,
  }, 409, origin);
}

// 사전 고지 뒤 이용자가 명시적으로 열기를 선택한 요청만 소비 기록과 본문 반환을 수행한다.
// 프런트 계약: POST JSON { type, consent: true, consentVersion: 'content-open-v1' }.
async function handleContentOpen(request, env, origin) {
  const session = await getSessionUser(env.DB, request);
  if (!session) return err(401, '로그인이 필요합니다.', origin);

  const body = await readJson(request);
  if (!body) return err(400, '잘못된 요청입니다.', origin);
  const type = typeof body.type === 'string' ? body.type : '';
  const set = CONTENT_SETS[type];
  if (!set) return err(400, '알 수 없는 콘텐츠입니다.', origin);
  if (body.consent !== true || body.consentVersion !== CONTENT_OPEN_CONSENT_VERSION) {
    return json({
      ok: false,
      error: '환불 제한 안내에 동의한 뒤 콘텐츠를 열 수 있습니다.',
      code: 'CONTENT_OPEN_CONSENT_REQUIRED',
      consentVersion: CONTENT_OPEN_CONSENT_VERSION,
    }, 400, origin);
  }

  const ents = await activeEntitlements(env.DB, session.id);
  const activePackages = new Set(ents.map(e => e.package));
  const eligiblePackages = set.packages.filter(pkg => activePackages.has(pkg));
  if (!eligiblePackages.length)
    return err(403, '이 내용은 패키지를 구매하신 회원만 이용할 수 있습니다.', origin);

  // 보정 대응은 완주 패키지와 추가 대응 상품 중 어느 쪽으로도 열 수 있다. 둘 다 가진 경우
  // 이미 소비기록이 있는 상품을 우선해, 다른 상품의 환불권까지 새로 소진하지 않는다.
  let consumedPackage = eligiblePackages[0];
  if (eligiblePackages.length > 1) {
    const accessed = await env.DB.prepare(
      'SELECT package FROM content_access WHERE user_id = ?'
    ).bind(session.id).all();
    const accessedPackages = new Set((accessed.results || []).map(row => row.package));
    consumedPackage = eligiblePackages.find(pkg => accessedPackages.has(pkg)) || consumedPackage;
  }

  // 이 트랜잭션이 실패하면 아래 본문 Response를 만들지 않는다. 직접 API 호출도
  // 제공 개시 기록을 피할 수 없고, 반대로 자동 GET만으로 기록되는 일도 없다.
  const firstAccessAt = await recordPackageConsumption(env.DB, session.id, consumedPackage);
  return ok({
    steps: set.mod.STEPS,
    docExamples: set.mod.DOC_EXAMPLES,
    firstAccessAt,
    consumedPackage,
    contentType: type,
    consentVersion: CONTENT_OPEN_CONSENT_VERSION,
  }, origin);
}

async function handleContentAccess(request, env, origin) {
  const session = await getSessionUser(env.DB, request);
  if (!session) return err(401, '로그인이 필요합니다.', origin);
  const body = await readJson(request);
  const pkgKey = body && typeof body.package === 'string' ? body.package : '';
  if (!PACKAGES[pkgKey]) return err(400, '알 수 없는 패키지입니다.', origin);

  // 구버전 fire-and-forget 호출 호환용 조회 경로다. 이 요청 자체로 소비 기록을 만들면
  // 페이지 자동 진입만으로 환불권이 제한되므로, 환불 근거는 /api/content/open 및 AI 제공
  // 경로에서 서버가 만든 기록에만 의존한다.
  const row = await env.DB.prepare(
    'SELECT first_access_at FROM content_access WHERE user_id = ? AND package = ?'
  ).bind(session.id, pkgKey).first();
  return ok({
    recorded: !!(row && row.first_access_at),
    firstAccessAt: row ? row.first_access_at : null,
    deprecated: true,
    requiredEndpoint: '/api/content/open',
    consentVersion: CONTENT_OPEN_CONSENT_VERSION,
  }, origin);
}

async function handlePaymentComplete(request, env, origin) {
  const session = await getSessionUser(env.DB, request);
  if (!session) return err(401, '로그인이 필요합니다.', origin);
  const body = await readJson(request);
  const paymentId = body && typeof body.paymentId === 'string' ? body.paymentId : '';
  if (!paymentId) return err(400, '결제 정보가 없습니다.', origin);

  // 본인 주문만
  const order = await env.DB.prepare('SELECT * FROM payments WHERE payment_id = ? AND user_id = ?')
    .bind(paymentId, session.id).first();
  if (!order) return err(404, '결제 주문을 찾을 수 없습니다.', origin);
  if (!['pending', 'failed', 'paid'].includes(order.status))
    return err(400, '완료할 수 없는 결제 상태입니다.', origin);
  if (order.status !== 'paid' && !env.PORTONE_API_SECRET)
    return err(503, '결제 기능이 아직 준비 중입니다.', origin);

  // 아직 내부에서 확정되지 않은 주문만 포트원 원본을 조회한다. paid인데 cache 쓰기/응답만
  // 실패한 재시도는 주문 원장의 fulfilled/legacy 상태를 확인해 안전하게 복구한다.
  if (order.status !== 'paid') {
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

    if (payment.status !== 'PAID') {
      await env.DB.prepare('UPDATE payments SET status = ? WHERE payment_id = ? AND status <> ?')
        .bind('failed', paymentId, 'paid').run();
      return err(400, '결제가 완료되지 않았습니다.', origin);
    }
    // ⚠️금액과 통화를 함께 본다. PACKAGES의 amount는 '원' 단위 숫자일 뿐 통화 정보가 없으므로,
    // total만 비교하면 브라우저가 requestPayment의 currency를 바꿔 149000을 다른 통화로 결제해도
    // 서버가 통과시킨다(프런트 pricing.html은 CURRENCY_KRW를 보내지만 클라이언트는 신뢰 대상이 아니다).
    // 포트원 V2 조회 응답의 통화는 최상위 payment.currency('KRW')다.
    if (!payment.amount || payment.amount.total !== order.amount || payment.currency !== 'KRW') {
      await env.DB.prepare('UPDATE payments SET status = ? WHERE payment_id = ? AND status <> ?')
        .bind('failed', paymentId, 'paid').run();
      console.error('amount mismatch', paymentId, payment.amount?.total, payment.currency, 'expected', order.amount, 'KRW');
      return err(400, '결제 금액이 일치하지 않습니다. 결제가 진행되었다면 문의해주세요.', origin);
    }
  }

  const paidAt = Date.now();
  let fulfillment;
  try {
    fulfillment = await fulfillOrderGrant(env, order, 'paid', paidAt);
  } catch (e) {
    if (e && e.code === 'FULFILLMENT_BUSY') {
      return json({ ok: false, error: '결제 이용권을 확정 중입니다. 잠시 후 다시 확인해주세요.', code: 'PAYMENT_FULFILLMENT_IN_PROGRESS' }, 409, origin);
    }
    console.error('payment fulfillment failed', paymentId, e.message);
    return err(500, '결제는 확인되었으나 이용권 반영에 실패했습니다. 잠시 후 다시 시도하면 복구됩니다.', origin);
  }

  let granted;
  try {
    granted = await syncPlanCache(env, session.id, order.package);
  } catch (e) {
    // 원장 확정은 끝났으므로 재요청이 cache만 다시 구성한다.
    console.error('payment plan cache sync failed', paymentId, e.message);
    return err(500, '이용권은 반영되었으나 화면 동기화에 실패했습니다. 잠시 후 다시 시도해주세요.', origin);
  }
  // 계약 내용 서면(주문 확인 메일) — 전상법 제13조② 교부의무. 실패해도 결제 확정에는 영향 없음.
  if (fulfillment.newlyFulfilled)
    await sendOrderConfirmation(env, session.email, session.name, order, paidAt).catch(() => {});
  return ok({ granted, alreadyPaid: !fulfillment.newlyFulfilled }, origin);
}

// 청약철회 신청 — 전자상거래법 제13조②5호(서식)·제5조④(전자문서). 본인 결제만.
// 결제일부터 14일 이내 + 미개시(content_access 없음)면 자동 전액환불, 그 외는 접수 후 운영자 검토.
// content_access는 콘텐츠 반환과 AI 결과 반환 전에 서버가 직접 기록하므로 클라이언트 이벤트에 의존하지 않는다.
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
  if (order.status === 'refunded') {
    try { await revokeOrderGrant(env, order, 'refunded'); }
    catch (e) { return err(500, '환불 이용권 회수 상태를 복구하지 못했습니다. 잠시 후 다시 시도해주세요.', origin); }
    return ok({ status: 'already_refunded', message: '이미 환불된 결제입니다.' }, origin);
  }
  if (order.status !== 'paid') return err(400, '완료된 결제만 청약철회할 수 있습니다.', origin);

  const now = Date.now();
  // 이미 접수돼 처리를 기다리는 신청이 있으면 새로 만들지 않는다 —
  // 화면의 중복 방지(canWithdraw)는 클라이언트라 PG 실패 후 재요청 등으로 뚫릴 수 있고,
  // 그때마다 pending 행과 운영자 메일이 중복된다.
  const pending = await env.DB.prepare(
    "SELECT id FROM withdrawal_requests WHERE payment_id = ? AND user_id = ? AND status = 'pending'"
  ).bind(paymentId, session.id).first();
  // 신청 접수 기록(서식 요건 충족 + 운영자 검토 근거)
  if (!pending) {
    await env.DB.prepare(
      'INSERT INTO withdrawal_requests (payment_id, user_id, reason, status, created_at) VALUES (?,?,?,?,?)'
    ).bind(paymentId, session.id, reason || null, 'pending', now).run();
  }

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
      try {
        const revocation = await revokeOrderGrant(env, order, 'refunded', now);
        if (revocation.legacyManualReconciliation)
          console.error('legacy entitlement needs manual reconciliation after withdraw', paymentId);
      } catch (e) {
        console.error('withdraw refund ledger update failed', paymentId, e.message);
        return err(500, '환불은 처리되었으나 이용권 회수 기록에 실패했습니다. 잠시 후 다시 시도하면 복구됩니다.', origin);
      }
      await env.DB.prepare("UPDATE withdrawal_requests SET status='auto_refunded' WHERE payment_id=? AND status='pending'")
        .bind(paymentId).run();
      await sendEmail(env, session.email, '[챔로드] 청약철회 · 환불 처리 완료',
        emailShell('청약철회 처리 완료', `<p>${escHtml(session.name)}님, 요청하신 청약철회가 접수되어 <strong>전액 환불</strong> 처리되었습니다.</p>
        <p style="font-size:13px;color:#6b7280">카드 결제 취소는 카드사 정책에 따라 영업일 기준 수일이 걸릴 수 있습니다.</p>`)).catch(() => {});
      return ok({ status: 'refunded', message: '청약철회가 접수되어 전액 환불 처리되었습니다.' }, origin);
    }
    // portone 실패 → 아래 운영자 검토로 폴백
  }

  if (pending)
    return ok({ status: 'already_requested', message: '이미 접수된 청약철회 신청이 있습니다. 처리 결과를 기다려 주세요.' }, origin);

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

// 주문 한 건의 몫만 회수한다. 뒤에 이어 붙인 동일 상품 주문은 각자의 기간 길이를 유지한 채
// 앞으로 당겨 공백을 없앤다. AI 사용 이력은 감사용으로 남고 해당 grant만 더 이상 선택되지 않는다.
async function revokeOrderGrant(env, order, targetStatus, now = Date.now()) {
  const token = crypto.randomUUID();
  const locked = await claimEntitlementLock(env.DB, order.user_id, order.package, token, now);
  if (!locked) {
    const busy = new Error('package grant is already processing');
    busy.code = 'FULFILLMENT_BUSY';
    throw busy;
  }
  let legacyManualReconciliation = false;
  try {
    let grant = await env.DB.prepare(
      `SELECT id, starts_at, expires_at, status FROM entitlement_grants
        WHERE payment_id=? AND user_id=? AND package=?`
    ).bind(order.payment_id, order.user_id, order.package).first();
    if (!grant) {
      const fulfillment = await env.DB.prepare(
        'SELECT state FROM payment_fulfillments WHERE payment_id=?'
      ).bind(order.payment_id).first();
      if (fulfillment && fulfillment.state === 'legacy') {
        const others = await env.DB.prepare(
          `SELECT COUNT(*) AS c FROM payments p
             JOIN payment_fulfillments f ON f.payment_id=p.payment_id AND f.state='legacy'
            WHERE p.user_id=? AND p.package=? AND p.payment_id<>?
              AND p.status IN ('paid','test')`
        ).bind(order.user_id, order.package, order.payment_id).first();
        if (!others || Number(others.c) === 0) {
          // 이 상품의 과거 확정 주문이 하나뿐이면 통합 legacy 행 전체가 그 주문 몫이다.
          grant = await env.DB.prepare(
            `SELECT id, starts_at, expires_at, status FROM entitlement_grants
              WHERE user_id=? AND package=? AND source='legacy'`
          ).bind(order.user_id, order.package).first();
        } else {
          // 복수 과거 주문의 사용량 배분은 집계형 원본만으로 복원할 수 없다. 임의 차감하지 않는다.
          legacyManualReconciliation = true;
        }
      }
    }
    let anchor = now;
    if (grant && grant.status === 'active') {
      const previous = await env.DB.prepare(
        `SELECT MAX(expires_at) AS expires_at FROM entitlement_grants
          WHERE user_id=? AND package=? AND status='active' AND id<>? AND expires_at<=?`
      ).bind(order.user_id, order.package, grant.id, grant.starts_at).first();
      if (previous && Number(previous.expires_at) > anchor) anchor = Number(previous.expires_at);
    }
    const shouldShift = grant && grant.status === 'active' && Number(grant.expires_at) > anchor;
    const duration = shouldShift ? Number(grant.expires_at) - anchor : 0;
    const from = grant ? Number(grant.expires_at) : 0;
    const allowedStatus = targetStatus === 'revoked' ? 'test' : 'paid';

    const statements = [
      env.DB.prepare(
        'UPDATE payments SET status=?, refunded_at=CASE WHEN ? = \'refunded\' THEN COALESCE(refunded_at,?) ELSE refunded_at END WHERE payment_id=? AND status IN (?,?)'
      ).bind(targetStatus, targetStatus, now, order.payment_id, allowedStatus, targetStatus),
      env.DB.prepare(
        `UPDATE entitlement_grants SET status='revoked', revoked_at=COALESCE(revoked_at,?)
          WHERE id=? AND user_id=? AND status='active'`
      ).bind(now, grant ? grant.id : -1, order.user_id),
    ];
    if (duration > 0) {
      statements.push(env.DB.prepare(
        `UPDATE entitlement_grants
            SET starts_at=starts_at-?, expires_at=expires_at-?
          WHERE user_id=? AND package=? AND status='active' AND starts_at>=? AND id<>?`
      ).bind(duration, duration, order.user_id, order.package, from, grant.id));
    }
    statements.push(env.DB.prepare(
      'DELETE FROM entitlement_locks WHERE user_id=? AND package=? AND claim_token=?'
    ).bind(order.user_id, order.package, token));
    await env.DB.batch(statements);
  } catch (error) {
    try { await releaseEntitlementLock(env.DB, order.user_id, order.package, token); } catch {}
    throw error;
  }
  // syncPlanCache 실패도 환불 자체는 DB에 반영돼 있다. 재요청이 멱등하게 cache를 복구한다.
  const cache = await syncPlanCache(env, order.user_id, order.package);
  return { cache, legacyManualReconciliation };
}

/* ── 자체 익명 분석 ── */
// 인증 불필요(익명). 개인·세션·IP를 저장하지 않고 (날짜, 이벤트, 라벨) 카운트만 올린다.
//
// 🔴 **요청마다 D1에 쓰지 않는다.** 이 경로는 로그인 없이 DB 쓰기를 일으킬 수 있는 **유일한 곳**이라,
//    종전처럼 요청당 UPSERT 1건이면 자동 요청으로 D1 무료 한도(일 10만 쓰기)를 태울 수 있었다
//    (2026-08-15 보안감사·반박검증 CONFIRMED). 쓰기 한도가 마르면 세션 생성이 먼저 실패해
//    **로그인부터 죽는다.** WAF 레이트리밋은 무료 플랜이라 규칙 1개뿐이고 가입·재설정 경로에 이미 쓰였다.
//
//    그래서 아이솔레이트 메모리에 모았다가 10초에 한 번만 기록한다. 평상시 트래픽은 사실상 즉시
//    기록되고(첫 요청은 바로 flush), 쏟아지면 10초당 1회로 접힌다. 표본추출과 달리 **정상 트래픽의
//    카운트가 정확하다**(이 사이트는 이벤트 수가 적어 샘플링하면 수치가 못 쓰게 된다).
//    라벨은 이용자가 정하는 값이라 종류 수도 막는다 — 넘치면 라벨을 'overflow'로 접어
//    analytics 테이블의 행 자체가 무한정 늘어나는 것을 함께 막는다.
//    ⚠️ 남은 한계 둘. ①버퍼는 아이솔레이트가 죽으면 사라지고 상한도 아이솔레이트별이다 — 완전한 해결은
//      Workers 유료 전환이나 Analytics Engine 이전이다. ②공격이 라벨 상한을 채우면 그날 새로 등장한
//      **정상 라벨도 overflow로 접힌다**(이미 집계 중이던 라벨은 그대로). 둘 다 분석 정확도를 잃을 뿐
//      서비스는 살아 있다는 쪽을 택한 것이다 — 분석은 부가 기능이고 로그인은 아니다.
const ANALYTICS_BUF = new Map();          // 'day\0event\0label' → count
const ANALYTICS_SEP = '\u0000';   // 라벨 정규식이 걸러 내는 문자라 키가 섞일 수 없다
const ANALYTICS_FLUSH_MS = 10_000;        // 기록 간격 = 한 번에 쓰는 주기
const ANALYTICS_MAX_KEYS = 40;            // 한 번에 쓰는 행 수 상한
const ANALYTICS_MAX_LABELS = 200;         // 하루에 만들 수 있는 라벨 종류 상한(테이블 행 증가 차단)
const ANALYTICS_SEEN = new Set();         // 오늘 이미 쓴 키 — flush로 버퍼가 비어도 종류 상한은 유지된다
let analyticsSeenDay = '';
let analyticsFlushedAt = 0;

async function flushAnalytics(env, now) {
  if (!ANALYTICS_BUF.size) return;
  const rows = [...ANALYTICS_BUF.entries()];
  ANALYTICS_BUF.clear();
  analyticsFlushedAt = now;
  try {
    await env.DB.batch(rows.map(([k, n]) => {
      const [day, event, label] = k.split(ANALYTICS_SEP);
      return env.DB.prepare(
        `INSERT INTO analytics (day, event, label, count) VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(day, event, label) DO UPDATE SET count = count + ?4`
      ).bind(day, event, label, n);
    }));
  } catch (e) { /* 분석 실패는 무시 — 접힌 카운트는 복구하지 않는다 */ }
}

async function handleAnalytics(request, env, origin) {
  const body = await readJson(request, 2048);
  if (!body || typeof body.event !== 'string' || !ANALYTICS_EVENTS.has(body.event))
    return ok({}, origin);   // 조용히 무시 — 분석은 부가 기능이라 실패해도 사용자 흐름을 막지 않는다.
  // 라벨은 페이지 id·단계 번호 등 비개인 세부값만. 안전 문자로 제한하고 길이 컷.
  const label = (typeof body.label === 'string' ? body.label : '')
    .replace(/[^\w\-./]/g, '').slice(0, 40);
  const now = Date.now();
  const day = new Date(now).toISOString().slice(0, 10);

  if (analyticsSeenDay !== day) { ANALYTICS_SEEN.clear(); analyticsSeenDay = day; }

  let key = day + ANALYTICS_SEP + body.event + ANALYTICS_SEP + label;
  // 라벨 종류가 비정상적으로 많다 = 사람이 아니다. 세부는 버리고 이벤트 단위로만 센다.
  // (이벤트는 화이트리스트라 overflow 키의 개수도 자동으로 막힌다.)
  // 상한은 **하루 기준**이다 — 버퍼 기준으로만 세면 flush로 비워질 때마다 상한이 되살아나
  // 10초마다 새 라벨 40종씩 계속 만들 수 있다(2026-08-16 시뮬레이션에서 확인).
  const 새키 = !ANALYTICS_SEEN.has(key);
  if (새키 && (ANALYTICS_SEEN.size >= ANALYTICS_MAX_LABELS || ANALYTICS_BUF.size >= ANALYTICS_MAX_KEYS)) {
    key = day + ANALYTICS_SEP + body.event + ANALYTICS_SEP + 'overflow';
  }
  ANALYTICS_SEEN.add(key);
  ANALYTICS_BUF.set(key, (ANALYTICS_BUF.get(key) || 0) + 1);

  if (now - analyticsFlushedAt >= ANALYTICS_FLUSH_MS) await flushAnalytics(env, now);
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
  ).bind(paymentId, user.id, pkgKey, pkg.amount, 'pending', now, null).run();
  let fulfillment;
  try {
    fulfillment = await fulfillOrderGrant(env, {
      payment_id: paymentId, user_id: user.id, package: pkgKey, status: 'pending',
    }, 'test', now);
  } catch (e) {
    console.error('admin grant fulfillment failed', paymentId, e.message);
    return err(500, '테스트 이용권 지급 기록에 실패했습니다. 다시 시도해주세요.', origin);
  }
  const granted = await syncPlanCache(env, user.id, pkgKey);
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

  let revocation;
  try {
    revocation = await revokeOrderGrant(env, order, 'revoked');
  } catch (e) {
    console.error('revoke test failed', e.message);
    return err(500, '테스트 이용권 회수 기록에 실패했습니다. 다시 시도해주세요.', origin);
  }
  return ok({ revoked: true, legacyManualReconciliation: !!revocation.legacyManualReconciliation }, origin);
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

  if (order.status === 'refunded') {
    let revocation;
    try { revocation = await revokeOrderGrant(env, order, 'refunded'); }
    catch (e) { return err(500, '환불 이용권 회수 상태를 복구하지 못했습니다. 다시 시도해주세요.', origin); }
    return ok({ alreadyRefunded: true, legacyManualReconciliation: !!revocation.legacyManualReconciliation }, origin);
  }
  if (order.status !== 'paid') return err(400, '완료된 결제만 환불할 수 있습니다.', origin);

  const res = await portoneCancel(env, paymentId, reason);
  if (res === 'fail') return err(502, '결제대행사 취소 처리에 실패했습니다. 포트원 콘솔에서 상태를 확인해주세요.', origin);

  // 포트원 취소 성공 — 결제 상태와 해당 주문 grant 회수를 한 D1 batch로 확정한다.
  let revocation;
  try {
    revocation = await revokeOrderGrant(env, order, 'refunded', Date.now());
  } catch (e) {
    console.error('refund db update failed', paymentId, e.message);
    return err(500, '환불은 처리되었으나 주문별 이용권 회수 기록에 실패했습니다. 잠시 후 다시 시도하면 복구됩니다.', origin);
  }

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

  return ok({ refunded: true, legacyManualReconciliation: !!revocation.legacyManualReconciliation }, origin);
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
  'GET /api/content/steps': handleContentSteps,
  'POST /api/content/open': handleContentOpen,
  'POST /api/content/access': handleContentAccess,
  'POST /api/analytics': handleAnalytics,
};

// 보안 회귀검사에서 외부 전송 직전 마스킹 규칙을 직접 검증한다.
// maskIdNumbers는 회귀검사가, callClaude는 tools/ai-output-eval.mjs가 쓴다.
// Worker 런타임은 default export만 보므로 named export를 늘려도 배포 동작에는 영향이 없다.
// ⚠️평가기는 handleAiReview와 **같은 함수**를 불러야 의미가 있다. 평가용 사본을 따로 만들지 말 것 —
//   사본은 프롬프트·스키마가 갈리는 순간 조용히 거짓 안심을 준다.
export { maskIdNumbers, callClaude };

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
