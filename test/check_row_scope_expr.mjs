// 规则 #162 守卫：kniu-table-col 列模板（template #default）内的按行表达式
// 必须写 {{scope.row.<字段>}}；裸 row.* 会被模板引擎静默吞掉（:if 失效且无报错）。
// 用法：node test/check_row_scope_expr.mjs
// 退出码：0=通过；1=发现裸 row.* 命中。
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const VIEWS = join(ROOT, 'client', 'views');

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (name.endsWith('.html')) out.push(full);
  }
  return out;
}

const files = walk(VIEWS);
const hits = [];

for (const file of files) {
  const text = readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/);
  // 逐行扫描 knriu-table-col 开始到 </kniu-table-col> 结束的块，
  // 在块内检查 {{...}} 表达式是否含裸 row.（前面无 scope.）。
  let inCol = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/<kniu-table-col[\s>]/.test(line)) inCol = true;
    if (inCol) {
      const exprs = line.match(/\{\{[^}]*\}\}/g) || [];
      for (const expr of exprs) {
        // 裸 row.：row 前不是 scope. / 非单词字符边界（排除 scope.row）
        if (/(^|[^.\w])row\./.test(expr)) {
          hits.push(`${relative(ROOT, file)}:${i + 1}  ${expr.trim()}`);
        }
      }
    }
    if (inCol && /<\/kniu-table-col>/.test(line)) inCol = false;
  }
}

if (hits.length > 0) {
  console.error(`[check_row_scope_expr] FAIL：列模板发现 ${hits.length} 处裸 row.* 表达式（须写 scope.row.*，否则被静默吞）：`);
  for (const h of hits) console.error('  ' + h);
  process.exit(1);
}
console.log(`[check_row_scope_expr] PASS：${files.length} 个视图模板的列模板全部使用 scope.row.*`);
process.exit(0);
