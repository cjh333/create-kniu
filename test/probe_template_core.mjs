// 模板引擎提炼重构回归探针（2026-10-17）：验证 setupFor↔setupIf 互归递归、
// parseBindingSegments/applyEventModifiers/materializeRoots 提炼后行为不变。
// 第二轮（同日）：directiveAttr 双前缀别名、loading 名表、findUnknownModifiers/
// hasConflictingModifiers、cacheSetLimited 淘汰后求值。
// ONLY=<节名> 环境变量可单节隔离运行；断言全部为行为级。
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PW = 'D:/D01Software/D0114MicrosoftVSCode/resources/app/node_modules/playwright-core/index.js';
const CHROME_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
];
const chrome = CHROME_CANDIDATES.find(function (p) { return fs.existsSync(p); });
if (!chrome) { console.error('FAIL: chrome not found'); process.exit(1); }

const MIME = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.css': 'text/css' };
const server = http.createServer(function (req, res) {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/favicon.ico') { res.writeHead(204); res.end(); return; }
  if (p === '/') p = '/__probe_template.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    console.error('SRV_404:', p);
    res.writeHead(404); res.end('nf'); return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  res.end(fs.readFileSync(file));
});
const PORT = 18971;
await new Promise(function (r) { server.listen(PORT, '127.0.0.1', r); });

const PAGE = `<!DOCTYPE html><html><body><div id="app"></div>
<script type="module">
import KniuTemplate from '${process.env.ENGINE_PATH || '/client/core/kniutemplate/kniutemplate.mjs'}';
const results = {};
window.__RESULTS = results;
function assert(name, cond) { results[name] = !!cond; }
const wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
const ONLY = new URLSearchParams(location.search).get('only') || '';

function R1() {
  // R1 递归：for > if/else（setupFor.build 根 if 分支）
  const host = document.getElementById('app');
  host.innerHTML = '<template kniu:for="rows" kniu:for-item="row">'
    + '<template kniu:if="{{row.ok}}"><b class="ok">{{row.n}}</b></template>'
    + '<template kniu:else><i class="skip">{{row.n}}</i></template>'
    + '</template>';
  const s1 = KniuTemplate.reactive({ rows: [{n:1,ok:true},{n:2,ok:false},{n:3,ok:true}] });
  KniuTemplate.bind(host, s1);
  assert('R1_for_if_recur', host.querySelectorAll('b.ok').length === 2 && host.querySelectorAll('i.skip').length === 1);
}

function R2() {
  // R2 递归：for > for > if（模板直接嵌套模板，根 for 收集路径）
  const host2 = document.createElement('div');
  host2.innerHTML = '<template kniu:for="groups" kniu:for-item="group">'
    + '<template kniu:for="{{group.items}}" kniu:for-item="it">'
    + '<template kniu:if="{{it.v > 3}}"><span class="deep">{{group.g}}:{{it.v}}</span></template>'
    + '</template></template>';
  document.body.appendChild(host2);
  const s2 = KniuTemplate.reactive({ groups: [{g:'a',items:[{v:1},{v:5}]},{g:'b',items:[{v:9},{v:2}]}] });
  KniuTemplate.bind(host2, s2);
  const deep = [...host2.querySelectorAll('span.deep')].map(function (s) { return s.textContent; }).join(',');
  assert('R2_nested_for_filter', deep === 'a:5,b:9');
}

function R3() {
  // R3 @raw 文本 + 清洗（bindTextNode raw 路径）
  const host3 = document.createElement('div');
  host3.innerHTML = '<p>{{@html}}</p>';
  document.body.appendChild(host3);
  const s3 = KniuTemplate.reactive({ html: 'hello<img src=x onerror=window.__xss=1><scr' + 'ipt>window.__xss=1<\\/scr' + 'ipt>' });
  KniuTemplate.bind(host3, s3);
  assert('R3_raw_sanitize', host3.querySelector('p').textContent.indexOf('hello') === 0 && !window.__xss && !host3.querySelector('script'));
}

function R4() {
  // R4 kniu@click.prevent（kniu@ 事件守卫路径）
  const host4 = document.createElement('div');
  host4.innerHTML = '<button type="button" kniu@click.prevent="onBtn">go</button>';
  document.body.appendChild(host4);
  let calls = 0;
  const s4 = KniuTemplate.reactive({ onBtn: function () { calls++; } });
  KniuTemplate.bind(host4, s4);
  const btn = host4.querySelector('button');
  const ev = new MouseEvent('click', { bubbles: true, cancelable: true });
  btn.dispatchEvent(ev);
  assert('R4_event_guard', calls === 1 && ev.defaultPrevented);
}

function R5() {
  // R5 kniu:option onXxx（option 事件守卫路径）
  const host5 = document.createElement('div');
  host5.innerHTML = '<button type="button" kniu:option="{{ {onClick: onOpt} }}">opt</button>';
  document.body.appendChild(host5);
  let optCalls = 0;
  const s5 = KniuTemplate.reactive({ onOpt: function () { optCalls++; } });
  KniuTemplate.bind(host5, s5);
  host5.querySelector('button').dispatchEvent(new MouseEvent('click', { bubbles: true }));
  assert('R5_option_handler', optCalls === 1);
}

async function R6() {
  // R6 leaf plan 快路径 + 响应式更新（O12 不变量）
  const host6 = document.createElement('div');
  host6.innerHTML = '<ul><template kniu:for="list" kniu:for-item="item"><li>{{item.n}}</li></template></ul>';
  document.body.appendChild(host6);
  const s6 = KniuTemplate.reactive({ list: [{n:'x'},{n:'y'}] });
  KniuTemplate.bind(host6, s6);
  assert('R6a_leafplan', host6.textContent.replace(/\\s+/g, '') === 'xy');
  s6.list[0].n = 'X2';
  await wait(60);
  assert('R6b_reactive_update', host6.querySelectorAll('li')[0].textContent === 'X2');
}

async function R7() {
  // R7 if/elseif/else 链 + 响应式切换
  const host7 = document.createElement('div');
  host7.innerHTML = '<template kniu:if="{{mode===1}}">A</template><template kniu:elseif="{{mode===2}}">B</template><template kniu:else>C</template>';
  document.body.appendChild(host7);
  const s7 = KniuTemplate.reactive({ mode: 2 });
  KniuTemplate.bind(host7, s7);
  assert('R7a_elseif', host7.textContent.trim() === 'B');
  s7.mode = 5;
  await wait(60);
  assert('R7b_else_switch', host7.textContent.trim() === 'C');
}

async function R8() {
  // R8 属性插值 + kniu:[data-name] 驼峰绑定
  const host8 = document.createElement('div');
  host8.innerHTML = '<a kniu:href="{{url}}" kniu:[custom-value]="{{label}}">t</a>';
  document.body.appendChild(host8);
  const s8 = KniuTemplate.reactive({ url: '/go', label: 'v1' });
  KniuTemplate.bind(host8, s8);
  const a = host8.querySelector('a');
  assert('R8a_attr_bind', a.getAttribute('href') === '/go' && a.getAttribute('data-custom-value') === 'v1');
  s8.label = 'v2';
  await wait(60);
  assert('R8b_data_reactive', a.getAttribute('data-custom-value') === 'v2');
}

async function R9() {
  // R9 表达式订阅更新（表达式链路 + makeScope）
  const host9 = document.createElement('div');
  host9.innerHTML = '<span>{{a + b}}</span>';
  document.body.appendChild(host9);
  const s9 = KniuTemplate.reactive({ a: 1, b: 2 });
  KniuTemplate.bind(host9, s9);
  assert('R9a_expr', host9.querySelector('span').textContent === '3');
  s9.b = 40;
  await wait(60);
  assert('R9b_expr_update', host9.querySelector('span').textContent === '41');
}

function R10() {
  // R10 冒号短前缀别名全链路（directiveAttr/hasDirectiveAttr 别名路径）
  const host = document.createElement('div');
  host.innerHTML = '<template :for="rows" :for-item="row">'
    + '<template :if="{{row.ok}}"><b class="ok">{{row.n}}</b></template>'
    + '<template :else><i class="skip">{{row.n}}</i></template>'
    + '</template>';
  document.body.appendChild(host);
  const s = KniuTemplate.reactive({ rows: [{n:1,ok:true},{n:2,ok:false}] });
  KniuTemplate.bind(host, s);
  assert('R10a_colon_alias_for_if', host.querySelectorAll('b.ok').length === 1 && host.querySelectorAll('i.skip').length === 1);
  const host2 = document.createElement('div');
  host2.innerHTML = '<button type="button" @click="onTap">go</button>';
  document.body.appendChild(host2);
  let taps = 0;
  const s2 = KniuTemplate.reactive({ onTap: function () { taps++; } });
  KniuTemplate.bind(host2, s2);
  host2.querySelector('button').dispatchEvent(new MouseEvent('click', { bubbles: true }));
  assert('R10b_colon_event_alias', taps === 1);
}

async function R11() {
  // R11 kniu:loading 遮罩挂载/隐藏 + 冒号别名 + loading-text（LOADING_* 名表）
  // loading-text 按「表达式」求值（KNIU-TEMPLATE.md 既定约定）：state key 或 {{'字面量'}}
  const host = document.createElement('div');
  host.innerHTML = '<div id="l1" kniu:loading="{{busy}}" kniu:loading-text="{{loadTip}}">x</div>'
    + '<div id="l2" :loading="{{busy}}">y</div>'
    + '<div id="l3" :loading="{{busy}}" :loading-text="{{tipPre + loadTip}}">z</div>';
  document.body.appendChild(host);
  const s = KniuTemplate.reactive({ busy: true, loadTip: '加载中', tipPre: '前缀/' });
  KniuTemplate.bind(host, s);
  const l1 = host.querySelector('#l1');
  const l2 = host.querySelector('#l2');
  const l3 = host.querySelector('#l3');
  const m1 = l1.querySelector('kniu-loading');
  const m2 = l2.querySelector('kniu-loading');
  const m3 = l3.querySelector('kniu-loading');
  // 探针页不注册 kniu-loading 自定义元素（组件非本引擎职责），故断言引擎写入的属性值
  assert('R11a_loading_mount', !!m1 && !!m2 && !!m3
    && m1.show === true && m2.show === true && m3.show === true
    && m1.text === '加载中' && m3.text === '前缀/加载中'
    && m1.hasAttribute('contained'));
  s.loadTip = '保存中';
  await wait(60);
  assert('R11b_loading_text_reactive', m1.text === '保存中' && m3.text === '前缀/保存中');
  s.busy = false;
  await wait(60);
  assert('R11c_loading_hide', m1.show === false && m2.show === false && m3.show === false);
}

function R12() {
  // R12 事件修饰符守卫：未知修饰符 / passive+prevent 冲突均不绑定
  // （findUnknownModifiers / hasConflictingModifiers，元素与 option 双路径）
  const host = document.createElement('div');
  host.innerHTML = '<button type="button" id="b1" kniu@click.bogus="onTap">a</button>'
    + '<button type="button" id="b2" kniu@click.passive.prevent="onTap">b</button>'
    + '<button type="button" id="b3" kniu:option="{{ {onClickPassivePrevent: onTap} }}">c</button>';
  document.body.appendChild(host);
  let taps = 0;
  const s = KniuTemplate.reactive({ onTap: function () { taps++; } });
  KniuTemplate.bind(host, s);
  host.querySelector('#b1').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  host.querySelector('#b2').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  assert('R12a_element_modifier_guard', taps === 0);
  host.querySelector('#b3').dispatchEvent(new MouseEvent('click', { bubbles: true }));
  assert('R12b_option_modifier_guard', taps === 0);
}

async function R13() {
  // R13 表达式缓存淘汰后仍可正确求值（cacheSetLimited 守卫）
  const host = document.createElement('div');
  host.innerHTML = '<span>{{a + b}}</span>';
  document.body.appendChild(host);
  const s = KniuTemplate.reactive({ a: 1, b: 2 });
  KniuTemplate.bind(host, s);
  for (let i = 0; i < 1005; i++) KniuTemplate.compileExpression('__kniu_probe_' + i);
  assert('R13a_cache_evict_survive', host.querySelector('span').textContent === '3');
  s.b = 40;
  await wait(60);
  assert('R13b_cache_evict_update', host.querySelector('span').textContent === '41');
}

async function R14() {
  // R14 makeScope 不再回退 globalThis（规则 222：未命中键必须静默空串，不得泄全局对象）
  // 同 host 内放正常 state key，防「表达式链路整体坏掉也返回空串」的假阴性
  const hostA = document.createElement('div');
  hostA.innerHTML = '<i id="g1">{{ Object }}</i><i id="g2">{{ String }}</i>'
    + '<i id="g3">{{ top }}</i><i id="g4">{{ a }}</i>';
  document.body.appendChild(hostA);
  const sA = KniuTemplate.reactive({ a: 7 });
  KniuTemplate.bind(hostA, sA);
  assert('R14a_global_leak_closed',
    hostA.querySelector('#g1').textContent === '' && hostA.querySelector('#g2').textContent === ''
    && hostA.querySelector('#g3').textContent === '' && hostA.querySelector('#g4').textContent === '7');
  // state 自身字段必须优先（回退被切断 ≠ 封死同名 state 键）
  const hostB = document.createElement('div');
  hostB.innerHTML = '<i id="h1">{{ Object }}</i><i id="h2">{{ String }}</i>';
  document.body.appendChild(hostB);
  const sB = KniuTemplate.reactive({ Object: 'self', String: 'self' });
  KniuTemplate.bind(hostB, sB);
  assert('R14b_state_key_wins',
    hostB.querySelector('#h1').textContent === 'self' && hostB.querySelector('#h2').textContent === 'self');
}

const SECTIONS = { R1, R2, R3, R4, R5, R6, R7, R8, R9, R10, R11, R12, R13, R14 };
for (const name of Object.keys(SECTIONS)) {
  if (ONLY && name !== ONLY) continue;
  try { await SECTIONS[name](); } catch (e) { results[name + '_THREW'] = false; window.__ERR = (e && e.stack) || String(e); }
}
window.__DONE = true;
<\/script></body></html>`;
fs.writeFileSync(path.join(ROOT, '__probe_template.html'), PAGE);

let browser;
try {
  const pw = await import(pathToFileURL(PW).href);
  const chromium = pw.chromium || (pw.default && pw.default.chromium);
  browser = await chromium.launchPersistentContext(path.join(ROOT, 'test', 'zz_tpl_profile'), {
    executablePath: chrome, headless: true,
    args: ['--no-proxy-server', '--no-first-run'],
  });
} catch (e) { console.error('FAIL: browser launch: ' + e.message); server.close(); process.exit(1); }

try {
  const context = browser.contexts ? browser.contexts()[0] : browser;
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', function (e) { errors.push((e && e.stack) || String(e)); });
  page.on('console', function (m) {
    if (m.type() !== 'error') return;
    const url = (m.location() && m.location().url) || '';
    if (/\/x(\?|$)/.test(url)) return;
    errors.push('console: ' + t);
  });
  await page.goto(`http://127.0.0.1:${PORT}/${process.env.ONLY ? '?only=' + process.env.ONLY : ''}`, { waitUntil: 'load' });
  let timedOut = false;
  try {
    await page.waitForFunction('window.__DONE === true', null, { timeout: 15000 });
  } catch (e) {
    timedOut = true;
    const partial = await page.evaluate('window.__RESULTS || {}').catch(function () { return {}; });
    console.log('TIMEOUT; partial results:', JSON.stringify(partial));
    console.log('ERRORS:', errors.join(' | ') || '(none)');
    process.exitCode = 1;
  }
  if (!timedOut) {
    const results = await page.evaluate('window.__RESULTS');
    const thrownErr = await page.evaluate('window.__ERR || ""');
    if (thrownErr) console.log('THROWN: ' + thrownErr.split('\n').slice(0, 6).join('\n'));
    const names = Object.keys(results).sort();
    let pass = 0; const failed = [];
    names.forEach(function (n) { if (results[n]) pass++; else failed.push(n); });
    console.log(`PASS ${pass}/${names.length}`);
    if (failed.length) console.log('FAILED: ' + failed.join(', '));
    if (errors.length) console.log('PAGE_ERRORS: ' + errors.join('\n---\n'));
    if (failed.length || errors.length) process.exitCode = 1;
  }
} finally {
  await browser.close().catch(function () {});
  server.close();
  fs.unlinkSync(path.join(ROOT, '__probe_template.html'));
  fs.rmSync(path.join(ROOT, 'test', 'zz_tpl_profile'), { recursive: true, force: true });
}
