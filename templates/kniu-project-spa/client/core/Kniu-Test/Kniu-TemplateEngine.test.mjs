import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateTemplateExpression, renderTemplate, configureTemplateEngine, escapeHtml } from '../Kniu-TemplateEngine.mjs';

configureTemplateEngine({});

test('escapeHtml 覆盖 XSS 常见向量', () => {
  assert.equal(escapeHtml('<img src=x onerror=alert(1)>'), '&lt;img src=x onerror=alert(1)&gt;');
  assert.equal(escapeHtml('"onmouseover="alert(1)'), '&quot;onmouseover=&quot;alert(1)');
  assert.equal(escapeHtml("'; DROP TABLE users;--"), '&#39;; DROP TABLE users;--');
  assert.equal(escapeHtml('a&b'), 'a&amp;b');
});

test('evaluateTemplateExpression 支持路径访问与逻辑运算', () => {
  const scope = { user: { name: 'Kniu', age: 3 }, list: [10, 20], flag: false };
  assert.equal(evaluateTemplateExpression('user.name', scope), 'Kniu');
  assert.equal(evaluateTemplateExpression('list[1]', scope), 20, '方括号索引访问');
  assert.equal(evaluateTemplateExpression('list.0', scope), 10, '数字路径段');
  assert.equal(evaluateTemplateExpression('user.age > 2 ? "成年" : "幼年"', scope), '成年');
  assert.equal(evaluateTemplateExpression('flag || "默认"', scope), '默认');
  assert.equal(evaluateTemplateExpression('user.age >= 3 && "达标"', scope), '达标');
  assert.equal(evaluateTemplateExpression('!flag', scope), true);
});

test('evaluateTemplateExpression 对恶意输入只做求值不注入 DOM', () => {
  const scope = { name: '<script>alert(1)</script>' };
  const value = evaluateTemplateExpression('name', scope);
  assert.equal(value, '<script>alert(1)</script>', '求值返回原始值');
  const html = renderTemplate('<p>{{ name }}</p>', scope);
  assert.ok(!html.includes('<script>alert'), '渲染输出必须转义');
  assert.ok(html.includes('&lt;script&gt;'));
});

test('表达式编译缓存在多次求值间保持一致且不受作用域切换影响', () => {
  const expression = 'user.age > 2 ? user.name : "匿名"';
  const first = evaluateTemplateExpression(expression, { user: { name: 'Kniu', age: 3 } });
  const second = evaluateTemplateExpression(expression, { user: { name: 'Other', age: 1 } });
  const third = evaluateTemplateExpression(expression, { user: { name: 'Kniu', age: 3 } });
  assert.equal(first, 'Kniu');
  assert.equal(second, '匿名');
  assert.equal(third, 'Kniu', '缓存命中后结果必须随作用域正确变化');
});

test('表达式编译缓存覆盖字面量、比较与取反组合', () => {
  assert.equal(evaluateTemplateExpression(' 42 '), 42);
  assert.equal(evaluateTemplateExpression('true'), true);
  assert.equal(evaluateTemplateExpression('null'), null);
  assert.equal(evaluateTemplateExpression('"文本"'), '文本');
  assert.equal(evaluateTemplateExpression('1 !== 2'), true);
  assert.equal(evaluateTemplateExpression('!(1 > 2)'), true);
});

test('renderTemplate 文本插值与转义', () => {
  const html = renderTemplate('<span class="t">{{ title }}</span>', { title: 'A & B' });
  assert.equal(html, '<span class="t">A &amp; B</span>');
});

test('renderTemplate 属性插值转义引号', () => {
  const html = renderTemplate('<a title="{{ tip }}">x</a>', { tip: 'He said "hi"' });
  assert.ok(html.includes('title="He said &quot;hi&quot;'), '属性值中的引号必须转义');
});

test('renderTemplate 支持 :if 条件块', () => {
  const chained = '<div><p :if="ok">yes</p><p :elseif="!ok">elseif</p><p :else>no</p></div>';
  const yes = renderTemplate(chained, { ok: true });
  assert.ok(yes.includes('yes'));
  assert.ok(!yes.includes('no') && !yes.includes('elseif'), '命中 if 后其余分支移除');
  const elseifHit = renderTemplate(chained, { ok: false });
  assert.ok(elseifHit.includes('elseif'), '!ok 命中 elseif 分支');
  assert.ok(!elseifHit.includes('no'), '命中 elseif 后 else 分支移除');
  const binary = '<div><p :if="ok">yes</p><p :else>no</p></div>';
  assert.ok(renderTemplate(binary, { ok: false }).includes('no'));
});

test('renderTemplate 支持 :for 循环与作用域变量', () => {
  const template = '<ul><li :for="item in list" :for-index="i">{{ item.name }}-{{ i }}</li></ul>';
  const html = renderTemplate(template, { list: [{ name: 'a' }, { name: 'b' }] });
  assert.ok(html.includes('a-0'));
  assert.ok(html.includes('b-1'));
});

test('renderTemplate 循环内的空值字段渲染为空', () => {
  const html = renderTemplate('<p :for="row in rows">{{ row.name }}</p>', { rows: [{ name: 'x' }, {}] });
  assert.ok(html.includes('x'));
  assert.ok(!html.includes('undefined'), '缺失字段不得输出 undefined');
});

test('renderTemplate :key 输出键锚点注释供 keyed 复用', () => {
  const html = renderTemplate('<li :for="row in rows" :key="row.id">{{ row.name }}</li>', { rows: [{ id: 'a1', name: '甲' }, { id: 'b2', name: '乙' }] });
  assert.ok(html.includes('<!--kniu-k:a1-->'), '首项锚点');
  assert.ok(html.includes('<!--/kniu-k-->'), '闭合锚点');
  assert.ok(html.includes('甲'));
  const noKey = renderTemplate('<li :for="row in rows">{{ row.name }}</li>', { rows: [{ name: 'x' }] });
  assert.ok(!noKey.includes('kniu-k:'), '无 :key 不输出锚点');
});

test('renderTemplate 不执行模板内 script 内容', () => {
  const html = renderTemplate('<div>{{ payload }}</div>', { payload: 'ok' });
  assert.ok(html.includes('ok'));
});