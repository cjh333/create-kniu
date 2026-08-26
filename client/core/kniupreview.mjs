import { createServer } from 'node:http';
import { request as httpRequest } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import SERVER from '../config/server.js';
import PROCESS_ENV from './kniuenv.mjs';

const ROOT = normalize(join(process.cwd(), 'dist'));
const VIEW_INDEX = join(ROOT, 'index.html');
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
    let file = PATH_NAME === '/'
      ? VIEW_INDEX
      : normalize(join(ROOT, PATH_NAME.replace(/^\/+/, '')));
    if (!file.startsWith(`${ROOT}\\`) && file !== ROOT) throw new Error('Invalid path');
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
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
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end(await readFile(VIEW_INDEX));
    } catch {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
    }
  }
});
server.listen(SERVER.PORT + 1, SERVER.HOST, function () {
  const PROTOCOL = typeof server.setSecureContext === 'function' ? 'https' : 'http';
  console.log(`KniuSystem preview server is started on <${PROTOCOL}://${SERVER.HOST}:${SERVER.PORT + 1}/>`);
  console.log(`Preview document root is: ${ROOT}`);
  console.log('(Ctrl+C exit)');
});