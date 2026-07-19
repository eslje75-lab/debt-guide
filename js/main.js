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
    for (const k of this._localKeys()) { const v = Storage.load(k); if (v !== null) d[k] = v; }
    return d;
  },
  _clearLocal() {
    for (const k of this._localKeys()) { try { localStorage.removeItem('cdg_' + k); } catch (e) {} }
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
    const put = {}; for (const [k, v] of this._put) put[k] = v;
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
const API_BASE = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
  ? 'http://localhost:8787'
  : 'https://chamroad-api.eslje75.workers.dev';

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
      return await res.json();
    } catch (e) {
      return { ok: false, error: '서버에 연결할 수 없습니다. 네트워크 상태를 확인한 뒤 다시 시도해주세요.' };
    }
  },

  _saveSession(token, user) {
    const session = { token, email: user.email, name: user.name, expiresAt: user.expiresAt };
    try { localStorage.setItem(this._KS, JSON.stringify(session)); } catch {}
    return session;
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

  async signup(name, email, password) {
    const r = await this._api('/api/auth/signup', {
      body: { name: name.trim(), email: email.toLowerCase().trim(), password },
    });
    if (!r.ok) return r;
    const user = this._saveSession(r.token, r.user);
    await DataSync.syncOnLogin();   // 새 계정: 게스트로 만든 로컬데이터를 계정으로 이관
    return { ok: true, user };
  },

  async changePassword(currentPassword, newPassword) {
    return this._api('/api/auth/change-password', {
      auth: true, body: { currentPassword, newPassword },
    });
  },

  logout() {
    const s = this.getSession();
    try { localStorage.removeItem(this._KS); } catch {}
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

/* ── Page init ── */
function initPage(activePage) {
  renderHeader(activePage);
  renderFooter();
  initScrollTop();
  document.addEventListener('click', (e) => {
    const d = document.getElementById('user-dropdown');
    if (d && !d.classList.contains('hidden') && !d.parentElement.contains(e.target)) {
      d.classList.add('hidden');
    }
  });
}
