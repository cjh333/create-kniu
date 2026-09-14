import PROCESS_ENV from './kniudotenv.mjs';
import { createServer } from 'node:http';
import { request as httpRequest } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import SERVER from '../config/server.js';
import { resolveAliasReferences } from './kniuutil.mjs';
import collectTemplates from './kniubuilder.mjs';
import { NO_CACHE, sendStaticBody, staticCacheHeaders } from './kniustatic.mjs';
import { broadcast, subscribe } from './kniussemitter.mjs';

const ROOT = process.cwd();
const VIEW_DIRECTORY = String(SERVER.VIEWS || '/views').replaceAll('\\', '/').replace(/^\/+|\/+$/g, '');
const VIEW_INDEX = join(ROOT, VIEW_DIRECTORY, 'index.html');
function getApiTarget() {
  const proxy = SERVER.PROXY || {};
  for (const [prefix, cfg] of Object.entries(proxy)) {
    if (prefix === '/api' && cfg.URL) {
      const u = new URL(cfg.URL);
      return {
        host: u.hostname,
        port: u.port || (u.protocol === 'https:' ? 443 : 80),
        origin: u.origin,
        changeOrigin: cfg.CHANGE_ORIGIN === true
      };
    }
  }
  return null;
}
const API_TARGET = getApiTarget();

function proxyToApi(req, res) {
  const headers = { ...req.headers, host: `${API_TARGET.host}:${API_TARGET.port}` };
  if (API_TARGET.changeOrigin && headers.origin) headers.origin = API_TARGET.origin;
  const opts = {
    hostname: API_TARGET.host,
    port: API_TARGET.port,
    path: req.url.replace(/^\/api/, ''),
    method: req.method,
    headers,
  };
  const proxy = httpRequest(opts, function (apiRes) {
    const headers = {};
    for (const key of ['set-cookie', 'content-type', 'content-length']) {
      const val = apiRes.headers[key];
      if (val) headers[key] = val;
    }
    res.writeHead(apiRes.statusCode, headers);
    apiRes.pipe(res);
  });
  proxy.on('error', function () {
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 502, msg: 'API 服务不可用' }));
    }
  });
  req.pipe(proxy);
}

async function createTemplateManifest() {
  const templates = await collectTemplates();
  return `globalThis.__VIEW_TEMPLATES__ = ${JSON.stringify(templates)};`;
}
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.ogg': 'application/ogg',
  '.mov': 'video/quicktime',
};
function resolveRequestProtocol(request) {
  const forwardedProtocol = request.headers['x-forwarded-proto'];
  const protocol = Array.isArray(forwardedProtocol)
    ? forwardedProtocol[0]
    : forwardedProtocol?.split(',')[0].trim();
  if (protocol === 'http' || protocol === 'https') return protocol;
  return request.socket.encrypted ? 'https' : 'http';
}
function isLoopbackHost(host) {
  if (!host) return false;
  let name = host;
  // IPv6 字面量形如 [::1]:6987，方括号内才是地址本体；直接用 ':' 切分会得到 '['。
  // 旧实现对 IPv6 Host 一律误判为非回环 → 合法的本机 /__notify 被 403。
  if (name.startsWith('[')) {
    const end = name.indexOf(']');
    name = end >= 0 ? name.slice(0, end + 1) : name;
  } else {
    name = name.split(':')[0];
  }
  name = name.toLowerCase();
  return name === 'localhost' || name === '127.0.0.1' || name === '[::1]' || name === '::1';
}
function handleEventStream(request, response) {
  response.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  response.write('retry: 5000\n\n');
  const unsubscribe = subscribe(response);
  const onClose = function () { unsubscribe(); };
  const onError = function () { unsubscribe(); };
  request.on('close', onClose);
  request.on('error', onError);
  response.on('close', onClose);
  response.on('error', onError);
}
function handleNotifySignal(request, response) {
  // 内网本机回环触发广播；即便被外部猜到也只多发一次"去刷新"空信号，无用户数据泄露。
  if (!isLoopbackHost(request.headers.host)) {
    response.writeHead(403, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ status: 0, msg: 'forbidden' }));
    return;
  }
  // 信号类型由查询参数区分：
  //   type=data-change（Core\DataSignal 在写库后汇总触发，带 revision）
  //   其它/缺省 = 旧的 reply-refresh（后台审核回复触发，不带数据）。
  let type = 'reply-refresh';
  let revision = 0;
  try {
    const parsedNotify = new URL(request.url, `http://${request.headers.host}`);
    const rawType = parsedNotify.searchParams.get('type') || '';
    if (rawType === 'data-change') type = 'data-change';
    revision = Number(parsedNotify.searchParams.get('revision') || 0) || 0;
  } catch {
    // 解析失败按缺省信号处理，不影响广播。
  }
  if (type === 'data-change') broadcast('data-change', { revision });
  else broadcast('reply-refresh');
  response.writeHead(200, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify({ status: 1, msg: 'ok', type, revision }));
}
const server = createServer(async function (request, response) {
  let PATH_NAME = '';
  try {
    const PROTOCOL = resolveRequestProtocol(request);
    const parsedUrl = new URL(request.url, `${PROTOCOL}://${request.headers.host}`);
    PATH_NAME = decodeURIComponent(parsedUrl.pathname);
    if (PATH_NAME.startsWith('/api/')) {
      if (API_TARGET) {
        proxyToApi(request, response);
      } else {
        response.writeHead(502, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ status: 502, msg: 'API 代理未配置，请在 server.js 的 PROXY 中设置' }));
      }
      return;
    }
    if (PATH_NAME === '/templates.js') {
      const body = await createTemplateManifest();
      const headers = { 'Content-Type': 'text/javascript; charset=utf-8', ...NO_CACHE };
      await sendStaticBody(request, response, headers, Buffer.from(body));
      return;
    }
    if (PATH_NAME === '/events' && request.method === 'GET') {
      handleEventStream(request, response);
      return;
    }
    if (PATH_NAME === '/__notify') {
      handleNotifySignal(request, response);
      return;
    }
    let file = PATH_NAME === '/'
      ? VIEW_INDEX
      : PATH_NAME === '/upload' || PATH_NAME.startsWith('/upload/')
        ? normalize(join(ROOT, 'public', PATH_NAME.replace(/^\/+/, '')))
        : normalize(join(ROOT, PATH_NAME));
    if (!file.startsWith(ROOT)) throw new Error('Invalid path');
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
    const mime = types[extname(file)] || 'application/octet-stream';
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
