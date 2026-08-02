// 轻量响应式 + 数据绑定模板引擎（kniutemplate）。
const SUBS = Symbol('kniu-subs');
const IS_REACTIVE = Symbol('kniu-is-reactive');
const proxyCache = new WeakMap();
let binding = false;

function isObject(v) {
  return v !== null && typeof v === 'object';
}

function getPath(state, path) {
  return String(path)
    .split('.')
    .reduce((obj, key) => (obj == null ? obj : obj[key]), state);
}

function setPath(state, path, value) {
  const parts = String(path).split('.');
  let obj = state;
  for (let i = 0; i < parts.length - 1; i++) {
    if (obj == null) return;
    obj = obj[parts[i]];
  }
  if (obj != null) obj[parts[parts.length - 1]] = value;
}

// ---- 表达式求值（带访问路径记录，用于精确订阅） ----
// 构造一个 Proxy 作用域：extra 中的局部变量（如循环 index/item）优先，其余走 base（响应式 state）。
function makeScope(base, extra) {
  const accessed = [];
  const wrap = (obj, prefix) => {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date || obj instanceof Node) return obj;
    if (Array.isArray(obj)) return obj; // 保留原生数组，Array.isArray 才不会失效
    return new Proxy(obj, {
      has(_, key) {
        if (key === Symbol.unscopables) return false;
        if (prefix === '' && extra && key in extra) return true;
        if (prefix === '') return key in obj;
        return key in obj;
      },
      get(_, key) {
        if (key === Symbol.unscopables) return undefined;
        if (typeof key !== 'string') return obj[key];
        if (prefix === '' && extra && key in extra) {
          accessed.push(key);
          return extra[key];
        }
        const full = prefix ? prefix + '.' + key : key;
        accessed.push(full);
        const v = obj[key];
        if (v === null || typeof v !== 'object') return v;
        if (v instanceof Date || v instanceof Node || Array.isArray(v)) return v;
        return wrap(v, full);
      },
    });
  };
  return { proxy: wrap(base, ''), accessed };
}

// 判断表达式是否意图构造对象字面量：
//  - 已带花括号 { ... }
//  - 含展开 ...obj
//  - 含 key: value（排除三元 a ? b : c 的冒号、URL 的 ://）
//  - 纯「标识符 / 展开」逗号列表（即 {a, b} 简写形式）
function looksLikeObject(e) {
  if (!e) return false;
  if (e.startsWith('{') && e.endsWith('}')) return true;
  if (e.includes('...')) return true;
  const ci = e.indexOf(':');
  if (ci !== -1) {
    const qi = e.indexOf('?');
    if ((qi === -1 || qi > ci) && e[ci + 1] !== '/') return true;
  }
  // 简写对象 {a, b}：必须是「至少两个标识符用逗号分隔」。
  // 单个标识符（如 i / j / index / item / nopay）应视为普通变量，不能包裹成 ({i})，否则会渲染成 [object Object]。
  return /^[A-Za-z_$][\w$]*\s*,\s*[\s\S]+$/.test(e);
}

// 去除属性值外层的 {{ }} 包裹（HTML 中 kniu:class="{{ expr }}" 这类写法，
// value 字面包含 {{ }}；而 kniu:model="message" 不带包裹。两条路径都兼容）。
function stripBraces(raw) {
  const m = String(raw).trim().match(/^\{\{([\s\S]*)\}\}$/);
  return m ? m[1].trim() : String(raw).trim();
}

// ---- 元素-属性兼容性（kniu:<attr> 仅允许写在该元素原生支持的属性上） ----
const GLOBAL_ATTRS = new Set([
  'id', 'class', 'style', 'title', 'lang', 'dir', 'tabindex', 'hidden', 'role',
  'draggable', 'contenteditable', 'translate', 'spellcheck', 'accesskey',
  'autocapitalize', 'enterkeyhint', 'inputmode', 'slot', 'part', 'exportparts',
  'is', 'inert', 'popover',
]);

// 属性名 → 允许使用它的标签（小写）。未列出的属性一律视为自定义属性，需用 kniu:[name] 设置。
const ATTR_TAGS = {
  href: ['a', 'area', 'base', 'link'],
  src: ['img', 'script', 'iframe', 'audio', 'video', 'source', 'track', 'embed', 'input'],
  srcset: ['img', 'source'],
  alt: ['img', 'area', 'input'],
  value: ['input', 'textarea', 'button', 'option', 'li', 'meter', 'progress', 'param'],
  type: ['input', 'button', 'script', 'link', 'source', 'ol', 'menu', 'a', 'form', 'embed', 'object'],
  name: ['button', 'fieldset', 'form', 'iframe', 'input', 'object', 'output', 'select', 'textarea', 'map', 'meta', 'param'],
  placeholder: ['input', 'textarea'],
  disabled: ['button', 'input', 'select', 'textarea', 'optgroup', 'fieldset', 'option'],
  checked: ['input'],
  selected: ['option'],
  readonly: ['input', 'textarea'],
  required: ['input', 'textarea', 'select'],
  multiple: ['input', 'select'],
  min: ['input', 'meter', 'progress'],
  max: ['input', 'meter', 'progress'],
  minlength: ['input', 'textarea'],
  maxlength: ['input', 'textarea'],
  pattern: ['input'],
  step: ['input'],
  accept: ['input'],
  capture: ['input'],
  list: ['input'],
  autocomplete: ['input', 'form', 'select', 'textarea'],
  autofocus: ['button', 'input', 'select', 'textarea'],
  target: ['a', 'form', 'base'],
  rel: ['a', 'link', 'area'],
  hreflang: ['a', 'link'],
  download: ['a', 'area'],
  ping: ['a', 'area'],
  referrerpolicy: ['a', 'area', 'iframe', 'img', 'link', 'script'],
  width: ['img', 'canvas', 'embed', 'iframe', 'input', 'object', 'source', 'svg', 'video', 'col'],
  height: ['img', 'canvas', 'embed', 'iframe', 'input', 'object', 'source', 'svg', 'video', 'col'],
  colspan: ['td', 'th'],
  rowspan: ['td', 'th'],
  for: ['label', 'output'],
  form: ['button', 'fieldset', 'input', 'label', 'object', 'output', 'select', 'textarea'],
  poster: ['video'],
  preload: ['audio', 'video'],
  controls: ['audio', 'video'],
  autoplay: ['audio', 'video'],
  loop: ['audio', 'video'],
  muted: ['audio', 'video'],
  datetime: ['time', 'ins', 'del'],
  cite: ['blockquote', 'del', 'ins', 'q'],
};

// kniu: 命名空间中「非通用属性绑定」的保留指令（不交给通用处理器）。
const SPECIAL_KNIU = new Set([
  'model',
  'for', 'if', 'elseif', 'else',
  'for-index', 'for-item', 'key',
]);

const BOOLEAN_ATTRS = new Set([
  'checked', 'disabled', 'hidden', 'selected', 'readonly', 'multiple',
  'required', 'autofocus', 'defer', 'ismap', 'novalidate', 'open',
  'reversed', 'itemscope', 'allowfullscreen', 'async', 'inert', 'default',
]);

function isBooleanAttr(name) {
  return BOOLEAN_ATTRS.has(name);
}

// 判断属性 attr 是否能写在标签 tag 上（不区分大小写）。
function isValidForTag(attr, tag) {
  if (GLOBAL_ATTRS.has(attr)) return true;
  if (attr.startsWith('data-') || attr.startsWith('aria-')) return true;
  const tags = ATTR_TAGS[attr];
  if (!tags) return false; // 未知属性 → 必须用 kniu:[name]
  return tags.includes(tag);
}

// ---- 元素-事件兼容性（kniu@<event> 仅允许绑定该元素原生支持的事件） ----
const EVENT_TAGS = {
  click: '*', dblclick: '*', mousedown: '*', mouseup: '*', mousemove: '*',
  mouseover: '*', mouseout: '*', mouseenter: '*', mouseleave: '*',
  contextmenu: '*', wheel: '*',
  keydown: '*', keyup: '*', keypress: '*',
  focusin: '*', focusout: '*',
  drag: '*', dragstart: '*', dragend: '*', dragenter: '*', dragover: '*', dragleave: '*', drop: '*',
  pointerdown: '*', pointerup: '*', pointermove: '*', pointerover: '*', pointerout: '*', pointerenter: '*', pointerleave: '*',
  touchstart: '*', touchend: '*', touchmove: '*', touchcancel: '*',
  animationstart: '*', animationend: '*', animationiteration: '*', transitionend: '*',
  select: '*',
  input: ['input', 'textarea', 'select', 'button'],
  change: ['input', 'textarea', 'select', 'button'],
  submit: ['form'],
  reset: ['form'],
  focus: ['input', 'select', 'textarea', 'button', 'a', 'area', 'iframe', 'object'],
  blur: ['input', 'select', 'textarea', 'button', 'a', 'area', 'iframe', 'object'],
  invalid: ['input', 'select', 'textarea', 'button', 'form', 'fieldset', 'object'],
  play: ['audio', 'video'], pause: ['audio', 'video'], ended: ['audio', 'video'],
  volumechange: ['audio', 'video'], timeupdate: ['audio', 'video'],
  loadeddata: ['audio', 'video', 'img'], canplay: ['audio', 'video', 'img'],
  load: ['img', 'iframe', 'link', 'script', 'body'], error: ['img', 'iframe', 'link', 'script', 'object'],
  progress: ['progress'],
};

function isValidEventForTag(event, tag) {
  const allowed = EVENT_TAGS[event];
  if (!allowed) return true; // 未收录事件（含自定义事件）默认可用
  if (allowed === '*') return true;
  return allowed.includes((tag || '').toLowerCase());
}

// ---- XSS 防护：URL 协议白名单 + HTML 净化 ----
// 涉及 URL 的属性：禁止 javascript:/vbscript:，以及除 data:image/ 之外的 data: 协议。
const URL_ATTRS = new Set(['href', 'src', 'xlink:href', 'poster', 'srcset']);

function isDangerousUrl(v) {
  const s = String(v == null ? '' : v).trim().toLowerCase();
  if (/^(javascript|vbscript):/i.test(s)) return true;
  if (/^data:/i.test(s) && !/^data:image\//i.test(s)) return true;
  return false;
}

// 净化一段 HTML：移除脚本执行向量（<script>/<iframe>/… 元素、所有 on* 事件属性、
// 危险 URL 协议 javascript:/vbscript:/非图片 data:），用于 {{@...}} 不转义输出。
const BLOCKED_TAGS = new Set(['script', 'iframe', 'object', 'embed', 'link', 'meta', 'style', 'base', 'form']);

function sanitizeNode(node) {
  [...node.children].forEach((el) => {
    const tag = el.tagName.toLowerCase();
    if (BLOCKED_TAGS.has(tag)) {
      el.remove();
      return;
    }
    [...el.attributes].forEach((a) => {
      const n = a.name.toLowerCase();
      if (n.startsWith('on')) {
        el.removeAttribute(a.name);
      } else if (URL_ATTRS.has(n) && isDangerousUrl(a.value)) {
        el.removeAttribute(a.name);
      } else if (n === 'srcdoc' || n === 'formaction') {
        el.removeAttribute(a.name);
      }
    });
    sanitizeNode(el);
  });
}

function sanitizeHtmlRegex(html) {
  let out = String(html)
    .replace(/<\s*(script|iframe|object|embed|link|meta|style|base|form)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*(script|iframe|object|embed|link|meta|style|base|form)\b[^>]*\/?>/gi, '');
  out = out.replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  out = out.replace(/(href|src|xlink:href|poster|srcset)\s*=\s*("javascript:[^"]*"|'javascript:[^']*'|javascript:[^\s>]+)/gi, '');
  return out;
}

function sanitizeHtml(html) {
  const D = typeof document !== 'undefined' ? document : null;
  if (D && D.createElement) {
    try {
      const tpl = D.createElement('template');
      tpl.innerHTML = html;
      sanitizeNode(tpl.content);
      return tpl.innerHTML;
    } catch {
      // 环境无 template 支持，回退到正则净化
    }
  }
  return sanitizeHtmlRegex(html);
}

// 把求值结果写回某个 DOM 属性（区分布尔属性、value 属性、普通属性）。
function setAttr(node, name, value, isBool) {
  if (isBool) {
    if (value) node.setAttribute(name, '');
    else node.removeAttribute(name);
    return;
  }
  if (name === 'value') {
    if ('value' in node) node.value = value == null ? '' : value;
    else node.setAttribute('value', value == null ? '' : String(value));
    return;
  }
  if (value == null || value === false) {
    node.removeAttribute(name);
    return;
  }
  if (URL_ATTRS.has(name) && isDangerousUrl(String(value))) {
    warn(`kniu:${name} 的 URL 含危险协议（${value}），已拒绝写入以防 XSS`);
    node.removeAttribute(name);
    return;
  }
  node.setAttribute(name, String(value));
}

function warn(msg) {
  if (typeof console !== 'undefined' && console.warn) console.warn('[kniutemplate] ' + msg);
}

function evalExpr(expr, base, extra) {
  const e = String(expr).trim();
  // 对象字面量需用 ({ ... }) 包裹；普通表达式直接用 ( ... )。
  // 两种形态都尝试一下，任一种编译失败就回退另一种（保证简写对象与三元/逗号表达式都能求值）。
  const forms = looksLikeObject(e)
    ? [`with(__s){ return ({${e}}); }`, `with(__s){ return (${e}); }`]
    : [`with(__s){ return (${e}); }`, `with(__s){ return ({${e}}); }`];
  let fn = null;
  for (const body of forms) {
    try {
      fn = new Function('__s', body);
      break;
    } catch {
      fn = null;
    }
  }
  if (!fn) return { value: '', paths: [] };
  const { proxy, accessed } = makeScope(base, extra);
  let value;
  try {
    value = fn(proxy);
  } catch {
    value = '';
  }
  return { value, paths: accessed };
}

export function reactive(target) {
  if (!isObject(target)) return target;
  if (target[IS_REACTIVE]) return target; // 已是响应式 proxy

  const subscribers = new Map(); // key -> Set<fn>
  Object.defineProperty(target, SUBS, {
    value: subscribers,
    enumerable: false,
    configurable: true,
  });

  const handler = {
    get(obj, key) {
      if (key === SUBS) return subscribers;
      if (key === IS_REACTIVE) return true;
      const val = obj[key];
      return isObject(val) ? reactive(val) : val;
    },
    set(obj, key, value) {
      const old = obj[key];
      obj[key] = value;
      if (old !== value) {
        const set = subscribers.get(key);
        if (set) set.forEach((fn) => fn(value));
      }
      return true;
    },
    deleteProperty(obj, key) {
      const had = Object.prototype.hasOwnProperty.call(obj, key);
      const ok = delete obj[key];
      if (had) {
        const set = subscribers.get(key);
        if (set) set.forEach((fn) => fn(undefined));
      }
      return ok;
    },
  };

  const proxy = new Proxy(target, handler);
  proxyCache.set(target, proxy);

  // 模板脚本上下文里调用：自动绑定到当前模板根节点
  if (currentScope && !binding) {
    binding = true;
    try {
      const { dispose } = bind(currentScope, proxy);
      currentCollector?.push(dispose);
    } finally {
      binding = false;
    }
  }
  return proxy;
}

// 当前模板作用域（由 eventer.mjs 在调用模板脚本前后设置/清除）
let currentScope = null;
let currentCollector = null;

export function beginBindingCollection(scope, collector) {
  currentScope = scope;
  currentCollector = collector;
}
export function endBindingCollection() {
  currentScope = null;
  currentCollector = null;
}

export function bind(scope, source) {
  let state;
  if (source && source[IS_REACTIVE]) {
    state = source;
  } else {
    binding = true;
    try {
      state = reactive(source);
    } finally {
      binding = false;
    }
  }

  const subscriptions = []; // 顶层订阅清理
  const listeners = []; // 双向绑定 DOM 监听
  const listDisposers = []; // kniu:for / kniu:if 局部清理

  // 订阅 render 到 path 上的每一级（含中间对象）；cleanups 可指定外部清理桶
  const subscribePath = (target, path, fn, cleanups = subscriptions) => {
    const parts = String(path).split('.');
    let obj = target;
    for (let i = 0; i < parts.length; i++) {
      if (obj == null) break;
      const subs = obj[SUBS];
      if (subs) {
        if (!subs.has(parts[i])) subs.set(parts[i], new Set());
        const set = subs.get(parts[i]);
        set.add(fn);
        cleanups.push(() => set.delete(fn));
      }
      if (i < parts.length - 1) obj = obj[parts[i]];
    }
  };

  const hasAncestor = (node, selector) => {
    let p = node.parentElement;
    while (p) {
      if (p.matches(selector)) return true;
      p = p.parentElement;
    }
    return false;
  };

  // 通用绑定应用：在 root 子树内做文本插值 + 元素级绑定。
  // base 为当前作用域根（响应式 state），extra 为局部变量（循环 index/item 等）。
  const applyBindings = (root, base, extra, bucket) => {
    const resolve = (key) => evalExpr(key, base, extra).value;
    const subscribe = (key, fn) => {
      evalExpr(key, base, extra).paths.forEach((p) => subscribePath(base, p, fn, bucket));
    };
    const write = (key, value) => setPath(base, key, value);

    // 1) 文本插值：{{...}} 转义输出（HTML 安全）；{{@...}} 不转义输出（原样 HTML）
    const TEXT_RE = /\{\{\s*([\s\S]*?)\s*\}\}/g;
    const rawNodes = new WeakMap(); // 含 {{@...}} 的锚点文本节点 -> 上一次插入的真实节点数组
    const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let _tn;
    while ((_tn = walk.nextNode())) {
      const textNode = _tn; // 每轮独立绑定，避免闭包共享循环变量（循环结束后为 null）导致更新时崩溃
      if (hasAncestor(textNode, '[kniu\\:for],[kniu\\:if],[kniu\\:elseif],[kniu\\:else]')) continue; // 交给指令单独处理
      const text = textNode.nodeValue;
      if (!text.includes('{{')) continue;
      const segments = [];
      let last = 0;
      let m;
      TEXT_RE.lastIndex = 0;
      while ((m = TEXT_RE.exec(text))) {
        if (m.index > last) segments.push({ t: 'text', v: text.slice(last, m.index) });
        const raw = m[1].trim();
        const unescape = raw.startsWith('@'); // {{@...}} 标记：原样输出 HTML，不做转义
        const expr = unescape ? raw.slice(1).trim() : raw;
        segments.push({ t: 'key', k: expr, raw: unescape });
        last = m.index + m[0].length;
      }
      if (last < text.length) segments.push({ t: 'text', v: text.slice(last) });

      const hasRaw = segments.some((s) => s.t === 'key' && s.raw);
      if (!hasRaw) {
        // 纯转义文本插值：直接写回 textNode（天然 HTML 转义，最安全）
        const render = () =>
          (textNode.nodeValue = segments
            .map((s) => (s.t === 'text' ? s.v : String(resolve(s.k) ?? '')))
            .join(''));
        render();
        segments.filter((s) => s.t === 'key').forEach((s) => subscribe(s.k, render));
      } else {
        // 含不转义段 {{@...}}：把 textNode 作为锚点，在其前方插入/更新一组节点
        // 普通文本与 {{}} 段 -> 文本节点（转义）；{{@}} 段 -> <span> 承载 innerHTML（不转义）
        const render = () => {
          const parent = textNode.parentNode;
          if (!parent) return;
          if (rawNodes.has(textNode)) {
            rawNodes.get(textNode).forEach((n) => n.remove());
            rawNodes.delete(textNode);
          }
          const built = [];
          segments.forEach((s) => {
            if (s.t === 'text') {
              built.push(document.createTextNode(s.v));
            } else if (!s.raw) {
              built.push(document.createTextNode(String(resolve(s.k) ?? '')));
            } else {
              const span = document.createElement('span');
              // 不转义但经 HTML 净化，防止 {{@...}} 注入 <script>/on*=/javascript: 等 XSS 向量
              span.innerHTML = sanitizeHtml(String(resolve(s.k) ?? ''));
              built.push(span);
            }
          });
          const frag = document.createDocumentFragment();
          built.forEach((n) => frag.appendChild(n));
          parent.insertBefore(frag, textNode);
          textNode.nodeValue = ''; // 锚点置空，避免原字面 {{}} 残留
          rawNodes.set(textNode, built);
        };
        render();
        segments.filter((s) => s.t === 'key').forEach((s) => subscribe(s.k, render));
      }
    }

    // 2) 元素级绑定
    if (root.nodeType === 1 || root.nodeType === 11) {
      const nodes = [root, ...root.querySelectorAll('*')];
      nodes.forEach((node) => {
        if (node.nodeType !== 1) return;
        if (node.hasAttribute('kniu:for') || node.hasAttribute('kniu:if') || node.hasAttribute('kniu:elseif') || node.hasAttribute('kniu:else')) return;
        if (hasAncestor(node, '[kniu\\:for],[kniu\\:if],[kniu\\:elseif],[kniu\\:else]')) return;

        // —— kniu:model（双向绑定，值需包裹 {{ }}）——
        if (node.hasAttribute('kniu:model')) {
          const path = stripBraces(node.getAttribute('kniu:model'));
          const isBool = node.type === 'checkbox' || node.type === 'radio';
          const render = () => {
            const v = resolve(path);
            if (isBool) node.checked = Boolean(v);
            else node.value = v ?? '';
          };
          render();
          subscribe(path, render);
          const onInput = () => write(path, isBool ? node.checked : node.value);
          const evt = isBool ? 'change' : 'input';
          node.addEventListener(evt, onInput);
          listeners.push([node, evt, onInput]);
          node.removeAttribute('kniu:model');
        }

        // —— kniu:[name] 单个 data-* 自定义属性绑定 ——
        // 中括号内填写 data 属性名（不含 data- 前缀）：
        // kniu:[msg] -> data-msg，kniu:[tab-index] -> data-tab-index。
        const DATA_ATTR_RE = /^kniu:\[([a-z][a-z0-9-]*)\]$/i;
        [...node.attributes].forEach((attr) => {
          const match = attr.name.match(DATA_ATTR_RE);
          if (!match) return;
          const dataAttrName = `data-${match[1].toLowerCase()}`;
          const expr = stripBraces(attr.value);
          const render = () => {
            const { value } = evalExpr(expr, base, extra);
            if (value == null || value === false) node.removeAttribute(dataAttrName);
            else node.setAttribute(dataAttrName, String(value));
          };
          render();
          subscribe(expr, render);
          node.removeAttribute(attr.name);
        });

        // —— 通用 kniu:<attr> 单向属性绑定（值需包裹 {{ }}）——
        // 仅允许写在该元素原生支持的属性上（如 <a> 只能 kniu:href，<img> 只能 kniu:src）；
        // 非法组合会被跳过并给出警告；未知属性请用 kniu:[name] 设置为 data-* 属性。
        [...node.attributes].forEach((attr) => {
          const full = attr.name;
          if (!full.startsWith('kniu:')) return;
          const key = full.slice(5);
          if (SPECIAL_KNIU.has(key)) return; // model/for*/if*/key 由指令处理器单独处理
          const attrName = key;
          const tag = node.tagName.toLowerCase();
          if (!isValidForTag(attrName, tag)) {
            warn(`kniu:${attrName} 不能用在 <${tag}> 上（该元素不支持属性 "${attrName}"）；自定义 data-* 属性请改用 kniu:[name]。`);
            node.removeAttribute(full);
            return;
          }
          const expr = stripBraces(attr.value);
          const isBool = isBooleanAttr(attrName);
          const render = () => {
            const v = resolve(expr);
            setAttr(node, attrName, v, isBool);
          };
          render();
          subscribe(expr, render);
          node.removeAttribute(full);
        });

        // —— kniu@<event> 原生事件绑定（直接填写处理函数名/表达式，结果须为函数）——
        // 规则：事件必须是当前元素原生支持的；不支持则跳过并告警（例如 <a> 上 kniu@submit 无效）。
        // 安全：仅接受函数型 handler，绝不 eval 字符串，避免代码注入。
        const EVENT_RE = /^kniu@([a-z][a-z0-9]*)$/i;
        const eventState = new WeakMap(); // node -> Map(eventName -> handler)
        [...node.attributes].forEach((attr) => {
          const evMatch = attr.name.match(EVENT_RE);
          if (!evMatch) return;
          const eventName = evMatch[1].toLowerCase();
          const tag = node.tagName.toLowerCase();
          if (!isValidEventForTag(eventName, tag)) {
            warn(`kniu@${eventName} 不被 <${tag}> 支持，已跳过（事件只能绑定到元素原生支持的事件上）`);
            node.removeAttribute(attr.name);
            return;
          }
          const expr = attr.value.trim();
          const handlers = eventState.get(node) || new Map();
          eventState.set(node, handlers);
          const render = () => {
            const { value } = evalExpr(expr, base, extra);
            if (typeof value !== 'function') {
              // 非函数不予执行，避免把字符串当代码执行（XSS/代码注入）
              if (handlers.has(eventName)) {
                node.removeEventListener(eventName, handlers.get(eventName));
                handlers.delete(eventName);
              }
              return;
            }
            if (handlers.has(eventName)) node.removeEventListener(eventName, handlers.get(eventName));
            const handler = (e) => value.call(base, e);
            node.addEventListener(eventName, handler);
            handlers.set(eventName, handler);
          };
          render();
          subscribe(expr, render);
          node.removeAttribute(attr.name); // 移除标记属性，避免泄漏到最终 DOM
        });
      });
    }

    // 3) 属性内插值 {{...}}（支持任意属性，含布尔属性 checked/hidden/disabled 等）
    if (root.nodeType === 1 || root.nodeType === 11) {
      const ATTR_RE = /\{\{\s*([\s\S]*?)\s*\}\}/g;
      const nodes = [root, ...root.querySelectorAll('*')];
      nodes.forEach((node) => {
        if (node.nodeType !== 1) return;
        if (node.hasAttribute('kniu:for') || node.hasAttribute('kniu:if') || node.hasAttribute('kniu:elseif') || node.hasAttribute('kniu:else')) return;
        if (hasAncestor(node, '[kniu\\:for],[kniu\\:if],[kniu\\:elseif],[kniu\\:else]')) return;
        [...node.attributes].forEach((attr) => {
          const name = attr.name;
          if (name.startsWith('kniu:') || name.startsWith('kniu@')) return; // 所有 kniu: / kniu@ 指令统一交给元素级绑定处理
          const template = attr.value;
          if (!template.includes('{{')) return;
          // 拆分为 文本段 / 表达式段
          const segments = [];
          let last = 0;
          let m;
          ATTR_RE.lastIndex = 0;
          while ((m = ATTR_RE.exec(template))) {
            if (m.index > last) segments.push({ t: 'text', v: template.slice(last, m.index) });
            segments.push({ t: 'key', k: m[1] });
            last = m.index + m[0].length;
          }
          if (last < template.length) segments.push({ t: 'text', v: template.slice(last) });
          const isBool = isBooleanAttr(name);
          const pureExpr = segments.length === 1 && segments[0].t === 'key';
          const render = () => {
            const parts = segments.map((s) => (s.t === 'text' ? s.v : resolve(s.k)));
            if (isBool && pureExpr) {
              if (parts[0]) node.setAttribute(name, '');
              else node.removeAttribute(name);
              return;
            }
            if (pureExpr && (parts[0] == null || parts[0] === false)) {
              node.removeAttribute(name);
              return;
            }
            const resolved = parts.map((v) => (v == null ? '' : String(v))).join('');
            if (resolved === '' && !segments.some((s) => s.t === 'text')) {
              node.removeAttribute(name);
            } else if (URL_ATTRS.has(name) && isDangerousUrl(resolved)) {
              warn(`属性 "${name}" 的插值 URL 含危险协议，已拒绝写入以防 XSS`);
              node.removeAttribute(name);
            } else {
              node.setAttribute(name, resolved);
            }
          };
          render();
          segments.filter((s) => s.t === 'key').forEach((s) => subscribe(s.k, render));
        });
      });
    }

    // 4) 指令处理（kniu:for / kniu:if）由下方单独逻辑负责，此处不再额外处理。
  };

  // 列表渲染 [kniu:for]（支持自定义 index/item 名、嵌套、<template> 容器、kniu:key）
  // bucket：订阅清理桶（嵌套指令/keyed 视图复用会把清理挂到对应的桶，避免泄漏）
  const setupFor = (block, parentExtra, bucket = null) => {
    const forAttr = block.getAttribute('kniu:for');
    const forMatch = forAttr.match(/\{\{([\s\S]*?)\}\}/);
    const arrayExpr = (forMatch ? forMatch[1] : forAttr).trim();
    const idxName = block.getAttribute('kniu:for-index') || 'index';
    const itemName = block.getAttribute('kniu:for-item') || 'item';
    const keyExpr = block.getAttribute('kniu:key');
    const useKeyed = !!keyExpr;
    const isTpl = block.tagName === 'TEMPLATE';
    const tpl = isTpl ? block.content : block.cloneNode(true);
    if (!isTpl) {
      tpl.removeAttribute('kniu:for');
      tpl.removeAttribute('kniu:for-index');
      tpl.removeAttribute('kniu:for-item');
      tpl.removeAttribute('kniu:key');
    }
    const anchor = document.createComment('kniu:for');
    block.replaceWith(anchor);
    let rendered = []; // unkeyed 模式：已渲染节点
    let prevViews = []; // keyed 模式：上一轮视图（按 key 复用）
    let subCleanups = []; // 数组级订阅桶（length / 数组路径）
    const bc = bucket || subCleanups;

    // 计算每个 item 的 key
    //  - kniu:key="*this" → 用 item 本身（原始值/对象引用）作 key
    //  - 其它（如 "unique"）→ 取 item[unique] 作 key；取不到时回退到 item 本身
    const keyFor = (item) =>
      keyExpr === '*this' ? item : (() => {
        const k = getPath(item, keyExpr);
        return k === undefined ? item : k;
      })();

    // 单个 item 的视图：持有 DOM 节点 + 基于 viewCleanups 的局部订阅
    const createView = () => {
      const viewCleanups = [];
      let initialized = false;
      let roots = null;
      // 用 keyed 时复用节点用 viewCleanups；unkeyed 时节点每次重建，订阅走 bc 便于整体清理
      const nb = useKeyed ? viewCleanups : bc;
      const update = (extra) => {
        viewCleanups.forEach((c) => c());
        viewCleanups.length = 0;
        if (!initialized) {
          const frag = tpl.cloneNode(true);
          roots = isTpl ? [...frag.childNodes] : [frag];
          roots.forEach((node) => {
            if (node.nodeType === 1) {
              node.querySelectorAll('[kniu\\:for]').forEach((n) => setupFor(n, extra, nb));
              node.querySelectorAll('[kniu\\:if]').forEach((n) => setupIf(n, extra, nb));
            }
            applyBindings(node, state, extra, nb);
          });
          initialized = true;
        } else {
          // 复用节点：仅刷新文本/元素绑定（嵌套指令首渲染快照保留）
          roots.forEach((node) => applyBindings(node, state, extra, nb));
        }
      };
      return { update, getNodes: () => roots, viewCleanups };
    };

    const render = () => {
      subCleanups.length = 0;

      const { value: arr, paths } = evalExpr(arrayExpr, state, parentExtra);
      paths.forEach((p) => subscribePath(state, p, render, bc));
      const list = Array.isArray(arr) ? arr : [];
      if (arr && arr[SUBS]) {
        if (!arr[SUBS].has('length')) arr[SUBS].set('length', new Set());
        const s = arr[SUBS].get('length');
        s.add(render);
        bc.push(() => s.delete(render));
      }

      if (!useKeyed) {
        // 原有行为：每次整体重建
        rendered.forEach((n) => n.remove());
        rendered = [];
        list.forEach((item, index) => {
          const extra = { ...parentExtra, [idxName]: index, [itemName]: item };
          const view = createView();
          view.update(extra);
          // item 自身属性变化也触发整体重渲染（清理挂在 bc，每次 render 重建）
          if (item && item[SUBS]) {
            for (const [, set] of item[SUBS]) {
              set.add(render);
              bc.push(() => set.delete(render));
            }
          }
          view.getNodes().forEach((node) => {
            anchor.parentNode.insertBefore(node, anchor);
            rendered.push(node);
          });
        });
        return;
      }

      // keyed 行为：按 key 复用 DOM 节点（重排/增删时保持稳定身份，保留输入状态与焦点）
      const keys = list.map((it) => keyFor(it));
      const prevMap = new Map(prevViews.map((v) => [v.key, v]));
      const usedKeys = new Set();
      const nextViews = [];
      list.forEach((item, index) => {
        const key = keys[index];
        const extra = { ...parentExtra, [idxName]: index, [itemName]: item };
        let view = prevMap.get(key);
        if (!view) {
          view = createView();
          view.key = key;
        }
        view.update(extra);
        // item 自身属性变化触发整体重渲染（清理随视图生命周期，复用/移除时一并清理）
        if (item && item[SUBS]) {
          for (const [, set] of item[SUBS]) {
            set.add(render);
            view.viewCleanups.push(() => set.delete(render));
          }
        }
        usedKeys.add(key);
        nextViews.push(view);
      });
      // 移除已不存在的 key 对应视图
      prevViews.forEach((v) => {
        if (!usedKeys.has(v.key)) {
          v.viewCleanups.forEach((c) => c());
          v.getNodes().forEach((n) => n.remove());
        }
      });
      // 按新顺序移动 DOM 节点（复用同一批节点，不重建）
      const frag = document.createDocumentFragment();
      nextViews.forEach((v) => v.getNodes().forEach((n) => frag.appendChild(n)));
      anchor.parentNode.insertBefore(frag, anchor);
      prevViews = nextViews;
      rendered = [];
    };

    render();
    listDisposers.push(() => {
      subCleanups.forEach((c) => c());
      rendered.forEach((n) => n.remove());
      prevViews.forEach((v) => {
        v.viewCleanups.forEach((c) => c());
        v.getNodes().forEach((n) => n.remove());
      });
    });
  };

  // 条件渲染 [kniu:if] / [kniu:elseif] / [kniu:else]（支持 if / else if / else 链）
  const setupIf = (block, parentExtra, bucket = null) => {
    // 收集从 kniu:if 开始的整个 if / elseif / else 链（跳过相邻空白文本节点）。
    // 仅当 block 自身带 kniu:if 时作为链头；elseif / else 由链头统一处理。
    const chain = [{ node: block, type: 'if' }];
    let sib = block.nextSibling;
    while (sib) {
      if (sib.nodeType === 3 && sib.nodeValue.trim() === '') {
        sib = sib.nextSibling;
        continue;
      }
      if (sib.nodeType === 1) {
        if (sib.hasAttribute('kniu:elseif')) {
          chain.push({ node: sib, type: 'elseif' });
          sib = sib.nextSibling;
          continue;
        }
        if (sib.hasAttribute('kniu:else')) {
          chain.push({ node: sib, type: 'else' });
          break;
        }
      }
      break;
    }

    // 读取每个分支的模板（在替换 DOM 前完成），并提取各自的表达式
    const branches = chain.map(({ node, type }) => {
      const tpl = node.cloneNode(true);
      if (type === 'if' || type === 'elseif') {
        const attrName = type === 'if' ? 'kniu:if' : 'kniu:elseif';
        const raw = node.getAttribute(attrName);
        const m = raw.match(/\{\{([\s\S]*?)\}\}/);
        const expr = (m ? m[1] : raw).trim();
        tpl.removeAttribute('kniu:if');
        tpl.removeAttribute('kniu:elseif');
        return { type, expr, tpl, value: false };
      }
      tpl.removeAttribute('kniu:else');
      return { type: 'else', expr: null, tpl, value: false };
    });

    const anchor = document.createComment('kniu:if');
    block.replaceWith(anchor);
    // 移除链中其余分支的原始节点（渲染时按需克隆对应模板）
    chain.slice(1).forEach(({ node }) => node.remove());

    let rendered = [];
    const cleanups = [];
    const bc = bucket || cleanups;

    const render = () => {
      cleanups.length = 0;
      rendered.forEach((n) => n.remove());
      rendered = [];
      // 订阅所有分支条件（任一条件变化都可能改变所选分支），并选出第一个为真的分支
      let chosen = null;
      for (const b of branches) {
        if (b.type === 'else') {
          b.value = true;
          if (!chosen) chosen = b;
          continue;
        }
        const { value, paths } = evalExpr(b.expr, state, parentExtra);
        paths.forEach((p) => subscribePath(state, p, render, bc));
        b.value = value;
        if (b.value && !chosen) chosen = b;
      }
      if (chosen) {
        // <template> stores its renderable children in `.content`; cloning the
        // element itself leaves `childNodes` empty.  Ordinary conditional
        // containers keep the existing container-style rendering semantics.
        const frag = chosen.tpl.tagName === 'TEMPLATE'
          ? chosen.tpl.content.cloneNode(true)
          : chosen.tpl.cloneNode(true);
        [...frag.childNodes].forEach((node) => {
          if (node.nodeType === 1) {
            node.querySelectorAll('[kniu\\:for]').forEach((n) => setupFor(n, parentExtra, bc));
            node.querySelectorAll('[kniu\\:if]').forEach((n) => setupIf(n, parentExtra, bc));
          }
          applyBindings(node, state, parentExtra, bc);
          anchor.parentNode.insertBefore(node, anchor);
          rendered.push(node);
        });
      }
    };

    render();
    listDisposers.push(() => {
      cleanups.forEach((c) => c());
      rendered.forEach((n) => n.remove());
    });
  };

  // 主作用域绑定（先绑定普通文本/元素，指令内部由下方单独处理）
  applyBindings(scope, state, {}, subscriptions);

  // 处理 kniu:for（仅顶层，嵌套由 render 递归处理）
  [...scope.querySelectorAll('[kniu\\:for]')]
    .filter((b) => !hasAncestor(b, '[kniu\\:for]'))
    .forEach((b) => setupFor(b, {}));

  // 处理 kniu:if（仅非 for 内部的；for 内部的在 render 中处理）
  let guard = 0;
  let ifBlock;
  while (
    (ifBlock = scope.querySelector('[kniu\\:if]')) &&
    !hasAncestor(ifBlock, '[kniu\\:for]') &&
    guard++ < 1000
  ) {
    setupIf(ifBlock, {});
  }

  // 清理未被合法父指令消费的孤立保留属性，确保最终 DOM 不泄漏 kniu 标记。
  const orphanDirectives = [
    'kniu:elseif', 'kniu:else', 'kniu:key', 'kniu:for-index', 'kniu:for-item',
  ];
  orphanDirectives.forEach((name) => {
    scope.querySelectorAll(`[${name.replace(':', '\\:')}]`).forEach((node) => {
      warn(`孤立指令 ${name} 缺少对应的父级/链头指令，已移除标记属性`);
      node.removeAttribute(name);
    });
  });

  const dispose = () => {
    subscriptions.forEach((off) => off());
    listeners.forEach(([node, evt, fn]) => node.removeEventListener(evt, fn));
    listDisposers.forEach((d) => d());
  };
  return { state, dispose };
}
