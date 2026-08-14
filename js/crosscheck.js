/* ==============================
   챔로드 — 서류 간 대조 (횡단 검증)
   ==============================

   개인회생 서류는 6종이 서로 물려 있다. 채권자목록의 채권액이 변제계획안의 확정채권액과 같아야 하고,
   수입·지출에서 계산한 가용소득이 변제계획안의 월 변제액과 같아야 하고, 진술서에 쓴 대출 시기·금액이
   채권자목록과 어긋나면 안 된다. **보정명령의 상당수가 이 어긋남에서 나온다.**

   서류를 하나씩 따로 보면 이걸 못 잡는다 — 여러 서류를 동시에 들고 있어야만 보이기 때문이다.
   이 모듈이 그 '동시에 들고 있는' 역할을 한다.

   역할 분담:
   - **이 파일(코드)** : 숫자·이름·개수처럼 기계적으로 대조되는 것. 브라우저 안에서만 돌고
     아무것도 전송하지 않는다. 그래서 무료이고 개인정보 이전도 없다.
   - **AI(api/src/index.js의 /api/ai/crosscheck)** : 진술서 같은 **서술과 숫자의 어긋남**.
     "2022년에 처음 대출받았다"고 썼는데 목록의 최초 발생일이 2020년인 경우 등. 코드로는 못 잡는다.

   판정하지 않는다는 규칙은 js/numcheck.js와 같다 — 결과는 ok/diff/ask 세 가지뿐이고,
   "제출해도 된다·인가된다" 같은 평가는 내지 않는다(변호사법 제109조 제1호).
*/

const CrossCheck = (function () {

  const fmt = (n) => (Math.round(n) || 0).toLocaleString('ko-KR');

  const ok   = (title, detail)          => ({ level: 'ok',   title, detail: detail || '' });
  const diff = (title, detail, statute) => ({ level: 'diff', title, detail: detail || '', statute: statute || '' });
  const ask  = (title, detail, statute) => ({ level: 'ask',  title, detail: detail || '', statute: statute || '' });

  // 채권자 이름 비교용 정규화. 법원 서류에서는 같은 회사를 "○○은행"/"(주)○○은행"/"○○은행 주식회사"로
  // 적는 일이 흔해서, 이런 표기 차이로 거짓 경고가 나지 않게 걸러 낸다.
  function normName(s) {
    return String(s || '')
      .replace(/\s+/g, '')
      .replace(/\(주\)|주식회사|㈜/g, '')
      .toLowerCase();
  }

  /* file = {
       creditor: numcheck.creditorList()의 반환값 | null,
       income:   numcheck.incomeExpense()의 반환값 | null,
       plan:     numcheck.rehabPlan()의 반환값 | null,
       diagnosis: { totalDebt, creditorCount, dependents, totalAssets } | null   // 무료 진단 결과
     } */
  function run(file) {
    const cred = file.creditor && file.creditor.totals ? file.creditor : null;
    const inc  = file.income   && file.income.totals   ? file.income   : null;
    const plan = file.plan     && file.plan.totals     ? file.plan     : null;
    const diag = file.diagnosis || null;

    const items = [];
    const filled = [cred && '채권자목록', inc && '수입·지출', plan && '변제계획안'].filter(Boolean);

    if (filled.length < 2) {
      return {
        items: [ask('대조하려면 서류가 두 종류 이상 필요합니다',
          filled.length
            ? `지금은 ${filled[0]}만 계산돼 있습니다. 다른 탭도 채운 뒤 다시 눌러 주세요.`
            : '앞의 탭에서 [검산하기]를 먼저 눌러 주세요. 그 결과를 여기서 서로 대조합니다.')],
        pairs: 0,
      };
    }

    let pairs = 0;

    /* ── ① 채권자목록 총액 ↔ 변제계획안 확정채권액 총액 ──
       변제계획안은 채권자목록에 확정된 금액을 그대로 옮겨 적는 표라, 두 총액은 같아야 한다. */
    if (cred && plan && plan.totals.totalClaim > 0) {
      pairs++;
      const a = cred.totals.claim, b = plan.totals.totalClaim;
      items.push(a === b
        ? ok('채권자목록의 채권액 합계와 변제계획안의 확정채권액 합계가 같습니다', `${fmt(a)}원`)
        : diff('채권자목록과 변제계획안의 채권액 합계가 다릅니다',
            `채권자목록 ${fmt(a)}원 / 변제계획안 ${fmt(b)}원 — ${fmt(Math.abs(a - b))}원 차이.`
            + `\n두 서류는 같은 채권을 적는 것이라 금액이 갈리면 어느 쪽이 맞는지 법원이 되묻게 됩니다.`));
    }

    /* ── ② 채권자 이름 대조 — 한쪽에만 있는 채권자 ──
       금액 합계가 우연히 맞아도 채권자 구성이 다르면 안분이 틀어진다. */
    if (cred && plan && plan.claims && plan.claims.length) {
      pairs++;
      const inCred = new Map(cred.rows.filter(r => r.name).map(r => [normName(r.name), r.name]));
      const inPlan = new Map(plan.claims.filter(c => c.name).map(c => [normName(c.name), c.name]));

      const onlyCred = [...inCred].filter(([k]) => !inPlan.has(k)).map(([, v]) => v);
      const onlyPlan = [...inPlan].filter(([k]) => !inCred.has(k)).map(([, v]) => v);

      if (onlyCred.length || onlyPlan.length) {
        items.push(diff('두 서류의 채권자 구성이 다릅니다',
          [onlyCred.length ? `채권자목록에만 있음: ${onlyCred.join(', ')}` : '',
           onlyPlan.length ? `변제계획안에만 있음: ${onlyPlan.join(', ')}` : ''].filter(Boolean).join('\n')
          + `\n변제계획안은 채권자목록에 적힌 채권자에게 안분하는 표이므로, 목록에 없는 채권자가 계획안에 있거나 그 반대이면 맞지 않습니다.`));
      } else {
        // 이름이 같아도 금액이 다를 수 있으니 개별 대조까지 한다
        const mism = [];
        cred.rows.filter(r => r.name).forEach(r => {
          const p = plan.claims.find(c => normName(c.name) === normName(r.name));
          if (p && p.amount !== r.final) mism.push(`${r.name}: 목록 ${fmt(r.final)}원 / 계획안 ${fmt(p.amount)}원`);
        });
        items.push(mism.length
          ? diff('채권자별 금액이 두 서류에서 다릅니다', mism.join('\n'))
          : ok('채권자 구성과 채권자별 금액이 두 서류에서 같습니다', `${inCred.size}명 전부 일치`));
      }
    }

    /* ── ③ 수입·지출의 가용소득 ↔ 변제계획안의 월 변제액 ──
       가용소득 전부를 변제에 제공하는 것이 요건이라(제614조 제2항 제2호), 두 값은 같아야 한다. */
    if (inc && plan) {
      pairs++;
      const a = inc.totals.disposable, b = plan.totals.disposable;
      items.push(a === b
        ? ok('수입·지출에서 계산한 가용소득과 변제계획안의 월 변제액이 같습니다', `${fmt(a)}원`)
        : diff('가용소득과 변제계획안의 월 변제액이 다릅니다',
            `수입·지출 기준 ${fmt(a)}원 / 변제계획안 ${fmt(b)}원 — ${fmt(Math.abs(a - b))}원 차이.`
            + (b < a ? `\n계획안의 월 변제액이 계산된 가용소득보다 적습니다. 이의가 진술된 경우 가용소득 전부를 변제에 제공하는 것이 인가 요건으로 정해져 있습니다.`
                     : `\n계획안의 월 변제액이 계산된 가용소득보다 많습니다. 실제로 낼 수 있는 금액인지(수행가능성) 확인이 필요합니다.`),
            '채무자회생법 제614조 제2항 제2호'));
    }

    /* ── ④ 무료 진단 결과와의 대조 ──
       진단은 개략치를 물어본 것이라 서류와 정확히 같을 수 없다. 그래서 diff가 아니라 ask로만 둔다.
       다만 자릿수가 다를 만큼 벌어지면 어느 한쪽이 빠졌다는 신호다. */
    if (diag) {
      if (cred && diag.totalDebt > 0) {
        pairs++;
        const a = diag.totalDebt, b = cred.totals.claim;
        const off = Math.abs(a - b) / Math.max(a, b);
        items.push(off <= 0.1
          ? ok('무료 진단에서 답하신 총 채무와 채권자목록 합계가 비슷합니다', `진단 ${fmt(a)}원 / 목록 ${fmt(b)}원`)
          : ask('무료 진단의 총 채무와 채권자목록 합계가 많이 다릅니다',
              `진단 ${fmt(a)}원 / 목록 ${fmt(b)}원 (약 ${Math.round(off * 100)}% 차이).`
              + `\n진단은 대략 답하신 값이라 조금 다른 것은 자연스럽습니다. 다만 이 정도로 벌어졌다면 부채증명서를 아직 못 받은 채권자가 있는지, 사채·지인 채무를 목록에 넣으셨는지 확인해 보세요.`));
      }
      if (cred && diag.creditorCount > 0) {
        pairs++;
        const rows = cred.totals.count;
        if (diag.creditorCount !== rows) {
          items.push(ask('무료 진단에서 답하신 채권자 수와 목록의 건수가 다릅니다',
            `진단 ${diag.creditorCount}곳 / 목록 ${rows}건.`
            + `\n한 채권자에 계좌가 여러 개면 건수가 더 많은 것이 정상입니다. 반대로 목록이 더 적다면 빠진 채권자가 없는지 확인해 주세요.`));
        }
      }
      if (inc && diag.dependents != null && diag.dependents !== inc.totals.householdSize - 1) {
        pairs++;
        items.push(ask('무료 진단의 부양가족 수와 수입·지출에 넣으신 값이 다릅니다',
          `진단 ${diag.dependents}명 / 수입·지출 ${inc.totals.householdSize - 1}명.`
          + `\n부양가족 수가 바뀌면 표준생계비가 달라져 가용소득과 월 변제액이 함께 바뀝니다. 어느 쪽이 현재 사실인지 확인해 주세요.`));
      }
      if (plan && diag.totalAssets > 0 && plan.totals.liquidation > 0) {
        pairs++;
        const a = diag.totalAssets, b = plan.totals.liquidation;
        const off = Math.abs(a - b) / Math.max(a, b);
        if (off > 0.1) {
          items.push(ask('무료 진단의 재산 합계와 재산목록 합계가 많이 다릅니다',
            `진단 ${fmt(a)}원 / 재산목록 ${fmt(b)}원.`
            + `\n진단에서는 예상 퇴직금을 묻지 않으므로 재직 중이시라면 재산목록 쪽이 더 큰 것이 정상입니다(예상 퇴직금의 1/2이 재산에 들어갑니다). 반대로 재산목록이 더 작다면 빠뜨린 재산이 없는지 확인해 주세요.`));
        }
      }
    }

    /* ── ⑤ 아직 대조하지 못한 조합 안내 ── */
    const missing = [];
    if (!cred) missing.push('채권자목록');
    if (!inc)  missing.push('수입·지출');
    // ⚠️ 변제계획안은 개인회생 서류다. 파산 이용자에게 이걸 만들라고 안내하면
    //    존재하지 않는 서류를 요구하는 막다른 안내가 된다.
    if (!plan && file.procedure !== 'bankrupt') missing.push('변제계획안');
    if (missing.length) {
      items.push(ask(`${missing.join('·')}은(는) 아직 계산하지 않으셨습니다`,
        '그 탭에서 [검산하기]를 누르시면 여기서 함께 대조합니다. 서류를 많이 넣을수록 어긋난 곳이 더 잘 보입니다.'));
    }

    // 대조할 조합이 하나도 없을 때 빈 화면을 내보내지 않는다.
    // (파산 이용자는 변제계획안을 만들지 않으므로 회생 기준 조합이 대부분 성립하지 않는다)
    // head:'info' — 실패가 아니라 '여기까지'라는 뜻이다. 화면이 회색 실패 배너를 얹지 않게 한다.
    let head = null;
    if (!items.length) head = 'info';
    if (!items.length) {
      items.push(ask('지금 넣으신 서류끼리는 맞춰 볼 숫자가 없습니다',
        file.procedure === 'bankrupt'
          ? '개인파산은 변제계획안을 작성하지 않아 회생만큼 서류가 맞물리지 않습니다. '
            + '무료 진단을 먼저 해 두시면 진단에서 답하신 총 채무·채권자 수와 채권자목록을 대조해 드립니다. '
            + '각 탭의 [검산하기]로 서류 안의 합계가 맞는지는 지금도 확인하실 수 있습니다.'
          : '각 탭에서 [검산하기]를 눌러 값을 채우시면 여기서 서로 대조합니다.'));
    }

    if (!items.some(i => i.level === 'diff') && pairs > 0) {
      items.unshift(ok(`서류 ${filled.length}종을 ${pairs}가지 기준으로 맞춰 봤습니다`,
        '아래 항목에서 서로 어긋나는 숫자는 나오지 않았습니다. 다만 이것은 숫자가 서로 맞는다는 뜻일 뿐, 서류가 완성되었다는 뜻은 아닙니다.'));
    }

    return { items, pairs, head };
  }

  /* AI 서술 대조에 보낼 '숫자 요약'을 만든다.
     ⚠️ 여기서 만든 것만 서버(→Anthropic)로 나간다. 이 함수가 개인정보 이전의 경계선이므로
     항목을 늘릴 때는 privacy.html의 국외이전 '이전되는 항목'을 함께 고칠 것. */
  function summaryForAI(file) {
    const out = {};
    if (file.creditor && file.creditor.totals) {
      out.creditors = file.creditor.rows.map(r => ({ name: r.name, amount: r.final }));
      out.creditorTotal = file.creditor.totals.claim;
    }
    if (file.income && file.income.totals) {
      const t = file.income.totals;
      out.income = { total: t.totalIncome, expense: t.totalExpense, disposable: t.disposable, household: t.householdSize };
    }
    if (file.plan && file.plan.totals) {
      const t = file.plan.totals;
      out.plan = { disposable: t.disposable, months: t.months, totalRepay: t.totalRepay, liquidation: t.liquidation };
    }
    return out;
  }

  return { run, summaryForAI, normName };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = CrossCheck;
