/* ==============================
   챔로드 - 진단 로직
   ============================== */

// ── 단계 관리 ──
let currentStep = 1;
const TOTAL_STEPS = 4;
const STEP_LABELS = ['채무현황', '연체·법적현황', '소득·생활비', '재산·기타'];

function goStep(n) {
  if (n < 1 || n > TOTAL_STEPS) return;

  document.querySelectorAll('.form-step').forEach(s => s.classList.remove('active'));
  document.getElementById('step-' + n).classList.add('active');

  currentStep = n;
  updateStepNav();
  updateProgress();

  const prevBtn   = document.getElementById('btn-prev');
  const nextBtn   = document.getElementById('btn-next');
  const submitBtn = document.getElementById('btn-submit');
  if (prevBtn)   prevBtn.style.display   = n === 1            ? 'none' : 'inline-flex';
  if (nextBtn)   nextBtn.style.display   = n === TOTAL_STEPS  ? 'none' : 'inline-flex';
  if (submitBtn) submitBtn.style.display = n === TOTAL_STEPS  ? 'inline-flex' : 'none';

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function nextStep() {
  if (!validateStep(currentStep)) return;
  goStep(currentStep + 1);
}

function prevStep() {
  goStep(currentStep - 1);
}

function updateStepNav() {
  for (let i = 1; i <= TOTAL_STEPS; i++) {
    const dot  = document.getElementById('dot-' + i);
    const line = document.getElementById('line-' + i);
    if (dot) {
      dot.className  = 'step-dot ' + (i < currentStep ? 'done' : i === currentStep ? 'active' : 'pending');
      dot.textContent = i < currentStep ? '✓' : String(i);
    }
    if (line) {
      line.className = 'step-line ' + (i < currentStep ? 'done' : 'pending');
    }
  }
}

function updateProgress() {
  const bar = document.getElementById('progress-bar');
  const pct = document.getElementById('progress-pct');
  const val = Math.round((currentStep / TOTAL_STEPS) * 100);
  if (bar) bar.style.width = val + '%';
  if (pct) pct.textContent = val + '%';
}

// ── 단계별 유효성 검사 ──
function validateStep(step) {
  const warn = msg => { showToast(msg, 'warn'); return false; };

  if (step === 1) {
    const checked = document.querySelectorAll('input[name="debt-type"]:checked');
    if (checked.length === 0) return warn('채무 종류를 하나 이상 선택해 주세요.');

    const unsecured = document.getElementById('unsecured-debt');
    if (!unsecured || unsecured.value === '') {
      unsecured && unsecured.focus();
      return warn('무담보 채무 총액을 입력해 주세요. (없으면 0)');
    }
    if (parseFloat(unsecured.value) > 200000) {
      unsecured.focus();
      return warn('채무액이 너무 큽니다. 만원 단위로 입력해 주세요. (예: 1억5천만원 → 15,000)');
    }

    const secured = document.getElementById('secured-debt');
    if (secured && parseFloat(secured.value) > 200000) {
      secured.focus();
      return warn('담보 채무액이 너무 큽니다. 만원 단위로 입력해 주세요. (예: 1억5천만원 → 15,000)');
    }

    const creditor = document.getElementById('creditor-count');
    if (!creditor || !creditor.value) {
      creditor && creditor.focus();
      return warn('채권자(금융사) 수를 입력해 주세요.');
    }
  }

  if (step === 2) {
    const delinquent = document.querySelector('input[name="is-delinquent"]:checked');
    if (!delinquent) return warn('연체 여부를 선택해 주세요.');

    if (delinquent.value === 'yes') {
      const period = document.getElementById('arrears-period');
      if (!period || !period.value) return warn('연체 기간을 선택해 주세요.');
    }
  }

  if (step === 3) {
    const hasIncome = document.querySelector('input[name="has-income"]:checked');
    if (!hasIncome) return warn('소득 여부를 선택해 주세요.');

    if (hasIncome.value === 'yes') {
      const incomeType = document.getElementById('income-type');
      if (!incomeType || !incomeType.value) return warn('소득 유형을 선택해 주세요.');

      const income = document.getElementById('monthly-income');
      if (!income || !income.value) {
        income && income.focus();
        return warn('월 평균 소득을 입력해 주세요.');
      }
    }

    const dependents = document.getElementById('dependents');
    if (!dependents || dependents.value === '') {
      dependents && dependents.focus();
      return warn('부양가족 수를 입력해 주세요. (없으면 0)');
    }

    const living = document.getElementById('monthly-living');
    if (!living || !living.value) {
      living && living.focus();
      return warn('월 필수 생활비를 입력해 주세요.');
    }
  }

  if (step === 4) {
    const age = document.getElementById('age');
    if (!age || !age.value) {
      age && age.focus();
      return warn('나이를 입력해 주세요.');
    }
  }

  return true;
}

// ── 폼 데이터 수집 ──
function collectFormData() {
  const getChecked = name =>
    Array.from(document.querySelectorAll(`input[name="${name}"]:checked`)).map(el => el.value);
  const num = id => {
    const el = document.getElementById(id);
    return el ? (parseFloat(String(el.value).replace(/[^0-9.]/g, '')) || 0) : 0;
  };
  // 만원 단위 입력 → 원 단위로 변환
  const money = id => num(id) * 10000;
  const val = id => {
    const el = document.getElementById(id);
    return el ? el.value.trim() : '';
  };
  const radio = name => {
    const el = document.querySelector(`input[name="${name}"]:checked`);
    return el ? el.value : '';
  };

  const debtTypes    = getChecked('debt-type');
  const legalActions = getChecked('legal-action');
  const debtCauses   = getChecked('debt-cause');

  const isDelinquent = radio('is-delinquent') === 'yes';
  const arrearsMonths = isDelinquent ? (parseInt(val('arrears-period')) || 0) : 0;

  const hasIncome    = radio('has-income') === 'yes';
  const monthlyIncome = hasIncome ? money('monthly-income') : 0;

  const cashAssets     = money('cash-assets');
  const propertyValue  = money('property-value');
  const carValue       = money('car-value');
  const depositValue   = money('deposit-value');
  const insuranceValue = money('insurance-value');
  const totalAssets    = cashAssets + propertyValue + carValue + depositValue + insuranceValue;

  const unsecuredDebt = money('unsecured-debt');
  const securedDebt   = money('secured-debt');
  const totalDebt     = unsecuredDebt + securedDebt;
  const monthlyLiving = money('monthly-living');

  return {
    // 채무
    debtTypes,
    unsecuredDebt,
    securedDebt,
    totalDebt,
    creditorCount:           num('creditor-count'),
    // 연체·법적
    isDelinquent,
    arrearsMonths,
    delinquentCreditorCount: num('delinquent-creditor-count'),
    legalActions,
    hasLegalAction:          legalActions.length > 0 && !legalActions.includes('none'),
    // 소득
    hasIncome,
    incomeType:              val('income-type'),
    monthlyIncome,
    dependents:              num('dependents'),
    monthlyLiving,
    livingCost:              monthlyLiving,
    // 재산
    cashAssets,
    propertyValue,
    carValue,
    depositValue,
    insuranceValue,
    totalAssets,
    // 기타
    age:                     val('age'),
    hasHealthIssues:         document.getElementById('has-health-issues')?.value === 'yes',
    debtCauses,
    businessStatus:          val('business-status'),
    priorAdjustments:        getChecked('prior-adj').filter(v => v !== 'none'),
    // result.html 호환성
    monthlyPayment:          0,
    monthlyHousing:          0,
    jobType:                 '',
  };
}

// ── 진단 점수 계산 ──
function calcScores(d) {
  let rehab = 0, bankrupt = 0, credit = 0;

  // 금융기관 채무 여부 (신용회복위원회 핵심 조건)
  const hasFinanceDebt = d.debtTypes.some(t => ['bank', 'savings', 'card', 'insurance'].includes(t));
  const hasLoanDebt    = d.debtTypes.includes('loan'); // 대부업 채무 (CCRS 협약 미가입 다수)

  // ── 신용회복위원회 ──
  if (hasFinanceDebt) {
    credit += 35;
    // 대부업·사채·세금 등 비금융 채무 동반 → CCRS가 커버 못 하는 채무 존재
    const hasNonFinanceDebt = d.debtTypes.some(t => !['bank','savings','card','insurance'].includes(t));
    if (hasNonFinanceDebt) credit -= 20;
    // 대부업 채무 추가 패널티: 비협약 채권자 비중 20% 이상이면 채무조정 기각 (서민금융법)
    if (hasLoanDebt) credit -= 20;
  } else {
    credit -= 40;                   // 금융기관 채무 없으면 신용회복위원회 대상 아님
  }

  if (d.hasIncome && d.monthlyIncome > 0) {
    credit += 25;
    if (d.monthlyIncome < d.monthlyLiving) credit -= 15; // 소득이 생활비에 미달 → 실질 변제 여력 없음
  } else {
    credit -= 30;                   // 소득 없으면 변제능력 부족 (분할상환 계획 수립 불가)
  }

  if (d.unsecuredDebt <= 500_000_000) credit += 15; // 무담보 5억 이하 (신용회복위원회 한도)
  else credit -= 30;

  if (d.arrearsMonths === 0)       credit += 20; // 연체 없음 → 프리워크아웃
  else if (d.arrearsMonths <= 3)   credit += 15; // 초기 연체
  else if (d.arrearsMonths <= 6)   credit += 5;  // 중기 연체
  else if (d.arrearsMonths <= 12)  credit -= 5;
  else                             credit -= 15; // 1년 이상 장기 연체

  if (!d.hasLegalAction) credit += 5;

  // ── 개인회생 ──
  if (d.hasIncome && d.monthlyIncome > 0) {
    rehab += 40;                    // 소득 있음 (회생 필수 조건)
    if (['employed_insured', 'pension'].includes(d.incomeType)) rehab += 15; // 소득 안정·증빙 용이
    else if (['freelance', 'self'].includes(d.incomeType)) rehab += 8;       // 일부 증빙 가능
    else if (d.incomeType === 'employed_uninsured') rehab += 5;              // 증빙 어려움

    const disposable = d.monthlyIncome - d.monthlyLiving;
    if (disposable > 0) rehab += 20; // 가처분소득 양수 → 변제 가능
    else rehab -= 10;
  } else {
    rehab -= 30;                    // 소득 없으면 회생 불가
  }

  if (d.unsecuredDebt > 1_000_000_000) rehab -= 50; // 무담보 10억 초과 → 회생 불가
  if (d.securedDebt   > 1_500_000_000) rehab -= 30; // 담보 15억 초과 → 회생 불가

  if (d.arrearsMonths > 0)  rehab += 10; // 연체 → 회생 필요성
  if (d.hasLegalAction)     rehab += 5;  // 법적 조치 → 시급성

  // 회생 하드블록 여부 사전 확인 (채무한도·이력)
  const rehabHardBlocked =
    d.unsecuredDebt > 1_000_000_000 ||
    d.securedDebt   > 1_500_000_000 ||
    d.priorAdjustments.includes('rehab-done-recent') ||
    d.priorAdjustments.includes('rehab-ongoing');

  // ── 개인파산·면책 ──
  if (!d.hasIncome || d.monthlyIncome === 0) {
    bankrupt += 45;                 // 소득 없음 → 파산 가장 강력한 신호
  } else if (d.monthlyIncome < d.monthlyLiving) {
    bankrupt += 30;                 // 소득이 생활비도 안 됨
  } else if (d.monthlyIncome < 1_000_000) {
    bankrupt += 15;
  } else if (rehabHardBlocked) {
    bankrupt += 30;                 // 소득 있어도 회생이 법적으로 불가 → 파산이 유일한 법원 절차
  }

  if (d.totalAssets < d.totalDebt * 0.2) bankrupt += 20; // 채무초과 상태
  if (d.totalAssets < 5_000_000)         bankrupt += 15; // 재산 거의 없음

  if (d.arrearsMonths >= 18)       bankrupt += 20;
  else if (d.arrearsMonths >= 9)   bankrupt += 10;
  else if (d.arrearsMonths >= 5)   bankrupt += 5;

  if (d.hasHealthIssues)           bankrupt += 10; // 근로능력 상실

  // ── 도박·사행성 채무 (면책불허가 위험 반영) ──
  if (d.debtCauses.includes('gambling')) {
    bankrupt -= 30; // 법 제564조 면책불허가 사유 해당 가능성
    rehab    += 10; // 파산보다 회생이 상대적으로 유리
    credit   -= 10; // 신용회복위원회도 감점
  }

  // ── 이전 채무조정 이력 반영 (복수 선택, 각 조건 독립 적용) ──
  const priors = d.priorAdjustments;
  // 재신청 불가 (절차별 독립 차단)
  if (priors.includes('rehab-done-recent'))    rehab    -= 60;  // 개인회생 5년 미경과
  if (priors.includes('bankrupt-done-recent')) bankrupt -= 60;  // 개인파산 7년 미경과
  // 법원 절차 진행 중 → 동일 법원 절차 간 중복 신청 불가
  if (priors.includes('rehab-ongoing'))    { rehab -= 40; bankrupt -= 30; }
  if (priors.includes('bankrupt-ongoing')) { bankrupt -= 40; rehab -= 30; }
  // 신용회복위원회 진행 중 → 신용회복 재신청 불가
  if (priors.includes('ccrs-ongoing'))     { credit -= 40; }
  // 면책불허가 이력 → 파산 재신청 시 불리
  if (priors.includes('bankrupt-denied'))  bankrupt -= 20;
  // 취소·기각 이력 → 소폭 감점
  if (priors.includes('rehab-cancel'))     rehab    -= 10;
  if (priors.includes('bankrupt-cancel'))  bankrupt -= 10;
  if (priors.includes('ccrs-cancel'))      credit   -= 5;

  // 정규화 (0~100)
  rehab    = Math.max(0, Math.min(100, rehab));
  bankrupt = Math.max(0, Math.min(100, bankrupt));
  credit   = Math.max(0, Math.min(100, credit));

  return { rehab, bankrupt, credit };
}

function scoreToLevel(s) {
  if (s >= 60) return 'high';
  if (s >= 30) return 'medium';
  return 'low';
}

function levelLabel(l) {
  if (l === 'high')   return '검토 가능성 높음';
  if (l === 'medium') return '검토 가능성 보통';
  return '검토 가능성 낮음';
}

// ── 2026년 기준중위소득 (원 단위, 보건복지부 고시) ──
const MEDIAN_INCOME_2026 = [0, 2564238, 4199292, 5359036, 6494738, 7556719, 8555952];
// 인덱스: [미사용, 1인, 2인, 3인, 4인, 5인, 6인 이상]

function getStandardLiving(householdSize) {
  const idx = Math.min(Math.max(householdSize, 1), 6);
  return Math.round(MEDIAN_INCOME_2026[idx] * 0.6); // 기준중위소득 60% = 법원 표준생계비
}

// ── 개인회생 예상 변제금 계산 (2026 표준생계비 기준) ──
function calcRepayment(d) {
  const householdSize   = 1 + (parseInt(d.dependents) || 0);        // 본인 + 부양가족
  const standardLiving  = getStandardLiving(householdSize);          // 법원 표준생계비
  const effectiveLiving = Math.max(d.monthlyLiving || 0, standardLiving); // 실제 공제액 (둘 중 큰 값)
  const monthly  = Math.max(0, (d.monthlyIncome || 0) - effectiveLiving);
  const total36  = monthly * 36;
  const exempt   = Math.max(0, d.totalDebt - total36);
  return { monthly, total36, exempt, standardLiving, effectiveLiving, householdSize };
}

// ── 제출 처리 ──
function submitDiagnosis() {
  if (!validateStep(TOTAL_STEPS)) return;

  const data    = collectFormData();
  const scores  = calcScores(data);
  const levels  = {
    rehab:    scoreToLevel(scores.rehab),
    bankrupt: scoreToLevel(scores.bankrupt),
    credit:   scoreToLevel(scores.credit),
  };
  const repayment = calcRepayment(data);

  Storage.save('diagnosis_data',   data);
  Storage.save('diagnosis_scores', scores);
  Storage.save('diagnosis_levels', levels);
  Storage.save('diagnosis_repay',  repayment);
  Storage.save('diagnosis_date',   new Date().toLocaleDateString('ko-KR'));

  showToast('진단을 완료했습니다. 결과 페이지로 이동합니다.', 'success');
  setTimeout(() => { window.location.href = 'result.html'; }, 900);
}
