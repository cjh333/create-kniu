/**
 * 常驻闸门：client/config/ 配置命名规范。
 *
 * 规范（用户定稿）：
 *   1. 第一层字段 KEY 全部使用大写；
 *   2. 内部（嵌套）字段全部小写。
 * 参照：server.js 的 PROXY 嵌套键 url / change_origin（非第一层字段，已小写）。
 *
 * 豁免（标识符式键，不属于字段名，禁止改写）：
 *   - CSS 自定义属性（--kniu-*，THEME 的实际消费形态）；
 *   - 路径别名（@style 等）与代理路径前缀（/api）；
 *   - 数字状态码键（STATUS 字典）；
 *   - 整文件为路径映射的配置（viewer.js 式，键为「区域/名称」视图路径）。
 *
 * 背景教训：ui.js 曾以大写 COMPONENTS/THEME 导出而 kniuui.mjs::use() 读小写
 * components/theme——组件默认值与整站 THEME 被静默丢弃；server.js 的
 * URL/CHANGE_ORIGIN 改小写后 kniuproxy.mjs 同样读不到。本闸门静态兜住配置侧，
 * 消费侧一致性由构建 + 真机探针保障。
 *
 * 用法：node test/check_config_key_case.mjs
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const CONFIG_DIR = 'client/config';
const FIRST_LEVEL_RE = /^[A-Z][A-Z0-9_]*$/;
const NESTED_RE = /^[a-z][a-z0-9_]*$/;
const EXEMPT_NESTED = [/^--/, /^@/, /^\d+$/, /^\//];

/**
 * 扫描源码中全部对象字面量，返回 [{ keys: [{key, depth}] }]。
 * 状态机：仅「键位置」（'{' 或对象内 ',' 之后）出现的 字符串/标识符+':' 才算键，
 * 杜绝三元表达式 `a ? 'x' : 'y'` 的误判（logger.js 有此类值）。
 */
function scanObjectLiterals(code) {
  const literals = [];
  const n = code.length;
  let i = 0;
  while (i < n) {
    const ch = code[i];
    if (ch === '/' && code[i + 1] === '/') {
      while (i < n && code[i] !== '\n') i += 1;
      continue;
    }
    if (ch === '/' && code[i + 1] === '*') {
      i += 2;
      while (i < n && !(code[i] === '*' && code[i + 1] === '/')) i += 1;
      i += 2;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      i += 1;
      while (i < n) {
        if (code[i] === '\\') { i += 2; continue; }
        if (code[i] === ch) { i += 1; break; }
        i += 1;
      }
      continue;
    }
    if (ch !== '{') { i += 1; continue; }
    // 进入对象字面量
    const keys = [];
    const stack = ['{'];
    let pendingKey = true;
    i += 1;
    while (i < n && stack.length) {
      const c = code[i];
      if (c === '/' && code[i + 1] === '/') {
        while (i < n && code[i] !== '\n') i += 1;
        continue;
      }
      if (c === '/' && code[i + 1] === '*') {
        i += 2;
        while (i < n && !(code[i] === '*' && code[i + 1] === '/')) i += 1;
        i += 2;
        continue;
      }
      if (c === "'" || c === '"' || c === '`') {
        const quote = c;
        const strStart = i;
        i += 1;
        while (i < n) {
          if (code[i] === '\\') { i += 2; continue; }
          if (code[i] === quote) { i += 1; break; }
          i += 1;
        }
        if (pendingKey) {
          let k = i;
          while (k < n && /\s/.test(code[k])) k += 1;
          if (code[k] === ':') {
            keys.push({ key: code.slice(strStart + 1, i - 1), depth: stack.length });
            i = k + 1;
            pendingKey = false;
            continue;
          }
          pendingKey = false;
        }
        continue;
      }
      if (c === '{') { stack.push('{'); pendingKey = true; i += 1; continue; }
      if (c === '[') { stack.push('['); pendingKey = false; i += 1; continue; }
      if (c === '}' || c === ']') {
        stack.pop();
        pendingKey = false;
        i += 1;
        continue;
      }
      if (c === ',') {
        pendingKey = stack[stack.length - 1] === '{';
        i += 1;
        continue;
      }
      if (c === ':') { pendingKey = false; i += 1; continue; }
      if (/[A-Za-z_$]/.test(c)) {
        let j = i;
        while (j < n && /[\w$]/.test(code[j])) j += 1;
        if (pendingKey) {
          let k = j;
          while (k < n && /\s/.test(code[k])) k += 1;
          if (code[k] === ':') {
            keys.push({ key: code.slice(i, j), depth: stack.length });
            i = k + 1;
            pendingKey = false;
            continue;
          }
          pendingKey = false;
        }
        i = j;
        continue;
      }
      i += 1;
    }
    literals.push({ keys });
  }
  return literals;
}

const failures = [];
const files = readdirSync(CONFIG_DIR).filter((name) => name.endsWith('.js')).sort();
let checkedFiles = 0;
let checkedKeys = 0;

for (const file of files) {
  const code = readFileSync(join(CONFIG_DIR, file), 'utf8');
  const literals = scanObjectLiterals(code);
  if (!literals.length) continue; // 无对象字面量（如 router.js 纯路由登记）
  checkedFiles += 1;
  for (const literal of literals) {
    const firstLevel = literal.keys.filter((k) => k.depth === 1).map((k) => k.key);
    if (!firstLevel.length) continue;
    const allUpper = firstLevel.every((key) => FIRST_LEVEL_RE.test(key));
    const allPath = firstLevel.every((key) => key.includes('/'));
    if (!allUpper && !allPath) {
      failures.push(`${file}：第一层键必须全大写（或全为路径映射），发现 ${JSON.stringify(firstLevel)}`);
      continue;
    }
    if (allPath) continue; // 路径映射式配置（viewer.js），键为视图路径非字段名
    for (const item of literal.keys) {
      if (item.depth < 2) continue;
      checkedKeys += 1;
      const exempt = EXEMPT_NESTED.some((re) => re.test(item.key));
      if (!exempt && !NESTED_RE.test(item.key)) {
        failures.push(`${file}：嵌套字段键必须全小写（或属豁免形态），发现 "${item.key}"（depth=${item.depth}）`);
      }
    }
  }
}

if (failures.length > 0) {
  console.error(`[check_config_key_case] 失败 ${failures.length} 项：`);
  failures.forEach((item) => console.error(' - ' + item));
  process.exit(1);
}
console.log(`[check_config_key_case] PASS（${checkedFiles} 个配置对象 / ${checkedKeys} 个嵌套键，第一层全大写、嵌套全小写）`);
