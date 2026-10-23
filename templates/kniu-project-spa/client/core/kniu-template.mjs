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
  if (!/^(?:[A-Za-z_$][\w$]*|\*this)(?:\.[A-Za-z_$][\w$]*)*$/.test(path)) return undefined;
  if (path === '*this' || path === 'this') return scope.this;
  const keys = path.split('.');
  if (keys.some((key) => ['__proto__', 'prototype', 'constructor'].includes(key))) return undefined;
  return keys.reduce((value, key) => value == null ? undefined : value[key], scope);
}

// 按顶层 ? : 拆三元表达式，忽略引号内的字符并支持条件分支中嵌套三元。
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
  // 三元的优先级低于 || 与 &&，必须先拆分再逐段求值。
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
  ? source.split(/(<[^>]*>)/).map((part) => (part.startsWith('<') ? interpolatePlain(part, scope) : interpolateText(part, scope))).join('')
  : interpolatePlain(source, scope));

function interpolatePlain(source, scope) {
  return source
    .replace(/{{@\s*([^{}]+?)\s*}}/g, (_, code) => String(evaluateTemplateExpression(code, scope) ?? ''))
    .replace(/{{{\s*([^{}]+?)\s*}}}/g, (_, code) => String(evaluateTemplateExpression(code, scope) ?? ''))
    .replace(/{{\s*([^{}]+?)\s*}}/g, (_, code) => escapeHtml(evaluateTemplateExpression(code, scope)));
}

const events = new Set(['click', 'dblclick', 'input', 'change', 'submit', 'reset', 'focus', 'blur', 'focusin', 'focusout', 'mouseenter', 'mouseleave', 'mouseover', 'mouseout', 'mousemove', 'mousedown', 'mouseup', 'contextmenu', 'wheel', 'scroll', 'touchstart', 'touchmove', 'touchend', 'drag', 'dragstart', 'dragend', 'dragover', 'drop', 'load', 'error', 'resize', 'keydown', 'keyup', 'keypress']);

const bindAttributes = (source, scope) => source.replace(/<[a-z][^>]*>/gi, (tag) => {
  if (/^<template[\s>]/i.test(tag)) return tag;
  return tag.replace(/\s+(@[\w-]+(?:\.[\w-]+)*|:\[[\w-]+\]|:[\w-]+)\s*=\s*(["'])(.*?)\2/gi, (full, name, quote, code) => {
    if (name[0] === '@') {
      const parts = name.slice(1).split('.');
      if (!events.has(parts[0])) throw new Error(`不支持的 HTML 事件：${parts[0]}`);
      return ` data-kniu-event="${escapeHtml(parts.join('.'))}" data-kniu-handler="${encodeURIComponent(code.trim())}"`;
    }
    const value = /{{[\s\S]*?}}/.test(code)
      ? code.replace(/{{\s*([^{}]+?)\s*}}/g, (_, token) => String(evaluateTemplateExpression(token, scope) ?? ''))
      : evaluateTemplateExpression(code, scope);
    if (name.toLowerCase() === ':form') return ` data-kniu-form="${encodeURIComponent(code)}" value="${escapeHtml(value)}"`;
    const custom = /^:\[([^\]]+)\]$/i.exec(name);
    return ` ${custom ? `data-${custom[1]}` : name.slice(1)}="${escapeHtml(value)}"`;
  });
});

function closingIndex(source, openEnd) {
  const token = /<template\b[^>]*>|<\/template\s*>/gi;
  token.lastIndex = openEnd;
  let depth = 1;
  let match;
  while ((match = token.exec(source))) {
    depth += match[0][1] === '/' ? -1 : 1;
    if (!depth) return { start: match.index, end: token.lastIndex };
  }
  return null;
}

function renderBlocks(source, scope) {
  const open = /<template\b([^>]*)>/i.exec(source);
  if (!open) return interpolate(source, scope);
  const close = closingIndex(source, open.index + open[0].length);
  if (!close) return interpolate(source, scope);
  const attrs = open[1];
  const body = source.slice(open.index + open[0].length, close.start);
  const ifMatch = /:(?:if|elseif)\s*=\s*["']([^"']+)["']/i.exec(attrs);
  const forMatch = /:for\s*=\s*["']([^"']+)["']/i.exec(attrs);
  const itemMatch = /:for-item\s*=\s*["']([^"']+)["']/i.exec(attrs);
  const indexMatch = /:for-index\s*=\s*["']([^"']+)["']/i.exec(attrs);
  let rendered = '';
  if (forMatch) {
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
  } else if (!ifMatch || evaluateTemplateExpression(ifMatch[1], scope)) {
    rendered = renderBlocks(body, scope);
  }
  return interpolate(source.slice(0, open.index), scope) + rendered + renderBlocks(source.slice(close.end), scope);
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