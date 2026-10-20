// 规则 #222 守卫：模板表达式（{{...}}）不得引用浏览器/Node 全局对象与函数。
// 背景：makeScope 原先在 state 未命中键时回退 globalThis，形成隐式全局可达面；
//       2026-10-18 已切断回退（未命中一律静默空串），本闸门防止新增依赖回退的写法。
// 说明：GLOBAL_NAMES 是「已知高危集合」而非完备清单——漏网的新全局名不会被捕获，
//       但清单内的命中一律视为违规（无合法场景）。
// 用法：node test/check_scope_globals.mjs
// 退出码：0=通过；1=发现全局引用命中。
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/** 高危全局名：模板表达式里出现即视为依赖 globalThis 回退。 */
const GLOBAL_NAMES = new Set([
  // 浏览器全局对象
  'window', 'document', 'location', 'navigator', 'history', 'screen', 'frames',
  'localStorage', 'sessionStorage', 'indexedDB', 'caches', 'crypto', 'performance',
  'top', 'parent', 'self', 'globalThis', 'opener',
  // 浏览器全局函数
  'fetch', 'alert', 'confirm', 'prompt', 'open', 'close', 'postMessage',
  'requestAnimationFrame', 'cancelAnimationFrame', 'getComputedStyle',
  'addEventListener', 'removeEventListener', 'dispatchEvent',
  'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
  'encodeURIComponent', 'decodeURIComponent', 'encodeURI', 'decodeURI',
  'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'btoa', 'atob',
  'structuredClone', 'queueMicrotask',
  // 内置构造器（原型链污染面）
  'Object', 'Array', 'String', 'Number', 'Boolean', 'Date', 'RegExp', 'Error',
  'Function', 'Symbol', 'BigInt', 'Map', 'Set', 'WeakMap', 'WeakSet',
  'Promise', 'Proxy', 'Reflect', 'JSON', 'Math', 'Intl', 'ArrayBuffer',
  // Node 全局
  'process', 'require', 'module', 'exports', '__dirname', '__filename', 'Buffer',
  'console',
]);

function walk(dir, out = [], exts) {
  if (!statSync(dir, { throwIfNoEntry: false })) return out;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out, exts);
    else if (exts.some((e) => name.endsWith(e))) out.push(full);
  }
  return out;
}

/**
 * 剔除字符串字面量与注释，避免 'document' 这类 icon 名被误报。
 * 返回仅含「可执行代码部分」的字符串，标识符位置整体保留（用等长空格填充）。
 */
function stripLiterals(expr) {
  let out = '';
  let i = 0;
  while (i < expr.length) {
    const ch = expr[i];
    if (ch === "'" || ch === '"' || ch === '`') {
      const close = ch;
      out += ' '.repeat(1);
      i++;
      while (i < expr.length && expr[i] !== close) {
        out += ' ';
        if (expr[i] === '\\') { out += ' '; i++; }
        i++;
      }
      out += ' ';
      i++;
      continue;
    }
    out += ch;
    i++;
  }
  return out;
}

/**
 * 提取「引用形态」的标识符：
 *  - 取属性访问的根（a.length -> a；Math.max -> Math）
 *  - 跳过对象字面量的键（{icon:'x'} 的 icon：后跟 ':' 且前一个非空 token 是 '{' 或 ','）
 */
/**
 * 已登记为「控制器 state 键」的全局同名标识符。
 * 裸标识符（{{history}}）静态上无法区分 state 键与全局引用，故显式登记；
 * 登记必须附控制器依据。未登记的裸命中一律 FAIL。
 * 键 = 视图相对路径，值 = Set(全局名)。
 */
const SHADOWED_BY_STATE = new Map([
  // profileController.js:22 `history: []` —— 浏览历史列表（state 键），非 window.history
  ['client/views/index/profile.html', new Set(['history'])],
]);

function extractRefIdentifiers(code) {
  const refs = [];
  const re = /[A-Za-z_$][\w$]*/g;
  let m;
  while ((m = re.exec(code))) {
    const name = m[0];
    const before = code.slice(0, m.index).replace(/\s+$/, '');
    // 属性访问中段：a.length 的 length（前面是 '.'）
    if (before.endsWith('.')) continue;
    // 对象字面量键：{ icon: ... } / , style: ...（前面是 '{' 或 ','，后面是 ':'）
    const after = code.slice(m.index + name.length).replace(/^\s+/, '');
    if (after.startsWith(':') && (before === '' || before.endsWith('{') || before.endsWith(','))) continue;
    refs.push({ name, index: m.index });
  }
  return refs;
}

const files = [
  ...walk(join(ROOT, 'client', 'views'), [], ['.html']),
  ...walk(join(ROOT, 'client', 'controller'), [], ['.js']),
];

const hits = [];
const EXPR_RE = /\{\{[\s\S]*?\}\}/g;

for (const file of files) {
  const text = readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/);
  // 跨行表达式按行号归并：记录每个 {{...}} 起始行
  let lineNo = 1;
  let m;
  EXPR_RE.lastIndex = 0;
  while ((m = EXPR_RE.exec(text))) {
    const startLine = text.slice(0, m.index).split(/\r?\n/).length;
    const expr = m[0];
    const code = stripLiterals(expr);
    const rel = relative(ROOT, file).replace(/\\/g, '/');
    const shadowed = SHADOWED_BY_STATE.get(rel);
    for (const ref of extractRefIdentifiers(code)) {
      if (!GLOBAL_NAMES.has(ref.name)) continue;
      if (shadowed && shadowed.has(ref.name)) continue;
      hits.push(`${rel}:${startLine}  {{...}} 引用全局 ${ref.name}  ->  ${expr.trim().slice(0, 90)}`);
    }
  }
}

if (hits.length > 0) {
  console.error(`[check_scope_globals] FAIL：模板表达式发现 ${hits.length} 处全局引用（makeScope 已切断 globalThis 回退，这些表达式将静默空串）：`);
  for (const h of hits) console.error('  ' + h);
  process.exit(1);
}
console.log(`[check_scope_globals] PASS：${files.length} 个视图/控制器文件的模板表达式无全局引用`);
process.exit(0);
