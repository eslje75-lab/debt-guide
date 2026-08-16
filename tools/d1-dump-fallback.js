/* D1 덤프 — `wrangler d1 export`가 막혔을 때 쓰는 대체 경로.
 *
 * 왜 있나: `d1 export`가 간헐적으로 401 `Authentication error [code: 10000]`으로 실패한다
 * (2026-08-16 관측 — 한 번 실패한 뒤 같은 OAuth 토큰으로 다시 하니 정상 성공했다. 원인 미확정).
 * 같은 시각에도 `d1 execute --remote --command`는 계속 정상이었으므로, 그 경로로
 * 전 테이블을 SELECT해 INSERT 문으로 되만든다. **백업이 없는 날을 만들지 않는 것**이 목적이다.
 *
 * 🔴 이건 차선책이다. 정식 export가 되면 그쪽을 쓴다(backup-d1.ps1이 알아서 판단).
 *    export가 반복해서 실패하면 D1 권한이 있는 API 토큰을 넣어 보라 — BACKUP.md 「백업 토큰」 절.
 *
 * 정식 export와 다른 점:
 *   - 스키마는 export가 만들어 주지만 여기서는 **api/schema.sql을 그대로 앞에 붙인다.**
 *     따라서 이 덤프도 빈 DB에 그대로 넣으면 복원된다(복구 리허설로 확인할 것).
 *   - 뷰·트리거·시퀀스 등 schema.sql에 없는 객체는 담기지 않는다. 지금 스키마엔 없다.
 *
 * 사용: node tools/d1-dump-fallback.js <tables.json> <rows.json> <schema.sql> <out.sql>
 *   tables.json : [{name}] 또는 ["이름"] — wrangler --json의 results
 *   rows.json   : wrangler --json 응답 배열(테이블 순서와 1:1로 대응해야 한다)
 */
const fs = require('fs');

const [, , tablesPath, rowsPath, schemaPath, outPath] = process.argv;
if (!tablesPath || !rowsPath || !schemaPath || !outPath) {
  console.error('사용: node tools/d1-dump-fallback.js <tables.json> <rows.json> <schema.sql> <out.sql>');
  process.exit(2);
}

// PowerShell이 UTF-8 BOM으로 쓰는 경우가 있어 벗겨 낸다.
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8').replace(/^﻿/, ''));

const rawTables = readJson(tablesPath);
const tableNames = rawTables.map(t => (typeof t === 'string' ? t : t.name));
const rawSets = readJson(rowsPath);

const schemaText = fs.readFileSync(schemaPath, 'utf8').replace(/^﻿/, '');

/* 🔴 INSERT 순서를 알파벳 순으로 두면 복원이 깨진다.
   `ai_usage.user_id`가 `users(id)`를 참조하는데 a가 u보다 먼저라 부모 없는 자식을 넣게 되고,
   복원이 `FOREIGN KEY constraint failed`로 멈춘다(2026-08-16 복구 리허설에서 실제로 잡혔다).
   schema.sql은 부모 표를 먼저 선언하므로 **그 선언 순서**를 그대로 따른다.
   schema.sql에 없는 표(마이그레이션만 하고 반영을 잊은 것)는 뒤로 보내되 경고를 남긴다. */
const declOrder = [...schemaText.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g)].map(m => m[1]);
const orderOf = (t) => { const i = declOrder.indexOf(t); return i < 0 ? Number.MAX_SAFE_INTEGER : i; };

const unknown = tableNames.filter(t => orderOf(t) === Number.MAX_SAFE_INTEGER);
if (unknown.length) {
  console.warn(`⚠️ schema.sql에 없는 표: ${unknown.join(', ')} — 스키마 파일에 반영하세요.`);
  console.warn('   (이 덤프의 스키마 절에도 안 들어가므로 그 표는 복원되지 않습니다.)');
}

// 이름과 결과를 짝지어 함께 정렬한다 — 따로 정렬하면 남의 데이터를 남의 이름으로 저장하게 된다.
const paired = tableNames
  .map((name, i) => ({ name, rows: (rawSets[i] && rawSets[i].results) || [] }))
  .sort((a, b) => orderOf(a.name) - orderOf(b.name));
const tables = paired.map(p => p.name);
const sets = paired.map(p => ({ results: p.rows }));

// 순서가 어긋나면 남의 테이블 데이터를 남의 이름으로 저장하게 된다 — 조용히 넘어가면 안 된다.
if (rawSets.length !== tableNames.length) {
  console.error(`결과 수(${rawSets.length})와 테이블 수(${tableNames.length})가 다릅니다. 덤프를 만들지 않습니다.`);
  process.exit(1);
}

const lit = (v) => {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? '1' : '0';
  // D1의 BLOB은 JSON에서 숫자 배열로 온다. 현재 스키마엔 BLOB이 없지만 생기면 여기서 걸러야 한다.
  if (Array.isArray(v)) throw new Error('BLOB 컬럼은 이 대체 덤프가 지원하지 않습니다 — 정식 export를 쓰세요.');
  return "'" + String(v).replace(/'/g, "''") + "'";
};

const out = [
  '-- 챔로드 D1 덤프 (대체 경로 · d1-dump-fallback.js)',
  `-- 생성: ${new Date().toISOString()}`,
  '-- ⚠️ 회원 이메일·비밀번호 해시·전화번호·민감정보 동의 기록·결제 내역이 들어 있다.',
  '--    저장소 안에 두지 말 것. 보관 기간이 지나면 지울 것.',
  '-- ⚠️ `wrangler d1 export`가 실패해 SELECT로 되만든 덤프다(대체 경로).',
  '--    스키마는 api/schema.sql을 그대로 붙였다 — 빈 DB에 이 파일 하나로 복원된다.',
  '',
  '-- ── 스키마 (api/schema.sql) ──',
  schemaText.trimEnd(),
  '',
  '-- ── 데이터 ──',
  '',
];

let total = 0;
tables.forEach((t, i) => {
  const rows = (sets[i] && sets[i].results) || [];
  out.push(`-- ${t}: ${rows.length}행`);
  total += rows.length;
  for (const r of rows) {
    const cols = Object.keys(r);
    if (!cols.length) continue;
    out.push(`INSERT INTO "${t}" (${cols.map(c => `"${c}"`).join(', ')}) VALUES (${cols.map(c => lit(r[c])).join(', ')});`);
  }
  out.push('');
});

fs.writeFileSync(outPath, out.join('\n'), 'utf8');
console.log(`대체 덤프 생성: 테이블 ${tables.length}개 / ${total}행`);
