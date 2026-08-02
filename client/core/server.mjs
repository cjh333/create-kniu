import { SERVER } from '../config/server.js';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { collectTemplates } from './base.mjs';
const root = process.cwd();

async function createTemplateManifest() {
  const templates = await collectTemplates('views');
  return `globalThis.__VIEW_TEMPLATES__ = ${JSON.stringify(templates)};`;
}
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
};

function resolveRequestProtocol(request) {
  const forwardedProtocol = request.headers['x-forwarded-proto'];
  const protocol = Array.isArray(forwardedProtocol)
    ? forwardedProtocol[0]
    : forwardedProtocol?.split(',')[0].trim();
  if (protocol === 'http' || protocol === 'https') return protocol;
  return request.socket.encrypted ? 'https' : 'http';
}
const server = createServer(async (request, response) => {
  try {
    const protocol = resolveRequestProtocol(request);
    const host = request.headers.host || `${SERVER.HOST}:${SERVER.PORT}`;
    const pathname = decodeURIComponent(new URL(request.url, `${protocol}://${host}`).pathname);
    if (pathname === '/templates.js') {
      response.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' });
      response.end(await createTemplateManifest());
      return;
    }
    let file = normalize(join(root, pathname === '/' ? 'index.html' : pathname));
    if (!file.startsWith(root)) throw new Error('Invalid path');
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
    if (extname(file) === '.html' && (pathname === '/' || pathname.endsWith('/index.html'))) {
      let html = (await readFile(file)).toString();
      const marker = '<script type="module" src="/client/core/base.mjs"></script>';
      if (html.includes(marker)) {
        html = html.replace(marker, `<script src="/templates.js"></script>\n${marker}`);
      } else {
        html = html.replace('</head>', `<script src="/templates.js"></script></head>`);
      }
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end(html);
      return;
    }
    response.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' });
    response.end(await readFile(file));
  } catch {
    response.writeHead(404).end('Not found');
  }
});
server.listen(SERVER.PORT, SERVER.HOST, () => {
  const protocol = typeof server.setSecureContext === 'function' ? 'https' : 'http';
  console.log(`KniuSystem ${SERVER.PROCESS_ENV} server is started on <${protocol}://${SERVER.HOST}:${SERVER.PORT}/>`);
  console.log(`Document root is: ${root}\\public`);
});
