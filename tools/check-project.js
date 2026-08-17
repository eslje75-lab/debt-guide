/* 프레임워크 없는 챔로드의 공통 품질 게이트.
 * 외부 패키지를 설치하지 않고 JS 파일과 HTML 인라인 스크립트의 문법을 검사한다.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const failures = [];

function walk(relativeDirectory, extension) {
  const base = path.resolve(ROOT, relativeDirectory);
  const output = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.wrangler' || entry.name === 'dist') continue;
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (entry.isFile() && entry.name.endsWith(extension)) output.push(full);
    }
  };
  if (fs.existsSync(base)) visit(base);
  return output;
}

function checkJavaScript(file) {
  const checked = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (checked.status !== 0) {
    failures.push(`${path.relative(ROOT, file)}\n${checked.stderr || checked.stdout}`);
  }
}

function checkInlineScripts(file) {
  const html = fs.readFileSync(file, 'utf8');
  const pattern = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let match;
  let index = 0;
  while ((match = pattern.exec(html))) {
    index++;
    const attributes = match[1] || '';
    const source = match[2] || '';
    if (/\bsrc\s*=/i.test(attributes) || !source.trim()) continue;
    const type = attributes.match(/\btype\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase();
    if (type && !['text/javascript', 'application/javascript'].includes(type)) continue;
    try {
      new vm.Script(source, { filename: `${path.relative(ROOT, file)}#script-${index}` });
    } catch (error) {
      failures.push(String(error && error.stack ? error.stack : error));
    }
  }
}

for (const file of [
  ...walk('js', '.js'),
  ...walk('tools', '.js'),
  ...walk(path.join('api', 'src'), '.js'),
]) checkJavaScript(file);

for (const entry of fs.readdirSync(ROOT, { withFileTypes: true })) {
  if (entry.isFile() && entry.name.endsWith('.html')) checkInlineScripts(path.join(ROOT, entry.name));
}

if (failures.length) {
  console.error(`문법 검사 실패 ${failures.length}건\n\n${failures.join('\n\n')}`);
  process.exit(1);
}

console.log('프로젝트 문법 검사 통과');
