const SLICE_SIZE = 800;
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

const URL_ATTRIBUTES = ['href', 'src', 'poster', 'xlink:href'];
const SAFE_DATA_IMAGE_RE = /^data:image\/(png|jpe?g|gif|webp|bmp)([;,]|$)/i;
const ALLOWED_TAGS = new Set([
  'a', 'abbr', 'b', 'blockquote', 'br', 'code', 'del', 'div', 'em', 'figcaption',
  'figure', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'i', 'img', 'li', 'ol', 'p',
  'pre', 's', 'small', 'span', 'strong', 'sub', 'sup', 'table', 'tbody', 'td', 'th',
  'thead', 'tr', 'u', 'ul'
]);
const ALLOWED_ATTRIBUTES = new Set([
  'alt', 'aria-label', 'class', 'colspan', 'height', 'href', 'id', 'loading', 'poster',
  'rel', 'rowspan', 'scope', 'src', 'target', 'title', 'width'
]);

export function isDangerousUrl(value) {
  const stripped = String(value).replace(/[\s\x00-\x1f]+/g, '');
  if (/^(javascript|vbscript):/i.test(stripped)) return true;
  if (/^data:/i.test(stripped)) return !SAFE_DATA_IMAGE_RE.test(stripped);
  return false;
}

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
  if (!ALLOWED_ATTRIBUTES.has(name) && !name.startsWith('data-')) return true;
  if (name.startsWith('on') || name === 'srcdoc' || name === 'formaction') return true;
  if (URL_ATTRIBUTES.indexOf(name) >= 0 && isDangerousUrl(value)) return true;
  if (name === 'srcset' && isDangerousSrcset(value)) return true;
  return false;
}

const SMIL_ACTIVATION_TAGS = 'animate,animatetransform,animatemotion,set';
const SMIL_ACTIVATION_RE = /^(on|javascript:|vbscript:|data:text)/i;
const SMIL_VALUE_ATTRS = ['to', 'values', 'from'];

function removeDangerousSmilNodes(content) {
  content.querySelectorAll(SMIL_ACTIVATION_TAGS).forEach(function (node) {
    const target = (node.getAttribute('attributeName') || '').trim().toLowerCase();
    const isEventName = /^on/.test(target);
    const isDangerousValue = SMIL_VALUE_ATTRS.some(function (name) {
      const raw = (node.getAttribute(name) || '').trim();
      if (!raw) return false;
      return raw.split(';').some(function (candidate) {
        const v = candidate.trim();
        if (!v) return false;
        return isDangerousUrl(v) || SMIL_ACTIVATION_RE.test(v);
      });
    });
    if (isEventName || isDangerousValue) node.remove();
  });
}

export { removeDangerousSmilNodes };

function sanitizeDom(template, documentRef) {
  removeDangerousSmilNodes(template.content);
  template.content.querySelectorAll(BANNED_TAGS).forEach(function (node) { node.remove(); });
  template.content.querySelectorAll('*').forEach(function (node) {
    if (!ALLOWED_TAGS.has(node.localName)) {
      node.replaceWith(...node.childNodes);
    }
  });
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

export function sanitizeRichHtml(html, documentRef = document) {
  const template = documentRef.createElement('template');
  template.innerHTML = escapeBannedTags(html);
  return sanitizeDom(template, documentRef);
}

function yieldToMainThread() {
  const scheduler = (typeof globalThis !== 'undefined' && globalThis.scheduler && typeof globalThis.scheduler.yield === 'function')
    ? globalThis.scheduler
    : null;
  if (scheduler) return scheduler.yield();
  return new Promise(function (resolve) {
    setTimeout(resolve, 0);
  });
}

export async function sanitizeRichHtmlAsync(html, documentRef = document) {
  const template = documentRef.createElement('template');
  template.innerHTML = escapeBannedTags(html);
  removeDangerousSmilNodes(template.content);
  template.content.querySelectorAll(BANNED_TAGS).forEach(function (node) { node.remove(); });
  template.content.querySelectorAll('*').forEach(function (node) {
    if (!ALLOWED_TAGS.has(node.localName)) node.replaceWith(...node.childNodes);
  });
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
    await yieldToMainThread();
  }
  return template.innerHTML;
}

function stripAttributesOf(node) {
  Array.from(node.attributes).forEach(function (attr) {
    if (isDangerousAttribute(node, attr)) node.removeAttribute(attr.name);
  });
}
