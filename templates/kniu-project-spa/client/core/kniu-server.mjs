#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream, existsSync, mkdirSync } from 'node:fs';
import { access, readFile, readdir, stat } from 'node:fs/promises';
import { watch } from 'node:fs';
import { createServer, request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { deepMerge } from './Kniu-Merge.mjs';
import { resolveAliasReferences } from './Kniu-Util.mjs';
import { withBootLoadingHtml } from './Kniu-BootLoading.mjs';
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
const configPath = resolve(valueAfter('--config', 'client/client.config.js'));
let config = {};
try { config = (await import(pathToFileURL(configPath).href)).default || {}; }
catch (error) { if (error.code !== 'ERR_MODULE_NOT_FOUND') throw new Error(`无法加载 ${configPath}：${error.message}`); }
const configDirectory = dirname(configPath);
const importRelative = async (name) => (await import(pathToFileURL(join(configDirectory, 'config', name)).href)).default || {};
const [projectRoutes, projectBases, projectViews, projectAuth] = await Promise.all([
  importRelative('router.js'), importRelative('server.js'), importRelative('viewer.js'), importRelative('auth.js')
]);
const projectSettings = {
  routes: projectRoutes,
  views: projectViews,
  ...projectBases,
  auth: projectAuth
};
config = deepMerge(config, projectSettings);

const root = resolve(valueAfter('--root', '.'));
const debugConfig = config.debug && typeof config.debug === 'object' ? config.debug : {};
const LOG_ENABLED = debugConfig.log === true;
let logDir = null;
let currentLogStream = null;
let currentLogDate = null;

function _pad(n) { return String(Math.abs(n)).padStart(2, '0'); }

function _nowIso() {
  const d = new Date();
  const tzo = -d.getTimezoneOffset();
  const sign = tzo >= 0 ? '+' : '-';
  return `${d.getFullYear()}-${_pad(d.getMonth() + 1)}-${_pad(d.getDate())}T${_pad(d.getHours())}:${_pad(d.getMinutes())}:${_pad(d.getSeconds())}.${_pad(d.getMilliseconds())}${sign}${_pad(tzo / 60)}:${_pad(tzo % 60)}`;
}

function _todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${_pad(d.getMonth() + 1)}-${_pad(d.getDate())}`;
}

function _ensureLogStream() {
  if (!LOG_ENABLED) return null;
  const today = _todayStr();
  if (today === currentLogDate && currentLogStream) return currentLogStream;
  if (currentLogStream) { try { currentLogStream.end(); } catch { } currentLogStream = null; }
  if (!logDir) logDir = resolve(root, 'client/runtime/logs');
  if (!existsSync(logDir)) { mkdirSync(logDir, { recursive: true }); }
  currentLogDate = today;
  const filePath = join(logDir, `${today}.log`);
  currentLogStream = createWriteStream(filePath, { flags: 'a', encoding: 'utf8' });
  return currentLogStream;
}

function _serializeArgs(args) {
  return args.map(function (a) {
    if (a == null) return String(a);
    if (typeof a === 'object') { try { return JSON.stringify(a); } catch { return String(a); } }
    return String(a);
  }).join(' ');
}

function _writeLogLine(level, args) {
  if (!LOG_ENABLED) return;
  const stream = _ensureLogStream();
  if (!stream) return;
  const line = `[${_nowIso()}] [${level}] ${_serializeArgs(args)}\n`;
  try { stream.write(line); } catch { }
}

function _setupConsoleTrap() {
  const origLog = console.log;
  const origWarn = console.warn;
  const origError = console.error;
  const origInfo = console.info;
  const origDebug = console.debug;
  console.log = function (...args) { origLog.apply(console, args); _writeLogLine('log', args); };
  console.warn = function (...args) { origWarn.apply(console, args); _writeLogLine('warn', args); };
  console.error = function (...args) { origError.apply(console, args); _writeLogLine('error', args); };
  console.info = function (...args) { origInfo.apply(console, args); _writeLogLine('info', args); };
  console.debug = function (...args) { origDebug.apply(console, args); _writeLogLine('debug', args); };
}

if (LOG_ENABLED) {
  _setupConsoleTrap();
  process.on('exit', function () { if (currentLogStream) { try { currentLogStream.end(); } catch { } } });
}

const devConfig = config.server && typeof config.server === 'object' ? config.server : {};
const imageProxyHosts = Array.isArray(config.imageProxy?.domainWhitelist) ? config.imageProxy.domainWhitelist : [];
const buildCsp = () => {
  const connectSources = ["'self'", ...imageProxyHosts.map((host) => `https://${host}`)].join(' ');
  return `default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src ${connectSources}`;
};
const port = Number(valueAfter('--port', String(devConfig.port || '5173')));
const host = valueAfter('--host', devConfig.host || '127.0.0.1');
const PROCESS_ENV = devConfig.version || 'dev';
const PUBLIC_DIRECTORY = String(config.publicDir || 'public').replace(/^\.\//, '').replace(/\/+$/, '');
const configRoot = typeof config.root === 'string' ? config.root : './client/views';
const projectViewEntry = resolve(root, configRoot, 'index.html');
const entryHtml = async () => (await readable(projectViewEntry)) ? projectViewEntry : join(root, 'index.html');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.md': 'text/markdown; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.ico': 'image/x-icon' };
const hmrClients = new Set();
const hmrConfig = devConfig.hmr && typeof devConfig.hmr === 'object' ? devConfig.hmr : {};
const hmrEnabled = hmrConfig.enabled !== false;
const hmrReload = hmrConfig.reload === true;
const hmrScript = `<script>if(!globalThis.__KNIU_HMR_SOURCE__){const s=globalThis.__KNIU_HMR_SOURCE__=new EventSource("/__kniu_hmr");let q=[],drain=null;const RELOAD=${hmrReload ? 'true' : 'false'};const ROOT=document.getElementById("client")||document.body;const ENCODER=globalThis.TextEncoder?new TextEncoder():null;const digest=async function(text){if(ENCODER&&globalThis.crypto&&crypto.subtle){try{const buf=await crypto.subtle.digest("SHA-1",ENCODER.encode(text));return Array.from(new Uint8Array(buf)).map(function(b){return b.toString(16).padStart(2,"0")}).join("")}catch(err){}}let h=0;for(let i=0;i<text.length;i++){h=(h*31+text.charCodeAt(i))|0}return "f"+h};const snapshot=function(){try{return digest(String(ROOT&&ROOT.innerHTML||""))}catch(err){return Promise.resolve("")}};let contentHash="";let hashQueued=false;const applyHash=function(h){contentHash=h;globalThis.__KNIU_HMR_CONTENT_HASH__=h};const scheduleHash=function(){if(hashQueued)return;hashQueued=true;const run=function(){hashQueued=false;snapshot().then(applyHash)};if(globalThis.requestAnimationFrame)requestAnimationFrame(run);else setTimeout(run,16)};if(globalThis.MutationObserver&&ROOT)new MutationObserver(scheduleHash).observe(ROOT,{childList:true,characterData:true,subtree:true});snapshot().then(applyHash);const nextFrame=function(){return new Promise(function(r){if(globalThis.requestAnimationFrame)requestAnimationFrame(function(){setTimeout(r,0)});else setTimeout(r,16)})};const flush=async function(){const batch=q.slice();q.length=0;if(!batch.length)return;const before=await snapshot();let handled=false;try{handled=!!(globalThis.__KNIU_HMR_DISPATCH__&&await globalThis.__KNIU_HMR_DISPATCH__(batch))}catch(err){console.warn("[kniu-hmr] 分发失败：",err)}console.info("[kniu-hmr] flush",batch.map(function(x){return x&&x.filename}).join(","),"handled="+handled);if(!handled){if(!RELOAD){console.info("[kniu-hmr] 本次变更未接管，已跳过自动刷新（需要时手动刷新页面）");return}const t0=Date.now();while(Date.now()-t0<5000&&document.querySelector("[aria-busy=true],[data-kniu-loading]")){await new Promise(function(r){setTimeout(r,120)})}const after=await snapshot();if(after===before){console.info("[kniu-hmr] 页面内容未变化，已跳过整页刷新");return}console.info("[kniu-hmr] 等待空闲后整页刷新");location.reload();return}await nextFrame();snapshot().then(function(h){if(h!==before){contentHash=h;globalThis.__KNIU_HMR_CONTENT_HASH__=h}})};s.onmessage=function(e){let u={};try{u=JSON.parse(e.data)}catch(err){}q.push(u);clearTimeout(drain);drain=setTimeout(flush,350)}}</script>`;
const proxyEntries = (devConfig.proxy && typeof devConfig.proxy === 'object')
  ? Object.entries(devConfig.proxy)
    .map(([prefix, value]) => ({
      prefix: String(prefix).replace(/^\/+|\/+$/g, ''),
      target: String((value && value.target) || ''),
      changeOrigin: !!(value && value.changeOrigin)
    }))
    .filter((entry) => entry.target)
  : [];

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
    console.error(`[kniu-dev] 代理 ${request.method} ${request.url} -> ${entry.target} 失败：${error.message}`);
    if (!response.headersSent) response.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ status: 0, msg: '代理后端不可达：' + error.message, data: null }));
  });
  request.pipe(upstream);
}

const templateDirectories = Array.isArray(config.templates?.dirs) && config.templates.dirs.length ? config.templates.dirs : ['./client/views'];
const aliases = config.resolve?.alias && typeof config.resolve.alias === 'object' ? config.resolve.alias : {};

function resolveAliasRequest(urlPath) {
  const pathname = decodeURIComponent(String(urlPath || '').split('?')[0]);
  const legacyComponent = /^\/client\/core\/Kniu-Ui\/Kniu-([^/]+)\/(.+)$/.exec(pathname);
  if (legacyComponent) {
    const componentName = legacyComponent[1];
    if (componentName.endsWith('Component')) return pathname;
    if (componentName === 'Other') return pathname;
    const targetDirectory = `Kniu-${componentName}Component`;
    const legacyFile = legacyComponent[2];
    const fileName = legacyFile.replace(new RegExp(`^Kniu-${componentName}`, 'i'), `Kniu-${componentName}Component`);
    return `/client/core/Kniu-Ui/${targetDirectory}/${fileName}`;
  }
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
  const raw = String(urlPath || '').split('?')[0];
  let decoded;
  try { decoded = decodeURIComponent(raw); } catch { decoded = raw; }
  const candidate = resolve(root, '.' + (decoded.startsWith('/') ? decoded : '/' + decoded));
  return candidate === root || candidate.startsWith(root + sep) ? candidate : null;
}
async function readable(path) {
  try { await access(path); return (await stat(path)).isFile(); } catch { return false; }
}
async function readableInClientPublic(rawPath) {
  if (!rawPath) return false;
  const clientPath = resolve(root, 'client/public' + rawPath);
  try { await access(clientPath); return (await stat(clientPath)).isFile(); } catch { return false; }
}
function plainVariantPath(requestPath) {
  const match = /^(.*)\.min\.(css|js|mjs|json)$/i.exec(String(requestPath || ''));
  return match ? `${match[1]}.${match[2]}` : null;
}
const server = createServer(async (request, response) => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.setHeader('X-Frame-Options', 'SAMEORIGIN');
  response.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  response.setHeader('Content-Security-Policy', buildCsp());
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
  if ((request.url || '').split('?')[0] === '/__kniu_logs') {
    if (!LOG_ENABLED) { response.writeHead(404); response.end(); return; }
    let body = '';
    request.on('data', function (chunk) { body += chunk; });
    request.on('end', function () {
      let entries = [];
      try {
        const parsed = JSON.parse(body || 'null');
        if (Array.isArray(parsed)) entries = parsed;
        else if (parsed && Array.isArray(parsed.entries)) entries = parsed.entries;
      } catch { }
      if (entries.length) {
        const stream = _ensureLogStream();
        if (stream) {
          entries.forEach(function (entry) {
            const ts = entry.t || entry.timestamp || _nowIso();
            const lvl = entry.lvl || entry.level || 'log';
            const cat = entry.cat || entry.category || '-';
            const msg = entry.msg || entry.message || '';
            try { stream.write(`[${ts}] [${lvl}] [${cat}] ${msg}\n`); } catch { }
          });
        }
      }
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ ok: true, count: entries.length }));
    });
    return;
  }
  const proxyEntry = matchProxy((request.url || '').split('?')[0]);
  if (proxyEntry) { proxyRequest(request, response, proxyEntry); return; }
  const rawRequestPath = String(request.url || '').split('?')[0];
  const staticRequestPath = rawRequestPath.startsWith('/upload/')
    ? '/public' + rawRequestPath
    : (request.url || '/');
  const resolvedRequestPath = resolveAliasRequest(staticRequestPath);
  const requested = resolvedRequestPath.startsWith('/client/core/Kniu-Ui/')
    ? resolve(root, `.${resolvedRequestPath}`)
    : safePath(resolvedRequestPath);
  let file = requested && (await readable(requested)) ? requested : null;
  if (!file && resolvedRequestPath.startsWith('/client/')) {
    const candidates = [
      resolve(root, `.${resolvedRequestPath}`),
      resolve(root, `.${resolvedRequestPath.replace(/^\/client/, '')}`),
      resolve(root, `./client${resolvedRequestPath}`)
    ];
    for (const candidate of candidates) {
      if (await readable(candidate)) { file = candidate; break; }
    }
  }
  if (!file && rawRequestPath.startsWith('/')) {
    const suffix = rawRequestPath.replace(/^\/public/, '');
    const fallbackPath = resolve(root, PUBLIC_DIRECTORY + suffix);
    file = (await readable(fallbackPath)) ? fallbackPath : null;
  }
  if (!file) {
    const plainPath = plainVariantPath(resolvedRequestPath);
    if (plainPath) {
      const candidates = [];
      const safePlain = safePath(plainPath);
      if (safePlain) candidates.push(safePlain);
      if (rawRequestPath.startsWith('/')) {
        const publicFallback = resolve(root, PUBLIC_DIRECTORY + plainPath.replace(/^\/public/, ''));
        if (publicFallback === root || publicFallback.startsWith(root + sep)) candidates.push(publicFallback);
      }
      for (const candidate of candidates) {
        if (await readable(candidate)) { file = candidate; break; }
      }
    }
  }
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
    let html = await readFile(file, 'utf8');
    html = resolveAliasReferences(html, aliases);
    const entryFile = await entryHtml();
    if (file === entryFile) html = withBootLoadingHtml(html);
    if (hmrEnabled && file === entryFile && !html.includes('/__kniu_hmr')) html = html.replace('</body>', `${hmrScript}</body>`);
    response.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-cache' });
    response.end(html);
    return;
  }
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
          console.log(`[kniu-dev] 已自动释放端口 ${portNum}（旧进程 PID ${pid}）。`);
        } catch { }
      }
    }
  } catch { }
};
const isMain = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  killPort(port);
  try {
    const isHmrTarget = (relative) => {
      const p = String(relative || '').replaceAll('\\', '/').replace(/^\/+/, '');
      if (p.startsWith('api/') || p.startsWith('public/upload/') || p.startsWith('runtime/') || p.startsWith('!KniuProject/')) return false;
      if (p.startsWith('client/') || p.startsWith('public/')) return true;
      return ['client.config.js', 'index.html', 'package.json', 'package-lock.json'].includes(p);
    };
    const fileLastHash = new Map();
    const hmrPendingFiles = new Map();
    const computeFileHash = function (filePath) {
      return readFile(filePath).then(function (buffer) {
        return createHash('sha1').update(buffer).digest('hex');
      }).catch(function () { return null; });
    };
    const watcher = watch(root, { recursive: true }, (event, filename) => {
      if (!filename || !isHmrTarget(filename)) return;
      const name = String(filename);
      if (/^(?:\.git|\.codex|\.agents|node_modules|dist)(?:[\\/]|$)/i.test(name)) return;
      if (/(?:^|[\\/])runtime(?:[\\/]|$)/i.test(name)) return;
      hmrPendingFiles.set(name, event);
      clearTimeout(watcher.kniuChangeTimer);
      watcher.kniuChangeTimer = setTimeout(async function () {
        const batch = [...hmrPendingFiles.entries()];
        hmrPendingFiles.clear();
        const changed = [];
        for (const [name, evt] of batch) {
          const currentHash = await computeFileHash(join(root, name));
          const previousHash = fileLastHash.get(name);
          if (currentHash === null) {
            if (previousHash !== undefined) {
              fileLastHash.delete(name);
              changed.push({ event: evt, filename: name });
            }
            continue;
          }
          if (previousHash === currentHash) continue;
          fileLastHash.set(name, currentHash);
          changed.push({ event: evt, filename: name });
        }
        for (const item of changed) {
          for (const client of hmrClients) client.write(`data: ${JSON.stringify(item)}\n\n`);
        }
      }, 300);
    });
    process.on('SIGINT', () => watcher.close());
  } catch (error) { console.warn(`[kniu-dev] HMR watcher unavailable: ${error.message}`); }
  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') console.error(`[kniu-dev] 端口 ${port} 已被占用，请先结束占用该端口的进程，或用 --port 指定其他端口。`);
    else console.error(`[kniu-dev] 服务器启动失败：${error.message}`);
    process.exit(1);
  });
  server.listen(port, host, function () {
    const PROTOCOL = typeof server.setSecureContext === 'function' ? 'https' : 'http';
    console.log(`Kniu ${PROCESS_ENV} server is started on <${PROTOCOL}://${host}:${port}/>`);
    console.log(`Document root is: ${join(root, PUBLIC_DIRECTORY)}`);
    console.log('(Ctrl+C exit)');
  });
  process.on('SIGINT', () => server.close(() => process.exit(0)));
}