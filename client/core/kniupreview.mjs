import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import SERVER from '../config/server.js';
import { NO_CACHE, resolveWithinRoot, sendStaticBody, staticCacheHeaders } from './kniustatic.mjs';
import { MIME_TYPES, handleApiRequest, resolveRequestProtocol } from './kniuproxy.mjs';

const ROOT = normalize(join(process.cwd(), 'dist'));
const VIEW_INDEX = join(ROOT, 'index.html');
const UPLOAD_ROOT = normalize(join(process.cwd(), 'public'));
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
    const isUpload = PATH_NAME === '/upload' || PATH_NAME.startsWith('/upload/');
    let file = PATH_NAME === '/'
      ? VIEW_INDEX
      : isUpload
        ? resolveWithinRoot(UPLOAD_ROOT, PATH_NAME)
        : resolveWithinRoot(ROOT, PATH_NAME);
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
    const mime = MIME_TYPES[extname(file)] || 'application/octet-stream';
    const cacheHeaders = staticCacheHeaders(file, PATH_NAME, mime);
    await sendStaticBody(request, response, { 'Content-Type': mime, ...cacheHeaders }, await readFile(file));
  } catch (err) {
    if (err.code === 'ENOENT' && extname(PATH_NAME) && extname(PATH_NAME) !== '.html') {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }
    if (err.code !== 'ENOENT') console.error('[Server Error]', err.message);
    try {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', ...NO_CACHE });
      response.end(await readFile(VIEW_INDEX));
    } catch {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
    }
  }
});
server.on('error', function (err) {
  if (err && err.code === 'EADDRINUSE') {
    console.error(`预览端口 ${SERVER.PORT + 1} 已被占用：请先运行 npm run kill 释放本项目端口后重试。`);
    process.exit(1);
  }
  throw err;
});
server.listen(SERVER.PORT + 1, SERVER.HOST, function () {
  const PROTOCOL = typeof server.setSecureContext === 'function' ? 'https' : 'http';
  console.log(`KniuSystem preview server is started on <${PROTOCOL}://${SERVER.HOST}:${SERVER.PORT + 1}/>`);
  console.log(`Preview document root is: ${ROOT}`);
  console.log('(Ctrl+C exit)');
});