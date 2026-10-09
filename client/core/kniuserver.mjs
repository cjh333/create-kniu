import PROCESS_ENV from './kniudotenv.mjs';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import SERVER from '../config/server.js';
import { resolveAliasReferences } from './kniuutil.mjs';
import collectTemplates, { collectDocs } from './kniubuilder.mjs';
import { NO_CACHE, sendStaticBody, staticCacheHeaders } from './kniustatic.mjs';
import { MIME_TYPES, handleApiRequest, resolveRequestProtocol } from './kniuproxy.mjs';

const ROOT = process.cwd();
const VIEW_DIRECTORY = String(SERVER.VIEWS || '/views').replaceAll('\\', '/').replace(/^\/+|\/+$/g, '');
const VIEW_INDEX = join(ROOT, VIEW_DIRECTORY, 'index.html');

async function createTemplateManifest() {
  const templates = await collectTemplates();
  const docs = await collectDocs();
  return `globalThis.__VIEW_TEMPLATES__ = ${JSON.stringify(templates)};\nglobalThis.__VIEW_DOCS__ = ${JSON.stringify(docs)};`;
}

const server = createServer(async function (request, response) {
  let PATH_NAME = '';
  try {
    const PROTOCOL = resolveRequestProtocol(request);
    const parsedUrl = new URL(request.url, `${PROTOCOL}://${request.headers.host}`);
    PATH_NAME = decodeURIComponent(parsedUrl.pathname);
    if (PATH_NAME.startsWith('/api/')) {
      handleApiRequest(request, response);
      return;
    }
    if (PATH_NAME === '/templates.js') {
      const body = await createTemplateManifest();
      const headers = { 'Content-Type': 'text/javascript; charset=utf-8', ...NO_CACHE };
      await sendStaticBody(request, response, headers, Buffer.from(body));
      return;
    }
    // 文本模块通道：`/client/**/*.css?module`、`/client/**/*.html?module` → `export default "<文本>"`。
    // 浏览器里要让组件「同步」拿到文本（样式必须随组件挂载同步生效，不能异步 fetch），
    // 只能把它们当 JS 模块来 import；`?module` 是这条通道的显式标记，普通 .css/.html 请求不受影响。
    // .css 供组件样式（adoptSharedStyle 会做 px→vw 改写，见 SKILL #126），
    // .html 供组件 shadow 模板骨架（组件目录化三件套，见规则 #177）。
    // dist 侧由 kniubuilder 的 .css/.html 分支产出同语义模块，两侧必须一致。
    if (parsedUrl.searchParams.has('module') && (extname(PATH_NAME) === '.css' || extname(PATH_NAME) === '.html')) {
      const textFile = normalize(join(ROOT, PATH_NAME));
      if (!textFile.startsWith(ROOT)) throw new Error('Invalid path');
      const body = `export default ${JSON.stringify(await readFile(textFile, 'utf8'))};`;
      await sendStaticBody(request, response, { 'Content-Type': 'text/javascript; charset=utf-8', ...NO_CACHE }, Buffer.from(body));
      return;
    }
    let file = PATH_NAME === '/'
      ? VIEW_INDEX
      : PATH_NAME === '/upload' || PATH_NAME.startsWith('/upload/')
        ? normalize(join(ROOT, 'public', PATH_NAME.replace(/^\/+/, '')))
        : normalize(join(ROOT, PATH_NAME));
    if (!file.startsWith(ROOT)) throw new Error('Invalid path');
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
    const mime = MIME_TYPES[extname(file)] || 'application/octet-stream';
    if (extname(file) === '.html' && (PATH_NAME === '/' || PATH_NAME.endsWith('/index.html'))) {
      let html = resolveAliasReferences((await readFile(file)).toString(), SERVER.ALIAS);
      const marker = '<script src="client/client.mjs" type="module"></script>';
      if (html.includes(marker)) {
        html = html.replace(marker, `<script src="/templates.js"></script>\n${marker}`);
      } else {
        html = html.replace('</head>', `<script src="/templates.js"></script></head>`);
      }
      await sendStaticBody(request, response, { 'Content-Type': 'text/html; charset=utf-8', ...NO_CACHE }, Buffer.from(html));
      return;
    }
    const buffer = await readFile(file);
    const cacheHeaders = staticCacheHeaders(file, PATH_NAME, mime);
    await sendStaticBody(request, response, { 'Content-Type': mime, ...cacheHeaders }, buffer);
  } catch (err) {
    if (err.code === 'ENOENT' && extname(PATH_NAME) && extname(PATH_NAME) !== '.html') {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }
    if (err.code !== 'ENOENT') console.error('[Server Error]', err.message);
    try {
      const indexHtml = resolveAliasReferences((await readFile(VIEW_INDEX)).toString(), SERVER.ALIAS);
      const marker = '<script src="client/client.mjs" type="module"></script>';
      const html = indexHtml.includes(marker)
        ? indexHtml.replace(marker, `<script src="/templates.js"></script>\n${marker}`)
        : indexHtml.replace('</head>', `<script src="/templates.js"></script></head>`);
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', ...NO_CACHE });
      response.end(html);
    } catch {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
    }
  }
});

server.listen(SERVER.PORT, SERVER.HOST, function () {
  const PROTOCOL = typeof server.setSecureContext === 'function' ? 'https' : 'http';
  console.log(`KniuSystem ${PROCESS_ENV} server is started on <${PROTOCOL}://${SERVER.HOST}:${SERVER.PORT}/>`);
  console.log(`Document root is: ${ROOT}\\public`);
  console.log('(Ctrl+C exit)');
});
