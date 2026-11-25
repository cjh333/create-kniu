import { createReadStream } from 'node:fs';
import { access, stat } from 'node:fs/promises';
import { createServer, request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { execSync } from 'node:child_process';
import { extname, join, resolve, sep, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const readArg = (name, fallback) => {
  const index = args.indexOf(name);
  const value = index >= 0 ? args[index + 1] : '';
  return value && !value.startsWith('--') ? value : fallback;
};
const root = resolve(readArg('--root', './dist'));
const host = readArg('--host', '127.0.0.1');
const port = Number(readArg('--port', '4173'));
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
let proxyEntries = [];
try {
  const configModule = await import(pathToFileURL(join(projectRoot, 'client', 'client.config.js')).href);
  const devConfig = (configModule.default && configModule.default.server) || {};
  if (devConfig.proxy && typeof devConfig.proxy === 'object') {
    proxyEntries = Object.entries(devConfig.proxy)
      .map(([prefix, value]) => ({
        prefix: String(prefix).replace(/^\/+|\/+$/g, ''),
        target: String((value && value.target) || ''),
        changeOrigin: !!(value && value.changeOrigin)
      }))
      .filter((entry) => entry.target);
  }
} catch { }
function matchProxy(pathname) {
  const p = String(pathname || '').replace(/^\/+/, '');
  return proxyEntries.find((entry) => p === entry.prefix || p.startsWith(entry.prefix + '/')) || null;
}
function proxyRequest(request, response, entry) {
  const targetUrl = new URL(entry.target);
  const isHttps = targetUrl.protocol === 'https:';
  const transporter = isHttps ? httpsRequest : httpRequest;
  const pathOnly = (request.url || '').split('?')[0];
  const query = (request.url || '').split('?')[1];
  const base = targetUrl.pathname === '/' ? '' : targetUrl.pathname;
  const options = {
    protocol: targetUrl.protocol,
    hostname: targetUrl.hostname,
    port: targetUrl.port || (isHttps ? 443 : 80),
    path: base + pathOnly + (query ? '?' + query : ''),
    method: request.method,
    headers: { ...request.headers }
  };
  if (entry.changeOrigin) {
    options.headers.host = targetUrl.host;
    if (request.headers.origin) options.headers.origin = targetUrl.protocol + '//' + targetUrl.host;
  }
  const upstream = transporter(options, (upstreamRes) => {
    const passHeaders = { ...upstreamRes.headers };
    delete passHeaders['transfer-encoding'];
    delete passHeaders['connection'];
    response.writeHead(upstreamRes.statusCode || 502, passHeaders);
    upstreamRes.pipe(response);
  });
  upstream.on('error', (error) => {
    console.error(`[kniu-preview] 代理 ${request.method} ${request.url} -> ${entry.target} 失败：${error.message}`);
    if (!response.headersSent) response.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ status: 0, msg: '代理后端不可达：' + error.message, data: null }));
  });
  request.pipe(upstream);
}
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
const readable = async (file) => { try { return (await stat(file)).isFile(); } catch { return false; } };
const safePath = (pathname) => {
  const raw = String(pathname || '').split('?')[0];
  let decoded;
  try { decoded = decodeURIComponent(raw); } catch { decoded = raw; }
  const candidate = resolve(root, `.${decoded.startsWith('/') ? decoded : `/${decoded}`}`);
  return candidate === root || candidate.startsWith(root + sep) ? candidate : null;
};
const server = createServer(async (request, response) => {
  const pathname = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`).pathname;
  const proxyEntry = matchProxy(pathname);
  if (proxyEntry) { proxyRequest(request, response, proxyEntry); return; }
  const staticPath = pathname.startsWith('/upload/') ? '/public' + pathname : pathname;
  let file = safePath(staticPath);
  if (!file || !(await readable(file))) {
    file = join(root, 'index.html');
    if (!(await readable(file))) { response.writeHead(404); response.end('Build output not found. Run npm run build first.'); return; }
  }
  const contentType = types[extname(file).toLowerCase()] || 'application/octet-stream';
  response.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-cache' });
  createReadStream(file).pipe(response);
});
const killPort = (portNum) => {
  try {
    const output = execSync(`netstat -ano | findstr ":${portNum}" | findstr LISTENING`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const lines = output.trim().split(/\r?\n/).filter(Boolean);
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && /^\d+$/.test(pid)) {
        try {
          execSync(`taskkill /F /PID ${pid}`, { stdio: ['ignore', 'ignore', 'ignore'] });
          console.log(`[kniu-preview] 已自动释放端口 ${portNum}（旧进程 PID ${pid}）。`);
        } catch { }
      }
    }
  } catch { }
};
const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  killPort(port);
  server.listen(port, host, () => console.log(`Kniu preview server: http://${host}:${port}`));
}