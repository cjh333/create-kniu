#!/usr/bin/env node
import { createReadStream } from 'node:fs';
import { access, readFile, readdir, stat } from 'node:fs/promises';
import { watch } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log('用法：kniu-dev [--port 5173] [--host 127.0.0.1] [--root .]');
  process.exit(0);
}
const valueAfter = (name, fallback) => {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  const value = args[index + 1];
  return value && !value.startsWith('--') ? value : fallback;
};
const configPath = resolve(valueAfter('--config', 'kniu.config.js'));
let config = {};
try { config = (await import(pathToFileURL(configPath).href)).default || {}; }
catch (error) { if (error.code !== 'ERR_MODULE_NOT_FOUND') throw new Error(`无法加载 ${configPath}：${error.message}`); }
const devConfig = config.server && typeof config.server === 'object' ? config.server : {};
const port = Number(valueAfter('--port', String(devConfig.port || '5173')));
const host = valueAfter('--host', devConfig.host || '127.0.0.1');
const root = resolve(valueAfter('--root', '.'));
const configRoot = typeof config.root === 'string' ? config.root : './client/views';
const projectViewEntry = resolve(root, configRoot, 'index.html');
const entryHtml = async () => (await readable(projectViewEntry)) ? projectViewEntry : join(root, 'index.html');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.ico': 'image/x-icon' };
const hmrClients = new Set();
const hmrScript = '<script>new EventSource("/__kniu_hmr").onmessage=(e)=>{let u={};try{u=JSON.parse(e.data)}catch{};if(!globalThis.__KNIU_HMR_DISPATCH__?.(u))location.reload()}</script>';
const templateDirectories = Array.isArray(config.templates?.dirs) && config.templates.dirs.length ? config.templates.dirs : ['./client/views'];
const aliases = config.resolve?.alias && typeof config.resolve.alias === 'object' ? config.resolve.alias : {};

function resolveAliasRequest(urlPath) {
  const pathname = decodeURIComponent(String(urlPath || '').split('?')[0]);
  const normalizedPath = pathname.replace(/^\/+/, '');
  const match = Object.entries(aliases)
    .sort(([left], [right]) => right.length - left.length)
    .find(([alias]) => normalizedPath === alias || normalizedPath.startsWith(`${alias}/`));
  if (!match) return pathname;
  const [alias, target] = match;
  const suffix = normalizedPath.slice(alias.length).replace(/^\/+/, '');
  return `/${String(target).replaceAll('\\', '/').replace(/^\.\//, '').replace(/^\/+|\/+$/g, '')}/${suffix}`;
}
async function templateManifest(directory, base = directory, templates = {}) {
  let entries = [];
  try { entries = await readdir(directory, { withFileTypes: true }); } catch { return templates; }
  for (const entry of entries) {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) await templateManifest(file, base, templates);
    else if (entry.isFile() && entry.name.endsWith('.html') && resolve(file) !== resolve(root, configRoot, 'index.html')) {
      const key = '/' + file.slice(root.length + 1).replaceAll('\\', '/');
      templates[key] = await readFile(file, 'utf8');
    }
  }
  return templates;
}
async function allTemplateManifest() {
  const templates = {};
  for (const directory of templateDirectories) await templateManifest(resolve(root, directory), resolve(root, directory), templates);
  return templates;
}
function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const candidate = resolve(root, '.' + (decoded.startsWith('/') ? decoded : '/' + decoded));
  return candidate === root || candidate.startsWith(root + sep) ? candidate : null;
}
async function readable(path) {
  try { await access(path); return (await stat(path)).isFile(); } catch { return false; }
}
const server = createServer(async (request, response) => {
  // Development parity with production baseline. Inline is retained only for
  // the dev HMR/bootstrap scripts; runtime templates no longer require eval.
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.setHeader('X-Frame-Options', 'SAMEORIGIN');
  response.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  response.setHeader('Content-Security-Policy', "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'");
  if ((request.url || '').split('?')[0] === '/templates.js') {
    const templates = await allTemplateManifest();
    response.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-cache' });
    response.end(`globalThis.__VIEW_TEMPLATES__=${JSON.stringify(templates)};`);
    return;
  }
  if ((request.url || '').split('?')[0] === '/__kniu_hmr') {
    response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'Access-Control-Allow-Origin': '*' });
    response.write(': connected\n\n');
    hmrClients.add(response);
    request.on('close', () => hmrClients.delete(response));
    return;
  }
  const requested = safePath(resolveAliasRequest(request.url || '/'));
  let file = requested && (await readable(requested)) ? requested : null;
  const requestUrl = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
  if (file && requestUrl.searchParams.has('module') && ['.html', '.css'].includes(extname(file).toLowerCase())) {
    const source = await readFile(file, 'utf8');
    response.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-cache' });
    response.end(`export default ${JSON.stringify(source)};`);
    return;
  }
  if (!file && (!extname(requested || '') || request.headers.accept?.includes('text/html'))) file = await entryHtml();
  if (!file || !(await readable(file))) { response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); response.end('Not Found'); return; }
  const contentType = types[extname(file).toLowerCase()] || 'application/octet-stream';
  if (contentType.startsWith('text/html')) {
    // 页面只保留唯一入口脚本，模板清单由 client.mjs 挂载的模板引擎在运行时动态加载。
    const html = await readFile(file, 'utf8');
    response.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-cache' });
    response.end(html.includes('/__kniu_hmr') ? html : html.replace('</body>', `${hmrScript}</body>`));
    return;
  }
  response.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-cache' });
  createReadStream(file).pipe(response);
});
try {
  const watcher = watch(root, { recursive: true }, (event, filename) => {
    if (!filename || String(filename).includes(`${sep}node_modules${sep}`) || String(filename).includes(`${sep}dist${sep}`)) return;
    for (const client of hmrClients) client.write(`data: ${JSON.stringify({ event, filename: String(filename) })}\n\n`);
  });
  process.on('SIGINT', () => watcher.close());
} catch (error) { console.warn(`[kniu-dev] HMR watcher unavailable: ${error.message}`); }
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') console.error(`[kniu-dev] 端口 ${port} 已被占用，请先结束占用该端口的进程，或用 --port 指定其他端口。`);
  else console.error(`[kniu-dev] 服务器启动失败：${error.message}`);
  process.exit(1);
});
server.listen(port, host, () => console.log(`Kniu dev server: http://${host}:${port}`));
process.on('SIGINT', () => server.close(() => process.exit(0)));
