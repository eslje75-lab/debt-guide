/* ==============================
   챔로드 - 공통 JS
   ============================== */

const SITE_NAME = '챔로드';

// 비밀번호 정책(서버와 동일): 8자 이상 + 영문·숫자·특수문자. 위반 시 사유, 통과 시 null.
function passwordError(pw) {
  pw = pw || '';
  if (pw.length < 8) return '비밀번호는 8자 이상이어야 합니다.';
  if (pw.length > 128) return '비밀번호는 128자 이하로 입력해주세요.';
  if (!/[A-Za-z]/.test(pw)) return '비밀번호에 영문자를 포함해주세요.';
  if (!/[0-9]/.test(pw)) return '비밀번호에 숫자를 포함해주세요.';
  if (!/[^A-Za-z0-9]/.test(pw)) return '비밀번호에 특수문자(!@#$ 등)를 포함해주세요.';
  return null;
}

const NAV_LINKS = [
  { href: 'index.html',          label: '홈',        id: 'home' },
  { href: 'about.html',          label: '소개글',     id: 'about' },
  { href: 'compare.html',        label: '채무조정제도', id: 'compare' },
  { href: 'discharge.html',      label: '면책신청',    id: 'discharge' },   // 개인회생 면책 — 무료 안내
  { href: 'resources.html',      label: 'FAQ',        id: 'resources' },
];

/* ── Header ── */
function renderHeader(activePage) {
  const el = document.getElementById('header-placeholder');
  if (!el) return;

  const user = Auth.isLoggedIn() ? Auth.getCurrentUser() : null;

  const desktopLinks = NAV_LINKS.map(l => {
    const active = activePage === l.id;
    return `<a href="${l.href}" class="text-base font-medium transition-colors ${
      active ? 'text-blue-700 border-b-2 border-blue-700 pb-0.5' : 'text-slate-600 hover:text-blue-700'
    }">${l.label}</a>`;
  }).join('');

  const mobileLinks = NAV_LINKS.map(l => {
    const active = activePage === l.id;
    return `<a href="${l.href}" class="block px-4 py-3 text-sm ${
      active ? 'text-blue-700 bg-blue-50 font-semibold' : 'text-slate-700 hover:bg-slate-50'
    }">${l.label}</a>`;
  }).join('');

  const initial = user ? user.name.charAt(0) : '';

  const desktopAuth = user ? `
    <div class="relative">
      <button onclick="toggleUserMenu()" class="flex items-center gap-2 text-sm text-slate-700 hover:text-blue-700 transition-colors focus:outline-none">
        <div class="w-8 h-8 rounded-full bg-blue-700 text-white flex items-center justify-center font-bold text-sm">${initial}</div>
        <span class="hidden xl:inline max-w-24 truncate">${user.name}</span>
        <svg class="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
      </button>
      <div id="user-dropdown" class="hidden absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-lg border border-slate-100 z-50 py-1 overflow-hidden">
        <div class="px-4 py-3 border-b border-slate-100 bg-slate-50">
          <p class="text-xs text-slate-400 mb-0.5">로그인됨</p>
          <p class="text-sm font-semibold text-slate-800 truncate">${user.name}</p>
          <p class="text-xs text-slate-400 truncate">${user.email}</p>
        </div>
        <a href="mypage.html" class="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
          <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
          마이페이지
        </a>
        <button onclick="authLogout()" class="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-red-500 hover:bg-red-50">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
          로그아웃
        </button>
      </div>
    </div>
    <a href="diagnosis.html" class="bg-blue-700 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-800 transition-colors font-medium">무료진단 시작</a>
  ` : `
    <a href="login.html" class="text-sm text-slate-600 hover:text-blue-700 transition-colors border border-slate-200 px-4 py-2 rounded-lg">로그인</a>
    <a href="diagnosis.html" class="bg-blue-700 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-800 transition-colors font-medium">무료진단 시작</a>
  `;

  const mobileAuth = user ? `
    <div class="flex items-center gap-3 mb-3">
      <div class="w-9 h-9 rounded-full bg-blue-700 text-white flex items-center justify-center font-bold">${initial}</div>
      <div class="min-w-0">
        <p class="text-sm font-semibold text-slate-800 truncate">${user.name}</p>
        <p class="text-xs text-slate-400 truncate">${user.email}</p>
      </div>
    </div>
    <a href="mypage.html" class="block text-center py-2.5 text-sm text-slate-700 bg-slate-100 rounded-lg mb-2">마이페이지</a>
    <button onclick="authLogout()" class="block w-full text-center py-2 text-sm text-red-500 mb-2">로그아웃</button>
    <a href="diagnosis.html" class="block w-full text-center bg-blue-700 text-white py-3 rounded-lg font-medium text-sm">무료진단 시작하기</a>
  ` : `
    <a href="login.html" class="block text-center py-2.5 text-sm text-slate-700 bg-slate-100 rounded-lg mb-2 font-medium">로그인 / 회원가입</a>
    <a href="diagnosis.html" class="block w-full text-center bg-blue-700 text-white py-3 rounded-lg font-medium text-sm">무료진단 시작하기</a>
  `;

  el.innerHTML = `
    <nav class="navbar-sticky bg-white border-b border-slate-200 no-print">
      <div class="max-w-6xl mx-auto px-4">
        <div class="flex items-center justify-between h-16">

          <a href="index.html" class="flex items-center gap-2">
            <div class="w-9 h-9 rounded-xl flex items-center justify-center" style="background:#533afd">
              <svg class="w-5 h-5" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2 18L10 5L18 18" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                <line x1="10" y1="8.5" x2="10" y2="11.5" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
                <line x1="10" y1="14" x2="10" y2="17" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </div>
            <span class="font-bold text-slate-800 text-lg tracking-tight">${SITE_NAME}</span>
          </a>

          <div class="hidden lg:flex items-center gap-9">${desktopLinks}</div>

          <div class="hidden lg:flex items-center gap-3">
            ${desktopAuth}
          </div>

          <button onclick="toggleMobileMenu()" class="lg:hidden p-2 text-slate-600 hover:text-blue-700">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
            </svg>
          </button>
        </div>
      </div>

      <div id="mobile-menu" class="lg:hidden border-t border-slate-100">
        ${mobileLinks}
        <div class="px-4 py-3 border-t border-slate-100 bg-slate-50">
          ${mobileAuth}
        </div>
      </div>
    </nav>
  `;
}

function toggleMobileMenu() {
  const m = document.getElementById('mobile-menu');
  if (m) m.classList.toggle('open');
}

function toggleUserMenu() {
  const d = document.getElementById('user-dropdown');
  if (d) d.classList.toggle('hidden');
}

function authLogout() {
  Auth.logout();
  showToast('로그아웃되었습니다.', 'info');
  setTimeout(() => { location.href = 'index.html'; }, 600);
}

/* ── Footer ── */
function renderFooter() {
  const el = document.getElementById('footer-placeholder');
  if (!el) return;

  el.innerHTML = `
    <footer class="footer-stripe mt-16 no-print">
      <div class="max-w-6xl mx-auto px-4 md:px-6 py-10 md:py-16">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-10 mb-8 md:mb-10">

          <div>
            <div class="flex items-center gap-2 mb-4">
              <div class="w-7 h-7 rounded-lg flex items-center justify-center" style="background:#533afd">
                <svg class="w-4 h-4" viewBox="0 0 20 20" fill="none">
                  <path d="M2 18L10 5L18 18" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                  <line x1="10" y1="8.5" x2="10" y2="11.5" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
                  <line x1="10" y1="14" x2="10" y2="17" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
              </div>
              <span class="font-bold text-sm" style="color:#0d253d">${SITE_NAME}</span>
            </div>
            <p class="footer-link leading-relaxed">채무 정리 절차를 스스로 이해하고 준비할 수 있도록 돕는 정보 제공 플랫폼입니다.</p>
          </div>

          <div>
            <h4 class="footer-heading">주요 서비스</h4>
            <ul class="space-y-2">
              <li><a href="diagnosis.html" class="footer-link">무료 채무진단</a></li>
              <li><a href="pricing.html" class="footer-link">챔로드 셀프진행</a></li>
              <li><a href="discharge.html" class="footer-link">개인회생 면책신청 안내</a></li>
              <li><a href="resources.html" class="footer-link">FAQ</a></li>
            </ul>
          </div>

          <div>
            <h4 class="footer-heading">관련 공공기관</h4>
            <ul class="space-y-2">
              <li><a href="https://ecfs.scourt.go.kr" target="_blank" rel="noopener" class="footer-link">대법원 전자소송</a></li>
            </ul>
          </div>
        </div>

        <div style="border-top:1px solid #e3e8ee; padding-top:24px">
          <div class="flex flex-wrap justify-center gap-x-4 gap-y-2 mb-4 text-xs">
            <a href="terms.html" class="footer-link">이용약관</a>
            <span class="text-slate-300">·</span>
            <a href="privacy.html" class="footer-link" style="font-weight:600">개인정보처리방침</a>
            <span class="text-slate-300">·</span>
            <a href="about.html" class="footer-link">운영자 소개</a>
            <span class="text-slate-300">·</span>
            <a href="mailto:eslje75@gmail.com" class="footer-link">문의 eslje75@gmail.com</a>
          </div>
          <p class="footer-link text-center" style="font-size:11px; line-height:1.6">© 2026 ${SITE_NAME} · 본 사이트는 법률대리 사이트가 아님을 고지하며, 법률상담·법률대리·사건 수임 또는 결과 보장을 제공하지 않습니다.</p>
          <p class="footer-link text-center mt-1" style="font-size:11px; line-height:1.6">사용자가 직접 절차를 이해하고 준비할 수 있도록 돕는 정보 제공 및 서류 점검 보조 서비스입니다.</p>
        </div>
      </div>
    </footer>
  `;
}

/* ── Inline disclaimer (for pages that need it in-body) ── */
function renderDisclaimer(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = `
    <div class="disclaimer-box mt-6">
      <strong>⚠️ 참고용 안내</strong><br>
      본 서비스는 법률상담, 법률대리, 사건 수임 또는 결과 보장을 제공하지 않습니다.
      모든 결과는 입력값을 기반으로 한 참고용이며, 최종 판단은 법원 결정 및 전문가 검토에 따라 달라질 수 있습니다.
      구체적인 법률 판단이 필요한 경우 변호사, 법무사, 대한법률구조공단 등 전문가 상담을 권장합니다.
    </div>
  `;
}

/* ── Storage: localStorage 동기 캐시 + 로그인 시 서버 미러링(Phase 2) ──
   - 읽기(load)는 항상 로컬 캐시에서 동기로 — 기존 모든 호출부 무수정.
   - 쓰기(save/remove)는 로컬에 즉시 반영 + 로그인 상태면 서버로 디바운스 푸시.
   - 로그인 시(syncOnLogin): 서버에 데이터가 있으면 서버가 소스(로컬 교체),
     서버가 비어있으면 게스트 로컬데이터를 서버로 이관.
   - auth 키(cdg_auth*)는 동기화 대상에서 제외. */
const Storage = {
  save(key, data) {
    try { localStorage.setItem('cdg_' + key, JSON.stringify(data)); } catch(e) {}
    DataSync.queuePut(key, data);
  },
  load(key) {
    try { return JSON.parse(localStorage.getItem('cdg_' + key)); } catch(e) { return null; }
  },
  remove(key) {
    try { localStorage.removeItem('cdg_' + key); } catch(e) {}
    DataSync.queueDel(key);
  }
};

const DataSync = {
  _put: new Map(),   // key -> data (최신값)
  _del: new Set(),   // 삭제할 key
  _timer: null,
  DEBOUNCE_MS: 700,

  // 서버로 올리지 않는 민감정보 필드.
  // 건강상태·채무발생원인은 「개인정보 보호법」 제23조 민감정보(건강에 관한 정보)에 해당해
  // 별도 동의 없이는 서버에 저장할 수 없다. 진단 계산은 브라우저에서 이뤄지므로
  // 이 값들은 이용자 기기에만 남기고, 서버 동기화에서는 제외한다.
  SENSITIVE_FIELDS: {
    diagnosis_data: ['hasHealthIssues', 'debtCauses'],
  },
  _strip(key, data) {
    const fields = this.SENSITIVE_FIELDS[key];
    if (!fields || !data || typeof data !== 'object' || Array.isArray(data)) return data;
    const copy = { ...data };
    for (const f of fields) delete copy[f];
    return copy;
  },

  _on() { return typeof Auth !== 'undefined' && Auth.isLoggedIn(); },

  // cdg_ 앱데이터 키(prefix 제거) 목록 — auth 키 제외
  _localKeys() {
    const out = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const full = localStorage.key(i);
        if (full && full.startsWith('cdg_') && !full.startsWith('cdg_auth')) out.push(full.slice(4));
      }
    } catch (e) {}
    return out;
  },
  _collectLocal() {
    const d = {};
    for (const k of this._localKeys()) { const v = Storage.load(k); if (v !== null) d[k] = this._strip(k, v); }
    return d;
  },
  _clearLocal() {
    for (const k of this._localKeys()) { try { localStorage.removeItem('cdg_' + k); } catch (e) {} }
  },
  // 대기 중인 업로드를 버린다(탈퇴 등 — 지운 데이터가 다시 올라가지 않도록)
  cancelPending() {
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
    this._put.clear();
    this._del.clear();
  },

  queuePut(key, data) {
    if (!this._on()) return;
    this._del.delete(key);
    this._put.set(key, data);
    this._schedule();
  },
  queueDel(key) {
    if (!this._on()) return;
    this._put.delete(key);
    this._del.add(key);
    this._schedule();
  },
  _schedule() {
    if (this._timer) clearTimeout(this._timer);
    this._timer = setTimeout(() => this.flush(), this.DEBOUNCE_MS);
  },

  async flush(keepalive = false) {
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
    if (!this._on() || (this._put.size === 0 && this._del.size === 0)) return;
    const put = {}; for (const [k, v] of this._put) put[k] = this._strip(k, v);
    const del = [...this._del];
    this._put.clear(); this._del.clear();
    const s = Auth.getSession();
    try {
      await fetch(API_BASE + '/api/data/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + s.token },
        body: JSON.stringify({ put, del }),
        keepalive,
      });
    } catch (e) { /* 실패 시 다음 저장·로그인에서 재동기화 */ }
  },

  // 로그인 직후 호출 — 서버/로컬 병합 정책 적용
  async syncOnLogin() {
    const s = Auth.getSession();
    if (!s) return;
    try {
      const res = await fetch(API_BASE + '/api/data', { headers: { 'Authorization': 'Bearer ' + s.token } });
      const j = await res.json();
      if (!j.ok) return;
      const server = j.data || {};
      if (Object.keys(server).length > 0) {
        // 서버 데이터 우선 — 로컬 앱데이터 교체(다른 기기·이전 게스트 잔여 제거)
        this._clearLocal();
        for (const [k, v] of Object.entries(server)) {
          try { localStorage.setItem('cdg_' + k, JSON.stringify(v)); } catch (e) {}
        }
      } else {
        // 서버 비어있음 — 게스트로 만든 로컬데이터를 계정으로 이관
        const local = this._collectLocal();
        if (Object.keys(local).length) {
          await fetch(API_BASE + '/api/data/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + s.token },
            body: JSON.stringify({ put: local }),
          });
        }
      }
    } catch (e) { /* 오프라인 등 — 로컬 캐시로 계속 동작 */ }
  },

  // 서버 데이터 전체 삭제(계정 데이터 초기화)
  async clearServer() {
    if (!this._on()) return;
    const s = Auth.getSession();
    try {
      await fetch(API_BASE + '/api/data/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + s.token },
        body: JSON.stringify({ clearAll: true }),
      });
    } catch (e) {}
  },
};

// 페이지 이탈 시 대기 중인 변경을 keepalive로 마지막 플러시
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => { try { DataSync.flush(true); } catch (e) {} });
}

/* ── Auth (백엔드 API 연동 — Cloudflare Worker) ── */
// 세션 캐시는 localStorage(cdg_auth_session)에 두고 동기 조회(getSession 등)는 캐시로,
// 로그인·가입·비밀번호 변경은 서버 API로 처리한다.
// 로컬에서는 기본이 wrangler dev(:8787)다. 다만 결제 E2E처럼 운영 API로 붙어야 하는
// 점검이 있어서(관리자 예외·포트원 채널·운영 D1이 거기 있다) 전환 스위치를 둔다.
//   ?api=prod  → 이후 이 브라우저는 운영 API 사용(localStorage에 기억)
//   ?api=local → 원래대로 wrangler dev
// 공개 사이트(localhost가 아닌 곳)에서는 이 스위치가 아예 동작하지 않는다.
const API_BASE = (() => {
  const PROD = 'https://api.chamroad.com';
  if (location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return PROD;
  const q = new URLSearchParams(location.search).get('api');
  if (q === 'prod') { try { localStorage.setItem('cdg_api_target', 'prod'); } catch (e) {} }
  if (q === 'local') { try { localStorage.removeItem('cdg_api_target'); } catch (e) {} }
  let target = null;
  try { target = localStorage.getItem('cdg_api_target'); } catch (e) {}
  const base = target === 'prod' ? PROD : 'http://localhost:8787';
  // 로컬에서 어느 API를 보고 있는지 콘솔에 남긴다 — 8787로 가 있으면 요청이
  // 서버에 닿지 못해 "서버에 연결할 수 없습니다"만 뜨고 원인이 안 보인다.
  console.info('[챔로드] API_BASE =', base, '(바꾸려면 ?api=prod / ?api=local)');
  return base;
})();

// 판매 개시 스위치. false면 결제 진입 자체를 막고 '준비 중'으로 안내한다.
//
// 왜 필요한가: 사이트는 GitHub Pages라 push가 곧 공개다. 사이트 자체는 공개해도 되지만
// ①포트원이 아직 테스트 채널이라 정상 거래가 성립하지 않고, ②「전자상거래 등에서의
// 소비자보호에 관한 법률」 제10조가 요구하는 사업자 신원(상호·대표자·주소·연락처·
// 사업자등록번호)이 terms 제11조·privacy 12항에 아직 자리표시자다. 결제 버튼만 닫으면
// 판매를 개시하지 않은 것이 되어 이 두 문제가 모두 비껴간다.
//
// 되돌리는 조건(LAUNCH-CHECKLIST 1~2단계): 사업자등록 + 약관·방침에 사업자 정보 실값 기재
// + 포트원 라이브 채널 시크릿 교체 및 라이브 결제 1건 검증. 그 뒤 이 값만 true로.
const PAYMENTS_ENABLED = false;

// 결제 버튼을 열어 둘지. 공개 사이트에서는 위 플래그 그대로지만,
// 로컬(localhost/127.0.0.1)에서는 항상 열어 둔다 — 판매 오픈 전에도 결제 전 구간을
// 실제로 눌러 보며 점검하기 위해서다. 열어 두는 건 '버튼'뿐이고,
// 실제 주문 생성 허용 여부는 서버가 판정한다(api/src/index.js: 판매 잠금 + 관리자 예외).
// 즉 이 함수가 true여도 관리자가 아니면 서버가 503으로 막는다.
function paymentsOpen() {
  const local = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  // ?paytest=1 — 라이브 사이트에서 점검할 때 결제 버튼을 여는 스위치.
  // 탭을 닫으면 사라지도록 sessionStorage에 둔다(주소창에서 파라미터가 사라져도 유지되게).
  // 여는 건 버튼뿐이고, 실제 주문 생성은 서버 허용 명단(payAllowlisted)이 판정한다.
  let testMode = false;
  try {
    const q = new URLSearchParams(location.search).get('paytest');
    if (q === '1') sessionStorage.setItem('cdg_paytest', '1');
    if (q === '0') sessionStorage.removeItem('cdg_paytest');
    testMode = sessionStorage.getItem('cdg_paytest') === '1';
  } catch (e) {}
  return PAYMENTS_ENABLED || local || testMode;
}

// 자동 가입 방지(Cloudflare Turnstile) 사이트 키.
// 빈 문자열이면 위젯을 아예 띄우지 않는다 — 키 발급 전에도 가입이 정상 동작하도록.
// 서버 짝은 Worker 시크릿 TURNSTILE_SECRET. ⚠️둘 다 설정해야 실제로 보호된다.
// 발급: Cloudflare 대시보드 → Turnstile → 위젯 추가(도메인 chamroad.com) → 사이트 키를 여기에.
const TURNSTILE_SITE_KEY = '0x4AAAAAAEK4Lz3VPkz6RFFv';

const Auth = {
  _KS: 'cdg_auth_session',

  async _api(path, { method = 'POST', body = null, auth = false } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (auth) {
      const s = this.getSession();
      if (s && s.token) headers['Authorization'] = 'Bearer ' + s.token;
    }
    try {
      const res = await fetch(API_BASE + path, {
        method, headers, body: body ? JSON.stringify(body) : null,
      });
      const j = await res.json();
      // HTTP 상태를 함께 돌려준다 — 호출부가 409(중복) 같은 특정 실패를 구분해
      // 다른 UI를 보여줄 수 있도록. 서버 응답에 status 필드가 있으면 덮어쓰지 않는다.
      if (j && typeof j === 'object' && j.status === undefined) j.status = res.status;
      return j;
    } catch (e) {
      // 화면 문구만으로는 원인을 알 수 없다(CORS·차단·오프라인·주소오류가 전부 같은 메시지).
      // 어떤 주소로 무엇이 실패했는지 콘솔에 남겨 진단할 수 있게 한다.
      console.error('[챔로드] API 요청 실패:', method, API_BASE + path, '/ auth=' + auth, e);
      return { ok: false, error: '서버에 연결할 수 없습니다. 네트워크 상태를 확인한 뒤 다시 시도해주세요.' };
    }
  },

  _saveSession(token, user) {
    const session = { token, email: user.email, name: user.name, expiresAt: user.expiresAt, emailVerified: !!user.emailVerified };
    try { localStorage.setItem(this._KS, JSON.stringify(session)); } catch {}
    return session;
  },

  // 세션 캐시의 emailVerified를 서버 값으로 갱신(있으면 저장). 미인증 안내 배너 판정에 쓴다.
  _setVerified(v) {
    const s = this.getSession();
    if (s) { s.emailVerified = v; try { localStorage.setItem(this._KS, JSON.stringify(s)); } catch {} }
  },

  getSession() {
    try {
      const s = JSON.parse(localStorage.getItem(this._KS));
      if (!s) return null;
      if (s.expiresAt && Date.now() > s.expiresAt) {
        try { localStorage.removeItem(this._KS); } catch {}
        return null;
      }
      return s;
    } catch { return null; }
  },

  isLoggedIn()    { return !!this.getSession(); },
  getCurrentUser(){ return this.getSession(); },

  async login(email, password, remember = false) {
    const r = await this._api('/api/auth/login', {
      body: { email: email.toLowerCase().trim(), password, remember },
    });
    if (!r.ok) return r;
    const user = this._saveSession(r.token, r.user);
    await DataSync.syncOnLogin();   // 서버 데이터 pull(또는 게스트 데이터 이관)
    return { ok: true, user };
  },

  // agree = 이용약관·개인정보처리방침 동의 + 만 14세 이상 확인(화면 체크박스 하나로 받는다).
  // 서버가 이 값을 필수로 요구하고 동의 시각·버전을 저장한다 — 화면에서만 검사하면
  // 동의 사실을 남길 방법이 없고, API 직접 호출로 우회된다.
  async signup(name, email, password, agree, turnstileToken) {
    const r = await this._api('/api/auth/signup', {
      body: {
        name: name.trim(), email: email.toLowerCase().trim(), password, agree: agree === true,
        turnstileToken: turnstileToken || '',   // 서버는 시크릿 미설정 시 이 값을 무시한다
      },
    });
    if (!r.ok) return r;
    const user = this._saveSession(r.token, r.user);
    await DataSync.syncOnLogin();   // 새 계정: 게스트로 만든 로컬데이터를 계정으로 이관
    return { ok: true, user };
  },

  // 이메일 인증 상태를 서버에서 다시 받아 세션 캐시에 반영(배너 판정용).
  async me() {
    const r = await this._api('/api/auth/me', { method: 'GET', auth: true });
    if (r.ok && r.user) this._setVerified(!!r.user.emailVerified);
    return r;
  },

  // 비밀번호 재설정 요청 — 서버는 계정 존재 여부와 무관하게 항상 성공 응답(열거 방지).
  async requestReset(email) {
    return this._api('/api/auth/request-reset', { body: { email: email.toLowerCase().trim() } });
  },

  // 재설정 링크의 토큰 + 새 비밀번호로 실제 변경.
  async resetPassword(token, password) {
    return this._api('/api/auth/reset-password', { body: { token, password } });
  },

  // 가입 인증 링크의 토큰으로 이메일 인증 완료.
  async verifyEmail(token) {
    return this._api('/api/auth/verify-email', { body: { token } });
  },

  // 인증 메일 재발송(로그인 필요). 이미 인증돼 있으면 캐시도 갱신.
  async resendVerification() {
    const r = await this._api('/api/auth/resend-verification', { auth: true });
    if (r.ok && r.alreadyVerified) this._setVerified(true);
    return r;
  },

  // 결제 유료회원 SMS 번호 인증 — 인증번호 발송(로그인 필요). 서버가 쿨다운·시간당 제한 처리.
  async sendPhoneCode(phone) {
    return this._api('/api/phone/send-code', { auth: true, body: { phone: String(phone || '').replace(/\D/g, '') } });
  },

  // 발송된 인증번호 검증 — 성공 시 서버가 users.phone + phone_verified 설정.
  async verifyPhoneCode(code) {
    return this._api('/api/phone/verify-code', { auth: true, body: { code: String(code || '').replace(/\D/g, '') } });
  },

  async changePassword(currentPassword, newPassword) {
    return this._api('/api/auth/change-password', {
      auth: true, body: { currentPassword, newPassword },
    });
  },

  // 회원탈퇴 — 서버 계정·데이터 삭제 후 이 브라우저에 남은 데이터도 함께 지운다.
  async deleteAccount(password) {
    const r = await this._api('/api/auth/delete-account', { auth: true, body: { password } });
    if (!r.ok) return r;
    DataSync.cancelPending();            // 삭제 후 재업로드되는 것 방지
    DataSync._clearLocal();              // 진단·체크리스트 등 로컬 사본 삭제
    try { localStorage.removeItem(this._KS); } catch {}
    return { ok: true };
  },

  // 로그아웃 시 지우는 이용권 캐시 키(cdg_ 접두사 제외).
  // 남겨 두면 공용 PC에서 다음 사용자에게 "○○ 패키지 이용 중"이 계속 보인다.
  // ⚠️ Storage.remove()를 쓰면 안 된다 — DataSync가 서버 user_data에서도 지워
  //    handleGetData의 plan_packages가 비어 정상 구매자가 잠긴다. 로컬만 지운다.
  _PLAN_CACHE: ['plan', 'plan_type', 'plan_package', 'plan_package_name', 'plan_packages', 'entitlements', 'content_access'],

  logout() {
    const s = this.getSession();
    try { localStorage.removeItem(this._KS); } catch {}
    // 다음 로그인 때 syncOnLogin이 서버에서 다시 받아오므로 캐시만 비우면 된다
    for (const k of this._PLAN_CACHE) {
      try { localStorage.removeItem('cdg_' + k); } catch {}
    }
    // 서버 세션 무효화는 백그라운드로 (실패해도 로컬 로그아웃은 완료)
    if (s && s.token) {
      fetch(API_BASE + '/api/auth/logout', {
        method: 'POST', headers: { 'Authorization': 'Bearer ' + s.token },
      }).catch(() => {});
    }
  },

  requireLogin() {
    if (!this.isLoggedIn()) {
      location.href = 'login.html?next=' + encodeURIComponent(location.href);
      return false;
    }
    return true;
  }
};

/* ── 탭 간 계정 전환 감지 ──
   localStorage는 같은 사이트의 모든 탭이 공유한다. 그래서 다른 탭에서 로그아웃하거나
   다른 계정으로 로그인하면, 이 탭은 화면만 옛 계정인 채로 남는다.
   그 상태에서 무언가를 저장하면 옛 계정 화면의 값이 새 계정 데이터에 섞여 들어갈 수 있다
   (진단 결과·진행률 등은 계정별로 서버에 저장되므로 실제 오염이 된다).
   계정이 바뀐 것을 감지하면 이 탭을 새로 고쳐 현재 계정 기준으로 다시 그린다.

   ⚠️ storage 이벤트는 '변경을 일으킨 탭'에는 발생하지 않는다 — 새로고침 루프가 생기지 않는다.
   이메일이 그대로면(토큰 갱신·이메일 인증 상태 반영 등) 무시한다. */
window.addEventListener('storage', (e) => {
  if (e.key !== Auth._KS) return;
  const emailOf = (v) => { try { return (JSON.parse(v || 'null') || {}).email || ''; } catch (err) { return ''; } };
  if (emailOf(e.oldValue) === emailOf(e.newValue)) return;   // 같은 계정 — 화면을 흔들 이유가 없다
  location.reload();
});

/* ── Toast ── */
function showToast(msg, type = 'info') {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    document.body.appendChild(t);
  }
  const colors = { info: 'bg-blue-700', success: 'bg-green-600', error: 'bg-red-600', warn: 'bg-amber-600' };
  t.className = (colors[type] || colors.info) + ' show';
  t.textContent = msg;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2800);
}

/* ── Number format ── */
function formatWon(n) {
  if (isNaN(n) || n === null) return '0원';
  n = Math.round(n);
  if (n === 0) return '0원';

  const uk  = Math.floor(n / 100_000_000);
  const man = Math.floor((n % 100_000_000) / 10_000);
  const won = n % 10_000;

  const parts = [];
  if (uk  > 0) parts.push(uk.toLocaleString('ko-KR')  + '억');
  if (man > 0) parts.push(man.toLocaleString('ko-KR') + '만');
  if (won > 0) parts.push(won.toLocaleString('ko-KR'));

  return (parts.length ? parts.join(' ') : '0') + '원';
}

/* ── 관할법원 찾기 (개인회생·파산 공용) ──
   기준: 채무자의 보통재판적(=주민등록상 주소) 소재지 관할 지방법원 본원·회생법원 전속(채무자회생법 제3조).
   지원(支院)은 접수하지 않음 — 춘천지법 강릉지원만 예외. 회생법원 6곳(2026. 3. 대전·대구·광주 추가 개원) 기준.
   alt = 본래 관할 외에 선택적으로 신청할 수 있는 회생법원(제3조 특례). */
const COURT_FINDER_DATA = {
  '서울특별시': { court: '서울회생법원' },
  '부산광역시': { court: '부산회생법원' },
  '인천광역시': { court: '인천지방법원' },
  '대구광역시': { court: '대구회생법원' },
  '광주광역시': { court: '광주회생법원' },
  '대전광역시': { court: '대전회생법원' },
  '울산광역시': { court: '울산지방법원', alt: '부산회생법원' },
  '세종특별자치시': { court: '대전회생법원' },
  '경기도': { sub: [
    { label: '수원·성남·안양·안산·용인·화성·평택·광명·시흥·과천·의왕·군포·오산·하남·광주·이천·여주·양평·안성 (경기 남부)', court: '수원회생법원' },
    { label: '의정부·고양·파주·남양주·구리·양주·동두천·포천·연천·가평 (경기 북부)', court: '의정부지방법원' },
    { label: '부천시·김포시', court: '인천지방법원' },
  ]},
  '강원특별자치도': { sub: [
    { label: '춘천·원주·강릉 외 지역 등 (강원 서부)', court: '춘천지방법원' },
    { label: '강릉·동해·삼척·속초·양양·고성 (강원 동부)', court: '춘천지방법원 강릉지원', note: '지원 중 유일하게 회생·파산 사건을 접수하는 예외입니다.' },
  ]},
  '충청북도': { court: '청주지방법원', alt: '대전회생법원' },
  '충청남도': { court: '대전회생법원' },
  '전북특별자치도': { court: '전주지방법원', alt: '광주회생법원' },
  '전라남도': { court: '광주회생법원' },
  '경상북도': { court: '대구회생법원' },
  '경상남도': { sub: [
    { label: '창원·김해·진주·통영·밀양·거창 등 (양산 제외)', court: '창원지방법원', alt: '부산회생법원' },
    { label: '양산시', court: '울산지방법원', alt: '부산회생법원' },
  ]},
  '제주특별자치도': { court: '제주지방법원', alt: '광주회생법원' },
};

function initCourtFinder(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const regions = Object.keys(COURT_FINDER_DATA);
  el.innerHTML = `
    <div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
      <h3 class="font-bold text-slate-800 mb-0.5 text-sm">🏛️ 내 관할법원 찾기</h3>
      <p class="text-xs text-slate-500 mb-3">개인회생·파산은 <strong>주민등록상 주소지</strong> 관할 법원(지방법원 본원·회생법원)에만 신청할 수 있습니다. 거주 지역을 선택하세요.</p>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
        <select id="cf-region" class="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white">
          <option value="">시·도 선택</option>
          ${regions.map(r => `<option value="${r}">${r}</option>`).join('')}
        </select>
        <select id="cf-sub" class="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white hidden">
          <option value="">시·군 선택</option>
        </select>
      </div>
      <div id="cf-result"></div>
      <p class="text-[11px] text-slate-400 mt-2 leading-relaxed">
        ※ 2026. 3. 기준(회생법원 6곳). 실거주지가 주민등록상 주소와 다르면 전입신고부터 정리하세요. 전자소송으로 접수하면 관할 법원이 자동 안내되며,
        최종 확인은 <a href="https://www.scourt.go.kr/region/location/RegionSearchListAction.work" target="_blank" rel="noopener" class="text-blue-600 hover:underline">대법원 관할법원 찾기 ↗</a>에서 할 수 있습니다.
      </p>
    </div>`;

  const regionSel = document.getElementById('cf-region');
  const subSel = document.getElementById('cf-sub');
  const result = document.getElementById('cf-result');

  function showResult(entry) {
    if (!entry) { result.innerHTML = ''; return; }
    result.innerHTML = `
      <div class="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
        <p class="text-sm text-slate-700">관할법원: <strong class="text-blue-700">${entry.court}</strong></p>
        ${entry.alt ? `<p class="text-xs text-slate-500 mt-1">본래 관할 외에 <strong>${entry.alt}</strong>에도 신청할 수 있습니다(채무자회생법 제3조 특례 — 원하는 쪽 선택 가능).</p>` : ''}
        ${entry.note ? `<p class="text-xs text-slate-500 mt-1">${entry.note}</p>` : ''}
      </div>`;
  }

  regionSel.addEventListener('change', () => {
    const data = COURT_FINDER_DATA[regionSel.value];
    result.innerHTML = '';
    if (!data) { subSel.classList.add('hidden'); return; }
    if (data.sub) {
      subSel.innerHTML = '<option value="">시·군 선택</option>' + data.sub.map((s, i) => `<option value="${i}">${s.label}</option>`).join('');
      subSel.classList.remove('hidden');
    } else {
      subSel.classList.add('hidden');
      showResult(data);
    }
  });
  subSel.addEventListener('change', () => {
    const data = COURT_FINDER_DATA[regionSel.value];
    if (data && data.sub && subSel.value !== '') showResult(data.sub[Number(subSel.value)]);
    else result.innerHTML = '';
  });
}

/* ── 플로팅 임시저장 버튼 (셀프 진행 체크리스트 페이지 전용) ──
   체크리스트는 항목 변경 시 자동 저장되므로, 이 버튼은 현재 상태를 저장 확인하고
   마지막 저장 시각을 표시해 사용자에게 "저장되고 있다"는 확신을 준다.
   getStatus() → { done, total } (진행 상황 표시용, 없어도 됨) */
function initTempSave(getStatus) {
  if (document.getElementById('temp-save-btn')) return;
  const btn = document.createElement('button');
  btn.id = 'temp-save-btn';
  btn.type = 'button';
  btn.title = '진행 상황 임시저장';
  const setLabel = (icon, text) => {
    btn.innerHTML = `<span class="ts-ic">${icon}</span><span class="ts-label">${text}</span>`;
  };
  setLabel('💾', '임시저장');

  btn.onclick = () => {
    let s = null;
    try { s = (typeof getStatus === 'function') ? getStatus() : null; } catch (e) {}
    // 데이터는 이미 자동 저장됨 — 저장 시각 기록 + 확인 표시
    let stamp = '';
    try {
      const now = new Date();
      stamp = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
      btn.dataset.savedAt = stamp;
    } catch (e) {}
    btn.classList.add('saved');
    setLabel('✓', '저장됨');
    showToast(s ? `진행 상황을 저장했습니다 · ${s.done}/${s.total} 처리 완료` : '진행 상황을 저장했습니다.', 'success');
    clearTimeout(btn._t);
    btn._t = setTimeout(() => {
      btn.classList.remove('saved');
      setLabel('💾', btn.dataset.savedAt ? `${btn.dataset.savedAt} 저장됨` : '임시저장');
    }, 1800);
  };
  document.body.appendChild(btn);
}

/* ── Scroll-to-top button ── */
function initScrollTop() {
  const btn = document.createElement('button');
  btn.id = 'scroll-top-btn';
  btn.title = '맨 위로';
  btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 15l-6-6-6 6"/></svg>`;
  btn.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
  document.body.appendChild(btn);

  window.addEventListener('scroll', () => {
    btn.classList.toggle('visible', window.scrollY > 300);
  }, { passive: true });
}

/* ── 법률 용어 사전 · 자동 툴팁 ── */
// 이 사이트의 이용자는 대부분 절차 용어를 처음 접한다. 페이지마다 수동으로
// <span class="term-tip">을 심는 대신, 본문을 훑어 자동으로 점선 밑줄 + 설명을 붙인다.
// 같은 용어는 화면에 처음 나온 한 번만 태깅한다 — 본문이 점선으로 뒤덮이는 것을 막기 위해.
const GLOSSARY = {
  // 돈 계산
  '청산가치':   '지금 당장 파산했을 때 재산을 팔아 채권자에게 돌아갈 금액입니다.',
  '가용소득':   '소득에서 세금·보험료와 법이 인정하는 생계비를 뺀, 빚 갚는 데 쓸 수 있는 돈입니다.',
  '가처분소득': '월 소득에서 생활비를 뺀 금액. 채무조정에서 실제 변제 여력을 나타내는 용어로 사용됩니다.',
  '표준생계비': '법원이 인정하는 생활비. 기준중위소득의 60%가 원칙이며 사정에 따라 늘거나 줄 수 있습니다.',
  '기준중위소득': '정부가 매년 고시하는 가구소득의 중간값. 가구원 수별로 정해집니다.',
  '변제기간':   '변제계획에 따라 돈을 갚아 나가는 기간. 보통 3년, 최대 5년입니다.',
  '안분':       '채권 금액의 비율대로 나누어 배분하는 것입니다.',
  '환가':       '재산을 팔아 현금으로 바꾸는 것입니다.',
  // 서류
  '변제계획안': '몇 년간 매달 얼마씩 나눠 갚겠다고 법원에 내는 계획서입니다.',
  '변제계획':   '몇 년간 매달 얼마씩 나눠 갚겠다고 법원에 내는 계획입니다.',
  '채권자목록': '누구에게 얼마를 빚졌는지 빠짐없이 적은 목록. 빠뜨리면 그 빚은 면책되지 않을 수 있습니다.',
  '진술서':     '빚을 지게 된 경위와 현재 생활 형편을 직접 적어 내는 서류입니다.',
  '해약환급금': '지금 보험을 해지하면 돌려받는 돈. 재산으로 계산됩니다.',
  '임차보증금': '전세·월세 보증금. 재산에 잡히지만 일부는 면제재산으로 신청할 수 있습니다.',
  '부양가족':   '실제로 생계를 같이하며 부양하는 가족. 인원수가 많을수록 인정 생계비가 올라갑니다.',
  '원천징수':   '돈을 줄 때 세금을 미리 떼고 주는 것. 3.3%를 뗐다면 사업(영업)소득일 수 있습니다.',
  // 절차·결정
  '개시결정':   '법원이 "개인회생 절차를 시작한다"고 내리는 결정입니다.',
  '인가결정':   '법원이 변제계획을 최종 승인하는 결정. 납입은 보통 인가 전부터 시작합니다.',
  '면책결정':   '남은 빚의 책임을 없애 주는 최종 결정. 세금·벌금·양육비 등은 남습니다.',
  '면책불허가': '도박·재산은닉 등의 사유가 있어 법원이 면책을 해 주지 않는 것입니다.',
  '재량면책':   '면책불허가 사유가 있어도 사정을 참작해 법원이 재량으로 면책해 주는 것입니다.',
  '특별면책':   '변제를 다 마치지 못해도 본인 책임 없는 사유 등 요건을 갖추면 남은 빚을 면책해 주는 제도입니다.',
  '비면책':     '면책되지 않는다는 뜻. 세금·벌금·양육비 등은 면책 후에도 남습니다.',
  '면책':       '법원이 빚 갚을 책임을 없애 주는 것. 일부 채무와 보증인 책임은 남습니다.',
  '보정권고':   '법원이나 회생위원이 고쳐야 할 내용을 적어 보내는 문서. 기한 안에 답해야 합니다.',
  '보정명령':   '법원이 서류의 빠진 곳·틀린 곳을 고쳐 다시 내라고 하는 명령입니다.',
  '보정':       '법원이 서류의 빠진 곳·틀린 곳을 고쳐 다시 내라고 요구하는 것입니다.',
  '송달료':     '법원이 서류를 보내는 데 드는 비용. 신청할 때 미리 냅니다.',
  '송달':       '법원이 서류를 당사자·채권자에게 공식적으로 보내 전달하는 절차입니다.',
  '기각':       '법원이 신청 내용을 살펴본 뒤 받아들이지 않는 것입니다.',
  '즉시항고':   '법원 결정에 불복해 다시 판단해 달라는 것. 기간이 짧으니 바로 확인하세요.',
  '이의신청':   '결정이나 처분에 동의하지 않는다고 공식적으로 문제를 제기하는 것입니다.',
  '동시폐지':   '나눠 줄 재산도 절차비용 낼 돈도 없어 파산선고와 동시에 절차를 끝내는 것입니다.',
  // 사람·기관
  '회생위원':   '법원이 선임해 개인회생 사건의 서류 검토와 변제금 관리를 맡는 사람입니다.',
  '파산관재인': '법원이 선임해 파산자의 재산을 조사·처분하고 채권자에게 나눠 주는 사람입니다.',
  '파산재단':   '파산에서 채권자에게 나눠 줄 재산. 압류금지·면제재산은 빠집니다.',
  '신용회복위원회': '법원이 아닌 곳에서 채권자와 채무조정을 협의해 주는 기관입니다.',
  // 채권자 쪽 조치
  '포괄적금지명령': '모든 채권자의 강제집행·경매를 한꺼번에 막는 법원의 명령입니다.',
  '금지명령':   '채권자가 추심·강제집행을 하지 못하도록 법원이 미리 내리는 명령입니다.',
  '중지명령':   '이미 진행 중인 압류·경매 등을 잠시 멈추게 하는 법원의 명령입니다.',
  '가압류':     '재판 전에 재산을 미리 묶어 두어 처분하지 못하게 하는 것입니다.',
  '압류금지':   '법이 정한 최소 생활 재원이라 압류할 수 없는 재산·채권을 말합니다.',
  '압류':       '재산이나 급여를 묶어 처분하지 못하게 하는 것. 급여는 월 250만원까지 압류가 금지됩니다.',
  '추심':       '채권자가 빚을 갚으라고 연락하거나 청구해 받아 가는 행위입니다.',
  '별제권':     '담보 잡은 채권자가 담보물에서 먼저 받아 갈 권리. 개인회생 중에는 경매가 멈춥니다.',
  // 상태·행위
  '지급불능':   '빚을 갚을 능력이 없어 계속 갚아 나갈 수 없는 상태입니다.',
  '채무초과':   '가진 재산보다 빚이 더 많은 상태입니다.',
  '편파변제':   '여러 채권자 중 특정한 곳에만 몰아서 갚는 것. 문제가 될 수 있습니다.',
  '채무조정':   '빚의 이자·기간·금액을 조정해 갚을 수 있게 만드는 절차를 통틀어 이르는 말입니다.',
  '수임료':     '변호사·법무사에게 사건을 맡길 때 내는 보수입니다.',
  '수임':       '변호사·법무사가 사건을 맡아 대리하는 것입니다.',
};

// 태깅에서 제외할 영역 — 링크·버튼·입력창(중첩 상호작용 방지), 헤더·푸터(반복 노출),
// 제목(점선 밑줄이 어색하고, 설명은 본문에서 읽는 편이 낫다), 이미 태깅된 곳
const GLOSSARY_SKIP = 'a,button,input,textarea,select,option,script,style,code,pre,h1,h2,h3,' +
  '.term-tip,[data-no-tip],#header-placeholder,#footer-placeholder,nav,footer';

let glossaryTimer = null;

// 현재 화면에 이미 툴팁이 붙어 있는 용어 — DOM에서 매번 다시 읽는다.
// (탭 전환 등으로 본문이 통째로 다시 그려져도 스스로 복구되도록)
function taggedTerms() {
  const set = new Set();
  document.querySelectorAll('.term-tip').forEach(el => set.add(el.textContent.trim()));
  return set;
}

function tagTerms(root) {
  const scope = root || document.body;
  if (!scope) return;
  const used = taggedTerms();
  const remaining = Object.keys(GLOSSARY)
    .filter(t => !used.has(t))
    .sort((a, b) => b.length - a.length);   // 긴 용어 우선 — '면책결정'이 '면책'보다 먼저 잡히도록
  if (!remaining.length) return;
  const re = new RegExp(remaining.join('|'));

  const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      const p = node.parentElement;
      if (!p || p.closest(GLOSSARY_SKIP)) return NodeFilter.FILTER_REJECT;
      return re.test(node.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });
  const targets = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) targets.push(n);

  const done = new Set();                   // 한 번 붙인 용어는 이 회차에서 다시 붙이지 않는다
  for (const node of targets) {
    const text = node.nodeValue;
    const scan = new RegExp(re.source, 'g'); // 한 노드 안의 여러 용어를 한 번에 처리
    let m, last = 0, frag = null;
    while ((m = scan.exec(text))) {
      if (done.has(m[0])) continue;
      done.add(m[0]);
      frag = frag || document.createDocumentFragment();
      if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
      frag.appendChild(makeTermTip(m[0]));
      last = m.index + m[0].length;
    }
    if (!frag) continue;
    if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
    node.parentNode.replaceChild(frag, node);
  }
}

function makeTermTip(term) {
  const span = document.createElement('span');
  span.className = 'term-tip';
  span.setAttribute('data-tip', GLOSSARY[term]);
  span.setAttribute('tabindex', '0');
  span.setAttribute('role', 'button');
  span.setAttribute('aria-label', term + ' — ' + GLOSSARY[term]);
  span.textContent = term;
  return span;
}

function initGlossary() {
  tagTerms(document.body);

  // 본문 상당수가 JS로 나중에 그려진다(결과·진행센터·아코디언 등) — 그려질 때마다 다시 훑는다.
  // 태깅할 용어가 남지 않으면 tagTerms가 바로 반환해 더는 DOM을 건드리지 않으므로 순환하지 않는다.
  new MutationObserver(() => {
    clearTimeout(glossaryTimer);
    glossaryTimer = setTimeout(() => tagTerms(document.body), 200);
  }).observe(document.body, { childList: true, subtree: true });

  // 터치 기기에는 hover가 없다 — 탭하면 열리고, 다시 탭하거나 바깥을 누르면 닫힌다.
  document.addEventListener('click', (e) => {
    const tip = e.target.closest ? e.target.closest('.term-tip') : null;
    document.querySelectorAll('.term-tip.tip-open').forEach(el => {
      if (el !== tip) el.classList.remove('tip-open');
    });
    if (tip) tip.classList.toggle('tip-open');
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.term-tip.tip-open').forEach(el => el.classList.remove('tip-open'));
      return;
    }
    const el = e.target;
    if ((e.key === 'Enter' || e.key === ' ') && el.classList && el.classList.contains('term-tip')) {
      e.preventDefault();
      el.classList.toggle('tip-open');
    }
  });
}

/* ── Page init ── */
// 자체 익명 분석 — 허용된 이벤트만 서버로 보낸다. 개인·세션·IP는 담지 않는다.
// 실패해도 조용히 무시(사용자 흐름과 무관한 부가 기능).
function track(event, label) {
  try {
    fetch(API_BASE + '/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, label: String(label == null ? '' : label) }),
      keepalive: true,
    }).catch(() => {});
  } catch (e) {}
}

/* ── 유료 콘텐츠 게이트 (미리보기 방식) ── */
// allowed 패키지 중 하나를 서버에서 보유 확인해야 전체 이용. 미보유면 '미리보기 모드'로
// 앞부분만 열고 나머지를 잠근다.
//
// ⚠️ 전체를 덮는 오버레이를 쓰지 않는 이유(법적 요건):
// 「전자상거래 등에서의 소비자보호에 관한 법률」 제17조 제2항 제5호는 디지털콘텐츠의
// '제공이 개시된 경우' 청약철회를 제한할 수 있게 하지만, 같은 항 단서와 제6항 단서에 따라
// 사업자가 '청약철회 불가 사실의 표시'와 '시험 사용 상품 제공 등의 조치'를 모두 해야만
// 그 제한이 유효하다. 시행령 제21조의2 제1호(일부 이용의 허용 — 미리보기)를 충족시키기
// 위해 콘텐츠 앞부분을 실제로 열어 둔다. 이 미리보기를 없애면 환불 제한도 함께 무효가 된다.
// 관련 문구: pricing.html 결제·환불 안내, terms.html 제6조.
//
// 로컬 plan은 위조 가능하므로 서버(plan_packages)가 최종 판정. 테스트 지급·결제 모두 서버에 반영되어 통과.
async function requirePackage(allowed, pkgName) {
  const has = (pkgs) => Array.isArray(pkgs) && pkgs.some(p => allowed.includes(p));

  if (typeof Auth === 'undefined' || !Auth.isLoggedIn()) {
    enterPreview(pkgName, false);
    return;
  }
  // 로컬 캐시로 즉시 판단(구매자 UX). 미보유면 일단 미리보기로 두고 서버로 확인.
  const localOk = has(Storage.load('plan_packages') || []);
  if (!localOk) enterPreview(pkgName, true);

  try {
    const res = await fetch(API_BASE + '/api/data', {
      headers: { 'Authorization': 'Bearer ' + Auth.getSession().token },
    });
    const j = await res.json();
    const serverPkgs = (j && j.ok && j.data && j.data.plan_packages) || [];
    // 이 패키지의 제공이 이미 개시됐는지 — 사전 고지를 다시 띄우지 않기 위한 판단 근거
    const opened = (j && j.ok && j.data && j.data.content_access) || [];
    _accessOpenedBefore = Array.isArray(opened) && opened.some(p => allowed.includes(p));
    if (has(serverPkgs)) unlockContent(allowed);  // 실제 보유 확정 → 전체 공개
    else enterPreview(pkgName, true);             // 미보유 확정 → 미리보기(로컬 위조도 여기서 걸림)
  } catch (e) {
    // 네트워크 실패 — 로컬 판단을 신뢰(정상 구매자 보호)
    if (localOk) unlockContent(allowed);
  }
}

/* ── 미리보기(일부 이용의 허용) ── */
// 각 유료 페이지는 렌더 후 isPreview()를 확인해 lockSection()으로 뒷부분을 잠근다.
// 판정이 서버 응답 뒤에 바뀔 수 있으므로 'chamroad:gate' 이벤트로 다시 그린다.
let _preview = { on: false, pkgName: '', loggedIn: false };
let _gatePackages = [];        // 이 페이지가 요구하는 패키지 키 — 이용 개시 기록에 쓴다
let _accessNoted = false;      // 페이지당 1회만 서버로 보낸다

function isPreview() { return _preview.on; }

function enterPreview(pkgName, loggedIn) {
  const changed = !_preview.on || _preview.pkgName !== pkgName;
  _preview = { on: true, pkgName, loggedIn };
  document.body.classList.add('preview-mode');
  if (changed) document.dispatchEvent(new CustomEvent('chamroad:gate'));
}

function unlockContent(allowed) {
  const wasPreview = _preview.on;
  _preview = { on: false, pkgName: '', loggedIn: true };
  _gatePackages = allowed;
  document.body.classList.remove('preview-mode');
  if (wasPreview) document.dispatchEvent(new CustomEvent('chamroad:gate'));
  // ⚠️ 여기서 이용 개시를 기록하지 않는다. 결제 직후 자동 이동으로 이 함수가 호출되므로,
  //    여기서 기록하면 소비자가 아무것도 열지 않았는데 청약철회가 막힌다.
  //    실제로 잠긴 콘텐츠를 여는 행위에서 noteContentOpened()를 호출한다.
}

// 잠금 안내 카드. 미리보기 경계에 삽입된다.
function previewLockCard(note) {
  const next = encodeURIComponent(location.href);
  const cta = _preview.loggedIn
    ? `<a href="pricing.html" class="inline-block bg-blue-700 text-white px-5 py-2.5 rounded-full font-medium text-sm hover:bg-blue-800 transition-colors">구매하고 전체 이용하기</a>`
    : `<a href="login.html?next=${next}" class="inline-block bg-blue-700 text-white px-5 py-2.5 rounded-full font-medium text-sm hover:bg-blue-800 transition-colors">로그인</a>
       <a href="pricing.html" class="inline-block ml-2 text-sm text-blue-600 hover:underline">요금제 보기</a>`;
  const el = document.createElement('div');
  el.className = 'preview-lock bg-white rounded-2xl border-2 border-dashed border-slate-300 p-6 text-center';
  el.innerHTML =
    `<div class="text-3xl mb-2">🔒</div>
     <h3 class="font-bold text-slate-800 mb-1">${note || '여기부터는 ' + _preview.pkgName + ' 전용입니다'}</h3>
     <p class="text-sm text-slate-500 mb-4">여기까지는 <strong>구매 전 미리보기</strong>로 열어 두었습니다. 내용을 확인해 보고 결정하세요.</p>
     ${cta}`;
  return el;
}

// container의 앞 keep개 자식만 남기고 나머지를 지운 뒤 잠금 카드를 붙인다.
// keep=0이면 섹션 전체가 잠긴다.
function lockSection(container, keep, note) {
  if (!_preview.on || !container) return false;
  Array.from(container.children).slice(keep).forEach(n => n.remove());
  container.appendChild(previewLockCard(note));
  return true;
}

// 구매자가 '미리보기 범위를 넘어선 콘텐츠를 실제로 연' 시각을 서버에 남긴다.
// 전자상거래법 제17조 제2항 제5호의 '제공 개시' 시점 = 청약철회 가능 여부의 기준.
//
// ⚠️ 페이지 진입·잠금 해제만으로는 절대 호출하지 말 것.
// 결제 후 진행센터로 자동 이동하므로, 진입 시점에 기록하면 소비자가 아무것도 열지 않았는데
// 청약철회가 막혀 약관 제6조 ①(결제일부터 14일 전액 환불)이 사실상 작동하지 않게 된다.
// 호출 지점: 2단계 이상으로 이동, 항목 '자세히' 펼치기, 서식 작성예시 열기 등 명시적 열람 행위.
function noteContentOpened() {
  if (_accessNoted || isPreview()) return;   // 미리보기 상태의 열람은 '제공 개시'가 아니다
  _accessNoted = true;
  markContentAccess(_gatePackages);
}

/* ── 제공 개시 전 사전 고지 ──
   구매자가 잠긴 콘텐츠를 '처음' 열기 직전에 환불 제한을 알리고 확인을 받는다.
   법 제17조 제6항 단서는 청약철회 제한이 유효하려면 '청약철회 불가 사실의 표시'를
   요구하는데, 결제 화면의 고지보다 실제로 열리는 이 순간의 고지가 가장 확실하다.
   동시에 이용자가 무심코 열어 환불 기회를 잃는 것을 막는다.

   반환: true = 열어도 됨(기록 완료), false = 이용자가 취소함.
   이미 열람 기록이 있거나(_accessOpenedBefore) 미리보기면 묻지 않는다. */
let _accessOpenedBefore = false;   // 서버에 first_access_at이 이미 있는 패키지인가

async function confirmContentOpen() {
  if (isPreview()) return true;                       // 미리보기는 제공 개시가 아니다
  if (_accessNoted || _accessOpenedBefore) return true;  // 이미 개시된 뒤 — 다시 묻지 않는다
  const ok = await openNoticeModal();
  if (!ok) return false;
  noteContentOpened();
  return true;
}

// 사전 고지 모달 — 브라우저 기본 confirm 대신 직접 그린다(내용이 길고, 법적 고지라 읽혀야 한다).
function openNoticeModal() {
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.className = 'fixed inset-0 z-[200] bg-black/40 flex items-center justify-center p-4';
    wrap.innerHTML = `
      <div class="bg-white rounded-2xl shadow-xl max-w-sm w-full p-5" role="dialog" aria-modal="true" aria-labelledby="oc-t">
        <h3 id="oc-t" class="font-bold text-slate-800 mb-2">이 부분을 열면 환불 대상에서 제외됩니다</h3>
        <p class="text-sm text-slate-600 leading-relaxed">
          지금 여시는 내용은 <strong>여는 즉시 제공이 개시</strong>되어, 그 부분에 대해서는
          <strong class="text-amber-700">환불을 받으실 수 없습니다</strong>(전자상거래법 제17조 제2항 제5호).
        </p>
        <ul class="mt-3 space-y-1.5 text-xs text-slate-500 list-disc pl-4">
          <li><strong class="text-slate-600">아직 열지 않은 단계</strong>는 결제일부터 14일 이내라면 그대로 환불됩니다.</li>
          <li>먼저 살펴보고 결정하고 싶으시면 <strong class="text-slate-600">지금 닫으셔도</strong> 됩니다.</li>
          <li>한 번 확인하시면 이 안내는 다시 표시되지 않습니다.</li>
        </ul>
        <div class="flex gap-2 justify-end mt-5">
          <button id="oc-no" class="border border-slate-300 px-4 py-2 text-slate-700 text-sm rounded-xl hover:bg-slate-50 transition-colors">닫기</button>
          <button id="oc-yes" class="bg-blue-700 text-white px-4 py-2 rounded-xl text-sm hover:bg-blue-800 transition-colors">이해했습니다, 열기</button>
        </div>
      </div>`;
    const done = (v) => { wrap.remove(); document.removeEventListener('keydown', onKey); resolve(v); };
    const onKey = (e) => { if (e.key === 'Escape') done(false); };
    document.body.appendChild(wrap);
    wrap.querySelector('#oc-no').onclick = () => done(false);
    wrap.querySelector('#oc-yes').onclick = () => done(true);
    wrap.onclick = (e) => { if (e.target === wrap) done(false); };   // 바깥 클릭 = 닫기
    document.addEventListener('keydown', onKey);
    wrap.querySelector('#oc-yes').focus();
  });
}

function markContentAccess(allowed) {
  if (typeof Auth === 'undefined' || !Auth.isLoggedIn()) return;
  if (!Array.isArray(allowed) || !allowed.length) return;
  const pkg = (Storage.load('plan_packages') || []).find(p => allowed.includes(p)) || allowed[0];
  if (!pkg) return;
  try {
    fetch(API_BASE + '/api/content/access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + Auth.getSession().token },
      body: JSON.stringify({ package: pkg }),
      keepalive: true,
    }).catch(() => {});
  } catch (e) {}
}

// 미인증 이용자에게 이메일 인증을 권하는 슬림 배너(소프트 — 이용을 막지 않는다).
// 비로그인·인증완료(또는 상태 미상)에는 표시하지 않고, 세션 동안 닫기를 기억한다.
function renderVerifyBanner() {
  if (!Auth || !Auth.getSession) return;
  const s = Auth.getSession();
  if (!s) return;                                     // 비로그인
  try { if (sessionStorage.getItem('cdg_verify_hide')) return; } catch {}

  const paint = () => {
    const ss = Auth.getSession();
    if (!ss || ss.emailVerified !== false) return;    // 인증됨/미상이면 표시 안 함
    if (document.getElementById('verify-banner')) return;
    const bar = document.createElement('div');
    bar.id = 'verify-banner';
    bar.style.cssText = 'background:#eef2ff;border-bottom:1px solid #c7d2fe;color:#3730a3';
    bar.innerHTML = '<div style="max-width:72rem;margin:0 auto;padding:8px 16px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:13px">'
      + '<span style="flex:1;min-width:180px">📧 이메일 인증이 아직 안 됐어요. 가입 시 보낸 메일의 인증 링크를 눌러주세요.</span>'
      + '<button id="vb-resend" style="background:#4f46e5;color:#fff;border:none;border-radius:6px;padding:5px 12px;font-size:12px;font-weight:600;cursor:pointer">인증 메일 재발송</button>'
      + '<button id="vb-hide" aria-label="닫기" style="background:none;border:none;color:#6366f1;cursor:pointer;font-size:16px;line-height:1;padding:4px">✕</button>'
      + '</div>';
    const ph = document.getElementById('header-placeholder');
    if (ph && ph.parentNode) ph.parentNode.insertBefore(bar, ph.nextSibling);
    else document.body.insertBefore(bar, document.body.firstChild);

    document.getElementById('vb-hide').onclick = () => {
      try { sessionStorage.setItem('cdg_verify_hide', '1'); } catch {}
      bar.remove();
    };
    document.getElementById('vb-resend').onclick = async () => {
      const b = document.getElementById('vb-resend');
      b.disabled = true; b.textContent = '보내는 중...';
      const r = await Auth.resendVerification();
      if (r && r.alreadyVerified) { bar.remove(); return; }
      if (r && r.ok) { showToast(r.message || '인증 메일을 보냈습니다.', 'success'); b.textContent = '메일 보냈어요 ✓'; }
      else { b.disabled = false; b.textContent = '인증 메일 재발송'; showToast((r && r.error) || '재발송에 실패했습니다.', 'error'); }
    };
  };

  // 옛 세션(emailVerified 필드가 없던 시절 로그인)은 서버에서 상태를 확정한 뒤 판정.
  if (s.emailVerified === undefined) Auth.me().then(paint).catch(() => {});
  else paint();
}

function initPage(activePage) {
  renderHeader(activePage);
  renderFooter();
  initScrollTop();
  initGlossary();                  // 어려운 용어에 설명 툴팁 자동 부착
  track('pageview', activePage);   // 페이지별 조회 수(익명)
  renderVerifyBanner();            // 미인증 이용자 안내 배너(소프트)
  document.addEventListener('click', (e) => {
    const d = document.getElementById('user-dropdown');
    if (d && !d.classList.contains('hidden') && !d.parentElement.contains(e.target)) {
      d.classList.add('hidden');
    }
  });
}
