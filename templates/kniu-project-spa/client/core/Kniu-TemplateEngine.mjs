import { resolveAliasReferences } from './Kniu-Util.mjs';
import { kniuWarn, KNDEBUG } from './Kniu-Debug.mjs';

const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
const SELFCLOSING_TAG_RE = /<([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^"'>])*)\/>/g;

function expandSelfClosingTags(html) {
  if (!html.includes('/>')) return html;
  return html.replace(SELFCLOSING_TAG_RE, (match, tag, attrs) => {
    if (VOID_TAGS.has(tag.toLowerCase())) return match;
    return `<${tag}${attrs.replace(/\s+$/, '')}></${tag}>`;
  });
}

function unwrapExpression(source) {
  return String(source ?? '').trim().replace(/^{{\s*|\s*}}$/g, '').trim();
}

function splitOperator(source, operator) {
  let quote = '';
  for (let index = 0; index <= source.length - operator.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (character === '\\') index += 1;
      else if (character === quote) quote = '';
      continue;
    }
    if (character === '"' || character === "'") { quote = character; continue; }
    if (source.slice(index, index + operator.length) === operator) {
      return [source.slice(0, index), source.slice(index + operator.length)];
    }
  }
  return null;
}

const PATH_VALIDATE_RE = /^(?:[\p{L}_$][\p{L}\p{N}_$]*|\*this)(?:(?:\.(?:[\p{L}_$][\p{L}\p{N}_$]*|\d+))|(?:\[(?:\d+|[\p{L}_$][\p{L}\p{N}_$]*)\]))*$/u;
const PATH_BRACKET_RE = /\[(\d+|[\p{L}_$][\p{L}\p{N}_$]*)\]/gu;
const PATH_KEYS_CACHE = new Map();
const PATH_KEYS_CACHE_LIMIT = 2048;

function readPathKeys(path) {
  let keys = PATH_KEYS_CACHE.get(path);
  if (keys) return keys;
  keys = path.replace(PATH_BRACKET_RE, '.$1').split('.');
  if (keys.some((key) => ['__proto__', 'prototype', 'constructor'].includes(key))) keys = null;
  if (PATH_KEYS_CACHE.size >= PATH_KEYS_CACHE_LIMIT) PATH_KEYS_CACHE.clear();
  PATH_KEYS_CACHE.set(path, keys);
  return keys;
}

function readPath(source, scope) {
  const path = source.trim();
  if (!PATH_VALIDATE_RE.test(path)) return undefined;
  if (path === '*this' || path === 'this') return scope.this;
  const keys = readPathKeys(path);
  if (!keys) return undefined;
  return keys.reduce((value, key) => value == null ? undefined : value[key], scope);
}

function splitTernary(code) {
  let quote = '';
  let depth = 0;
  let question = -1;
  for (let index = 0; index < code.length; index += 1) {
    const char = code[index];
    if (quote) {
      if (char === '\\') index += 1;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === "'") { quote = char; continue; }
    if (char === '?') {
      if (question === -1) question = index;
      else depth += 1;
      continue;
    }
    if (char === ':' && question !== -1) {
      if (depth === 0) return [code.slice(0, question), code.slice(question + 1, index), code.slice(index + 1)];
      depth -= 1;
    }
  }
  return null;
}

const EXPRESSION_CACHE = new Map();
const EXPRESSION_CACHE_LIMIT = 4096;

function compileExpression(source) {
  const code = unwrapExpression(String(source ?? ''));
  if (!code) return { kind: 'empty' };
  const ternary = splitTernary(code);
  if (ternary) {
    return {
      kind: 'ternary',
      test: compileExpression(ternary[0]),
      then: compileExpression(ternary[1]),
      else: compileExpression(ternary[2])
    };
  }
  const or = splitOperator(code, '||');
  if (or) return { kind: 'or', left: compileExpression(or[0]), right: compileExpression(or[1]) };
  const and = splitOperator(code, '&&');
  if (and) return { kind: 'and', left: compileExpression(and[0]), right: compileExpression(and[1]) };
  if (code.startsWith('!')) return { kind: 'not', value: compileExpression(code.slice(1)) };
  if (/^(?:true|false)$/i.test(code)) return { kind: 'literal', value: code.toLowerCase() === 'true' };
  if (/^null$/i.test(code)) return { kind: 'literal', value: null };
  if (/^undefined$/i.test(code)) return { kind: 'literal', value: undefined };
  if (/^-?(?:\d+\.?\d*|\.\d+)$/.test(code)) return { kind: 'literal', value: Number(code) };
  if (/^(['"]).*\1$/s.test(code)) return { kind: 'literal', value: code.slice(1, -1).replace(/\\(['"\\])/g, '$1') };
  const comparison = /^(.*?)\s*(===|!==|>=|<=|==|!=|>|<)\s*(.*?)$/.exec(code);
  if (comparison) {
    return {
      kind: 'compare',
      op: comparison[2],
      left: compileExpression(comparison[1]),
      right: compileExpression(comparison[3])
    };
  }
  return { kind: 'path', code };
}

function readComparison(op, left, right) {
  switch (op) {
    case '===': return left === right;
    case '!==': return left !== right;
    case '>=': return left >= right;
    case '<=': return left <= right;
    case '>': return left > right;
    case '<': return left < right;
    case '==': return left == right;
    default: return left != right;
  }
}

function evaluateNode(node, scope) {
  switch (node.kind) {
    case 'empty': return '';
    case 'literal': return node.value;
    case 'path': return readPath(node.code, scope);
    case 'not': return !evaluateNode(node.value, scope);
    case 'or': return evaluateNode(node.left, scope) || evaluateNode(node.right, scope);
    case 'and': return evaluateNode(node.left, scope) && evaluateNode(node.right, scope);
    case 'ternary':
      return evaluateNode(node.test, scope) ? evaluateNode(node.then, scope) : evaluateNode(node.else, scope);
    case 'compare':
      return readComparison(node.op, evaluateNode(node.left, scope), evaluateNode(node.right, scope));
    default: return '';
  }
}

export function evaluateTemplateExpression(source, scope = {}) {
  const key = String(source ?? '');
  let node = EXPRESSION_CACHE.get(key);
  if (!node) {
    node = compileExpression(key);
    if (EXPRESSION_CACHE.size >= EXPRESSION_CACHE_LIMIT) {
      EXPRESSION_CACHE.delete(EXPRESSION_CACHE.keys().next().value);
    }
    EXPRESSION_CACHE.set(key, node);
  }
  return evaluateNode(node, scope);
}

let markMode = false;

function markText(code, value, raw) {
  if (!markMode) return value;
  return `<!--kniu-t:${encodeURIComponent(code)}${raw ? '|raw' : ''}-->${value}<!--/kniu-t-->`;
}

const interpolateText = (source, scope) => (source.includes('{{') ? source
  .replace(/{{@\s*([^{}]+?)\s*}}/g, (_, code) => markText(code, String(evaluateTemplateExpression(code, scope) ?? ''), true))
  .replace(/{{{\s*([^{}]+?)\s*}}}/g, (_, code) => markText(code, String(evaluateTemplateExpression(code, scope) ?? ''), true))
  .replace(/{{\s*([^{}]+?)\s*}}/g, (_, code) => markText(code, escapeHtml(evaluateTemplateExpression(code, scope)), false))
  : source);

const interpolate = (source, scope) => (markMode
  ? splitCollectParts(source).map((part) => (part.startsWith('<') ? interpolatePlain(part, scope) : interpolateText(part, scope))).join('')
  : interpolatePlain(source, scope));

function splitCollectParts(source) {
  const parts = [];
  let cursor = 0;
  while (cursor < source.length) {
    const lt = source.indexOf('<', cursor);
    if (lt === -1) { parts.push(source.slice(cursor)); break; }
    if (lt > cursor) parts.push(source.slice(cursor, lt));
    const tagEnd = matchTagAt(source, lt);
    if (tagEnd === -1) { parts.push(source.slice(lt)); break; }
    parts.push(source.slice(lt, tagEnd));
    cursor = tagEnd;
  }
  return parts;
}

const ROW_SCOPE_EXPR_RE = /^(?:scope\.(?:row|\$index)(?:\.[\w$]+)*|\$index(?:\.[\w$]+)*)$/;

function interpolatePlain(source, scope) {
  if (!source.includes('{{')) return source;
  return source
    .replace(/{{@\s*([^{}]+?)\s*}}/g, (_, code) => String(evaluateTemplateExpression(code, scope) ?? ''))
    .replace(/{{{\s*([^{}]+?)\s*}}}/g, (_, code) => String(evaluateTemplateExpression(code, scope) ?? ''))
    .replace(/{{\s*([^{}]+?)\s*}}/g, (_, code) => {
      const value = evaluateTemplateExpression(code, scope);
      if (value === undefined && ROW_SCOPE_EXPR_RE.test(code.trim())) {
        return '{{' + code + '}}';
      }
      return escapeHtml(value);
    });
}

const events = new Set(['click', 'dblclick', 'input', 'change', 'submit', 'reset', 'focus', 'blur', 'focusin', 'focusout', 'mouseenter', 'mouseleave', 'mouseover', 'mouseout', 'mousemove', 'mousedown', 'mouseup', 'contextmenu', 'wheel', 'scroll', 'touchstart', 'touchmove', 'touchend', 'drag', 'dragstart', 'dragend', 'dragover', 'drop', 'load', 'error', 'resize', 'keydown', 'keyup', 'keypress']);

function matchTagAt(source, start) {
  let quote = '';
  for (let index = start + 1; index < source.length; index += 1) {
    const character = source[index];
    if (quote) { if (character === quote) quote = ''; continue; }
    if (character === '"' || character === "'") { quote = character; continue; }
    if (character === '>') return index + 1;
  }
  return -1;
}

function splitOptionEntries(inner) {
  const items = [];
  let current = '';
  let quote = '';
  for (const character of inner) {
    if (quote) {
      current += character;
      if (character === quote) quote = '';
      continue;
    }
    if (character === '"' || character === "'") { quote = character; current += character; continue; }
    if (character === ',') { items.push(current); current = ''; continue; }
    current += character;
  }
  items.push(current);
  return items;
}

const PATH_VALUE_PREFIX = '__kniu_path__:';
const PATH_VALUE_RE = /^[\p{L}_$][\p{L}\p{N}_$]*(?:\.[\p{L}_$][\p{L}\p{N}_$]*)*$/u;

function parseOptionObject(raw) {
  const text = String(raw ?? '').trim();
  const braceMatch = /^\{\{([\s\S]*)\}\}$/.exec(text);
  if (!braceMatch) return null;
  const inner = braceMatch[1].trim();
  if (!inner) return { object: {}, refs: {}, spreads: [] };
  const entries = [];
  const refs = {};
  const spreads = [];
  for (const item of splitOptionEntries(inner)) {
    const entry = item.trim();
    if (!entry) continue;
    const spreadMatch = /^\.\.\.\(([\w$.]+)\)$/.exec(entry);
    if (spreadMatch) { spreads.push(spreadMatch[1]); continue; }
    const stringKey = /^(['"])([\s\S]*)\1\s*:/.exec(entry);
    let rawKey;
    let rawValue;
    if (stringKey) {
      rawKey = stringKey[2];
      rawValue = entry.slice(stringKey[0].length).trim();
    } else {
      const colon = entry.indexOf(':');
      if (colon === -1) return null;
      rawKey = entry.slice(0, colon).trim();
      rawValue = entry.slice(colon + 1).trim();
    }
    const stringMatch = /^(['"])([\s\S]*)\1$/.exec(rawValue);
    if (stringMatch) { entries.push([rawKey, stringMatch[2]]); continue; }
    if (/^(?:true|false)$/.test(rawValue)) { entries.push([rawKey, rawValue === 'true']); continue; }
    if (/^-?\d+\.?\d*$/.test(rawValue)) { entries.push([rawKey, Number(rawValue)]); continue; }
    if (PATH_VALUE_RE.test(rawValue)) {
      entries.push([rawKey, `${PATH_VALUE_PREFIX}${rawValue}`]);
      continue;
    }
    const parenMatch = /^\(([\s\S]*)\)$/.exec(rawValue);
    if (parenMatch) {
      const innerExpr = parenMatch[1].trim();
      if (PATH_VALUE_RE.test(innerExpr)) { refs[rawKey] = innerExpr; continue; }
      entries.push([rawKey, `${PATH_VALUE_PREFIX}${innerExpr}`]);
      continue;
    }
    entries.push([rawKey, `${PATH_VALUE_PREFIX}${rawValue}`]);
  }
  return { object: Object.fromEntries(entries), refs, spreads };
}

const CONTROL_ATTR_RE = /^(?:if|elseif|else|for|for-item|for-index|key)$/i;

function transformTag(tag, scope) {
  if (!tag.includes(':') && !tag.includes('@') && !tag.includes('{{')) return tag;
  let eventIndex = 0;
  const compileEvent = (parts, code) => {
    eventIndex += 1;
    const suffix = eventIndex > 1 ? `-${eventIndex}` : '';
    return ` data-kniu-event${suffix}="${escapeHtml(parts.join('.'))}" data-kniu-handler${suffix}="${encodeURIComponent(code.trim())}"`;
  };
  const directiveAttrRe = /\s+(@[\w-]+(?:\.[\w-]+)*|:\[[\w-]+\]|:[\w-]+)\s*=\s*(["'])(.*?)\2/gi;
  return tag.replace(directiveAttrRe, (full, name, quote, code) => {
    if (CONTROL_ATTR_RE.test(name.slice(1))) return full;
    if (name[0] === '@') {
      const parts = name.slice(1).split('.');
      if (!events.has(parts[0])) throw new Error(`不支持的 HTML 事件：${parts[0]}`);
      return compileEvent(parts, code);
    }
    if (name.toLowerCase() === ':option') {
      const parsed = parseOptionObject(code);
      if (parsed) {
        const optionKeys = [];
        const parts = Object.entries(parsed.object).map(([key, item]) => {
          const eventMatch = /^on([A-Z][a-z0-9][\w$]*)$/.exec(key);
          if (eventMatch) {
            const eventName = eventMatch[1].toLowerCase();
            if (!events.has(eventName)) throw new Error(`不支持的 HTML 事件：${eventName}`);
            const rawHandler = String(item ?? '');
            const handler = rawHandler.startsWith(PATH_VALUE_PREFIX)
              ? rawHandler.slice(PATH_VALUE_PREFIX.length)
              : rawHandler;
            return compileEvent([eventName], handler);
          }
          if (!/^[A-Za-z_:][-A-Za-z0-9_:.]*$/.test(key)) {
            kniuWarn(KNDEBUG.BINDING, `[kniu] :option 键名不是合法 HTML 属性名，已跳过：${key}`);
            return '';
          }
          const attributeName = key.replace(/[A-Z]/g, (character) => '-' + character.toLowerCase());
          if (attributeName === 'style' || attributeName === 'class') {
            kniuWarn(KNDEBUG.BINDING, `[kniu] :option 的 ${attributeName} 键已跳过，请使用语义类：${key}`);
            return '';
          }
          optionKeys.push(key);
          const value = String(item ?? '');
          if (value.startsWith(PATH_VALUE_PREFIX)) {
            return ` ${attributeName}="{{${value.slice(PATH_VALUE_PREFIX.length)}}}"`;
          }
          return ` ${attributeName}="${escapeHtml(value)}"`;
        });
        const refPairs = Object.entries(parsed.refs).map(([key, path]) => `${key}:${path}`);
        if (refPairs.length) parts.push(` data-kniu-option-ref="${escapeHtml(refPairs.join(','))}"`);
        if (parsed.spreads.length) parts.push(` data-kniu-option-object="${escapeHtml(parsed.spreads.join(','))}"`);
        parts.push(` data-kniu-option-keys="${escapeHtml(optionKeys.join(','))}"`);
        return parts.join('');
      }
      const wholePathMatch = /^\{\{\s*([\w$.]+)\s*\}\}$/.exec(code.trim());
      if (wholePathMatch) {
        const value = evaluateTemplateExpression(wholePathMatch[1], scope);
        if (value && typeof value === 'object') {
          return ` data-kniu-option-keys="" data-kniu-option-object="${escapeHtml(wholePathMatch[1])}"`;
        }
      }
      const pathValue = evaluateTemplateExpression(code, scope);
      if (pathValue && typeof pathValue === 'object' && !Array.isArray(pathValue)) {
        return Object.entries(pathValue).map(([key, item]) => ` ${key}="${escapeHtml(item)}"`).join('');
      }
      if (/^\{\{[\s\S]*\}\}$/.test(code.trim()) || /\{\{/.test(code)) {
        kniuWarn(KNDEBUG.BINDING, `[kniu] :option 对象解析失败，请检查键值对语法：${code}`);
      }
      const fallback = String(pathValue ?? '');
      return ` data-kniu-option="${escapeHtml(fallback)}"`;
    }
    const custom = /^:\[([^\]]+)\]$/i.exec(name);
    if (custom) {
      return ` data-${custom[1]}="${escapeHtml(code)}"`;
    }
    const value = /{{[\s\S]*?}}/.test(code)
      ? code.replace(/{{\s*([^{}]+?)\s*}}/g, (_, token) => String(evaluateTemplateExpression(token, scope) ?? ''))
      : evaluateTemplateExpression(code, scope);
    if (name.toLowerCase() === ':form') {
      const hasManualValue = /\svalue\s*=\s*["']/i.test(tag);
      const formBinding = evaluateTemplateExpression(code, scope);
      const formValue = formBinding && typeof formBinding === 'object' && Object.prototype.hasOwnProperty.call(formBinding, 'value')
        ? formBinding.value
        : formBinding;
      return hasManualValue
        ? ` data-kniu-form="${encodeURIComponent(code)}"`
        : ` data-kniu-form="${encodeURIComponent(code)}" value="${escapeHtml(formValue)}"`;
    }
    const attributeName = name.slice(1);
    if ((attributeName === 'class' || attributeName === 'style') && (value === '' || value == null || value === false)) return '';
    const isLiteral = /^(?:"[^"]*"|'[^']*'|-?\d+|true|false|null)$/.test(code.trim());
    const attrMark = isLiteral ? '' : ` data-kniu-attr="${attributeName}:${encodeURIComponent(code)}"`;
    return ` ${attributeName}="${escapeHtml(value)}"${attrMark}`;
  });
}

const bindAttributes = (source, scope) => {
  let result = '';
  let cursor = 0;
  while (cursor < source.length) {
    const lt = source.indexOf('<', cursor);
    if (lt === -1) { result += source.slice(cursor); break; }
    result += source.slice(cursor, lt);
    if (!/[A-Za-z]/.test(source[lt + 1] || '')) { result += '<'; cursor = lt + 1; continue; }
    const tagEnd = matchTagAt(source, lt);
    if (tagEnd === -1) { result += source.slice(lt); break; }
    result += transformTag(source.slice(lt, tagEnd), scope);
    cursor = tagEnd;
  }
  return result;
};

function closingIndex(source, openEnd) {
  let index = openEnd;
  let depth = 1;
  while (index < source.length) {
    const lt = source.indexOf('<', index);
    if (lt === -1) return null;
    if (/^<template\b/i.test(source.slice(lt))) {
      const end = matchTagAt(source, lt);
      if (end !== -1) { depth += 1; index = end; continue; }
      index = lt + 1;
      continue;
    }
    const closeMatch = /^<\/template\s*>/i.exec(source.slice(lt));
    if (closeMatch) {
      depth -= 1;
      if (!depth) return { start: lt, end: lt + closeMatch[0].length };
      index = lt + closeMatch[0].length;
      continue;
    }
    index = lt + 1;
  }
  return null;
}

const BLOCK_DIRECTIVE_RE = /\s:(?:(?:elseif|if|for)\s*=\s*(?:"[^"]*"|'[^']*')|else(?=[\s/>]))/i;

function findBlockAt(source) {
  let cursor = 0;
  while (cursor < source.length) {
    const lt = source.indexOf('<', cursor);
    if (lt === -1) return -1;
    if (source.startsWith('<!--', lt)) {
      const end = source.indexOf('-->', lt + 4);
      cursor = end === -1 ? source.length : end + 3;
      continue;
    }
    if (!/[A-Za-z]/.test(source[lt + 1] || '')) { cursor = lt + 1; continue; }
    const tagEnd = matchTagAt(source, lt);
    if (tagEnd === -1) return -1;
    const tag = source.slice(lt, tagEnd);
    if (/^<template[\s/>]/i.test(tag) || BLOCK_DIRECTIVE_RE.test(tag)) return lt;
    cursor = tagEnd;
  }
  return -1;
}

const VOID_ELEMENTS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);

function closingTagIndex(source, openEnd, tagName) {
  if (VOID_ELEMENTS.has(tagName.toLowerCase())) return { start: openEnd, end: openEnd };
  const escaped = tagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const openRe = new RegExp(`^<${escaped}[\\s/>]`, 'i');
  const closeRe = new RegExp(`^</${escaped}\\s*>`, 'i');
  let index = openEnd;
  let depth = 1;
  while (index < source.length) {
    const lt = source.indexOf('<', index);
    if (lt === -1) return null;
    const rest = source.slice(lt);
    if (openRe.test(rest)) {
      const end = matchTagAt(source, lt);
      if (end === -1) { index = lt + 1; continue; }
      if (!/\/\s*>$/.test(source.slice(lt, end))) depth += 1;
      index = end;
      continue;
    }
    const closeMatch = closeRe.exec(rest);
    if (closeMatch) {
      depth -= 1;
      if (!depth) return { start: lt, end: lt + closeMatch[0].length };
      index = lt + closeMatch[0].length;
      continue;
    }
    index = lt + 1;
  }
  return null;
}

const CONTROL_ATTR_STRIP_RE = /\s+:(?:elseif|else|if|for|for-item|for-index|key)(?:\s*=\s*(?:"[^"]*"|'[^']*'))?(?=[\s/>]|$)/g;
const stripControlAttrs = (openTag) => openTag.replace(CONTROL_ATTR_STRIP_RE, '');

function renderBlockElement(openTag, body, closeTag, scope, bodyTaken) {
  return `${interpolate(stripControlAttrs(openTag), scope)}${renderBlocks(body, scope, { taken: bodyTaken === true })}${closeTag}`;
}

function renderBlocks(source, scope, chain) {
  const state = chain || { taken: false };
  const openAt = findBlockAt(source);
  if (openAt === -1) { state.taken = false; return interpolate(source, scope); }
  const openEnd = matchTagAt(source, openAt);
  if (openEnd === -1) { state.taken = false; return interpolate(source, scope); }
  const openTag = source.slice(openAt, openEnd);
  const nameMatch = /^<([a-zA-Z][^\s/>]*)/.exec(openTag);
  if (!nameMatch) { state.taken = false; return interpolate(source, scope); }
  const tagName = nameMatch[1];
  const isTemplate = /^template$/i.test(tagName);
  const attrs = source.slice(openAt + 1 + tagName.length, openEnd - 1);
  let body = '';
  let closeTag = '';
  let closeEnd = openEnd;
  if (isTemplate) {
    const close = closingIndex(source, openEnd);
    if (!close) { state.taken = false; return interpolate(source, scope); }
    body = source.slice(openEnd, close.start);
    closeEnd = close.end;
  } else if (!/\/\s*>$/.test(openTag)) {
    const close = closingTagIndex(source, openEnd, tagName);
    if (!close) { state.taken = false; return interpolate(source, scope); }
    body = source.slice(openEnd, close.start);
    closeTag = source.slice(close.start, close.end);
    closeEnd = close.end;
  }
  const ifMatch = /(?:^|\s):if\s*=\s*["']([^"']*)["']/i.exec(attrs);
  const elseifMatch = /(?:^|\s):elseif\s*=\s*["']([^"']*)["']/i.exec(attrs);
  const isElse = /(?:^|\s):else(?![\w-])/i.test(attrs);
  const forMatch = /(?:^|\s):for\s*=\s*["']([^"']+)["']/i.exec(attrs);
  const itemMatch = /(?:^|\s):for-item\s*=\s*["']([^"']+)["']/i.exec(attrs);
  const indexMatch = /(?:^|\s):for-index\s*=\s*["']([^"']+)["']/i.exec(attrs);
  const keyMatch = /(?:^|\s):key\s*=\s*["']([^"']+)["']/i.exec(attrs);
  let rendered = '';
  if (forMatch) {
    state.taken = false;
    if (ifMatch && !evaluateTemplateExpression(ifMatch[1], scope)) {
      rendered = '';
    } else {
      const loop = /^(?:\(([^)]+)\)|([\w$]+))\s+(?:in|of)\s+(.+)$/i.exec(forMatch[1].trim());
      const list = evaluateTemplateExpression(loop ? loop[3] : forMatch[1].trim(), scope);
      if (list && typeof list === 'object') {
        const names = loop ? (loop[1] || loop[2]).split(',').map((name) => name.trim()) : [itemMatch?.[1] || 'item'];
        rendered = Object.entries(list).map(([key, value], index) => {
          const itemScope = { ...scope, [names[0]]: value, this: value, ...(names[1] ? { [names[1]]: key } : {}), ...(names[2] ? { [names[2]]: index } : {}) };
          if (indexMatch) itemScope[indexMatch[1]] = index;
          const listPath = String(loop ? loop[3] : forMatch[1]).trim().replace(/^{{\s*|\s*}}$/g, '');
          const bindableList = /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/.test(listPath) && /^\d+$/.test(key);
          const loopBody = bindableList ? body.replace(/data-kniu-form="([^"]*)"(?:\s+value="[^"]*")?/g, (match, encoded) => {
            let expression;
            try { expression = decodeURIComponent(encoded).replace(/^{{\s*|\s*}}$/g, '').trim(); } catch { return match; }
            if (expression !== names[0] && !expression.startsWith(names[0] + '.')) return match;
            const path = listPath + '.' + key + expression.slice(names[0].length);
            const field = evaluateTemplateExpression(expression, itemScope);
            const fieldValue = field && typeof field === 'object' && Object.prototype.hasOwnProperty.call(field, 'value') ? field.value : field;
            return `data-kniu-form="${encodeURIComponent('{{' + path + '}}')}" value="${escapeHtml(fieldValue)}"`;
          }) : body;
          const previousMark = markMode;
          markMode = false;
          let itemHtml;
          try {
            itemHtml = isTemplate
              ? renderBlocks(loopBody, itemScope, { taken: false })
              : renderBlockElement(openTag, loopBody, closeTag, itemScope, false);
          }
          finally { markMode = previousMark; }
          if (!keyMatch) return itemHtml;
          const keyValue = keyMatch[1] === 'index' ? index : evaluateTemplateExpression(keyMatch[1], itemScope);
          const keyText = String(keyValue ?? key);
          const anchor = /^[\w.-]+$/.test(keyText) ? keyText : encodeURIComponent(keyText);
          return `<!--kniu-k:${anchor}-->${itemHtml}<!--/kniu-k-->`;
        }).join('');
      }
    }
  } else if (ifMatch) {
    const conditionCode = ifMatch[1];
    const condition = Boolean(evaluateTemplateExpression(conditionCode, scope));
    state.taken = condition;
    if (condition) {
      rendered = isTemplate ? renderBlocks(body, scope, { taken: true }) : renderBlockElement(openTag, body, closeTag, scope, true);
    } else if (/\bscope\.row\b/.test(conditionCode) && !scope.scope?.row) {
      const lazyTag = openTag.replace(/\s*:if\s*=\s*["'][^"']*["']/i, ` data-kniu-row-if="${encodeURIComponent(conditionCode.trim())}"`);
      rendered = isTemplate
        ? `${interpolate(stripControlAttrs(lazyTag), scope)}${renderBlocks(body, scope, { taken: false })}${closeTag}</template>`
        : renderBlockElement(lazyTag, body, closeTag, scope, false);
    }
  } else if (elseifMatch) {
    const condition = !state.taken && Boolean(evaluateTemplateExpression(elseifMatch[1], scope));
    state.taken = state.taken || condition;
    if (condition) {
      rendered = isTemplate ? renderBlocks(body, scope, { taken: true }) : renderBlockElement(openTag, body, closeTag, scope, true);
    }
  } else if (isElse) {
    const condition = !state.taken;
    state.taken = true;
    if (condition) {
      rendered = isTemplate ? renderBlocks(body, scope, { taken: true }) : renderBlockElement(openTag, body, closeTag, scope, true);
    }
  } else {
    state.taken = false;
    rendered = `${interpolate(openTag, scope)}${renderBlocks(body, scope, { taken: false })}</template>`;
  }
  return interpolate(source.slice(0, openAt), scope) + rendered + renderBlocks(source.slice(closeEnd), scope, state);
}

const RAW_BLOCK_RE = /<(style|script)\b([^>]*)>([\s\S]*?)<\/\1>/gi;

function protectRawBlocks(source) {
  const blocks = [];
  const out = String(source ?? '').replace(RAW_BLOCK_RE, (_, tag, attrs, content) => {
    const index = blocks.length;
    blocks.push('<' + tag + attrs + '>' + content + '</' + tag + '>');
    return '%%KNIU_RAW_' + index + '%%';
  });
  return { source: out, blocks };
}

function restoreRawBlocks(html, blocks) {
  return html.replace(/%%KNIU_RAW_(\d+)%%/g, (_, idx) => blocks[Number(idx)] ?? '');
}

const STATIC_PLACEHOLDER_RE = /%%KNIU_S_(\d+)%%/g;
const STATIC_ATTR_DYNAMIC_RE = /(?:^|\s)(?::|@)[A-Za-z_]|\bref\s*=|\bdata-kniu|\{\{/;
const STATIC_TEXT_DYNAMIC_RE = /\{\{|%%KNIU_/;
const STATIC_EXCLUDED_TAGS = new Set(['include', 'slot', 'template', 'style', 'script', 'pre', 'textarea', 'kniu-router-view']);
const STATIC_VOID_TAGS = new Set(['br', 'img', 'input', 'hr', 'meta', 'link', 'source', 'col', 'area', 'base', 'embed', 'param', 'track', 'wbr']);
const STATIC_TAG_RE = /<\/?([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;

export function restoreStaticBlocks(html) {
  if (!html.includes('%%KNIU_S_')) return html;
  const blocks = globalThis.__VIEW_STATIC_BLOCKS__;
  if (!Array.isArray(blocks)) return html;
  return html.replace(STATIC_PLACEHOLDER_RE, (_, index) => blocks[Number(index)] ?? '');
}

export function extractStaticBlocks(html, blocks) {
  const source = String(html ?? '');
  if (!source.includes('<') || !Array.isArray(blocks)) return source;
  const stack = [];
  const candidates = [];
  let cursor = 0;
  let match;
  let aborted = false;
  STATIC_TAG_RE.lastIndex = 0;
  while ((match = STATIC_TAG_RE.exec(source)) !== null) {
    const between = source.slice(cursor, match.index);
    if (between && STATIC_TEXT_DYNAMIC_RE.test(between) && stack.length) {
      stack[stack.length - 1].allStatic = false;
    }
    cursor = match.index + match[0].length;
    const raw = match[0];
    if (raw.startsWith('<!')) continue;
    const tagName = match[1].toLowerCase();
    if (raw.startsWith('</')) {
      if (!stack.length || stack[stack.length - 1].tag !== tagName) { aborted = true; break; }
      const node = stack.pop();
      const parent = stack[stack.length - 1] || null;
      if (!node.allStatic) { if (parent) parent.allStatic = false; continue; }
      candidates.push({ start: node.start, end: cursor });
      continue;
    }
    const dynamic = STATIC_EXCLUDED_TAGS.has(tagName) || STATIC_ATTR_DYNAMIC_RE.test(match[2] || '');
    const selfClosing = /\/>\s*$/.test(raw) || STATIC_VOID_TAGS.has(tagName);
    if (selfClosing) {
      if (dynamic && stack.length) stack[stack.length - 1].allStatic = false;
      continue;
    }
    stack.push({ tag: tagName, start: match.index, allStatic: !dynamic });
  }
  if (aborted || !candidates.length) return source;
  candidates.sort(function (left, right) { return left.start - right.start || right.end - left.end; });
  const ranges = [];
  let covered = -1;
  candidates.forEach(function (item) {
    if (item.start < covered) return;
    ranges.push(item);
    covered = item.end;
  });
  let output = '';
  let previous = 0;
  ranges.forEach(function (range) {
    output += source.slice(previous, range.start);
    const index = blocks.push(source.slice(range.start, range.end)) - 1;
    output += `%%KNIU_S_${index}%%`;
    previous = range.end;
  });
  return output + source.slice(previous);
}

export function renderTemplate(source, data = {}, options = {}) {
  const previous = markMode;
  markMode = options.collect === true;
  try {
    const resolvedSource = resolveTemplateAliases(String(source ?? ''));
    const { source: protectedSource, blocks } = protectRawBlocks(resolvedSource);
    const html = expandSelfClosingTags(
      renderBlocks(bindAttributes(protectedSource, data), data)
    );
    return restoreStaticBlocks(restoreRawBlocks(html, blocks));
  } finally { markMode = previous; }
}

let aliasTable = {};
let headAssets = null;

export function configureTemplateEngine(options = {}) {
  aliasTable = options.aliases && typeof options.aliases === 'object' ? options.aliases : {};
  headAssets = options.head && typeof options.head === 'object' ? options.head : null;
}

export function resolveTemplateAliases(source) {
  return resolveAliasReferences(String(source ?? ''), aliasTable);
}

function appendHeadLink(rel, href) {
  if ([...document.head.querySelectorAll('link')].some((link) => link.rel === rel && link.href === new URL(href, document.baseURI).href)) return;
  const link = document.createElement('link');
  link.rel = rel;
  link.href = href;
  document.head.append(link);
}

function appendHeadScript(src) {
  const script = document.createElement('script');
  script.src = src;
  script.async = false;
  document.head.append(script);
}

export function mountTemplateHead() {
  if (!headAssets || !globalThis.document) return;
  if (headAssets.favicon) appendHeadLink('icon', resolveTemplateAliases(headAssets.favicon));
  const styles = Array.isArray(headAssets.style) ? headAssets.style : [];
  styles.forEach((href) => appendHeadLink('stylesheet', resolveTemplateAliases(href)));
  const scripts = Array.isArray(headAssets.js) ? headAssets.js : [];
  scripts.forEach((src) => appendHeadScript(resolveTemplateAliases(src)));
}

export { escapeHtml };