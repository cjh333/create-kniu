import { resolveAliasReferences } from './kniu-util.mjs';

const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

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

function readPath(source, scope) {
  const path = source.trim();
  if (!/^(?:[\p{L}_$][\p{L}\p{N}_$]*|\*this)(?:\.[\p{L}_$][\p{L}\p{N}_$]*)*$/u.test(path)) return undefined;
  if (path === '*this' || path === 'this') return scope.this;
  const keys = path.split('.');
  if (keys.some((key) => ['__proto__', 'prototype', 'constructor'].includes(key))) return undefined;
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

export function evaluateTemplateExpression(source, scope = {}) {
  const code = unwrapExpression(source);
  if (!code) return '';
  const ternary = splitTernary(code);
  if (ternary) {
    return evaluateTemplateExpression(ternary[0], scope)
      ? evaluateTemplateExpression(ternary[1], scope)
      : evaluateTemplateExpression(ternary[2], scope);
  }
  const or = splitOperator(code, '||');
  if (or) return evaluateTemplateExpression(or[0], scope) || evaluateTemplateExpression(or[1], scope);
  const and = splitOperator(code, '&&');
  if (and) return evaluateTemplateExpression(and[0], scope) && evaluateTemplateExpression(and[1], scope);
  if (code.startsWith('!')) return !evaluateTemplateExpression(code.slice(1), scope);
  if (/^(?:true|false)$/i.test(code)) return code.toLowerCase() === 'true';
  if (/^null$/i.test(code)) return null;
  if (/^undefined$/i.test(code)) return undefined;
  if (/^-?(?:\d+\.?\d*|\.\d+)$/.test(code)) return Number(code);
  if (/^(['"]).*\1$/s.test(code)) return code.slice(1, -1).replace(/\\(['"\\])/g, '$1');
  const comparison = /^(.*?)\s*(===|!==|>=|<=|==|!=|>|<)\s*(.*?)$/.exec(code);
  if (comparison) {
    const left = evaluateTemplateExpression(comparison[1], scope);
    const right = evaluateTemplateExpression(comparison[3], scope);
    switch (comparison[2]) {
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
  return readPath(code, scope);
}

let markMode = false;

function markText(code, value, raw) {
  if (!markMode) return value;
  return `<!--kniu-t:${encodeURIComponent(code)}${raw ? '|raw' : ''}-->${value}<!--/kniu-t-->`;
}

const interpolateText = (source, scope) => source
  .replace(/{{@\s*([^{}]+?)\s*}}/g, (_, code) => markText(code, String(evaluateTemplateExpression(code, scope) ?? ''), true))
  .replace(/{{{\s*([^{}]+?)\s*}}}/g, (_, code) => markText(code, String(evaluateTemplateExpression(code, scope) ?? ''), true))
  .replace(/{{\s*([^{}]+?)\s*}}/g, (_, code) => markText(code, escapeHtml(evaluateTemplateExpression(code, scope)), false));

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

function interpolatePlain(source, scope) {
  return source
    .replace(/{{@\s*([^{}]+?)\s*}}/g, (_, code) => String(evaluateTemplateExpression(code, scope) ?? ''))
    .replace(/{{{\s*([^{}]+?)\s*}}}/g, (_, code) => String(evaluateTemplateExpression(code, scope) ?? ''))
    .replace(/{{\s*([^{}]+?)\s*}}/g, (_, code) => escapeHtml(evaluateTemplateExpression(code, scope)));
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

function parseOptionObject(raw) {
  const text = String(raw ?? '').trim();
  const braceMatch = /^\{\{([\s\S]*)\}\}$/.exec(text);
  if (!braceMatch) return null;
  const inner = braceMatch[1].trim();
  if (!inner) return {};
  const entries = [];
  for (const item of splitOptionEntries(inner)) {
    const entry = item.trim();
    if (!entry) continue;
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
    const keyMatch = /^[\p{L}_$][\p{L}\p{N}_$]*$/u.test(rawKey) ? rawKey : rawKey;
    if (keyMatch == null) return null;
    const stringMatch = /^(['"])([\s\S]*)\1$/.exec(rawValue);
    const value = stringMatch ? stringMatch[2]
      : /^(?:true|false)$/.test(rawValue) ? rawValue === 'true'
      : /^-?\d+\.?\d*$/.test(rawValue) ? Number(rawValue) : null;
    if (stringMatch == null && value === null) return null;
    entries.push([keyMatch, value]);
  }
  return entries.length ? Object.fromEntries(entries) : {};
}

function transformTag(tag, scope) {
  if (/^<template[\s>]/i.test(tag)) return tag;
  const isComponent = /^<[a-z][a-z0-9]*-/i.test(tag);
  return tag.replace(/\s+(@[\w-]+(?:\.[\w-]+)*|:\[[\w-]+\]|:[\w-]+)\s*=\s*(["'])(.*?)\2/gi, (full, name, quote, code) => {
    if (name[0] === '@') {
      const parts = name.slice(1).split('.');
      if (!events.has(parts[0])) throw new Error(`不支持的 HTML 事件：${parts[0]}`);
      return ` data-kniu-event="${escapeHtml(parts.join('.'))}" data-kniu-handler="${encodeURIComponent(code.trim())}"`;
    }
    if (name.toLowerCase() === ':option' && !isComponent) {
      const objectLiteral = parseOptionObject(code);
      if (objectLiteral) {
        return Object.entries(objectLiteral).map(([key, item]) => {
          const eventMatch = /^on([A-Z][a-z0-9][\w$]*)$/.exec(key);
          if (eventMatch) {
            const eventName = eventMatch[1].toLowerCase();
            if (!events.has(eventName)) throw new Error(`不支持的 HTML 事件：${eventName}`);
            const handler = String(item ?? '');
            return ` data-kniu-event="${escapeHtml(eventName)}" data-kniu-handler="${encodeURIComponent(handler)}"`;
          }
          if (!/^[A-Za-z_:][-A-Za-z0-9_:.]*$/.test(key)) {
            console.warn(`[kniu] :option 键名不是合法 HTML 属性名，已跳过：${key}`);
            return '';
          }
          return ` ${key}="${escapeHtml(item)}"`;
        }).join('');
      }
      const pathValue = evaluateTemplateExpression(code, scope);
      if (pathValue && typeof pathValue === 'object' && !Array.isArray(pathValue)) {
        return Object.entries(pathValue).map(([key, item]) => ` ${key}="${escapeHtml(item)}"`).join('');
      }
      if (/^\{\{[\s\S]*\}\}$/.test(code.trim()) || /\{\{/.test(code)) {
        console.warn(`[kniu] :option 对象解析失败，请检查键值对语法：${code}`);
      }
      const fallback = String(pathValue ?? '');
      return ` data-kniu-option="${escapeHtml(fallback)}"`;
    }
    const value = /{{[\s\S]*?}}/.test(code)
      ? code.replace(/{{\s*([^{}]+?)\s*}}/g, (_, token) => String(evaluateTemplateExpression(token, scope) ?? ''))
      : evaluateTemplateExpression(code, scope);
    if (name.toLowerCase() === ':form') {
      // 标签若已有手动 value 属性（如 value="{{user.name}}"），directive 不再重复输出 value，
      // 否则产生重复属性（浏览器只认第一个，且 HTML 无效）。
      const hasManualValue = /\svalue\s*=\s*["']/i.test(tag);
      return hasManualValue
        ? ` data-kniu-form="${encodeURIComponent(code)}"`
        : ` data-kniu-form="${encodeURIComponent(code)}" value="${escapeHtml(value)}"`;
    }
    const custom = /^:\[([^\]]+)\]$/i.exec(name);
    return ` ${custom ? `data-${custom[1]}` : name.slice(1)}="${escapeHtml(value)}"`;
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

function renderBlocks(source, scope) {
  const openAt = source.search(/<template\b/i);
  if (openAt === -1) return interpolate(source, scope);
  const openEnd = matchTagAt(source, openAt);
  if (openEnd === -1) return interpolate(source, scope);
  const close = closingIndex(source, openEnd);
  if (!close) return interpolate(source, scope);
  const attrs = source.slice(openAt + 9, openEnd - 1);
  const body = source.slice(openEnd, close.start);
  const ifMatch = /:(?:if|elseif)\s*=\s*["']([^"']*)["']/i.exec(attrs);
  const forMatch = /:for\s*=\s*["']([^"']+)["']/i.exec(attrs);
  const itemMatch = /:for-item\s*=\s*["']([^"']+)["']/i.exec(attrs);
  const indexMatch = /:for-index\s*=\s*["']([^"']+)["']/i.exec(attrs);
  let rendered = '';
  if (forMatch) {
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
          const previousMark = markMode;
          markMode = false;
          try { return renderBlocks(body, itemScope); }
          finally { markMode = previousMark; }
        }).join('');
      }
    }
  } else if (!ifMatch || evaluateTemplateExpression(ifMatch[1], scope)) {
    rendered = renderBlocks(body, scope);
  }
  return interpolate(source.slice(0, openAt), scope) + rendered + renderBlocks(source.slice(close.end), scope);
}

export function renderTemplate(source, data = {}, options = {}) {
  const previous = markMode;
  markMode = options.collect === true;
  try { return renderBlocks(bindAttributes(resolveTemplateAliases(source), data), data); }
  finally { markMode = previous; }
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