/* ==============================
   챔로드 - 공통 JS
   ============================== */

const SITE_NAME = '챔로드';

const NAV_LINKS = [
  { href: 'index.html',          label: '홈',        id: 'home' },
  { href: 'diagnosis.html',      label: '무료진단',   id: 'diagnosis' },
  { href: 'rehabilitation.html', label: '개인회생',   id: 'rehabilitation' },
  { href: 'bankruptcy.html',     label: '개인파산',   id: 'bankruptcy' },
  { href: 'documents.html',      label: '서류체크',   id: 'documents' },
  { href: 'ai-review.html',      label: 'AI검토',    id: 'ai-review' },
  { href: 'resources.html',      label: 'FAQ',        id: 'resources' },
  { href: 'pricing.html',        label: '요금제',     id: 'pricing' },
  { href: 'about.html',          label: '소개글',     id: 'about' },
];

/* ── Header ── */
function renderHeader(activePage) {
  const el = document.getElementById('header-placeholder');
  if (!el) return;

  const desktopLinks = NAV_LINKS.map(l => {
    const active = activePage === l.id;
    return `<a href="${l.href}" class="text-sm font-medium transition-colors ${
      active ? 'text-blue-700 border-b-2 border-blue-700 pb-0.5' : 'text-slate-600 hover:text-blue-700'
    }">${l.label}</a>`;
  }).join('');

  const mobileLinks = NAV_LINKS.map(l => {
    const active = activePage === l.id;
    return `<a href="${l.href}" class="block px-4 py-3 text-sm ${
      active ? 'text-blue-700 bg-blue-50 font-semibold' : 'text-slate-700 hover:bg-slate-50'
    }">${l.label}</a>`;
  }).join('');

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

          <div class="hidden lg:flex items-center gap-5">${desktopLinks}</div>

          <div class="hidden lg:flex items-center gap-3">
            <a href="mypage.html" class="text-sm text-slate-600 hover:text-blue-700 transition-colors">마이페이지</a>
            <a href="diagnosis.html" class="bg-blue-700 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-800 transition-colors font-medium">무료진단 시작</a>
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
          <a href="mypage.html" class="block text-center py-2 text-sm text-slate-600 mb-2">마이페이지</a>
          <a href="diagnosis.html" class="block w-full text-center bg-blue-700 text-white py-3 rounded-lg font-medium text-sm">무료진단 시작하기</a>
        </div>
      </div>
    </nav>
  `;
}

function toggleMobileMenu() {
  const m = document.getElementById('mobile-menu');
  if (m) m.classList.toggle('open');
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
              <li><a href="https://www.ccrs.or.kr" target="_blank" rel="noopener" class="hover:text-white transition-colors">신용회복위원회</a></li>
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
}
