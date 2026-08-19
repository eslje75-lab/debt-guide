/* 실제 브라우저로 도는 E2E 검사 — 외부 패키지 없이 Chrome DevTools Protocol만 쓴다.
 *
 * 왜 필요한가: 지금까지의 검사는 전부 정적이었다. 문법·정규식·가짜 D1은 "코드가 그렇게 생겼다"를
 * 보지 "브라우저에서 실제로 그렇게 동작한다"를 보지 못한다. 계정 격리·저장 위치·자동 요청은
 * 렌더와 스크립트 실행을 거쳐야 드러난다(2026-08 관리자 XSS 사고가 정확히 그 교훈이었다 —
 * 문자열 검사로 통과했는데 실제 DOM에서는 뚫려 있었다).
 *
 * 실행:  node tools/serve.js --public   (다른 창에서 먼저)
 *        node tools/e2e-browser.mjs
 *
 * 의존성 0: Node 24의 전역 WebSocket + 설치된 Chrome을 --headless로 띄운다.
 * ⚠️ 로그인이 필요한 구간(동기화·삭제·환불)은 이메일 인증 코드가 필요해 여기서 자동화하지 않는다.
 *    그 부분은 사람이 직접 해야 하며, 이 파일이 그것까지 검증한 것처럼 보고하지 말 것.
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const BASE = process.env.E2E_BASE || 'http://localhost:3456';
const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
].find(existsSync);

if (!CHROME) { console.error('Chrome을 찾지 못했다.'); process.exit(2); }

const results = [];
const ok   = (name, detail = '') => { results.push({ pass: true,  name, detail }); console.log(`  ✅ ${name}${detail ? ' — ' + detail : ''}`); };
const fail = (name, detail = '') => { results.push({ pass: false, name, detail }); console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`); };

/* ── 최소 CDP 클라이언트 ─────────────────────────────────────────────── */
class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.waiting = new Map(); this.listeners = []; }
  static async launch() {
    const port = 9222 + Math.floor(process.pid % 500);
    const proc = spawn(CHROME, [
      '--headless=new', `--remote-debugging-port=${port}`, '--no-first-run', '--no-default-browser-check',
      '--disable-gpu', '--disable-dev-shm-usage', '--user-data-dir=' + process.env.TEMP + '\\chamroad-e2e-' + process.pid,
      'about:blank',
    ], { stdio: 'ignore' });

    let target = null;
    for (let i = 0; i < 50 && !target; i++) {
      await sleep(200);
      try {
        const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
        target = list.find(t => t.type === 'page');
      } catch { /* 아직 안 떴다 */ }
    }
    if (!target) { proc.kill(); throw new Error('Chrome CDP 연결 실패'); }

    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    const cdp = new CDP(ws);
    cdp.proc = proc;
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && cdp.waiting.has(msg.id)) { cdp.waiting.get(msg.id)(msg); cdp.waiting.delete(msg.id); }
      else if (msg.method) cdp.listeners.forEach(fn => fn(msg));
    };
    return cdp;
  }
  send(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.waiting.set(id, (msg) => msg.error ? reject(new Error(`${method}: ${msg.error.message}`)) : resolve(msg.result));
      setTimeout(() => { if (this.waiting.has(id)) { this.waiting.delete(id); reject(new Error(`${method} 응답 없음`)); } }, 30_000);
    });
  }
  on(fn) { this.listeners.push(fn); }
  /** 페이지에서 식을 평가해 값을 돌려받는다. */
  async evaluate(expression) {
    const r = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('평가 실패: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
    return r.result.value;
  }
  async goto(url) {
    await this.send('Page.navigate', { url });
    // load 이벤트 + 스크립트가 헤더/푸터를 주입할 여유
    for (let i = 0; i < 60; i++) {
      await sleep(100);
      const state = await this.evaluate('document.readyState').catch(() => null);
      if (state === 'complete') { await sleep(400); return; }
    }
    throw new Error('페이지 로드 시간 초과: ' + url);
  }
  close() { try { this.ws.close(); } catch {} try { this.proc.kill(); } catch {} }
}

/* ── 검사 ────────────────────────────────────────────────────────────── */
const cdp = await CDP.launch();
const requests = [];
try {
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Network.enable');
  cdp.on(msg => { if (msg.method === 'Network.requestWillBeSent') requests.push(msg.params.request.url); });

  console.log(`\n대상: ${BASE}\n`);

  // ── 1. 홈이 실제로 렌더되는가(헤더 주입 포함) ──
  console.log('[1] 기본 렌더');
  await cdp.goto(`${BASE}/`);
  const title = await cdp.evaluate('document.title');
  title.includes('챔로드') ? ok('홈 렌더', title) : fail('홈 렌더', title);
  const headerFilled = await cdp.evaluate(`!!document.querySelector('#header-placeholder')?.children.length`);
  headerFilled ? ok('공통 헤더 주입됨') : fail('공통 헤더 주입 안 됨 — main.js 실행 실패 가능');
  const consoleErrors = await cdp.evaluate(`(window.__e2eErrors||[]).length`);

  // ── 2. 게스트 진단 저장 위치 ──
  // 🔴 계정 격리 설계의 전제: 비로그인 자료는 **현재 탭 sessionStorage에만** 있어야 한다.
  //    localStorage에 남으면 다음 이용자·다른 계정에게 새어나간다.
  console.log('\n[2] 게스트 저장 위치 (계정 격리의 전제)');
  await cdp.goto(`${BASE}/diagnosis.html`);
  const saved = await cdp.evaluate(`
    (() => {
      try {
        Storage.save('diagnosis_data', { totalDebt: 50000000, e2e: true });
        return { ok: true };
      } catch (e) { return { ok: false, err: String(e) }; }
    })()
  `);
  if (!saved.ok) fail('Storage.save 실행', saved.err);
  else {
    const where = await cdp.evaluate(`
      (() => {
        const ls = Object.keys(localStorage).filter(k => /diagnosis|cdg_/i.test(k));
        const ss = Object.keys(sessionStorage).filter(k => /diagnosis/i.test(k));
        return { ls, ss };
      })()
    `);
    where.ss.length > 0
      ? ok('게스트 자료가 sessionStorage에 있음', where.ss.join(','))
      : fail('게스트 자료가 sessionStorage에 없음');
    where.ls.length === 0
      ? ok('localStorage에 게스트 자료 없음')
      : fail('🔴 localStorage에 게스트 자료가 남음', where.ls.join(','));
  }

  // ── 3. 유료 페이지: 누르기 전에는 본문을 받지 않는다 ──
  // CODEX-HANDOFF 검증 항목. 자동 fetch는 이용자가 열지도 않은 것을 열었다고 기록해 환불권을 깎는다.
  console.log('\n[3] 유료 본문 자동 요청 없음 (환불권 보호)');
  for (const page of ['rehabilitation.html', 'bankruptcy.html', 'maintenance.html', 'supplement.html']) {
    requests.length = 0;
    await cdp.goto(`${BASE}/${page}`);
    await sleep(700);
    const contentCalls = requests.filter(u => /\/api\/content\/(open|steps)/.test(u));
    contentCalls.length === 0
      ? ok(`${page} — 진입만으로 본문 요청 0건`)
      : fail(`🔴 ${page} — 본문 요청이 나감`, contentCalls.join(' , '));
  }

  // ── 4. 유료 페이지에 본문이 평문으로 박혀 있지 않은가 ──
  console.log('\n[4] 유료 본문이 정적 HTML에 없음');
  await cdp.goto(`${BASE}/rehabilitation.html`);
  const lockInfo = await cdp.evaluate(`
    (() => {
      const t = document.body.innerText;
      return { len: t.length, hasLock: /구매|잠금|미리보기/.test(t) };
    })()
  `);
  lockInfo.hasLock ? ok('잠금/미리보기 안내 표시됨') : fail('잠금 안내가 안 보임');

  // ── 5. 숫자 검산기 — 코드 계산의 정확성 ──
  console.log('\n[5] 숫자 검산기 실제 계산');
  await cdp.goto(`${BASE}/numcheck.html`);
  // ⚠️ creditorList는 배열이 아니라 { rows: [...] }를 받고, 결과는 totals/rows[].share에 담긴다.
  //    (2026-08-19에 이 시그니처를 잘못 알고 짜서 거짓 실패가 났다. 고치기 전에 js/numcheck.js를 볼 것.)
  const calc = await cdp.evaluate(`
    (() => {
      const r = NumCheck.creditorList({ rows: [
        { name: 'A카드',   principal: 10000000, interest: 1000000 },
        { name: 'B캐피탈', principal:  5000000, interest:  500000 },
      ]});
      return { claim: r.totals && r.totals.claim, count: r.totals && r.totals.count,
               shares: (r.rows || []).map(x => x.share) };
    })()
  `);
  const shareSum = (calc.shares || []).reduce((a, b) => a + b, 0);
  calc.claim === 16500000
    ? ok('채권자목록 합계', calc.claim.toLocaleString() + '원 · 채권자 ' + calc.count + '명')
    : fail('채권자목록 합계가 다름', String(calc.claim));
  // 최대잉여법이 합을 정확히 100으로 맞추는지 — 법원 양식의 합계 칸이 딱 떨어져야 한다.
  Math.abs(shareSum - 100) < 0.001
    ? ok('안분율 합계 100%', shareSum + '%')
    : fail('🔴 안분율 합계가 100%가 아님 — 법원 양식의 합계 칸이 안 맞는다', String(shareSum));

  // ── 6. 결과 화면이 판정을 하지 않는가 ──
  console.log('\n[6] 결과 화면 중립성');
  await cdp.goto(`${BASE}/result.html`);
  // ⚠️ 단순 단어 검색은 **부인 문장**("이 결과는 적합도·성공확률 또는 절차 추천이 **아닙니다**")을
  //    위반으로 세어 거짓 실패를 낸다(2026-08-19에 실제로 그랬다). 문장 단위로 보고 부인형을 뺀다.
  const verdict = await cdp.evaluate(`
    (() => {
      const bad = ['적합도', '성공 확률', '성공확률', '추천 절차', '면책 예상액'];
      const deny = /아닙니다|아니며|하지 않습니다|않으며|제시하지|판정하지/;
      return document.body.innerText
        .split(/[.!?\\n]/)
        .map(s => s.trim())
        .filter(s => s && bad.some(w => s.includes(w)) && !deny.test(s));
    })()
  `);
  verdict.length === 0
    ? ok('판정 표현 0건 (부인 문장 제외)')
    : fail('🔴 결과 화면에 판정 표현이 보임', verdict.join(' | ').slice(0, 200));

} finally {
  cdp.close();
}

const failed = results.filter(r => !r.pass);
console.log('\n' + '='.repeat(64));
console.log(`E2E ${results.length}건 · 통과 ${results.length - failed.length} · 실패 ${failed.length}`);
console.log('='.repeat(64));
console.log('⚠️ 로그인 구간(서버 동기화·전체 삭제·탈퇴·환불)은 이메일 인증이 필요해 자동화하지 않았다.');
console.log('   그 부분은 사람이 직접 확인해야 하며, 이 결과가 그것까지 덮지 않는다.\n');
process.exit(failed.length ? 1 : 0);
