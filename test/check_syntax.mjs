import { readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const targets = [
  join(root, 'bin'),
  join(root, 'templates', 'kniu-project-spa', 'client'),
  join(root, 'templates', 'kniu-project-spa', 'kniu.config.js')
];
const files = [];

function collect(path) {
  const info = statSync(path);
  if (info.isFile()) {
    if (/\.(?:mjs|js)$/.test(path)) files.push(path);
    return;
  }
  for (const entry of readdirSync(path)) {
    const child = join(path, entry);
    if (entry === 'node_modules' || entry === 'dist') continue;
    collect(child);
  }
}

targets.forEach(collect);
let failed = 0;
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    failed += 1;
    console.error(`[check] ${relative(root, file)}: ${result.stderr.trim()}`);
  }
}
if (failed) {
  console.error(`[check] 语法检查失败：${failed}/${files.length}`);
  process.exit(1);
}
console.log(`[check] 语法检查通过：${files.length} 个文件`);
