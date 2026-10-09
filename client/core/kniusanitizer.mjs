/** 单次异步切分处理的节点上限；超过则跨多帧分片执行。 */
const SLICE_SIZE = 800;

/** 危险标签不能作为富文本 DOM 节点；输入源码时按正文文本显示。 */
const BANNED_TAGS = 'script,iframe,object,embed,link,meta,style,base,form';
const BANNED_TAG_RE = /<(\/?)(script|iframe|object|embed|link|meta|style|base|form)(?=\s|\/?>)([^>]*?)>/gi;
const ESCAPED_BANNED_TAG_RE = /&lt;(\/?)(script|iframe|object|embed|link|meta|style|base|form)(?=\s|\/?(?:&gt;|>))([^>]*?)(?:&gt;|>)/gi;

function escapeBannedTags(html) {
  BANNED_TAG_RE.lastIndex = 0;
  ESCAPED_BANNED_TAG_RE.lastIndex = 0;
  return String(html || '')
    .replace(ESCAPED_BANNED_TAG_RE, function (_, slash, tag, tail) {
      return '<code>&lt;' + slash + tag + tail + '&gt;</code>';
    })
    .replace(BANNED_TAG_RE, function (_, slash, tag, tail) {
      return '<code>&lt;' + slash + tag + tail + '&gt;</code>';
    });
}

/** 可能承载 URL 的属性名，用于拦截 javascript:/vbscript:/data: 伪协议。 */
const URL_ATTRIBUTES = ['href', 'src', 'poster', 'xlink:href'];

/** 编辑器粘贴图片会产生 data:image 内联图，仅放行常见位图格式（svg 可携带脚本，禁止）。 */
const SAFE_DATA_IMAGE_RE = /^data:image\/(png|jpe?g|gif|webp|bmp)([;,]|$)/i;

/** 判断 URL 值是否携带危险协议，先剔除空白与控制字符再匹配，防 `javas&#9;cript:` 类拆分绕过。 */
export function isDangerousUrl(value) {
  const stripped = String(value).replace(/[\s\x00-\x1f]+/g, '');
  if (/^(javascript|vbscript):/i.test(stripped)) return true;
  if (/^data:/i.test(stripped)) return !SAFE_DATA_IMAGE_RE.test(stripped);
  return false;
}

/**
 * srcset 是逗号分隔的多个 URL；只检查整体开头会遗漏后续候选项中的危险协议。
 * 此处按协议 token 扫描，data: 仍复用图片白名单，避免把 SVG 作为图片候选绕过。
 */
export function isDangerousSrcset(value) {
  const source = String(value).replace(/[\s\x00-\x1f]+/g, '');
  if (/(?:^|,)(?:javascript|vbscript):/i.test(source)) return true;
  const dataUrls = source.match(/(?:^|,)data:[^,\s]+/gi) || [];
  return dataUrls.some(function (entry) {
    return !SAFE_DATA_IMAGE_RE.test(entry.replace(/^,/, ''));
  });
}

function isDangerousAttribute(node, attr) {
  const name = attr.name.toLowerCase();
  const value = attr.value.trim();
  if (name.startsWith('on') || name === 'srcdoc' || name === 'formaction') return true;
  if (URL_ATTRIBUTES.indexOf(name) >= 0 && isDangerousUrl(value)) return true;
  if (name === 'srcset' && isDangerousSrcset(value)) return true;
  return false;
}

function sanitizeDom(template, documentRef) {
  template.content.querySelectorAll(BANNED_TAGS).forEach(function (node) { node.remove(); });
  // 旧内容或重复清洗可能产生 <code><code>...</code></code>；行内源码仅保留一层语义标签。
  template.content.querySelectorAll('code code').forEach(function (inner) {
    while (inner.firstChild) inner.parentNode.insertBefore(inner.firstChild, inner);
    inner.remove();
  });
  const all = Array.prototype.slice.call(template.content.querySelectorAll('*'));
  all.forEach(function (node) {
    Array.from(node.attributes).forEach(function (attr) {
      if (isDangerousAttribute(node, attr)) node.removeAttribute(attr.name);
    });
  });
  return template.innerHTML;
}

/**
 * 同步富文本白名单清洗。
 * @param {string} html 待清洗的 HTML 字符串。
 * @param {Document} [documentRef] 用于创建模板的 document（默认当前 document）。
 * @returns {string} 清洗后的 HTML。
 */
export function sanitizeRichHtml(html, documentRef = document) {
  const template = documentRef.createElement('template');
  template.innerHTML = escapeBannedTags(html);
  return sanitizeDom(template, documentRef);
}

/** 让出一帧，避免长时间占用主线程（无 requestIdleCallback 环境回退 setTimeout）。 */
function yieldToMainThread() {
  const scheduler = (typeof globalThis !== 'undefined' && globalThis.scheduler && typeof globalThis.scheduler.yield === 'function')
    ? globalThis.scheduler
    : null;
  if (scheduler) return scheduler.yield();
  return new Promise(function (resolve) {
    setTimeout(resolve, 0);
  });
}

/**
 * 异步（可切分）富文本白名单清洗。
 *
 * 与 sanitizeRichHtml 产物完全一致；当内容节点量较大时按 SLICE_SIZE 分片，
 * 片间主动让出主线程，避免一次同步清空造成输入/渲染卡顿。小内容直接同步完成。
 *
 * @param {string} html 待清洗的 HTML 字符串。
 * @param {Document} [documentRef] 用于创建模板的 document（默认当前 document）。
 * @returns {Promise<string>} 清洗后的 HTML。
 */
export async function sanitizeRichHtmlAsync(html, documentRef = document) {
  const template = documentRef.createElement('template');
  template.innerHTML = escapeBannedTags(html);
  template.content.querySelectorAll(BANNED_TAGS).forEach(function (node) { node.remove(); });
  template.content.querySelectorAll('code code').forEach(function (inner) {
    while (inner.firstChild) inner.parentNode.insertBefore(inner.firstChild, inner);
    inner.remove();
  });
  const all = Array.prototype.slice.call(template.content.querySelectorAll('*'));
  if (all.length <= SLICE_SIZE) {
    all.forEach(stripAttributesOf);
    return template.innerHTML;
  }
  for (let offset = 0; offset < all.length; offset += SLICE_SIZE) {
    const slice = all.slice(offset, offset + SLICE_SIZE);
    slice.forEach(stripAttributesOf);
    // 每片之间让出主线程，交由浏览器调度，避免长任务。
    await yieldToMainThread();
  }
  return template.innerHTML;
}

function stripAttributesOf(node) {
  Array.from(node.attributes).forEach(function (attr) {
    if (isDangerousAttribute(node, attr)) node.removeAttribute(attr.name);
  });
}
