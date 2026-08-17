/* ==============================
   챔로드 — AI에 함께 보내는 '절차 상황'
   ==============================

   챗봇에 서류를 붙여넣는 사람은 매번 "제 상황은 …입니다"부터 설명해야 한다.
   이 플랫폼은 그 상황을 이미 갖고 있다(무료 진단 · 맞춤 준비 진단). 그걸 AI 검토에 함께 보내면
   **법원이 이 사람에게 실제로 물을 것**을 질문에 반영할 수 있다.
   예) 폐업 이력이 있다고 답했는데 진술서에 폐업 이야기가 없다 → "폐업 경위를 적으셨나요?"

   ── 이 파일은 개인정보의 '경계선'이다 ──
   여기서 고른 항목만 서버(→Anthropic·미국)로 나간다. 그래서 두 가지를 지킨다.

   1) **민감정보는 절대 넣지 않는다.** 「개인정보 보호법」 제23조의 민감정보(건강에 관한 정보 등)는
      별도 동의 없이 처리할 수 없다. `hasHealthIssues`(건강상태)와 `debtCauses`(채무 발생 원인 —
      도박 등이 들어간다)는 js/main.js의 DataSync.SENSITIVE_FIELDS로 **서버 동기화에서도 이미 빼 둔**
      값이다. 여기서 다시 내보내면 그 조치가 무의미해진다.
   2) **금액을 넣지 않는다.** 서류검토는 '무엇을 물어야 하는가'를 정하는 데 절차 플래그면 충분하고,
      금액이 필요한 대조는 js/crosscheck.js의 summaryForAI()가 따로 담당한다. 통로를 둘로 나눠 두면
      각 통로에서 무엇이 나가는지 방침에 정확히 적을 수 있다.

   ⚠️ 항목을 늘릴 때는 반드시 privacy.html 제2항 표와 제6항 국외이전 ②를 함께 고칠 것.
      화면의 '무엇이 전송되나요?' 목록은 describe()가 만들므로 자동으로 따라온다.
*/

const AiContext = (function () {

  // 화면 표시와 서버 프롬프트가 같은 말을 쓰도록 라벨을 한곳에서 관리한다.
  const INCOME = {
    employed_insured:   '급여소득 (4대보험 가입)',
    employed_uninsured: '급여소득 (4대보험 미가입)',
    freelance:          '프리랜서',
    self:               '자영업',
    pension:            '연금·기타 소득',
    none:               '소득 없음',
  };
  const LEGAL = {
    seizure:     '압류·추심',
    provisional: '가압류',
    order:       '지급명령',
    lawsuit:     '소송 진행 중',
    auction:     '경매 진행 중',
  };
  const PRIOR = {
    'rehab-done-recent':    '개인회생 면책을 받은 지 5년이 지나지 않음',
    'rehab-done-ok':        '개인회생 면책 이력 있음 (5년 경과)',
    'rehab-cancel':         '개인회생 폐지·취소 이력',
    'rehab-ongoing':        '개인회생 진행 중',
    'bankrupt-done-recent': '파산 면책을 받은 지 7년이 지나지 않음',
    'bankrupt-done-ok':     '파산 면책 이력 있음 (7년 경과)',
    'bankrupt-denied':      '면책 불허가 이력',
    'bankrupt-cancel':      '파산 취소 이력',
    'bankrupt-ongoing':     '파산 진행 중',
  };
  const RECENT_LOAN = {
    'within-3m': '최근 3개월 이내에 새로 대출을 받음',
    'within-1y': '최근 1년 이내에 새로 대출을 받음',
  };
  const PKG_PROC = {
    'rehab-full': 'rehab', 'maintain': 'rehab', 'correction-rehab': 'rehab',
    'bankrupt-full': 'bankrupt', 'correction-bankrupt': 'bankrupt',
  };

  const pick = (dict, keys) => (Array.isArray(keys) ? keys : [])
    .filter(k => dict[k]).map(k => dict[k]);

  /* sources를 주지 않으면 브라우저 저장소에서 읽는다(Node 테스트에서는 주입해서 쓴다). */
  function build(sources) {
    const s = sources || {
      diagnosis: (typeof Storage !== 'undefined') ? Storage.load('diagnosis_data') : null,
      profile:   (typeof Storage !== 'undefined') ? Storage.load('profile') : null,
      pkg:       (typeof Storage !== 'undefined') ? Storage.load('plan_package') : null,
    };
    const d = s.diagnosis || null;
    const p = s.profile || null;
    const ctx = {};

    if (PKG_PROC[s.pkg]) ctx.procedure = PKG_PROC[s.pkg];

    if (d) {
      // ⚠️ d.hasHealthIssues / d.debtCauses / d.age / 모든 금액은 의도적으로 제외 — 파일 상단 주석 참조
      if (typeof d.hasIncome === 'boolean') ctx.hasIncome = d.hasIncome;
      if (INCOME[d.incomeType]) ctx.incomeType = d.incomeType;
      if (d.dependents != null && Number.isFinite(Number(d.dependents))) ctx.dependents = Number(d.dependents);
      if (Number(d.arrearsMonths) > 0) ctx.arrearsMonths = Number(d.arrearsMonths);
      if (RECENT_LOAN[d.recentLoan]) ctx.recentLoan = d.recentLoan;

      const legal = (d.legalActions || []).filter(v => LEGAL[v]);
      if (legal.length) ctx.legalActions = legal;

      const prior = (d.priorAdjustments || []).filter(v => PRIOR[v]);
      if (prior.length) ctx.priorAdjustments = prior;
    }

    if (p) {
      // === true로 엄격 비교한다. 느슨하게 보면 'yes' 같은 문자열이 통과해 **화면에 보여 준 목록과
      // 서버가 실제로 받아들이는 것이 어긋난다**(서버 sanitizeContext는 true만 통과시킨다).
      // 전송 목록을 정확히 고지하는 것이 이 파일의 존재 이유이므로 여기서 막는다.
      if (p.employed     === true) ctx.employed = true;      // 재직 중 → 퇴직급여 종류·예상액 반영 여부 확인
      if (p.personalDebt === true) ctx.personalDebt = true;  // 지인·사채 → 목록 누락이 잦다
      if (p.securedDebt  === true) ctx.securedDebt = true;
      if (p.closedBiz    === true) ctx.closedBiz = true;     // 폐업 → 경위와 폐업사실증명
      if (p.disposed     === true) ctx.disposed = true;      // 최근 재산 처분 → 부인·은닉 검토 대상
      if (p.sideIncome   === true) ctx.sideIncome = true;
    }

    return Object.keys(ctx).length ? ctx : null;
  }

  /* 화면에 "무엇이 전송되나요?"로 그대로 보여 줄 문장들.
     build()가 만든 것만 설명하므로 실제 전송 내용과 어긋날 수 없다. */
  function describe(ctx) {
    if (!ctx) return [];
    const out = [];
    if (ctx.procedure)  out.push('진행 중인 절차: ' + (ctx.procedure === 'rehab' ? '개인회생' : '개인파산·면책'));
    if (ctx.incomeType) out.push('소득 형태: ' + INCOME[ctx.incomeType]);
    else if (ctx.hasIncome === false) out.push('소득 형태: 소득 없음');
    if (ctx.dependents != null)  out.push('부양가족 수: ' + ctx.dependents + '명');
    if (ctx.arrearsMonths)       out.push('연체 기간: 약 ' + ctx.arrearsMonths + '개월');
    if (ctx.recentLoan)          out.push(RECENT_LOAN[ctx.recentLoan]);
    if (ctx.legalActions)        out.push('받은 법적조치: ' + pick(LEGAL, ctx.legalActions).join(', '));
    if (ctx.priorAdjustments)    out.push('과거 채무조정 이력: ' + pick(PRIOR, ctx.priorAdjustments).join(', '));
    if (ctx.employed)     out.push('재직 중');
    if (ctx.sideIncome)   out.push('부수입 있음');
    if (ctx.personalDebt) out.push('지인·개인 간 채무 있음');
    if (ctx.securedDebt)  out.push('담보 채무 있음');
    if (ctx.closedBiz)    out.push('폐업 이력 있음');
    if (ctx.disposed)     out.push('최근 재산 처분 이력 있음');
    return out;
  }

  /* ── 화면 조각 (ai-review·numcheck 두 곳이 같은 것을 쓴다) ──
     전송 목록을 describe()로 만들기 때문에, 보내는 것과 보여 주는 것이 어긋날 수 없다.
     기본값은 켬이되 이용자가 언제든 끌 수 있게 한다(끄면 payload()가 null을 준다). */
  let _ctx = null;

  function renderCard(elId) {
    const el = document.getElementById(elId);
    if (!el) return;
    _ctx = build();
    const lines = describe(_ctx);

    if (!lines.length) {
      el.innerHTML = `
        <div class="bg-slate-50 border border-slate-200 rounded-xl p-4">
          <p class="text-sm font-semibold text-slate-700 mb-1">🧭 내 상황을 함께 보내면 더 정확해집니다</p>
          <p class="text-xs text-slate-500 leading-relaxed">
            <a href="diagnosis.html" class="text-blue-700 underline">무료 채무진단</a>이나
            <a href="setup.html" class="text-blue-700 underline">맞춤 준비 진단</a>을 먼저 하시면,
            소득 형태·법적조치·폐업 이력 같은 상황을 함께 넘겨 <strong>법원이 이 상황에서 실제로 확인하는 것</strong>을 질문에 반영합니다.
          </p>
        </div>`;
      return;
    }

    el.innerHTML = `
      <div class="bg-blue-50 border border-blue-100 rounded-xl p-4">
        <label class="flex items-start gap-2.5 cursor-pointer">
          <input type="checkbox" id="aictx-toggle" checked class="mt-0.5 accent-blue-700">
          <span class="flex-1">
            <span class="block text-sm font-semibold text-blue-900">🧭 내 상황을 함께 보내기</span>
            <span class="block text-xs text-blue-700 leading-relaxed mt-0.5">
              사전 진단에서 답하신 절차 상황을 함께 보냅니다. 법원이 이 상황에서 통상 확인하는 것이 초안에 있는지까지 봅니다.
            </span>
          </span>
        </label>
        <details class="mt-2.5">
          <summary class="text-xs text-blue-700 cursor-pointer font-medium">무엇이 전송되나요? (${lines.length}개 항목)</summary>
          <ul class="mt-2 space-y-0.5 text-xs text-slate-600 pl-1">
            ${lines.map(l => `<li>· ${l.replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]))}</li>`).join('')}
          </ul>
          <p class="text-[11px] text-slate-400 mt-2 leading-relaxed">
            건강 상태와 채무 발생 원인은 민감정보라 <strong>보내지 않습니다.</strong> 금액도 이 항목에는 포함되지 않습니다.
            자세한 내용은 <a href="privacy.html" class="underline">개인정보처리방침</a>을 확인해 주세요.
          </p>
        </details>
      </div>`;
  }

  // 서버로 보낼 값. 카드가 없거나 체크를 끄면 null(= 아무것도 보내지 않음).
  function payload() {
    const cb = document.getElementById('aictx-toggle');
    if (!cb || !cb.checked) return null;
    return _ctx;
  }

  return { build, describe, renderCard, payload, INCOME, LEGAL, PRIOR, RECENT_LOAN };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = AiContext;
