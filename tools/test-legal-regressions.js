/* 법률 안내의 핵심 계산·중립성 회귀 검사 — 외부 패키지 없이 실행한다. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const mainSource = fs.readFileSync(path.join(ROOT, 'js', 'main.js'), 'utf8');
const diagnosisSource = fs.readFileSync(path.join(ROOT, 'js', 'diagnosis.js'), 'utf8');
const resultSource = fs.readFileSync(path.join(ROOT, 'result.html'), 'utf8');
const NumCheck = require(path.join(ROOT, 'js', 'numcheck.js'));

function loadStandardLiving() {
  const median = mainSource.match(/const MEDIAN_INCOME_2026\s*=\s*\[[^;]+\];/);
  const fn = mainSource.match(/function getStandardLiving\(householdSize\)\s*\{[\s\S]*?\n\}/);
  assert.ok(median && fn, '기준중위소득 단일 출처를 찾을 수 있어야 한다');
  const context = { Math, Number, result: null };
  vm.runInNewContext(`${median[0]}\n${fn[0]}\nresult = getStandardLiving;`, context);
  return context.result;
}

const getStandardLiving = loadStandardLiving();

// 2026년 기준중위소득 60%: 7인까지 고시값, 8인 이상은 7인-6인 차액 가산.
assert.equal(getStandardLiving(1), 1_538_543);
assert.equal(getStandardLiving(7), 5_709_090);
assert.equal(getStandardLiving(8), 6_284_609);

// 실제 지출 200만원을 자동 전액 공제하지 않고 1인 60% 참고값만 공제한다.
const income = NumCheck.incomeExpense({
  incomes: [{ label: '급여', amount: 2_600_000 }],
  expenses: [{ label: '실제 생활비', amount: 2_000_000 }],
  dependents: 0,
  standardLiving: getStandardLiving(1),
});
assert.equal(income.totals.totalExpense, 2_000_000);
assert.equal(income.totals.courtLiving, 1_538_543);
assert.equal(income.totals.disposable, 1_061_457);
assert.ok(income.items.some(item => item.level === 'ask' && /초과분/.test(item.detail)));

// 명목합계가 입력 재산보다 커도 청산가치 요건을 통과 판정하지 않는다.
const plan = NumCheck.rehabPlan({
  disposable: 1_061_457,
  months: 36,
  liquidationValue: 37_000_000,
  assets: [{ label: '입력 재산', amount: 37_000_000 }],
});
assert.equal(plan.totals.totalRepay, 38_212_452);
const liquidationReview = plan.items.find(item => /청산가치 요건 통과 여부/.test(item.title));
assert.ok(liquidationReview, '청산가치 현재가치 확인 항목이 있어야 한다');
assert.equal(liquidationReview.level, 'ask');
assert.ok(!plan.items.some(item => item.level === 'ok' && /청산가치.*(충족|통과)/.test(item.title)));

// 새 진단은 숨은 절차 점수·승자·필수 실제생활비를 계산하거나 저장하지 않는다.
for (const forbidden of ['calcScores', 'scoreToLevel', 'diagnosis_scores', 'diagnosis_levels', 'monthlyLiving', 'livingCost']) {
  assert.ok(!diagnosisSource.includes(forbidden), `진단 코드에 남으면 안 되는 값: ${forbidden}`);
}
for (const forbidden of ["Storage.load('diagnosis_scores')", "Storage.load('diagnosis_levels')", 'scoreTheme(', 'winnerType', '${th.text}']) {
  assert.ok(!resultSource.includes(forbidden), `결과 화면에 남으면 안 되는 점수 분기: ${forbidden}`);
}

console.log('legal regression tests passed');
