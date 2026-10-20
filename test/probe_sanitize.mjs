// 富文本清洗器安全回归探针（2026-10-18）
// 对象：client/core/kniusanitizer.mjs 的 sanitizeRichHtml
// 目的：验证 SMIL/SVG/MathML 载体在清洗后不产生可执行产物。
// 用法：node test/probe_sanitize.mjs；ONLY=<断言前缀> 可单节隔离。
// 判定口径：对每个 payload —— ①清洗产物重新注入 DOM（模拟消费方二次解析，MathML
// 命名空间混淆就发生在这里）；②遍历产物断言：无 on* 属性、无危险协议 URL 属性、
// 无残留 animate/set/animatetransform/animatemotion 危险节点、无被禁标签。
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PW = 'D:/D01Software/D0114MicrosoftVSCode/resources/app/node_modules/playwright-core/index.js';
const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
if (!fs.existsSync(chrome)) { console.error('no chrome'); process.exit(1); }
if (!fs.existsSync(PW)) { console.error('no playwright-core'); process.exit(1); }

const MIME = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript' };
const server = http.createServer(function (req, res) {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/favicon.ico') { res.writeHead(204); res.end(); return; }
  if (p === '/') p = '/__probe_sanitize.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file)) { res.writeHead(404).end('nf'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  res.end(fs.readFileSync(file));
});
const PORT = 18981;
await new Promise(function (r) { server.listen(PORT, '127.0.0.1', r); });

const URL_ATTRS = ['href', 'src', 'poster', 'xlink:href', 'srcset', 'formaction'];
const SMIL_TAGS = ['animate', 'animatetransform', 'animatemotion', 'set'];
const BANNED = ['script', 'iframe', 'object', 'embed', 'link', 'meta', 'style', 'base', 'form'];

const PAYLOADS = [
  // [键, 载荷] —— 逗号后空格分隔，avoid backslash-u（写死实体由 DOM 解码）
  ['A1_to_js', '<svg><a id="t"><animate attributeName="href" to="javascript:alert(1)"/><text>x</text></a></svg>'],
  ['A2_values_list', '<svg><a id="t"><animate attributeName="href" values="http://ok;javascript:alert(1)"/><text>x</text></a></svg>'],
  ['A3_from_js', '<svg><a id="t"><animate attributeName="href" from="javascript:alert(1)" to="http://ok"/><text>x</text></a></svg>'],
  ['A4_to_lead_space', '<svg><a id="t"><animate attributeName="href" to=" javascript:alert(1)"/><text>x</text></a></svg>'],
  ['A5_to_lead_ctrl', '<svg><a id="t"><animate attributeName="href" to="&#9;javascript:alert(1)"/><text>x</text></a></svg>'],
  ['A6_attributeName_on', '<svg><rect><animate attributeName="onclick" to="alert(1)"/></rect></svg>'],
  ['A7_to_data_text', '<svg><a id="t"><animate attributeName="href" to="data:text/html,<script>alert(1)</script>"/><text>x</text></a></svg>'],
  ['A8_animatetransform', '<svg><g><animatetransform attributeName="onbegin" to="alert(1)"/></g></svg>'],
  ['A9_set_onmouseover', '<svg><set attributeName="onmouseover" to="alert(1)"/></svg>'],
  ['A10_set_href', '<svg><a id="t"><set attributeName="href" to="javascript:alert(1)"/><text>x</text></a></svg>'],
  ['B1_math_href', '<math href="javascript:alert(1)"><mi>x</mi></math>'],
  ['B2_math_mxss', '<math><mtext><table><mglyph><style><!--</style><img title="--></style><img src=1 onerror=alert(1)>">></mglyph></table></mtext></math>'],
  ['B3_math_annotation', '<math><annotation-xml encoding="text/html"><img src=x onerror="alert(1)"></annotation-xml></math>'],
  ['C1_iframe', '<iframe src="javascript:alert(1)"></iframe>'],
  ['C2_onerror', '<img src=x onerror="alert(1)">'],
  ['C3_data_svg_script', '<a href="data:image/svg+xml,<svg onload=alert(1)>">x</a>']
];

// 防 HTML 解析器提前掐断 <script type="module">：载荷里的 </script> 换占位符，页内再还原。
// 页面模板输出绝不出现 </script> 字面量。
const PAYLOADS_SAFE = PAYLOADS.map(function (pair) {
  return [pair[0], pair[1].split('</script>').join('@SLASH@')];
});

const PAGE = `<!DOCTYPE html><html><body><div id="out"></div>
<script type="module">
import { sanitizeRichHtml, sanitizeRichHtmlAsync } from '/client/core/kniusanitizer.mjs';
const PAYLOADS = ${JSON.stringify(PAYLOADS_SAFE)};
const results = {};
const setr = function (k, v) { results[k] = v; };
// 占位符还原为真实闭合 script 标签（JS 字符串层面操作，不回到 HTML 上下文）。
// 注意：PAGE 模板内任何位置（含注释）都不得出现该标签的字面量，否则脚本块被提前掐断。
const restore = function (s) { return String(s).split('@SLASH@').join('</scr' + 'ipt>'); };

function scanDom(root) {
  const bad = { onAttr: [], urlAttr: [], smil: [], banned: [] };
  if (!root) return bad;
  const nodes = [root].concat(Array.prototype.slice.call(root.querySelectorAll('*')));
  nodes.forEach(function (n) {
    if (!n.getAttributeNames) return;
    const attrs = Array.from(n.attributes).map(function (a) { return { name: a.name.toLowerCase(), value: a.value }; });
    attrs.forEach(function (a) {
      if (a.name.indexOf('on') === 0) bad.onAttr.push(a.name);
      if (a.name === 'srcset' && /(?:^|,)(?:javascript|vbscript):/i.test(a.value.replace(/[\\s\\x00-\\x1f]+/g, ''))) bad.urlAttr.push(a.name + '=' + a.value.slice(0, 24));
      if (a.name !== 'srcset' && a.value && /^(?:javascript|vbscript):/i.test(a.value.replace(/[\\s\\x00-\\x1f]+/g, ''))) bad.urlAttr.push(a.name + '=' + a.value.slice(0, 24));
    });
    const tag = n.tagName ? n.tagName.toLowerCase() : '';
    if (BANNED_FLAG.indexOf(tag) >= 0) bad.banned.push(tag);
    if (SMIL_FLAG.indexOf(tag) >= 0) {
    const target = (n.getAttribute('attributeName') || '').trim().toLowerCase();
      const raw = ((n.getAttribute('to') || '') + '|' + (n.getAttribute('values') || '') + '|' + (n.getAttribute('from') || ''));
      if (/on/.test(target) || /javascript:|vbscript:|data:/i.test(raw.replace(/[\\s\\x00-\\x1f]+/g, ''))) bad.smil.push(tag + ':' + target);
    }
  });
  return bad;
}
const BANNED_FLAG = ${JSON.stringify(BANNED)};
const SMIL_FLAG = ${JSON.stringify(SMIL_TAGS)};

for (const pair of PAYLOADS) {
  const key = pair[0];
    const payload = restore(pair[1]);
  try {
    const cleaned = sanitizeRichHtml(payload);
    // async 路径产物必须与 sync 逐字一致（文档承诺；曾因 async 漏 SMIL 处理而分叉）
    const asyncCleaned = await sanitizeRichHtmlAsync(payload);
    setr(key + '__async_parity', asyncCleaned === cleaned);
    if (asyncCleaned !== cleaned) window.__EVIL = (window.__EVIL || '') + ' | ' + key + ' ASYNC_DIVERGE sync=' + JSON.stringify(cleaned.slice(0, 60)) + ' async=' + JSON.stringify(asyncCleaned.slice(0, 60));
    // 模拟消费方二次解析（{{@content}} 走 innerHTML 注入）
    const host = document.createElement('div');
    host.innerHTML = cleaned;
    const bad = scanDom(host);
    const clean = bad.onAttr.length === 0 && bad.urlAttr.length === 0 && bad.smil.length === 0 && bad.banned.length === 0;
    setr(key, clean);
    if (!clean) window.__EVIL = (window.__EVIL || '') + ' | ' + key + ' => ' + JSON.stringify(bad);
  } catch (e) {
    setr(key, false);
    window.__EVIL = (window.__EVIL || '') + ' | ' + key + ' THREW ' + String(e && e.message);
  }
}
window.__RESULTS = results;
window.__EVIL = window.__EVIL || '';
window.__DONE = true;
<\/script></body></html>`;
fs.writeFileSync(path.join(ROOT, '__probe_sanitize.html'), PAGE);

const pw = await import(pathToFileURL(PW).href);
const chromium = pw.chromium || (pw.default && pw.default.chromium);
const browser = await chromium.launchPersistentContext(path.join(ROOT, 'test', 'zz_san_profile'), {
  executablePath: chrome, headless: true, args: ['--no-proxy-server', '--no-first-run'],
});
try {
  const page = await browser.newPage();
  page.on('pageerror', function (e) { console.error('PAGEERROR:', e.message); });
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'load' });
  await page.waitForFunction('window.__DONE === true', null, { timeout: 15000 });
  const results = await page.evaluate('window.__RESULTS');
  const evil = await page.evaluate('window.__EVIL || ""');
  const names = Object.keys(results).sort();
  let pass = 0; const failed = [];
  names.forEach(function (n) { if (results[n]) pass++; else failed.push(n); });
  console.log(`PASS ${pass}/${names.length}`);
  if (failed.length) console.log('FAILED: ' + failed.join(', '));
  if (evil) console.log('RESIDUAL: ' + evil);
  process.exitCode = failed.length ? 1 : 0;
} finally {
  await browser.close().catch(function () {});
  server.close();
  fs.unlinkSync(path.join(ROOT, '__probe_sanitize.html'));
  fs.rmSync(path.join(ROOT, 'test', 'zz_san_profile'), { recursive: true, force: true });
}
