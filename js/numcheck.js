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
      // 붙여넣기로 채운 행에만 있는 값(조회 잔액). 확정 금액과 다르면 되묻는 근거가 된다.
      lookup:    (r.lookup === '' || r.lookup == null) ? null : parseWon(r.lookup),
    }));
    const declaredTotal = (input.declaredTotal === '' || input.declaredTotal == null)
      ? null : parseWon(input.declaredTotal);

    const items = [];
    const used  = rows.filter(r => r.name || r.principal || r.interest || r.claim);

    if (!used.length) return { items: [ask('입력된 채권자가 없습니다', '채권자를 한 명 이상 입력해 주세요.')], rows: [], totals: null };

    // ① 행별 원금+이자 = 합계
    // ⚠️ 붙여넣기로 채운 행은 합계 칸에 '조회 잔액'이 들어 있고 원금·이자는 아직 비어 있다.
    //    그 상태를 '틀렸다'고 하면, 안내대로 붙여넣은 이용자가 곧바로 빨간 오류를 본다.
    //    또 이용자가 부채증명서로 원금·이자를 적어도 합계 칸(=조회값)이 그대로면
    //    final이 조회값으로 굳어 되묻기가 영영 발동하지 않는다.
    //    → 합계 칸이 '손대지 않은 조회값'이면 원금·이자가 들어온 순간 그쪽을 확정값으로 본다.
    const pastedOnly = [];
    const rowDiffs = [];
    used.forEach((r, i) => {
      r.computed = r.principal + r.interest;
      const hasSplit = r.principal > 0 || r.interest > 0;
      const claimIsUntouchedLookup = r.claim !== null && r.lookup !== null && r.claim === r.lookup;

      if (!hasSplit && r.claim !== null) {
        // 합계만 있는 상태 — 정상적인 중간 단계다
        if (r.lookup !== null) pastedOnly.push(`${r.name || '(이름 없음)'} ${formatWon(r.claim)}원`);
        r.final = r.claim;
      } else if (claimIsUntouchedLookup && hasSplit) {
        // 원금·이자를 적었고 합계 칸은 붙여넣은 값 그대로 → 부채증명서 쪽을 확정값으로
        r.final = r.computed;
      } else {
        if (r.claim !== null && r.claim !== r.computed) {
          rowDiffs.push(`${i + 1}행 ${r.name || '(이름 없음)'}: 원금+이자 ${formatWon(r.computed)}원인데 합계 칸은 ${formatWon(r.claim)}원 (${formatWon(Math.abs(r.claim - r.computed))}원 차이)`);
        }
        r.final = r.claim !== null ? r.claim : r.computed;
      }
    });
    if (pastedOnly.length) {
      items.push(ask('아직 원금과 이자를 나누지 않으셨습니다',
        `지금은 붙여넣으신 조회 잔액만 들어가 있습니다 — ${pastedOnly.length}건.\n`
        + `부채증명서를 받으시면 채권자별로 원금과 이자를 나누어 적어 주세요. 채권자목록에는 두 가지를 나누어 적어야 합니다.\n`
        + `(합계 칸은 비워 두셔도 됩니다 — 원금+이자로 자동 계산합니다)`));
    }
    items.push(rowDiffs.length
      ? diff('행별 합계가 원금+이자와 다릅니다', rowDiffs.join('\n'))
      : ok('행별 합계가 원금+이자와 일치합니다', `${used.length}개 채권 모두 확인했습니다.`));

    // ①-2 조회 잔액과 확정 금액의 차이 — '틀렸다'가 아니라 '확인하라'다.
    //     법원에 내는 채권자목록의 기준은 부채증명서이고, 조회 화면의 잔액은
    //     기산일·연체이자 반영 시점이 달라 서로 다를 수 있다. 자동으로 맞추면
    //     '편한데 틀린 값'이 들어가므로, 사람에게 되묻는 것이 맞다.
    const lookupGaps = used
      .filter(r => r.lookup != null && r.lookup !== 0 && r.final !== r.lookup)
      .map((r, i) => `${r.name || '(이름 없음)'}: 조회 잔액 ${formatWon(r.lookup)}원 → 지금 적으신 금액 ${formatWon(r.final)}원 (${formatWon(Math.abs(r.final - r.lookup))}원 차이)`);
    if (lookupGaps.length) {
      items.push(ask('붙여넣으신 조회 잔액과 지금 금액이 다릅니다 — 어느 쪽이 부채증명서 금액인가요?',
        lookupGaps.join('\n')
        + '\n\n달라도 괜찮습니다. 조회 화면의 잔액과 부채증명서의 금액은 계산 기준일이 달라 차이가 나는 경우가 많습니다.'
        + '\n채권자목록에는 정해진 기준일(개인회생은 신청일) 현재의 원금과 이자를 나누어 적고, 그 금액은 채권자가 발급한 부채증명서(금융회사에서 떼는 빚 확인 서류)로 확인합니다.'
        + '\n⚠️부채증명서를 미리 받아 두셨다면 발급 기준일이 신청일과 맞는지 확인해 주세요 — 기준일이 어긋나면 보정을 요구받을 수 있습니다.'));
    }

    // ② 세로 합계
    const totals = {
      principal: sum(used.map(r => r.principal)),
      interest:  sum(used.map(r => r.interest)),
      claim:     sum(used.map(r => r.final)),
      count:     used.length,
    };
    // 아무도 원금·이자를 나누지 않은 상태(붙여넣기 직후)에서는 이 대조가 성립하지 않는다.
    // 위 ①에서 이미 "원금과 이자를 나누어 적으세요"라고 안내했으므로 여기서 또 틀렸다고 하지 않는다.
    const anySplit = used.some(r => r.principal > 0 || r.interest > 0);
    if (!anySplit) {
      items.push(ok('채권액 합계를 계산했습니다', `${formatWon(totals.claim)}원 (채권자 ${totals.count}명)`));
    } else if (totals.principal + totals.interest !== totals.claim) {
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

    // 절차마다 누락의 효과가 다르다 — 파산 이용자에게 회생 기준을 들이대면 과장이 된다.
    items.push(input.procedure === 'bankrupt'
      ? ask('사채·지인 채무까지 넣으셨나요?',
          '채권자목록에서 일부러 빠뜨린 청구권은 면책 대상에서 빠집니다(채무자회생법 제566조 제7호). 다만 그 채권자가 파산선고 사실을 이미 알고 있었다면 면책됩니다(같은 호 단서).\n조회 화면에 나오지 않는 빚(지인 채무·보증채무·구상권·밀린 통신비 등)은 직접 넣으셔야 합니다.',
          '채무자회생법 제566조 제7호')
      : ask('사채·지인 채무까지 넣으셨나요?',
          '개인회생채권자목록에 기재되지 않은 청구권은 면책 대상에서 빠집니다(채무자회생법 제625조 제2항 제1호). 이 조항은 개인파산(제566조 제7호)과 달리 "알면서 빠뜨렸을 것"을 요구하지 않습니다.\n조회 화면에 나오지 않는 빚(지인 채무·보증채무·구상권·밀린 통신비 등)은 직접 넣으셔야 합니다.',
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

    // 기본 검산에는 기준중위소득 60%만 공제한다. 실제 지출 중 초과분은 의료비·주거비 등
    // 항목별 증빙과 개별 사정을 법원이 심사해야 하므로 이 도구가 자동 인정할 수 없다.
    const courtLiving = standard;
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
    items.push(ok(`60% 기준 월 잔여소득: ${formatWon(disposable)}원`,
      `${formatWon(totalIncome)}원 − ${formatWon(courtLiving)}원(기준중위소득 60%)`
      + `\n실제 지출이 더 많더라도 초과분은 자동 공제되지 않습니다. 법원이 증빙과 개별 사정을 보고 인정한 생계비에 따라 제출용 가용소득은 달라질 수 있습니다. 여기 적은 수입이 세후 금액인지도 확인해 주세요.`));

    if (input.declaredDisposable !== '' && input.declaredDisposable != null) {
      const declared = parseWon(input.declaredDisposable);
      const gap = declared - disposable;
      items.push(gap === 0
        ? ok('적어 두신 가용소득과 계산 결과가 같습니다', `${formatWon(disposable)}원`)
        : diff('적어 두신 가용소득과 계산 결과가 다릅니다',
            `계산하면 ${formatWon(disposable)}원인데 ${formatWon(declared)}원으로 적혀 있습니다 (${gap > 0 ? '+' : '−'}${formatWon(Math.abs(gap))}원).`));
    }

    if (disposable === 0 && totalIncome > 0) {
      items.push(input.procedure === 'bankrupt'
        ? ask('가용소득이 0원으로 계산됩니다',
            '소득이 생계비 기준에 못 미친다는 뜻입니다. 개인파산에서는 이것이 이상한 상태가 아닙니다 — 변제가 어렵다는 사정을 보여 주는 값입니다. 소득 항목을 빠뜨리지 않았는지만 확인해 주세요.')
        : ask('가용소득이 0원으로 계산됩니다',
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
      // ⚠️ 개인파산은 변제계획안을 만들지 않으므로 가용소득·변제횟수가 없다.
      //    그래도 **재산 합계(청산가치)는 파산에도 필요하다** — 그것까지 못 내주면
      //    파산 이용자는 이 탭에서 어떤 숫자도 받지 못한다(2026-08-14 여정 감사 P0-1).
      if (assets.length && liquidation >= 0) {
        const list = assets.map(a => `${a.label || '(이름 없음)'} ${formatWon(a.amount)}원`).join('\n');
        const out = [ok(`입력 재산 합계: ${formatWon(liquidation)}원`,
          `${list}\n이 합계는 청산가치 산정의 기초일 뿐입니다. 면제재산·담보·환가비용 등은 별도로 반영될 수 있습니다.`)];
        if (input.procedure !== 'bankrupt') {
          out.push(ask('변제계획안까지 보시려면 월 가용소득과 변제 횟수도 넣어 주세요',
            '두 값이 있으면 명목상 납부합계를 계산할 수 있습니다. 다만 인가시점 현재가치와 정확한 청산가치가 필요한 법 제614조의 충족 여부는 이 도구가 판정하지 않습니다.'));
        } else {
          out.push(ask('재산 합계는 이렇게 씁니다',
            '파산에서는 재산목록 작성의 출발점으로 씁니다. 실제 파산재단 편입 범위와 관재인 선임 여부는 재산 종류·면제재산·법원 판단에 따라 달라집니다. 퇴직급여도 종류별 보호 범위가 다르므로 일률적으로 전액 또는 절반을 더하지 마세요.'));
        }
        return { items: out, totals: { liquidation, assetsOnly: true }, claims: [] };
      }
      return { items: [ask('월 가용소득과 변제 횟수를 입력해 주세요', '두 값이 있어야 총 변제예정액을 계산할 수 있습니다.')], totals: null, claims: [] };
    }

    const totalRepay = disposable * months;
    items.push(ok(`명목상 총 납부합계: ${formatWon(totalRepay)}원`,
      `${formatWon(disposable)}원 × ${months}회 — 인가시점 현재가치로 할인하기 전 단순 곱셈값입니다.`));

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
        `${months}회로 적혀 있습니다. 변제기간은 변제개시일부터 3년을 초과할 수 없습니다. 다만 법 제614조 제1항 제4호의 요건을 충족하기 위하여 필요한 경우 등 특별한 사정이 있으면 5년 이내로 정할 수 있습니다.`,
        '채무자회생법 제611조 제5항'));
    } else if (months > 36) {
      items.push(ask(`변제 횟수가 ${months}회(3년 초과)입니다`,
        '법 제611조 제5항은 변제개시일부터 3년을 상한으로 정하고, 법 제614조 제1항 제4호의 요건을 충족하기 위하여 필요한 경우 등 특별한 사정이 있으면 5년 이내로 정할 수 있게 합니다. 3년을 넘겨 적은 근거와 법원 양식의 현재가치 계산을 확인하세요.',
        '채무자회생법 제611조 제5항'));
    } else {
      items.push(ok(`변제 횟수 ${months}회 — 법정 3년 상한 이내입니다`, undefined));
    }

    // ③ 청산가치 관련 참고 — 제614조 제1항 제4호
    // 법은 인가결정일을 기준으로 평가한 총변제액을 비교한다. 이 도구는 변제개시일·인가예정일과
    // 법원별 현재가치 산식을 받지 않으므로 명목합계만으로 '충족/통과' 판정을 내리지 않는다.
    if (assets.length) {
        items.push(ok(`입력 재산 합계(청산가치 산정 기초): ${formatWon(liquidation)}원`,
          assets.map(a => `${a.label || '(이름 없음)'} ${formatWon(a.amount)}원`).join(' / ')));
    }
    if (liquidation > 0 || assets.length) {
      const gap = totalRepay - liquidation;
      if (gap >= 0) {
        items.push(ask('명목합계는 입력 재산 합계 이상이지만 청산가치 요건 통과 여부는 판정하지 않았습니다',
          `${formatWon(totalRepay)}원 ≥ ${formatWon(liquidation)}원입니다. 그러나 법 제614조의 비교는 인가결정일 기준 현재가치로 하므로, 명목합계가 더 크다는 사실만으로 인가 요건을 충족한다고 단정할 수 없습니다. 법원 공식 변제계획안의 현재가치 계산 또는 담당 회생위원 안내로 확인하세요.`,
          '채무자회생법 제614조 제1항 제4호'));
      } else {
        items.push(diff('명목상 납부합계도 입력 재산 합계보다 적습니다',
          `${formatWon(totalRepay)}원 < ${formatWon(liquidation)}원 — 명목상으로도 ${formatWon(-gap)}원 적습니다.`
          + `\n현재가치 계산과 면제재산·담보 등을 반영한 정확한 청산가치 산정은 이 도구가 수행하지 않습니다. 변제기간이나 금액을 임의로 정하지 말고 법원 공식 양식과 담당 회생위원 안내로 다시 확인하세요.`,
          '채무자회생법 제614조 제1항 제4호'));
      }
    } else {
      items.push(ask('재산 정보를 입력하지 않으셨습니다',
        '법 제614조의 청산가치 요건을 검토하려면 재산목록과 관련 증빙이 필요합니다. 이 도구는 입력 재산 합계와 명목 납부합계를 나란히 보여 줄 뿐, 인가시점 현재가치에 따른 충족 여부는 판정하지 않습니다.',
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

  /* ── 조회 결과 붙여넣기 파싱 ────────────────────────────────────────────
     크레딧포유·어카운트인포 등에서 채권자를 조회한 화면을 통째로 복사해 붙이면
     채권자별 행으로 나눈다. 채권자를 한 명씩 손으로 옮겨 적는 것이 누락·오타의 주원인이라
     입력 자체를 줄이는 것이 목적이다.

     ⚠️ 세 가지를 지킨다.
     1) **본인신용정보관리업(마이데이터) 허가가 필요 없는 '방식'을 유지한다.**
        ⚠️"우리가 조회하지 않으니까 괜찮다"는 논거를 쓰지 말 것 — 법의 정의는 주체가 아니라
        방식을 기준으로 삼기 때문에 그 논거로는 방어되지 않는다(2026-08-14 법률 검증).
        신용정보법 제2조 제9호의2는 마이데이터를 "신용정보를 **대통령령으로 정하는 방식으로
        통합하여** 그 신용정보주체에게 제공하는 행위를 영업으로 하는 것"으로 정의하고,
        제22조의9 제4항이 그 방식을 **전송요구권에 따른 직접 전송(API)**으로, 제3항이
        **접근매체·본인확인수단을 사용·보관하는 수집(스크래핑)**을 금지로 못박는다.
        이 함수는 둘 중 어느 쪽도 아니다 — 이용자가 스스로 복사한 **문자열을 파싱할 뿐**이고
        `fetch`도, 접근매체·인증수단 취득·보관도 없다.
        🔴**자동 로그인이나 스크래핑을 붙이는 순간 즉시 허가 대상이 된다.**
     2) **금액을 확정하지 않는다.** 법원에 내는 채권자목록의 금액 기준은 부채증명서이고,
        조회 잔액은 기산일·연체이자 반영 시점 때문에 다를 수 있다. 그래서 파싱한 금액은
        `lookup`(조회값)으로 표시해 두고, 이용자가 부채증명서로 확정하게 한다(creditorList 참조).
     3) **추측한 곳은 반드시 알린다.** 못 읽은 줄은 버리지 말고 사유와 함께 돌려준다.
        조용히 사라지면 채권자 누락이 된다. 효과는 절차마다 다르다 — 개인회생은 기재하지 않은 것만으로
        면책에서 빠지고(제625조 제2항 제1호), 개인파산은 '악의로' 빠뜨린 경우다(제566조 제7호, 단서 있음).

     ⚠️ 주민등록번호 마스킹은 호출하는 쪽(화면)에서 maskIdNumbers()로 먼저 처리한다.
        정규식 복사본을 여기 만들지 말 것 — js/main.js와 api/src/index.js 두 곳이 원본이다. */
  const MAX_PASTE_ROWS = 200;

  function parsePastedRows(text) {
    const out = { rows: [], skipped: [], declaredTotal: null };
    if (!text || typeof text !== 'string') return out;

    const lines = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    for (const line of lines) {
      if (out.rows.length >= MAX_PASTE_ROWS) {
        out.skipped.push({ line, why: `한 번에 ${MAX_PASTE_ROWS}건까지만 읽습니다` });
        continue;
      }

      // 순번 표시(①, 1., -, • 등)를 떼어낸다
      let s = line.replace(/^[\s\-–—•*·]*(?:[①-⑳]|\(?\d{1,2}[.)\]])\s*/, '');

      // 금액으로 오해할 수 있는 것들을 먼저 지운다 — 날짜, 계좌·사업자·전화번호처럼 하이픈으로 묶인 숫자
      s = s.replace(/\d{4}\s*[.\-/]\s*\d{1,2}\s*[.\-/]\s*\d{1,2}\.?/g, ' ')
           .replace(/\d{2,6}-\d{2,7}(?:-\d{2,7})?/g, ' ');

      // 금액 후보 — 쉼표가 있는 숫자 또는 연속된 숫자.
      // ⚠️ 숫자 뒤에 '건·개·명·회·%' 같은 단위가 붙으면 금액이 아니다.
      //    ("총 3건이 조회되었습니다"가 3원짜리 유령 채권자가 되던 문제)
      const money = [];
      const re = /\d{1,3}(?:,\d{3})+|\d+/g;
      let m;
      while ((m = re.exec(s)) !== null) {
        const after = s.slice(re.lastIndex).replace(/^\s+/, '');
        if (/^(건|개|명|회|차|%|년|월|일|번)/.test(after)) continue;   // 금액이 아니다
        // '1,854만원' 같은 표기 — 만/천 단위를 실제 금액으로 되돌린다
        const unit = /^만/.test(after) ? 10000 : /^천(?!원)/.test(after) ? 1000 : 1;
        money.push({ value: m[0], index: m.index, unit });
      }

      if (!money.length) {
        out.skipped.push({ line, why: '금액을 찾지 못했습니다(표 머리글이나 안내 문구로 보입니다)' });
        continue;
      }

      // 보통 표는 합계를 마지막 열에 두므로 마지막 값을 쓰지만,
      // '원금 18,000,000 이자 542,000'처럼 문장으로 적힌 줄은 마지막이 이자다 → 가장 큰 값을 쓴다.
      const last = /원\s*금|이\s*자/.test(s) && money.length > 1
        ? money.reduce((a, b) => (parseWon(b.value) * b.unit > parseWon(a.value) * a.unit ? b : a))
        : money[money.length - 1];
      const amount = parseWon(last.value) * last.unit;
      const rawName = s.slice(0, money[0].index).replace(/\s+/g, ' ').trim();

      // 합계 줄은 채권자가 아니라 '목록에 적은 합계'로 따로 받는다.
      // ⚠️①아래 꼬리 정리가 '합계'라는 단어까지 떼어내므로 **정리 전 원문으로** 판정한다.
      //   ②완전일치로 보면 '총 합계'·'합계액'이 새어 나가 유령 채권자가 된다 → 포함 검사.
      //   ③'소계'는 합계가 아니다. declaredTotal로 받으면 소계가 총계를 덮어쓴다 → 건너뛴다.
      if (/소\s*계/.test(rawName)) {
        out.skipped.push({ line, why: '소계 줄로 보여 건너뛰었습니다(합계만 받습니다)' });
        continue;
      }
      if (/합\s*계|총\s*계|총액/.test(rawName)) {
        out.declaredTotal = amount;
        continue;
      }

      // 이름 끝에 남는 꼬리(구분자·'조회 잔액' 같은 표 머리말)를 번갈아 떼어낸다.
      // 한 번만 돌리면 "○○은행 | 신용대출 | 조회 잔액" 같은 줄에서 '|'가 남는다.
      let name = rawName;
      for (let i = 0; i < 4; i++) {
        const before = name;
        name = name
          .replace(/\s*(조회\s*)?(대출\s*)?(잔액|금액|채권액|원금|이자|합계)\s*$/, '')
          .replace(/[|\t,;:>\-–—/]+\s*$/, '')
          .trim();
        if (name === before) break;
      }

      // 추측이 섞인 줄은 반드시 알린다 — 화면이 "추측해서 넣었습니다"로 보여 준다.
      const notes = [];
      if (money.length > 1) {
        // 한 줄에 원금·이자·합계가 같이 있으면 마지막이 합계가 아닐 수 있다 → 가장 큰 값을 쓴다
        if (/원\s*금|이\s*자/.test(s)) notes.push('한 줄에 원금·이자가 함께 있어 가장 큰 값을 채권액으로 봤습니다');
        else notes.push('숫자가 여러 개라 마지막 값을 금액으로 봤습니다');
      }
      if (last.unit > 1) notes.push(`'만·천' 단위를 금액으로 바꿨습니다`);
      if (amount > 0 && amount < 100000) notes.push('금액이 작습니다 — 단위가 맞는지 확인해 주세요');
      if (!name) notes.push('채권자 이름을 찾지 못했습니다');

      out.rows.push({ name, amount, note: notes.join(' · ') });
    }

    return out;
  }

  /* ── ④ 법원에 내는 비용 (인지대 + 송달료 + 예납금) ──────────────────────
     "돈이 얼마나 드나"는 신청자가 가장 먼저 묻는 질문인데, 단가만 적어 두면
     채권자 수에 따라 총액이 얼마인지는 접수 창구에 가서야 알게 된다. 산식이 확정돼 있으므로
     코드로 계산한다(예측이 아니라 산식 적용이라 '판정하지 않는다' 원칙에 어긋나지 않는다).

     근거 (2026-08-13 공식 출처 확인):
     - 송달료 1회 5,640원 — 2026. 7. 1. 인상(대한법률구조공단 소송비용 자동계산,
       찾기쉬운 생활법령정보). 국내 통상우편요금에 연동돼 바뀌므로 SONGDAL_FEE만 고치면 된다.
     - 송달료 회수 — 개인회생: 10회분 + (채권자수 × 8회분) /
       개인파산: 10회분 + (채권자수 × 4회분), 면책: 10회분 + (채권자수 × 3회분)  (easylaw)
     - 인지 — 개인회생 30,000원(민사소송 등 인지법 제9조 제1항 제3호),
       전자소송 접수 시 10분의 9(같은 법 제16조 제1항·제2항) = 27,000원 /
       개인파산·면책 2,000원(파산 1,000 + 면책 1,000).
       ⚠️파산 쪽 근거는 인지법이 아니라 「민사접수서류에 붙일 인지액… 예규」다. 조문 번호를 붙이지 말 것.
       ⚠️파산 인지의 전자소송 감액 여부는 확인하지 못했다 — 감액을 적용해 계산하지 않는다.
     - 예납금은 법정 금액이 아니라 법원 실무이므로 '통상'으로만 적고 합계에서 분리해 보여준다. */
  const SONGDAL_FEE = 5640;          // 1회 송달료 (2026. 7. 1. 기준)
  const SONGDAL_FEE_ASOF = '2026. 7. 1.';

  function courtCost(input) {
    const proc = input.procedure === 'bankrupt' ? 'bankrupt' : 'rehab';
    const n = Math.max(0, Math.floor(Number(input.creditorCount) || 0));
    const electronic = input.electronic !== false;   // 전자소송 접수 기본값
    const items = [];

    if (!n) {
      return { items: [ask('채권자 수를 입력해 주세요', '채권자 수에 따라 송달료가 달라집니다. 부채증명서를 받은 금융회사의 수를 세어 넣으시면 됩니다.')], totals: null };
    }

    // 인지대
    let stamp, stampNote;
    if (proc === 'rehab') {
      stamp = electronic ? 27000 : 30000;
      stampNote = electronic
        ? '개인회생 개시신청 30,000원의 10분의 9(전자소송 접수) = 27,000원'
        : '개인회생 개시신청 30,000원(종이 접수)';
    } else {
      stamp = 2000;
      stampNote = '파산신청 1,000원 + 면책신청 1,000원 = 2,000원';
    }

    // 송달료
    const counts = proc === 'rehab'
      ? [{ label: '개인회생', times: 10 + n * 8 }]
      : [{ label: '파산', times: 10 + n * 4 }, { label: '면책', times: 10 + n * 3 }];
    const songdalTimes = counts.reduce((s, c) => s + c.times, 0);
    const songdal = songdalTimes * SONGDAL_FEE;
    const songdalNote = counts
      .map(c => `${c.label} ${c.times}회분(10 + ${n}×${proc === 'rehab' ? 8 : (c.label === '파산' ? 4 : 3)})`)
      .join(' + ') + ` = ${songdalTimes}회 × ${formatWon(SONGDAL_FEE)}원`;

    const required = stamp + songdal;
    items.push(ok(`법원에 내는 기본 비용은 약 ${formatWon(required)}원으로 예상됩니다`,
      `인지대 ${formatWon(stamp)}원 — ${stampNote}\n송달료 ${formatWon(songdal)}원 — ${songdalNote}`));

    // 예납금 — 법정 금액이 아니라 실무이므로 합계와 분리한다
    const deposit = proc === 'rehab'
      ? { label: '회생위원 예납금', amount: 150000,
          note: '법원이 외부 회생위원을 선임하는 사건에 통상 15만원입니다. 서울회생법원 등 다수 법원은 내부 회생위원이라 부과되지 않는 경우가 많고, 영업소득자·고액 채무 등 사안에 따라 정해집니다.' }
      : { label: '파산관재인 예납금', amount: 300000,
          note: '파산관재인이 선임되면 서울회생법원 기준 원칙 30만원입니다. 재산·채무 규모에 따라 증액될 수 있습니다.' };
    items.push(ask(`여기에 ${deposit.label}이 더해질 수 있습니다 (통상 ${formatWon(deposit.amount)}원)`,
      `${deposit.note}\n선임 여부는 법원이 정하므로 미리 확정할 수 없습니다. 붙는 경우의 총액은 ${formatWon(required + deposit.amount)}원이 됩니다.`));

    // 사이트가 "신청과 함께 중지·금지명령을 내라"고 권하므로 그 비용도 함께 알려야 한다.
    // ⚠️단가를 공식 출처로 확정하지 못해 합계에는 넣지 않는다(과소·과다 안내를 모두 피한다).
    if (proc === 'rehab') {
      items.push(ask('중지·금지명령을 함께 신청하면 인지대가 조금 더 듭니다',
        '추심·강제집행을 멈추려면 개시신청과 함께 중지명령·금지명령을 냅니다(채무자회생법 제593조). 신청서마다 인지를 따로 붙이므로 위 금액에 소액이 더해집니다. 금액이 크지 않아 위 합계에는 넣지 않았으니, 정확한 금액은 접수 시 전자소송 화면에서 함께 확인하세요.'));
    }

    items.push(ask('비용을 마련하기 어려우면 소송구조를 신청할 수 있습니다',
      '법원에 소송구조를 신청하면 인지대·송달료·예납금의 납부를 면제받거나 미루어 받을 수 있습니다. 신청서와 함께 소득·재산 관계 자료를 냅니다.'));

    items.push(ask('여기 나온 금액은 산식으로 계산한 예상액입니다',
      `송달료 단가(1회 ${formatWon(SONGDAL_FEE)}원, ${SONGDAL_FEE_ASOF} 기준)는 우편요금에 연동돼 바뀝니다. 실제 납부액은 접수 시 법원·전자소송 화면에서 자동 계산되니 그 금액을 확인하세요.`));

    return {
      items,
      totals: {
        procedure: proc, creditorCount: n, electronic,
        stamp, songdal, songdalTimes, required,
        depositLabel: deposit.label, deposit: deposit.amount,
        withDeposit: required + deposit.amount,
      },
    };
  }

  return {
    parseWon, formatWon, shares, monthlyShares, largestRemainder,
    creditorList, incomeExpense, rehabPlan, courtCost, parsePastedRows,
    SONGDAL_FEE,
  };
})();

// Node에서 계산만 떼어 테스트할 수 있게 (브라우저에서는 무시된다)
if (typeof module !== 'undefined' && module.exports) module.exports = NumCheck;
