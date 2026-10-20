import { request as httpRequest } from 'node:http';
import SERVER from '../config/server.js';

export const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
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

function getApiTarget() {
  const proxy = SERVER.PROXY || {};
  for (const [prefix, cfg] of Object.entries(proxy)) {
    if (prefix === '/api' && cfg.url) {
      const u = new URL(cfg.url);
      return {
        host: u.hostname,
        port: u.port || (u.protocol === 'https:' ? 443 : 80),
        origin: u.origin,
        changeOrigin: cfg.change_origin === true
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
    const outHeaders = {};
    for (const key of ['set-cookie', 'content-type', 'content-length']) {
      const val = apiRes.headers[key];
      if (val) outHeaders[key] = val;
    }
    res.writeHead(apiRes.statusCode, outHeaders);
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

export function handleApiRequest(req, res) {
  if (API_TARGET) {
    proxyToApi(req, res);
    return;
  }
  res.writeHead(502, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 502, msg: 'API 代理未配置，请在 server.js 的 PROXY 中设置' }));
}

export function resolveRequestProtocol(request) {
  const forwardedProtocol = request.headers['x-forwarded-proto'];
  const protocol = Array.isArray(forwardedProtocol)
    ? forwardedProtocol[0]
    : forwardedProtocol?.split(',')[0].trim();
  if (protocol === 'http' || protocol === 'https') return protocol;
  return request.socket.encrypted ? 'https' : 'http';
}