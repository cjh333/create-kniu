import { renderTemplate, evaluateTemplateExpression, escapeHtml, extractStaticBlocks } from '../Kniu-TemplateEngine.mjs';
import { reactive, effect } from '../Kniu-MVVM.mjs';

const timers = new Map();

function time(name, iterations, work) {
  work();
  const started = process.hrtime.bigint();
  for (let index = 0; index < iterations; index += 1) work();
  const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
  timers.set(name, { iterations, elapsedMs, opsPerMs: iterations / elapsedMs });
}

function report() {
  const rows = [...timers.entries()].sort((left, right) => right[1].opsPerMs - left[1].opsPerMs);
  console.log('\nbenchmark                      ops/ms        ms/op');
  for (const [name, stat] of rows) {
    console.log(name.padEnd(30), stat.opsPerMs.toFixed(1).padStart(9), (1 / stat.opsPerMs).toFixed(4).padStart(11));
  }
}

const scope = { user: { name: 'Kniu', age: 3, vip: true }, list: [10, 20], flag: false };
time('evaluate.path', 200000, () => evaluateTemplateExpression('user.name', scope));
time('evaluate.ternary', 100000, () => evaluateTemplateExpression('user.age > 2 ? "成年" : "幼年"', scope));
time('evaluate.logic', 100000, () => evaluateTemplateExpression('user.vip && "达标"', scope));

const smallTemplate = '<ul><li :for="item in items" :key="item.id">{{ item.name }}</li></ul>';
const smallData = { items: Array.from({ length: 8 }, (_, index) => ({ id: index, name: '项目' + index })) };
time('render.small(8 items)', 3000, () => renderTemplate(smallTemplate, smallData));

const largeData = { items: Array.from({ length: 100 }, (_, index) => ({ id: index, name: '标题' + index, intro: '摘要文字' + index })) };
time('render.list(100 items)', 500, () => renderTemplate(smallTemplate, largeData));

const noKeyTemplate = '<ul><li :for="item in items">{{ item.name }}</li></ul>';
time('render.list(100,nokey)', 500, () => renderTemplate(noKeyTemplate, largeData));

const state = reactive({ deep: { counter: 0 }, list: [] });
let triggerCount = 0;
effect(() => { triggerCount = state.deep.counter; });
time('reactive.set', 100000, () => { state.deep.counter += 1; });

effect(() => { state.list.length; });
time('reactive.push', 50000, () => { state.list.push(1); });

const rawText = '包含 & 特殊 "字符" 的 <文本>';
time('escapeHtml', 300000, () => escapeHtml(rawText));

const plainHeavy = `<article class="static-only">${'<p>纯静态段落文本内容，用于验证插值快路径。</p>'.repeat(40)}</article>`;
time('render.plaintext', 5000, () => renderTemplate(plainHeavy, {}));

const staticItems = Array.from({ length: 20 }, (_, index) => (
  `<li class="item"><span class="title">静态标题${index}</span><em class="desc">静态描述文字${index}</em></li>`
)).join('');
const staticHeavyRaw = `<section class="wrap"><ul class="list">${staticItems}</ul><p class="dyn">{{ note }}</p></section>`;
const staticBlocks = [];
const staticHeavyCompiled = extractStaticBlocks(staticHeavyRaw, staticBlocks);
globalThis.__VIEW_STATIC_BLOCKS__ = staticBlocks;
time('render.static(raw)', 2000, () => renderTemplate(staticHeavyRaw, { note: '动态' }));
time('render.static(compiled)', 2000, () => renderTemplate(staticHeavyCompiled, { note: '动态' }));

report();