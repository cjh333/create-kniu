import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractStaticBlocks, renderTemplate } from '../Kniu-TemplateEngine.mjs';

test('extractStaticBlocks 整段静态子树替换为占位符', () => {
  const blocks = [];
  const compiled = extractStaticBlocks('<div><ul><li>甲</li></ul></div>', blocks);
  assert.equal(compiled, '%%KNIU_S_0%%');
  assert.deepEqual(blocks, ['<div><ul><li>甲</li></ul></div>']);
});

test('extractStaticBlocks 保留含插值与指令的动态区', () => {
  const source = '<section><h1>标题</h1><p>{{ msg }}</p><span :if="ok">通过</span></section>';
  const blocks = [];
  const compiled = extractStaticBlocks(source, blocks);
  assert.equal(compiled, '<section>%%KNIU_S_0%%<p>{{ msg }}</p><span :if="ok">通过</span></section>');
  assert.deepEqual(blocks, ['<h1>标题</h1>']);
});

test('extractStaticBlocks 事件与 ref 属性阻止静态化', () => {
  const blocks = [];
  extractStaticBlocks('<div><button @click="go()">走</button><i ref="icon">图</i></div>', blocks);
  assert.deepEqual(blocks, []);
});

test('extractStaticBlocks 标签不配对时整体放弃提取', () => {
  const source = '<div><span>残缺</div>';
  const blocks = [];
  assert.equal(extractStaticBlocks(source, blocks), source);
  assert.deepEqual(blocks, []);
});

test('extractStaticBlocks 自闭合标签随静态父级一并提取', () => {
  const blocks = [];
  const compiled = extractStaticBlocks('<div><br><img src="/a.png"></div>', blocks);
  assert.equal(compiled, '%%KNIU_S_0%%');
  assert.deepEqual(blocks, ['<div><br><img src="/a.png"></div>']);
});

test('renderTemplate 还原静态块后与未编译模板渲染结果一致', () => {
  const template = '<section><h1>标题</h1><p>{{ msg }}</p></section>';
  const blocks = [];
  const compiled = extractStaticBlocks(template, blocks);
  const previous = globalThis.__VIEW_STATIC_BLOCKS__;
  globalThis.__VIEW_STATIC_BLOCKS__ = blocks;
  try {
    assert.equal(renderTemplate(compiled, { msg: '正文' }), renderTemplate(template, { msg: '正文' }));
  } finally {
    if (previous === undefined) delete globalThis.__VIEW_STATIC_BLOCKS__;
    else globalThis.__VIEW_STATIC_BLOCKS__ = previous;
  }
});

test('extractStaticBlocks 无标签或缺少块表时原样返回', () => {
  assert.equal(extractStaticBlocks('纯文本'), '纯文本');
  assert.equal(extractStaticBlocks('<div>甲</div>', null), '<div>甲</div>');
});