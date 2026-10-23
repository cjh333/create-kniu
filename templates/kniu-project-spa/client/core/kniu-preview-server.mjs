import { createReadStream } from 'node:fs';
import { access, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, resolve, sep } from 'node:path';

const args = process.argv.slice(2);
const readArg = (name, fallback) => {
  const index = args.indexOf(name);
  const value = index >= 0 ? args[index + 1] : '';
  return value && !value.startsWith('--') ? value : fallback;
};
const root = resolve(readArg('--root', './dist'));
const host = readArg('--host', '127.0.0.1');
const port = Number(readArg('--port', '4173'));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
const readable = async (file) => { try { return (await stat(file)).isFile(); } catch { return false; } };
const safePath = (pathname) => {
  const decoded = decodeURIComponent(pathname.split('?')[0]);
  const candidate = resolve(root, `.${decoded.startsWith('/') ? decoded : `/${decoded}`}`);
  return candidate === root || candidate.startsWith(root + sep) ? candidate : null;
};
const server = createServer(async (request, response) => {
  const pathname = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`).pathname;
  let file = safePath(pathname);
  if (!file || !(await readable(file))) {
    file = join(root, 'index.html');
    if (!(await readable(file))) { response.writeHead(404); response.end('Build output not found. Run npm run build first.'); return; }
  }
  const contentType = types[extname(file).toLowerCase()] || 'application/octet-stream';
  response.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-cache' });
  createReadStream(file).pipe(response);
});
server.listen(port, host, () => console.log(`Kniu preview server: http://${host}:${port}`));
