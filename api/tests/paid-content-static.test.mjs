import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { DOC_EXAMPLES as MAINTAIN_DOCS, STEPS as MAINTAIN_STEPS } from '../src/content/maintain-steps.js';
import { DOC_EXAMPLES as SUPP_BANKRUPT_DOCS, STEPS as SUPP_BANKRUPT_STEPS } from '../src/content/supplement-bankrupt-steps.js';
import { DOC_EXAMPLES as SUPP_REHAB_DOCS, STEPS as SUPP_REHAB_STEPS } from '../src/content/supplement-rehab-steps.js';

const root = new URL('../../', import.meta.url);

async function read(relative) {
  return readFile(new URL(relative, root), 'utf8');
}

function protectedDetailStrings(steps, docs) {
  const strings = [];
  for (const step of steps) {
    if (step.example && step.example.content) strings.push(step.example.content);
    for (const item of step.items || []) {
      if (item.guide) strings.push(item.guide);
      if (item.ex && item.ex.content) strings.push(item.ex.content);
    }
  }
  for (const doc of docs) if (doc.html) strings.push(doc.html);
  return strings;
}

function assertProtectedDetailsAbsent(html, steps, docs, page) {
  const protectedStrings = protectedDetailStrings(steps, docs);
  assert.ok(protectedStrings.length > 0, `${page} protected-content fixture is empty`);
  for (const detail of protectedStrings) {
    assert.equal(html.includes(detail), false, `${page} contains a paid guide/example/html body`);
  }
}

test('maintenance public HTML contains only the free first guide, not paid detail or forms', async () => {
  const [html, module] = await Promise.all([
    read('maintenance.html'),
    read('api/src/content/maintain-steps.js'),
  ]);

  const paidMarkers = [
    '인가된 변제계획의 변경(인가)을 구합니다.',
    '채무자가 책임질 수 없는 사유로 변제를 완료하지 못했을 것',
    '이해관계인의 의견을 들은 뒤 면책 여부를 결정합니다.',
  ];
  for (const marker of paidMarkers) {
    assert.equal(html.includes(marker), false, `maintenance.html leaked: ${marker}`);
    assert.equal(module.includes(marker), true, `maintain module lost: ${marker}`);
  }
  assertProtectedDetailsAbsent(html, MAINTAIN_STEPS, MAINTAIN_DOCS, 'maintenance.html');
  assert.equal(html.includes('const MAINTAIN_STEPS = ['), false);
  assert.equal(html.includes('const DOC_EXAMPLES = ['), false);
  assert.match(html, /type:\s*'maintain'/);
  assert.match(html, /consentVersion:\s*'content-open-v1'/);
});

test('supplement public HTML contains only first-step previews, not paid response guides/forms', async () => {
  const [html, rehabModule, bankruptModule] = await Promise.all([
    read('supplement.html'),
    read('api/src/content/supplement-rehab-steps.js'),
    read('api/src/content/supplement-bankrupt-steps.js'),
  ]);

  const paidMarkers = [
    '채무자 김○민은 2025. 11. 10.',
    '채무자 박○수는 ○○은행 계좌에서 2025. 10. 15.',
    '요구사항 번호 순서 그대로 답변',
  ];
  for (const marker of paidMarkers) {
    assert.equal(html.includes(marker), false, `supplement.html leaked: ${marker}`);
  }
  assert.equal(rehabModule.includes(paidMarkers[0]), true);
  assert.equal(bankruptModule.includes(paidMarkers[1]), true);
  assert.equal(rehabModule.includes(paidMarkers[2]), true);
  assertProtectedDetailsAbsent(html, SUPP_REHAB_STEPS, SUPP_REHAB_DOCS, 'supplement.html (rehab)');
  assertProtectedDetailsAbsent(html, SUPP_BANKRUPT_STEPS, SUPP_BANKRUPT_DOCS, 'supplement.html (bankrupt)');
  assert.equal(html.includes('const SUPP_STEPS = ['), false);
  assert.equal(html.includes('const DOC_EXAMPLES = ['), false);
  assert.match(html, /'supplement-bankrupt'\s*:\s*'supplement-rehab'/);
  assert.match(html, /consentVersion:\s*'content-open-v1'/);
});

test('paid-content pages do not fetch content from initial render or gate callbacks', async () => {
  for (const page of ['maintenance.html', 'supplement.html']) {
    const html = await read(page);
    const initialTail = html.slice(html.lastIndexOf('renderSteps();'));
    assert.equal(initialTail.includes('loadPaidContent()'), false, `${page} auto-loads at startup`);

    const gateStart = html.lastIndexOf("document.addEventListener('chamroad:gate'");
    const gateBody = html.slice(gateStart);
    assert.ok(gateStart >= 0, `${page} gate handler missing`);
    assert.equal(gateBody.includes('openPaidContent()'), false, `${page} auto-opens from gate event`);
    assert.equal(gateBody.includes('loadPaidContent()'), false, `${page} auto-loads from gate event`);
  }
});
