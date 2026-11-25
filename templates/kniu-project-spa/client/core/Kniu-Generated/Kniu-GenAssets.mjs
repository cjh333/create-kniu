import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve, relative, sep, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const CORE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = resolve(CORE_DIR, '..', '..');
const CLIENT_DIR = join(ROOT, 'client');
const OUT_DIR = join(CORE_DIR, 'Kniu-Generated');
const SKIP_DIRS = new Set(['dist', 'public', 'node_modules', 'Kniu-Generated', 'generated']);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, out);
    else if (/\.(?:mjs|js)$/.test(name)) out.push(full);
  }
  return out;
}

function resolveCaseInsensitive(file) {
  if (existsSync(file)) return file;
  const dir = dirname(file);
  if (!existsSync(dir)) return null;
  const wanted = basename(file).toLowerCase();
  const found = readdirSync(dir).find((name) => name.toLowerCase() === wanted);
  return found ? join(dir, found) : null;
}

function toKey(file) {
  return relative(ROOT, file).split(sep).join('/');
}

const IMPORT_RE = /from\s*['"]([^'"?]+)\?module['"]/g;
const groups = { css: new Map(), html: new Map(), other: new Map() };
let importCount = 0;
let missing = 0;

for (const source of walk(CLIENT_DIR)) {
  const text = readFileSync(source, 'utf8');
  IMPORT_RE.lastIndex = 0;
  let match;
  while ((match = IMPORT_RE.exec(text)) !== null) {
    importCount += 1;
    const spec = match[1];
    const file = resolveCaseInsensitive(resolve(dirname(source), spec));
    if (!file) { missing += 1; continue; }
    const ext = (spec.split('?')[0].match(/\.([a-z0-9]+)$/i)?.[1] || '').toLowerCase();
    const bucket = ext === 'css' ? groups.css : ext === 'html' ? groups.html : groups.other;
    bucket.set(toKey(file), readFileSync(file, 'utf8'));
  }
}

mkdirSync(OUT_DIR, { recursive: true });

function emit(fileName, label, bucket) {
  const entries = [...bucket.entries()].sort(([a], [b]) => a.localeCompare(b));
  const body = entries
    .map(([key, value]) => `  ${JSON.stringify(key)}: ${JSON.stringify(value)}`)
    .join(',\n');
  const content = `export const ${label} = Object.freeze({\n${body}\n});\n`
    + `export function get${label[0].toUpperCase()}${label.slice(1)}(path) { return ${label}[path]; }\n`
    + `export const ${label}Paths = Object.freeze(Object.keys(${label}));\n`;
  writeFileSync(join(OUT_DIR, fileName), content);
  return entries.length;
}

const cssCount = emit('Kniu-GenStyles.mjs', 'styles', groups.css);
const htmlCount = emit('Kniu-GenTemplate.mjs', 'templates', groups.html);
const STYLES_MODULE = '.' + '/Kniu-GenStyles.mjs';
const TEMPLATES_MODULE = '.' + '/Kniu-GenTemplate.mjs';
const index = `export { styles, getStyles, stylesPaths } from ${JSON.stringify(STYLES_MODULE)};\n`
  + `export { templates, getTemplates, templatesPaths } from ${JSON.stringify(TEMPLATES_MODULE)};\n`
  + `import { styles } from ${JSON.stringify(STYLES_MODULE)};\n`
  + `import { templates } from ${JSON.stringify(TEMPLATES_MODULE)};\n`
  + `export function getAsset(path) { return styles[path] ?? templates[path] ?? undefined; }\n`
  + `export const assetPaths = Object.freeze([...Object.keys(styles), ...Object.keys(templates)]);\n`;
writeFileSync(join(OUT_DIR, 'Kniu-GenIndex.mjs'), index);

if (missing) {
  console.error(`[Kniu-GenAssets] 有 ${missing} 处 ?module 资源找不到磁盘文件，请核对大小写。`);
  process.exitCode = 1;
} else {
  console.log(`[Kniu-GenAssets] 扫描 ${importCount} 处 ?module 导入 -> styles ${cssCount} / templates ${htmlCount}，输出 client/core/Kniu-Generated`);
}