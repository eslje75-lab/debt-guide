// 로컬 미리보기 서버 (포트 3456)
//
// 왜 3456인가: Worker의 CORS 허용 목록(api/src/index.js ALLOWED_ORIGINS)에 이 주소가
// 들어 있어서, 로컬 화면에서 운영 API를 그대로 호출해 볼 수 있다.
// 기본 API 대상은 wrangler dev(:8787)이며, 운영 API로 붙으려면 주소에 ?api=prod 를 한 번 붙인다
// (js/main.js API_BASE 주석 참조).
//
// 실행: node tools/serve.js             → 소스 미리보기
//       node tools/serve.js --public    → dist/ 공개 산출물 미리보기(build-public.js 선행)
// 저장소 기준 상대경로만 쓰므로 PC를 바꿔도 그대로 동작한다.

const http = require('http');
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const ROOT = process.argv.includes('--public') ? path.join(PROJECT_ROOT, 'dist') : PROJECT_ROOT;
const PORT = 3456;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

if (!fs.existsSync(ROOT)) {
  console.error(`미리보기 경로가 없습니다: ${ROOT}`);
  console.error('--public 사용 전 node tools/build-public.js를 실행하세요.');
  process.exit(1);
}

http.createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split('?')[0]);
  if (rel === '/') rel = '/index.html';
  const file = path.join(ROOT, rel.replace(/^\/+/, ''));
  // 저장소 밖 경로 접근 차단
  const relative = path.relative(ROOT, file);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    res.writeHead(403).end('forbidden');
    return;
  }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('404'); return; }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      // 캐시 금지 — 고친 파일이 바로 보이지 않으면 원인 진단이 꼬인다
      'Cache-Control': 'no-store, must-revalidate',
    });
    res.end(buf);
  });
}).listen(PORT, () => console.log(`http://localhost:${PORT} (${ROOT})`));
