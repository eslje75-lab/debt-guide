/* 공개 정적 사이트 산출물 생성.
 *
 * 저장소 루트를 그대로 배포하면 api/, tools/, 운영 문서와 유료 콘텐츠 소스까지
 * 웹에서 내려받을 수 있다. 이 스크립트는 공개가 허용된 파일만 dist/로 복사한다.
 * GitHub Pages Actions 또는 Cloudflare Pages의 출력 디렉터리는 반드시 dist로 지정한다.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT = path.resolve(ROOT, 'dist');

const PUBLIC_FILES = [
  '404.html',
  'about.html',
  'admin.html',
  'ai-review.html',
  'apple-touch-icon.png',
  'bankruptcy-after.html',
  'bankruptcy.html',
  'CNAME',
  'compare.html',
  'diagnosis.html',
  'discharge.html',
  'documents.html',
  'favicon.ico',
  'favicon.svg',
  'find-account.html',
  'icon-192.png',
  'icon-512.png',
  'index.html',
  'login.html',
  'maintenance.html',
  'manifest.json',
  'mypage.html',
  'numcheck.html',
  'og-image.png',
  'pricing.html',
  'privacy.html',
  'rehabilitation.html',
  'reset-password.html',
  'resources.html',
  'result.html',
  'robots.txt',
  'setup.html',
  'sitemap.xml',
  'supplement.html',
  'terms.html',
  'verify-email.html',
  '_headers',
];
const PUBLIC_DIRECTORIES = ['css', 'js'];
const FORBIDDEN_TOP_LEVEL = ['api', 'tools', '.git', '.github', '.claude'];

function assertSafeOutput() {
  if (path.dirname(OUTPUT) !== ROOT || path.basename(OUTPUT) !== 'dist') {
    throw new Error(`안전하지 않은 출력 경로입니다: ${OUTPUT}`);
  }
}

function copyFile(relativePath) {
  const source = path.resolve(ROOT, relativePath);
  const destination = path.resolve(OUTPUT, relativePath);
  if (!source.startsWith(ROOT + path.sep) || !destination.startsWith(OUTPUT + path.sep)) {
    throw new Error(`허용 경계를 벗어난 파일입니다: ${relativePath}`);
  }
  const stat = fs.lstatSync(source);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error(`일반 파일만 배포할 수 있습니다: ${relativePath}`);
  }
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
}

function copyDirectory(relativePath) {
  const sourceRoot = path.resolve(ROOT, relativePath);
  const destinationRoot = path.resolve(OUTPUT, relativePath);
  if (!sourceRoot.startsWith(ROOT + path.sep) || !destinationRoot.startsWith(OUTPUT + path.sep)) {
    throw new Error(`허용 경계를 벗어난 디렉터리입니다: ${relativePath}`);
  }

  const visit = (source, destination) => {
    fs.mkdirSync(destination, { recursive: true });
    for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
      const childSource = path.join(source, entry.name);
      const childDestination = path.join(destination, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`심볼릭 링크는 배포하지 않습니다: ${childSource}`);
      if (entry.isDirectory()) visit(childSource, childDestination);
      else if (entry.isFile()) fs.copyFileSync(childSource, childDestination);
      else throw new Error(`지원하지 않는 파일 유형입니다: ${childSource}`);
    }
  };

  visit(sourceRoot, destinationRoot);
}

assertSafeOutput();
fs.rmSync(OUTPUT, { recursive: true, force: true });
fs.mkdirSync(OUTPUT, { recursive: true });

for (const file of PUBLIC_FILES) copyFile(file);
for (const directory of PUBLIC_DIRECTORIES) copyDirectory(directory);
fs.writeFileSync(path.join(OUTPUT, '.nojekyll'), '', 'utf8');

for (const forbidden of FORBIDDEN_TOP_LEVEL) {
  if (fs.existsSync(path.join(OUTPUT, forbidden))) {
    throw new Error(`금지된 경로가 공개 산출물에 포함됐습니다: ${forbidden}`);
  }
}

const published = fs.readdirSync(OUTPUT).sort();
console.log(`공개 산출물 생성 완료: ${OUTPUT}`);
console.log(`최상위 항목 ${published.length}개: ${published.join(', ')}`);
