import { kniuWarn, KNDEBUG } from './Kniu-Debug.mjs';

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;
const COMMENT_NODE = 8;
const FRAGMENT_NODE = 11;
const KEY_OPEN_RE = /^kniu-k:/;
const KEY_CLOSE_DATA = '/kniu-k';
const PRESERVE_ATTR = 'data-kniu-preserve';
const INCLUDE_HOST_ATTR = 'data-kniu-view-host';
const nodeKeyOf = (node) => {
  if (node.nodeType === TEXT_NODE) return '#text';
  if (node.nodeType === COMMENT_NODE) return '#comment';
  return node.localName;
};

/** ShadowRoot 没有 ownerDocument，统一从宿主或全局兜底取 Document。 */
const docOf = (parent) => parent?.ownerDocument || parent?.host?.ownerDocument || globalThis.document;
const isPreserveNode = (node) => node.nodeType === ELEMENT_NODE && node.hasAttribute?.(PRESERVE_ATTR);
const isStyleElement = (node) => node.nodeType === ELEMENT_NODE && node.localName === 'style';
const decodeBlockKey = (raw) => {
  const value = String(raw ?? '').replace(/^kniu-k:/, '');
  try { return decodeURIComponent(value); } catch { return value; }
};

/** 提取直接子级中的顶层键控块（含开闭锚点），嵌套块按深度跳过。 */
function keyedBlocks(parent) {
  const blocks = [];
  const children = [...parent.childNodes];
  let index = 0;
  while (index < children.length) {
    const node = children[index];
    index += 1;
    if (node.nodeType !== COMMENT_NODE || !KEY_OPEN_RE.test(node.data || '')) continue;
    const key = decodeBlockKey(node.data);
    const nodes = [node];
    let depth = 1;
    let closed = false;
    while (index < children.length) {
      const current = children[index];
      index += 1;
      if (current.nodeType === COMMENT_NODE) {
        const data = current.data || '';
        if (KEY_OPEN_RE.test(data)) depth += 1;
        else if (data === KEY_CLOSE_DATA) {
          depth -= 1;
          if (depth <= 0) { nodes.push(current); closed = true; break; }
        }
      }
      nodes.push(current);
    }
    if (closed) blocks.push({ key, nodes });
  }
  return blocks;
}

const nodesCompatible = (left, right) => {
  if (left.nodeType !== right.nodeType) return false;
  if (left.nodeType === ELEMENT_NODE) return left.localName === right.localName;
  return true;
};

const blockPairable = (sourceNodes, targetNodes) => sourceNodes.length === targetNodes.length
  && sourceNodes.every((node, index) => nodesCompatible(node, targetNodes[index]));

/** 标签骨架：剥离 style 块、全部属性与纯文本（组件会在运行时注入属性，不能参与比对）。 */
function skeletonHtml(html) {
  return String(html ?? '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<\/?([a-zA-Z][\w-]*)[^>]*>/g, '<$1>')
    .replace(/>[^<]+</g, '><');
}

/** 直接子级里的顶层 <style> 文本内容多重集。 */
const styleContentCount = (parent) => {
  const counts = new Map();
  for (const node of parent.childNodes) {
    if (!isStyleElement(node)) continue;
    const css = String(node.textContent ?? '');
    counts.set(css, (counts.get(css) || 0) + 1);
  }
  return counts;
};

const trace = (message) => { if (typeof globalThis.__kniuDiffTrace === 'function') globalThis.__kniuDiffTrace(message); };
const parentTag = (parent) => (parent.nodeType === 11 ? '#fragment' : (parent.localName || parent.nodeName || '?') + (parent.host ? '[host]' : ''));

function patchAttributes(source, target, ctx) {
  for (const attribute of [...source.attributes]) {
    if (target.getAttribute(attribute.name) !== attribute.value) {
      target.setAttribute(attribute.name, attribute.value);
      ctx.changed = true;
      trace(`setAttr ${target.localName}@${attribute.name}`);
    }
  }
  // include shadow 同步为合并模式：运行时注入的属性（如组件写回的 style）不回收。
  if (ctx.mergeAttributes) return;
  for (const attribute of [...target.attributes]) {
    if (!source.hasAttribute(attribute.name)) {
      target.removeAttribute(attribute.name);
      ctx.changed = true;
      trace(`rmAttr ${target.localName}@${attribute.name}`);
    }
  }
}

/** 节点在 ref 之前是否已就位（忽略注释、保留节点与 fragment 层的顶层 style）。 */
function positioned(node, ref, ignoreStyles) {
  if (ref) return node.nextSibling === ref;
  let next = node.nextSibling;
  while (next && (next.nodeType === COMMENT_NODE || isPreserveNode(next) || (ignoreStyles && isStyleElement(next)))) {
    next = next.nextSibling;
  }
  return next === null;
}

function patchComment(source, target, ctx) {
  if (target.data !== source.data) {
    target.data = source.data;
    ctx.changed = true;
    trace(`comment ${String(target.data).slice(0, 40)}`);
  }
}

function patchText(source, target, ctx) {
  if (target.nodeValue !== source.nodeValue) {
    target.nodeValue = source.nodeValue;
    ctx.changed = true;
    trace(`text ${String(source.nodeValue).slice(0, 40)}`);
  }
}

/**
 * 就地修补一对已匹配的元素节点。
 * include 宿主/自定义组件挂载后会自行改写光照子级（slot 扁平化、运行时节点与
 * 属性），增量补丁不与之竞争：只合并属性；include 宿主标签骨架变化时才
 * 报告不可调和，由调用方回退全量渲染。
 */
function patchElement(source, target, ctx) {
  if (target.shadowRoot) {
    patchAttributes(source, target, { ...ctx, mergeAttributes: true });
    if (target.hasAttribute(INCLUDE_HOST_ATTR)
      && skeletonHtml(target.__kniuIncludeHtml) !== skeletonHtml(String(source.innerHTML ?? ''))) {
      ctx.ok = false;
    }
    return null;
  }
  patchAttributes(source, target, ctx);
  patchChildrenOf(target, source, ctx);
  return null;
}

function patchNode(source, target, ctx) {
  if (target.nodeType === COMMENT_NODE) return patchComment(source, target, ctx), null;
  if (target.nodeType === TEXT_NODE) return patchText(source, target, ctx), null;
  return patchElement(source, target, ctx);
}

/**
 * 以 sourceParent 的子级为目标顺序，对 targetParent 做键控/序数增量补丁。
 * 补丁过程中 sourceParent 的子节点可能被摘取进目标树，因此每轮校验
 * 需要用全新克隆重建 wrapper。
 */
function patchChildrenOf(targetParent, sourceParent, ctx) {
  if (!ctx.ok) return;
  const sourceBlocks = keyedBlocks(sourceParent);
  const targetBlocks = keyedBlocks(targetParent);
  const useKeys = sourceBlocks.length > 0 && targetBlocks.length > 0;
  const sourceByKey = new Map(useKeys ? sourceBlocks.map((block) => [block.key, block]) : []);
  const targetByKey = new Map(useKeys ? targetBlocks.map((block) => [block.key, block]) : []);
  const blockKeyOfSource = new Map();
  const blockKeyOfTarget = new Map();
  for (const block of sourceBlocks) for (const node of block.nodes) blockKeyOfSource.set(node, block.key);
  for (const block of targetBlocks) for (const node of block.nodes) blockKeyOfTarget.set(node, block.key);

  // shadow root 顶层的 <style> 已被样式规范化吸收，从比对序列中剔除，单独对齐。
  const skipTopStyles = targetParent.nodeType === FRAGMENT_NODE;
  const matchableChildren = (parent) => [...parent.childNodes]
    .filter((node) => !(skipTopStyles && isStyleElement(node)));
  const sourceNodes = matchableChildren(sourceParent);
  const targetNodes = matchableChildren(targetParent);
  const counterparts = new Map();
  const blockReplaceKeys = new Set();

  // 组件自管区域：直接子元素含自定义元素时，组件会增删/移动同级节点，
  // 结构比对不与之竞争，只修补已配对节点的文本/属性；结构性差异标记
  // ctx.pending，由 patchRenderedScope 回退全量渲染，保证数据变化不丢。
  const managedParent = (targetParent.nodeType === ELEMENT_NODE || targetParent.nodeType === FRAGMENT_NODE)
    && [...targetParent.children].some((child) => {
      if (!child.localName || !child.localName.includes('-')) return false;
      return Boolean(child.shadowRoot) || Boolean(globalThis.customElements?.get?.(child.localName));
    });

  if (useKeys) {
    for (const [key, sourceBlock] of sourceByKey) {
      const targetBlock = targetByKey.get(key);
      if (!targetBlock) continue;
      if (blockPairable(sourceBlock.nodes, targetBlock.nodes)) {
        sourceBlock.nodes.forEach((node, index) => counterparts.set(node, targetBlock.nodes[index]));
      } else {
        blockReplaceKeys.add(key);
      }
    }
  }

  // 非块内节点按 nodeKey + 序数配对（键控模式下仅匹配不属于任何块的节点）。
  const counters = new Map();
  for (const sourceNode of sourceNodes) {
    if (blockKeyOfSource.has(sourceNode)) continue;
    const key = nodeKeyOf(sourceNode);
    const ordinal = counters.get(key) || 0;
    counters.set(key, ordinal + 1);
    let seen = 0;
    let matched = null;
    for (const candidate of targetNodes) {
      if (blockKeyOfTarget.has(candidate)) continue;
      if (nodeKeyOf(candidate) !== key) continue;
      if (seen === ordinal) { matched = candidate; break; }
      seen += 1;
    }
    if (matched) counterparts.set(sourceNode, matched);
  }

  // 先修补已配对节点（自底向上递归），再做排序与增删。
  for (const [sourceNode, targetNode] of [...counterparts]) {
    const replacement = patchNode(sourceNode, targetNode, ctx);
    if (!ctx.ok) return;
    if (replacement && replacement !== targetNode) counterparts.set(sourceNode, replacement);
  }

  if (managedParent) {
    const unmatchedSource = sourceNodes.some((node) => !counterparts.has(node));
    let orderOk = true;
    let lastIndex = -1;
    for (const sourceNode of sourceNodes) {
      const targetNode = counterparts.get(sourceNode);
      if (!targetNode) continue;
      const index = targetNodes.indexOf(targetNode);
      if (index <= lastIndex) { orderOk = false; break; }
      lastIndex = index;
    }
    if (unmatchedSource || !orderOk) ctx.pending = true;
    return;
  }

  let ref = null;
  for (let index = sourceNodes.length - 1; index >= 0; index -= 1) {
    const sourceNode = sourceNodes[index];
    let node = counterparts.get(sourceNode) || null;
    if (!node) {
      node = docOf(targetParent).importNode(sourceNode, true);
      targetParent.insertBefore(node, ref);
      ctx.changed = true;
      trace(`insert@${parentTag(targetParent)} < ${sourceNode.localName || sourceNode.nodeName || '#text'}`);
    } else if (!positioned(node, ref, skipTopStyles)) {
      targetParent.insertBefore(node, ref);
      ctx.changed = true;
      trace(`move@${parentTag(targetParent)} < ${node.localName || node.nodeName}`);
    }
    ref = node;
  }

  const matchedTargets = new Set(counterparts.values());
  for (const targetNode of targetNodes) {
    if (isPreserveNode(targetNode)) continue;
    if (matchedTargets.has(targetNode)) continue;
    if (useKeys) {
      const blockKey = blockKeyOfTarget.get(targetNode);
      if (blockKey && sourceByKey.has(blockKey) && !blockReplaceKeys.has(blockKey)) continue;
    }
    targetNode.remove();
    ctx.changed = true;
    trace(`remove@${parentTag(targetParent)} < ${targetNode.localName || targetNode.nodeName || '#text'}`);
  }

  if (skipTopStyles) {
    const sourceStyles = styleContentCount(sourceParent);
    const targetStyles = styleContentCount(targetParent);
    const sameStyles = sourceStyles.size === targetStyles.size
      && [...sourceStyles].every(([css, count]) => targetStyles.get(css) === count);
    if (!sameStyles) {
      for (const node of [...targetParent.childNodes]) {
        if (isStyleElement(node) && !sourceStyles.has(String(node.textContent ?? ''))) {
          node.remove();
          ctx.changed = true;
        }
      }
      const remaining = styleContentCount(targetParent);
      const styleDoc = docOf(targetParent);
      for (const node of [...sourceParent.childNodes]) {
        if (!isStyleElement(node)) continue;
        const css = String(node.textContent ?? '');
        const wanted = sourceStyles.get(css) || 0;
        if ((remaining.get(css) || 0) < wanted) {
          targetParent.insertBefore(styleDoc.importNode(node, true), null);
          remaining.set(css, (remaining.get(css) || 0) + 1);
          ctx.changed = true;
        }
      }
    }
  }

  // 常驻保留节点固定回结尾，与全量 wipe 语义一致。
  for (const preserveNode of [...targetParent.childNodes]) {
    if (isPreserveNode(preserveNode) && preserveNode.nextSibling) {
      targetParent.appendChild(preserveNode);
      ctx.changed = true;
    }
  }
}

/**
 * 入口：把渲染出的 html 增量补丁到 scope（通常是路由视图的 shadowRoot）。
 * 返回 { ok, changed }：ok=false 表示未收敛或不可调和，调用方应回退全量重写。
 */
export function patchRenderedScope(scope, html, options = {}) {
  if (!scope || typeof scope.insertBefore !== 'function' || typeof scope.querySelectorAll !== 'function') {
    return { ok: false, changed: false };
  }
  const ownerDocument = scope.ownerDocument || scope.host?.ownerDocument || globalThis.document;
  if (!ownerDocument) return { ok: false, changed: false };
  let content = null;
  try {
    const parsed = new DOMParser().parseFromString(`<template>${String(html ?? '')}</template>`, 'text/html');
    content = parsed.head.firstElementChild?.content || null;
  } catch (error) {
    kniuWarn(KNDEBUG.VIEW, '[kniu-diff] 渲染结果解析失败，回退全量渲染：', error);
    return { ok: false, changed: false };
  }
  if (!content || !content.firstChild) return { ok: false, changed: false };
  const buildWrapper = () => {
    const wrapper = ownerDocument.createElement('div');
    wrapper.appendChild(content.cloneNode(true));
    return wrapper;
  };
  try {
    const ctx = { ok: true, changed: false, pending: false };
    patchChildrenOf(scope, buildWrapper(), ctx);
    if (!ctx.ok || ctx.pending) return { ok: false, changed: ctx.changed };
    if (!ctx.changed) return { ok: true, changed: false };
    const verify = { ok: true, changed: false, pending: false };
    patchChildrenOf(scope, buildWrapper(), verify);
    if (!verify.ok || verify.pending || verify.changed) return { ok: false, changed: true };
    return { ok: true, changed: true };
  } catch (error) {
    kniuWarn(KNDEBUG.VIEW, '[kniu-diff] 增量补丁失败，回退全量渲染：', error);
    return { ok: false, changed: true };
  }
}

export { keyedBlocks, patchChildrenOf, skeletonHtml };