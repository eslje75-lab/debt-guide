/* ==============================
   챔로드 - 공통 JS
   ============================== */

const SITE_NAME = '챔로드';

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
            <div class="w-9 h-9 rounded-xl flex items-center justify-center" style="background:linear-gradient(135deg,#1e40af,#3b82f6)">
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
    <footer class="bg-slate-800 text-slate-400 mt-16 no-print">
      <div class="max-w-6xl mx-auto px-4 py-10">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">

          <div>
            <div class="flex items-center gap-2 mb-3">
              <div class="w-7 h-7 rounded-lg flex items-center justify-center" style="background:linear-gradient(135deg,#1e40af,#3b82f6)">
                <svg class="w-4 h-4" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M2 18L10 5L18 18" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                  <line x1="10" y1="8.5" x2="10" y2="11.5" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
                  <line x1="10" y1="14" x2="10" y2="17" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
              </div>
              <span class="text-white font-bold">${SITE_NAME}</span>
            </div>
            <p class="text-sm leading-relaxed">채무 정리 절차를 스스로 이해하고 준비할 수 있도록 돕는 정보 제공 플랫폼입니다.</p>
          </div>

          <div>
            <h4 class="text-slate-300 font-semibold mb-3 text-sm">주요 서비스</h4>
            <ul class="space-y-1.5 text-sm">
              <li><a href="diagnosis.html" class="hover:text-white transition-colors">무료 채무진단</a></li>
              <li><a href="rehabilitation.html" class="hover:text-white transition-colors">개인회생 셀프 진행가이드</a></li>
              <li><a href="bankruptcy.html" class="hover:text-white transition-colors">개인파산·면책 셀프 진행가이드</a></li>
              <li><a href="resources.html" class="hover:text-white transition-colors">FAQ</a></li>
            </ul>
          </div>

          <div>
            <h4 class="text-slate-300 font-semibold mb-3 text-sm">관련 공공기관</h4>
            <ul class="space-y-1.5 text-sm">
              <li><a href="https://ecfs.scourt.go.kr" target="_blank" rel="noopener" class="hover:text-white transition-colors">대법원 전자소송</a></li>
            </ul>
          </div>
        </div>

        <div class="border-t border-slate-700 pt-6 space-y-3">
          <p class="text-xs text-slate-500 text-center">© 2026 ${SITE_NAME} · 본 사이트는 법률대리 사이트가 아님을 고지하며, 법률상담·법률대리·사건 수임 또는 결과 보장을 제공하지 않습니다.</p>
          <p class="text-xs text-slate-500 text-center mt-1">사용자가 직접 절차를 이해하고 준비할 수 있도록 돕는 정보 제공 및 서류 점검 보조 서비스입니다.</p>
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

/* ── localStorage helpers ── */
const Storage = {
  save(key, data) {
    try { localStorage.setItem('cdg_' + key, JSON.stringify(data)); } catch(e) {}
  },
  load(key) {
    try { return JSON.parse(localStorage.getItem('cdg_' + key)); } catch(e) { return null; }
  },
  remove(key) {
    try { localStorage.removeItem('cdg_' + key); } catch(e) {}
  }
};

/* ── Auth (프론트엔드 mock — localStorage 기반) ── */
const Auth = {
  _KU: 'cdg_auth_users',
  _KS: 'cdg_auth_session',

  _enc(s) { try { return btoa(unescape(encodeURIComponent(s))); } catch { return btoa(s); } },
  _users() { try { return JSON.parse(localStorage.getItem(this._KU)) || []; } catch { return []; } },
  _save(u)  { try { localStorage.setItem(this._KU, JSON.stringify(u)); } catch {} },

  getSession() {
    try {
      const s = JSON.parse(localStorage.getItem(this._KS));
      if (!s) return null;
      if (s.expiresAt && Date.now() > s.expiresAt) { this.logout(); return null; }
      return s;
    } catch { return null; }
  },

  isLoggedIn()    { return !!this.getSession(); },
  getCurrentUser(){ return this.getSession(); },

  login(email, password, remember = false) {
    const u = this._users().find(u => u.email === email.toLowerCase().trim());
    if (!u || u.password !== this._enc(password))
      return { ok: false, error: '이메일 또는 비밀번호가 올바르지 않습니다.' };
    const session = { email: u.email, name: u.name, expiresAt: Date.now() + (remember ? 30 : 1) * 86400000 };
    try { localStorage.setItem(this._KS, JSON.stringify(session)); } catch {}
    return { ok: true, user: session };
  },

  signup(name, email, password) {
    name = name.trim(); email = email.toLowerCase().trim();
    if (!name)                return { ok: false, error: '이름을 입력해주세요.' };
    if (!email.includes('@')) return { ok: false, error: '올바른 이메일 주소를 입력해주세요.' };
    if (password.length < 8)  return { ok: false, error: '비밀번호는 8자 이상이어야 합니다.' };
    const users = this._users();
    if (users.find(u => u.email === email)) return { ok: false, error: '이미 사용 중인 이메일입니다.' };
    users.push({ email, name, password: this._enc(password), createdAt: new Date().toISOString() });
    this._save(users);
    return this.login(email, password, false);
  },

  logout() { try { localStorage.removeItem(this._KS); } catch {} },

  findEmail(name) {
    const u = this._users().find(u => u.name === name.trim());
    if (!u) return { ok: false, error: '일치하는 회원 정보를 찾을 수 없습니다.' };
    const [local, domain] = u.email.split('@');
    const masked = local.slice(0, 2) + '*'.repeat(Math.max(local.length - 2, 2)) + '@' + domain;
    return { ok: true, maskedEmail: masked };
  },

  verifyForReset(name, email) {
    const u = this._users().find(u => u.name === name.trim() && u.email === email.toLowerCase().trim());
    return !!u;
  },

  resetPassword(email, newPassword) {
    if (newPassword.length < 8) return { ok: false, error: '비밀번호는 8자 이상이어야 합니다.' };
    const users = this._users();
    const idx = users.findIndex(u => u.email === email.toLowerCase().trim());
    if (idx === -1) return { ok: false, error: '회원 정보를 찾을 수 없습니다.' };
    users[idx].password = this._enc(newPassword);
    this._save(users);
    return { ok: true };
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
