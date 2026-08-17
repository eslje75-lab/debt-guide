/* ==============================
   챔로드 - 진단 로직
   ============================== */

// ── 단계 관리 ──
let currentStep = 1;
const TOTAL_STEPS = 4;
const STEP_LABELS = ['채무현황', '연체·법적현황', '소득·가구', '재산·기타'];

function goStep(n) {
  if (n < 1 || n > TOTAL_STEPS) return;

  document.querySelectorAll('.form-step').forEach(s => s.classList.remove('active'));
  document.getElementById('step-' + n).classList.add('active');

  currentStep = n;
  updateStepNav();

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
  if (typeof track === 'function') track('diag_step', currentStep);   // 단계 전진(익명)
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

// ── 단계별 유효성 검사 ──
function validateStep(step) {
  const warn = msg => { showToast(msg, 'warn'); return false; };

  if (step === 1) {
    const unsecured = document.getElementById('unsecured-debt');
    if (!unsecured || unsecured.value === '') {
      unsecured && unsecured.focus();
      return warn('무담보 채무 총액을 입력해 주세요. (없으면 0)');
    }
    const unsecuredVal = parseInt(unsecured.value.replace(/[^0-9]/g, '') || '0', 10);
    if (unsecuredVal > 2_000_000_000_000) {
      unsecured.focus();
      return warn('채무액이 너무 큽니다. 원 단위로 입력해 주세요. (예: 1억5천만원 → 150,000,000)');
    }

    const secured = document.getElementById('secured-debt');
    const securedVal = parseInt((secured?.value || '').replace(/[^0-9]/g, '') || '0', 10);
    if (securedVal > 2_000_000_000_000) {
      secured.focus();
      return warn('담보 채무액이 너무 큽니다. 원 단위로 입력해 주세요. (예: 1억5천만원 → 150,000,000)');
    }

    const creditor = document.getElementById('creditor-count');
    if (!creditor || !creditor.value) {
      creditor && creditor.focus();
      return warn('채권자(금융사) 수를 입력해 주세요.');
    }

    const recentLoan = document.querySelector('input[name="recent-loan"]:checked');
    if (!recentLoan) return warn('최근 1년 이내 신규 대출 여부를 선택해 주세요.');
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
        return warn('최근 1년 월 평균 소득(세후)을 입력해 주세요.');
      }
    }

    const dependents = document.getElementById('dependents');
    if (!dependents || dependents.value === '') {
      dependents && dependents.focus();
      return warn('부양가족 수를 입력해 주세요. (없으면 0)');
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
  // 원 단위 입력 (콤마 제거 후 파싱)
  const money = id => num(id);
  const val = id => {
    const el = document.getElementById(id);
    return el ? el.value.trim() : '';
  };
  const radio = name => {
    const el = document.querySelector(`input[name="${name}"]:checked`);
    return el ? el.value : '';
  };

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
  // 퇴직급여 제도·예상액은 무료 진단에서 묻지 않는다. 퇴직금채권·퇴직연금 수급권 등
  // 종류별 보호 범위가 달라 일률적인 비율을 청산가치에 자동 산입하지 않는다 —
  // 금액을 모르는 이용자가 많아 이탈 요인이 되고, 판정을 뒤집는 경우도 드물다.
  // 정확한 반영은 setup.html(맞춤 준비 진단)에서 재직 여부로 안내한다.
  const totalAssets    = cashAssets + propertyValue + carValue + depositValue + insuranceValue;

  const unsecuredDebt = money('unsecured-debt');
  const securedDebt   = money('secured-debt');
  const totalDebt     = unsecuredDebt + securedDebt;
  return {
    // 채무
    unsecuredDebt,
    securedDebt,
    totalDebt,
    creditorCount:           num('creditor-count'),
    recentLoan:              radio('recent-loan'), // 'within-3m' | 'within-1y' | 'none'
    // 연체·법적
    isDelinquent,
    arrearsMonths,
    legalActions,
    hasLegalAction:          legalActions.length > 0 && !legalActions.includes('none'),
    // 소득
    hasIncome,
    incomeType:              val('income-type'),
    monthlyIncome,
    dependents:              num('dependents'),
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
    priorAdjustments:        getChecked('prior-adj').filter(v => v !== 'none'),
    // result.html 호환성
    monthlyPayment:          0,
    monthlyHousing:          0,
    jobType:                 '',
  };
}

// ── 2026년 기준중위소득·표준생계비(getStandardLiving)는 js/main.js로 옮겼다 ──
// 진단 외에 숫자 검산(js/numcheck.js)도 같은 기준을 써야 해서 모든 페이지가 읽는 곳에 둔 것이다.
// 여기에 복사본을 다시 만들지 말 것 — 기준이 갈리면 화면마다 다른 금액이 나온다.

// ── 개인회생 숫자 참고 계산 (2026 기준중위소득 60% 기준) ──
function calcRepayment(d) {
  const householdSize   = 1 + (parseInt(d.dependents) || 0);        // 본인 + 부양가족
  const standardLiving  = getStandardLiving(householdSize);        // 기준중위소득 60% 참고값
  // 실제 생활비 초과분은 자동 인정하지 않는다. 이 값은 어디까지나 60% 기준의 기본 추정액이다.
  const effectiveLiving = standardLiving;
  const monthly  = Math.max(0, (d.monthlyIncome || 0) - effectiveLiving);
  const total36  = monthly * 36;
  // 기존 저장 데이터와의 호환을 위해 키는 유지하지만, 이는 법원이 정한 면책액이 아니라 단순 차액이다.
  const exempt   = Math.max(0, d.totalDebt - total36);
  return { monthly, total36, exempt, standardLiving, effectiveLiving, householdSize };
}

// ── 제출 처리 ──
function submitDiagnosis() {
  // 전 단계 재검증 — goStep 직접 호출 등으로 필수 입력을 건너뛴 채 제출되는 것 방지
  for (let s = 1; s <= TOTAL_STEPS; s++) {
    if (!validateStep(s)) { goStep(s); return; }
  }

  const data    = collectFormData();
  const repayment = calcRepayment(data);

  const saved = Storage.saveBatch([
    ['diagnosis_data', data],
    ['diagnosis_repay', repayment],
    ['diagnosis_date', new Date().toLocaleDateString('ko-KR')],
  ]);
  if (!saved) {
    showToast('진단 결과를 저장하지 못해 이동을 중단했습니다. 브라우저 저장 공간·개인정보 보호 설정을 확인한 뒤 다시 시도해 주세요.', 'error');
    return;
  }

  if (typeof track === 'function') track('diag_complete', '');   // 진단 완료(익명)
  showToast('진단을 완료했습니다. 결과 페이지로 이동합니다.', 'success');
  setTimeout(() => { window.location.href = 'result.html'; }, 900);
}
