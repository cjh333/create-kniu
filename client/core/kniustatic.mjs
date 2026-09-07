// 静态资源传输层公共逻辑：缓存策略判定 + 按需 gzip。
// 被 kniuserver.mjs / kniupreview.mjs 复用，避免两处各自维护重复的缓存/gzip 代码。
import PROCESS_ENV from './kniudotenv.mjs';
import { gzip } from 'node:zlib';
import { basename } from 'node:path';

// HTML/模板等需要实时反映最新引用，不能长期缓存。
export const NO_CACHE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'Pragma': 'no-cache',
};

// 生产态 dist 文件名带内容哈希（如 client.b9a4ad5b4c.js / *.min.abc.css）→ 内容一变哈希即变，可 immutable 强缓存。
const HASHED_ASSET = /\.[a-f0-9]{8,16}\.(?:js|mjs|css|svg|jpg|jpeg|png|gif|webp|eot|ttf|woff2?|mp3|mp4|webm|ogg)$/i;
// 用户上传内容（非哈希、可被覆盖）不做 immutable，给短缓存避免陈旧。
const UPLOAD_PATH = /^\/?public\/upload(\/|$)/i;
// 可 gzip 压缩的文本类静态资源（按 Content-Type 判定）。
const COMPRESSIBLE_TYPE = /^(?:text\/[a-z0-9.+-]+|application\/(?:javascript|json|xml|xsl))(?:;|$)/i;
const GZIP_MIN_BYTES = 1024;

function acceptGzip(request) {
  return String(request.headers['accept-encoding'] || '').includes('gzip');
}

/**
 * 判定某静态文件应采用的缓存响应头。
 * @param {string} file        磁盘上的完整路径
 * @param {string} pathName    请求的 URL 路径（不含 query/hash）
 * @param {string} contentType 已解析出的 Content-Type
 * @returns {{[k:string]:string}} 追加到响应头的缓存相关头
 */
export function staticCacheHeaders(file, pathName, contentType) {
  if (typeof contentType === 'string' && contentType.includes('text/html')) return NO_CACHE;
  if (pathName === '/templates.js') return NO_CACHE;
  if (HASHED_ASSET.test(basename(file))) {
    return { 'Cache-Control': 'public, max-age=31536000, immutable' };
  }
  // 非哈希的用户上传与开发态源码：短缓存即可，避免陈旧也不至于每次全量重下。
  if (UPLOAD_PATH.test(pathName)) {
    return { 'Cache-Control': 'public, max-age=86400' };
  }
  return NO_CACHE;
}

/**
 * 发送静态响应体；生产态且客户端接受 gzip、内容可压缩且够大时自动压缩。
 * @returns {Promise<void>}
 */
export async function sendStaticBody(request, response, headers, body) {
  const doGzip =
    PROCESS_ENV === 'production' &&
    acceptGzip(request) &&
    body.length >= GZIP_MIN_BYTES &&
    COMPRESSIBLE_TYPE.test(String(headers['Content-Type'] || ''));
  if (!doGzip) {
    response.writeHead(200, headers);
    response.end(body);
    return;
  }
  await new Promise(function (resolve) {
    gzip(body, function (error, compressed) {
      if (error || !compressed || compressed.length >= body.length) {
        response.writeHead(200, headers);
        response.end(body);
      } else {
        response.writeHead(200, { ...headers, 'Content-Encoding': 'gzip', 'Vary': 'Accept-Encoding' });
        response.end(compressed);
      }
      resolve();
    });
  });
}
