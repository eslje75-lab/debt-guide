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
        ${user.isAdmin ? `
        <a href="admin.html" class="flex items-center gap-2 px-4 py-2.5 text-sm text-blue-700 hover:bg-blue-50 font-medium">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17V7m4 10V11m4 6V9M5 21h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
          운영 대시보드
        </a>` : ''}
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

async function authLogout() {
  let r = await Auth.logout(false);
  if (!r.ok) {
    if (r.canForce !== true) {
      showToast(r.error || '로그아웃하지 못했습니다.', 'warn');
      return;
    }
    const leave = confirm(
      '계정에 아직 동기화하지 못한 진행 내용이 있습니다.\n\n' +
      '지금 로그아웃하면 이 기기의 계정 자료를 삭제하므로 복구하지 못할 수 있습니다.\n' +
      '네트워크를 확인한 뒤 다시 시도하려면 [취소]를 눌러 주세요.\n\n' +
      '그래도 로그아웃하시겠습니까?'
    );
    if (!leave) {
      showToast(r.error || '동기화를 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.', 'warn');
      return;
    }
    r = await Auth.logout(true);
  }
  if (!r.ok) {
    showToast(r.error || '로그아웃하지 못했습니다.', 'warn');
    return;
  }
  showToast(r.localCleared === false
    ? '로그아웃은 완료됐지만 이 기기의 일부 구버전 자료는 남아 있습니다. 브라우저 설정에서 chamroad.com 사이트 데이터를 삭제해 주세요.'
    : '로그아웃되었습니다. 이 기기에 남은 계정 자료도 삭제했습니다.',
  r.localCleared === false ? 'warn' : 'info');
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
              <li><a href="numcheck.html" class="footer-link">숫자 검산기 (무료)</a></li>
              <li><a href="pricing.html" class="footer-link">챔로드 셀프진행</a></li>
              <li><a href="discharge.html" class="footer-link">개인회생 면책신청 안내</a></li>
              <li><a href="bankruptcy-after.html" class="footer-link">파산 선고 이후 안내</a></li>
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

/* ── 주민등록번호 자동 가리기 ──
   「개인정보 보호법」 제24조의2 제1항은 법령에 구체적 근거가 있는 경우 등이 아니면 주민등록번호를
   처리할 수 없도록 정한다. **정보주체의 동의를 받아도 처리할 수 없다**는 점에서 제23조의 민감정보와
   다르다. 우리에겐 그런 법령 근거가 없으므로, 주민등록번호는 **받지 않는 것이 유일하게 적법한 방법**이다.

   종전에는 "주민번호를 ○○으로 가린 뒤 넣어 주세요"라고 안내하고 경고창에서 [예]를 누르면 그대로
   보냈다 — 안내를 읽은 사람만 보호받는 구조였고, 법원 서류의 첫머리는 대개 "신청인 ○○○
   (주민등록번호 …)"이라 실제로 걸릴 확률이 높았다. 그래서 **안내가 아니라 코드로 지운다.**

   ⚠️ 같은 함수가 서버(api/src/index.js maskIdNumbers)에도 있다. 클라이언트를 우회할 수 있으므로
      진짜 경계선은 서버다. 한쪽만 고치지 말 것.
   ⚠️ 여권번호·운전면허번호(제24조 고유식별정보)는 가리지 않는다 — 개인회생 서류에 거의 나오지 않는데
      과하게 가리면 검토 품질만 떨어진다. */
const RRN_MASK = '○○○○○○-○○○○○○○';
// 6자리 + (구분자) + 7자리, 뒤 7자리의 첫 글자는 1~8(주민등록번호 1~4 / 외국인등록번호 5~8).
// 앞뒤가 숫자면 제외 — 긴 숫자열(계좌번호 등)을 잘못 가리지 않도록.
// 하이픈류·붙여쓴 형식은 형식 자체가 강한 신호라 항상 가린다. 공백·점·줄바꿈 형식도
// 생년월일과 뒷자리 구분자가 그럴듯하면 가린다. OCR 오류로 검증번호 한 자리가 틀려도 원문을
// 남기는 것보다 과잉 마스킹이 안전하며, 날짜가 아닌 일반 금액 목록은 그대로 둔다.
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
function hasIdNumber(text) {
  if (typeof text !== 'string') return false;
  if (new RegExp(RRN_RE.source).test(text)) return true;
  for (const match of text.matchAll(new RegExp(RRN_FLEX_RE.source, 'g'))) {
    if (idChecksumValid(match[1] + match[3]) || idShapePlausible(match[1] + match[3])
        || idLabelNearby(text, match.index, match[0].length)) return true;
  }
  return false;
}

/* ── 민감정보 처리에 대한 별도 동의 (개인정보 보호법 제23조) ──
   진술서에는 질병·치료 같은 건강 정보가 사실상 반드시 들어간다(채무가 생긴 경위를 써야 하므로).
   제23조 제1항 제1호는 이를 처리하려면 **다른 동의와 별도로** 동의를 받으라고 정한다.
   그래서 "개인정보를 지우고 넣으세요"로 막는 대신, 동의를 제대로 받고 **있는 그대로 받는다.**
   ⚠️ 주민등록번호는 이 동의로도 처리할 수 없다(제24조의2) — 그건 maskIdNumbers가 자동으로 지운다.
   AI 검토·대조 화면 두 곳이 이 조각을 함께 쓴다. */
function renderSensitiveConsent(elId) {
  const el = document.getElementById(elId);
  if (!el) return;
  const done = !!(Auth.getCurrentUser() && Auth.getCurrentUser().sensitiveConsent);

  el.innerHTML = done ? `
    <div class="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5">
      <p class="text-xs text-slate-500">✓ 민감정보 처리에 동의하셨습니다. <a href="mypage.html" class="underline">마이페이지</a>에서 철회하실 수 있습니다.</p>
    </div>` : `
    <div class="bg-amber-50 border border-amber-200 rounded-xl p-4">
      <label class="flex items-start gap-2.5 cursor-pointer">
        <input type="checkbox" id="sensitive-consent" class="mt-0.5 accent-amber-600">
        <span class="flex-1">
          <span class="block text-sm font-semibold text-amber-900">[필수] 민감정보 처리 동의</span>
          <span class="block text-xs text-amber-800 leading-relaxed mt-1">
            채무가 생긴 경위를 적다 보면 <strong>질병·치료 같은 건강에 관한 정보</strong>가 들어갈 수 있습니다.
            이는 「개인정보 보호법」 제23조의 민감정보라 별도 동의가 필요합니다.
            동의하시면 <strong>내용을 지우지 않고 그대로 넣으셔도 됩니다</strong> — 그래야 검토가 제대로 됩니다.
          </span>
          <span class="block text-[11px] text-amber-700 leading-relaxed mt-1.5">
            처리 목적: 서류 완성도 점검 / 보유 기간: 챔로드 DB에는 원문을 저장하지 않으며, Anthropic API에는 ZDR 약정이 없으면 정책상 원칙적으로 <strong>최대 30일</strong> 보관될 수 있음 /
            동의를 거부하셔도 다른 기능은 이용하실 수 있으나 AI 검토·대조는 이용할 수 없습니다. 동의는 언제든 철회할 수 있습니다.
          </span>
          <span class="block text-[11px] text-slate-500 mt-1.5">
            ※ <strong>주민등록번호는 동의와 무관하게 전송·저장되지 않습니다</strong> — 보내기 직전에 자동으로 가려집니다(법령상 처리 금지).
          </span>
        </span>
      </label>
    </div>`;
}

// 요청에 실을 값. 이미 동의했으면 서버가 기록으로 통과시키므로 undefined를 보내도 된다.
function sensitiveConsentPayload() {
  const cb = document.getElementById('sensitive-consent');
  return cb ? cb.checked : undefined;
}

/* ── 60% 생계비 참고값 ──
   2026년 기준중위소득(보건복지부 고시)의 60%. 개인회생 생계비 산정의 실무상 출발점이며,
   법원이 실제 인정한 금액이나 법정 하한으로 단정하지 않는다.
   ⚠️ 이 상수는 사이트 전체의 단일 출처다 — 진단(js/diagnosis.js)·숫자 검산(js/numcheck.js)·
   작성예시(rehabilitation.html)가 모두 이 값을 써야 한다. 어느 한 곳에 복사본을 만들지 말 것
   (계산 기준이 갈리면 같은 화면에서 서로 다른 금액이 나온다 — CLAUDE.md '수치 불일치 방지' 참조).
   매년 고시가 바뀌므로 연초에 갱신 대상. */
const MEDIAN_INCOME_2026 = [0, 2564238, 4199292, 5359036, 6494738, 7556719, 8555952, 9515150];
// 인덱스: [미사용, 1인, 2인, 3인, 4인, 5인, 6인, 7인].
// 보건복지부 고시 방식에 따라 8인 이상은 7인과 6인의 차액을 1명마다 더한다.

function getStandardLiving(householdSize) {
  const size = Math.max(1, Math.floor(Number(householdSize) || 1));
  const median = size <= 7
    ? MEDIAN_INCOME_2026[size]
    : MEDIAN_INCOME_2026[7] + (size - 7) * (MEDIAN_INCOME_2026[7] - MEDIAN_INCOME_2026[6]);
  // 기준중위소득 60% — 법정 금액이 아니라 **법원 실무 원칙**이다(개인회생사건 처리지침 재민 2004-4,
  // 서울회생법원 실무준칙 405호). 법률은 "법원이 정하는 금액"이라고만 한다(제579조 제4호 다목)
  // → 사정에 따라 증감되고 추가 생계비가 인정될 수 있으므로 '='로 단정하지 말 것.
  return Math.round(median * 0.6);
}

/* ── Storage: 계정별 localStorage 캐시 + 로그인 시 서버 미러링 ──
   - 게스트 자료는 현재 탭의 sessionStorage(cdg_guest_*)에만 둔다. 탭을 닫으면 사라지므로
     공용 기기의 다음 익명 이용자가 이전 사람의 채무·건강 자료를 볼 수 없다.
   - 계정 자료는 충돌 없는 UTF-8 hex namespace의 localStorage에 둔다.
   - 소유자를 증명할 수 없는 구버전 cdg_<key>는 자동 삭제·자동 귀속하지 않고 복구 배너에서
     이용자가 명시적으로 가져오거나 삭제하게 한다.
   - 읽기는 계속 동기식이라 기존 90여 개 호출부는 그대로 쓸 수 있다. */
const Storage = {
  ROOT: 'cdg_',
  GUEST_PREFIX: 'cdg_guest_',
  USER_PREFIX: 'cdg_user_',
  SCOPE_EPOCH_KEY: 'cdg_scope_epoch',
  _migratedAccounts: new Set(),
  _storageWarnedAt: 0,
  _failedSaveKeys: new Set(),

  _scopeToken(email) {
    const normalized = String(email || '').trim().toLowerCase();
    if (!normalized) return 'guest';
    // UTF-8 바이트의 16진수 표현은 일대일 대응이다. encodeURIComponent 뒤 치환 방식은
    // a_b와 a~5fb 같은 서로 다른 이메일이 같은 키가 되는 충돌이 있었다.
    return Array.from(new TextEncoder().encode(normalized), b => b.toString(16).padStart(2, '0')).join('');
  },
  _legacyScopeToken(email) {
    const normalized = String(email || '').trim().toLowerCase();
    if (!normalized) return 'guest';
    return encodeURIComponent(normalized).replace(/%/g, '~').replace(/_/g, '~5f');
  },
  _userPrefix(email) { return this.USER_PREFIX + this._scopeToken(email) + '_'; },
  _legacyUserPrefix(email) { return this.USER_PREFIX + this._legacyScopeToken(email) + '_'; },
  _storeForPrefix(prefix) { return prefix === this.GUEST_PREFIX ? sessionStorage : localStorage; },
  _scopeEpoch() {
    try { return Number(sessionStorage.getItem(this.SCOPE_EPOCH_KEY) || 0); } catch (e) { return 0; }
  },
  bumpScopeEpoch() {
    try {
      const next = this._scopeEpoch() + 1;
      sessionStorage.setItem(this.SCOPE_EPOCH_KEY, String(next));
      return next;
    } catch (e) { return this._scopeEpoch(); }
  },
  scopeFingerprint() { return this._activePrefix() + ':' + this._scopeEpoch(); },
  _legacyArtifacts(email) {
    const oldPrefix = this._legacyUserPrefix(email);
    const keys = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const full = localStorage.key(i);
        if (full && full.startsWith(oldPrefix)) keys.push(full);
      }
      for (const base of ['cdg_sync_', 'cdg_sync_login_']) {
        const full = base + this._legacyScopeToken(email);
        if (localStorage.getItem(full) !== null) keys.push(full);
      }
    } catch (e) {}
    return [...new Set(keys)];
  },
  _migrateAccountNamespace(email) {
    const normalized = String(email || '').trim().toLowerCase();
    if (!normalized || this._migratedAccounts.has(normalized)) return true;
    const oldToken = this._legacyScopeToken(normalized);
    const newToken = this._scopeToken(normalized);
    if (oldToken === newToken) { this._migratedAccounts.add(normalized); return true; }
    const oldPrefix = this.USER_PREFIX + oldToken + '_';
    const newPrefix = this.USER_PREFIX + newToken + '_';
    const artifacts = this._legacyArtifacts(normalized);
    if (!artifacts.length) { this._migratedAccounts.add(normalized); return true; }

    // 옛 토큰은 %, _, '~xx' 조합이 서로 충돌할 수 있다. 정확한 이메일 owner marker가 없는
    // namespace는 소유자를 증명할 수 없으므로 자동 복사·삭제하지 않는다.
    const ownerKey = 'cdg_scope_owner_' + oldToken;
    let owner = null;
    try { owner = localStorage.getItem(ownerKey); } catch (e) {}
    if (owner !== normalized) return true; // 격리 상태로 두되 새 안전 namespace는 정상 사용한다.

    const createdTargets = [];
    try {
      const keys = artifacts.filter(full => full.startsWith(oldPrefix));
      for (const full of keys) {
        const target = newPrefix + full.slice(oldPrefix.length);
        const raw = localStorage.getItem(full);
        const existing = localStorage.getItem(target);
        if (existing !== null && existing !== raw) throw new Error('namespace migration conflict');
        if (existing === null && raw !== null) {
          localStorage.setItem(target, raw);
          if (localStorage.getItem(target) !== raw) throw new Error('namespace migration verify failed');
          createdTargets.push(target);
        }
      }
      for (const base of ['cdg_sync_', 'cdg_sync_login_']) {
        const oldKey = base + oldToken;
        const newKey = base + newToken;
        const raw = localStorage.getItem(oldKey);
        const existing = localStorage.getItem(newKey);
        if (raw !== null && existing !== null && existing !== raw) throw new Error('sync namespace migration conflict');
        if (raw !== null && existing === null) {
          localStorage.setItem(newKey, raw);
          if (localStorage.getItem(newKey) !== raw) throw new Error('sync namespace migration verify failed');
          createdTargets.push(newKey);
        }
      }
      for (const full of keys) localStorage.removeItem(full);
      for (const base of ['cdg_sync_', 'cdg_sync_login_']) localStorage.removeItem(base + oldToken);
      for (const full of artifacts) {
        if (localStorage.getItem(full) !== null) throw new Error('legacy namespace delete verify failed');
      }
      localStorage.removeItem(ownerKey);
      if (localStorage.getItem(ownerKey) !== null) throw new Error('legacy owner delete verify failed');
      this._migratedAccounts.add(normalized);
      return true;
    } catch (e) {
      // 원본은 마지막 단계까지 보존한다. 실패 전에 새로 만든 대상만 지워 다음 시도와 충돌하지 않게 한다.
      for (const target of createdTargets) {
        try { localStorage.removeItem(target); } catch (_) {}
      }
      return false;
    }
  },
  _activeSession() {
    // Storage가 Auth보다 먼저 선언되므로 Auth const를 직접 참조하지 않는다(TDZ 회피).
    // 만료 세션은 여기서 활성 계정으로 취급하지 않고, 실제 정리는 Auth.getSession()이 맡는다.
    try {
      const s = JSON.parse(localStorage.getItem('cdg_auth_session') || 'null');
      if (!s || !s.email || (s.expiresAt && Date.now() > s.expiresAt)) return null;
      return s;
    } catch (e) { return null; }
  },
  _activePrefix() {
    const s = this._activeSession();
    return s && s.email ? this._userPrefix(s.email) : this.GUEST_PREFIX;
  },
  _isLegacyAppKey(full) {
    return !!full && full.startsWith(this.ROOT)
      && !full.startsWith('cdg_auth')
      && full !== 'cdg_api_target'
      && !full.startsWith(this.GUEST_PREFIX)
      && !full.startsWith(this.USER_PREFIX)
      && !full.startsWith('cdg_scope_owner_')
      && !full.startsWith('cdg_sync_');
  },
  _legacyKeys() {
    const legacy = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const full = localStorage.key(i);
        if (this._isLegacyAppKey(full)) legacy.push(full);
      }
    } catch (e) {}
    return legacy;
  },
  hasUnownedLegacy() { return this._legacyKeys().length > 0; },
  importUnownedLegacyToGuest() {
    // 이용자가 이 기기의 구버전 익명 자료가 본인 것임을 명시적으로 확인한 경우에만
    // 현재 탭(sessionStorage)의 guest namespace로 옮긴다.
    const legacy = this._legacyKeys();
    try {
      // 이미 현재 탭에 새 익명 자료가 있으면 어느 쪽을 덮을지 자동 판단하지 않는다.
      if (this._keysAt(this.GUEST_PREFIX).length) return false;
      for (const full of legacy) {
        const target = this.GUEST_PREFIX + full.slice(this.ROOT.length);
        const raw = localStorage.getItem(full);
        if (raw !== null) {
          sessionStorage.setItem(target, raw);
          if (sessionStorage.getItem(target) !== raw) throw new Error('legacy import verify failed');
        }
      }
      for (const full of legacy) localStorage.removeItem(full);
      return legacy.every(full => localStorage.getItem(full) === null);
    } catch (e) { return false; }
  },
  deleteUnownedLegacy() {
    const legacy = this._legacyKeys();
    try {
      for (const full of legacy) localStorage.removeItem(full);
      return legacy.every(full => localStorage.getItem(full) === null);
    } catch (e) { return false; }
  },
  _prefix() {
    const s = this._activeSession();
    const prefix = s && s.email ? this._userPrefix(s.email) : this.GUEST_PREFIX;
    if (s && s.email) this._migrateAccountNamespace(s.email);
    return prefix;
  },
  _readAt(prefix, key) {
    try {
      const raw = this._storeForPrefix(prefix).getItem(prefix + key);
      return raw === null ? null : JSON.parse(raw);
    } catch (e) { return null; }
  },
  _writeAt(prefix, key, data) {
    try {
      const store = this._storeForPrefix(prefix);
      const serialized = JSON.stringify(data);
      if (serialized === undefined) return false;
      store.setItem(prefix + key, serialized);
      return store.getItem(prefix + key) === serialized;
    } catch (e) { return false; }
  },
  _removeAt(prefix, key) {
    try {
      const store = this._storeForPrefix(prefix);
      store.removeItem(prefix + key);
      return store.getItem(prefix + key) === null;
    } catch (e) { return false; }
  },
  _keysAt(prefix) {
    const out = [];
    try {
      const store = this._storeForPrefix(prefix);
      for (let i = 0; i < store.length; i++) {
        const full = store.key(i);
        if (full && full.startsWith(prefix)) out.push(full.slice(prefix.length));
      }
    } catch (e) {}
    return out;
  },
  _collectAt(prefix) {
    const out = {};
    for (const key of this._keysAt(prefix)) {
      const value = this._readAt(prefix, key);
      if (value !== null) out[key] = value;
    }
    return out;
  },
  _clearAt(prefix) {
    const store = this._storeForPrefix(prefix);
    const before = new Map();
    try {
      for (const key of this._keysAt(prefix)) before.set(key, store.getItem(prefix + key));
      for (const key of before.keys()) {
        store.removeItem(prefix + key);
        if (store.getItem(prefix + key) !== null) throw new Error('storage delete verify failed');
      }
      return true;
    } catch (e) {
      // 일부만 삭제된 채 성공처럼 보이지 않도록 가능한 범위에서 원래 raw 값을 복원한다.
      for (const [key, raw] of before) {
        try { if (raw !== null) store.setItem(prefix + key, raw); } catch (_) {}
      }
      return false;
    }
  },

  _reportSaveFailure(prefix, keys) {
    for (const key of keys) this._failedSaveKeys.add(prefix + key);
    if (Date.now() - this._storageWarnedAt > 3000) {
      this._storageWarnedAt = Date.now();
      showToast('이 브라우저의 저장 공간을 사용할 수 없어 변경사항을 저장하지 못했습니다. 저장 공간·개인정보 보호 설정을 확인해 주세요.', 'error');
    }
  },

  // 여러 진단 결과처럼 서로 함께 바뀌어야 하는 값은 로컬에 전부 기록된 뒤에만
  // 서버 동기화 큐에 넣는다. 한 항목이라도 실패하면 원래 raw 값을 복원해 새 값과 옛 값이
  // 섞인 화면이나, 화면은 실패했는데 서버만 바뀌는 상태를 만들지 않는다.
  saveBatch(entries) {
    const list = Array.isArray(entries) ? entries : Object.entries(entries || {});
    if (!list.length) return true;
    const prefix = this._prefix();
    const store = this._storeForPrefix(prefix);
    const prepared = [];
    try {
      for (const [key, value] of list) {
        const serialized = JSON.stringify(value);
        if (serialized === undefined) throw new Error('not serializable');
        prepared.push({ key, value, serialized, before: store.getItem(prefix + key) });
      }
      for (const item of prepared) {
        store.setItem(prefix + item.key, item.serialized);
        if (store.getItem(prefix + item.key) !== item.serialized) throw new Error('storage verify failed');
      }
      if (!DataSync.queueBatch(prepared.map(item => [item.key, item.value]), [])) {
        throw new Error('sync retry journal failed');
      }
    } catch (e) {
      // 가능한 범위에서 전부 원복한다. 원복 실패도 저장 실패 상태로 남겨 UI가 성공을 말하지 않게 한다.
      for (const item of prepared) {
        try {
          if (item.before === null) store.removeItem(prefix + item.key);
          else store.setItem(prefix + item.key, item.before);
        } catch (_) {}
      }
      this._reportSaveFailure(prefix, list.map(([key]) => key));
      return false;
    }

    for (const item of prepared) this._failedSaveKeys.delete(prefix + item.key);
    return true;
  },

  save(key, data) {
    return this.saveBatch([[key, data]]);
  },
  hasSaveFailure(key) {
    const prefix = this._prefix();
    return key === undefined
      ? [...this._failedSaveKeys].some(failedKey => failedKey.startsWith(prefix))
      : this._failedSaveKeys.has(prefix + key);
  },
  load(key) { return this._readAt(this._prefix(), key); },
  remove(key) {
    const prefix = this._prefix();
    const store = this._storeForPrefix(prefix);
    let before = null;
    try { before = store.getItem(prefix + key); } catch (e) { return false; }
    if (!this._removeAt(prefix, key)) return false;
    if (DataSync.queueDel(key)) return true;
    try {
      if (before !== null) store.setItem(prefix + key, before);
    } catch (e) {}
    this._reportSaveFailure(prefix, [key]);
    return false;
  },
  // 서버 삭제를 이미 확인한 경우처럼 재동기화를 만들지 않고 로컬만 정리할 때 쓴다.
  removeLocal(key) { return this._removeAt(this._prefix(), key); },
  collectCurrent() { return this._collectAt(this._prefix()); },
  collectGuest() { return this._collectAt(this.GUEST_PREFIX); },
  _replaceAt(prefix, data) {
    const store = this._storeForPrefix(prefix);
    const prepared = [];
    const before = new Map();
    try {
      // 기존 자료를 지우기 전에 새 자료 전체가 직렬화 가능한지 먼저 확인한다.
      for (const [key, value] of Object.entries(data || {})) {
        const serialized = JSON.stringify(value);
        if (serialized === undefined) throw new Error('not serializable');
        prepared.push({ key, serialized });
      }
      for (const key of this._keysAt(prefix)) before.set(key, store.getItem(prefix + key));
      for (const key of before.keys()) store.removeItem(prefix + key);
      for (const item of prepared) {
        store.setItem(prefix + item.key, item.serialized);
        if (store.getItem(prefix + item.key) !== item.serialized) throw new Error('storage verify failed');
      }
      const expectedKeys = new Set(prepared.map(item => item.key));
      if (this._keysAt(prefix).some(key => !expectedKeys.has(key))) throw new Error('stale storage key');
      return true;
    } catch (e) {
      // 교체 중 한 건이라도 실패하면 부분 교체를 남기지 않고 원래 raw snapshot을 복원한다.
      try {
        for (const key of this._keysAt(prefix)) store.removeItem(prefix + key);
        for (const [key, raw] of before) {
          if (raw !== null) store.setItem(prefix + key, raw);
        }
      } catch (_) {}
      this._reportSaveFailure(prefix, prepared.map(item => item.key));
      return false;
    }
  },
  replaceCurrent(data) { return this._replaceAt(this._prefix(), data); },
  clearCurrent() { return this._clearAt(this._prefix()); },
  clearUser(email) {
    const legacySafe = this._migrateAccountNamespace(email);
    const current = this._clearAt(this._userPrefix(email));
    const leftovers = this._legacyArtifacts(email);
    // owner marker가 확인된 자료는 위에서 이관 후 지워져야 한다. 소유 불명 legacy가 남아 있으면
    // 삭제했다고 말할 수 없으므로 false를 반환해 브라우저 사이트 데이터 수동 삭제를 안내한다.
    return legacySafe && current && leftovers.length === 0;
  },
  removeGuestLocal(key) { return this._removeAt(this.GUEST_PREFIX, key); },
  clearAllAppData() {
    const localTargets = [];
    const sessionTargets = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const full = localStorage.key(i);
        if (full && (full.startsWith(this.GUEST_PREFIX)
          || full.startsWith(this.USER_PREFIX)
          || full.startsWith('cdg_sync_')
          || full.startsWith('cdg_scope_owner_')
          || this._isLegacyAppKey(full))) localTargets.push(full);
      }
      for (let i = 0; i < sessionStorage.length; i++) {
        const full = sessionStorage.key(i);
        if (full && full.startsWith(this.GUEST_PREFIX)) sessionTargets.push(full);
      }
      for (const full of localTargets) localStorage.removeItem(full);
      for (const full of sessionTargets) sessionStorage.removeItem(full);
      const cleared = localTargets.every(full => localStorage.getItem(full) === null)
        && sessionTargets.every(full => sessionStorage.getItem(full) === null);
      if (cleared) {
        this._failedSaveKeys.clear();
        this.bumpScopeEpoch();
      }
      return cleared;
    } catch (e) { return false; }
  }
};

const DataSync = {
  _put: new Map(),   // key -> { data, seq } (최신값)
  _del: new Map(),   // key -> seq
  _timer: null,
  _flushing: null,
  _clearing: false,
  _seq: 0,
  _generation: 0,
  _retryMs: 1500,
  _restoredScope: null,
  DEBOUNCE_MS: 700,
  MAX_RETRY_MS: 30000,

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

  _on() { return !!Storage._activeSession(); },
  _session() { return Storage._activeSession(); },
  _pendingKey(email) { return 'cdg_sync_' + Storage._scopeToken(email); },
  _loginSyncKey(email) { return 'cdg_sync_login_' + Storage._scopeToken(email); },
  hasLoginSyncPending(email) {
    try { return localStorage.getItem(this._loginSyncKey(email)) === '1'; } catch (e) { return false; }
  },
  _setLoginSyncPending(email, pending) {
    try {
      const key = this._loginSyncKey(email);
      if (pending) {
        localStorage.setItem(key, '1');
        return localStorage.getItem(key) === '1';
      }
      localStorage.removeItem(key);
      return localStorage.getItem(key) === null;
    } catch (e) { return false; }
  },
  _restorePending() {
    const s = this._session();
    if (!s || !s.email) return;
    const scope = Storage._scopeToken(s.email);
    if (this._restoredScope === scope) return;

    this._put.clear();
    this._del.clear();
    this._restoredScope = scope;
    try {
      const saved = JSON.parse(localStorage.getItem(this._pendingKey(s.email)) || 'null');
      for (const [key, data] of Object.entries((saved && saved.put) || {})) {
        this._put.set(key, { data: this._strip(key, data), seq: ++this._seq });
      }
      for (const key of ((saved && saved.del) || [])) {
        if (typeof key === 'string' && key) this._del.set(key, ++this._seq);
      }
    } catch (e) {
      // 손상된 재시도 파일은 서버로 보낼 수 없으므로 지우고 이후 변경부터 다시 쌓는다.
      try { localStorage.removeItem(this._pendingKey(s.email)); } catch (err) {}
    }
  },
  _persistPending(session) {
    const s = session || this._session();
    if (!s || !s.email) return false;
    const key = this._pendingKey(s.email);
    try {
      if (this._put.size === 0 && this._del.size === 0) {
        localStorage.removeItem(key);
        return localStorage.getItem(key) === null;
      }
      const put = {};
      for (const [name, entry] of this._put) put[name] = entry.data;
      const serialized = JSON.stringify({ put, del: [...this._del.keys()] });
      localStorage.setItem(key, serialized);
      return localStorage.getItem(key) === serialized;
    } catch (e) { return false; }
  },
  // 대기 중인 업로드를 버린다(탈퇴·확인된 전체 삭제·강제 로그아웃).
  cancelPending(email) {
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
    this._generation++;
    this._put.clear();
    this._del.clear();
    let cleared = true;
    if (email) {
      try {
        const pendingKey = this._pendingKey(email);
        localStorage.removeItem(pendingKey);
        cleared = localStorage.getItem(pendingKey) === null && cleared;
      } catch (e) { cleared = false; }
      cleared = this._setLoginSyncPending(email, false) && cleared;
    }
    this._restoredScope = null;
    return cleared;
  },

  // 계정이 바뀌거나 세션이 만료될 때 메모리 상태만 분리한다. 영속 재시도 파일은
  // 지우지 않아 다음 로그인에서 이어 보낼 수 있고, 진행 중이던 옛 요청의 응답은
  // generation 불일치로 새 계정 큐에 영향을 주지 못한다.
  detach(email) {
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
    if (email && this._restoredScope === Storage._scopeToken(email)
        && !this._persistPending({ email })) return false;
    this._generation++;
    this._put.clear();
    this._del.clear();
    this._restoredScope = null;
    this._flushing = null;
    this._retryMs = 1500;
    return true;
  },

  queueBatch(puts = [], dels = []) {
    if (!this._on()) return true;
    this._restorePending();
    const beforePut = new Map(this._put);
    const beforeDel = new Map(this._del);
    for (const [key, data] of puts) {
      this._del.delete(key);
      this._put.set(key, { data: this._strip(key, data), seq: ++this._seq });
    }
    for (const key of dels) {
      this._put.delete(key);
      this._del.set(key, ++this._seq);
    }
    if (!this._persistPending()) {
      this._put = beforePut;
      this._del = beforeDel;
      return false;
    }
    this._schedule();
    return true;
  },
  queuePut(key, data) {
    return this.queueBatch([[key, data]], []);
  },
  queueDel(key) {
    return this.queueBatch([], [key]);
  },
  _schedule(delay = this.DEBOUNCE_MS) {
    if (!this._on() || this._clearing) return;
    if (this._timer) clearTimeout(this._timer);
    this._timer = setTimeout(() => this.flush(), delay);
  },

  async flush(keepalive = false) {
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
    if (this._clearing) return { ok: false, error: '데이터 삭제 처리 중입니다.' };
    this._restorePending();
    const s = this._session();
    if (!s) return { ok: false, error: '로그인이 필요합니다.' };
    if (this._flushing) return this._flushing;
    if (this._put.size === 0 && this._del.size === 0) return { ok: true };

    const putSnapshot = new Map(this._put);
    const delSnapshot = new Map(this._del);
    const put = {};
    for (const [key, entry] of putSnapshot) put[key] = entry.data;
    const del = [...delSnapshot.keys()];
    const generation = this._generation;

    const job = (async () => {
      try {
        const res = await fetch(API_BASE + '/api/data/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + s.token },
          body: JSON.stringify({ put, del }),
          keepalive,
        });
        let j = null;
        try { j = await res.json(); } catch (e) {}
        if (!res.ok || !j || !j.ok) throw new Error((j && j.error) || `동기화 서버 오류(${res.status})`);

        if (generation !== this._generation) {
          return { ok: false, stale: true, error: '계정이 바뀌어 이전 동기화 결과를 폐기했습니다.' };
        }
        for (const [key, sent] of putSnapshot) {
          const current = this._put.get(key);
          if (current && current.seq === sent.seq) this._put.delete(key);
        }
        for (const [key, sentSeq] of delSnapshot) {
          if (this._del.get(key) === sentSeq) this._del.delete(key);
        }
        this._retryMs = 1500;
        if (!this._persistPending(s)) {
          // 서버 반영은 끝났지만 재시도 파일 정리에 실패했다. 최신 변경을 덮지 않는 범위에서
          // snapshot을 메모리에 되살려 다음 시도에서 멱등하게 다시 보낸다.
          for (const [key, sent] of putSnapshot) {
            if (!this._put.has(key) && !this._del.has(key)) this._put.set(key, sent);
          }
          for (const [key, sentSeq] of delSnapshot) {
            if (!this._put.has(key) && !this._del.has(key)) this._del.set(key, sentSeq);
          }
          this._schedule(this._retryMs);
          return { ok: false, error: '변경사항은 서버에 반영됐지만 이 기기의 재시도 기록을 정리하지 못했습니다.' };
        }
        return { ok: true };
      } catch (e) {
        if (generation !== this._generation) {
          return { ok: false, stale: true, error: '계정이 바뀌어 이전 동기화 작업을 중단했습니다.' };
        }
        // 큐와 로컬 재시도 파일을 그대로 둔다. 새로고침해도 resume()이 이어서 보낸다.
        if (!this._persistPending(s)) {
          return { ok: false, error: '동기화 실패 후 재시도 기록도 저장하지 못했습니다. 이 탭을 닫지 말고 저장 공간을 확인해 주세요.' };
        }
        const wait = this._retryMs;
        this._retryMs = Math.min(this._retryMs * 2, this.MAX_RETRY_MS);
        this._schedule(wait);
        return { ok: false, error: e && e.message ? e.message : '계정 동기화에 실패했습니다.' };
      }
    })();
    this._flushing = job;
    const result = await job;
    if (this._flushing === job) this._flushing = null;
    if (result.ok && (this._put.size || this._del.size)) this._schedule();
    return result;
  },

  // flush가 진행되는 동안 생긴 새 변경까지 모두 비워질 때까지 반복한다. 로그아웃에서
  // 한 번만 flush하면 첫 snapshot 뒤에 추가된 변경이 남은 채 캐시를 지울 수 있었다.
  async drain() {
    for (let i = 0; i < 25; i++) {
      if (this._flushing) await this._flushing;
      this._restorePending();
      if (this._put.size === 0 && this._del.size === 0) return { ok: true };
      const result = await this.flush();
      if (!result.ok) return result;
    }
    return { ok: false, error: '변경사항이 계속 발생해 동기화를 마치지 못했습니다. 잠시 후 다시 시도해 주세요.' };
  },

  resume() {
    if (!this._on()) return;
    const s = this._session();
    if (s && this.hasLoginSyncPending(s.email)) {
      this._scheduleLoginSync(100);
      return;
    }
    this._restorePending();
    if (this._put.size || this._del.size) this._schedule(100);
  },
  _scheduleLoginSync(delay = this.DEBOUNCE_MS) {
    if (!this._on() || this._clearing) return;
    if (this._timer) clearTimeout(this._timer);
    this._timer = setTimeout(() => {
      this._timer = null;
      this.syncOnLogin({ promptGuest: true });
    }, delay);
  },

  // 로그인 직후 호출. await 전의 계정·generation을 고정해 둔 뒤, 응답 시점에 같은 scope인지
  // 다시 확인한다. 익명 자료 충돌은 자동 덮어쓰지 않고 이용자가 어느 쪽을 유지할지 고른다.
  async syncOnLogin(options = {}) {
    const s = this._session();
    if (!s) return { ok: false, error: '로그인이 필요합니다.' };
    const email = String(s.email || '').trim().toLowerCase();
    const generation = this._generation;
    const accountPrefix = Storage._userPrefix(email);
    const stillCurrent = () => {
      const current = this._session();
      return generation === this._generation && current
        && String(current.email || '').trim().toLowerCase() === email
        && current.token === s.token;
    };
    if (!Storage._migrateAccountNamespace(email)) {
      return { ok: false, error: '이 계정의 구버전 로컬 자료를 안전하게 이관하지 못했습니다. 이 탭을 닫지 말고 브라우저 저장 공간을 확인해 주세요.' };
    }
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
    if (!this._setLoginSyncPending(email, true)) {
      return { ok: false, error: '로그인 동기화 복구표시를 저장하지 못했습니다. 브라우저 저장 공간을 확인해 주세요.' };
    }
    this._restorePending();
    try {
      // 익명 자료는 현재 탭에만 있지만 공용 PC에서 직전 이용자가 탭을 닫지 않았을 수 있다.
      // 로그인했다는 이유만으로 새 계정에 귀속하지 않고, 최초 로그인 흐름에서 명시적으로 묻는다.
      let guestBeforePull = Storage.collectGuest();
      const guestBeforePullKeys = Object.keys(guestBeforePull);
      let transferGuest = false;
      if (guestBeforePullKeys.length && options.promptGuest === true) {
        transferGuest = typeof confirm === 'function' && confirm(
          '이 탭에서 로그인 전에 작성한 익명 자료가 있습니다.\n\n본인이 작성한 자료가 확실하고 이 계정으로 가져오려면 [확인]을 누르세요. 공용기기이거나 내 자료인지 확실하지 않으면 [취소]를 누르세요. 취소하면 익명 자료는 이 탭에서 삭제됩니다.'
        );
        if (!transferGuest && !Storage._clearAt(Storage.GUEST_PREFIX)) {
          throw new Error('익명 자료의 원본을 이 탭에서 지우지 못했습니다. 브라우저 저장 설정을 확인해 주세요.');
        }
        if (!transferGuest) guestBeforePull = {};
      }

      const res = await fetch(API_BASE + '/api/data', { headers: { 'Authorization': 'Bearer ' + s.token } });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error || `동기화 서버 오류(${res.status})`);
      if (!stillCurrent()) return { ok: false, stale: true, error: '계정이 바뀌어 이전 로그인 동기화 결과를 폐기했습니다.' };
      const server = j.data || {};
      const local = Storage._collectAt(accountPrefix);
      const merged = { ...local, ...server }; // 충돌은 서버 우선 — 기존 계정 자료를 임의로 덮지 않는다.
      const upload = {};

      // 서버에 없는 현재 계정 캐시는 실패했던 변경일 수 있으므로 다시 올린다.
      for (const [key, value] of Object.entries(local)) {
        if (!(key in server)) upload[key] = this._strip(key, value);
      }
      // 이미 큐에 남아 있던 최신 변경은 서버 응답보다 우선한다. 서버 전송용 큐는
      // 민감 필드를 제거한 사본이므로, 화면 캐시에는 원래 로컬 값을 보존한다.
      for (const [key, entry] of this._put) merged[key] = (key in local) ? local[key] : entry.data;
      for (const key of this._del.keys()) { delete merged[key]; delete upload[key]; }

      if (transferGuest) {
        const conflicts = Object.keys(guestBeforePull).filter(key => {
          if (!(key in merged)) return false;
          try { return JSON.stringify(merged[key]) !== JSON.stringify(guestBeforePull[key]); }
          catch (e) { return true; }
        });
        let guestWins = true;
        if (conflicts.length) {
          guestWins = typeof confirm === 'function' && confirm(
            `이 탭의 익명 자료와 계정 자료가 ${conflicts.length}개 항목에서 다릅니다.\n\n[확인] 이 탭의 익명 자료를 사용\n[취소] 계정에 저장된 자료를 유지`
          );
        }
        for (const [key, value] of Object.entries(guestBeforePull)) {
          if (!(key in merged) || guestWins) {
            merged[key] = value;
            upload[key] = this._strip(key, value);
          }
        }
      }

      const cached = Storage._replaceAt(accountPrefix, merged);
      if (!cached) throw new Error('계정 자료를 이 브라우저에 안전하게 저장하지 못했습니다.');
      if (!this.queueBatch(Object.entries(upload), [])) {
        throw new Error('계정 변경사항의 재시도 기록을 저장하지 못했습니다.');
      }
      const pushed = await this.flush();
      if (!stillCurrent()) return { ok: false, stale: true, error: '계정이 바뀌어 이전 로그인 동기화 결과를 폐기했습니다.' };
      if (pushed.ok) {
        // 서버와 계정 cache 양쪽에 안전하게 반영된 뒤에만 익명 원본을 지운다.
        if (transferGuest && !Storage._clearAt(Storage.GUEST_PREFIX)) {
          throw new Error('계정에는 저장했지만 이 탭의 익명 원본을 지우지 못했습니다. 브라우저 설정을 확인해 주세요.');
        }
        if (!this._setLoginSyncPending(email, false)) {
          throw new Error('로그인 동기화 완료표시를 저장하지 못했습니다.');
        }
        return { ok: true };
      }
      this._scheduleLoginSync(this._retryMs);
      return pushed;
    } catch (e) {
      if (!stillCurrent()) return { ok: false, stale: true, error: '계정이 바뀌어 이전 로그인 동기화 작업을 중단했습니다.' };
      const wait = this._retryMs;
      this._retryMs = Math.min(this._retryMs * 2, this.MAX_RETRY_MS);
      this._scheduleLoginSync(wait);
      return { ok: false, error: e && e.message ? e.message : '계정 자료를 불러오지 못했습니다.' };
    }
  },

  // 서버 데이터 전체 삭제(계정 데이터 초기화)
  async clearServer() {
    const s = this._session();
    if (!s) return { ok: true, localOnly: true };
    this._clearing = true;
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
    try {
      // 먼저 이미 진행 중인 저장 요청이 끝나게 해 clearAll 뒤에 옛 값이 다시 들어오는 것을 막는다.
      if (this._flushing) await this._flushing;
      const res = await fetch(API_BASE + '/api/data/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + s.token },
        body: JSON.stringify({ clearAll: true }),
      });
      let j = null;
      try { j = await res.json(); } catch (e) {}
      if (!res.ok || !j || !j.ok) throw new Error((j && j.error) || `삭제 서버 오류(${res.status})`);
      if (!this.cancelPending(s.email)) {
        return { ok: false, serverCleared: true, error: '서버 데이터는 삭제했지만 이 기기의 재시도 기록을 지우지 못했습니다. 브라우저에서 chamroad.com 사이트 데이터를 직접 삭제해 주세요.' };
      }
      return { ok: true };
    } catch (e) {
      this._persistPending(s);
      return { ok: false, error: e && e.message ? e.message : '서버의 저장 데이터를 삭제하지 못했습니다.' };
    } finally {
      this._clearing = false;
      if (this._put.size || this._del.size) this._schedule(this._retryMs);
    }
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
    // isAdmin은 헤더에 관리자 메뉴를 보여줄지 판단하는 표시용일 뿐이다.
    // 위조해도 얻는 게 없다 — 관리자 API는 매 요청 서버가 ADMIN_EMAIL과 대조한다.
    let previous = null;
    try { previous = JSON.parse(localStorage.getItem(this._KS) || 'null'); } catch (e) {}
    const switchingAccount = previous && previous.email
      && String(previous.email).toLowerCase() !== String(user.email).toLowerCase();
    const session = {
      token,
      email: user.email,
      name: user.name,
      expiresAt: user.expiresAt,
      emailVerified: !!user.emailVerified,
      isAdmin: !!user.isAdmin,
      sensitiveConsent: !!user.sensitiveConsent,
    };

    // 새 세션을 실제로 저장·재조회하기 전에는 이전 계정 캐시를 지우지 않는다. 저장공간 차단 시
    // 로그인은 실패로 돌리고, 기존 이용자의 자료와 세션은 그대로 보존한다.
    const serialized = JSON.stringify(session);
    try {
      localStorage.setItem(this._KS, serialized);
      if (localStorage.getItem(this._KS) !== serialized) throw new Error('session verify failed');
    } catch (e) {
      try {
        if (previous) localStorage.setItem(this._KS, JSON.stringify(previous));
        else localStorage.removeItem(this._KS);
      } catch (_) {}
      return null;
    }

    if (switchingAccount) {
      // 이전 계정의 cache·영속 재시도 자료는 보존하되 메모리 큐만 분리한다. 다른 계정으로
      // 로그인했다는 이유로 아직 서버에 못 올린 자료를 삭제해서는 안 된다.
      if (!DataSync.detach(previous.email)) {
        try { localStorage.setItem(this._KS, JSON.stringify(previous)); } catch (_) {}
        return null;
      }
    }
    Storage._migrateAccountNamespace(user.email);
    if (!previous || switchingAccount) Storage.bumpScopeEpoch();
    return session;
  },

  async _revokeUnstoredSession(token) {
    // 서버가 세션을 만들었지만 브라우저에 안전하게 보관하지 못한 경우 토큰을 즉시 폐기한다.
    try {
      await fetch(API_BASE + '/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      });
    } catch (e) {}
  },

  // 세션 캐시를 서버 값으로 갱신. emailVerified는 미인증 배너, isAdmin은 관리자 메뉴 판정에 쓴다.
  // 이미 로그인해 둔 세션도 me() 한 번이면 새 필드를 받으므로 재로그인이 필요 없다.
  // 세션 캐시의 일부 필드만 갱신한다. undefined로 준 항목은 건드리지 않는다
  // (한 필드를 갱신하려다 다른 필드를 지우는 사고를 막기 위해).
  _setVerified(v, isAdmin, sensitiveConsent) {
    const s = this.getSession();
    if (!s) return;
    if (v !== undefined) s.emailVerified = v;
    if (isAdmin !== undefined) s.isAdmin = !!isAdmin;
    if (sensitiveConsent !== undefined) s.sensitiveConsent = !!sensitiveConsent;
    try { localStorage.setItem(this._KS, JSON.stringify(s)); } catch {}
  },

  _rawSession() {
    try {
      return JSON.parse(localStorage.getItem(this._KS));
    } catch { return null; }
  },

  getSession() {
    try {
      const s = this._rawSession();
      if (!s) return null;
      if (s.expiresAt && Date.now() > s.expiresAt) {
        // 인증 토큰만 만료된 것이지 이용자가 저장해 둔 진행 자료를 삭제하라는 뜻은 아니다.
        // 메모리만 분리하고 cache·재시도 파일은 다음 로그인 복구용으로 남긴다.
        if (!DataSync.detach(s.email)) return null;
        try {
          localStorage.removeItem(this._KS);
          if (localStorage.getItem(this._KS) === null) Storage.bumpScopeEpoch();
        } catch {}
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
    if (!user) {
      await this._revokeUnstoredSession(r.token);
      return { ok: false, error: '이 브라우저에 로그인 정보를 저장할 수 없습니다. 저장 공간·개인정보 보호 설정을 확인해 주세요.' };
    }
    const sync = await DataSync.syncOnLogin({ promptGuest: true });   // 서버 data pull + 익명자료 명시적 이관
    return { ok: true, user, syncWarning: sync.ok ? '' : sync.error };
  },

  // 만 14세 이상 확인·이용약관·개인정보 수집이용 동의는 서로 다른 체크박스로 받고,
  // 서버가 세 값을 모두 필수로 요구한다. 화면 검사만으로는 API 직접 호출을 막을 수 없다.
  // 가입 이메일 인증 — 코드 발송·확인. 계정은 확인을 마친 뒤 signup()에서 만들어진다.
  // Turnstile 토큰은 메일이 실제로 나가는 발송 단계에서만 쓴다.
  async sendSignupCode(email, turnstileToken) {
    return this._api('/api/auth/send-signup-code', {
      body: { email: email.toLowerCase().trim(), turnstileToken: turnstileToken || '' },
    });
  },

  async verifySignupCode(email, code) {
    return this._api('/api/auth/verify-signup-code', {
      body: { email: email.toLowerCase().trim(), code: String(code || '').replace(/\D/g, '') },
    });
  },

  async signup(name, email, password, consents = {}) {
    const r = await this._api('/api/auth/signup', {
      body: {
        name: name.trim(),
        email: email.toLowerCase().trim(),
        password,
        ageConfirmed: consents.ageConfirmed === true,
        termsAgreed: consents.termsAgreed === true,
        privacyAgreed: consents.privacyAgreed === true,
        consentFormVersion: 'signup-consent-v1',
        // 이전 Worker가 새 분리동의 화면과 함께 동작하는 전환 배포용 호환 필드다.
        // 새 Worker는 이 값만으로 가입을 허용하지 않고 위 세 항목과 form version을 모두 검증한다.
        agree: true,
      },
    });
    if (!r.ok) return r;
    const user = this._saveSession(r.token, r.user);
    if (!user) {
      await this._revokeUnstoredSession(r.token);
      return { ok: false, error: '계정은 생성됐지만 이 브라우저에 로그인 정보를 저장할 수 없습니다. 저장 공간·개인정보 보호 설정을 확인한 뒤 다시 로그인해 주세요.' };
    }
    const sync = await DataSync.syncOnLogin({ promptGuest: true });   // 새 계정: 익명자료 이관 여부를 명시적으로 확인
    return { ok: true, user, syncWarning: sync.ok ? '' : sync.error };
  },

  // 이메일 인증 상태를 서버에서 다시 받아 세션 캐시에 반영(배너 판정용).
  async me() {
    const r = await this._api('/api/auth/me', { method: 'GET', auth: true });
    if (r.ok && r.user) this._setVerified(!!r.user.emailVerified, r.user.isAdmin, r.user.sensitiveConsent);
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

  // 민감정보(건강 등) 처리에 대한 별도 동의 기록·철회 — 개인정보 보호법 제23조.
  // 철회하면 AI 서류검토·서류 간 대조를 이용할 수 없다(그 처리에 동의가 필요하므로).
  async setSensitiveConsent(consent) {
    const r = await this._api('/api/user/sensitive-consent', { auth: true, body: { consent: !!consent } });
    if (r.ok) this.markSensitiveConsent(!!consent);
    return r;
  },

  // 서버가 이미 기록한 동의를 화면 캐시에 반영할 때(AI 검토 요청에 실어 보낸 경우 등)
  markSensitiveConsent(v) { this._setVerified(undefined, undefined, !!v); },

  async changePassword(currentPassword, newPassword) {
    return this._api('/api/auth/change-password', {
      auth: true, body: { currentPassword, newPassword },
    });
  },

  // 회원탈퇴 — 서버 계정·데이터 삭제 후 이 브라우저에 남은 데이터도 함께 지운다.
  async deleteAccount(password) {
    const s = this.getSession();
    const r = await this._api('/api/auth/delete-account', { auth: true, body: { password } });
    if (!r.ok) return r;
    const pendingCleared = DataSync.cancelPending(s && s.email); // 삭제 후 재업로드되는 것 방지
    // 다른 사람이 이 브라우저에서 사용한 별도 계정 namespace는 건드리지 않는다.
    const accountCleared = !s || !s.email || Storage.clearUser(s.email);
    const guestCleared = Storage._clearAt(Storage.GUEST_PREFIX);
    let sessionCleared = false;
    try {
      localStorage.removeItem(this._KS);
      sessionCleared = localStorage.getItem(this._KS) === null;
    } catch (e) {}
    if (sessionCleared) Storage.bumpScopeEpoch();
    return { ok: true, localCleared: pendingCleared && accountCleared && guestCleared && sessionCleared };
  },

  async logout(force = false) {
    // 만료 확인이 인증 캐시를 지우기 전에 raw identity를 잡아 둔다. 사용자가 명시적으로 누른
    // 로그아웃은 만료 직후라도 해당 계정 cache·journal과 현재 탭 guest를 정리해야 한다.
    const raw = this._rawSession();
    const active = this.getSession();
    const s = active || raw;
    if (!s) {
      const guestCleared = Storage._clearAt(Storage.GUEST_PREFIX);
      if (guestCleared) Storage.bumpScopeEpoch();
      return guestCleared
        ? { ok: true, localCleared: true }
        : { ok: false, canForce: false, error: '이 탭의 익명 자료를 지우지 못했습니다. 브라우저 저장 공간 설정을 확인해 주세요.' };
    }

    if (!force && active) {
      if (DataSync.hasLoginSyncPending(s.email)) {
        const reconciled = await DataSync.syncOnLogin();
        if (!reconciled.ok) {
          return { ok: false, canForce: true, error: '아직 계정과 확인하지 못한 진행 내용이 있습니다. 네트워크를 확인한 뒤 다시 시도해 주세요.' };
        }
      }
      const synced = await DataSync.drain();
      if (!synced.ok) {
        return { ok: false, canForce: true, error: '아직 계정에 저장하지 못한 진행 내용이 있습니다. 네트워크를 확인한 뒤 다시 시도해 주세요.' };
      }
    }

    const pendingCleared = DataSync.cancelPending(s.email);
    if (!pendingCleared && active) {
      return { ok: false, canForce: false, error: '이 기기의 동기화 재시도 기록을 지우지 못해 로그아웃을 중단했습니다. 브라우저 저장 공간 설정을 확인해 주세요.' };
    }

    // 세션 제거가 실패했는데 cache부터 지우면 로그인된 화면만 남고 자료가 사라진다. 먼저 세션을
    // 지우고 확인한 뒤 계정 cache를 지우며, cache 삭제 실패 시 가능한 한 세션을 복원한다.
    const serializedSession = JSON.stringify(s);
    let sessionCleared = false;
    try {
      localStorage.removeItem(this._KS);
      sessionCleared = localStorage.getItem(this._KS) === null;
    } catch (e) {}
    if (!sessionCleared) {
      return { ok: false, canForce: false, error: '이 기기의 로그인 정보를 지우지 못해 로그아웃을 완료하지 않았습니다. 브라우저 저장 공간 설정을 확인해 주세요.' };
    }
    Storage._migrateAccountNamespace(s.email);
    const accountCleared = Storage._clearAt(Storage._userPrefix(s.email));
    const guestCleared = Storage._clearAt(Storage.GUEST_PREFIX);
    if (!accountCleared || !guestCleared) {
      let restored = false;
      try {
        localStorage.setItem(this._KS, serializedSession);
        restored = localStorage.getItem(this._KS) === serializedSession;
      } catch (e) {}
      return {
        ok: false,
        canForce: false,
        error: restored
          ? '이 기기의 계정 자료를 모두 지우지 못해 로그아웃을 중단했습니다. 브라우저 저장 공간 설정을 확인해 주세요.'
          : '로그인은 종료됐지만 이 기기의 일부 계정 자료를 지우지 못했습니다. 브라우저 설정에서 chamroad.com 사이트 데이터를 삭제해 주세요.',
      };
    }
    Storage.bumpScopeEpoch();
    // 서버 세션 무효화는 백그라운드로 (실패해도 로컬 로그아웃은 완료)
    if (s.token) {
      fetch(API_BASE + '/api/auth/logout', {
        method: 'POST', headers: { 'Authorization': 'Bearer ' + s.token },
        keepalive: true,
      }).catch(() => {});
    }
    return { ok: true, localCleared: pendingCleared && Storage._legacyArtifacts(s.email).length === 0 };
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
  // 진단 저장은 여러 키를 연속 기록한다. 일부만 실패해도 마지막 작은 키 저장이
  // 성공할 수 있으므로, 호출부가 곧바로 띄우는 완료 메시지를 오류로 바꾼다.
  if (type === 'success' && String(msg).includes('진단을 완료')
    && ['diagnosis_data', 'diagnosis_repay', 'diagnosis_date']
      .some(key => Storage.hasSaveFailure(key))) {
    msg = '진단 결과를 저장하지 못했습니다. 브라우저 저장 공간·개인정보 보호 설정을 확인한 뒤 다시 시도해 주세요.';
    type = 'error';
  }
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    document.body.appendChild(t);
  }
  const colors = { info: 'bg-blue-700', success: 'bg-green-600', error: 'bg-red-600', warn: 'bg-amber-600' };
  t.className = (colors[type] || colors.info) + ' show';
  t.textContent = msg;
  t.setAttribute('role', type === 'error' || type === 'warn' ? 'alert' : 'status');
  t.setAttribute('aria-live', type === 'error' || type === 'warn' ? 'assertive' : 'polite');
  t.setAttribute('aria-atomic', 'true');
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

/* ── 주소 기준 관할법원 후보 찾기 (개인회생·파산 공용) ──
   이 표는 주소만으로 첫 후보를 좁히는 보조도구다. 실제 관할은 주소 외 법정 관할 근거와
   관련 사건에 따라 달라질 수 있으므로 '확정 관할'이라고 표시하지 않는다.
   지원(支院)은 원칙적으로 접수하지 않음 — 춘천지법 강릉지원만 예외. 회생법원 6곳
   (2026. 3. 대전·대구·광주 추가 개원) 기준. alt는 파산사건에만 표시한다. */
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

function initCourtFinder(containerId, procedure) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const isBankruptcy = procedure === 'bankrupt';
  const regions = Object.keys(COURT_FINDER_DATA);
  el.innerHTML = `
    <div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
      <h3 class="font-bold text-slate-800 mb-0.5 text-sm">🏛️ 주소 기준 접수법원 후보 찾기</h3>
      <p class="text-xs text-slate-500 mb-3">주소를 기준으로 먼저 확인할 법원을 찾습니다. 실제 관할은 주소 외 법정 관할 근거와 관련 사건에 따라 달라질 수 있으므로 최종 확인이 필요합니다.</p>
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
        ※ 2026. 3. 기준(회생법원 6곳). 주소 이전을 관할 선택 수단으로 안내하지 않습니다. 신청 전
        <a href="https://www.scourt.go.kr/region/popup/list_search.jsp" target="_blank" rel="noopener" class="text-blue-600 hover:underline">대한민국 법원 관할 조회 ↗</a>와 접수 예정 법원에서 확인하세요.
      </p>
    </div>`;

  const regionSel = document.getElementById('cf-region');
  const subSel = document.getElementById('cf-sub');
  const result = document.getElementById('cf-result');

  function showResult(entry) {
    if (!entry) { result.innerHTML = ''; return; }
    result.innerHTML = `
      <div class="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
        <p class="text-sm text-slate-700">주소 기준 후보: <strong class="text-blue-700">${entry.court}</strong></p>
        ${isBankruptcy && entry.alt ? `<p class="text-xs text-slate-500 mt-1">파산사건은 법 제3조가 정한 범위에서 <strong>${entry.alt}</strong>도 후보가 될 수 있습니다. 개인회생에는 이 선택지를 적용하지 않습니다.</p>` : ''}
        ${entry.note ? `<p class="text-xs text-slate-500 mt-1">${entry.note}</p>` : ''}
        <p class="text-[11px] text-slate-500 mt-2">이 결과만으로 관할이 확정되지는 않습니다. 접수 전 법원에 사건 종류와 현재 사정을 알려 확인하세요.</p>
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
    if (Storage.hasSaveFailure()) {
      btn.classList.remove('saved');
      setLabel('!', '저장 안 됨');
      showToast('저장되지 않은 변경사항이 있습니다. 브라우저 저장 공간·개인정보 보호 설정을 확인한 뒤 항목을 다시 선택해 주세요.', 'error');
      return;
    }
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
  '표준생계비': '개인회생 생계비 산정에서 기준중위소득의 60%를 출발점으로 참고합니다. 실제 인정액은 증빙과 개별 사정에 따라 달라질 수 있습니다.',
  '기준중위소득': '정부가 매년 고시하는 가구소득의 중간값. 가구원 수별로 정해집니다.',
  '변제기간':   '변제계획에 따라 돈을 갚아 나가는 기간. 보통 3년, 최대 5년입니다.',
  '안분':       '채권 금액의 비율대로 나누어 배분하는 것입니다.',
  '안분율':     '전체 채권액에서 각 채권자가 차지하는 비율. 이 비율대로 매달 나누어 갚습니다. 모두 더하면 100%가 되어야 합니다.',
  // 서류·비용 (2026-08-13 추가 — 검산기·비용 계산기에서 쓰는 말들)
  '환가':       '재산을 팔아 현금으로 바꾸는 것입니다.',
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
  '즉시항고':   '법원 결정에 불복해 다시 판단해 달라는 것. 기간이 짧으니 바로 확인하세요.',
  '동시폐지':   '나눠 줄 재산도 절차비용 낼 돈도 없어 파산선고와 동시에 절차를 끝내는 것입니다.',
  // '복권'은 일상어(로또)와 글자가 같아 뜻이 어긋나 읽히는 말이라 태깅 대상이다(GLOSSARY 기준 1).
  '복권':       '파산선고로 제한된 자격이 다시 회복되는 것. 면책결정이 확정되면 신청 없이 됩니다(당연복권).',
  // 사람·기관
  '회생위원':   '법원이 선임해 개인회생 사건의 서류 검토와 변제금 관리를 맡는 사람입니다.',
  '파산관재인': '법원이 선임해 파산자의 재산을 조사·처분하고 채권자에게 나눠 주는 사람입니다.',
  '파산재단':   '파산에서 채권자에게 나눠 줄 재산. 압류금지·면제재산은 빠집니다.',
  // 채권자 쪽 조치
  '포괄적금지명령': '모든 채권자의 강제집행·경매를 한꺼번에 막는 법원의 명령입니다.',
  '금지명령':   '채권자가 추심·강제집행을 하지 못하도록 법원이 미리 내리는 명령입니다.',
  '중지명령':   '이미 진행 중인 압류·경매 등을 잠시 멈추게 하는 법원의 명령입니다.',
  '압류금지':   '법이 정한 최소 생활 재원이라 압류할 수 없는 재산·채권을 말합니다.',
  '별제권':     '담보 잡은 채권자가 담보물에서 먼저 받아 갈 권리. 개인회생 중에는 경매가 멈춥니다.',
  // 상태·행위
  '지급불능':   '빚을 갚을 능력이 없어 계속 갚아 나갈 수 없는 상태입니다.',
  '채무초과':   '가진 재산보다 빚이 더 많은 상태입니다.',
  '편파변제':   '여러 채권자 중 특정한 곳에만 몰아서 갚는 것. 문제가 될 수 있습니다.',
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
    // 과거에 소비했지만 이미 만료된 상품의 기록으로, 새로 산 다른 허용 상품의 고지를
    // 건너뛰면 안 된다. 현재 활성 이용권이면서 이 페이지를 열 수 있는 상품만 재사용한다.
    _accessOpenedBefore = Array.isArray(opened)
      && opened.some(p => allowed.includes(p) && serverPkgs.includes(p));
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
  document.body.classList.remove('preview-mode');
  if (wasPreview) document.dispatchEvent(new CustomEvent('chamroad:gate'));
  // ⚠️ 여기서 이용 개시를 기록하지 않는다. 결제 직후 자동 이동으로 이 함수가 호출되므로,
  //    여기서 기록하면 소비자가 아무것도 열지 않았는데 청약철회가 막힌다.
  //    실제 기록은 각 페이지의 명시적 POST /api/content/open에서만 처리한다.
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
// ⚠️ **자식 노드 단위로만 동작한다.** container.innerHTML을 루트 <div> 하나로 그리는 페이지에서는
//    children.length가 1이라 keep=1이면 아무것도 지우지 않고 조용히 통과한다(2026-08-12에 회생·파산
//    진행센터가 이 상태였고, 실제로 유료 콘텐츠가 열렸다). 그런 페이지는 lockSection에 의존하지 말고
//    '무엇을 그릴지'를 isPreview()로 직접 제한할 것 — rehabilitation/bankruptcy의 renderSteps 참조.
function lockSection(container, keep, note) {
  if (!_preview.on || !container) return false;
  Array.from(container.children).slice(keep).forEach(n => n.remove());
  container.appendChild(previewLockCard(note));
  return true;
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
  if (_accessOpenedBefore) return true;               // 이미 개시된 뒤 — 다시 묻지 않는다
  // 동의 뒤 각 페이지의 POST /api/content/open이 D1 기록과 본문 반환을 한 트랜잭션으로
  // 처리한다. 여기서 별도 beacon을 보내면 기록 경로가 둘로 갈리고 실패 순서도 모호해진다.
  return openNoticeModal();
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

// 2026-08 계정별 저장소 도입 전의 cdg_<key> 자료는 소유자를 증명할 수 없다. 새 계정에
// 자동 귀속하거나 자동 삭제하지 않고, 비로그인 상태에서 이용자가 직접 복구/삭제를 고른다.
function renderLegacyRecoveryBanner() {
  if (Storage._activeSession() || !Storage.hasUnownedLegacy()) return;
  try { if (sessionStorage.getItem('cdg_legacy_recovery_hide') === '1') return; } catch (e) {}
  if (document.getElementById('legacy-recovery-banner')) return;

  const bar = document.createElement('section');
  bar.id = 'legacy-recovery-banner';
  bar.setAttribute('role', 'region');
  bar.setAttribute('aria-labelledby', 'legacy-recovery-title');
  bar.style.cssText = 'background:#fff7ed;border-bottom:1px solid #fdba74;color:#7c2d12';
  bar.innerHTML = `
    <div style="max-width:72rem;margin:0 auto;padding:12px 16px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:13px">
      <div style="flex:1;min-width:240px;line-height:1.55">
        <strong id="legacy-recovery-title" style="display:block">이 기기에서 구버전 익명 자료를 발견했습니다</strong>
        본인이 작성한 자료가 확실한 개인 기기에서만 복구하세요. 공용기기이거나 소유자가 확실하지 않으면 삭제하세요.
      </div>
      <button type="button" id="legacy-recovery-import" style="background:#c2410c;color:white;border:0;border-radius:7px;padding:7px 12px;font-weight:700;cursor:pointer">내 자료로 복구</button>
      <button type="button" id="legacy-recovery-delete" style="background:white;color:#9a3412;border:1px solid #fdba74;border-radius:7px;padding:7px 12px;font-weight:700;cursor:pointer">이 기기에서 삭제</button>
      <button type="button" id="legacy-recovery-later" aria-label="나중에 결정" style="background:none;color:#9a3412;border:0;padding:7px;cursor:pointer;text-decoration:underline">나중에</button>
    </div>`;
  const ph = document.getElementById('header-placeholder');
  if (ph && ph.parentNode) ph.parentNode.insertBefore(bar, ph.nextSibling);
  else document.body.insertBefore(bar, document.body.firstChild);

  bar.querySelector('#legacy-recovery-import').onclick = () => {
    if (!confirm('이 자료가 본인이 작성한 것이 확실합니까? 복구 후 현재 탭에서만 보이며, 로그인할 때 계정으로 가져올지 다시 확인합니다.')) return;
    if (!Storage.importUnownedLegacyToGuest()) {
      showToast('현재 탭에 이미 다른 자료가 있거나 저장 공간을 사용할 수 없어 복구하지 못했습니다. 기존 자료를 확인한 뒤 다시 시도해 주세요.', 'error');
      return;
    }
    showToast('구버전 익명 자료를 현재 탭에 복구했습니다.', 'success');
    setTimeout(() => location.reload(), 300);
  };
  bar.querySelector('#legacy-recovery-delete').onclick = () => {
    if (!confirm('구버전 익명 자료를 이 기기에서 영구 삭제할까요? 삭제 후에는 복구할 수 없습니다.')) return;
    if (!Storage.deleteUnownedLegacy()) {
      showToast('구버전 자료를 모두 삭제하지 못했습니다. 브라우저 저장 공간 설정을 확인해 주세요.', 'error');
      return;
    }
    bar.remove();
    showToast('구버전 익명 자료를 이 기기에서 삭제했습니다.', 'info');
  };
  bar.querySelector('#legacy-recovery-later').onclick = () => {
    try { sessionStorage.setItem('cdg_legacy_recovery_hide', '1'); } catch (e) {}
    bar.remove();
  };
}

function installAccountScopeGuard() {
  // BFCache는 로그아웃 뒤 '뒤로'를 눌렀을 때 이전 계정의 완성된 DOM을 네트워크 요청 없이
  // 되살릴 수 있다. 같은 탭의 localStorage 변경은 storage 이벤트도 발생하지 않으므로,
  // 페이지가 처음 그려진 계정 scope와 인증 전환 세대를 함께 비교한다. guest→계정→guest처럼
  // prefix가 다시 같아지는 왕복도 epoch가 달라져 이전 민감 DOM을 복원하지 못한다.
  const initialScope = Storage.scopeFingerprint();
  window.addEventListener('pageshow', () => {
    if (Storage.scopeFingerprint() === initialScope) return;
    // 리다이렉트가 끝나기 전 한 프레임이라도 민감 화면이 보이지 않게 즉시 가린다.
    if (document.body) document.body.replaceChildren();
    if (typeof location.replace === 'function') location.replace('index.html');
    else location.href = 'index.html';
  });
}

function initPage(activePage) {
  installAccountScopeGuard();       // 로그아웃·계정전환 뒤 BFCache로 이전 자료가 보이지 않게 함
  DataSync.resume();                 // 새로고침 뒤에도 실패한 계정 동기화를 이어서 시도
  renderHeader(activePage);
  renderFooter();
  initScrollTop();
  initGlossary();                  // 어려운 용어에 설명 툴팁 자동 부착
  track('pageview', activePage);   // 페이지별 조회 수(익명)
  renderVerifyBanner();            // 미인증 이용자 안내 배너(소프트)
  renderLegacyRecoveryBanner();    // 소유 불명 구버전 자료는 명시적으로만 복구/삭제
  document.addEventListener('click', (e) => {
    const d = document.getElementById('user-dropdown');
    if (d && !d.classList.contains('hidden') && !d.parentElement.contains(e.target)) {
      d.classList.add('hidden');
    }
  });
}
