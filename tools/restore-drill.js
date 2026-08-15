// D1 백업 복구 리허설 — 덤프를 격리된 임시 SQLite에 실제로 복원해 본다.
//
// 사용:  node tools/restore-drill.js <덤프.sql>
//
// 왜 필요한가: 받아만 두고 복원해 본 적 없는 백업은 백업이 아니다.
// 운영 DB(--remote)도, 로컬 개발 상태(api/.wrangler)도 건드리지 않고 임시 파일에서만 검증한다.
// ⚠️ 행의 '내용'은 절대 출력하지 않는다 — 개인정보이므로 테이블별 '건수'만 센다.
// Node 22.5+ 내장 node:sqlite를 쓴다(설치 불필요).

const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const os = require('os');
const path = require('path');

const dump = process.argv[2];
if (!dump || !fs.existsSync(dump)) {
  console.error('사용법: node tools/restore-drill.js <덤프.sql>');
  process.exit(2);
}

const tmp = path.join(os.tmpdir(), `d1-restore-drill-${process.pid}.db`);
let db, failed = 0;
try {
  db = new DatabaseSync(tmp);
  db.exec(fs.readFileSync(dump, 'utf8'));   // 덤프 전체 실행 — 여기서 깨지면 그 백업은 못 쓴다
  console.log('복원 실행: 성공 (덤프 전체가 오류 없이 적용됨)');

  const tables = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
  ).all();
  console.log(`복원된 테이블: ${tables.length}개`);

  let total = 0;
  for (const t of tables) {
    const n = db.prepare(`SELECT COUNT(*) AS c FROM "${t.name}"`).get().c;
    total += n;
    console.log(`  ${t.name.padEnd(22)} ${String(n).padStart(5)}행`);
  }
  console.log(`합계 ${total}행`);

  // 핵심 테이블 존재 확인 — 이름만 본다
  const must = ['users', 'payments', 'entitlements', 'withdrawal_requests'];
  const missing = must.filter(m => !tables.some(t => t.name === m));
  if (missing.length) { failed = 1; console.log(`  X 핵심 테이블 누락: ${missing.join(', ')}`); }
  else console.log('핵심 테이블(users·payments·entitlements·withdrawal_requests) 모두 복원됨');
} catch (e) {
  failed = 1;
  console.log(`  X 복원 실패: ${e.message}`);
} finally {
  try { db && db.close(); } catch {}
  try { fs.unlinkSync(tmp); console.log('임시 DB 삭제 완료'); } catch {}
}
process.exit(failed);
