// 闸门：client/ 全部 ESM 具名 import 与源文件 export 静态核对
// 背景：node --check 只查语法不查模块链接，kniuui.mjs 缺 named export 曾在运行时炸
// （[route] render failed: ... does not provide an export named 'createRowDeleteHandler'）。
// 本闸门零依赖、纯静态，链接类断链在构建前暴露。
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';

const ROOT = resolve(process.cwd(), 'client');
const SKIP_DIRS = new Set(['node_modules', 'dist']);
const EXTS = ['.js', '.mjs'];

function walk(dir, out) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(mjs|js)$/.test(name)) out.push(p);
  }
  return out;
}

// 解析 import 路径到实际文件；返回 null 表示无法解析（视为通过，交给构建器）
function resolveModule(fromFile, spec) {
  if (!spec.startsWith('.') && !spec.startsWith('/')) return null; // 裸包名跳过
  const base = resolve(dirname(fromFile), spec);
  if (existsSync(base) && statSync(base).isFile()) return base;
  for (const ext of EXTS) {
    if (existsSync(base + ext)) return base + ext;
  }
  return null;
}

// 提取源文件具名 export 清单（含 re-export）；必须先去行注释——declRe 无行首锚定，
// 注释掉的旧导出（如 // export function foo）否则会被误计为存在（假阴性断链）
function extractExports(rawSource) {
  const source = stripLineComments(rawSource);
  const names = new Set();
  let hasDefault = false;
  // export function/async function/class/const/let/var NAME
  const declRe = /export\s+(?:async\s+)?(?:function|class|const|let|var)\s+([A-Za-z_$][\w$]*)/g;
  let m;
  while ((m = declRe.exec(source))) names.add(m[1]);
  // export default
  if (/export\s+default\b/.test(source)) hasDefault = true;
  // export { a, b as c } 或 export { a, b } from 'x'（多行兼容）
  const braceRe = /export\s*\{([^}]*)\}(?:\s*from\s*['"]([^'"]+)['"])?/g;
  while ((m = braceRe.exec(source))) {
    if (m[2]) continue; // re-export 只暴露到外部消费者经本文件路径引用时——本文件即入口，仍算导出
    for (const part of m[1].split(',')) {
      const seg = part.trim();
      if (!seg) continue;
      const asMatch = seg.match(/as\s+([A-Za-z_$][\w$]*)\s*$/);
      const name = asMatch ? asMatch[1] : seg.split(/\s+as\s+/)[0].trim();
      if (/^[A-Za-z_$][\w$]*$/.test(name)) names.add(name);
    }
  }
  // export { ... } from 'x' 的导出名同样对外可见
  const reexportRe = /export\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g;
  while ((m = reexportRe.exec(source))) {
    for (const part of m[1].split(',')) {
      const seg = part.trim();
      if (!seg) continue;
      const asMatch = seg.match(/as\s+([A-Za-z_$][\w$]*)\s*$/);
      if (asMatch) names.add(asMatch[1]);
      else names.add(seg.split(/\s+as\s+/)[0].trim());
    }
  }
  return { names, hasDefault };
}

function stripLineComments(src) {
  // 粗粒度去行注释（模板字符串内的 // 极少出现在 import 邻近行；保守处理）
  return src.replace(/^\s*\/\/.*$/gm, '');
}

const files = walk(ROOT, []);
const failures = [];
let checked = 0;

for (const file of files) {
  const src = stripLineComments(readFileSync(file, 'utf8'));
  // 匹配 named import（含多行、混合 default）
  const importRe = /import\s+(?:([A-Za-z_$][\w$]*)\s*,\s*)?\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]|import\s+([A-Za-z_$][\w$]*)\s+from\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = importRe.exec(src))) {
    const namedPart = m[2];
    const defaultName = m[1] || m[4];
    const spec = m[3] || m[5];
    if (spec.includes('?')) continue; // css?module 等通道标记
    const target = resolveModule(file, spec);
    if (!target) continue;
    if (target === file) continue;
    let source;
    try { source = readFileSync(target, 'utf8'); } catch (e) {
      failures.push(`${file}: 无法读取模块 ${spec}（${e.message}）`);
      continue;
    }
    const { names, hasDefault } = extractExports(source);
    if (defaultName && !hasDefault) {
      failures.push(`${file}: default 导入 '${defaultName}' 但 ${spec} 无 export default`);
    }
    if (namedPart) {
      for (const raw of namedPart.split(',')) {
        const seg = raw.trim();
        if (!seg) continue;
        const asMatch = seg.match(/as\s+([A-Za-z_$][\w$]*)\s*$/);
        const imported = seg.split(/\s+as\s+/)[0].trim();
        if (!/^[A-Za-z_$][\w$]*$/.test(imported)) continue;
        checked++;
        if (!names.has(imported)) {
          failures.push(`${file}: 具名导入 '${imported}' 在 ${spec.replace(/^.*[\\/]client[\\/]/, 'client/')} 中不存在${asMatch ? '（as ' + asMatch[1] + '）' : ''}`);
        }
      }
    }
  }
}

if (failures.length) {
  console.log(`[check_named_imports] FAIL：${failures.length} 处链接断点`);
  for (const f of failures) console.log('  - ' + f);
  process.exit(1);
}
console.log(`[check_named_imports] PASS：client/ 全部具名/默认导入与源模块 export 匹配（核对 ${checked} 个具名导入）`);