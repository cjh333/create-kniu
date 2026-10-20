// 常驻闸门：表格开关列/可编辑列回调必须回传保存结果。
// 背景：kniuui.mjs 对 switch 列（~1328）与 editable 列（~1825）判定均为
//   saved = await onChange(...) !== false
// 只有显式 false 才回滚；回调返回 undefined 会被判为「已保存」，
// 请求失败时开关停在错误状态（UI 与库长期不一致），且无任何报错。
// 因此凡被视图以 @change / onChange 绑定的控制器方法，函数体内必须有返回值。
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const VIEWS_DIR = join(ROOT, 'client/views');
const CONTROLLERS_DIR = join(ROOT, 'client/controller');

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

// 收集视图里被绑定为开关/编辑回调的方法名。
function collectBoundCallbacks() {
  const names = new Set();
  for (const file of walk(VIEWS_DIR)) {
    if (!/\.html$/.test(file)) continue;
    const source = readFileSync(file, 'utf8');
    const patterns = [
      /@change\s*=\s*"([A-Za-z_$][\w$]*)"/g,
      /@change\s*=\s*'([A-Za-z_$][\w$]*)'/g,
      /onChange\s*:\s*\(?\s*([A-Za-z_$][\w$]*)/g
    ];
    patterns.forEach(function (pattern) {
      let match;
      while ((match = pattern.exec(source))) names.add(match[1]);
    });
  }
  return names;
}

// 抽取具名函数体（大括号配平，跳过字符串/模板字面量）。
function extractBody(source, startIndex) {
  let depth = 0;
  let seenOpen = false;
  let quote = null;
  for (let i = startIndex; i < source.length; i += 1) {
    const char = source[i];
    if (quote) {
      if (char === '\\') { i += 1; continue; }
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === '`') { quote = char; continue; }
    if (char === '{') { depth += 1; seenOpen = true; continue; }
    if (char === '}') {
      depth -= 1;
      if (seenOpen && depth === 0) return source.slice(startIndex, i + 1);
    }
  }
  return '';
}

// 判定回调是否把「异步保存结果」回传出去了。
// 无 await 的同步回调（如筛选 onChange 只触发重查）无需回传，跳过；
// 有 await 时必须满足其一：
//   a) 直接返回：`return await ...`
//   b) 先接后返：`const x = await ...` 且后续 `return x` / `return !!x`。
// 只看「早期 return false」会漏判（守卫式 return 蒙混过关），故按最后结果流向判定。
function returnsAsyncResult(body) {
  if (!/\bawait\b/.test(body)) return true;
  if (/\breturn\s+\(?\s*await\b/.test(body)) return true;
  // 先接后返：最后一个 await 之后必须出现带值 return（return res / !!res / true / false 均可）。
  const awaits = [...body.matchAll(/\bawait\b/g)];
  const tail = body.slice(awaits[awaits.length - 1].index);
  return /\breturn\s+[^;\n}]/.test(tail);
}

const bound = collectBoundCallbacks();
const failures = [];
let checked = 0;

for (const file of walk(CONTROLLERS_DIR)) {
  if (!/\.js$/.test(file)) continue;
  const source = stripComments(readFileSync(file, 'utf8'));
  for (const name of bound) {
    const declRe = new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`, 'g');
    let match;
    while ((match = declRe.exec(source))) {
      const body = extractBody(source, match.index + match[0].length - 1);
      if (!body) continue;
      checked += 1;
      if (!returnsAsyncResult(body)) {
        const line = source.slice(0, match.index).split('\n').length;
        failures.push({ file: relative(ROOT, file).replace(/\\/g, '/'), name, line });
      }
    }
  }
}

if (failures.length) {
  console.error(`[check_switch_callback_return] FAIL：${failures.length} 处开关/编辑回调未回传保存结果（失败时不回滚）`);
  failures.forEach(function (item) {
    console.error(`  - ${item.file}:${item.line} ${item.name}()`);
  });
  console.error('  修复：回调内 return 保存结果（如 return await actions.updateRow(...) / return !!res），框架只在显式 false 时回滚。');
  process.exit(1);
}

console.log(`[check_switch_callback_return] PASS：${checked} 个开关/编辑回调均回传保存结果`);
