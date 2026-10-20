import PROCESS_ENV from './kniudotenv.mjs';
import { gzip } from 'node:zlib';
import { basename, relative, resolve } from 'node:path';

export const NO_CACHE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'Pragma': 'no-cache',
};

export function resolveWithinRoot(root, pathName) {
  const rootAbsolute = resolve(root);
  const target = resolve(rootAbsolute, String(pathName || '').replace(/^\/+/, ''));
  if (target === rootAbsolute) return target;
  const inside = relative(rootAbsolute, target);
  if (inside.startsWith('..') || resolve(inside) === inside) throw new Error('Invalid path');
  return target;
}

const HASHED_ASSET = /\.[a-f0-9]{8,16}\.(?:js|mjs|css|svg|jpg|jpeg|png|gif|webp|eot|ttf|woff2?|mp3|mp4|webm|ogg)$/i;
const UPLOAD_PATH = /^\/?public\/upload(\/|$)/i;
const COMPRESSIBLE_TYPE = /^(?:text\/[a-z0-9.+-]+|application\/(?:javascript|json|xml|xsl))(?:;|$)/i;
const GZIP_MIN_BYTES = 1024;

function acceptGzip(request) {
  return String(request.headers['accept-encoding'] || '').includes('gzip');
}

export function staticCacheHeaders(file, pathName, contentType) {
  if (typeof contentType === 'string' && contentType.includes('text/html')) return NO_CACHE;
  if (pathName === '/templates.js') return NO_CACHE;
  if (HASHED_ASSET.test(basename(file))) {
    return { 'Cache-Control': 'public, max-age=31536000, immutable' };
  }
  if (UPLOAD_PATH.test(pathName)) {
    return { 'Cache-Control': 'public, max-age=86400' };
  }
  return NO_CACHE;
}

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