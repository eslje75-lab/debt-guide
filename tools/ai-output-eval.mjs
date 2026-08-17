/* AI 출력 평가 실행기 — 가상 초안을 실제 Anthropic API에 보내 금지선을 지키는지 잰다.
 *
 * 🔴 이 도구는 **돈이 나가고 네트워크로 나간다.** 그래서 품질 게이트(quality-gate.yml)에 넣지 않았다.
 *    사람이 필요할 때만 부른다. 초안 1건당 대략 58원(2026-08 기준, 9월부터 1.5배).
 *
 * 사용법 (저장소 루트에서):
 *   node tools/ai-output-eval.mjs                 전체 30건 실행
 *   node tools/ai-output-eval.mjs --group injection   인젝션 케이스만
 *   node tools/ai-output-eval.mjs --case inj-01-canary직접
 *   node tools/ai-output-eval.mjs --limit 5        앞에서 5건만 (비용 확인용)
 *   node tools/ai-output-eval.mjs --rejudge        저장된 출력만 다시 판정 (API 호출 없음, 무료)
 *
 * 키: api/.dev.vars의 ANTHROPIC_API_KEY 주석을 풀거나 환경변수 ANTHROPIC_API_KEY로 준다.
 *     ⚠️운영과 같은 키를 쓰면 실제 선불 잔액에서 빠진다.
 *
 * 결과: ai-eval-results/<타임스탬프>.json 에 저장한다(.gitignore 대상).
 *       --rejudge가 그 파일을 다시 읽으므로, 판정 규칙을 고친 뒤 재판정은 공짜다.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { maskIdNumbers, callClaude } from '../api/src/index.js';
import { CASES } from './ai-eval-cases.mjs';
import { judge } from './ai-eval-judge.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'ai-eval-results');

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? null : (process.argv[i + 1] ?? true);
}

// .dev.vars는 KEY=VALUE 한 줄씩. 주석(#)은 건너뛴다. 값은 절대 로그로 내보내지 않는다.
function readDevVar(name) {
  const file = path.join(ROOT, 'api', '.dev.vars');
  if (!fs.existsSync(file)) return null;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq > 0 && trimmed.slice(0, eq).trim() === name) return trimmed.slice(eq + 1).trim();
  }
  return null;
}

function selectCases() {
  let list = CASES;
  const one = arg('case');
  const group = arg('group');
  const limit = arg('limit');
  if (one) list = list.filter(c => c.id === one);
  if (group) list = list.filter(c => c.group === group);
  if (limit) list = list.slice(0, Number(limit));
  return list;
}

function summarize(results) {
  const high = [];
  const warn = [];
  for (const r of results) {
    for (const f of r.findings) (f.severity === 'high' ? high : warn).push({ case: r.id, ...f });
  }
  const failedCases = new Set(high.map(f => f.case));
  const errored = results.filter(r => r.error);

  console.log('\n' + '='.repeat(72));
  console.log(`검사 ${results.length}건 · 호출 실패 ${errored.length}건`);
  console.log(`🔴 high ${high.length}건 (케이스 ${failedCases.size}개) · 🟡 warn ${warn.length}건`);
  console.log('='.repeat(72));

  const byGroup = {};
  for (const r of results) {
    const g = (byGroup[r.group] ||= { total: 0, failed: 0 });
    g.total++;
    if (r.findings.some(f => f.severity === 'high')) g.failed++;
  }
  console.log('\n[그룹별 high 검출]');
  for (const [g, v] of Object.entries(byGroup)) console.log(`  ${g.padEnd(10)} ${v.failed}/${v.total}`);

  for (const [label, list] of [['🔴 HIGH', high], ['🟡 WARN', warn]]) {
    if (!list.length) continue;
    console.log(`\n[${label}]`);
    for (const f of list) {
      console.log(`  ${f.case}  ${f.rule}  ${f.path}`);
      console.log(`    ${f.ban}`);
      console.log(`    → ${JSON.stringify(f.excerpt)}`);
    }
  }

  if (errored.length) {
    console.log('\n[호출 실패]');
    for (const r of errored) console.log(`  ${r.id}: ${r.error}`);
  }

  console.log(`\n⚠️ 기계 검사는 선별기다. high 항목은 원문을 사람이 확인하고, 통과분도 안전 증명이 아니다.`);
  console.log(`   특히 '추측으로 사실 만들기'(금지 5)는 초안과 대조해야 알 수 있어 거의 못 잡는다.\n`);
  return high.length;
}

async function main() {
  // ── 재판정 모드: 저장된 출력만 다시 본다. 판정 규칙을 고친 뒤 쓰는 무료 경로다.
  if (arg('rejudge')) {
    const file = typeof arg('rejudge') === 'string' ? arg('rejudge')
      : fs.existsSync(OUT_DIR)
        ? path.join(OUT_DIR, fs.readdirSync(OUT_DIR).filter(f => f.endsWith('.json')).sort().pop() || '')
        : '';
    if (!file || !fs.existsSync(file)) {
      console.error('재판정할 결과 파일이 없다. 먼저 API 호출로 한 번 돌릴 것.');
      process.exit(2);
    }
    console.log(`재판정: ${path.relative(ROOT, file)} (API 호출 없음)`);
    const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
    const results = saved.results.map(r => {
      const caseDef = CASES.find(c => c.id === r.id);
      return { ...r, findings: r.review && caseDef ? judge(caseDef, r.review) : r.findings };
    });
    process.exit(summarize(results) ? 1 : 0);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY || readDevVar('ANTHROPIC_API_KEY');
  if (!apiKey) {
    console.error(`ANTHROPIC_API_KEY가 없다.
  · api/.dev.vars의 "# ANTHROPIC_API_KEY=..." 주석을 풀고 실제 키를 넣거나
  · ANTHROPIC_API_KEY 환경변수로 준다.
⚠️ 운영과 같은 키를 쓰면 실제 선불 잔액에서 빠진다.`);
    process.exit(2);
  }

  const cases = selectCases();
  if (!cases.length) { console.error('선택된 케이스가 없다.'); process.exit(2); }
  // ⚠️OPERATIONS-COST.md의 "검토 1건 58원"은 이용자가 20,000자 서류를 넣는 최악 기준이다.
  //   여기 초안은 200~500자라 훨씬 싸다. 과다 표기하면 사람이 실행을 미루게 되므로 실제 범위로 적는다.
  const low = Math.round(cases.length * 13);
  const high = Math.round(cases.length * 23);
  console.log(`실행 ${cases.length}건 — 예상 비용 대략 ${low.toLocaleString()}~${high.toLocaleString()}원`);
  console.log(`  (평가용 초안은 200~500자로 짧다. 실제 이용자의 20,000자 서류는 건당 58원까지 간다.)`);
  console.log(`  ⚠️2026-08-31 Anthropic 인트로 요금 종료 후에는 1.5배.\n`);

  const results = [];
  for (const c of cases) {
    // handleAiReview와 같은 순서로: 마스킹 먼저, 그다음 callClaude.
    const text = maskIdNumbers(c.text);
    process.stdout.write(`  ${c.id.padEnd(24)} `);
    try {
      const review = await callClaude(apiKey, c.docLabel, c.checklist || [], text, null);
      const findings = judge(c, review);
      results.push({ id: c.id, group: c.group, review, findings });
      const high = findings.filter(f => f.severity === 'high').length;
      const warn = findings.length - high;
      console.log(high ? `🔴 high ${high}${warn ? ` · warn ${warn}` : ''}` : warn ? `🟡 warn ${warn}` : '✔');
    } catch (e) {
      results.push({ id: c.id, group: c.group, review: null, findings: [], error: e.message });
      console.log(`✖ ${e.message}`);
    }
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  // Date.now()로 파일명을 만든다. 결과에 개인정보는 없지만(가상 초안) 저장소에는 커밋하지 않는다.
  const outFile = path.join(OUT_DIR, `${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(outFile, JSON.stringify({ ranAt: new Date().toISOString(), results }, null, 2), 'utf8');
  console.log(`\n결과 저장: ${path.relative(ROOT, outFile)}`);

  process.exit(summarize(results) ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
