import { createServer } from 'node:http';
import { request as httpRequest } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import SERVER from '../config/server.js';
import PROCESS_ENV from './kniuenv.mjs';
import { resolveAliasReferences } from './kniuutil.mjs';
import collectTemplates from './kniubuilder.mjs';

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
const NO_CACHE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'Pragma': 'no-cache',
};
function resolveRequestProtocol(request) {
  const forwardedProtocol = request.headers['x-forwarded-proto'];
  const protocol = Array.isArray(forwardedProtocol)
    ? forwardedProtocol[0]
    : forwardedProtocol?.split(',')[0].trim();
  if (protocol === 'http' || protocol === 'https') return protocol;
  return request.socket.encrypted ? 'https' : 'http';
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
      response.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', ...NO_CACHE });
      response.end(await createTemplateManifest());
      return;
    }
    let file = PATH_NAME === '/'
      ? VIEW_INDEX
      : PATH_NAME === '/upload' || PATH_NAME.startsWith('/upload/')
        ? normalize(join(ROOT, 'public', PATH_NAME))
        : normalize(join(ROOT, PATH_NAME));
    if (!file.startsWith(ROOT)) throw new Error('Invalid path');
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
    if (extname(file) === '.html' && (PATH_NAME === '/' || PATH_NAME.endsWith('/index.html'))) {
      let html = resolveAliasReferences((await readFile(file)).toString(), SERVER.ALIAS);
      const marker = '<script src="client/client.mjs" type="module"></script>';
      if (html.includes(marker)) {
        html = html.replace(marker, `<script src="/templates.js"></script>\n${marker}`);
      } else {
        html = html.replace('</head>', `<script src="/templates.js"></script></head>`);
      }
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', ...NO_CACHE });
      response.end(html);
      return;
    }
    response.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', ...NO_CACHE });
    response.end(await readFile(file));
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
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
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