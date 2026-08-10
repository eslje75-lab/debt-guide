/* ==============================
   챔로드 — 숫자 검산 (코드 계산)
   ==============================

   법원에 내는 서류의 '숫자가 서로 맞는지'를 계산해서 확인하는 모듈이다.
   AI를 쓰지 않는다 — 합계·비율·곱셈은 언어모델이 틀릴 수 있고, 틀려도 그럴듯해 보인다.
   AI 검토(api/src/index.js)는 서술형(진술서·경위서)만 맡고, 산술은 전부 여기로 온다.

   설계 규칙 두 가지:
   1) **판정하지 않는다.** "인가된다/제출해도 된다" 같은 평가·예측은 변호사법 제109조 제1호의
      감정에 해당한다. 이 모듈이 내놓는 것은 ①계산 결과라는 사실 ②어긋난 금액이라는 사실
      ③조문이 무엇을 정하는지라는 사실뿐이고, 적용 판단은 이용자가 한다.
   2) **표준생계비를 여기서 정의하지 않는다.** js/main.js의 getStandardLiving 하나만 쓴다
      (복사본을 만들면 진단 화면과 검산 화면이 서로 다른 금액을 내놓는다).

   검산 기준의 근거 조문 (2026-08-10 공식 출처 확인):
   - 청산가치 보장 = 채무자회생법 제614조 제1항 제4호
     "변제계획의 인가결정일을 기준일로 하여 평가한 개인회생채권에 대한 총변제액이
      채무자가 파산하는 때에 배당받을 총액보다 적지 아니할 것"
   - 변제기간 = 같은 법 제611조 제5항 (변제개시일부터 3년 초과 금지, 특별한 사정 시 5년 이내)
   - 가용소득 = 같은 법 제579조 제4호 (소득 − 세금·보험료 − 생계비 − 영업비용)
   - 가용소득 전부 제공 = 같은 법 제614조 제2항 제2호 (이의가 진술된 경우의 추가 요건)
   - 목록 누락 채권 = 같은 법 제625조 제2항 제1호 ("개인회생채권자목록에 기재되지 아니한 청구권"은
     면책 대상에서 제외 — 개인파산의 제566조 제7호와 달리 '악의'를 요구하지 않는다)
*/

const NumCheck = (function () {

  /* ── 숫자 다루기 ── */

  // "1,061,457원", " 2600000 " 같은 입력을 정수 원으로. 숫자가 아니면 0.
  function parseWon(v) {
    if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v) : 0;
    const n = parseInt(String(v == null ? '' : v).replace(/[^0-9-]/g, ''), 10);
    return Number.isFinite(n) ? n : 0;
  }

  function formatWon(n) {
    return (Math.round(n) || 0).toLocaleString('ko-KR');
  }

  const sum = (arr) => arr.reduce((a, b) => a + b, 0);

  /* ── 최대잉여법(largest remainder) 배분 ──
     비율이나 금액을 나눌 때 각 항목을 그냥 반올림하면 합이 100%나 총액과 어긋난다.
     내림한 뒤 남은 몫을 '버려진 소수가 큰 순서'로 1단위씩 나눠 주면 합이 정확히 맞는다.
     법원 양식의 안분표가 합계 칸에서 딱 떨어져야 하므로 이 방식을 쓴다. */
  function largestRemainder(weights, totalUnits) {
    const totalWeight = sum(weights);
    if (totalWeight <= 0 || totalUnits <= 0) return weights.map(() => 0);

    const exact  = weights.map(w => w / totalWeight * totalUnits);
    const parts  = exact.map(Math.floor);
    let left     = totalUnits - sum(parts);

    // 소수부가 큰 순서. 같으면 앞 항목 우선(입력 순서가 바뀌어도 결과가 흔들리지 않게).
    const order = exact
      .map((e, i) => ({ i, frac: e - Math.floor(e) }))
      .sort((a, b) => (b.frac - a.frac) || (a.i - b.i));

    for (let k = 0; left > 0 && k < order.length; k++, left--) parts[order[k].i]++;
    return parts;
  }

  // 채권액 비율(%)을 소수 2자리로, 합이 정확히 100.00이 되게
  function shares(claims) {
    return largestRemainder(claims, 10000).map(u => u / 100);
  }

  // 월 가용소득을 채권자별로 안분. 법원 양식이 비율 칸을 소수 2자리로 쓰므로
  // 정확한 채권액 비율이 아니라 **반올림된 비율**을 기준으로 배분한다(양식과 숫자가 맞도록).
  // 그 뒤 합이 가용소득과 정확히 같아지도록 1원 단위로 보정한다.
  function monthlyShares(claims, monthlyTotal) {
    const pct = shares(claims);                       // 합 100.00 보장
    return largestRemainder(pct, Math.round(monthlyTotal));
  }

  /* ── 결과 항목 ──
     level: 'ok'   계산이 맞음
            'diff' 숫자가 어긋남 (산술 사실)
            'ask'  확인이 필요한 항목 (질문으로 돌려준다) */
  const ok   = (title, detail)          => ({ level: 'ok',   title, detail: detail || '' });
  const diff = (title, detail, statute) => ({ level: 'diff', title, detail: detail || '', statute: statute || '' });
  const ask  = (title, detail, statute) => ({ level: 'ask',  title, detail: detail || '', statute: statute || '' });

  /* ══════════════════════════════════════════
     1. 채권자목록 검산
     ══════════════════════════════════════════
     rows: [{ name, principal, interest, claim }]
       - claim(합계)은 비워 두면 원금+이자로 계산하고, 적어 두면 그 값과 대조한다.
     declaredTotal: 목록 맨 아래 '합계' 칸에 적은 금액(선택) */
  function creditorList(input) {
    const rows = (input.rows || []).map(r => ({
      name:      String(r.name == null ? '' : r.name).trim(),
      principal: parseWon(r.principal),
      interest:  parseWon(r.interest),
      claim:     (r.claim === '' || r.claim == null) ? null : parseWon(r.claim),
    }));
    const declaredTotal = (input.declaredTotal === '' || input.declaredTotal == null)
      ? null : parseWon(input.declaredTotal);

    const items = [];
    const used  = rows.filter(r => r.name || r.principal || r.interest || r.claim);

    if (!used.length) return { items: [ask('입력된 채권자가 없습니다', '채권자를 한 명 이상 입력해 주세요.')], rows: [], totals: null };

    // ① 행별 원금+이자 = 합계
    const rowDiffs = [];
    used.forEach((r, i) => {
      r.computed = r.principal + r.interest;
      if (r.claim !== null && r.claim !== r.computed) {
        rowDiffs.push(`${i + 1}행 ${r.name || '(이름 없음)'}: 원금+이자 ${formatWon(r.computed)}원인데 합계 칸은 ${formatWon(r.claim)}원 (${formatWon(Math.abs(r.claim - r.computed))}원 차이)`);
      }
      r.final = r.claim !== null ? r.claim : r.computed;
    });
    items.push(rowDiffs.length
      ? diff('행별 합계가 원금+이자와 다릅니다', rowDiffs.join('\n'))
      : ok('행별 합계가 원금+이자와 일치합니다', `${used.length}개 채권 모두 확인했습니다.`));

    // ② 세로 합계
    const totals = {
      principal: sum(used.map(r => r.principal)),
      interest:  sum(used.map(r => r.interest)),
      claim:     sum(used.map(r => r.final)),
      count:     used.length,
    };
    if (totals.principal + totals.interest !== totals.claim) {
      items.push(diff('원금 합계 + 이자 합계가 채권액 합계와 다릅니다',
        `원금 합계 ${formatWon(totals.principal)}원 + 이자 합계 ${formatWon(totals.interest)}원 = ${formatWon(totals.principal + totals.interest)}원 / 채권액 합계 ${formatWon(totals.claim)}원 (${formatWon(Math.abs(totals.claim - totals.principal - totals.interest))}원 차이)`));
    } else {
      items.push(ok('세로 합계가 맞습니다',
        `원금 ${formatWon(totals.principal)}원 + 이자 ${formatWon(totals.interest)}원 = ${formatWon(totals.claim)}원`));
    }

    // ③ 목록에 적은 합계 칸과 대조
    if (declaredTotal !== null) {
      const gap = declaredTotal - totals.claim;
      items.push(gap === 0
        ? ok('적어 두신 합계와 계산 결과가 같습니다', `${formatWon(totals.claim)}원`)
        : diff('적어 두신 합계와 계산 결과가 다릅니다',
            `계산하면 ${formatWon(totals.claim)}원인데 합계 칸에는 ${formatWon(declaredTotal)}원으로 적혀 있습니다 (${gap > 0 ? '+' : '−'}${formatWon(Math.abs(gap))}원).`));
    }

    // ④ 안분율 — 변제계획안에서 이 비율대로 나눠 갚는다
    const pct = shares(used.map(r => r.final));
    used.forEach((r, i) => { r.share = pct[i]; });
    const naive = used.map(r => Math.round(r.final / totals.claim * 10000) / 100);
    const naiveSum = Math.round(sum(naive) * 100) / 100;
    if (naiveSum !== 100) {
      items.push(ask('반올림 때문에 비율의 합이 100%가 되지 않습니다',
        `각 비율을 그냥 반올림하면 합이 ${naiveSum.toFixed(2)}%가 됩니다. 아래 '조정된 비율'은 버려진 소수가 큰 채권자부터 0.01%p씩 되돌려 합을 정확히 100.00%로 맞춘 값입니다. 법원 양식의 합계 칸이 100%로 떨어져야 하므로 이 방식이 일반적입니다.`));
    } else {
      items.push(ok('안분율의 합이 100.00%입니다'));
    }

    // ⑤ 빠지기 쉬운 것 — 질문으로만
    const noName = used.filter(r => !r.name).length;
    if (noName) items.push(ask('채권자 이름이 비어 있는 행이 있습니다', `${noName}개 행의 채권자명이 비어 있습니다. 부채증명서에 적힌 이름 그대로 적으셨나요?`));

    const zero = used.filter(r => r.final === 0).length;
    if (zero) items.push(ask('채권액이 0원인 행이 있습니다', `${zero}개 행의 채권액이 0원입니다. 부채증명서 잔액을 옮겨 적으셨나요?`));

    const names = used.map(r => r.name).filter(Boolean);
    const dup = [...new Set(names.filter((n, i) => names.indexOf(n) !== i))];
    if (dup.length) items.push(ask('같은 채권자가 여러 행에 있습니다',
      `${dup.join(', ')} — 한 채권자에게 계좌가 여러 개면 정상입니다. 부채증명서와 건수가 맞는지 확인해 주세요.`));

    items.push(ask('사채·지인 채무까지 넣으셨나요?',
      '개인회생채권자목록에 기재되지 않은 청구권은 면책 대상에서 빠집니다(채무자회생법 제625조 제2항 제1호). 이 조항은 개인파산(제566조 제7호)과 달리 "알면서 빠뜨렸을 것"을 요구하지 않습니다.',
      '채무자회생법 제625조 제2항 제1호'));

    return { items, rows: used, totals };
  }

  /* ══════════════════════════════════════════
     2. 수입·지출 목록 검산
     ══════════════════════════════════════════
     incomes / expenses: [{ label, amount }]
     dependents: 부양가족 수 (본인 제외)
     standardLiving: 표준생계비를 직접 넘기면 그 값을 쓴다(테스트용). 없으면 main.js에서 가져온다.
     declaredDisposable: 목록에 적어 둔 월 가용소득(선택) */
  function incomeExpense(input) {
    const clean = (list) => (list || [])
      .map(r => ({ label: String(r.label == null ? '' : r.label).trim(), amount: parseWon(r.amount) }))
      .filter(r => r.label || r.amount);

    const incomes  = clean(input.incomes);
    const expenses = clean(input.expenses);
    const dependents    = Math.max(0, parseInt(input.dependents, 10) || 0);
    const householdSize = 1 + dependents;

    const standard = (input.standardLiving != null)
      ? parseWon(input.standardLiving)
      : (typeof getStandardLiving === 'function' ? getStandardLiving(householdSize) : null);

    const items = [];
    if (standard == null) {
      return { items: [diff('표준생계비를 불러오지 못했습니다', 'js/main.js가 로드되지 않았습니다. 페이지를 새로고침해 주세요.')], totals: null };
    }
    if (!incomes.length && !expenses.length) {
      return { items: [ask('입력된 수입·지출이 없습니다', '수입과 지출을 한 줄 이상 입력해 주세요.')], totals: null };
    }

    const totalIncome  = sum(incomes.map(r => r.amount));
    const totalExpense = sum(expenses.map(r => r.amount));
    const balance      = totalIncome - totalExpense;

    // 법원이 인정하는 생계비 = 실제 지출과 표준생계비 중 큰 값 (진단 calcRepayment와 같은 기준)
    const courtLiving = Math.max(totalExpense, standard);
    const disposable  = Math.max(0, totalIncome - courtLiving);

    items.push(ok('합계를 계산했습니다',
      `수입 ${formatWon(totalIncome)}원 − 지출 ${formatWon(totalExpense)}원 = ${formatWon(balance)}원`));

    // ① 지출이 수입을 넘는 경우 — 법원이 반드시 되묻는 지점
    if (balance < 0) {
      items.push(ask('지출이 수입보다 많습니다',
        `매달 ${formatWon(-balance)}원이 모자랍니다. 이 부족분을 무엇으로 메우고 계신지(가족 도움·저축 인출·추가 채무 등) 목록에 적어 두셨나요?`));
    }

    // ② 표준생계비 대조
    items.push(ok(`${householdSize}인 가구 표준생계비: ${formatWon(standard)}원`,
      '2026년 기준중위소득의 60%입니다. 가용소득을 계산할 때 소득에서 빼는 기준이 됩니다.'));

    if (totalExpense > standard) {
      items.push(ask('실제 지출이 표준생계비보다 많습니다',
        `${formatWon(totalExpense - standard)}원 많습니다. 초과분은 사유(의료비·양육비 등)와 증빙을 붙여야 인정 여부가 검토됩니다. 초과 항목이 무엇인지 적어 두셨나요?`));
    }

    // ③ 가용소득
    items.push(ok(`계산된 월 가용소득: ${formatWon(disposable)}원`,
      `${formatWon(totalIncome)}원 − ${formatWon(courtLiving)}원(${courtLiving === standard ? '표준생계비' : '실제 지출'})`
      + `\n가용소득은 소득에서 세금·보험료와 생계비 등을 뺀 나머지입니다(채무자회생법 제579조 제4호). 여기 적은 수입이 세후 금액인지 확인해 주세요.`));

    if (input.declaredDisposable !== '' && input.declaredDisposable != null) {
      const declared = parseWon(input.declaredDisposable);
      const gap = declared - disposable;
      items.push(gap === 0
        ? ok('적어 두신 가용소득과 계산 결과가 같습니다', `${formatWon(disposable)}원`)
        : diff('적어 두신 가용소득과 계산 결과가 다릅니다',
            `계산하면 ${formatWon(disposable)}원인데 ${formatWon(declared)}원으로 적혀 있습니다 (${gap > 0 ? '+' : '−'}${formatWon(Math.abs(gap))}원).`));
    }

    if (disposable === 0 && totalIncome > 0) {
      items.push(ask('가용소득이 0원으로 계산됩니다',
        '소득이 생계비 기준에 못 미칩니다. 개인회생은 가용소득으로 변제하는 절차라 이 상태로는 변제계획을 세우기 어렵습니다. 소득 항목을 빠뜨리지 않았는지 확인해 주세요.'));
    }

    const noLabel = incomes.concat(expenses).filter(r => !r.label).length;
    if (noLabel) items.push(ask('항목 이름이 비어 있는 줄이 있습니다', `${noLabel}개 줄에 항목 이름이 없습니다. 무슨 수입·지출인지 적어야 증빙과 대조할 수 있습니다.`));

    return {
      items,
      totals: { totalIncome, totalExpense, balance, standard, courtLiving, disposable, householdSize },
    };
  }

  /* ══════════════════════════════════════════
     3. 변제계획안 검산
     ══════════════════════════════════════════
     disposable: 월 가용소득
     months: 변제 횟수(개월)
     assets: [{ label, amount }] 재산목록 — 합계가 청산가치
     liquidationValue: 청산가치를 직접 적을 때(선택, assets보다 우선)
     claims: [{ name, amount }] 채권자별 확정채권액(선택 — 안분표를 함께 확인할 때)
     declaredTotalRepay: 계획안에 적어 둔 총 변제예정액(선택) */
  function rehabPlan(input) {
    const disposable = parseWon(input.disposable);
    const months     = Math.max(0, parseInt(input.months, 10) || 0);

    const assets = (input.assets || [])
      .map(r => ({ label: String(r.label == null ? '' : r.label).trim(), amount: parseWon(r.amount) }))
      .filter(r => r.label || r.amount);

    const liquidation = (input.liquidationValue !== '' && input.liquidationValue != null)
      ? parseWon(input.liquidationValue)
      : sum(assets.map(r => r.amount));

    const claims = (input.claims || [])
      .map(r => ({ name: String(r.name == null ? '' : r.name).trim(), amount: parseWon(r.amount) }))
      .filter(r => r.name || r.amount);

    const items = [];
    if (disposable <= 0 || months <= 0) {
      return { items: [ask('월 가용소득과 변제 횟수를 입력해 주세요', '두 값이 있어야 총 변제예정액을 계산할 수 있습니다.')], totals: null, claims: [] };
    }

    const totalRepay = disposable * months;
    items.push(ok(`총 변제예정액: ${formatWon(totalRepay)}원`,
      `${formatWon(disposable)}원 × ${months}회`));

    // ① 계획안에 적어 둔 총액과 대조
    if (input.declaredTotalRepay !== '' && input.declaredTotalRepay != null) {
      const declared = parseWon(input.declaredTotalRepay);
      const gap = declared - totalRepay;
      items.push(gap === 0
        ? ok('적어 두신 총 변제예정액과 계산 결과가 같습니다', `${formatWon(totalRepay)}원`)
        : diff('적어 두신 총 변제예정액과 계산 결과가 다릅니다',
            `계산하면 ${formatWon(totalRepay)}원인데 ${formatWon(declared)}원으로 적혀 있습니다 (${gap > 0 ? '+' : '−'}${formatWon(Math.abs(gap))}원).`));
    }

    // ② 변제기간 — 제611조 제5항
    if (months > 60) {
      items.push(diff('변제 횟수가 법이 정한 상한을 넘습니다',
        `${months}회로 적혀 있습니다. 변제기간은 변제개시일부터 3년(36회)을 초과할 수 없고, 특별한 사정이 있는 때에도 5년(60회)을 넘지 못하도록 정해져 있습니다.`,
        '채무자회생법 제611조 제5항'));
    } else if (months > 36) {
      items.push(ask(`변제 횟수가 ${months}회(3년 초과)입니다`,
        '변제기간은 3년을 초과하지 않는 것이 원칙이고, 특별한 사정이 있는 때에 한해 5년 이내로 정할 수 있습니다. 3년을 넘겨 잡은 사정(청산가치를 맞추기 위한 경우 등)을 계획안에 적으셨나요?',
        '채무자회생법 제611조 제5항'));
    } else {
      items.push(ok(`변제 횟수 ${months}회 — 원칙인 3년(36회) 이내입니다`, undefined));
    }

    // ③ 청산가치 보장 — 제614조 제1항 제4호
    if (assets.length) {
      items.push(ok(`재산 합계(청산가치): ${formatWon(liquidation)}원`,
        assets.map(a => `${a.label || '(이름 없음)'} ${formatWon(a.amount)}원`).join(' / ')));
    }
    if (liquidation > 0 || assets.length) {
      const gap = totalRepay - liquidation;
      if (gap >= 0) {
        items.push(ok('총 변제예정액이 청산가치 이상입니다',
          `${formatWon(totalRepay)}원 ≥ ${formatWon(liquidation)}원 (${formatWon(gap)}원 여유)`));
      } else {
        const needMonths = Math.ceil(liquidation / disposable);
        items.push(diff('총 변제예정액이 청산가치보다 적습니다',
          `${formatWon(totalRepay)}원 < ${formatWon(liquidation)}원 — ${formatWon(-gap)}원 모자랍니다.`
          + `\n지금 가용소득 그대로라면 ${needMonths}회(약 ${Math.floor(needMonths / 12)}년 ${needMonths % 12}개월)가 되어야 청산가치에 닿습니다`
          + (needMonths > 60 ? ' — 다만 이는 법정 상한 60회를 넘습니다.' : '.')
          + `\n법은 "인가결정일을 기준일로 하여 평가한 개인회생채권에 대한 총변제액이 채무자가 파산하는 때에 배당받을 총액보다 적지 아니할 것"을 인가 요건으로 정하고 있습니다.`,
          '채무자회생법 제614조 제1항 제4호'));
      }
    } else {
      items.push(ask('재산(청산가치)을 입력하지 않으셨습니다',
        '총 변제예정액이 재산의 청산가치보다 적지 않아야 한다는 요건이 있어(채무자회생법 제614조 제1항 제4호), 재산목록 합계를 넣어야 이 부분을 확인할 수 있습니다.',
        '채무자회생법 제614조 제1항 제4호'));
    }

    // ④ 채권자별 안분
    const totalClaim = sum(claims.map(c => c.amount));
    let allocated = [];
    if (claims.length && totalClaim > 0) {
      const pct  = shares(claims.map(c => c.amount));
      const mon  = monthlyShares(claims.map(c => c.amount), disposable);
      allocated = claims.map((c, i) => ({ ...c, share: pct[i], monthly: mon[i], total: mon[i] * months }));

      items.push(ok('채권자별 안분을 계산했습니다',
        `채권액 합계 ${formatWon(totalClaim)}원 · 비율 합계 100.00% · 월 배당액 합계 ${formatWon(sum(mon))}원(= 가용소득)`));

      const rate = totalRepay / totalClaim * 100;
      items.push(ok(`총 변제율: 약 ${rate.toFixed(1)}%`,
        `${formatWon(totalRepay)}원 ÷ ${formatWon(totalClaim)}원`
        + (rate >= 100 ? '\n채권 전액 이상을 갚는 계산입니다. 채권액·가용소득·횟수를 다시 확인해 보세요.' : '')));
    }

    items.push(ask('가용소득 전부를 변제에 넣으셨나요?',
      '이의가 진술된 경우, 변제기간 동안 받게 될 가용소득 전부를 변제에 제공하는 것이 인가 요건으로 정해져 있습니다(채무자회생법 제614조 제2항 제2호). 월 변제액이 위에서 계산한 가용소득과 같은지 확인해 주세요.',
      '채무자회생법 제614조 제2항 제2호'));

    return {
      items,
      totals: { disposable, months, totalRepay, liquidation, totalClaim },
      claims: allocated,
    };
  }

  return {
    parseWon, formatWon, shares, monthlyShares, largestRemainder,
    creditorList, incomeExpense, rehabPlan,
  };
})();

// Node에서 계산만 떼어 테스트할 수 있게 (브라우저에서는 무시된다)
if (typeof module !== 'undefined' && module.exports) module.exports = NumCheck;
