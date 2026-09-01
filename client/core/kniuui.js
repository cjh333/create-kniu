import KniuTemplate from './kniutemplate.mjs';
import REQUEST from './kniurequest.mjs';
import { getResponseRecords } from './kniuutil.mjs';
import { sanitizeRichHtml } from './kniusanitizer.mjs';

const { reactive, compileExpression } = KniuTemplate;

var KniuUI = (function () {
  var state = reactive({
    loading: false
  });
  var toastTimer = null;
  var toastInstance = null;
  var scrollLockStyles = null;
  var shadowTemplateCache = new Map();
  var shadowStyleSheetCache = new Map();
  var KNIU_BASE_CONTAIN_CSS = ':host{contain:layout}';
  var KNIU_CONTAIN_EXCLUDE_TAGS = { 'KNIU-TABLE': 1, 'KNIU-NAVBAR': 1, 'KNIU-MODAL': 1, 'KNIU-DATE-PICKER': 1 };
  function shouldContainHost(tag) { return !KNIU_CONTAIN_EXCLUDE_TAGS[String(tag || '').toUpperCase()]; }

  function supportsAdoptedStyleSheets(root) {
    if (globalThis.__KNIU_NO_SHARED_SHEETS) return false;
    return typeof CSSStyleSheet === 'function'
      && Array.isArray(root.adoptedStyleSheets)
      && typeof root.adoptedStyleSheets !== 'string';
  }

  function getSharedStyleSheet(cssText) {
    let sheet = shadowStyleSheetCache.get(cssText);
    if (!sheet) {
      sheet = new CSSStyleSheet();
      sheet.replaceSync(cssText);
      shadowStyleSheetCache.set(cssText, sheet);
    }
    return sheet;
  }

  function adoptSharedStyle(root, cssText) {
    const css = String(cssText == null ? '' : cssText);
    if (!css) return null;
    if (supportsAdoptedStyleSheets(root)) {
      const sheet = getSharedStyleSheet(css);
      if (!root.adoptedStyleSheets.includes(sheet)) {
        root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
      }
      return null;
    }
    const element = (root.ownerDocument || root.host?.ownerDocument || document).createElement('style');
    element.textContent = css;
    root.appendChild(element);
    return element;
  }

  // 所有组件统一通过 Shadow DOM 隔离。模板字符串只在首次出现时解析，
  // 后续实例直接克隆缓存的 DocumentFragment，一次性挂载到 ShadowRoot。
  // 其中 <style> 块被抽离为共享样式表（adoptedStyleSheets），不逐实例重复解析。
  function attachComponentShadow(host) {
    const root = host.attachShadow({ mode: 'open' });
    if (typeof ShadowRoot === 'undefined') return root;
    // 渲染隔离：给 :host 加 contain:layout（排除含视口固定后代的组件，见 KNIU_CONTAIN_EXCLUDE_TAGS）。
    if (shouldContainHost(host.tagName)) adoptSharedStyle(root, KNIU_BASE_CONTAIN_CSS);
    let prototype = ShadowRoot.prototype;
    let descriptor = null;
    while (prototype && !descriptor) {
      descriptor = Object.getOwnPropertyDescriptor(prototype, 'innerHTML');
      prototype = Object.getPrototypeOf(prototype);
    }
    if (!descriptor || typeof descriptor.get !== 'function') return root;
    Object.defineProperty(root, 'innerHTML', {
      configurable: true,
      get: function () { return descriptor.get.call(root); },
      set: function (markup) {
        const html = String(markup == null ? '' : markup);
        // 抽离 <style> 内容，剩下的结构部分走模板缓存
        let styleText = '';
        const structure = html.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, function (_, css) {
          styleText += css + '\n';
          return '';
        });
        let template = shadowTemplateCache.get(structure);
        if (!template) {
          template = (host.ownerDocument || document).createElement('template');
          template.innerHTML = structure;
          shadowTemplateCache.set(structure, template);
        }
        root.replaceChildren(template.content.cloneNode(true));
        if (styleText) {
          if (supportsAdoptedStyleSheets(root)) {
            // replaceChildren + 重设 adoptedStyleSheets 会清空基础渲染隔离样式，这里补回流。
            root.adoptedStyleSheets = shouldContainHost(host.tagName) ? [getSharedStyleSheet(KNIU_BASE_CONTAIN_CSS)] : [];
            adoptSharedStyle(root, styleText);
          } else {
            // 退回逐实例 <style>：replaceChildren 已清空原先的基础 <style>，这里补回再追加组件样式。
            if (shouldContainHost(host.tagName)) {
              const base = (root.ownerDocument || root.host && root.host.ownerDocument || document).createElement('style');
              base.textContent = KNIU_BASE_CONTAIN_CSS;
              root.appendChild(base);
            }
            adoptSharedStyle(root, styleText);
          }
        }
      }
    });
    return root;
  }

  function replaceChildrenWithFragment(target, nodes) {
    const documentRef = target.ownerDocument || document;
    const fragment = documentRef.createDocumentFragment();
    Array.from(nodes || []).forEach(function (node) {
      if (node) fragment.appendChild(node);
    });
    target.replaceChildren(fragment);
  }

  function resolveTableRowTemplate(template, row, rowIndex) {
    if (typeof template === 'function') return template(row, rowIndex);
    if (typeof template !== 'string' || !template.includes('{{')) return template;
    const matches = [...template.matchAll(/\{\{\s*([\s\S]*?)\s*\}\}/g)];
    if (!matches.length) return template;
    const evaluate = function (expression) {
      const evaluator = compileExpression(expression);
      if (!evaluator) return '';
      try { return evaluator({ scope: { row: row, $index: rowIndex } }); } catch { return ''; }
    };
    if (matches.length === 1 && matches[0][0] === template.trim()) return evaluate(matches[0][1]);
    return template.replace(/\{\{\s*([\s\S]*?)\s*\}\}/g, function (_, expression) {
      const value = evaluate(expression);
      return value == null ? '' : String(value);
    });
  }

  function setScrollLock(locked) {
    if (typeof document === 'undefined' || !document.documentElement || !document.body) return;
    const root = document.documentElement;
    const body = document.body;
    if (locked) {
      if (scrollLockStyles) return;
      scrollLockStyles = {
        rootOverflow: root.style.overflow,
        rootOverflowX: root.style.overflowX,
        rootOverflowY: root.style.overflowY,
        bodyOverflow: body.style.overflow,
        bodyOverflowX: body.style.overflowX,
        bodyOverflowY: body.style.overflowY
      };
      root.style.setProperty('overflow', 'hidden');
      root.style.setProperty('overflow-x', 'hidden');
      root.style.setProperty('overflow-y', 'hidden');
      body.style.setProperty('overflow', 'hidden');
      body.style.setProperty('overflow-x', 'hidden');
      body.style.setProperty('overflow-y', 'hidden');
      return;
    }
    if (!scrollLockStyles) return;
    root.style.overflow = scrollLockStyles.rootOverflow;
    root.style.overflowX = scrollLockStyles.rootOverflowX;
    root.style.overflowY = scrollLockStyles.rootOverflowY;
    body.style.overflow = scrollLockStyles.bodyOverflow;
    body.style.overflowX = scrollLockStyles.bodyOverflowX;
    body.style.overflowY = scrollLockStyles.bodyOverflowY;
    scrollLockStyles = null;
  }

  // 切换路由加载态。
  function setLoading(value) {
    const next = !!value;
    if (state.loading === next) return;
    state.loading = next;
    setScrollLock(next);
  }

  // 提示框。
  function msg(options) {
    const config = options && typeof options === 'object'
      ? options
      : { content: options };
    const content = config.content;
    const type = ['success', 'warning', 'info', 'error'].includes(config.type)
      ? config.type
      : 'info';
    if (typeof document === 'undefined' || !document.body) return { close: function () { } };
    if (toastTimer) clearTimeout(toastTimer);
    if (toastInstance) toastInstance.remove();
    const toast = document.createElement('kniu-msg');
    toast.message = content == null ? '' : String(content);
    toast.type = type;
    toast.visible = false;
    document.body.append(toast);
    toastInstance = toast;
    requestAnimationFrame(function () { toast.visible = true; });
    const close = function () {
      if (toastInstance !== toast) return;
      toast.visible = false;
      toastInstance = null;
      setTimeout(function () { toast.remove(); }, 250);
    };
    const configuredDuration = Number(config.duration);
    const duration = config.duration == null || !Number.isFinite(configuredDuration)
      ? 2600
      : Math.max(0, configuredDuration);
    if (duration > 0) {
      toastTimer = setTimeout(close, duration);
    }
    return { close: close };
  }

  function createTable(options = {}) {
    const target = options.el;
    if (!target || typeof target.replaceChildren !== 'function') {
      throw new TypeError('[KniuUI] createTable() requires a el element');
    }
    // 列定义过滤：condition 为空或对空行求值为真才保留（条件列）。
    // 不能 filter 拷贝后固定引用：options.cols 与外部数组是同一引用，调用方可能
    // 原地 mutate（push/splice）而不重建表格，故 render 每次重新过滤并原地替换，
    // 让行池签名与实际列结构一致（2026-09-01：曾因 filter 拷贝隔离 mutate 而失效）。
    function readColumns() {
      return Array.isArray(options.cols)
        ? options.cols.filter(function (column) {
          return column.condition == null || !!resolveTableRowTemplate(column.condition, {}, 0);
        })
        : [];
    }
    const columns = readColumns();
    if (!columns.length) {
      throw new TypeError('[KniuUI] createTable() requires at least one column');
    }
    const documentRef = target.ownerDocument || document;
    const maxHeight = Number.parseInt(options.maxHeight, 10) || 0;
    const height = Number.parseInt(options.height, 10) || 0;
    let rows = Array.isArray(options.data) ? options.data : [];
    // 数据源原始顺序（未排序基准）：升/降/清空三态排序都从它出发，
    // 第三次点击清空排序时恢复此顺序，避免在已排序结果上叠加。
    let initialRows = rows;
    let sortState = { field: '', order: '' };
    let currentRow = null;
    const selectedRows = new Set();
    let disposed = false;
    let fixedLeftWidth = 0;
    let fixedRightWidth = 0;
    let pendingEdit = null;
    let rendering = false;
    let headElement = null;
    let bodyElement = null;
    // 行节点复用池：render 结束后保存当前 tbody 中的 tr 顺序。
    // 列配置在 createTable 实例生命周期内固定，故行数不变时可整行复用，只更新单元格内容。
    let rowPool = [];
    // 复用池对应的列结构签名。options.cols 是外部数组的同一引用，若调用方原地
    // mutate 列（push/splice）而不重建表格，复用行的单元格数会与 columns 失配
    // （列变少残留旧格、列变多 cells[index] 为 undefined）。故每次 render 校验签名，
    // 不一致即整体丢弃重建。开销 O(列数)，可忽略。
    let rowPoolColumnSignature = '';
    // 实测列宽缓存（固定列阴影用）。避免每次 render 都 getBoundingClientRect 强制回流。
    let measuredColumnWidths = null;
    // 固定列阴影显隐的 rAF 句柄（把布局读取移出 render 同步路径）
    let shadowVisibilityFrame = 0;
    // 视口尺寸观察器：容器尺寸变化时刷新列宽缓存与阴影布局指标
    let viewportResizeObserver = null;

    // 表格 CSS 是静态的：目标为 ShadowRoot 时走共享样式表，多个表格实例共用一份解析结果。
    const tableStyleSheetText = `
      :host{display:block;min-width:0}
      .kniu_sys_table_group{position:relative;overflow:hidden;background-color:#fff;color:#606266;font-size:14px}
      .kniu_sys_table_viewport{max-width:100%;overflow-x:auto;overflow-y:auto}
      @supports(overflow-y:overlay){.kniu_sys_table_viewport{overflow-y:overlay}}
      .kniu_sys_table{border-collapse:separate;border-spacing:0;width:100%;table-layout:fixed;background-color:#fff}
      .kniu_sys_table th,.kniu_sys_table td{border-bottom:1px solid #ebeef5;padding:0 10px;height:48px;box-sizing:border-box;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;background-color:#fff}
      .kniu_sys_table th{position:sticky;top:0;z-index:3;color:#909399;font-weight:600;background-color:#f5f7fa}
      .kniu_sys_table_group[data-empty="true"] thead{pointer-events:none;user-select:none}
      .kniu_sys_table_group[data-empty="true"] thead th{cursor:not-allowed!important}
      .kniu_sys_table_group[data-empty="true"] .kniu_sys_table_sort,.kniu_sys_table_group[data-empty="true"] .kniu_sys_table_selection{cursor:not-allowed}
      .kniu_sys_table tbody tr:hover td{background-color:#f5f7fa}
      .kniu_sys_table_group[data-stripe="true"] tbody tr:nth-child(even) td{background-color:#fafafa}
      .kniu_sys_table_group[data-stripe="true"] tbody tr:hover td{background-color:#f5f7fa}
      .kniu_sys_table_group[data-highlight-current-row="true"] tbody tr[data-current="true"] td{background-color:#ecf5ff}
      .kniu_sys_table_group[data-border="true"]{border:1px solid #ebeef5;border-right:0;border-bottom:0}
      .kniu_sys_table_group[data-border="true"] th,.kniu_sys_table_group[data-border="true"] td{border-right:1px solid #ebeef5}
      .kniu_sys_table_group[data-size="large"] th,.kniu_sys_table_group[data-size="large"] td{height:52px;padding:0 12px}
      .kniu_sys_table_group[data-size="small"] th,.kniu_sys_table_group[data-size="small"] td{height:40px;padding:0 8px;font-size:12px}
      .kniu_sys_table .kniu_sys_table_fixed_left,.kniu_sys_table .kniu_sys_table_fixed_right{position:sticky;z-index:2;background-color:#fff}
      .kniu_sys_table th.kniu_sys_table_fixed_left,.kniu_sys_table th.kniu_sys_table_fixed_right{z-index:5;background-color:#f5f7fa}
      .kniu_sys_table_fixed_shadow{position:absolute;top:0;bottom:0;z-index:10;display:none;pointer-events:none;box-shadow:0 0 10px rgba(0,0,0,.12)}
      .kniu_sys_table_fixed_shadow_left{left:0}
      .kniu_sys_table_fixed_shadow_right{right:0}
      .kniu_sys_table_group{--kniu-table-edge-fade:rgba(0,0,0,.1)}
      .kniu_sys_table_group[data-mobile-overflow-left="true"]::before,.kniu_sys_table_group[data-mobile-overflow-right="true"]::after{content:"";position:absolute;z-index:11;top:0;bottom:0;width:26px;pointer-events:none}
      .kniu_sys_table_group[data-mobile-overflow-left="true"]::before{left:0;background-image:linear-gradient(to right,var(--kniu-table-edge-fade),transparent)}
      .kniu_sys_table_group[data-mobile-overflow-right="true"]::after{right:0;background-image:linear-gradient(to left,var(--kniu-table-edge-fade),transparent)}
      .kniu_sys_table_action{border:0;padding:4px 0;background-color:transparent;color:#409eff;font:inherit;cursor:pointer}
      .kniu_sys_table_action:hover{color:#66b1ff}
      .kniu_sys_table_editable{cursor:text}
      .kniu_sys_table_editable:hover{background-color:#ecf5ff!important}
      .kniu_sys_table_edit_input{width:100%;height:32px;padding:0 8px;border:1px solid #409eff;border-radius:3px;outline:0;box-sizing:border-box;color:#606266;font:inherit}
      .kniu_sys_table_empty td{height:80px;text-align:center;color:#909399}
      .kniu_sys_table_empty:hover td{background-color:#fff!important;cursor:default}
      .kniu_sys_table_empty td slot[name="empty"]{display:inline-flex;flex-direction:column;align-items:center;justify-content:center;gap:8px}
      .kniu_sys_table_sort{display:inline-flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;width:16px;height:22px;margin-left:5px;vertical-align:middle;color:#c0c4cc;cursor:pointer}.kniu_sys_table_sort_up,.kniu_sys_table_sort_down{display:block;width:14px;height:10px;line-height:0}.kniu_sys_table_sort svg{display:block;width:14px;height:14px;fill:currentColor}.kniu_sys_table_sort_up svg{transform:translateY(1px)}.kniu_sys_table_sort_down svg{transform:translateY(-5px)}.kniu_sys_table_sort[data-order="ascending"] .kniu_sys_table_sort_up,.kniu_sys_table_sort[data-order="descending"] .kniu_sys_table_sort_down{color:#333}
      .kniu_sys_table_selection{appearance:none;width:14px;height:14px;margin:0;border:1px solid #dcdfe6;border-radius:2px;outline:0;background-color:#fff;background-position:center;background-repeat:no-repeat;background-size:10px 8px;box-sizing:border-box;cursor:pointer;transition:border-color .2s,background-color .2s}.kniu_sys_table_selection:checked{border-color:#409eff;background-color:#409eff;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 10'%3E%3Cpath d='M1 5l3 3 7-7' fill='none' stroke='%23fff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")}.kniu_sys_table_selection:indeterminate{border-color:#409eff;background-color:#409eff;background-image:linear-gradient(#fff,#fff);background-size:8px 2px}.kniu_sys_table_selection:focus-visible{outline:2px solid rgba(64,158,255,.3);outline-offset:2px}.kniu_sys_table_selection:disabled{border-color:#dcdfe6;background-color:#f5f7fa;cursor:not-allowed;opacity:.65}.kniu_sys_table_selection:disabled:checked,.kniu_sys_table_selection:disabled:indeterminate{border-color:#a0cfff;background-color:#a0cfff}
      .kniu_sys_table_cell_tooltip{position:relative}
      .kniu_sys_table_tooltip{position:fixed;z-index:9999;max-width:50vw;padding:8px 12px;border-radius:4px;background-color:rgba(48,49,51,.92);color:#fff;font-size:12px;line-height:1.5;white-space:normal;word-break:break-all;box-shadow:0 2px 12px rgba(0,0,0,.18);pointer-events:none}
      .kniu_sys_table_tooltip::after{content:"";position:absolute;width:0;height:0;border:6px solid transparent;pointer-events:none;left:var(--kniu_tip_arrow_x,50%);transform:translateX(-50%)}
      .kniu_sys_table_tooltip[data-placement="top"]::after{bottom:-12px;border-top-color:rgba(48,49,51,.92)}
      .kniu_sys_table_tooltip[data-placement="bottom"]::after{top:-12px;border-bottom-color:rgba(48,49,51,.92)}
      .kniu_sys_table_loading{position:absolute;inset:0;z-index:30;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;background-color:rgba(255,255,255,.9);color:#606266;opacity:0;visibility:hidden;transition:opacity .2s ease,visibility .2s ease;pointer-events:auto}
      .kniu_sys_table_loading[data-active="true"]{opacity:1;visibility:visible}
      .kniu_sys_table_loading_spinner{width:34px;height:34px;box-sizing:border-box;border:3px solid rgba(64,158,255,.25);border-top-color:#409eff;border-radius:50%;animation:kniu_sys_table_loading_spin .7s linear infinite}
      .kniu_sys_table_loading_text{font-size:13px;max-width:80%;text-align:center}
      @keyframes kniu_sys_table_loading_spin{to{transform:rotate(360deg)}}
      :host([theme="dark"]) .kniu_sys_table_group{--kniu-table-edge-fade:rgba(255,255,255,.1)}
      :host-context([data-theme="dark"]) .kniu_sys_table_group{--kniu-table-edge-fade:rgba(255,255,255,.1)}
      @media (prefers-color-scheme:dark){.kniu_sys_table_group{--kniu-table-edge-fade:rgba(255,255,255,.1)}}
      @media (min-width:851px){.kniu_sys_table_group[data-mobile-overflow-left="true"]::before,.kniu_sys_table_group[data-mobile-overflow-right="true"]::after{display:none}}
      @media (max-width:850px){
        .kniu_sys_table .kniu_sys_table_fixed_left,.kniu_sys_table .kniu_sys_table_fixed_right{position:static!important;left:auto!important;right:auto!important;z-index:auto!important}
        .kniu_sys_table_fixed_shadow{display:none!important}
      }
      @media (prefers-reduced-motion:reduce){.kniu_sys_table_loading_spinner{animation:none}}
    `;
    // 目标是 ShadowRoot 时用共享样式表；否则（普通容器）退回 <style> 元素。
    const style = supportsAdoptedStyleSheets(target)
      ? (adoptSharedStyle(target, tableStyleSheetText), null)
      : (function () {
        const element = documentRef.createElement('style');
        element.textContent = tableStyleSheetText;
        return element;
      })();
    const group = documentRef.createElement('div');
    group.className = 'kniu_sys_table_group';
    const viewport = documentRef.createElement('div');
    viewport.className = 'kniu_sys_table_viewport';
    if (maxHeight) viewport.style.maxHeight = `${Math.max(40, maxHeight)}px`;
    if (height) viewport.style.height = `${Math.max(40, height)}px`;
    const table = documentRef.createElement('table');
    table.className = 'kniu_sys_table';
    const effectiveWidth = function (column) {
      const w = Number.parseInt(column.width, 10);
      if (Number.isFinite(w) && w > 0) return w;
      const m = Number.parseInt(column.minWidth, 10);
      if (Number.isFinite(m) && m > 0) return m;
      // 未声明宽度的业务列也必须计入表格最小宽度。原先返回 0，
      // 导致移动端固定宽度列占满后，栏目名称/中文/英文/用户名等
      // 弹性列被 table-layout:fixed 压缩到 0px。与 columnWidth() 的默认值保持一致。
      return 120;
    };
    const hasFlexibleColumn = columns.some(function (column) {
      const w = Number.parseInt(column.width, 10);
      const m = Number.parseInt(column.minWidth, 10);
      return !(Number.isFinite(w) && w > 0) && !(Number.isFinite(m) && m > 0);
    });
    const minTotalWidth = columns.reduce(function (sum, column) { return sum + effectiveWidth(column); }, 0);
    if (options.fit !== false) table.style.minWidth = `${minTotalWidth}px`;
    else table.style.minWidth = '0';
    if (options.fit === false || hasFlexibleColumn) {
    } else {
      table.style.width = `${minTotalWidth}px`;
    }
    const leftFixedShadow = documentRef.createElement('div');
    leftFixedShadow.className = 'kniu_sys_table_fixed_shadow kniu_sys_table_fixed_shadow_left';
    leftFixedShadow.setAttribute('aria-hidden', 'true');
    const rightFixedShadow = documentRef.createElement('div');
    rightFixedShadow.className = 'kniu_sys_table_fixed_shadow kniu_sys_table_fixed_shadow_right';
    rightFixedShadow.setAttribute('aria-hidden', 'true');
    // 区域加载遮罩：放在 group（position:relative）内、视口与固定阴影之上，覆盖整张表
    const loadingMask = documentRef.createElement('div');
    loadingMask.className = 'kniu_sys_table_loading';
    loadingMask.setAttribute('data-active', String(!!options.loading));
    loadingMask.setAttribute('role', 'status');
    loadingMask.setAttribute('aria-label', '加载中');
    const loadingSpinner = documentRef.createElement('span');
    loadingSpinner.className = 'kniu_sys_table_loading_spinner';
    loadingMask.appendChild(loadingSpinner);
    const loadingTextEl = documentRef.createElement('span');
    loadingTextEl.className = 'kniu_sys_table_loading_text';
    loadingMask.appendChild(loadingTextEl);
    viewport.append(table);
    group.append(viewport, leftFixedShadow, rightFixedShadow, loadingMask);
    group.dataset.stripe = String(!!options.stripe);
    group.dataset.border = String(!!options.border);
    group.dataset.size = ['large', 'small'].includes(options.size) ? options.size : 'default';
    group.dataset.highlightCurrentRow = String(!!options.highlightCurrentRow);
    // 溢出提示浮层：挂在 shadowRoot 顶层（viewport/group 之外），用 fixed 定位避免被 overflow 裁切。
    const tooltip = documentRef.createElement('div');
    tooltip.className = 'kniu_sys_table_tooltip';
    tooltip.hidden = true;
    tooltip.setAttribute('role', 'tooltip');
    replaceChildrenWithFragment(target, [style, group, tooltip]);

    function columnWidth(column) {
      return Math.max(40, Number.parseInt(column.width, 10) || Number.parseInt(column.minWidth, 10) || 120);
    }

    function fixedOffsets() {
      const left = new Map();
      const right = new Map();
      let offset = 0;
      columns.forEach(function (column, index) {
        if (column.fixed === true || column.fixed === 'left') {
          left.set(index, offset);
          offset += columnWidth(column);
        }
      });
      offset = 0;
      for (let index = columns.length - 1; index >= 0; index--) {
        const column = columns[index];
        if (column.fixed === 'right') {
          right.set(index, offset);
          offset += columnWidth(column);
        }
      }
      return { left: left, right: right };
    }

    function applyColumnLayout(cell, column, index, offsets) {
      const explicitWidth = Number.parseInt(column.width, 10);
      const hasWidth = Number.isFinite(explicitWidth) && explicitWidth > 0;
      const minWidth = Number.parseInt(column.minWidth, 10);
      const hasMinWidth = Number.isFinite(minWidth) && minWidth > 0;
      if (hasWidth) {
        cell.style.width = `${explicitWidth}px`;
        cell.style.minWidth = `${explicitWidth}px`;
        cell.style.maxWidth = `${explicitWidth}px`;
      } else if (hasMinWidth) {
        cell.style.width = `${minWidth}px`;
        cell.style.minWidth = `${minWidth}px`;
      }
      cell.style.textAlign = column.align || 'left';
      if (offsets.left.has(index)) {
        cell.classList.add('kniu_sys_table_fixed_left');
        cell.style.left = `${offsets.left.get(index)}px`;
      }
      if (offsets.right.has(index)) {
        cell.classList.add('kniu_sys_table_fixed_right');
        cell.style.right = `${offsets.right.get(index)}px`;
      }
    }

    function showCellTooltip(cell) {
      if (!cell._tooltipText) return;
      // 仅当内容实际溢出（被 ellipsis 裁切）时才显示，避免每条都弹提示
      if (cell.scrollWidth <= cell.clientWidth + 1) return;
      tooltip.textContent = cell._tooltipText;
      tooltip.hidden = false;
      const rect = cell.getBoundingClientRect();
      const tw = tooltip.offsetWidth;
      const th = tooltip.offsetHeight;
      const vGap = 6;     // tip 与单元格的垂直间距（正好容纳 6px 高的指向小三角）
      const hMargin = 8;  // tip 与视口边缘的水平留白
      // 垂直：默认在单元格「上方」居中；上方空间不足则落到「下方」；
      // 若上下都不够，取空间更大的一侧（满足「上方不够→下方、下方不够→上方」双向避让）。
      let top;
      let placement = 'top'; // tip 在单元格上方 → 三角在 tip 底部朝下指向单元格
      const spaceAbove = rect.top;
      const spaceBelow = window.innerHeight - rect.bottom;
      if (spaceAbove >= th + vGap) {
        top = rect.top - th - vGap;
      } else if (spaceBelow >= th + vGap) {
        top = rect.bottom + vGap;
        placement = 'bottom';
      } else {
        if (spaceAbove >= spaceBelow) {
          top = rect.top - th - vGap;
        } else {
          top = rect.bottom + vGap;
          placement = 'bottom';
        }
      }
      // 水平：默认沿单元格水平居中对齐；
      // 左侧空间不足 → 左对齐（tip 左缘贴近单元格左缘，避免被左边缘裁切）；
      // 右侧空间不足 → 右对齐（tip 右缘贴近单元格右缘，避免被右边缘裁切）；
      // 最后夹在视口内兜底，保证永远完整可见。
      let left = rect.left + rect.width / 2 - tw / 2;
      if (left < hMargin) left = rect.left;                                       // 左避让
      if (left + tw > window.innerWidth - hMargin) left = rect.right - tw;        // 右避让
      left = Math.max(hMargin, Math.min(left, window.innerWidth - tw - hMargin)); // 视口兜底
      tooltip.style.top = `${top}px`;
      tooltip.style.left = `${left}px`;
      tooltip.dataset.placement = placement;
      // 指向小三角：水平跟随单元格中心（相对 tip 左缘），夹在 tip 内部避免悬空出界。
      const cellCenterX = rect.left + rect.width / 2 - left;
      const arrowX = Math.max(10, Math.min(cellCenterX, tw - 10));
      tooltip.style.setProperty('--kniu_tip_arrow_x', `${arrowX}px`);
    }
    function hideTooltip() { tooltip.hidden = true; }

    function appendCellContent(cell, column, row, rowIndex) {
      if (column.type === 'index') {
        cell.textContent = typeof column.index === 'function' ? column.index(rowIndex) : String(rowIndex + (Number(column.index) || 1));
        return;
      }
      if (column.type === 'checkbox') {
        const checkbox = documentRef.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'kniu_sys_table_selection';
        // 行节点会被复用，监听器不能闭包持有 row（换页后即失效），统一按 rowIndex 取回当前行对象
        checkbox.dataset.rowIndex = String(rowIndex);
        checkbox.checked = selectedRows.has(row);
        checkbox.disabled = typeof column.selectable === 'function' && !column.selectable(row, rowIndex);
        checkbox.addEventListener('click', function (event) { event.stopPropagation(); });
        checkbox.addEventListener('change', function () {
          const currentIndex = Number.parseInt(checkbox.dataset.rowIndex, 10);
          const currentRowData = Number.isFinite(currentIndex) ? rows[currentIndex] : row;
          if (currentRowData === undefined) return;
          if (checkbox.checked) selectedRows.add(currentRowData);
          else selectedRows.delete(currentRowData);
          options.host?.dispatchEvent(new CustomEvent('selection-change', { detail: [...selectedRows], bubbles: true, composed: true }));
          render();
        });
        cell.append(checkbox);
        return;
      }
      if (column.image) {
        const image = documentRef.createElement('kniu-image');
        image.options = { ...(column.image.options || column.image.attributes || {}), src: column.field == null ? '' : row?.[column.field] };
        image.style.width = column.image.width;
        image.style.height = column.image.height;
        cell.append(image);
        return;
      }
      if (column.switch) {
        const switchElement = documentRef.createElement('kniu-switch');
        // 列内开关配置统一来自 kniu:options 快照（旧 attribute 快照已作废）
        if (column.switch.options && typeof column.switch.options === 'object') {
          switchElement.options = column.switch.options;
        }
        switchElement.value = column.field == null ? false : row?.[column.field];
        // 同上：行节点复用后按 rowIndex 取回行对象，避免闭包里是上一页的 row
        switchElement.dataset.rowIndex = String(rowIndex);
        switchElement._saveQueue = Promise.resolve();
        switchElement._changeVersion = 0;
        switchElement.addEventListener('change', async function (event) {
          const currentIndex = Number.parseInt(switchElement.dataset.rowIndex, 10);
          const currentRowData = Number.isFinite(currentIndex) ? rows[currentIndex] : row;
          if (currentRowData === undefined) return;
          const previousValue = column.field == null ? undefined : currentRowData[column.field];
          const requestedValue = event.detail;
          if (column.field != null) currentRowData[column.field] = requestedValue;
          if (typeof column.switch.onChange !== 'function') return;
          // 不在请求期间禁用开关：禁用会让连续点击被浏览器吞掉，
          // 因而看起来像“切换几次后不再发请求”。同一开关的提交按操作顺序
          // 串行入队，既不丢操作，也避免后发请求先返回导致服务端最终值错乱。
          const changeVersion = ++switchElement._changeVersion;
          const saveTask = switchElement._saveQueue.then(function () {
            return column.switch.onChange(currentIndex, rows, requestedValue);
          });
          switchElement._saveQueue = saveTask.catch(function () { return false; });
          const saved = await saveTask.catch(function () { return false; }) !== false;
          if (!saved && column.field != null && switchElement._changeVersion === changeVersion) {
            currentRowData[column.field] = previousValue;
            switchElement.value = previousValue;
          }
        });
        cell.append(switchElement);
        return;
      }
      if (column.tag) {
        const tag = documentRef.createElement('kniu-tag');
        tag.options = Object.fromEntries(Object.entries(column.tag.options || column.tag.attributes || {}).map(function ([name, value]) {
          return [name, resolveTableRowTemplate(value, row, rowIndex)];
        }));
        const rawValue = column.field == null ? '' : row?.[column.field];
        tag.textContent = rawValue == null ? '' : String(rawValue);
        cell.append(tag);
        return;
      }
      if (column.status) {
        const status = documentRef.createElement('kniu-status');
        status.options = Object.fromEntries(Object.entries(column.status.options || column.status.attributes || {}).map(function ([name, value]) {
          return [name, resolveTableRowTemplate(value, row, rowIndex)];
        }));
        const rawValue = column.field == null ? '' : row?.[column.field];
        status.textContent = rawValue == null ? '' : String(rawValue);
        cell.append(status);
        return;
      }
      if (Array.isArray(column.actions)) {
        column.actions.forEach(function (action, actionIndex) {
          if (action.condition != null && !resolveTableRowTemplate(action.condition, row, rowIndex)) return;
          const button = documentRef.createElement('kniu-btn');
          button.className = `kniu_sys_table_action${action.className ? ` ${action.className}` : ''}`;
          button.options = {
            nativeType: 'button', type: action.type, size: action.size, plain: action.plain,
            text: action.text, bg: action.bg, link: action.link, round: action.round, circle: action.circle,
            disabled: action.disabled, icon: action.icon
          };
          button.dataset.rowIndex = String(rowIndex);
          button.dataset.columnIndex = String(columns.indexOf(column));
          button.dataset.actionIndex = String(actionIndex);
          button.textContent = typeof action.title === 'function'
            ? String(action.title(row, rowIndex))
            : String(action.title || '操作');
          cell.append(button);
        });
        return;
      }
      const rawValue = column.field == null ? '' : row?.[column.field];
      const value = typeof column.formatter === 'function'
        ? column.formatter(row, column, rawValue, rowIndex)
        : rawValue;
      // HTML 编解码为后端全责（查→后端解码返回），前端拿到即最终文本，直接渲染。
      const text = value == null ? '' : String(value);
      cell.textContent = text;
      if (column.showOverflowTooltip) {
        cell.classList.add('kniu_sys_table_cell_tooltip');
        cell._tooltipText = text;
        cell.addEventListener('mouseenter', function () { showCellTooltip(cell); });
        cell.addEventListener('mouseleave', function () { hideTooltip(); });
      }
    }

    // ===== 批量渲染优化：行/单元格复用 =====
    // 原因：原实现每次 render 都重建 tbody 内全部 tr/td（500 行 × 8 列 = 4000+ 节点，
    // 其中控件列还要逐个 attachShadow 创建自定义元素），随后又读 getBoundingClientRect
    // 触发整表强制同步布局。实测单次 setData 约 60ms，其中 80% 耗在强制回流上。
    // 复用后：节点不重建 → 浏览器只做增量布局；列宽缓存 → 不再每次强制回流。

    // 纯文本列（无控件、无自定义元素）可只改 textContent，零元素创建。
    function isPlainTextColumn(column) {
      return column.type !== 'checkbox'
        && !column.image
        && !column.switch
        && !column.tag
        && !column.status
        && !Array.isArray(column.actions);
    }

    function setWidgetAttribute(element, name, value) {
      if (value == null || value === '') element.removeAttribute(name);
      else element.setAttribute(name, String(value));
    }

    function setWidgetFlag(element, name, active) {
      if (active) element.setAttribute(name, '');
      else element.removeAttribute(name);
    }

    // 复用单元格内已有控件，只更新值与状态。返回 false 表示结构不匹配，需重建。
    function updateCellWidget(cell, column, row, rowIndex) {
      const child = cell.firstElementChild;
      if (column.type === 'checkbox') {
        if (!child || child.tagName !== 'INPUT') return false;
        // rowIndex 必须同步：行节点复用后若不更新，change 会拿旧索引改错行
        child.dataset.rowIndex = String(rowIndex);
        child.checked = selectedRows.has(row);
        child.disabled = typeof column.selectable === 'function' && !column.selectable(row, rowIndex);
        return true;
      }
      if (column.image) {
        if (!child || child.tagName !== 'KNIU-IMAGE') return false;
        child.options = { ...(column.image.options || column.image.attributes || {}), src: column.field == null ? '' : row?.[column.field] };
        return true;
      }
      if (column.switch) {
        if (!child || child.tagName !== 'KNIU-SWITCH') return false;
        // 首次渲染早于 kniu:options 绑定（快照为 null）时，行复用节点也需在列定义
        // 重读后同步最新配置；整体替换 options 后此处按引用变化更新。
        if (column.switch.options && typeof column.switch.options === 'object'
          && child.options !== column.switch.options) {
          child.options = column.switch.options;
        }
        child.value = column.field == null ? false : row?.[column.field];
        child.dataset.rowIndex = String(rowIndex);
        return true;
      }
      if (column.tag || column.status) {
        const tagName = column.tag ? 'KNIU-TAG' : 'KNIU-STATUS';
        if (!child || child.tagName !== tagName) return false;
        const config = column.tag || column.status;
        child.options = Object.fromEntries(Object.entries(config.options || config.attributes || {}).map(function ([name, value]) {
          return [name, resolveTableRowTemplate(value, row, rowIndex)];
        }));
        const rawValue = column.field == null ? '' : row?.[column.field];
        child.textContent = rawValue == null ? '' : String(rawValue);
        return true;
      }
      if (Array.isArray(column.actions)) return updateActionButtons(cell, column, row, rowIndex);
      return false;
    }

    // 操作列：按钮数量会随 condition 变化，用「按需显示/隐藏」代替「删除/重建」，
    // 避免每次 render 都创建成百上千个 kniu-btn（每个都要挂 ShadowRoot）。
    function updateActionButtons(cell, column, row, rowIndex) {
      const existing = [...cell.children];
      let cursor = 0;
      column.actions.forEach(function (action, actionIndex) {
        if (action.condition != null && !resolveTableRowTemplate(action.condition, row, rowIndex)) return;
        let button = existing[cursor];
        if (!button || button.tagName !== 'KNIU-BTN') {
          button = documentRef.createElement('kniu-btn');
          cell.appendChild(button);
        }
        button.className = `kniu_sys_table_action${action.className ? ` ${action.className}` : ''}`;
        button.style.display = '';
        button.options = {
          nativeType: 'button', type: action.type, size: action.size, plain: action.plain,
          text: action.text, bg: action.bg, link: action.link, round: action.round, circle: action.circle,
          disabled: action.disabled, icon: action.icon
        };
        button.dataset.rowIndex = String(rowIndex);
        button.dataset.columnIndex = String(columns.indexOf(column));
        button.dataset.actionIndex = String(actionIndex);
        const title = typeof action.title === 'function'
          ? String(action.title(row, rowIndex))
          : String(action.title || '操作');
        if (button.textContent !== title) button.textContent = title;
        cursor += 1;
      });
      for (let index = cursor; index < existing.length; index += 1) existing[index].style.display = 'none';
      return true;
    }

    // 更新单元格内容：文本列走极速路径，控件列优先复用。
    function renderCellContent(cell, column, row, rowIndex, reused) {
      if (!cell) return;
      if (isPlainTextColumn(column)) {
        let text;
        if (column.type === 'index') {
          text = typeof column.index === 'function'
            ? String(column.index(rowIndex))
            : String(rowIndex + (Number(column.index) || 1));
        } else {
          const rawValue = column.field == null ? '' : row?.[column.field];
          const value = typeof column.formatter === 'function'
            ? column.formatter(row, column, rawValue, rowIndex)
            : rawValue;
          // HTML 编解码为后端全责（查→后端解码返回），前端拿到即最终文本，直接渲染。
          text = value == null ? '' : String(value);
        }
        if (cell.textContent !== text) cell.textContent = text;
        if (column.showOverflowTooltip) {
          cell._tooltipText = text;
          if (!cell.classList.contains('kniu_sys_table_cell_tooltip')) {
            cell.classList.add('kniu_sys_table_cell_tooltip');
            cell.addEventListener('mouseenter', function () { showCellTooltip(cell); });
            cell.addEventListener('mouseleave', function () { hideTooltip(); });
          }
        }
        return;
      }
      if (reused && updateCellWidget(cell, column, row, rowIndex)) return;
      cell.replaceChildren();
      appendCellContent(cell, column, row, rowIndex);
    }

    // 新建数据行：一次性用 DocumentFragment 挂载全部单元格，避免逐个 append 触发多次布局。
    function createBodyRow(offsets) {
      const tableRow = documentRef.createElement('tr');
      const cellFragment = documentRef.createDocumentFragment();
      columns.forEach(function (column, index) {
        const cell = documentRef.createElement('td');
        applyColumnLayout(cell, column, index, offsets);
        if (column.editable) cell.classList.add('kniu_sys_table_editable');
        cellFragment.appendChild(cell);
      });
      tableRow.appendChild(cellFragment);
      return tableRow;
    }

    function buildBodyRow(row, rowIndex, offsets) {
      const pooled = rowPool[rowIndex];
      // 空态行结构不同（只有 1 个 colspan 单元格），不能与数据行互用；
      // 单元格数与当前列数不一致时同样不可复用（兜底，正常由列签名拦截）。
      const reused = !!pooled
        && !pooled.classList.contains('kniu_sys_table_empty')
        && pooled.cells.length === columns.length;
      const tableRow = reused ? pooled : createBodyRow(offsets);
      if (options.rowKey && row?.[options.rowKey] != null) tableRow.dataset.rowKey = String(row[options.rowKey]);
      else if (tableRow.dataset.rowKey != null) delete tableRow.dataset.rowKey;
      tableRow.dataset.current = String(row === currentRow);
      // 行索引写进 dataset：事件委托时据此从 rows 取回行对象，避免监听器闭包持有陈旧的 row
      tableRow.dataset.rowIndex = String(rowIndex);
      const cells = tableRow.cells;
      for (let index = 0; index < columns.length; index += 1) {
        renderCellContent(cells[index], columns[index], row, rowIndex, reused);
      }
      return tableRow;
    }

    // 列结构签名：单元格数量与列布局（宽度 / 固定 / 可编辑）一旦变化，复用行必须重建。
    function columnSignature() {
      let signature = String(columns.length);
      for (let i = 0; i < columns.length; i += 1) {
        const column = columns[i];
        signature += `|${column.field ?? column.type ?? ''},${column.width ?? ''},${column.minWidth ?? ''},${column.fixed ?? ''},${column.editable ? 1 : 0},${column.align ?? ''}`;
      }
      return signature;
    }

    function buildEmptyRow() {
      const emptyRow = documentRef.createElement('tr');
      emptyRow.className = 'kniu_sys_table_empty';
      const emptyCell = documentRef.createElement('td');
      emptyCell.colSpan = columns.length;
      if (options.emptySlot) {
        // <template #empty> 插槽：在空行内投影自定义内容（图标、按钮等）
        const slot = documentRef.createElement('slot');
        slot.name = 'empty';
        emptyCell.append(slot);
      } else if (options.emptyText === '') {
        // 外部自行提供空状态（如 kniu-empty）时隐藏内置空行，避免重复文案
        emptyCell.textContent = '';
        emptyRow.style.display = 'none';
      } else {
        emptyCell.textContent = options.emptyText || '暂无数据';
      }
      emptyRow.append(emptyCell);
      return emptyRow;
    }

    // 行点击 / 可编辑单元格改为事件委托：整表只挂 2 个监听器，
    // 取代原本「每行一个 click + 每格一个 pointerdown/click」（500 行表格即数千个监听器）。
    function findEventElement(event, selector) {
      const pathMatch = event.composedPath?.().find(function (node) {
        return node?.matches?.(selector);
      });
      return pathMatch || event.target?.closest?.(selector) || null;
    }

    function resolveRowFromEvent(event, selector) {
      if (disposed) return null;
      if (selector && findEventElement(event, selector)) return null;
      // kniu-btn / kniu-switch 内部是 Shadow DOM，event.target 在委托层会被重定向。
      // 通过 composedPath 取真实路径，才能稳定找到宿主控件和所属单元格。
      const cell = findEventElement(event, 'td');
      if (!cell || !bodyElement || !bodyElement.contains(cell)) return null;
      const tableRow = cell.parentElement;
      if (!tableRow || tableRow.parentElement !== bodyElement) return null;
      const rowIndex = Number.parseInt(tableRow.dataset.rowIndex, 10);
      if (!Number.isFinite(rowIndex)) return null;
      const row = rows[rowIndex];
      if (row === undefined) return null;
      return { cell: cell, tableRow: tableRow, row: row, rowIndex: rowIndex, column: columns[cell.cellIndex] };
    }

    function handleBodyClick(event) {
      const hit = resolveRowFromEvent(event, null);
      if (!hit) return;
      const { cell, tableRow, row, rowIndex, column } = hit;
      const isControl = findEventElement(event, '.kniu_sys_table_action,.kniu_sys_table_editable,.kniu_sys_table_selection,kniu-switch');
      if (isControl) {
        if (column?.editable && cell.classList.contains('kniu_sys_table_editable')) {
          beginCellEdit(cell, column, row, rowIndex);
        }
        return;
      }
      const previous = currentRow;
      currentRow = row;
      options.host?.dispatchEvent(new CustomEvent('row-click', { detail: { row: row, index: rowIndex }, bubbles: true, composed: true }));
      if (previous !== row) options.host?.dispatchEvent(new CustomEvent('current-change', { detail: { currentRow: row, oldCurrentRow: previous }, bubbles: true, composed: true }));
      if (options.highlightCurrentRow) {
        bodyElement.querySelectorAll('tr[data-current="true"]').forEach(function (item) { item.dataset.current = 'false'; });
        tableRow.dataset.current = 'true';
      }
    }

    function handleBodyPointerDown(event) {
      const cell = event.target.closest?.('td.kniu_sys_table_editable');
      if (!cell || !bodyElement || !bodyElement.contains(cell)) return;
      const activeInput = table.querySelector('.kniu_sys_table_edit_input');
      if (!activeInput || cell.contains(activeInput)) return;
      const tableRow = cell.parentElement;
      const rowIndex = Number.parseInt(tableRow?.dataset?.rowIndex, 10);
      const column = columns[cell.cellIndex];
      if (!column || !Number.isFinite(rowIndex)) return;
      event.preventDefault();
      pendingEdit = { row: rows[rowIndex], column: column };
      activeInput.blur();
    }

    // 固定列阴影需要的实测列宽：列配置固定，宽度只在容器尺寸变化时改变，
    // 因此缓存结果，仅在 resize / doLayout 时失效，避免每次 render 强制回流。
    function invalidateColumnWidthCache() {
      measuredColumnWidths = null;
    }

    function measureColumnWidths() {
      if (measuredColumnWidths) return measuredColumnWidths;
      const head = table.querySelector('thead');
      const measured = [];
      let anyMeasured = false;
      for (let index = 0; index < columns.length; index += 1) {
        const th = head?.rows?.[0]?.cells?.[index];
        const width = th ? th.getBoundingClientRect().width : 0;
        if (width > 0) {
          measured[index] = width;
          anyMeasured = true;
        } else {
          measured[index] = columnWidth(columns[index]);
        }
      }
      // 只有拿到真实宽度才缓存，否则首帧尚未布局时会把兜底值固化
      if (anyMeasured) measuredColumnWidths = measured;
      return measured;
    }

    // 阴影显隐依赖 viewport 的 scrollWidth/clientWidth，同步读取会强制布局；
    // 推迟到下一帧统一处理，视觉无差别，但把强制回流移出了 render 的同步路径。
    function scheduleShadowVisibilityUpdate() {
      // 行数/列宽变化会改变 scrollWidth，先让缓存指标失效再在下一帧重算
      invalidateLayoutMetrics();
      if (shadowVisibilityFrame) return;
      const view = documentRef.defaultView;
      if (!view || typeof view.requestAnimationFrame !== 'function') {
        updateFixedShadowVisibility();
        return;
      }
      shadowVisibilityFrame = view.requestAnimationFrame(function () {
        shadowVisibilityFrame = 0;
        if (!disposed) updateFixedShadowVisibility();
      });
    }

    // 滚动时若每次都读 scrollWidth/clientWidth/offsetWidth，会在每个 scroll 事件上强制同步布局。
    // 这三个值只随「内容尺寸 / 容器尺寸」变化，故缓存起来，滚动路径只读廉价的 scrollLeft。
    let layoutMetrics = null;
    // matchMedia 结果缓存为单个 MediaQueryList，避免每次滚动都重新解析媒体查询
    let mobileMediaQuery = null;

    function invalidateLayoutMetrics() {
      layoutMetrics = null;
    }

    function getLayoutMetrics() {
      if (layoutMetrics) return layoutMetrics;
      if (!mobileMediaQuery && typeof globalThis.matchMedia === 'function') {
        mobileMediaQuery = globalThis.matchMedia('(max-width: 850px)');
      }
      const maxScrollLeft = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
      layoutMetrics = {
        maxScrollLeft: maxScrollLeft,
        hasHorizontalOverflow: maxScrollLeft > 1,
        isMobile: !!mobileMediaQuery?.matches,
        // 右侧固定列阴影宽度保持恒定（仅等于固定列宽度），不随竖向滚动条出现/消失而改变，避免翻页抖动。
        // 滚动条为 classic 模式时，阴影 right 位置跟随滚动条宽度内缩，防止被滚动条覆盖。
        verticalScrollbarWidth: Math.max(0, viewport.offsetWidth - viewport.clientWidth)
      };
      return layoutMetrics;
    }

    function updateFixedShadowVisibility() {
      const metrics = getLayoutMetrics();
      const scrollLeft = viewport.scrollLeft;
      const { maxScrollLeft, hasHorizontalOverflow, isMobile, verticalScrollbarWidth } = metrics;
      group.dataset.mobileOverflowLeft = String(isMobile && hasHorizontalOverflow && scrollLeft > 1);
      group.dataset.mobileOverflowRight = String(isMobile && hasHorizontalOverflow && scrollLeft < maxScrollLeft - 1);
      leftFixedShadow.style.display =
        fixedLeftWidth > 0 && hasHorizontalOverflow && scrollLeft > 1
          ? 'block'
          : 'none';
      rightFixedShadow.style.display =
        fixedRightWidth > 0 && hasHorizontalOverflow && scrollLeft < maxScrollLeft - 1
          ? 'block'
          : 'none';
      rightFixedShadow.style.right = `${verticalScrollbarWidth}px`;
    }

    function beginCellEdit(cell, column, row, rowIndex) {
      if (!column.editable || cell.querySelector('.kniu_sys_table_edit_input')) return;
      const oldValue = row?.[column.field];
      const input = documentRef.createElement('input');
      input.className = 'kniu_sys_table_edit_input';
      const editMode = column.editable === 'number' ? 'number' : 'text';
      input.type = editMode;
      if (editMode === 'number' && column.editMin != null) input.min = String(column.editMin);
      input.value = oldValue == null ? '' : String(oldValue);
      cell.replaceChildren(input);
      input.focus();
      input.select();
      let cancelled = false;
      let committed = false;
      input.addEventListener('keydown', function (event) {
        if (editMode === 'number' && column.editMin >= 0 && event.key === '-') {
          event.preventDefault();
          return;
        }
        if (event.key === 'Escape') {
          cancelled = true;
          input.blur();
        } else if (event.key === 'Enter') {
          input.blur();
        }
      });
      input.addEventListener('blur', async function () {
        if (committed) return;
        committed = true;
        if (cancelled) {
          render();
          return;
        }
        const numericValue = Number.isFinite(Number(input.value)) ? Number(input.value) : 0;
        const nextValue = editMode === 'number'
          ? Math.max(column.editMin ?? 0, numericValue)
          : input.value;
        if (String(nextValue) === String(oldValue)) {
          render();
          return;
        }
        input.disabled = true;
        row[column.field] = nextValue;
        const saved = typeof column.onChange !== 'function'
          || await column.onChange(rowIndex, rows, nextValue, oldValue) !== false;
        if (!saved) row[column.field] = oldValue;
        if (saved) {
          rows.sort(function (left, right) {
            if (column.editable === 'number') return Number(left?.[column.field] || 0) - Number(right?.[column.field] || 0);
            return String(left?.[column.field] ?? '').localeCompare(String(right?.[column.field] ?? ''), 'zh-CN');
          });
        }
        render();
      }, { once: true });
    }

    function applySort(field, order) {
      const column = columns.find(function (item) { return item.field === field; });
      sortState = { field: field || '', order: order || '' };
      if (column && order) {
        const direction = order === 'descending' ? -1 : 1;
        // 从初始顺序副本出发排序：升/降/清空三态反复切换也不会在已排序结果上叠加。
        rows = [...initialRows].sort(function (left, right) {
          if (typeof column.sortMethod === 'function') return column.sortMethod(left, right) * direction;
          const a = left?.[field];
          const b = right?.[field];
          if (a == null && b == null) return 0;
          if (a == null) return -direction;
          if (b == null) return direction;
          return (typeof a === 'number' && typeof b === 'number'
            ? a - b
            : String(a).localeCompare(String(b), 'zh-CN', { numeric: true })) * direction;
        });
      } else {
        // 第三次点击（或 clearSort）：清空排序，恢复数据源原始顺序。
        rows = initialRows;
      }
      options.host?.dispatchEvent(new CustomEvent('sort-change', {
        detail: { column: column || null, field: field || '', order: order || null },
        bubbles: true, composed: true
      }));
      render();
    }

    function render(renderOptions = {}) {
      if (disposed || rendering) return;
      // 外部可能原地 mutate options.cols（与外部同一引用）：每次渲染重读列定义并原地替换，
      // 行池签名（columnSignature）据此检测列结构变化并整体作废重建（2026-09-01 修复
      // filter 拷贝隔离 mutate 导致列增删后复用行单元格数失配）。
      columns.length = 0;
      columns.push(...readColumns());
      rendering = true;
      const syncSortHeader = renderOptions.syncSortHeader !== false;
      const syncSelectionHeader = renderOptions.syncSelectionHeader !== false;
      const isEmpty = rows.length === 0;
      group.dataset.empty = String(isEmpty);
      const offsets = fixedOffsets();

      // 表头只创建一次：列配置在 table 实例生命周期内固定，避免翻页/排序时反复重建 thead 造成抖动。
      if (!headElement && options.showHeader !== false) {
        headElement = documentRef.createElement('thead');
        const headRow = documentRef.createElement('tr');
        const headFragment = documentRef.createDocumentFragment();
        columns.forEach(function (column, index) {
          const cell = documentRef.createElement('th');
          cell.scope = 'col';
          cell.style.textAlign = column.headerAlign || column.align || 'left';
          // 表头 checkbox 列：根据当前列定义实时计算可选行集，
          // 必须**每次都重新过滤**，因为 headElement 只创建一次，
          // 首次创建时 rows 可能为空（data 尚未就绪），后续 setData 不会重建表头，
          // 若把 selectableRows 闭包到 addEventListener 里，就会拿到陈旧的空数组。
          function getSelectableRows(columnObj) {
            return rows.filter(function (row, rowIndex) { return typeof columnObj.selectable !== 'function' || columnObj.selectable(row, rowIndex); });
          }
          if (column.type === 'checkbox') {
            const checkbox = documentRef.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'kniu_sys_table_selection';
            checkbox.disabled = isEmpty;
            checkbox.checked = getSelectableRows(column).length > 0 && getSelectableRows(column).every(function (row) { return selectedRows.has(row); });
            checkbox.indeterminate = !checkbox.checked && getSelectableRows(column).some(function (row) { return selectedRows.has(row); });
            checkbox.addEventListener('change', function () {
              if (!rows.length) return;
              // 不要用陈旧闭包，每次都按当前 rows 重新计算可选行集合
              getSelectableRows(column).forEach(function (row) { checkbox.checked ? selectedRows.add(row) : selectedRows.delete(row); });
              options.host?.dispatchEvent(new CustomEvent('selection-change', { detail: [...selectedRows], bubbles: true, composed: true }));
              render();
            });
            cell.append(checkbox);
          } else {
            cell.append(documentRef.createTextNode(column.label == null ? '' : String(column.label)));
          }
          if (column.sortable && column.field) {
            const sorter = documentRef.createElement('span');
            sorter.className = 'kniu_sys_table_sort';
            sorter.dataset.field = column.field;
            sorter.dataset.order = sortState.field === column.field ? sortState.order : '';
            sorter.innerHTML = '<span class="kniu_sys_table_sort_up">' + buildGlyphSvg(KNIU_ICON_SET['caret-top']) + '</span><span class="kniu_sys_table_sort_down">' + buildGlyphSvg(KNIU_ICON_SET['caret-bottom']) + '</span>';
            cell.append(sorter);
            cell.style.cursor = 'pointer';
            cell.addEventListener('click', function () {
              if (!rows.length) return;
              const nextOrder = sortState.field !== column.field || !sortState.order
                ? 'ascending'
                : (sortState.order === 'ascending' ? 'descending' : '');
              applySort(column.field, nextOrder);
            });
          }
          applyColumnLayout(cell, column, index, offsets);
          headFragment.appendChild(cell);
        });
        headRow.appendChild(headFragment);
        headElement.append(headRow);
      } else if (headElement && options.showHeader !== false) {
        if (syncSortHeader) headElement.querySelectorAll('.kniu_sys_table_sort').forEach(function (sorter) {
          const order = sortState.field === sorter.dataset.field ? sortState.order : '';
          if (sorter.dataset.order !== order) sorter.dataset.order = order;
        });
        // head 已存在时同步表头 checkbox 列的 checked/indeterminate：setData、组件 toggleRowSelection、
        // setCurrentRow 等都会触发 render，但其不重建表头，需在此刷新以反映 selectedRows 的实时变化。
        const headerInputs = syncSelectionHeader
          ? headElement.querySelectorAll('input[type="checkbox"].kniu_sys_table_selection')
          : [];
        headerInputs.forEach(function (input) {
          const idx = [...input.closest('tr').cells].indexOf(input.closest('th'));
          const column = columns[idx];
          if (!column) return;
          const selectableRows = rows.filter(function (row, rowIndex) { return typeof column.selectable !== 'function' || column.selectable(row, rowIndex); });
          input.disabled = isEmpty;
          input.checked = selectableRows.length > 0 && selectableRows.every(function (row) { return selectedRows.has(row); });
          input.indeterminate = !input.checked && selectableRows.some(function (row) { return selectedRows.has(row); });
        });
      }
      if (headElement && headElement.getAttribute('aria-disabled') !== String(isEmpty)) {
        headElement.setAttribute('aria-disabled', String(isEmpty));
      }

      const signature = columnSignature();
      if (rowPoolColumnSignature !== signature) {
        // 列结构变化：整池作废，避免复用行单元格数与新列失配
        rowPool = [];
        rowPoolColumnSignature = signature;
      }

      const rowNodes = [];
      if (!rows.length) {
        rowNodes.push(buildEmptyRow());
      } else {
        for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
          rowNodes.push(buildBodyRow(rows[rowIndex], rowIndex, offsets));
        }
      }
      rowPool = rowNodes;
      // 首次渲染时创建并挂载 tbody（同时挂载缓存的 thead），后续仅原地替换行子节点，结构稳定不抖动。
      if (!bodyElement) {
        bodyElement = documentRef.createElement('tbody');
        // 行点击与可编辑单元格统一委托到 tbody，整表只挂 2 个监听器
        bodyElement.addEventListener('click', handleBodyClick);
        bodyElement.addEventListener('pointerdown', handleBodyPointerDown);
        if (options.showHeader !== false && headElement && !table.contains(headElement)) {
          table.append(headElement);
        }
        table.append(bodyElement);
      }
      replaceChildrenWithFragment(bodyElement, rowNodes);

      // 按实测列宽计算固定列阴影宽度：固定列无显式宽度时取其内容实际宽度（避免强制 120 造成裁切或留白）。
      // 宽度走缓存，只有首帧或 resize/doLayout 后才真正测量。
      const measuredWidths = measureColumnWidths();
      function actualColumnWidth(index) {
        return measuredWidths[index] || columnWidth(columns[index]);
      }
      fixedLeftWidth = [...offsets.left.keys()].reduce(function (width, index) {
        return width + actualColumnWidth(index);
      }, 0);
      fixedRightWidth = [...offsets.right.keys()].reduce(function (width, index) {
        return width + actualColumnWidth(index);
      }, 0);
      leftFixedShadow.style.width = `${fixedLeftWidth}px`;
      rightFixedShadow.style.width = `${fixedRightWidth}px`;

      scheduleShadowVisibilityUpdate();
      rendering = false;
      if (pendingEdit) {
        const target = pendingEdit;
        pendingEdit = null;
        const targetRowIndex = rows.indexOf(target.row);
        const targetColumnIndex = columns.indexOf(target.column);
        const targetCell = table.tBodies[0]?.rows[targetRowIndex]?.cells[targetColumnIndex];
        if (targetCell) beginCellEdit(targetCell, target.column, target.row, targetRowIndex);
      }
    }

    function handleAction(event) {
      const button = findEventElement(event, 'kniu-btn.kniu_sys_table_action');
      if (!button || !table.contains(button)) return;
      const rowIndex = Number.parseInt(button.dataset.rowIndex, 10);
      const column = columns[Number.parseInt(button.dataset.columnIndex, 10)];
      const action = column?.actions?.[Number.parseInt(button.dataset.actionIndex, 10)];
      if (!action || typeof action.onClick !== 'function') return;
      action.onClick({ row: rows[rowIndex], index: rowIndex, rows: rows, table: api, event: event });
    }

    function setData(data) {
      rows = Array.isArray(data) ? data : [];
      // 新数据源到来时重置初始顺序基准：清空排序应回到本次 setData 的顺序。
      initialRows = rows;
      [...selectedRows].forEach(function (row) { if (!rows.includes(row)) selectedRows.delete(row); });
      if (currentRow && !rows.includes(currentRow)) currentRow = null;
      // 分页/刷新数据不会改变排序字段和方向，因此只更新 tbody；
      // 表头节点和排序箭头保持原样。仅全选列的布尔状态需随新页数据同步。
      render({ syncSortHeader: false, syncSelectionHeader: true });
      return rows;
    }

    function clearSelection() {
      selectedRows.clear();
      options.host?.dispatchEvent(new CustomEvent('selection-change', { detail: [], bubbles: true, composed: true }));
      render();
    }

    function toggleRowSelection(row, selected) {
      if (!rows.includes(row)) return;
      const shouldSelect = selected == null ? !selectedRows.has(row) : !!selected;
      if (shouldSelect) selectedRows.add(row);
      else selectedRows.delete(row);
      options.host?.dispatchEvent(new CustomEvent('selection-change', { detail: [...selectedRows], bubbles: true, composed: true }));
      render();
    }

    function setCurrentRow(row) {
      const previous = currentRow;
      currentRow = rows.includes(row) ? row : null;
      options.host?.dispatchEvent(new CustomEvent('current-change', { detail: { currentRow: currentRow, oldCurrentRow: previous }, bubbles: true, composed: true }));
      render();
    }

    function removeRow(index) {
      if (index < 0 || index >= rows.length) return null;
      const removed = rows.splice(index, 1)[0];
      render();
      return removed;
    }

    // 容器尺寸变化会让实测列宽与阴影布局指标失效，需一起刷新
    function handleContainerResize() {
      invalidateColumnWidthCache();
      invalidateLayoutMetrics();
      updateFixedShadowVisibility();
    }
    function handleWindowResize() { handleContainerResize(); }

    function destroy() {
      if (disposed) return;
      disposed = true;
      if (shadowVisibilityFrame) {
        documentRef.defaultView?.cancelAnimationFrame?.(shadowVisibilityFrame);
        shadowVisibilityFrame = 0;
      }
      table.removeEventListener('click', handleAction);
      bodyElement?.removeEventListener('click', handleBodyClick);
      bodyElement?.removeEventListener('pointerdown', handleBodyPointerDown);
      viewport.removeEventListener('scroll', updateFixedShadowVisibility);
      documentRef.defaultView?.removeEventListener('resize', handleWindowResize);
      if (viewportResizeObserver) {
        viewportResizeObserver.disconnect();
        viewportResizeObserver = null;
      }
      rowPool = [];
      rowPoolColumnSignature = '';
      target.replaceChildren();
    }

    function setLoading(active, text) {
      loadingMask.setAttribute('data-active', String(!!active));
      if (text != null) loadingTextEl.textContent = String(text);
    }
    function setMaxHeight(value) {
      const next = Number.parseInt(value, 10) || 0;
      viewport.style.maxHeight = next > 0 ? `${Math.max(40, next)}px` : '';
      viewport.style.overflowY = next > 0 ? 'auto' : '';
      updateFixedShadowVisibility();
    }
    // 初始文案（options.loadingText）
    if (options.loadingText != null) loadingTextEl.textContent = String(options.loadingText);

    const api = {
      setData: setData,
      getData: function () { return rows; },
      removeRow: removeRow,
      clearSelection: clearSelection,
      toggleRowSelection: toggleRowSelection,
      getSelectionRows: function () { return [...selectedRows]; },
      setCurrentRow: setCurrentRow,
      sort: applySort,
      clearSort: function () { applySort('', ''); },
      // 外部主动重排：列宽可能已变，先让缓存失效再渲染
      doLayout: function () { invalidateColumnWidthCache(); render(); },
      render: render,
      setLoading: setLoading,
      setMaxHeight: setMaxHeight,
      destroy: destroy
    };
    table.addEventListener('click', handleAction);
    viewport.addEventListener('scroll', updateFixedShadowVisibility, { passive: true });
    documentRef.defaultView?.addEventListener('resize', handleWindowResize, { passive: true });
    // 容器自身尺寸变化（侧栏折叠、栅格重排）不会触发 window.resize，
    // 用 ResizeObserver 覆盖这类场景，避免列宽缓存与阴影宽度停留在旧值。
    if (typeof ResizeObserver === 'function') {
      viewportResizeObserver = new ResizeObserver(function () { handleContainerResize(); });
      viewportResizeObserver.observe(viewport);
    }
    render();
    return api;
  }

  // Kniu 通用按钮：外观由属性驱动，内部始终使用原生 button。
  function registerButtonComponent() {
    if (typeof customElements === 'undefined' || typeof HTMLElement === 'undefined') return;
    if (customElements.get('kniu-btn')) return;
    class KniuSysButton extends HTMLElement {
      static get observedAttributes() {
        return ['size', 'type', 'plain', 'text', 'bg', 'link', 'round', 'circle', 'loading', 'loading-icon', 'disabled', 'icon', 'autofocus', 'native-type', 'auto-insert-space', 'color', 'dark', 'tag', 'block', 'unstyled'];
      }
      constructor() {
        super();
        attachComponentShadow(this);
        this.shadowRoot.innerHTML = `<style>:host{display:inline-flex;vertical-align:middle;flex-shrink:0}:host([block]){display:flex;width:100%}.kniu_sys_button{--kniu-button-color:#606266;--kniu-button-bg:#fff;--kniu-button-border:#dcdfe6;--kniu-button-hover-color:#409eff;--kniu-button-hover-bg:#ecf5ff;--kniu-button-hover-border:#c6e2ff;--kniu-button-active-bg:#ecf5ff;display:inline-flex;align-items:center;justify-content:center;gap:6px;box-sizing:border-box;min-height:32px;margin:0;padding:8px 15px;border:1px solid var(--kniu-button-border);border-radius:4px;outline:0;background-color:var(--kniu-button-bg);color:var(--kniu-button-color);font:500 14px/1 Arial,"Microsoft YaHei",sans-serif;text-decoration:none;white-space:nowrap;cursor:pointer;user-select:none;transition:.1s}.kniu_sys_button:hover,.kniu_sys_button:focus-visible{border-color:var(--kniu-button-hover-border);background-color:var(--kniu-button-hover-bg);color:var(--kniu-button-hover-color)}.kniu_sys_button:active{background-color:var(--kniu-button-active-bg);filter:brightness(.94)}.kniu_sys_button[data-type="primary"]{--kniu-button-color:#fff;--kniu-button-bg:#409eff;--kniu-button-border:#409eff;--kniu-button-hover-color:#fff;--kniu-button-hover-bg:#79bbff;--kniu-button-hover-border:#79bbff}.kniu_sys_button[data-type="success"]{--kniu-button-color:#fff;--kniu-button-bg:#67c23a;--kniu-button-border:#67c23a;--kniu-button-hover-color:#fff;--kniu-button-hover-bg:#95d475;--kniu-button-hover-border:#95d475}.kniu_sys_button[data-type="warning"]{--kniu-button-color:#fff;--kniu-button-bg:#e6a23c;--kniu-button-border:#e6a23c;--kniu-button-hover-color:#fff;--kniu-button-hover-bg:#eebe77;--kniu-button-hover-border:#eebe77}.kniu_sys_button[data-type="danger"]{--kniu-button-color:#fff;--kniu-button-bg:#f56c6c;--kniu-button-border:#f56c6c;--kniu-button-hover-color:#fff;--kniu-button-hover-bg:#f89898;--kniu-button-hover-border:#f89898}.kniu_sys_button[data-type="info"]{--kniu-button-color:#fff;--kniu-button-bg:#909399;--kniu-button-border:#909399;--kniu-button-hover-color:#fff;--kniu-button-hover-bg:#b1b3b8;--kniu-button-hover-border:#b1b3b8}.kniu_sys_button[data-plain="true"]{--kniu-button-color:var(--kniu-button-border);--kniu-button-bg:color-mix(in srgb,var(--kniu-button-border) 10%,#fff);--kniu-button-hover-color:#fff;--kniu-button-hover-bg:var(--kniu-button-border);--kniu-button-hover-border:var(--kniu-button-border)}.kniu_sys_button[data-type="default"][data-plain="true"]{--kniu-button-color:#606266;--kniu-button-bg:#fff;--kniu-button-border:#dcdfe6;--kniu-button-hover-color:#409eff;--kniu-button-hover-bg:#ecf5ff;--kniu-button-hover-border:#c6e2ff}.kniu_sys_button[data-text="true"],.kniu_sys_button[data-link="true"]{border-color:transparent;background-color:transparent;color:var(--kniu-button-border)}.kniu_sys_button[data-type="default"][data-text="true"],.kniu_sys_button[data-type="default"][data-link="true"]{color:#606266}.kniu_sys_button[data-text="true"]:hover{border-color:transparent;background-color:#f5f7fa}.kniu_sys_button[data-text="true"][data-bg="true"]{background-color:#f5f7fa}.kniu_sys_button[data-text="true"][data-bg="true"]:hover{background-color:#e9e9eb}.kniu_sys_button[data-unstyled="true"]{border:0;background-color:transparent;padding:0;margin:0;min-height:0;width:100%;justify-content:flex-start;color:inherit;font:inherit;border-radius:0}.kniu_sys_button[data-link="true"]{height:auto;min-height:0;padding:2px}.kniu_sys_button[data-link="true"]:hover,.kniu_sys_button[data-link="true"]:focus-visible{border-color:transparent;background-color:transparent;filter:brightness(.8)}.kniu_sys_button[data-size="large"]{min-height:40px;padding:12px 19px;font-size:14px}.kniu_sys_button[data-size="small"]{min-height:24px;padding:5px 11px;font-size:12px}.kniu_sys_button[data-round="true"]{border-radius:999px}.kniu_sys_button[data-circle="true"]{width:32px;height:32px;padding:0;border-radius:50%}.kniu_sys_button[data-circle="true"][data-size="large"]{width:40px;height:40px}.kniu_sys_button[data-circle="true"][data-size="small"]{width:24px;height:24px}.kniu_sys_button:disabled{border-color:#e4e7ed;background-color:#fff;color:#a8abb2;cursor:not-allowed;filter:none;opacity:.6}.kniu_sys_button[data-block="true"]{width:100%}.kniu_sys_button_icon:empty{display:none}.kniu_sys_button_loading{display:none;width:12px;height:12px;box-sizing:border-box;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:kniu_sys_button_spin .8s linear infinite}.kniu_sys_button_loading[class]:not([class="kniu_sys_button_loading"]){border:0;animation:none}.kniu_sys_button[data-loading="true"] .kniu_sys_button_loading{display:inline-block}.kniu_sys_button_label{display:inline-flex;align-items:center;gap:6px;min-width:0}.kniu_sys_button_label[data-auto-space="true"]{letter-spacing:.25em;margin-right:-.25em}@keyframes kniu_sys_button_spin{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){.kniu_sys_button_loading{animation:none}}</style><button class="kniu_sys_button" type="button"><span class="kniu_sys_button_loading" aria-hidden="true"></span><i class="kniu_sys_button_icon" aria-hidden="true"></i><span class="kniu_sys_button_label"><slot></slot></span></button>`;
        this._button = this.shadowRoot.querySelector('.kniu_sys_button');
        this._bindButton();
        this.shadowRoot.querySelector('slot').addEventListener('slotchange', () => this._syncAutoSpace());
        adoptSharedStyle(this.shadowRoot, '.kniu_sys_button_icon{display:inline-flex;align-items:center;justify-content:center}.kniu_sys_button_icon svg{display:block;width:1em;height:1em;fill:currentColor;overflow:visible}');
        adoptSharedStyle(this.shadowRoot, ':host([block]){height:100%}:host([block]) .kniu_sys_button{width:100%;height:100%}');
        adoptSharedStyle(this.shadowRoot, 'slot::slotted(kniu-icon){font-size:var(--kniu-button-icon-size,1em)}');
      }
      _bindButton() {
        this._icon = this._button.querySelector('.kniu_sys_button_icon');
        this._loadingIcon = this._button.querySelector('.kniu_sys_button_loading');
        this._label = this._button.querySelector('.kniu_sys_button_label');
        this._button.addEventListener('click', (event) => {
          if (this.hasAttribute('disabled') || this.hasAttribute('loading')) {
            event.preventDefault();
            event.stopImmediatePropagation();
            return;
          }
          if (this._button.type !== 'submit' || this._button.disabled) return;
          const form = this.closest('form') || this.closest('kniu-form')?.querySelector('form');
          if (!form) return;
          event.preventDefault();
          form.requestSubmit();
        });
      }
      connectedCallback() { this._sync(); }
      attributeChangedCallback() { if (this._button) this._sync(); }
      // 导航路径：纯属性写法 <kniu-btn nav="{{path}}"> 与 kniu:[nav] 等价，同时镜像到 data-nav 以兼容 dataset.nav 读取
      get nav() { return this._nav || ''; }
      set nav(value) {
        this._nav = value == null ? '' : String(value);
        if (this._nav) this.setAttribute('data-nav', this._nav);
        else this.removeAttribute('data-nav');
      }
      _syncTag() {
        const requested = (this.getAttribute('tag') || 'button').toLowerCase();
        const tag = /^[a-z][a-z0-9-]*$/.test(requested) ? requested : 'button';
        if (this._button.tagName.toLowerCase() === tag) return;
        const next = document.createElement(tag);
        [...this._button.attributes].forEach((attr) => next.setAttribute(attr.name, attr.value));
        while (this._button.firstChild) next.append(this._button.firstChild);
        this._button.replaceWith(next);
        this._button = next;
        this._bindButton();
      }
      _syncAutoSpace() {
        if (!this._label) return;
        const text = this.textContent.trim();
        this._label.dataset.autoSpace = String(this.hasAttribute('auto-insert-space') && /^[\u3400-\u9fff]{2}$/.test(text));
      }
      _sync() {
        this._syncTag();
        const type = ['primary', 'success', 'warning', 'danger', 'info'].includes(this.getAttribute('type')) ? this.getAttribute('type') : 'default';
        const requestedSize = this.getAttribute('size') || 'default';
        const size = requestedSize === 'medium' ? 'default' : (requestedSize === 'mini' ? 'small' : requestedSize);
        this._button.dataset.type = type;
        this._button.dataset.size = ['large', 'small'].includes(size) ? size : 'default';
        ['plain', 'text', 'bg', 'link', 'round', 'circle', 'loading', 'block', 'unstyled'].forEach((name) => {
          this._button.dataset[name] = String(this.hasAttribute(name));
        });
        if (this._button instanceof HTMLButtonElement) {
          this._button.type = this.getAttribute('native-type') || 'button';
          this._button.disabled = this.hasAttribute('disabled') || this.hasAttribute('loading');
          this._button.autofocus = this.hasAttribute('autofocus');
        } else {
          this._button.setAttribute('role', 'button');
          this._button.tabIndex = this.hasAttribute('disabled') ? -1 : 0;
          this._button.toggleAttribute('aria-disabled', this.hasAttribute('disabled') || this.hasAttribute('loading'));
        }
        const icon = (this.getAttribute('icon') || '').trim();
        const iconName = normalizeIconName(icon);
        if (iconName && KNIU_ICON_SET[iconName]) {
          this._icon.className = 'kniu_sys_button_icon kniu_sys_button_icon_glyph';
          this._icon.innerHTML = buildGlyphSvg(KNIU_ICON_SET[iconName]);
        } else {
          this._icon.className = `kniu_sys_button_icon${icon ? ` ${icon}` : ''}`;
          this._icon.innerHTML = '';
        }
        const loadingIcon = this.getAttribute('loading-icon') || '';
        this._loadingIcon.className = `kniu_sys_button_loading${loadingIcon ? ` ${loadingIcon}` : ''}`;
        const color = this.getAttribute('color') || '';
        if (color && CSS.supports('color', color)) {
          this._button.style.setProperty('--kniu-button-border', color);
          this._button.style.setProperty('--kniu-button-bg', this.hasAttribute('dark') ? `color-mix(in srgb,${color} 80%,#000)` : color);
          this._button.style.setProperty('--kniu-button-hover-border', `color-mix(in srgb,${color} 70%,#fff)`);
          this._button.style.setProperty('--kniu-button-hover-bg', `color-mix(in srgb,${color} 70%,#fff)`);
          this._button.style.setProperty('--kniu-button-color', '#fff');
          this._button.style.setProperty('--kniu-button-hover-color', '#fff');
        } else {
          ['--kniu-button-border', '--kniu-button-bg', '--kniu-button-hover-border', '--kniu-button-hover-bg', '--kniu-button-color', '--kniu-button-hover-color'].forEach((name) => this._button.style.removeProperty(name));
        }
        this._button.setAttribute('aria-busy', String(this.hasAttribute('loading')));
        this._syncAutoSpace();
      }
    }
    customElements.define('kniu-btn', KniuSysButton);
  }

  // Kniu Switch 开关。
  function registerSwitchComponent() {
    if (typeof customElements === 'undefined' || typeof HTMLElement === 'undefined') return;
    if (customElements.get('kniu-switch')) return;
    class KniuSysSwitch extends HTMLElement {
      // 2026-09-01：所有旧 attribute（disabled / width / active-value / inactive-value /
      // active-color / inactive-color / active-icon-class / inactive-icon-class /
      // active-text / inactive-text / name / validate-event）全部作废，只认 kniu:options。
      // 仅保留属性绑定透传：模板 `disabled="{{expr}}"` 走 property setter 写 _propDisabled。
      static get observedAttributes() {
        return [];
      }
      constructor() {
        super();
        attachComponentShadow(this);
        this._value = false;
        this._activeValue = undefined;
        this._inactiveValue = undefined;
        this._propDisabled = false;
        this._options = null;
        this.shadowRoot.innerHTML = `<style>:host{display:inline-block;vertical-align:middle;flex-shrink:0}.kniu_sys_switch_group{display:flex;width:100%;align-items:stretch}.kniu_sys_switch_content{flex:1;min-width:0;display:flex;align-items:center;justify-content:flex-start;padding:0 12px;background-color:#fff;box-sizing:border-box}.kniu_sys_switch_affix{display:none;align-items:center;justify-content:center;flex:none;padding:0 20px;border:1px solid #dcdfe6;background-color:#f5f7fa;color:#909399;font-size:14px;line-height:38px;text-align:center;white-space:nowrap;box-sizing:border-box}.kniu_sys_switch_group[data-affix="true"] .kniu_sys_switch_content{border:1px solid #dcdfe6}.kniu_sys_switch_group[data-has-prepend="true"] .kniu_sys_switch_prepend{display:flex;border-right:0;border-radius:4px 0 0 4px}.kniu_sys_switch_group[data-has-prepend="true"] .kniu_sys_switch_content{border-radius:0 4px 4px 0}.kniu_sys_switch_group[data-has-append="true"] .kniu_sys_switch_append{display:flex;border-left:0;border-radius:0 4px 4px 0}.kniu_sys_switch_group[data-affix="true"]{height:40px}.kniu_sys_switch_group:not([data-affix="true"]) .kniu_sys_switch_content{padding:0;background-color:transparent}.kniu_sys_switch{position:relative;display:inline-flex;align-items:center;gap:8px;color:#303133;font-size:14px;line-height:20px;cursor:pointer;user-select:none}.kniu_sys_switch_input{position:absolute;width:0;height:0;opacity:0}.kniu_sys_switch_core{position:relative;display:inline-block;box-sizing:border-box;height:20px;padding:0;border:1px solid transparent;border-radius:10px;background-color:#c0ccda;outline:0;cursor:pointer;transition:border-color .3s,background-color .3s}.kniu_sys_switch_button{position:absolute;top:1px;left:1px;width:16px;height:16px;border-radius:50%;background-color:#fff;transition:transform .3s}.kniu_sys_switch[data-active="true"] .kniu_sys_switch_button{transform:translateX(var(--kniu-switch-distance))}.kniu_sys_switch_text{white-space:nowrap}.kniu_sys_switch_icon{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px}.kniu_sys_switch_icon:empty{display:none}.kniu_sys_switch[data-disabled="true"]{opacity:.6;cursor:not-allowed}.kniu_sys_switch_input:focus-visible+.kniu_sys_switch_core{outline:2px solid rgba(64,158,255,.35);outline-offset:2px}</style><div class="kniu_sys_switch_group" data-affix="false" data-has-prepend="false" data-has-append="false"><span class="kniu_sys_switch_affix kniu_sys_switch_prepend"><slot name="prepend"></slot></span><div class="kniu_sys_switch_content"><label class="kniu_sys_switch" data-active="false" data-disabled="false"><span class="kniu_sys_switch_text kniu_sys_switch_inactive_text"></span><input class="kniu_sys_switch_input" type="checkbox"><button class="kniu_sys_switch_core" type="button"><span class="kniu_sys_switch_button"></span><i class="kniu_sys_switch_icon"></i></button><span class="kniu_sys_switch_text kniu_sys_switch_active_text"></span></label></div><span class="kniu_sys_switch_affix kniu_sys_switch_append"><slot name="append"></slot></span></div>`;
        this._root = this.shadowRoot.querySelector('.kniu_sys_switch');
        this._input = this.shadowRoot.querySelector('.kniu_sys_switch_input');
        this._core = this.shadowRoot.querySelector('.kniu_sys_switch_core');
        this._icon = this.shadowRoot.querySelector('.kniu_sys_switch_icon');
        this._core.addEventListener('click', (event) => {
          // 轨道是 label 内的独立 button，浏览器不会像点击 label 空白处那样
          // 稳定激活关联的 checkbox。显式转发给 input，让唯一的 change 链路
          // 负责更新 value、重绘和对外派发事件，避免双次切换。
          event.preventDefault();
          if (!this.disabled) this._input.click();
        });
        this._input.addEventListener('change', () => {
          this._value = this._input.checked ? this.activeValue : this.inactiveValue;
          this._sync();
          // 同时派 change 和 input（composed 让光层 listener 也能收到）：
          // - change：保留对历史上用 `kniu@change="..."` 的旧调用方的兼容；
          // - input：让 `kniu:model` 双向绑定能够把当前值写回路径（双向绑定的监听器是 `input`）。
          const value = this._value;
          this.dispatchEvent(new CustomEvent('change', { detail: value, bubbles: true, composed: true }));
          this.dispatchEvent(new CustomEvent('input', { detail: value, bubbles: true, composed: true }));
        });
      }
      connectedCallback() {
        this._mountAffixes();
        this._sync();
      }
      attributeChangedCallback() { if (this._root) this._sync(); }
      _mountAffixes() {
        mountAffixSlots(this, '.kniu_sys_switch_group', 'kniu_sys_switch');
        const group = this.shadowRoot.querySelector('.kniu_sys_switch_group');
        if (group.dataset.affix !== 'true') return;
        this.style.display = 'block';
        this.style.width = '100%';
      }
      get activeValue() {
        if (this._activeValue !== undefined) return this._activeValue;
        if (this._options && this._options.activeValue !== undefined) return this._options.activeValue;
        return true;
      }
      set activeValue(value) { this._activeValue = value; this._sync(); }
      get inactiveValue() {
        if (this._inactiveValue !== undefined) return this._inactiveValue;
        if (this._options && this._options.inactiveValue !== undefined) return this._options.inactiveValue;
        return false;
      }
      set inactiveValue(value) { this._inactiveValue = value; this._sync(); }
      get value() { return this._value; }
      set value(value) { this._value = value; this._sync(); }
      get disabled() { return (this._options && this._options.disabled === true) || this._propDisabled === true; }
      set disabled(value) { this._propDisabled = !!value; this._sync(); }
      // kniu:options 统一配置入口（2026-09-01）：activeValue / inactiveValue / activeColor /
      // inactiveColor / disabled / width / activeText / inactiveText / activeIconClass /
      // inactiveIconClass / name 全部收进 options；旧 attribute 一律作废。
      set options(value) {
        this._options = value && typeof value === 'object' ? value : null;
        this._sync();
      }
      get options() { return this._options; }
      _cfg(key, fallback) {
        const o = this._options || {};
        return (o[key] !== undefined && o[key] !== null) ? o[key] : fallback;
      }
      focus() { this._input.focus(); }
      _isActive() { return this._value === this.activeValue || String(this._value) === String(this.activeValue); }
      _sync() {
        const active = this._isActive();
        const disabled = this.disabled;
        const width = Math.max(20, Number.parseInt(this._cfg('width', 40), 10) || 40);
        this._root.dataset.active = String(active);
        this._root.dataset.disabled = String(disabled);
        this._input.checked = active;
        this._input.disabled = disabled;
        this._core.disabled = disabled;
        this._input.name = String(this._cfg('name', ''));
        this._core.style.width = `${width}px`;
        this._core.style.backgroundColor = active ? String(this._cfg('activeColor', '#409EFF')) : String(this._cfg('inactiveColor', '#C0CCDA'));
        this._root.style.setProperty('--kniu-switch-distance', `${width - 20}px`);
        const iconClass = active ? String(this._cfg('activeIconClass', '')) : String(this._cfg('inactiveIconClass', ''));
        this._icon.className = `kniu_sys_switch_icon${iconClass ? ` ${iconClass}` : ''}`;
        this.shadowRoot.querySelector('.kniu_sys_switch_active_text').textContent = iconClass ? '' : String(this._cfg('activeText', ''));
        this.shadowRoot.querySelector('.kniu_sys_switch_inactive_text').textContent = iconClass ? '' : String(this._cfg('inactiveText', ''));
        this.setAttribute('role', 'switch');
        this.setAttribute('aria-checked', String(active));
        this.setAttribute('aria-disabled', String(disabled));
      }
    }
    customElements.define('kniu-switch', KniuSysSwitch);
  }

  function registerModalComponent() {
    if (typeof customElements === 'undefined' || typeof HTMLElement === 'undefined') return;
    if (customElements.get('kniu-modal')) return;

    const GENERIC_HTML = '<style>'
      + ':host{position:fixed;inset:0;z-index:2000;display:none}'
      + ':host([show="true"]){display:block!important}'
      + '.kniu_modal_mask{position:absolute;inset:0;background-color:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;animation:kniu_modal_mask_in .25s ease both}'
      + '.kniu_modal_dialog{position:relative;width:var(--kniu-modal-width,auto);min-width:320px;max-width:100%;background-color:#fff;border-radius:6px;box-shadow:0 2px 12px rgba(0,0,0,.18);display:flex;flex-direction:column;max-height:90vh;overflow:visible;animation:kniu_modal_box_in .25s cubic-bezier(.25,.8,.25,1)}'
      + '.kniu_modal_header{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid #ebeef5;font-size:16px;font-weight:600;color:#303133;flex:none}'
      + '.kniu_modal_header slot::slotted(kniu-btn){--kniu-button-icon-size:24px}'
      + '.kniu_modal_body{padding:20px 24px;overflow:auto;flex:1 1 auto;box-sizing:border-box}'
      + '.kniu_modal_footer{padding:12px 20px;border-top:1px solid #ebeef5;text-align:right;flex:none}'
      + '.kniu_modal_footer kniu-btn{margin-left:12px}'
      + '@keyframes kniu_modal_mask_in{0%{opacity:0}100%{opacity:1}}@keyframes kniu_modal_box_in{0%{transform:translateY(-20px);opacity:0}100%{transform:translateY(0);opacity:1}}'
      + '@keyframes kniu_modal_mask_out{0%{opacity:1}100%{opacity:0}}@keyframes kniu_modal_box_out{0%{transform:translateY(0);opacity:1}100%{transform:translateY(-20px);opacity:0}}'
      + ':host([closing]) .kniu_modal_mask{animation:kniu_modal_mask_out .22s ease both}:host([closing]) .kniu_modal_dialog{animation:kniu_modal_box_out .22s cubic-bezier(.25,.8,.25,1) both}'
      + '@media (prefers-reduced-motion:reduce){.kniu_modal_mask,.kniu_modal_dialog{animation:none}}</style>'
      + '<div class="kniu_modal_mask" part="mask"><div class="kniu_modal_dialog" part="dialog">'
      + '<div class="kniu_modal_header"><slot name="header"></slot></div>'
      + '<div class="kniu_modal_body"><slot name="default"></slot></div>'
      + '<div class="kniu_modal_footer"><slot name="footer"></slot></div>'
      + '</div></div>';

    const CONFIRM_HTML = '<style>'
      + ':host{position:fixed;inset:0;z-index:2000;display:none}'
      + ':host([show="true"]){display:block!important}'
      + '.kniu_modal_mask{position:absolute;inset:0;background-color:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;animation:kniu_modal_mask_in .25s ease both}'
      + '.kniu_modal_dialog{position:relative;width:var(--kniu-modal-width,auto);min-width:320px;max-width:100%;background-color:#fff;border-radius:4px;box-shadow:0 2px 12px rgba(0,0,0,.1);display:flex;flex-direction:column;overflow:hidden;animation:kniu_modal_box_in .25s cubic-bezier(.25,.8,.25,1) both}'
      + '.kniu_modal_header{position:relative;padding:15px 15px 10px;flex:none}'
      + '.kniu_modal_confirm_title{margin:0;padding-right:40px;color:#303133;font-size:18px;font-weight:400;line-height:1}'
      + '.kniu_modal_close{position:absolute;top:0;right:6px;display:flex;align-items:center;justify-content:center;width:44px;height:44px;padding:0;border:0;background-color:transparent;color:#909399;cursor:pointer}'
      + '.kniu_modal_close svg{display:block;width:26px;height:26px;fill:currentColor}'
      + '.kniu_modal_close:hover{color:#409eff}'
      + '.kniu_modal_body{display:flex;align-items:flex-start;padding:10px 15px 15px;color:#606266;font-size:14px;flex:none}'
      + '.kniu_modal_confirm_icon{flex:none;margin-right:10px;font-size:24px;line-height:24px}'
      + '.kniu_modal_confirm_message{margin:0;line-height:24px}'
      + '.kniu_modal_footer{padding:10px 15px 15px;text-align:right;flex:none}'
      + '.kniu_modal_footer kniu-btn{margin-left:12px}'
      + '@keyframes kniu_modal_mask_in{0%{opacity:0}100%{opacity:1}}@keyframes kniu_modal_box_in{0%{transform:translateY(-20px);opacity:0}100%{transform:translateY(0);opacity:1}}'
      + '@keyframes kniu_modal_mask_out{0%{opacity:1}100%{opacity:0}}@keyframes kniu_modal_box_out{0%{transform:translateY(0);opacity:1}100%{transform:translateY(-20px);opacity:0}}'
      + ':host([closing]) .kniu_modal_mask{animation:kniu_modal_mask_out .22s ease both}:host([closing]) .kniu_modal_dialog{animation:kniu_modal_box_out .22s cubic-bezier(.25,.8,.25,1) both}'
      + '@media (prefers-reduced-motion:reduce){.kniu_modal_mask,.kniu_modal_dialog{animation:none}}</style>'
      + '<div class="kniu_modal_mask" part="mask"><div class="kniu_modal_dialog" part="dialog">'
      + '<div class="kniu_modal_header"><h4 class="kniu_modal_confirm_title"></h4><button class="kniu_modal_close" type="button" aria-label="关闭"><svg viewBox="0 0 1024 1024" aria-hidden="true" focusable="false"><path fill="currentColor" d="M764.3 214.6 512 466.9 259.7 214.6a32 32 0 0 0-45.1 45.1L466.8 512 214.5 764.2a32 32 0 1 0 45.1 45.2L512 557.2l252.3 252.3a32 32 0 0 0 45.1-45.1L557.1 512l252.3-252.4a32 32 0 1 0-45.1-45.2z"/></svg></button></div>'
      + '<div class="kniu_modal_body"><span class="kniu_modal_confirm_icon"></span><p class="kniu_modal_confirm_message"></p></div>'
      + '<div class="kniu_modal_footer"><kniu-btn class="kniu_modal_cancel">取消</kniu-btn><kniu-btn type="primary" class="kniu_modal_confirm">确定</kniu-btn></div>'
      + '</div></div>';

    class KniuModal extends HTMLElement {
      static get observedAttributes() { return ['show', 'mask', 'mask-alpha', 'mask-close', 'scrollbar', 'width', 'title', 'message', 'confirm-text', 'cancel-text', 'type', 'show-close']; }
      constructor() {
        super();
        this._confirmMode = false;
        this._title = '';
        this._message = '';
        this._confirmText = '';
        this._cancelText = '';
        this._type = '';
        this._closeTimer = null;
        this._prevBodyOverflow = undefined;
        this._handleKeydown = (e) => { if (e.key === 'Escape') this._onEscape(); };
        attachComponentShadow(this);
      }
      connectedCallback() {
        this._render();
        document.addEventListener('keydown', this._handleKeydown);
      }
      disconnectedCallback() {
        document.removeEventListener('keydown', this._handleKeydown);
      }
      attributeChangedCallback(name) {
        if (name === 'width') { this._syncWidth(); }
        else if (name === 'mask' || name === 'mask-alpha') { this._applyMask(); }
        else if (name === 'scrollbar') { if (this.getAttribute('show') === 'true') this._lockScrollbar(); }
        else if (name === 'title' || name === 'message' || name === 'confirm-text' || name === 'cancel-text' || name === 'type') {
          if (this._confirmMode) this._fillConfirm();
        }
      }
      // show：true=显示（打开），false=隐藏（关闭）。show 为自定义属性，不会被原生 hidden 的 property 语义干扰。
      get show() { return this.getAttribute('show') === 'true'; }
      set show(val) { if (val) this.open(); else this._requestClose(); }
      get confirm() { return this._confirmMode; }
      set confirm(val) { this._confirmMode = !!val; }
      get title() { return this._title || this.getAttribute('title') || ''; }
      set title(val) { this._title = val; if (this._confirmMode && this.shadowRoot) this._fillConfirm(); }
      get message() { return this._message || this.getAttribute('message') || ''; }
      set message(val) { this._message = val; if (this._confirmMode && this.shadowRoot) this._fillConfirm(); }
      get confirmText() { return this._confirmText || this.getAttribute('confirm-text') || ''; }
      set confirmText(val) { this._confirmText = val; if (this._confirmMode && this.shadowRoot) this._fillConfirm(); }
      get cancelText() { return this._cancelText || this.getAttribute('cancel-text') || ''; }
      set cancelText(val) { this._cancelText = val; if (this._confirmMode && this.shadowRoot) this._fillConfirm(); }
      get type() { return this._type || this.getAttribute('type') || ''; }
      set type(val) { this._type = val; if (this._confirmMode && this.shadowRoot) this._fillConfirm(); }
      open() {
        if (this._closeTimer) { clearTimeout(this._closeTimer); this._closeTimer = null; }
        this.removeAttribute('closing');
        this.setAttribute('show', 'true');
        this._applyMask();
        this._lockScrollbar();
      }
      close() {
        this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
        this._requestClose();
      }
      // 退出动画：先把 host 维持在 display:block 并打 closing 标记播放反向动画，
      // 动画结束（或 reduced-motion 立即、或超时兜底）后再真正隐藏 host。
      _requestClose() {
        if (this.getAttribute('show') !== 'true') return;
        const finalize = () => {
          if (this._closeTimer) { clearTimeout(this._closeTimer); this._closeTimer = null; }
          this.setAttribute('show', 'false');
          this.removeAttribute('closing');
          this._unlockScrollbar();
        };
        const reduce = (typeof matchMedia !== 'undefined') && matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduce) { finalize(); return; }
        this.setAttribute('closing', '');
        this._closeTimer = setTimeout(finalize, 280);
        const dialog = this.shadowRoot && this.shadowRoot.querySelector('.kniu_modal_dialog');
        if (dialog) {
          const onEnd = (e) => {
            if (e.animationName && e.animationName.indexOf('out') !== -1 && this.hasAttribute('closing')) {
              dialog.removeEventListener('animationend', onEnd);
              finalize();
            }
          };
          dialog.addEventListener('animationend', onEnd);
        }
      }
      _render() {
        this.shadowRoot.innerHTML = this._confirmMode ? CONFIRM_HTML : GENERIC_HTML;
        this._syncWidth();
        this._applyMask();
        if (this._confirmMode) {
          this._fillConfirm();
          this.shadowRoot.querySelector('.kniu_modal_close')?.addEventListener('click', () => this._cancel());
          this.shadowRoot.querySelector('.kniu_modal_cancel')?.addEventListener('click', () => this._cancel());
          this.shadowRoot.querySelector('.kniu_modal_confirm')?.addEventListener('click', () => this._confirm());
          this.shadowRoot.querySelector('.kniu_modal_mask')?.addEventListener('click', (e) => {
            if (e.target === this.shadowRoot.querySelector('.kniu_modal_mask') && this._maskClose()) this._cancel();
          });
        } else {
          this.shadowRoot.querySelector('.kniu_modal_mask')?.addEventListener('click', (e) => {
            if (e.target === this.shadowRoot.querySelector('.kniu_modal_mask') && this._maskClose()) this.close();
          });
        }
      }
      _syncWidth() {
        // 兼容两种写法：width 属性（推荐）或内联 style.width。
        // 内联 width 会被迁移到 --kniu-modal-width 并清空，避免它把 host 撑成指定宽度、破坏全屏遮罩。
        const attrW = this.getAttribute('width');
        const inlineW = (this.style && this.style.width) || '';
        const w = attrW || inlineW;
        if (w) {
          this.style.setProperty('--kniu-modal-width', w);
          if (!attrW && inlineW) this.style.width = '';
        }
      }
      // 蒙版：mask 控制是否启用半透明蒙版（默认 true）；mask-alpha 控制蒙版透明度（默认 0.6，范围 0~1）。
      _applyMask() {
        const maskEl = this.shadowRoot && this.shadowRoot.querySelector('.kniu_modal_mask');
        if (!maskEl) return;
        const maskOn = (this.getAttribute('mask') || 'true') !== 'false';
        if (!maskOn) { maskEl.style.backgroundColor = 'transparent'; return; }
        const alpha = parseFloat(this.getAttribute('mask-alpha'));
        const a = isNaN(alpha) ? 0.6 : Math.min(1, Math.max(0, alpha));
        maskEl.style.backgroundColor = 'rgba(0,0,0,' + a + ')';
      }
      // 滚动条：scrollbar 控制模态框开启时是否允许浏览器滚动条（默认 true）；false 时锁定 body 滚动。
      _lockScrollbar() {
        if ((this.getAttribute('scrollbar') || 'true') === 'false') {
          this._prevBodyOverflow = document.body.style.overflow;
          document.body.style.overflow = 'hidden';
        }
      }
      _unlockScrollbar() {
        if (this._prevBodyOverflow !== undefined) {
          document.body.style.overflow = this._prevBodyOverflow;
          this._prevBodyOverflow = undefined;
        }
      }
      // 点击蒙版关闭：默认【不允许】关闭；仅显式 mask-close="true" 开启；
      // 旧别名 close-on-click-modal="true" / modal="true" 仍兼容。
      _maskClose() {
        const mc = this.getAttribute('mask-close');
        if (mc !== null) return mc === 'true';
        const a = this.getAttribute('close-on-click-modal');
        if (a !== null) return a === 'true';
        const m = this.getAttribute('modal');
        if (m !== null) return m === 'true';
        return false;
      }
      _fillConfirm() {
        if (!this.shadowRoot) return;
        const type = ['success', 'warning', 'info', 'error'].includes(this.type) ? this.type : 'warning';
        const ICON = { success: '✓', warning: '⚠', info: 'ℹ', error: '×' };
        const COLOR = { success: '#67c23a', warning: '#e6a23c', info: '#909399', error: '#f56c6c' };
        const t = this.shadowRoot.querySelector('.kniu_modal_confirm_title');
        const m = this.shadowRoot.querySelector('.kniu_modal_confirm_message');
        const i = this.shadowRoot.querySelector('.kniu_modal_confirm_icon');
        const c = this.shadowRoot.querySelector('.kniu_modal_cancel');
        const cf = this.shadowRoot.querySelector('.kniu_modal_confirm');
        const close = this.shadowRoot.querySelector('.kniu_modal_close');
        if (t) t.textContent = this.title || '提示';
        if (m) m.textContent = this.message || '';
        if (i) { i.textContent = ICON[type]; i.style.color = COLOR[type]; }
        if (c) c.textContent = this.cancelText || '取消';
        if (cf) cf.textContent = this.confirmText || '确定';
        if (close) close.style.display = this.getAttribute('show-close') === 'false' ? 'none' : '';
      }
      _confirm() { this.dispatchEvent(new CustomEvent('confirm', { bubbles: true, composed: true })); this.show = false; }
      _cancel() { this.dispatchEvent(new CustomEvent('cancel', { bubbles: true, composed: true })); this.show = false; }
      _onEscape() {
        if (!this.show) return;
        if (this._confirmMode) this._cancel();
        else this.close();
      }
    }
    customElements.define('kniu-modal', KniuModal);
  }

  function confirm(message, title = '提示', options = {}) {
    if (typeof document === 'undefined') return Promise.resolve(false);
    registerModalComponent();
    const modal = document.createElement('kniu-modal');
    modal.confirm = true;
    if (options.width) modal.setAttribute('width', options.width);
    // 未指定宽度时不设置 --kniu-modal-width：dialog 默认 auto 宽度（按内容自适应，最小 320px）
    modal.title = title;
    modal.message = message;
    if (options.confirmButtonText) modal.confirmText = options.confirmButtonText;
    if (options.cancelButtonText) modal.cancelText = options.cancelButtonText;
    if (options.type) modal.type = options.type;
    // 默认不允许点击蒙版关闭；仅显式 closeOnClickModal===true 时开启
    if (options.closeOnClickModal === true) modal.setAttribute('mask-close', 'true');
    document.body.append(modal);
    modal.show = true;
    return new Promise((resolve, reject) => {
      const onConfirm = () => { cleanup(); resolve('confirm'); };
      const onCancel = () => { cleanup(); reject('cancel'); };
      function cleanup() {
        modal.removeEventListener('confirm', onConfirm);
        modal.removeEventListener('cancel', onCancel);
        setTimeout(() => { if (modal.parentNode) modal.remove(); }, 320);
      }
      modal.addEventListener('confirm', onConfirm);
      modal.addEventListener('cancel', onCancel);
    });
  }

  // 数据驱动表格组件：通过 config/data property 接收数据，无需业务层查找 DOM。
  function registerTableComponent() {
    if (typeof customElements === 'undefined' || typeof HTMLElement === 'undefined') return;
    if (!customElements.get('kniu-table-col')) {
      class KniuSysTableColumn extends HTMLElement {
        constructor() {
          super();
          attachComponentShadow(this);
          this.shadowRoot.innerHTML = '<slot></slot>';
        }
        set onChange(value) { this._onChange = typeof value === 'function' ? value : null; }
        get onChange() { return this._onChange; }
        set formatter(value) { this._formatter = typeof value === 'function' ? value : null; }
        get formatter() { return this._formatter; }
        set sortMethod(value) { this._sortMethod = typeof value === 'function' ? value : null; }
        get sortMethod() { return this._sortMethod; }
        set selectable(value) { this._selectable = typeof value === 'function' ? value : null; }
        get selectable() { return this._selectable; }
      }
      customElements.define('kniu-table-col', KniuSysTableColumn);
    }
    if (customElements.get('kniu-table')) return;

    class KniuSysTable extends HTMLElement {
      // 2026-09-01：kniu-table 自身旧 attribute（height / max-height / stripe / border /
      // size / fit / show-header / highlight-current-row / row-key / empty-text）全部作废，
      // 唯一配置入口为 kniu:options；列定义来自 options.cols。
      static get observedAttributes() {
        return [];
      }
      constructor() {
        super();
        attachComponentShadow(this);
        this._config = {};
        this._table = null;
        this._columns = [];
        this._columnDefinitionsCleared = false;
        this._loading = false;
        this._loadingText = '';
        this._renderQueued = false;
      }

      connectedCallback() {
        this._queueRender();
      }

      attributeChangedCallback() {
        if (this.isConnected) this._queueRender();
      }

      disconnectedCallback() {
        this._destroyTable();
      }

      set config(value) {
        this._config = value && typeof value === 'object' ? value : null;
        if (this.isConnected) this._queueRender();
      }

      get config() {
        return this._config;
      }

      set tableConfig(value) {
        this.config = value;
      }

      get tableConfig() {
        return this.config;
      }

      // kniu:options 统一配置入口（2026-09-01）：data / rowKey / stripe / border / size / fit /
      // showHeader / highlightCurrentRow / emptyText / height / maxHeight 全部收进 options；
      // 旧 attribute 一律作废。options 对象整体替换即触发刷新（响应式通知 + 本 setter）。
      set options(value) {
        const opts = value && typeof value === 'object' ? value : {};
        if (!this._config) this._config = {};
        this._config = { ...this._config, ...opts };
        if (Object.hasOwn(opts, 'loading')) this._loading = !!opts.loading;
        if (Object.hasOwn(opts, 'loadingText')) this._loadingText = opts.loadingText == null ? '' : String(opts.loadingText);
        if (this._table) this._table.setLoading(this._loading, this._loadingText);
        if (this._table && Object.hasOwn(opts, 'maxHeight')) this._table.setMaxHeight(opts.maxHeight);
        if (Array.isArray(opts.data)) {
          if (this._table) {
            // 列模板 content 内 switch 的 kniu:options 在 applyBindings 同步块内才写入 expando，
            // 而首次 _readColumns（connectedCallback 的 microtask）早于绑定执行 → 快照为 null。
            // 整体替换 options 时延迟到 microtask 重读列定义再 setData，让行内开关拿到配置；
            // 重读走 _columnElements 缓存（列定义可能已被 _clearColumnDefinitions 移除）。
            queueMicrotask(() => {
              this._readColumns();
              if (this._table) this._table.setData(this._config.data || []);
            });
          } else if (this.isConnected) this._queueRender();
        } else if (this.isConnected) this._queueRender();
        this._clearColumnDefinitions();
      }
      get options() {
        return this._config;
      }

      set data(value) {
        if (!this._config) this._config = {};
        this._config.data = Array.isArray(value) ? value : [];
        if (this._table) this._table.setData(this._config.data);
        else if (this.isConnected) this._queueRender();
        this._clearColumnDefinitions();
      }

      get data() {
        return this._config?.data || [];
      }

      // 区域加载遮罩开关与文案（由 kniutemplate 的 kniu:loading 指令委托驱动，
      // 或控制器直接 set）。遮罩在 createTable 内部、shadowRoot 的 group 内渲染，
      // 不往光层塞节点（光层无 <slot> 不可见）。表重建后状态自动重放。
      set loading(value) {
        this._loading = !!value;
        if (this._table) this._table.setLoading(this._loading, this._loadingText);
      }
      get loading() {
        return this._loading;
      }
      set loadingText(value) {
        this._loadingText = value == null ? '' : String(value);
        if (this._table) this._table.setLoading(this._loading, this._loadingText);
      }
      get loadingText() {
        return this._loadingText;
      }

      _clearColumnDefinitions() {
        if (this._columnDefinitionsCleared || !this._columns.length) return;
        this._columnDefinitionsCleared = true;
        queueMicrotask(() => {
          this.querySelectorAll(':scope > kniu-table-col').forEach(function (column) {
            column.remove();
          });
        });
      }

      _readColumns() {
        // 列定义可能已被 _clearColumnDefinitions 移除（options/data 后续更新时重读），
        // 此时回退到首次读取缓存的列元素引用。
        let columnElements = [...this.querySelectorAll(':scope > kniu-table-col')];
        if (!columnElements.length && this._columnElements && this._columnElements.length) {
          columnElements = this._columnElements;
        }
        if (!columnElements.length) return;
        this._columnElements = columnElements;
        const columns = columnElements.map((element) => {
          const fixedAttribute = element.getAttribute('fixed');
          const template = element.querySelector('template');
          const imageElement = template?.content.querySelector('kniu-image');
          const tagElement = template?.content.querySelector('kniu-tag');
          const statusElement = template?.content.querySelector('kniu-status');
          const column = {
            type: element.getAttribute('type') || 'default',
            field: element.getAttribute('field') || '',
            label: element.getAttribute('label') || '',
            width: element.getAttribute('width') || (element.style && element.style.width) || '',
            minWidth: element.getAttribute('min-width') || '',
            align: ['left', 'center', 'right'].includes(element.getAttribute('align'))
              ? element.getAttribute('align')
              : ((element.style && element.style.textAlign) || 'left'),
            headerAlign: ['left', 'center', 'right'].includes(element.getAttribute('header-align')) ? element.getAttribute('header-align') : '',
            showOverflowTooltip: element.hasAttribute('show-overflow-tooltip'),
            sortable: element.hasAttribute('sortable'),
            sortMethod: element.sortMethod,
            formatter: element.formatter,
            selectable: element.selectable,
            index: element.getAttribute('index') || 1,
            editable: element.hasAttribute('editable')
              ? (element.getAttribute('editable') === 'number' ? 'number'
                : element.getAttribute('editable') === 'text' ? 'text'
                : element.getAttribute('editable') !== 'false')
              : false,
            editMin: element.hasAttribute('edit-min') ? Number(element.getAttribute('edit-min')) : null,
            image: imageElement ? {
              attributes: Object.fromEntries([...imageElement.attributes].map(function (attribute) {
                return [attribute.name, attribute.value];
              })),
              width: imageElement.style.width || '80px',
              height: imageElement.style.height || '80px'
            } : null,
            tag: tagElement ? {
              attributes: Object.fromEntries([...tagElement.attributes].map(function (attribute) {
                return [attribute.name, attribute.value === '' ? true : attribute.value];
              }))
            } : null,
            status: statusElement ? {
              attributes: Object.fromEntries([...statusElement.attributes].map(function (attribute) {
                return [attribute.name, attribute.value === '' ? true : attribute.value];
              }))
            } : null,
            onChange: (...args) => {
              if (typeof element.onChange === 'function') return element.onChange(...args);
              return true;
            },
            fixed: element.hasAttribute('fixed')
              ? (String(fixedAttribute).toLowerCase() === 'right' ? 'right' : 'left')
              : false
          };
          const buttons = [
            ...element.querySelectorAll(':scope > kniu-btn'),
            ...(template ? template.content.querySelectorAll('kniu-btn') : [])
          ].filter(function (button) {
            return !button.hasAttribute('data-kniu-if') || button.getAttribute('data-kniu-if') === 'true';
          });
          const switchElement = element.querySelector(':scope > kniu-switch')
            || template?.content.querySelector('kniu-switch');
          if (switchElement) {
            // 列内 kniu-switch 统一走 kniu:options：模板 content 内节点未被框架以 property 赋值时
            // （未插入文档 → 自定义元素未升级 → 无 options property），框架会把配置存到
            // __kniuOptionsValue expando（见 kniutemplate 的 kniu:options 绑定），此处两者都读。
            // createTable 重建行内开关时整体赋回，旧 attribute 快照机制已作废。
            const switchConfig = (switchElement && typeof switchElement.options === 'object' && switchElement.options)
              || (switchElement && switchElement.__kniuOptionsValue && typeof switchElement.__kniuOptionsValue === 'object' ? switchElement.__kniuOptionsValue : null);
            column.switch = {
              options: switchConfig,
              onChange: (index, rows, value) => {
                // 处理器来自模板内 kniu-switch 的 kniu@change：框架在列被 kniu:if / kniu:for clone 后
                // 会把 handler 重新绑定到克隆节点 / 克隆列宿主自身（见 kniutemplate 的 tableScopedControl
                // 分支，刻意保留 kniu@change 属性以便克隆列重新解析），故此处直接读取克隆后的节点即可。
                const handler = element.__kniuTableScopedSwitchHandler
                  || switchElement.__kniuTableScopedHandler;
                if (typeof handler === 'function') return handler(index, rows, value);
                // 列级 on-change 不依赖 template 内节点的 expando，条件列被
                // cloneNode() 重建后仍能稳定调用业务提交函数。
                if (typeof element.onChange === 'function') return element.onChange(index, rows, value);
                return true;
              }
            };
          }
          if (buttons.length) {
            column.actions = buttons.map(function (button) {
              return {
                title: button.textContent.trim() || '操作',
                className: button.getAttribute('class') || '',
                type: button.getAttribute('type') || '',
                size: button.getAttribute('size') || '',
                plain: button.hasAttribute('plain'),
                text: button.hasAttribute('text'),
                bg: button.hasAttribute('bg'),
                link: button.hasAttribute('link'),
                round: button.hasAttribute('round'),
                circle: button.hasAttribute('circle'),
                disabled: button.hasAttribute('disabled'),
                condition: button.hasAttribute('kniu:if') ? button.getAttribute('kniu:if') : null,
                icon: button.getAttribute('icon') || '',
                onClick: ({ index, rows }) => {
                  const handler = button.__kniuTableScopedHandler;
                  if (typeof handler === 'function') return handler(index, rows);
                  return false;
                }
              };
            });
          }
          return column;
        });
        // 原地替换数组内容：_renderTable 已把 this._columns 引用传给 createTable，
        // 重读（options 更新时）必须让既有表格实例看到新列定义，不能替换引用。
        this._columns.length = 0;
        this._columns.push(...columns);
      }

      _destroyTable() {
        if (!this._table) return;
        this._table.destroy();
        this._table = null;
      }

      _queueRender() {
        if (this._renderQueued) return;
        this._renderQueued = true;
        queueMicrotask(() => {
          this._renderQueued = false;
          if (this.isConnected) this._renderTable();
        });
      }

      _renderTable() {
        this._readColumns();
        const columns = this._columns.length ? this._columns : this._config?.cols;
        if (!Array.isArray(columns) || !columns.length) return;
        this._destroyTable();
        const cfg = this._config || {};
        this._table = createTable({
          ...cfg,
          cols: columns,
          data: this.data,
          host: this,
          height: cfg.height,
          maxHeight: cfg.maxHeight ?? this.style.maxHeight,
          stripe: cfg.stripe === true,
          border: cfg.border === true,
          size: cfg.size || 'default',
          fit: cfg.fit !== false,
          showHeader: cfg.showHeader !== false,
          highlightCurrentRow: cfg.highlightCurrentRow === true,
          rowKey: cfg.rowKey || '',
          emptyText: cfg.emptyText ?? '暂无数据',
          emptySlot: !!this.querySelector('[slot="empty"]'),
          loading: this._loading,
          loadingText: this._loadingText,
          el: this.shadowRoot
        });
      }

      clearSelection() { return this._table?.clearSelection(); }
      refreshColumns() {
        if (this.isConnected) this._renderTable();
      }
      getSelectionRows() { return this._table?.getSelectionRows() || []; }
      toggleRowSelection(row, selected) { return this._table?.toggleRowSelection(row, selected); }
      setCurrentRow(row) { return this._table?.setCurrentRow(row); }
      sort(field, order) { return this._table?.sort(field, order); }
      clearSort() { return this._table?.clearSort(); }
      doLayout() { return this._table?.doLayout(); }
    }

    customElements.define('kniu-table', KniuSysTable);
  }

  function registerLoadingComponent() {
    if (typeof customElements === 'undefined' || typeof HTMLElement === 'undefined') return;
    if (customElements.get('kniu-loading')) return;
    class KniuSysLoading extends HTMLElement {
      constructor() {
        super();
        attachComponentShadow(this);
        this._show = false;
        this.shadowRoot.innerHTML = `<style>:host{position:fixed;inset:0;z-index:2147483647;display:block;pointer-events:none}:host([contained]){position:absolute;z-index:50}.kniu_sys_loading_mask{position:absolute;inset:0;display:grid;place-items:center;opacity:0;visibility:hidden;transition:opacity .4s ease,visibility .4s ease;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);background-color:#fff}.kniu_sys_loading_mask[data-show="true"]{opacity:1;visibility:visible;transition:none;pointer-events:auto}:host([contained]) .kniu_sys_loading_mask{z-index:0}.kniu_sys_loading_spinner{width:38px;height:38px;border:3px solid rgba(102,126,234,.25);border-top-color:#667eea;border-radius:50%;animation:kniu_sys_loading_spin .7s linear infinite}@keyframes kniu_sys_loading_spin{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){.kniu_sys_loading_spinner{animation:none}}</style><div class="kniu_sys_loading_mask" data-show="true" role="status" aria-label="加载中"><span class="kniu_sys_loading_spinner"></span></div>`;
        this._mask = this.shadowRoot.querySelector('.kniu_sys_loading_mask');
      }
      set show(value) {
        this._show = !!value;
        this._mask.dataset.show = String(this._show);
      }
      get show() { return this._show; }
    }
    customElements.define('kniu-loading', KniuSysLoading);
  }

  function registerMsgComponent() {
    if (typeof customElements === 'undefined' || typeof HTMLElement === 'undefined') return;
    if (customElements.get('kniu-msg')) return;
    class KniuSysToast extends HTMLElement {
      constructor() {
        super();
        attachComponentShadow(this);
        this._message = '';
        this._type = 'info';
        this._visible = false;
        this.shadowRoot.innerHTML = `<style>:host{position:fixed;inset:0;z-index:2147483000;display:block;pointer-events:none}.kniu_sys_toast{position:absolute;right:28px;bottom:28px;padding:14px 18px;border:1px solid #ebeef5;border-radius:4px;opacity:0;pointer-events:none;transform:translateY(12px);background-color:#edf2fc;color:#909399;transition:.25s;box-shadow:0 12px 40px rgba(23,33,59,.18)}.kniu_sys_toast[data-type="success"]{border-color:#e1f3d8;background-color:#f0f9eb;color:#67c23a}.kniu_sys_toast[data-type="warning"]{border-color:#faecd8;background-color:#fdf6ec;color:#e6a23c}.kniu_sys_toast[data-type="error"]{border-color:#fde2e2;background-color:#fef0f0;color:#f56c6c}.kniu_sys_toast[data-visible="true"]{opacity:1;transform:none}</style><div class="kniu_sys_toast" data-visible="false" data-type="info" role="status" aria-live="polite"></div>`;
        this._toast = this.shadowRoot.querySelector('.kniu_sys_toast');
      }
      set message(value) {
        this._message = value == null ? '' : String(value);
        this._toast.textContent = this._message;
      }
      get message() { return this._message; }
      set type(value) {
        this._type = ['success', 'warning', 'info', 'error'].includes(value) ? value : 'info';
        this._toast.dataset.type = this._type;
      }
      get type() { return this._type; }
      set visible(value) {
        this._visible = !!value;
        this._toast.dataset.visible = String(this._visible);
      }
      get visible() { return this._visible; }
    }
    customElements.define('kniu-msg', KniuSysToast);
  }

  // ===== 分页相关（服务端列表接口对接 + 页码窗口计算，配合 kniu-page 组件使用）=====
  function buildPageList(current, total) {
    const arr = [];
    if (total <= 5) {
      for (let i = 1; i <= total; i++) arr.push(i);
      return arr;
    }
    const start = Math.max(1, Math.min(current - 2, total - 4));
    const end = Math.min(total, start + 4);
    for (let i = start; i <= end; i++) arr.push(i);
    return arr;
  }

  // 服务端分页控制器：对接后端列表接口，返回 loadList/changePage/changePageSize。
  // options.params 可选：函数（每次请求时求值）或对象，其键值会合并进请求 data，用于携带 keyword 等附加查询参数。
  function usePagination(options) {
    const { state, self, url, field = 'id', sort = 'asc', params = null, transform = null, tableKey = null, pageKey = null } = options;
    if (!state || !self || !url) {
      throw new Error('usePagination 需要 state、self、url 三个参数');
    }
    // 分页状态由 usePagination 集中初始化，业务 state 不再混入额外初始化函数。
    const pageOptions = pageKey && state[pageKey] && typeof state[pageKey] === 'object' ? state[pageKey] : {};
    const configuredPageSize = Number(pageOptions.pageSize);
    state.pageRows = Math.max(1, Number.isFinite(configuredPageSize) ? configuredPageSize : 10);
    state.currentPage = Math.max(1, Number(pageOptions.currentPage) || 1);
    state.pageTotal = Math.max(1, Number(state.pageTotal) || 1);
    state.total = Math.max(0, Number(pageOptions.total ?? state.total) || 0);

    function resolveExtraParams() {
      const extra = typeof params === 'function' ? params() : params;
      return extra && typeof extra === 'object' ? extra : {};
    }

    // 加载完成后把分页结果同步进 options 化的 table / page 配置对象
    // （kniu-table 的 kniu:options、kniu-page 的 kniu:options 直接消费这两个对象）。
    // 注意：必须整体替换对象引用——kniu:options 的响应式订阅注册在表达式路径
    // （如 state.userPage）上，原地改 total/data 等子属性不会触发组件刷新。
    function syncOptions() {
      if (tableKey && state[tableKey] && typeof state[tableKey] === 'object') {
        const prev = state[tableKey];
        state[tableKey] = { ...prev, data: state.list, loading: state.loading };
      }
      if (pageKey && state[pageKey] && typeof state[pageKey] === 'object') {
        const prev = state[pageKey];
        state[pageKey] = { ...prev, total: state.total, currentPage: state.currentPage, pageSize: state.pageRows };
      }
    }

    async function loadList(page) {
      const targetPage = Math.min(Math.max(Number(page) || 1, 1), state.pageTotal || 1);
      state.loading = true;
      syncOptions();
      await REQUEST({
        url,
        type: 'POST',
        data: {
          page_current: targetPage,
          page_rows: state.pageRows,
          field,
          sort,
          ...resolveExtraParams()
        },
        success(res) {
          if (res.status !== 1) {
            state.error = res.msg || '加载失败';
            state.loading = false;
            syncOptions();
            self.$msg({ content: state.error, type: 'error' });
            return;
          }
          const payload = res.data || {};
          const records = getResponseRecords(payload);
          state.list = typeof transform === 'function' ? transform(records) : records;
          state.currentPage = payload.page_current || 1;
          state.pageTotal = payload.page_total || 1;
          state.total = payload.total || 0;
          state.loading = false;
          syncOptions();
        },
        fail(res) {
          state.loading = false;
          syncOptions();
          state.error = res.msg || '加载失败';
          self.$msg({ content: state.error, type: 'error' });
        }
      });
    }

    function changePage(event) {
      const page = event?.detail?.page ?? (event && event.currentTarget ? Number(event.currentTarget.dataset.page) : 0);
      if (!Number.isFinite(page) || page < 1 || page > state.pageTotal) return;
      loadList(page);
    }

    function changePageSize(event) {
      const size = (event?.detail?.size ?? Number(event && event.target ? event.target.value : state.pageRows)) || 10;
      if (size === state.pageRows) return;
      state.pageRows = size;
      state.currentPage = 1;
      loadList(1);
    }

    return { loadList, changePage, changePageSize };
  }

  function registerSelectComponent() {
    if (typeof customElements === 'undefined' || typeof HTMLElement === 'undefined') return;
    if (!customElements.get('kniu-option')) {
      class KniuSysOption extends HTMLElement {
        static get observedAttributes() { return ['label', 'value', 'disabled']; }
        constructor() {
          super();
          attachComponentShadow(this);
          this.shadowRoot.innerHTML = '<slot></slot>';
        }
        connectedCallback() { this._notifySelect(); }
        attributeChangedCallback() { this._notifySelect(); }
        get label() { return this.getAttribute('label') || this.textContent.trim(); }
        set label(value) { this.setAttribute('label', value == null ? '' : String(value)); }
        get value() { return this.getAttribute('value') || ''; }
        set value(value) { this.setAttribute('value', value == null ? '' : String(value)); }
        get disabled() { return this.hasAttribute('disabled'); }
        set disabled(value) { value ? this.setAttribute('disabled', '') : this.removeAttribute('disabled'); }
        _notifySelect() {
          const select = this.closest('kniu-select');
          if (select && typeof select.syncOptions === 'function') select.syncOptions();
        }
      }
      customElements.define('kniu-option', KniuSysOption);
    }
    if (customElements.get('kniu-select')) return;
    class KniuSysSelect extends HTMLElement {
      static get observedAttributes() { return ['placeholder', 'name', 'disabled', 'required', 'size']; }
      constructor() {
        super();
        attachComponentShadow(this);
        this._value = '';
        this.shadowRoot.innerHTML = `<style>:host{display:inline-block;vertical-align:middle;min-width:120px}.kniu_sys_select_wrap{position:relative;width:100%}.kniu_sys_select{display:flex;align-items:center;width:100%;height:40px;padding:0 34px 0 12px;border:1px solid #dcdfe6;border-radius:4px;outline:0;background:#fff;color:#606266;font:14px Arial,"Microsoft YaHei",sans-serif;cursor:pointer;box-sizing:border-box;white-space:nowrap}.kniu_sys_select:hover{border-color:#c0c4cc}.kniu_sys_select:focus-visible,.kniu_sys_select_wrap[data-open="true"] .kniu_sys_select{border-color:#409eff}.kniu_sys_select:disabled{background:#f5f7fa;color:#c0c4cc;cursor:not-allowed}.kniu_sys_select_arrow{position:absolute;top:50%;right:12px;width:7px;height:7px;border-right:1px solid #909399;border-bottom:1px solid #909399;transform:translateY(-70%) rotate(45deg);transition:transform .2s;pointer-events:none}.kniu_sys_select_wrap[data-open="true"] .kniu_sys_select_arrow{transform:translateY(-30%) rotate(225deg)}.kniu_sys_select_dropdown{position:absolute;left:0;right:0;top:calc(100% + 6px);z-index:10030;max-height:220px;overflow:auto;padding:5px 0;border:1px solid #e4e7ed;border-radius:4px;background-color:#fff;box-shadow:0 2px 12px rgba(0,0,0,.1);opacity:0;visibility:hidden;transform:translateY(-4px);transition:.16s}.kniu_sys_select_wrap[data-placement="top"] .kniu_sys_select_dropdown{top:auto;bottom:calc(100% + 6px);transform:translateY(4px)}.kniu_sys_select_wrap[data-open="true"] .kniu_sys_select_dropdown{opacity:1;visibility:visible;transform:none}.kniu_sys_select_option{display:block;width:100%;height:32px;padding:0 12px;border:0;background:transparent;color:#606266;font:inherit;text-align:left;cursor:pointer}.kniu_sys_select_option:hover,.kniu_sys_select_option.is-selected{color:#409eff;background:#f5f7fa}.kniu_sys_select_option:disabled{color:#c0c4cc;cursor:not-allowed}.kniu_sys_select_slot{display:none}</style><div class="kniu_sys_select_wrap" data-open="false" data-placement="bottom"><button type="button" class="kniu_sys_select" aria-haspopup="listbox" aria-expanded="false"></button><span class="kniu_sys_select_arrow" aria-hidden="true"></span><div class="kniu_sys_select_dropdown" role="listbox"></div></div><slot class="kniu_sys_select_slot"></slot>`;
        this._wrap = this.shadowRoot.querySelector('.kniu_sys_select_wrap');
        this._select = this.shadowRoot.querySelector('.kniu_sys_select');
        this._dropdown = this.shadowRoot.querySelector('.kniu_sys_select_dropdown');
        this._select.addEventListener('click', () => this._setOpen(this._wrap.dataset.open !== 'true'));
        this._select.addEventListener('keydown', (event) => {
          if (event.key === 'Escape' || event.key === 'Tab') this._setOpen(false);
          else if (event.key === 'Enter' || event.key === ' ' || (event.altKey && event.key === 'ArrowDown')) this._setOpen(true);
        });
        this._dropdown.addEventListener('click', (event) => {
          const option = event.target.closest('.kniu_sys_select_option');
          if (!option || option.disabled) return;
          this._value = option.dataset.value || '';
          this.syncOptions();
          this._setOpen(false);
          this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
          this.dispatchEvent(new CustomEvent('change', { detail: this._value, bubbles: true, composed: true }));
        });
        this._outside = (event) => { if (!event.composedPath().includes(this)) this._setOpen(false); };
        this._observer = new MutationObserver(() => this.syncOptions());
      }
      connectedCallback() {
        this._observer.observe(this, { childList: true, subtree: true, attributes: true, characterData: true });
        this.syncOptions();
        this._syncAttributes();
        window.addEventListener('pointerdown', this._outside, true);
      }
      disconnectedCallback() { this._observer.disconnect(); window.removeEventListener('pointerdown', this._outside, true); }
      attributeChangedCallback() { if (this._select) this._syncAttributes(); }
      get value() { return this._value; }
      set value(value) {
        this._value = value == null ? '' : String(value);
        if (this._select) this.syncOptions();
      }
      get disabled() { return this.hasAttribute('disabled'); }
      set disabled(value) { value ? this.setAttribute('disabled', '') : this.removeAttribute('disabled'); }
      _setOpen(open) {
        const expanded = !!open && !this._select.disabled;
        if (expanded) {
          const rect = this.getBoundingClientRect();
          const panelHeight = Math.min(this._dropdown.scrollHeight || 220, 220) + 6;
          const below = window.innerHeight - rect.bottom;
          this._wrap.dataset.placement = below >= panelHeight || below >= rect.top ? 'bottom' : 'top';
        }
        this._wrap.dataset.open = String(expanded);
        this._select.setAttribute('aria-expanded', String(expanded));
      }
      syncOptions() {
        if (!this._select) return;
        const options = [];
        const placeholder = this.getAttribute('placeholder') || '';
        if (placeholder) {
          const option = document.createElement('button');
          option.type = 'button';
          option.className = 'kniu_sys_select_option';
          option.dataset.value = '';
          option.textContent = placeholder;
          option.disabled = this.hasAttribute('required');
          options.push(option);
        }
        this.querySelectorAll(':scope > kniu-option').forEach(function (source) {
          const option = document.createElement('button');
          option.type = 'button';
          option.className = 'kniu_sys_select_option';
          option.dataset.value = source.value;
          option.textContent = source.label;
          option.disabled = source.disabled;
          options.push(option);
        });
        options.forEach((option) => option.classList.toggle('is-selected', option.dataset.value === this._value));
        replaceChildrenWithFragment(this._dropdown, options);
        const selected = options.find((option) => option.dataset.value === this._value);
        this._select.textContent = selected?.textContent || placeholder || '';
      }
      _syncAttributes() {
        this._select.disabled = this.hasAttribute('disabled');
        if (this._select.disabled) this._setOpen(false);
        const size = this.getAttribute('size');
        const height = size === 'small' ? 30 : (size === 'large' ? 48 : 40);
        this._select.style.height = `${height}px`;
        this._select.style.lineHeight = `${height - 2}px`;
        this.syncOptions();
      }
    }
    customElements.define('kniu-select', KniuSysSelect);
  }

  function registerRadioGroupComponent() {
    if (typeof customElements === 'undefined' || typeof HTMLElement === 'undefined') return;
    if (!customElements.get('kniu-radio')) {
      class KniuSysRadio extends HTMLElement {
        static get observedAttributes() { return ['label', 'value', 'disabled', 'size']; }
        constructor() {
          super();
          attachComponentShadow(this);
          this.shadowRoot.innerHTML = '<slot></slot>';
        }
        connectedCallback() { this._notifyGroup(); }
        attributeChangedCallback() { this._notifyGroup(); }
        get label() { return this.getAttribute('label') || this.textContent.trim(); }
        get value() { return this.getAttribute('value') || ''; }
        get disabled() { return this.hasAttribute('disabled'); }
        _notifyGroup() {
          const group = this.closest('kniu-radio-group');
          if (group && typeof group.syncOptions === 'function') group.syncOptions();
        }
      }
      customElements.define('kniu-radio', KniuSysRadio);
    }
    if (customElements.get('kniu-radio-group')) return;
    class KniuSysRadioGroup extends HTMLElement {
      static get observedAttributes() { return ['name', 'disabled', 'size']; }
      constructor() {
        super();
        attachComponentShadow(this);
        this._value = '';
        this._radioName = `kniu-radio-${Math.random().toString(36).slice(2)}`;
        this.shadowRoot.innerHTML = `<style>:host{display:inline-block;vertical-align:middle}.kniu_sys_radio_group{display:flex;align-items:center;flex-wrap:wrap;gap:18px;min-height:40px}.kniu_sys_radio{display:inline-flex;align-items:center;gap:7px;color:#606266;font:14px/1.5 Arial,"Microsoft YaHei",sans-serif;cursor:pointer;user-select:none}.kniu_sys_radio_control{position:relative;display:inline-flex;align-items:center;justify-content:center;flex:none}.kniu_sys_radio_input{position:relative;-webkit-appearance:none;appearance:none;width:14px;height:14px;margin:0;border:1px solid #dcdfe6;border-radius:50%;outline:0;background-color:#fff;box-sizing:border-box;cursor:pointer;transition:border-color .2s,background-color .2s}.kniu_sys_radio_dot{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:5px;height:5px;border-radius:50%;background-color:#fff;display:none;pointer-events:none}.kniu_sys_radio_input:checked{border-color:#409eff;background-color:#409eff}.kniu_sys_radio_input:checked~.kniu_sys_radio_dot{display:block}.kniu_sys_radio_input:focus-visible{outline:2px solid rgba(64,158,255,.3);outline-offset:2px}.kniu_sys_radio:hover{color:#409eff}.kniu_sys_radio:hover .kniu_sys_radio_input{border-color:#409eff}.kniu_sys_radio[data-size="large"] .kniu_sys_radio_input{width:16px;height:16px}.kniu_sys_radio[data-size="large"] .kniu_sys_radio_dot{width:6px;height:6px}.kniu_sys_radio[data-size="small"]{font-size:12px}.kniu_sys_radio[data-size="small"] .kniu_sys_radio_input{width:12px;height:12px}.kniu_sys_radio[data-size="small"] .kniu_sys_radio_dot{width:4px;height:4px}.kniu_sys_radio[data-disabled="true"]{color:#c0c4cc;cursor:not-allowed}.kniu_sys_radio[data-disabled="true"] .kniu_sys_radio_input{border-color:#dcdfe6;background-color:#f5f7fa;cursor:not-allowed}.kniu_sys_radio[data-disabled="true"] .kniu_sys_radio_input:checked{border-color:#a0cfff;background-color:#a0cfff}</style><div class="kniu_sys_radio_group" role="radiogroup"></div><slot hidden></slot>`;
        this._group = this.shadowRoot.querySelector('.kniu_sys_radio_group');
        this._group.addEventListener('change', (event) => {
          const input = event.target;
          if (!(input instanceof HTMLInputElement) || input.type !== 'radio') return;
          this._value = input.value;
          this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
          this.dispatchEvent(new CustomEvent('change', { detail: this._value, bubbles: true, composed: true }));
        });
        this._observer = new MutationObserver(() => this.syncOptions());
      }
      connectedCallback() {
        this._observer.observe(this, { childList: true, subtree: true, attributes: true, characterData: true });
        this.syncOptions();
      }
      disconnectedCallback() { this._observer.disconnect(); }
      attributeChangedCallback() { if (this._group) this.syncOptions(); }
      get value() { return this._value; }
      set value(value) { this._value = value == null ? '' : String(value); this._syncChecked(); }
      syncOptions() {
        if (!this._group) return;
        const groupDisabled = this.hasAttribute('disabled');
        const groupSize = this.getAttribute('size') || '';
        const name = this.getAttribute('name') || this._radioName;
        const radios = Array.from(this.querySelectorAll(':scope > kniu-radio')).map((source) => {
          const label = document.createElement('label');
          label.className = 'kniu_sys_radio';
          const disabled = groupDisabled || source.disabled;
          label.dataset.disabled = String(disabled);
          label.dataset.size = source.getAttribute('size') || groupSize;
          const input = document.createElement('input');
          input.className = 'kniu_sys_radio_input';
          input.type = 'radio';
          input.name = name;
          input.value = source.value;
          input.disabled = disabled;
          input.checked = source.value === this._value;
          const dot = document.createElement('span');
          dot.className = 'kniu_sys_radio_dot';
          const control = document.createElement('span');
          control.className = 'kniu_sys_radio_control';
          control.append(input, dot);
          const text = document.createElement('span');
          text.textContent = source.label;
          label.append(control, text);
          return label;
        });
        replaceChildrenWithFragment(this._group, radios);
      }
      _syncChecked() {
        if (!this._group) return;
        this._group.querySelectorAll('input[type="radio"]').forEach((input) => {
          input.checked = input.value === this._value;
        });
      }
    }
    customElements.define('kniu-radio-group', KniuSysRadioGroup);
  }

  function registerPageComponent() {
    if (typeof customElements === 'undefined' || typeof HTMLElement === 'undefined') return;
    if (customElements.get('kniu-page')) return;

    const LAYOUT_ALIASES = {
      total: 'total', 总数: 'total',
      first: 'first', 首页: 'first',
      prev: 'prev', 上一页: 'prev',
      pager: 'pager', page: 'pager', 页码: 'pager',
      next: 'next', 下一页: 'next',
      last: 'last', 末页: 'last', 尾页: 'last',
      sizes: 'sizes', rows: 'sizes', 条数: 'sizes',
      jumper: 'jumper', jump: 'jumper', 跳转: 'jumper'
    };

    class KniuSysPage extends HTMLElement {
      // 2026-09-01：所有旧 attribute（total / page-size / current-page / layout /
      // background / first-text / prev-text / next-text / last-text）全部作废，
      // 只认 kniu:options。
      static get observedAttributes() {
        return [];
      }

      constructor() {
        super();
        attachComponentShadow(this);
        this._total = 0;
        this._pageSize = 10;
        this._baseSize = 10;        // 下拉步长基数来自首次 options.pageSize
        this._baseSizeInitialized = false;
        this._currentPage = 1;
        this._layout = 'total,prev,pager,next,sizes';
        this._background = false;
        this._firstText = null;
        this._prevText = null;
        this._nextText = null;
        this._lastText = null;
        this._sizes = [10, 20, 50, 100];
        this._options = null;
        this.shadowRoot.innerHTML = `
          <style>
            :host{display:block}
            .kniu_sys_page{display:flex;align-items:center;flex-wrap:wrap;gap:6px;margin-top:16px;font-size:13px;color:#606266}
            .kniu_sys_page[hidden]{display:none}
            .kniu_sys_page_pager{display:flex;align-items:center;flex-wrap:wrap;gap:6px}
            .kniu_sys_page_btn{min-width:30px;height:30px;padding:0 8px;border:1px solid #dcdfe6;border-radius:4px;background-color:#fff;color:#606266;cursor:pointer;font-size:13px;font-family:inherit;transition:all .2s}
            .kniu_sys_page_btn:hover:not([disabled]):not(.is-active){color:#409eff;border-color:#c6e2ff}
            .kniu_sys_page_btn.is-active{color:#fff;background-color:#409eff;border-color:#409eff;cursor:default}
            .kniu_sys_page_btn[disabled]{color:#c0c4cc;cursor:not-allowed;background-color:#fff}
            .kniu_sys_page_btn[data-background="true"]:not(.is-active):not([disabled]){background-color:#f4f4f5}
            .kniu_sys_page_sizes{width:max-content;min-width:0;font-size:13px}
            .kniu_sys_page_jumper{display:inline-flex;align-items:center;gap:5px;white-space:nowrap}
            .kniu_sys_page_jumper_input{width:46px;height:30px;padding:0 6px;border:1px solid #dcdfe6;border-radius:4px;outline:0;color:#606266;font:inherit;text-align:center;box-sizing:border-box}
            .kniu_sys_page_jumper_input{-moz-appearance:textfield}.kniu_sys_page_jumper_input::-webkit-inner-spin-button,.kniu_sys_page_jumper_input::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}
            .kniu_sys_page_jumper_input:hover{border-color:#c0c4cc}.kniu_sys_page_jumper_input:focus{border-color:#409eff}
          </style>
          <div class="kniu_sys_page" hidden>
            <span class="kniu_sys_page_total">共 0 条</span>
            <button class="kniu_sys_page_btn kniu_sys_page_first" type="button">首页</button>
            <button class="kniu_sys_page_btn kniu_sys_page_prev" type="button">上一页</button>
            <span class="kniu_sys_page_pager"></span>
            <button class="kniu_sys_page_btn kniu_sys_page_next" type="button">下一页</button>
            <button class="kniu_sys_page_btn kniu_sys_page_last" type="button">末页</button>
            <kniu-select class="kniu_sys_page_sizes" size="small"></kniu-select>
            <span class="kniu_sys_page_jumper"><span class="kniu_sys_page_jumper_prefix">去</span><input class="kniu_sys_page_jumper_input" type="number" min="1" step="1" aria-label="跳转页码"><span class="kniu_sys_page_jumper_suffix">页</span></span>
          </div>
        `;
        this._root = this.shadowRoot.querySelector('.kniu_sys_page');
        this._totalEl = this.shadowRoot.querySelector('.kniu_sys_page_total');
        this._firstEl = this.shadowRoot.querySelector('.kniu_sys_page_first');
        this._prevEl = this.shadowRoot.querySelector('.kniu_sys_page_prev');
        this._pagerEl = this.shadowRoot.querySelector('.kniu_sys_page_pager');
        this._nextEl = this.shadowRoot.querySelector('.kniu_sys_page_next');
        this._lastEl = this.shadowRoot.querySelector('.kniu_sys_page_last');
        this._sizesEl = this.shadowRoot.querySelector('.kniu_sys_page_sizes');
        this._jumperEl = this.shadowRoot.querySelector('.kniu_sys_page_jumper');
        this._jumperInput = this.shadowRoot.querySelector('.kniu_sys_page_jumper_input');
        this._jumperPrefix = this.shadowRoot.querySelector('.kniu_sys_page_jumper_prefix');
        this._jumperSuffix = this.shadowRoot.querySelector('.kniu_sys_page_jumper_suffix');
        this._sizesEl.options = { size: 'small' };
        this._firstEl.addEventListener('click', () => this._goto(1));
        this._prevEl.addEventListener('click', () => this._goto(this._currentPage - 1));
        this._nextEl.addEventListener('click', () => this._goto(this._currentPage + 1));
        this._lastEl.addEventListener('click', () => this._goto(this._pageTotal()));
        this._sizesEl.addEventListener('change', () => this._emit('size-change', { size: Number(this._sizesEl.value) || 10 }));
        this._jumperInput.addEventListener('keydown', (event) => {
          if (event.key !== 'Enter') return;
          event.preventDefault();
          this._goto(this._jumperInput.value);
          this._jumperInput.value = String(this._currentPage);
        });
        this._jumperInput.addEventListener('change', () => {
          this._goto(this._jumperInput.value);
          this._jumperInput.value = String(this._currentPage);
        });
      }

      connectedCallback() { this._render(); }

      get total() { return this._total; }
      set total(value) { this._total = Math.max(0, Number(value) || 0); this._render(); }
      get pageSize() { return this._pageSize; }
      set pageSize(value) {
        this._pageSize = Math.max(1, Number(value) || 10);
        if (!this._baseSizeInitialized || this._pageSize < this._baseSize || this._pageSize % this._baseSize !== 0) {
          this._baseSize = this._pageSize;
          this._baseSizeInitialized = true;
        }
        this._render();
      }
      get currentPage() { return this._currentPage; }
      set currentPage(value) { this._currentPage = Math.max(1, Number(value) || 1); this._render(); }

      // kniu:options 统一配置入口（2026-09-01）：total / currentPage / pageSize / layout /
      // background / firstText / prevText / nextText / lastText / sizes 全部收进 options；
      // 旧 attribute 一律作废（整体替换 options 对象即可刷新）。
      set options(value) {
        const o = value && typeof value === 'object' ? value : {};
        this._options = o;
        if (o.total != null) this._total = Math.max(0, Number(o.total) || 0);
        if (o.pageSize != null) {
          const next = Math.max(1, Number(o.pageSize) || 10);
          this._pageSize = next;
          if (!this._baseSizeInitialized || next < this._baseSize || next % this._baseSize !== 0) {
            this._baseSize = next;
            this._baseSizeInitialized = true;
          }
        }
        if (o.currentPage != null) this._currentPage = Math.max(1, Number(o.currentPage) || 1);
        if (o.layout != null) this._layout = String(o.layout);
        if (o.background != null) this._background = !!o.background;
        if (o.firstText != null) this._firstText = String(o.firstText);
        if (o.prevText != null) this._prevText = String(o.prevText);
        if (o.nextText != null) this._nextText = String(o.nextText);
        if (o.lastText != null) this._lastText = String(o.lastText);
        if (Array.isArray(o.sizes) && o.sizes.length) this._sizes = o.sizes.map(function (n) { return Number(n) || 10; });
        this._render();
      }
      get options() { return this._options; }

      _parseLayout() {
        return this._layout.split(/[,，]/).map(function (item) {
          const token = item.trim();
          return LAYOUT_ALIASES[token] || LAYOUT_ALIASES[token.toLowerCase()] || token.toLowerCase();
        }).filter(Boolean);
      }

      _isEnglishLayout() {
        const tokens = this._layout.split(/[,，]/).map(function (item) { return item.trim(); }).filter(Boolean);
        return tokens.length > 0 && tokens.every(function (token) {
          return ['first', 'prev', 'page', 'pager', 'next', 'last', 'total', 'rows', 'sizes', 'jumper', 'jump'].includes(token.toLowerCase());
        });
      }

      _pageTotal() {
        return Math.max(1, Math.ceil(this._total / this._pageSize));
      }

      _buildSizes() {
        // 基数由首次 options.pageSize 确定，下拉严格生成它的 1..6 倍；
        // 不再追加不属于倍数序列的特殊值。
        const base = this._baseSize;
        const arr = [];
        for (let i = 1; i <= 6; i++) arr.push(base * i);
        const sizes = Array.from(new Set(arr)).sort(function (a, b) { return a - b; });
        if (sizes.indexOf(this._pageSize) < 0) {
          sizes.push(this._pageSize);
          sizes.sort(function (a, b) { return a - b; });
        }
        return sizes;
      }

      _goto(page) {
        const total = this._pageTotal();
        const target = Math.min(Math.max(Number(page) || 1, 1), total);
        if (target === this._currentPage) return;
        this._currentPage = target;
        this._emit('current-change', { page: target });
        this._render();
      }

      _emit(name, detail) {
        this.dispatchEvent(new CustomEvent(name, { detail: detail, bubbles: true, composed: true }));
      }

      _render() {
        const total = this._total;
        const pageSize = this._pageSize;
        const current = this._currentPage;
        const pageTotal = this._pageTotal();
        const layout = this._parseLayout();
        const english = this._isEnglishLayout();

        // 总数文本先更新再判断隐藏：仅一页（含 0 条数据）时隐藏整个分页组件，
        // 但 "共 X 条" 必须始终反映真实 total（2026-09-01：曾因提前 return 停留在初始 "共 0 条"）。
        this._totalEl.textContent = english ? `Total ${total}` : `共 ${total} 条`;
        if (pageTotal <= 1) {
          this._root.hidden = true;
          return;
        }
        this._root.hidden = false;
        this._firstEl.textContent = this._firstText ?? (english ? 'First' : '首页');
        this._prevEl.textContent = this._prevText ?? (english ? 'Prev' : '上一页');
        this._nextEl.textContent = this._nextText ?? (english ? 'Next' : '下一页');
        this._lastEl.textContent = this._lastText ?? (english ? 'Last' : '末页');
        this._jumperPrefix.textContent = english ? 'Go to' : '去';
        this._jumperSuffix.textContent = english ? 'Page' : '页';
        this._jumperInput.max = String(pageTotal);
        this._jumperInput.value = String(current);
        this._jumperInput.setAttribute('aria-label', english ? 'Jump to page' : '跳转页码');
        this._firstEl.disabled = current <= 1;
        this._prevEl.disabled = current <= 1;
        this._nextEl.disabled = current >= pageTotal;
        this._lastEl.disabled = current >= pageTotal;
        this._firstEl.dataset.background = String(this._background);
        this._prevEl.dataset.background = String(this._background);
        this._nextEl.dataset.background = String(this._background);
        this._lastEl.dataset.background = String(this._background);

        // 下拉选项严格为初始 pageSize 的 1..6 倍
        const sizes = this._buildSizes();
        const sizesFragment = document.createDocumentFragment();
        sizes.forEach((s) => {
          const opt = document.createElement('kniu-option');
          opt.value = String(s);
          opt.label = english ? `${s} rows/page` : `${s} 条/页`;
          sizesFragment.appendChild(opt);
        });
        this._sizesEl.replaceChildren(sizesFragment);
        this._sizesEl.value = String(pageSize);

        const pagerFragment = document.createDocumentFragment();
        const pageList = buildPageList(current, pageTotal);
        const self = this;
        pageList.forEach(function (p) {
          const btn = document.createElement('button');
          btn.className = 'kniu_sys_page_btn';
          btn.type = 'button';
          btn.dataset.background = String(self._background);
          btn.textContent = String(p);
          if (p === current) btn.classList.add('is-active');
          btn.addEventListener('click', function () { self._goto(p); });
          pagerFragment.appendChild(btn);
        });
        this._pagerEl.replaceChildren(pagerFragment);

        // 按 layout 顺序排列子元素
        const orderMap = { total: this._totalEl, first: this._firstEl, prev: this._prevEl, pager: this._pagerEl, next: this._nextEl, last: this._lastEl, sizes: this._sizesEl, jumper: this._jumperEl };
        const layoutFragment = document.createDocumentFragment();
        layout.forEach(function (key) {
          const el = orderMap[key];
          if (el) {
            el.style.display = '';
            layoutFragment.appendChild(el);
          }
        });
        Object.keys(orderMap).forEach(function (key) {
          if (!layout.includes(key)) orderMap[key].style.display = 'none';
        });
        this._root.replaceChildren(layoutFragment);
      }
    }

    customElements.define('kniu-page', KniuSysPage);
  }

  function registerImageComponent() {
    if (typeof customElements === 'undefined' || typeof HTMLElement === 'undefined') return;
    if (customElements.get('kniu-image')) return;
    class KniuSysImage extends HTMLElement {
      static get observedAttributes() { return ['src', 'alt', 'fit']; }
      constructor() {
        super();
        attachComponentShadow(this);
        this._fit = 'contain';
        this.shadowRoot.innerHTML = `<style>:host{display:inline-block;vertical-align:middle;overflow:hidden;flex-shrink:0}.kniu_sys_image_group{display:flex;width:100%;height:100%;align-items:stretch}.kniu_sys_image_content{position:relative;flex:1;min-width:0;height:100%;display:flex;align-items:center;justify-content:flex-start;padding:0 12px;background-color:#fff;box-sizing:border-box;overflow:hidden}.kniu_sys_image_affix{display:none;align-items:center;justify-content:center;flex:none;padding:0 20px;border:1px solid #dcdfe6;background-color:#f5f7fa;color:#909399;font-size:14px;line-height:38px;text-align:center;white-space:nowrap;box-sizing:border-box}.kniu_sys_image_group[data-affix="true"] .kniu_sys_image_content{border:1px solid #dcdfe6}.kniu_sys_image_group[data-has-prepend="true"] .kniu_sys_image_prepend{display:flex;border-right:0;border-radius:4px 0 0 4px}.kniu_sys_image_group[data-has-prepend="true"] .kniu_sys_image_content{border-radius:0 4px 4px 0}.kniu_sys_image_group[data-has-append="true"] .kniu_sys_image_append{display:flex;border-left:0;border-radius:0 4px 4px 0}.kniu_sys_image_group[data-affix="true"]{height:40px}.kniu_sys_image_group:not([data-affix="true"]) .kniu_sys_image_content{padding:0;background-color:transparent}.kniu_sys_image_wrap{position:relative;width:100%;height:100%;overflow:hidden;background-color:#f5f7fa}.kniu_sys_image{display:block;width:100%;height:100%}.kniu_sys_image_status{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background-color:#f5f7fa;color:#909399;font-size:12px}.kniu_sys_image_status[data-hidden="true"]{display:none}</style><div class="kniu_sys_image_group" data-affix="false" data-has-prepend="false" data-has-append="false"><span class="kniu_sys_image_affix kniu_sys_image_prepend"><slot name="prepend"></slot></span><div class="kniu_sys_image_content"><div class="kniu_sys_image_wrap"><img class="kniu_sys_image"><span class="kniu_sys_image_status">加载中…</span></div></div><span class="kniu_sys_image_affix kniu_sys_image_append"><slot name="append"></slot></span></div>`;
        this._image = this.shadowRoot.querySelector('.kniu_sys_image');
        this._status = this.shadowRoot.querySelector('.kniu_sys_image_status');
        this._image.addEventListener('load', () => {
          this._status.dataset.hidden = 'true';
          this.dispatchEvent(new Event('load', { bubbles: true, composed: true }));
        });
        this._image.addEventListener('error', () => {
          this._status.textContent = '加载失败';
          this._status.dataset.hidden = 'false';
          this.dispatchEvent(new Event('error', { bubbles: true, composed: true }));
        });
      }
      connectedCallback() {
        this._mountAffixes();
        this._sync();
      }
      attributeChangedCallback(name) {
        if (!this._image) return;
        if (name === 'src' || name === 'alt') this._sync();
        else if (name === 'fit') this.fit = this.getAttribute('fit');
      }
      _mountAffixes() {
        mountAffixSlots(this, '.kniu_sys_image_group', 'kniu_sys_image');
        const group = this.shadowRoot.querySelector('.kniu_sys_image_group');
        if (group.dataset.affix !== 'true') return;
        const w = this.style.width || '80px';
        const h = this.style.height || '40px';
        this.style.width = '100%';
        this.style.height = 'auto';
        const wrap = this.shadowRoot.querySelector('.kniu_sys_image_wrap');
        wrap.style.width = w;
        wrap.style.height = h;
      }
      set fit(value) {
        this._fit = ['fill', 'contain', 'cover', 'none', 'scale-down'].includes(value) ? value : 'contain';
        this._image.style.objectFit = this._fit;
      }
      get fit() { return this._fit; }
      get src() { return this.getAttribute('src') || ''; }
      set src(value) { if (value == null) this.removeAttribute('src'); else this.setAttribute('src', String(value)); }
      _sync() {
        const src = this.getAttribute('src') || '';
        this._image.alt = this.getAttribute('alt') || '';
        // 读取 fit 属性（支持静态 fit="contain" 写法，避免始终 fill）
        const fitAttr = this.getAttribute('fit');
        if (fitAttr) this.fit = fitAttr;
        this._image.style.objectFit = this._fit;
        if (!src) {
          this._image.removeAttribute('src');
          this._status.textContent = '暂无图片';
          this._status.dataset.hidden = 'false';
          return;
        }
        if (this._image.src !== src) {
          this._status.textContent = '加载中…';
          this._status.dataset.hidden = 'false';
          this._image.src = src;
        }
      }
    }
    customElements.define('kniu-image', KniuSysImage);
  }

  function mountAffixSlots(comp, groupSelector, affixPrefix) {
    ['prepend', 'append'].forEach((name) => {
      const template = Array.from(comp.children).find((child) => child.tagName === 'TEMPLATE' && child.hasAttribute('#' + name));
      if (!template) return;
      const content = document.createElement('span');
      content.slot = name;
      const labelWidth = template.getAttribute('label-width');
      if (labelWidth) content.dataset.labelWidth = labelWidth;
      content.append(template.content.cloneNode(true));
      template.replaceWith(content);
    });
    const group = comp.shadowRoot.querySelector(groupSelector);
    if (!group) return;
    let hasAny = false;
    ['prepend', 'append'].forEach((name) => {
      const content = comp.querySelector('[slot="' + name + '"]');
      const affix = comp.shadowRoot.querySelector('.' + affixPrefix + '_' + name);
      const labelWidth = content ? (content.dataset.labelWidth || '') : '';
      group.dataset['has' + name[0].toUpperCase() + name.slice(1)] = String(Boolean(content));
      if (content) hasAny = true;
      if (labelWidth && CSS.supports('width', labelWidth)) {
        affix.style.width = labelWidth;
        affix.style.flexBasis = labelWidth;
      } else {
        affix.style.removeProperty('width');
        affix.style.removeProperty('flex-basis');
      }
    });
    group.dataset.affix = String(hasAny);
  }

  function registerInputComponent() {
    if (typeof customElements === 'undefined' || typeof HTMLElement === 'undefined') return;
    if (!customElements.get('kniu-input')) {
      class KniuSysInput extends HTMLElement {
        static get observedAttributes() { return ['type', 'name', 'placeholder', 'autocomplete', 'maxlength', 'rows', 'disabled', 'readonly', 'required', 'show-password', 'clearable', 'label-width']; }
        constructor() {
          super();
          attachComponentShadow(this);
          this.shadowRoot.innerHTML = `<style>:host{display:block;width:100%}.kniu_sys_input_group{display:flex;width:100%;height:40px}.kniu_sys_input_wrap{position:relative;display:block;flex:1;min-width:0}.kniu_sys_input{display:block;width:100%;height:40px;padding:0 12px;border:1px solid #dcdfe6;border-radius:4px;outline:0;background-color:#fff;color:#606266;font:14px/40px Arial,"Microsoft YaHei",sans-serif;box-sizing:border-box;transition:border-color .2s}.kniu_sys_input::placeholder{color:#c0c4cc}.kniu_sys_input:hover{border-color:#c0c4cc}.kniu_sys_input:focus{position:relative;z-index:1;border-color:#409eff}.kniu_sys_input:disabled{background-color:#f5f7fa;color:#c0c4cc;cursor:not-allowed}.kniu_sys_input_affix{display:none;align-items:center;justify-content:center;flex:none;padding:0 20px;border:1px solid #dcdfe6;background-color:#f5f7fa;color:#909399;font-size:14px;line-height:38px;text-align:center;white-space:nowrap;box-sizing:border-box}.kniu_sys_input_group[data-has-prepend="true"] .kniu_sys_input_prepend{display:flex;border-right:0;border-radius:4px 0 0 4px}.kniu_sys_input_group[data-has-append="true"] .kniu_sys_input_append{display:flex;border-left:0;border-radius:0 4px 4px 0}.kniu_sys_input_group[data-has-prepend="true"] .kniu_sys_input{border-radius:0 4px 4px 0}.kniu_sys_input_group[data-has-append="true"] .kniu_sys_input{border-radius:4px 0 0 4px}.kniu_sys_input_group[data-has-prepend="true"][data-has-append="true"] .kniu_sys_input{border-radius:0}.kniu_sys_input_group[data-has-append-btn="true"] .kniu_sys_input_append,.kniu_sys_input_group[data-has-prepend-btn="true"] .kniu_sys_input_prepend{padding:0;align-items:stretch}.kniu_sys_input_append::slotted(kniu-btn),.kniu_sys_input_prepend::slotted(kniu-btn){display:flex;flex:1;align-items:center;justify-content:center;margin:0;width:100%;height:100%}</style><span class="kniu_sys_input_group" data-has-prepend="false" data-has-append="false"><span class="kniu_sys_input_affix kniu_sys_input_prepend"><slot name="prepend"></slot></span><input class="kniu_sys_input" type="text"><span class="kniu_sys_input_affix kniu_sys_input_append"><slot name="append"></slot></span></span>`;
          adoptSharedStyle(this.shadowRoot, ':host([data-invalid="true"]) .kniu_sys_input,:host([data-invalid="true"]) .kniu_sys_input_affix{border-color:#f56c6c}');
          adoptSharedStyle(this.shadowRoot, '.kniu_sys_input:read-only:hover,.kniu_sys_input:read-only:focus{z-index:auto;border-color:#dcdfe6;outline:0;box-shadow:none;cursor:default}');
          adoptSharedStyle(this.shadowRoot, '.kniu_sys_input_affix{width:var(--kniu-input-label-width,auto);flex-basis:var(--kniu-input-label-width,auto)}');
          adoptSharedStyle(this.shadowRoot, '.kniu_sys_input_group[data-upload-append="true"]{height:auto;align-items:flex-start}.kniu_sys_input_group[data-upload-append="true"] .kniu_sys_input_wrap{display:none}.kniu_sys_input_group[data-upload-append="true"] .kniu_sys_input_append{display:block;flex:1;width:auto!important;flex-basis:auto!important;padding:0;border:0;background-color:transparent;line-height:normal;text-align:left}.kniu_sys_input_group[data-upload-append="true"] .kniu_sys_input_prepend{height:40px}');
          this._input = this.shadowRoot.querySelector('.kniu_sys_input');
          this._affixObserver = null;
          this._passwordVisible = false;
          const passwordStyle = `.kniu_sys_input_wrap[data-show-password="true"] .kniu_sys_input:not(textarea),.kniu_sys_input_wrap[data-clearable="true"] .kniu_sys_input:not(textarea){padding-right:40px}.kniu_sys_input_wrap[data-show-password="true"][data-clearable="true"] .kniu_sys_input:not(textarea){padding-right:72px}.kniu_sys_input_wrap[data-clearable="true"] textarea.kniu_sys_input{padding-right:32px}.kniu_sys_input_password,.kniu_sys_input_clear{position:absolute;z-index:2;top:0;right:0;display:flex;visibility:hidden;align-items:center;justify-content:center;width:36px;height:40px;padding:0;border:0;outline:0;background-color:transparent;color:#c0c4cc;font-size:17px;line-height:40px;text-align:center;cursor:pointer;opacity:0;pointer-events:none}.kniu_sys_input_wrap[data-show-password="true"] .kniu_sys_input_password,.kniu_sys_input_wrap[data-clear-visible="true"] .kniu_sys_input_clear{visibility:visible;opacity:1;pointer-events:auto}.kniu_sys_input_wrap[data-show-password="true"] .kniu_sys_input_clear{right:34px}.kniu_sys_input_wrap[data-clear-visible="true"] textarea.kniu_sys_input ~ .kniu_sys_input_clear{top:8px;right:8px;width:auto;height:auto;line-height:1}.kniu_sys_input_password:hover,.kniu_sys_input_password:focus,.kniu_sys_input_clear:hover,.kniu_sys_input_clear:focus{color:#409eff}.kniu_sys_input_password[aria-disabled="true"],.kniu_sys_input_clear[aria-disabled="true"]{cursor:not-allowed;color:#dcdfe6}.kniu_sys_input_password_icon{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}`;
          const wrap = document.createElement('span');
          wrap.className = 'kniu_sys_input_wrap';
          const passwordButton = document.createElement('span');
          passwordButton.className = 'kniu_sys_input_password';
          passwordButton.setAttribute('role', 'button');
          passwordButton.tabIndex = -1;
          const clearButton = document.createElement('span');
          clearButton.className = 'kniu_sys_input_clear';
          clearButton.setAttribute('role', 'button');
          clearButton.tabIndex = -1;
          clearButton.textContent = '×';
          clearButton.setAttribute('aria-label', '清空输入内容');
          this._input.replaceWith(wrap);
          wrap.append(this._input, clearButton, passwordButton);
          adoptSharedStyle(this.shadowRoot, passwordStyle);
          this._wrap = wrap;
          this._passwordButton = passwordButton;
          this._clearButton = clearButton;
          const keepInputFocused = (event) => event.preventDefault();
          passwordButton.addEventListener('pointerdown', keepInputFocused);
          clearButton.addEventListener('pointerdown', keepInputFocused);
          passwordButton.addEventListener('click', () => {
            if (passwordButton.disabled) return;
            this._passwordVisible = !this._passwordVisible;
            this._sync();
            this._input.focus();
          });
          clearButton.addEventListener('click', () => {
            if (clearButton.disabled) return;
            this._input.value = '';
            this._syncClearable();
            this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
            this.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
            this.dispatchEvent(new CustomEvent('clear', { bubbles: true, composed: true }));
            if (this.shadowRoot.activeElement !== this._input) this._input.focus({ preventScroll: true });
          });
          this._bindControl(this._input);
          adoptSharedStyle(this.shadowRoot, 'textarea.kniu_sys_input{height:auto;min-height:42px;padding:8px 12px;line-height:1.5;font:14px/1.5 Arial,"Microsoft YaHei",sans-serif;resize:vertical;white-space:pre-wrap;overflow:auto}.kniu_sys_input_group[data-is-textarea="true"]{height:auto;min-height:40px;align-items:stretch}.kniu_sys_input_group[data-is-textarea="true"][data-has-prepend="true"] .kniu_sys_input_prepend{align-self:flex-start;height:40px;display:flex;align-items:center;padding-top:0;padding-bottom:0;box-sizing:border-box}');
        }
        connectedCallback() {
          if (!this.hasAttribute('autocomplete')) this.setAttribute('autocomplete', 'off');
          if (!this.hasAttribute('clearable')) this.setAttribute('clearable', '');
          this._mountAffixes();
          this._sync();
          queueMicrotask(() => this._mountAffixes());
          if (!this._affixObserver) {
            this._affixObserver = new MutationObserver(() => this._mountAffixes());
            this._affixObserver.observe(this, { childList: true });
          }
        }
        disconnectedCallback() {
          if (this._affixObserver) this._affixObserver.disconnect();
          this._affixObserver = null;
        }
        attributeChangedCallback(name) {
          if (!this._input) return;
          if (name === 'label-width') this._mountAffixes();
          this._sync();
        }
        get value() { return this._input.value; }
        set value(value) { this._input.value = value == null ? '' : String(value); this._syncClearable(); }
        focus() { this._input.focus(); }
        select() { this._input.select(); }
        _bindControl(node) {
          node.addEventListener('input', () => {
            this.removeAttribute('data-invalid');
            this._syncClearable();
            this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
          });
          node.addEventListener('change', () => this.dispatchEvent(new Event('change', { bubbles: true, composed: true })));
          if (node.tagName.toLowerCase() !== 'textarea') {
            node.addEventListener('keydown', (event) => {
              if (event.key !== 'Enter' || event.isComposing) return;
              const form = this.closest('form') || this.closest('kniu-form')?.querySelector('form');
              if (!form) return;
              event.preventDefault();
              form.requestSubmit();
            });
          }
        }
        _ensureControl() {
          const wantTextarea = (this.getAttribute('type') || 'text') === 'textarea';
          const isTextarea = this._input.tagName.toLowerCase() === 'textarea';
          if (wantTextarea === isTextarea) return;
          const old = this._input;
          const value = old.value;
          const node = wantTextarea ? document.createElement('textarea') : document.createElement('input');
          node.className = 'kniu_sys_input';
          old.replaceWith(node);
          this._input = node;
          this._bindControl(node);
          this._input.value = value;
        }
        _mountAffixes() {
          const group = this.shadowRoot.querySelector('.kniu_sys_input_group');
          ['prepend', 'append'].forEach((name) => {
            const affix = this.shadowRoot.querySelector(`.kniu_sys_input_${name}`);
            const template = Array.from(this.children).find((child) => child.tagName === 'TEMPLATE' && child.hasAttribute(`#${name}`));
            let templateLabelWidth = '';
            if (template) {
              templateLabelWidth = template.getAttribute('label-width') || '';
              const frag = document.createDocumentFragment();
              const nodes = Array.from(template.content.childNodes);
              nodes.forEach((node) => {
                if (node.nodeType === 1) {
                  node.setAttribute('slot', name);
                  if (templateLabelWidth) node.dataset.labelWidth = templateLabelWidth;
                  frag.appendChild(node);
                } else if (node.nodeType === 3 && node.textContent.trim()) {
                  const span = document.createElement('span');
                  span.setAttribute('slot', name);
                  if (templateLabelWidth) span.dataset.labelWidth = templateLabelWidth;
                  span.appendChild(node);
                  frag.appendChild(span);
                }
              });
              template.replaceWith(frag);
            }
            const slotContent = this.querySelector(`[slot="${name}"]`);
            const hasSlot = Boolean(slotContent);
            const labelWidth = this.getAttribute('label-width')
              || templateLabelWidth
              || (slotContent ? (slotContent.dataset.labelWidth || slotContent.getAttribute('label-width') || '') : '');
            if (labelWidth && CSS.supports('width', labelWidth)) {
              affix.style.width = labelWidth;
              affix.style.flexBasis = labelWidth;
            } else {
              affix.style.removeProperty('width');
              affix.style.removeProperty('flex-basis');
            }
            group.dataset[`has${name[0].toUpperCase()}${name.slice(1)}`] = String(hasSlot);
          });
          ['prepend', 'append'].forEach((name) => {
            const slots = this.querySelectorAll(`[slot="${name}"]`);
            let hasUpload = false;
            let hasButton = false;
            slots.forEach((el) => {
              if (el.matches && el.matches('kniu-upload')) hasUpload = true;
              if (el.querySelector('kniu-upload')) hasUpload = true;
              if (el.matches && el.matches('kniu-btn')) {
                hasButton = true;
                el.setAttribute('block', '');
              }
              const nestedButton = el.querySelector('kniu-btn');
              if (nestedButton) {
                hasButton = true;
                nestedButton.setAttribute('block', '');
              }
            });
            if (name === 'append') group.dataset.uploadAppend = String(hasUpload);
            const cap = name[0].toUpperCase() + name.slice(1);
            group.dataset[`has${cap}Btn`] = String(hasButton);
          });
        }
        _sync() {
          this._ensureControl();
          const configuredType = this.getAttribute('type') || 'text';
          const isTextarea = this._input.tagName.toLowerCase() === 'textarea';
          const canShowPassword = !isTextarea && this.hasAttribute('show-password') && configuredType === 'password';
          if (!isTextarea) {
            this._input.type = canShowPassword && this._passwordVisible ? 'text' : configuredType;
          } else {
            const rows = this.getAttribute('rows') || this.getAttribute('row') || '3';
            this._input.setAttribute('rows', rows);
          }
          const group = this.shadowRoot.querySelector('.kniu_sys_input_group');
          if (group) group.dataset.isTextarea = String(isTextarea);
          this._wrap.dataset.showPassword = String(canShowPassword);
          this._passwordButton.innerHTML = this._passwordVisible
            ? '<svg class="kniu_sys_input_password_icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7z"></path><circle cx="12" cy="12" r="2.5"></circle></svg>'
            : '<svg class="kniu_sys_input_password_icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18"></path><path d="M10.6 10.7a2 2 0 0 0 2.7 2.7"></path><path d="M9.9 4.2A10.8 10.8 0 0 1 12 4c5.5 0 9 8 9 8a16.8 16.8 0 0 1-2.1 3.2"></path><path d="M6.2 6.2C4.1 7.7 3 12 3 12s3.5 8 9 8a10.2 10.2 0 0 0 4-.8"></path></svg>';
          this._passwordButton.setAttribute('aria-label', this._passwordVisible ? '隐藏密码' : '显示密码');
          this._wrap.dataset.clearable = String(this.hasAttribute('clearable'));
          ['name', 'placeholder', 'autocomplete', 'maxlength'].forEach((name) => {
            const value = this.getAttribute(name);
            if (value == null) this._input.removeAttribute(name);
            else this._input.setAttribute(name, value);
          });
          ['disabled', 'readonly', 'required'].forEach((name) => { this._input.toggleAttribute(name, this.hasAttribute(name)); });
          this._passwordButton.disabled = this.hasAttribute('disabled');
          this._clearButton.disabled = this.hasAttribute('disabled') || this.hasAttribute('readonly');
          this._passwordButton.setAttribute('aria-disabled', String(this._passwordButton.disabled));
          this._clearButton.setAttribute('aria-disabled', String(this._clearButton.disabled));
          this._passwordButton.tabIndex = -1;
          this._clearButton.tabIndex = -1;
          this._syncClearable();
        }
        _syncClearable() {
          if (!this._wrap || !this._clearButton) return;
          const visible = this.hasAttribute('clearable')
            && this._input.value.length > 0
            && !this.hasAttribute('disabled')
            && !this.hasAttribute('readonly');
          this._wrap.dataset.clearVisible = String(visible);
        }
      }
      customElements.define('kniu-input', KniuSysInput);
    }
    if (!customElements.get('kniu-input-group')) {
      class KniuSysInputGroup extends HTMLElement {
        static get observedAttributes() { return ['label', 'required', 'label-position', 'label-width']; }
        constructor() {
          super();
          attachComponentShadow(this);
          this._templateObserver = null;
          this.shadowRoot.innerHTML = `<style>:host{display:block}.kniu_sys_input_group{display:grid;grid-template-columns:var(--kniu-label-width,80px) minmax(0,1fr);align-items:stretch;border:1px solid #dcdfe6;border-radius:4px;overflow:hidden;background-color:#fff}.kniu_sys_input_label{padding:0 12px;background-color:#f5f7fa;border-right:1px solid #dcdfe6;color:#606266;font-size:14px;line-height:1.5;text-align:right;box-sizing:border-box;min-height:40px;display:flex;align-items:center;justify-content:flex-end}.kniu_sys_input_label[data-required="true"]::before{content:"*";margin-right:4px;color:#f56c6c}.kniu_sys_input_content{display:flex;align-items:center;min-width:0;min-height:40px;padding:0 12px;background-color:#fff}.kniu_sys_input_group[data-position="left"] .kniu_sys_input_label{justify-content:flex-start}.kniu_sys_input_group[data-position="right"] .kniu_sys_input_label{justify-content:flex-end}:host([data-template-affix="true"]) .kniu_sys_input_label{justify-content:center;text-align:center}.kniu_sys_input_group[data-position="top"]{grid-template-columns:minmax(0,1fr);align-items:stretch}.kniu_sys_input_group[data-position="top"] .kniu_sys_input_label{padding:0 0 8px;min-height:auto;display:block;text-align:left;background-color:transparent;border-right:0}.kniu_sys_input_group[data-position="top"] .kniu_sys_input_content{padding:0}.kniu_sys_input_group[data-contains-input="true"]{border:0;border-radius:0;overflow:visible;background-color:transparent}.kniu_sys_input_group[data-has-label="false"]{border:0;border-radius:0;overflow:visible;background-color:transparent;grid-template-columns:minmax(0,1fr)}.kniu_sys_input_group[data-has-label="false"] .kniu_sys_input_label{background-color:transparent;border-right:0}.kniu_sys_input_group[data-contains-input="true"] .kniu_sys_input_content,.kniu_sys_input_group[data-has-label="false"] .kniu_sys_input_content{padding:0;background-color:transparent}</style><label class="kniu_sys_input_group" data-position="right" data-has-label="false" data-contains-input="false"><span class="kniu_sys_input_content"><slot></slot></span></label>`;
        }
        connectedCallback() {
          this._mountTemplates();
          this._sync();
          this._detectInput();
          this.shadowRoot.querySelector('slot').addEventListener('slotchange', () => this._detectInput());
          if (!this._templateObserver) {
            this._templateObserver = new MutationObserver(() => {
              this._mountTemplates();
              this._sync();
              this._detectInput();
            });
            this._templateObserver.observe(this, { childList: true });
          }
          this._syncSiblingMargin();
        }
        disconnectedCallback() {
          if (this._templateObserver) this._templateObserver.disconnect();
          this._templateObserver = null;
        }
        attributeChangedCallback() { if (this.shadowRoot) this._sync(); }
        _mountTemplates() {
          const prepend = Array.from(this.children).find((child) => child.tagName === 'TEMPLATE' && child.hasAttribute('#prepend'));
          if (prepend) {
            const label = prepend.content.textContent.trim();
            const labelWidth = prepend.getAttribute('label-width');
            this.setAttribute('data-template-affix', 'true');
            if (label) this.setAttribute('label', label);
            if (labelWidth) this.setAttribute('label-width', labelWidth);
            prepend.remove();
          }
          const append = Array.from(this.children).find((child) => child.tagName === 'TEMPLATE' && child.hasAttribute('#append'));
          if (append) {
            const content = document.createDocumentFragment();
            content.append(...Array.from(append.content.childNodes));
            append.replaceWith(content);
          }
        }
        _detectInput() {
          const hasControl = this.querySelector(':scope > kniu-input, :scope > kniu-date-picker, :scope > kniu-image, :scope > kniu-switch, :scope > kniu-editor') != null;
          this.shadowRoot.querySelector('.kniu_sys_input_group').dataset.containsInput = String(hasControl);
        }
        _sync() {
          const position = ['left', 'right', 'top'].includes(this.getAttribute('label-position'))
            ? this.getAttribute('label-position')
            : 'right';
          const group = this.shadowRoot.querySelector('.kniu_sys_input_group');
          group.dataset.position = position;
          const label = (this.getAttribute('label') || '').trim();
          const hasLabel = Boolean(label);
          group.dataset.hasLabel = String(hasLabel);
          const contentEl = this.shadowRoot.querySelector('.kniu_sys_input_content');
          let labelEl = this.shadowRoot.querySelector('.kniu_sys_input_label');
          if (hasLabel) {
            if (!labelEl) {
              labelEl = document.createElement('span');
              labelEl.className = 'kniu_sys_input_label';
              group.insertBefore(labelEl, contentEl);
            }
            labelEl.textContent = label;
            labelEl.dataset.required = String(this.hasAttribute('required'));
            labelEl.style.color = this.getAttribute('data-template-affix') === 'true' ? '#909399' : '';
          } else if (labelEl) {
            labelEl.remove();
          }
          if (this.hasAttribute('label-width')) this.style.setProperty('--kniu-label-width', this.getAttribute('label-width'));
        }
        // 单个使用时不要 margin-bottom；后面紧跟同族组件（kniu-input-group / kniu-form-cell）时才加 20px 组间间距。
        // CSS :host(:has(~ ...)) 在当前 Chrome 不可用，故在 connectedCallback 中通过 nextElementSibling 检测。
        _syncSiblingMargin() {
          const next = this.nextElementSibling;
          const hasGroupNext = !!(next && (next.tagName === 'KNIU-INPUT-GROUP' || next.tagName === 'KNIU-FORM-CELL'));
          this.style.marginBottom = hasGroupNext ? '20px' : '';
        }
      }
      customElements.define('kniu-input-group', KniuSysInputGroup);
      if (!customElements.get('kniu-form-cell')) {
        class KniuSysFormCell extends KniuSysInputGroup { }
        customElements.define('kniu-form-cell', KniuSysFormCell);
      }
    }
  }

  function registerDatePickerComponent() {
    if (typeof customElements === 'undefined' || typeof HTMLElement === 'undefined') return;
    if (customElements.get('kniu-date-picker')) return;
    class KniuSysDatePicker extends HTMLElement {
      static get observedAttributes() { return ['name']; }
      constructor() {
        super();
        attachComponentShadow(this);
        this.shadowRoot.innerHTML = `<style>
          :host{display:block;width:100%}.group{display:flex;width:100%;height:40px}.input-wrap{position:relative;display:block;flex:1;min-width:0}.input{display:block;width:100%;height:40px;padding:0 38px 0 12px;border:1px solid #dcdfe6;border-radius:4px;outline:0;background-color:#fff;color:#606266;font:14px Arial,"Microsoft YaHei",sans-serif;cursor:pointer;box-sizing:border-box;transition:border-color .2s}.input:hover{border-color:#c0c4cc}.input:focus,:host([data-open="true"]) .input{position:relative;z-index:1;border-color:#409eff}.input:disabled{background-color:#f5f7fa;color:#c0c4cc;cursor:not-allowed}.calendar-icon{position:absolute;z-index:2;top:0;right:0;display:grid;width:38px;height:40px;place-items:center;color:#909399;pointer-events:none}.affix{display:none;align-items:center;justify-content:center;flex:none;padding:0 20px;border:1px solid #dcdfe6;background-color:#f5f7fa;color:#909399;font-size:14px;line-height:38px;white-space:nowrap;box-sizing:border-box}.group[data-has-prepend="true"] .prepend{display:flex;border-right:0;border-radius:4px 0 0 4px}.group[data-has-append="true"] .append{display:flex;border-left:0;border-radius:0 4px 4px 0}.group[data-has-prepend="true"] .input{border-radius:0 4px 4px 0}.group[data-has-append="true"] .input{border-radius:4px 0 0 4px}.group[data-has-prepend="true"][data-has-append="true"] .input{border-radius:0}
          .panel{position:fixed;z-index:10020;width:322px;border:1px solid #e4e7ed;border-radius:4px;background-color:#fff;box-shadow:0 2px 12px rgba(0,0,0,.1);box-sizing:border-box}.panel[hidden]{display:none}.panel[data-placement="bottom"]{transform-origin:center top}.panel[data-placement="top"]{transform-origin:center bottom}.panel[data-state="open"][data-placement="bottom"]{animation:kniu_date_in_bottom .18s ease-out both}.panel[data-state="open"][data-placement="top"]{animation:kniu_date_in_top .18s ease-out both}.panel[data-state="closing"][data-placement="bottom"]{animation:kniu_date_out_bottom .15s ease-in both}.panel[data-state="closing"][data-placement="top"]{animation:kniu_date_out_top .15s ease-in both}@keyframes kniu_date_in_bottom{from{opacity:0;transform:translateY(-8px) scaleY(.96)}to{opacity:1;transform:translateY(0) scaleY(1)}}@keyframes kniu_date_in_top{from{opacity:0;transform:translateY(8px) scaleY(.96)}to{opacity:1;transform:translateY(0) scaleY(1)}}@keyframes kniu_date_out_bottom{from{opacity:1;transform:translateY(0) scaleY(1)}to{opacity:0;transform:translateY(-6px) scaleY(.97)}}@keyframes kniu_date_out_top{from{opacity:1;transform:translateY(0) scaleY(1)}to{opacity:0;transform:translateY(6px) scaleY(.97)}}.head{display:grid;grid-template-columns:30px 30px 1fr 30px 30px;align-items:center;padding:10px 12px 4px}.head button,.day,.chooser button,.title button{border:0;background-color:transparent;color:#606266;cursor:pointer}.head>button{height:30px;border-radius:4px;font-size:17px}.head button:hover,.day:hover,.chooser button:hover,.title button:hover{color:#409eff}.title{display:flex;align-items:center;justify-content:center;gap:0;color:#303133;font-size:15px;font-weight:500}.title button{padding:6px 4px;border-radius:4px;font:inherit}.week,.days{display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin:0 12px}.week[hidden],.days[hidden],.time[hidden]{display:none}.week{border-bottom:1px solid #ebeef5}.week span{height:30px;color:#606266;font-size:12px;line-height:30px;text-align:center}.day{justify-self:center;width:30px;height:30px;padding:0;border-radius:50%;font-size:12px}.day.other{color:#c0c4cc}.day.today{color:#409eff;font-weight:600}.day.selected,.chooser button.selected{background-color:#409eff;color:#fff}.chooser{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));grid-template-rows:repeat(3,1fr);place-items:center;gap:8px;min-height:224px;padding:18px 16px}.chooser[hidden]{display:none}.chooser button{display:flex;align-items:center;justify-content:center;width:100%;height:100%;min-height:52px;padding:0;border-radius:4px;font-size:13px;text-align:center}.time{display:flex;align-items:center;justify-content:flex-end;gap:4px;padding:10px 12px;border-bottom:1px solid #ebeef5}.time::before{content:'选择时间';margin-right:auto;color:#606266;font-size:13px}.time-field{position:relative}.time-value{width:48px;height:30px;padding:0;border:1px solid #dcdfe6;border-radius:4px;background-color:#fff;color:#606266;cursor:pointer}.time-value:hover,.time-value:focus,.time-field[data-open="true"] .time-value{border-color:#409eff;outline:0}.time-options{position:absolute;top:34px;left:0;z-index:4;display:block;width:48px;max-height:168px;padding:4px 0;overflow-y:auto;border:1px solid #e4e7ed;border-radius:4px;background-color:#fff;box-shadow:0 2px 12px rgba(0,0,0,.1);box-sizing:border-box}.time-options[hidden]{display:none}.time-option{display:block;width:100%;height:28px;padding:0;border:0;background-color:#fff;color:#606266;font-size:12px;text-align:center;cursor:pointer}.time-option:hover{background-color:#f5f7fa}.time-option.selected{background-color:#ecf5ff;color:#409eff;font-weight:600}.footer{display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-top:1px solid #ebeef5}.date-preview{min-width:0;overflow:hidden;color:#606266;font-size:10px;text-overflow:ellipsis;white-space:nowrap}.footer div{display:flex;flex:none;gap:3px}.action{height:28px;padding:0 5px;border:0;border-radius:3px;background-color:#fff;color:#409eff;cursor:pointer}.action:hover{background-color:#ecf5ff}.action.primary{border:1px solid #dcdfe6;background-color:#fff;color:#606266}.action.primary:hover{color:#409eff;border-color:#c6e2ff}@media(prefers-reduced-motion:reduce){.panel[data-state]{animation:none}}@media(max-width:360px){.panel{width:calc(100vw - 16px)}}
        </style><span class="group" data-has-prepend="false" data-has-append="false"><span class="affix prepend"><slot name="prepend"></slot></span><span class="input-wrap"><input class="input" type="text" readonly placeholder="请选择日期时间"><span class="calendar-icon"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M8 3v4M16 3v4M3 10h18"></path></svg></span></span><span class="affix append"><slot name="append"></slot></span></span><section class="panel" hidden><div class="head"><button type="button" data-action="prev-year">«</button><button type="button" data-action="prev-month">‹</button><div class="title"><button type="button" data-action="choose-year"></button><button type="button" data-action="choose-month"></button></div><button type="button" data-action="next-month">›</button><button type="button" data-action="next-year">»</button></div><div class="week"><span>日</span><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span></div><div class="days"></div><div class="chooser" hidden></div><div class="time"><span class="time-field" data-time-field="hour"><button class="time-value" type="button" aria-label="小时"></button><span class="time-options" hidden></span></span><span data-time-separator="minute">:</span><span class="time-field" data-time-field="minute"><button class="time-value" type="button" aria-label="分钟"></button><span class="time-options" hidden></span></span><span data-time-separator="second">:</span><span class="time-field" data-time-field="second"><button class="time-value" type="button" aria-label="秒"></button><span class="time-options" hidden></span></span></div><div class="footer"><span class="date-preview"></span><div><button class="action" type="button" data-action="reset">重置</button><button class="action" type="button" data-action="today">现在</button><button class="action" type="button" data-action="confirm">确定</button></div></div></section>`;
        adoptSharedStyle(this.shadowRoot, '.day.disabled{color:#c0c4cc;cursor:not-allowed}.day.disabled:hover{color:#c0c4cc}');
        adoptSharedStyle(this.shadowRoot, '.head[hidden]{display:none}.time::before{content:attr(data-label)}.day[data-mark]{position:relative;font-size:11px}.day[data-mark]::after{content:"";position:absolute;top:2px;right:2px;width:4px;height:4px;border-radius:50%;background-color:#f56c6c}.day.selected[data-mark]::after{background-color:#fff}.panel[data-range="true"]{width:min(650px,calc(100vw - 16px))}.range-calendars{display:grid;grid-template-columns:repeat(2,minmax(280px,1fr));overflow-x:auto}.range-calendars[hidden]{display:none}.range-pane+ .range-pane{border-left:1px solid #ebeef5}.range-head{display:grid;grid-template-columns:30px 30px 1fr 30px 30px;align-items:center;padding:10px 12px 4px}.range-head button,.range-day,.range-chooser button,.range-title button{border:0;background-color:transparent;color:#606266;cursor:pointer}.range-head button{height:30px;border-radius:4px;font-size:17px}.range-head button:hover,.range-day:hover,.range-chooser button:hover,.range-title button:hover{color:#409eff}.range-title{display:flex;align-items:center;justify-content:center;color:#303133;font-size:15px;font-weight:500}.range-title button{padding:6px 4px;border-radius:4px;font:inherit}.range-week,.range-days{display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin:0 12px}.range-week[hidden],.range-days[hidden],.range-chooser[hidden]{display:none}.range-week{border-bottom:1px solid #ebeef5}.range-week span{height:30px;color:#606266;font-size:12px;line-height:30px;text-align:center}.range-day{position:relative;justify-self:stretch;height:30px;padding:0;font-size:12px}.range-day.other{color:#c0c4cc}.range-day.in-range{background-color:#ecf5ff;color:#409eff}.range-day.range-start,.range-day.range-end{border-radius:4px;background-color:#409eff;color:#fff}.range-day[data-mark]{font-size:11px}.range-day[data-mark]::after{content:"";position:absolute;top:2px;right:4px;width:4px;height:4px;border-radius:50%;background-color:#f56c6c}.range-day.range-start[data-mark]::after,.range-day.range-end[data-mark]::after{background-color:#fff}.range-chooser{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));grid-template-rows:repeat(3,1fr);place-items:center;gap:8px;min-height:224px;padding:18px 16px}.range-chooser button{display:flex;align-items:center;justify-content:center;width:100%;height:100%;min-height:52px;border-radius:4px;font-size:13px}.range-chooser button.selected{background-color:#409eff;color:#fff}@media(max-width:620px){.range-calendars{grid-template-columns:repeat(2,280px)}}');
        adoptSharedStyle(this.shadowRoot, '.panel,.panel[data-range="true"]{width:min(218px,calc(100vw - 16px))}.head,.range-head{grid-template-columns:24px 24px minmax(0,1fr) 24px 24px;padding:6px 6px 2px}.head>button,.range-head button{height:26px;font-size:14px}.title,.range-title{font-size:12px;white-space:nowrap}.title button,.range-title button{padding:4px 2px}.title[data-lang="en"] [data-action="choose-month"],.range-title[data-lang="en"] [data-range-choose="month"]{order:-1}.week,.days,.range-week,.range-days{gap:0;margin:0 6px}.days,.range-days{padding:4px 0}.week span,.range-week span{height:24px;font-size:10px;line-height:24px}.day,.range-day{height:26px;font-size:10px}.day{width:26px}.day[data-mark],.range-day[data-mark]{font-size:8px}.day.selected[data-mark]::after,.range-day.in-range[data-mark]::after,.range-day.range-start[data-mark]::after,.range-day.range-end[data-mark]::after{display:none}.chooser,.range-chooser{grid-template-columns:repeat(3,minmax(0,1fr));height:189px;min-height:0;padding:8px;gap:4px;box-sizing:border-box}.chooser[data-mode="year"],.range-chooser[data-mode="year"]{grid-template-rows:repeat(5,minmax(0,1fr))}.chooser[data-mode="month"],.range-chooser[data-mode="month"]{grid-template-rows:repeat(4,minmax(0,1fr))}.chooser button,.range-chooser button{min-height:0;font-size:11px}.time{gap:2px;padding:6px}.panel[data-type="datetime"] .time[hidden]{display:flex;visibility:hidden}.time::before{font-size:10px}.time-value{width:38px;height:26px;font-size:11px}.time-options{top:29px;width:38px;max-height:140px}.time-option{height:25px}.footer{padding:5px 6px}.action{width:42px;height:25px;padding:0;font-size:11px}.range-calendars{grid-template-columns:minmax(0,1fr);overflow:visible}.range-pane+ .range-pane{border-top:1px solid #ebeef5;border-left:0}');
        adoptSharedStyle(this.shadowRoot, '.panel[data-type="datetime"]{display:grid;width:min(350px,calc(100vw - 16px));grid-template-columns:minmax(0,218px) minmax(0,132px)}.panel[data-type="datetime"]>.head{grid-column:1;grid-row:1}.panel[data-type="datetime"]>.week{grid-column:1;grid-row:2}.panel[data-type="datetime"]>.days{grid-column:1;grid-row:3}.panel[data-type="datetime"]>.chooser{grid-column:1;grid-row:2 / span 2}.panel[data-type="datetime"]>.range-calendars{grid-column:1;grid-row:1 / span 3}.panel[data-type="datetime"]>.time{display:grid;grid-column:2;grid-row:1 / span 3;align-self:start;width:100%;height:223px;grid-template-columns:repeat(3,minmax(0,1fr));align-items:stretch;gap:0;padding:0;overflow:hidden;border-bottom:0;border-left:1px solid #ebeef5;box-sizing:border-box}.panel[data-type="datetime"]>.time[hidden]{display:grid;visibility:hidden}.panel[data-type="datetime"]>.time::before,.panel[data-type="datetime"]>.time>span:not(.time-field){display:none}.panel[data-type="datetime"] .time-field{display:flex;min-width:0;height:223px;overflow:hidden;flex-direction:column;border-left:1px solid #ebeef5;box-sizing:border-box}.panel[data-type="datetime"] .time-field:first-of-type{border-left:0}.panel[data-type="datetime"] .time-field::before{content:attr(data-label);display:block;flex:none;height:34px;border-bottom:1px solid #ebeef5;color:#606266;font-size:10px;line-height:34px;text-align:center;box-sizing:border-box}.panel[data-type="datetime"] .time-value{display:none}.panel[data-type="datetime"] .time-options,.panel[data-type="datetime"] .time-options[hidden]{position:static;display:block;width:100%;height:189px;max-height:189px;padding:0;overflow-x:hidden;overflow-y:auto;border:0;border-radius:0;background-color:#fff;box-shadow:none;box-sizing:border-box}.panel[data-type="datetime"] .time-option{height:25px}.panel[data-type="datetime"]>.footer{grid-column:1 / -1;grid-row:4}.panel[data-type="datetime"][data-range="true"]{width:min(350px,calc(100vw - 16px))}');
        adoptSharedStyle(this.shadowRoot, '.panel[data-type="datetime"]:not([data-range="true"])>.head{grid-column:1 / -1;grid-row:1}.panel[data-type="datetime"]:not([data-range="true"])>.time{grid-column:2;grid-row:2 / span 2;height:189px}.panel[data-type="datetime"]:not([data-range="true"]) .time-field{height:189px}.panel[data-type="datetime"]:not([data-range="true"]) .time-field::before{height:25px;line-height:25px}.panel[data-type="datetime"]:not([data-range="true"]) .time-options,.panel[data-type="datetime"]:not([data-range="true"]) .time-options[hidden]{height:164px;max-height:164px}');
        adoptSharedStyle(this.shadowRoot, '.panel[data-type="datetime"] .time-options{scrollbar-width:none}.panel[data-type="datetime"] .time-options:hover{scrollbar-width:thin;scrollbar-color:#c0c4cc transparent}.panel[data-type="datetime"] .time-options::-webkit-scrollbar{width:0}.panel[data-type="datetime"] .time-options:hover::-webkit-scrollbar{width:6px}.panel[data-type="datetime"] .time-options::-webkit-scrollbar-thumb{border-radius:6px;background-color:#c0c4cc}.panel[data-type="datetime"] .time-options::-webkit-scrollbar-track{background-color:transparent}');
        adoptSharedStyle(this.shadowRoot, '.panel[data-type="datetime"]>.time{position:relative;border-left:0}.panel[data-type="datetime"] .time-field{border-left:0}.panel[data-type="datetime"] .time-field::before{border-bottom:0}.panel[data-type="datetime"] .time-field:not(:first-of-type) .time-options{border-left:1px solid #dcdfe6}.panel[data-type="datetime"]>.time::after{content:"";position:absolute;z-index:2;top:34px;right:0;bottom:0;left:0;border:1px solid #dcdfe6;pointer-events:none;box-sizing:border-box}.panel[data-type="datetime"]:not([data-range="true"])>.time::after{top:25px}');
        adoptSharedStyle(this.shadowRoot, '.week,.range-week{border-bottom:0}');
        adoptSharedStyle(this.shadowRoot, '.head,.range-head{border-bottom:1px solid #ebeef5}');
        adoptSharedStyle(this.shadowRoot, '.panel[data-type="datetime"] .time-options,.panel[data-type="datetime"] .time-options[hidden]{border:1px solid #dcdfe6}.panel[data-type="datetime"]>.time::after{display:none}');
        adoptSharedStyle(this.shadowRoot, '.panel[data-type="datetime"] .time-field:not(:first-of-type) .time-options{border-left:0}.panel[data-type="datetime"] .time-options,.panel[data-type="datetime"] .time-options[hidden]{height:185px;max-height:185px}.panel[data-type="datetime"]:not([data-range="true"]) .time-options,.panel[data-type="datetime"]:not([data-range="true"]) .time-options[hidden]{height:160px;max-height:160px}');
        adoptSharedStyle(this.shadowRoot, '.panel[data-type="datetime"]>.time[data-show-hour="false"] [data-time-field="minute"] .time-options,.panel[data-type="datetime"]>.time[data-show-hour="false"][data-show-minute="false"] [data-time-field="second"] .time-options{border-left:1px solid #dcdfe6!important}');
        adoptSharedStyle(this.shadowRoot, '.panel[data-type="datetime"]>.time{padding-right:4px}');
        adoptSharedStyle(this.shadowRoot, '.panel[hidden]{display:none!important}');
        adoptSharedStyle(this.shadowRoot, '.time[data-show-seconds="false"]{grid-template-columns:repeat(2,minmax(0,1fr))}.time[data-show-seconds="false"] [data-time-field="second"],.time[data-show-seconds="false"] [data-time-separator="second"]{display:none!important}');
        adoptSharedStyle(this.shadowRoot, '.panel[data-type="datetime"][data-show-seconds="false"]{width:min(306px,calc(100vw - 16px));grid-template-columns:minmax(0,218px) minmax(0,88px)}.panel[data-type="datetime"][data-show-seconds="false"]>.time{grid-template-columns:repeat(2,minmax(0,1fr))}.panel[data-type="datetime"][data-range="true"][data-show-seconds="false"]{width:min(306px,calc(100vw - 16px))}');
        adoptSharedStyle(this.shadowRoot, '.time[data-show-hour="false"] [data-time-field="hour"],.time[data-show-minute="false"] [data-time-field="minute"],.time[data-show-seconds="false"] [data-time-field="second"]{display:none!important}.time[data-show-minute-separator="false"] [data-time-separator="minute"],.time[data-show-second-separator="false"] [data-time-separator="second"]{display:none!important}.panel[data-type="datetime"][data-time-columns="1"]{width:min(262px,calc(100vw - 16px))!important;grid-template-columns:minmax(0,218px) minmax(0,44px)!important}.panel[data-type="datetime"][data-time-columns="2"]{width:min(306px,calc(100vw - 16px))!important;grid-template-columns:minmax(0,218px) minmax(0,88px)!important}.panel[data-type="datetime"][data-time-columns="3"]{width:min(350px,calc(100vw - 16px))!important;grid-template-columns:minmax(0,218px) minmax(0,132px)!important}.panel[data-type="datetime"]>.time[data-time-columns="1"]{grid-template-columns:minmax(0,1fr)!important}.panel[data-type="datetime"]>.time[data-time-columns="2"]{grid-template-columns:repeat(2,minmax(0,1fr))!important}.panel[data-type="datetime"]>.time[data-time-columns="3"]{grid-template-columns:repeat(3,minmax(0,1fr))!important}');
        this._input = this.shadowRoot.querySelector('.input');
        this._panel = this.shadowRoot.querySelector('.panel');
        this._days = this.shadowRoot.querySelector('.days');
        this._title = this.shadowRoot.querySelector('.title');
        this._chooser = this.shadowRoot.querySelector('.chooser');
        this._rangeCalendars = document.createElement('div');
        this._rangeCalendars.className = 'range-calendars';
        this._rangeCalendars.hidden = true;
        this._rangeCalendars.innerHTML = `<section class="range-pane" data-range-pane="left"><div class="range-head"><button type="button" data-range-action="prev-year">«</button><button type="button" data-range-action="prev-month">‹</button><div class="range-title"><button type="button" data-range-choose="year"></button><button type="button" data-range-choose="month"></button></div><span></span><span></span></div><div class="range-week"></div><div class="range-days"></div><div class="range-chooser" hidden></div></section><section class="range-pane" data-range-pane="right"><div class="range-head"><span></span><span></span><div class="range-title"><button type="button" data-range-choose="year"></button><button type="button" data-range-choose="month"></button></div><button type="button" data-range-action="next-month">›</button><button type="button" data-range-action="next-year">»</button></div><div class="range-week"></div><div class="range-days"></div><div class="range-chooser" hidden></div></section>`;
        this._chooser.after(this._rangeCalendars);
        this._panel.insertBefore(this._panel.querySelector('.time'), this._panel.querySelector('.head'));
        this._panelMode = 'day';
        this._draft = new Date();
        this._preferredDay = this._draft.getDate();
        this._viewYear = this._draft.getFullYear();
        this._viewMonth = this._draft.getMonth();
        this._panelMode = 'day';
        this._outsideHandler = (event) => {
          const path = event.composedPath();
          if (!path.includes(this) && !path.includes(this._panel)) this._close();
        };
        this._positionHandler = () => { if (!this._panel.hidden) this._positionPanel(); };
        this._positionTimer = null;
        this._positionFrame = 0;
        this._lastAnchorRect = '';
        this._animationTimer = null;
        this._options = {};
        this._rangeValue = ['', ''];
        this._rangePhase = 'start';
        this._rangeChooser = { pane: '', mode: '' };
        this._input.addEventListener('click', () => this._open());
        this._input.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') { event.preventDefault(); this._open(); }
          if (event.key === 'Escape') this._close();
        });
        this._panel.addEventListener('click', (event) => this._handleClick(event));
        ['hour', 'minute', 'second'].forEach((unit) => {
          const options = this._panel.querySelector(`[data-time-field="${unit}"] .time-options`);
          const max = unit === 'hour' ? 23 : 59;
          for (let number = 0; number <= max; number += 1) {
            const option = document.createElement('button');
            option.type = 'button'; option.className = 'time-option'; option.dataset.timeOption = unit; option.dataset.value = String(number);
            option.textContent = String(number).padStart(2, '0');
            options.appendChild(option);
          }
        });
      }
      connectedCallback() { this._mountAffixes(); this._mountPortal(); this._sync(); }
      disconnectedCallback() {
        this._removeGlobalListeners();
        if (this._portal?.isConnected) {
          this.shadowRoot.appendChild(this._panel);
          this._portal.remove();
        }
        this._portal = null;
      }
      attributeChangedCallback() { if (this._input) { this._mountAffixes(); this._sync(); } }
      get value() { return this._options.range === true ? [...this._rangeValue] : (this._input.dataset.value || ''); }
      set value(value) {
        if (this._options.range === true) {
          const values = Array.isArray(value) ? value : String(value || '').split(this._options.rangeSeparator || ',').slice(0, 2);
          this._rangeValue = [values[0] || '', values[1] || ''].map((item) => {
            const parsed = this._parse(item);
            return parsed ? this._format(parsed) : '';
          });
          this._syncRangeDisplay();
          return;
        }
        const text = value == null ? '' : String(value);
        const date = this._parse(text);
        this._input.dataset.value = date ? this._format(date) : '';
        this._input.value = date ? this._formatDisplay(date) : '';
      }
      focus() { this._input.focus(); }
      open() { this._open(); }
      close() { this._close(); }
      get options() { return this._options; }
      set options(value) {
        const currentValue = this.value;
        this._options = value && typeof value === 'object' ? value : {};
        if ((Array.isArray(currentValue) && currentValue.some(Boolean)) || (!Array.isArray(currentValue) && currentValue)) this.value = currentValue;
        else if (this._options.value != null) this.value = this._options.value;
        if (this._input) this._sync();
        if (this.isConnected && !this._panel.hidden) this._render();
      }
      _mountPortal() {
        if (this._portal?.isConnected) return;
        const portal = document.createElement('span');
        portal.setAttribute('data-kniu-date-picker-portal', '');
        portal.style.cssText = 'position:fixed;inset:0;z-index:10020;display:block;width:0;height:0;pointer-events:none';
        const root = portal.attachShadow({ mode: 'open' });
        if (supportsAdoptedStyleSheets(root) && this.shadowRoot.adoptedStyleSheets?.length) {
          root.adoptedStyleSheets = [...this.shadowRoot.adoptedStyleSheets];
        } else {
          this.shadowRoot.querySelectorAll('style').forEach((style) => root.appendChild(style.cloneNode(true)));
        }
        this._panel.style.pointerEvents = 'auto';
        root.appendChild(this._panel);
        document.body.appendChild(portal);
        this._portal = portal;
      }
      _mountAffixes() {
        const group = this.shadowRoot.querySelector('.group');
        ['prepend', 'append'].forEach((name) => {
          const template = Array.from(this.children).find((child) => child.tagName === 'TEMPLATE' && child.hasAttribute(`#${name}`));
          let templateWidth = '';
          if (template) {
            templateWidth = template.getAttribute('label-width') || '';
            const fragment = document.createDocumentFragment();
            Array.from(template.content.childNodes).forEach((node) => {
              if (node.nodeType === 3 && !node.textContent.trim()) return;
              const item = node.nodeType === 3 ? document.createElement('span') : node;
              if (node.nodeType === 3) item.textContent = node.textContent;
              item.setAttribute('slot', name);
              if (templateWidth) item.dataset.labelWidth = templateWidth;
              fragment.appendChild(item);
            });
            template.replaceWith(fragment);
          }
          const content = this.querySelector(`[slot="${name}"]`);
          const affix = this.shadowRoot.querySelector(`.${name}`);
          const width = templateWidth || content?.dataset.labelWidth || '';
          group.dataset[`has${name[0].toUpperCase()}${name.slice(1)}`] = String(Boolean(content));
          if (width && CSS.supports('width', width)) { affix.style.width = width; affix.style.flexBasis = width; }
        });
      }
      _sync() {
        const name = this._options.name;
        if (name == null) this._input.removeAttribute('name'); else this._input.name = name;
        this._input.placeholder = this._options.placeholder || (this._options.range === true ? '请选择开始和结束时间' : (this._options.type === 'datetime' ? '请选择日期时间' : (this._options.type === 'time' ? '请选择时间' : '请选择日期')));
        this._input.disabled = this._options.disabled === true;
        this._input.required = this._options.required === true;
        if (this._options.disabled === true || this._options.readonly === true) this._close();
      }
      _parse(value) {
        const timeMatch = String(value || '').trim().match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);
        if (timeMatch) {
          const now = new Date();
          now.setHours(+timeMatch[1], +timeMatch[2], +(timeMatch[3] || 0), 0);
          return now;
        }
        const match = String(value || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
        if (!match) return null;
        const date = new Date(+match[1], +match[2] - 1, +match[3], +(match[4] || 0), +(match[5] || 0), +(match[6] || 0));
        return Number.isNaN(date.getTime()) ? null : date;
      }
      _format(date) {
        const pad = (number) => String(number).padStart(2, '0');
        if (this._options.type === 'time') return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
        const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
        return this._options.type === 'datetime' ? `${day} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` : day;
      }
      _formatDisplay(date) {
        const pad = (number) => String(number).padStart(2, '0');
        const format = this._normalizeFormat(this._options.format || (this._options.type === 'datetime' ? 'yyyy-MM-dd HH:mm:ss' : (this._options.type === 'time' ? 'HH:mm:ss' : 'yyyy-MM-dd')));
        return format
          .replace(/yyyy/g, String(date.getFullYear()))
          .replace(/MM/g, pad(date.getMonth() + 1))
          .replace(/mm|ii/g, pad(date.getMinutes()))
          .replace(/dd/g, pad(date.getDate()))
          .replace(/HH|hh/g, pad(date.getHours()))
          .replace(/ii/g, pad(date.getMinutes()))
          .replace(/ss/g, pad(date.getSeconds()));
      }
      _normalizeFormat(value) {
        const format = String(value || '');
        const colonIndex = format.indexOf(':');
        let timeStart = Number.POSITIVE_INFINITY;
        if (colonIndex >= 0) {
          const prefix = format.slice(0, colonIndex);
          const separatorIndex = Math.max(prefix.lastIndexOf(' '), prefix.lastIndexOf('T'), prefix.lastIndexOf('t'));
          if (separatorIndex >= 0) timeStart = separatorIndex + 1;
          else if (this._options.type === 'time' || !/[yYdD]/.test(prefix)) timeStart = 0;
          else {
            const hourIndex = prefix.search(/[hH]/);
            if (hourIndex >= 0) timeStart = hourIndex;
          }
        }
        return format.replace(/(?:[yY]+|[mM]+|[iI]+|[dD]+|[hH]+|[sS]+)/g, (token, offset) => {
          const unit = token[0].toLowerCase();
          if (unit === 'y' || unit === 'i' || unit === 'd' || unit === 's') return token.toLowerCase();
          if (unit === 'h') return token.toUpperCase();
          if (unit === 'm') return offset >= timeStart ? token.toLowerCase() : token.toUpperCase();
          return token;
        });
      }
      _syncRangeDisplay() {
        const display = this._rangeValue.map((item) => {
          const parsed = this._parse(item);
          return parsed ? this._formatDisplay(parsed) : '';
        });
        this._input.dataset.value = this._rangeValue.join(this._options.rangeSeparator || ',');
        this._input.value = display.filter(Boolean).join(this._options.displaySeparator || ' 至 ');
      }
      _firstDayOfWeek() {
        return Number(this._options.weekStart) === 0 ? 0 : 1;
      }
      _open() {
        if (this._options.disabled === true || this._options.readonly === true) return;
        if (this._animationTimer) globalThis.clearTimeout(this._animationTimer);
        this._animationTimer = null;
        this._mountPortal();
        this._draft = this._parse(this.value) || new Date();
        if (this._options.range === true) {
          this._rangeChooser = { pane: '', mode: '' };
          this._rangePhase = this._rangeValue[0] && !this._rangeValue[1] ? 'end' : 'start';
          const activeValue = this._rangePhase === 'end' ? this._rangeValue[0] : this._rangeValue[0];
          this._draft = this._parse(activeValue) || new Date();
        }
        this._preferredDay = this._draft.getDate();
        this._viewYear = this._draft.getFullYear();
        this._viewMonth = this._draft.getMonth();
        this._render();
        this._panel.hidden = false;
        this.dataset.open = 'true';
        this._positionPanel();
        delete this._panel.dataset.state;
        void this._panel.offsetWidth;
        this._panel.dataset.state = 'open';
        this._startPositionTracking();
        // 用户可能在模态框 250ms 入场动画尚未结束时立即打开日历。
        // 动画期间 transform 会临时改变 fixed 的坐标系，结束后再以视口坐标强制校正一次。
        if (this._positionTimer) globalThis.clearTimeout(this._positionTimer);
        this._positionTimer = globalThis.setTimeout(() => {
          this._positionTimer = null;
          if (!this._panel.hidden) this._positionPanel();
        }, 280);
        globalThis.addEventListener('pointerdown', this._outsideHandler, true);
        globalThis.addEventListener('resize', this._positionHandler);
        globalThis.addEventListener('scroll', this._positionHandler, true);
      }
      _close() {
        if (this._panel.hidden || this._panel.dataset.state === 'closing') return;
        delete this.dataset.open;
        if (this._positionTimer) globalThis.clearTimeout(this._positionTimer);
        this._positionTimer = null;
        this._removeGlobalListeners();
        this._closeTimeMenus();
        const finish = () => {
          if (this._animationTimer) globalThis.clearTimeout(this._animationTimer);
          this._animationTimer = null;
          this._panel.hidden = true;
          delete this._panel.dataset.state;
          if (this._positionFrame) globalThis.cancelAnimationFrame(this._positionFrame);
          this._positionFrame = 0;
          this._lastAnchorRect = '';
        };
        if (globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { finish(); return; }
        this._panel.dataset.state = 'closing';
        this._animationTimer = globalThis.setTimeout(finish, 170);
      }
      _removeGlobalListeners() {
        globalThis.removeEventListener('pointerdown', this._outsideHandler, true);
        globalThis.removeEventListener('resize', this._positionHandler);
        globalThis.removeEventListener('scroll', this._positionHandler, true);
      }
      _positionPanel() {
        const rect = this._input.getBoundingClientRect();
        const width = Math.min(this._panel.offsetWidth || 322, globalThis.innerWidth - 16);
        let left = Math.min(rect.left, globalThis.innerWidth - width - 8);
        left = Math.max(8, left);
        const panelHeight = this._panel.offsetHeight || 390;
        const spaceBelow = globalThis.innerHeight - rect.bottom - 8;
        const spaceAbove = rect.top - 8;
        // 默认向下；仅下方不足且上方足够时向上。若上下都不足，仍按默认向下显示。
        const placement = spaceBelow < panelHeight && spaceAbove >= panelHeight ? 'top' : 'bottom';
        const viewportTop = placement === 'top' ? rect.top - panelHeight - 6 : rect.bottom + 6;
        this._panel.dataset.placement = placement;
        this._panel.style.left = `${left}px`;
        this._panel.style.top = `${viewportTop}px`;
      }
      _startPositionTracking() {
        if (this._positionFrame) globalThis.cancelAnimationFrame(this._positionFrame);
        const track = () => {
          if (this._panel.hidden || !this.isConnected) {
            this._positionFrame = 0;
            return;
          }
          const rect = this._input.getBoundingClientRect();
          const key = `${rect.left},${rect.top},${rect.right},${rect.bottom},${globalThis.innerWidth},${globalThis.innerHeight}`;
          if (key !== this._lastAnchorRect) {
            this._lastAnchorRect = key;
            this._positionPanel();
          }
          this._positionFrame = globalThis.requestAnimationFrame(track);
        };
        this._positionFrame = globalThis.requestAnimationFrame(track);
      }
      _render() {
        const isEnglish = String(this._options.lang || 'cn').toLowerCase() === 'en';
        const rangeMode = this._options.range === true;
        const yearPageStart = this._viewYear - 7;
        const yearTitle = this._title.querySelector('[data-action="choose-year"]');
        const monthTitle = this._title.querySelector('[data-action="choose-month"]');
        const monthNames = isEnglish ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] : null;
        this._title.dataset.lang = isEnglish ? 'en' : 'cn';
        yearTitle.textContent = isEnglish ? String(this._viewYear) : `${this._viewYear} 年`;
        monthTitle.textContent = isEnglish ? monthNames[this._viewMonth] : `${this._viewMonth + 1} 月`;
        monthTitle.hidden = false;
        const timeOnly = this._options.type === 'time';
        const choosing = this._panelMode !== 'day';
        const week = this._panel.querySelector('.week');
        const weekLabels = isEnglish
          ? (this._firstDayOfWeek() === 1 ? ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] : ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'])
          : (this._firstDayOfWeek() === 1 ? ['一', '二', '三', '四', '五', '六', '日'] : ['日', '一', '二', '三', '四', '五', '六']);
        week.replaceChildren(...weekLabels.map((label) => {
          const item = document.createElement('span');
          item.textContent = label;
          return item;
        }));
        week.hidden = choosing || timeOnly || rangeMode;
        this._days.hidden = choosing || timeOnly || rangeMode;
        this._chooser.hidden = rangeMode || !choosing;
        this._chooser.dataset.mode = this._panelMode;
        this._rangeCalendars.hidden = !rangeMode;
        this._chooser.replaceChildren();
        if (this._panelMode === 'year') {
          const startYear = yearPageStart;
          for (let year = startYear; year < startYear + 15; year += 1) {
            const button = document.createElement('button');
            button.type = 'button'; button.textContent = isEnglish ? String(year) : `${year} 年`; button.dataset.year = String(year);
            if (year === this._viewYear) button.classList.add('selected');
            this._chooser.appendChild(button);
          }
        } else if (this._panelMode === 'month') {
          for (let month = 0; month < 12; month += 1) {
            const button = document.createElement('button');
            button.type = 'button'; button.textContent = isEnglish ? monthNames[month] : `${month + 1} 月`; button.dataset.month = String(month);
            if (month === this._viewMonth) button.classList.add('selected');
            this._chooser.appendChild(button);
          }
        }
        const first = new Date(this._viewYear, this._viewMonth, 1);
        const leadingDays = (first.getDay() - this._firstDayOfWeek() + 7) % 7;
        const start = new Date(this._viewYear, this._viewMonth, 1 - leadingDays);
        const today = new Date();
        this._days.replaceChildren();
        for (let index = 0; index < 42; index += 1) {
          const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
          const button = document.createElement('button');
          button.type = 'button'; button.className = 'day'; button.textContent = String(date.getDate());
          button.dataset.date = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
          if (date.getMonth() !== this._viewMonth) button.classList.add('other');
          if (this._isDateDisabled(date)) { button.disabled = true; button.classList.add('disabled'); }
          if (this._sameDay(date, today)) button.classList.add('today');
          const mark = this._resolveMark(date);
          if (mark) { button.dataset.mark = mark; button.title = mark; button.textContent = mark; }
          // 月份/年份翻页时保留已选“日号”，只高亮当前视图月份中的同一日，
          // 避免相邻月份占位格出现重复高亮。
          const selectedDay = Math.min(this._preferredDay, new Date(this._viewYear, this._viewMonth + 1, 0).getDate());
          if (date.getFullYear() === this._viewYear
            && date.getMonth() === this._viewMonth
            && date.getDate() === selectedDay) button.classList.add('selected');
          this._days.appendChild(button);
        }
        this._panel.querySelector('.head').hidden = timeOnly || rangeMode;
        this._chooser.hidden = timeOnly || rangeMode || !choosing;
        this._panel.dataset.range = String(rangeMode);
        this._panel.dataset.type = this._options.type || 'date';
        if (rangeMode) this._renderRangeCalendars(isEnglish);
        const timePanel = this._panel.querySelector('.time');
        const displayFormat = this._normalizeFormat(this._options.format || (this._options.type === 'datetime' ? 'yyyy-MM-dd HH:mm:ss' : 'HH:mm:ss'));
        const showHour = /HH|hh/.test(displayFormat);
        const showMinute = /mm|ii/.test(displayFormat);
        const showSeconds = /ss/.test(displayFormat);
        const timeColumns = Math.max(1, [showHour, showMinute, showSeconds].filter(Boolean).length);
        timePanel.hidden = choosing || !['datetime', 'time'].includes(this._options.type);
        timePanel.dataset.label = isEnglish ? 'Select time' : '选择时间';
        timePanel.dataset.showHour = String(showHour);
        timePanel.dataset.showMinute = String(showMinute);
        timePanel.dataset.showSeconds = String(showSeconds);
        timePanel.dataset.showMinuteSeparator = String(showHour && showMinute);
        timePanel.dataset.showSecondSeparator = String(showSeconds && (showHour || showMinute));
        timePanel.dataset.timeColumns = String(timeColumns);
        this._panel.dataset.showSeconds = timePanel.dataset.showSeconds;
        this._panel.dataset.timeColumns = String(timeColumns);
        const timeLabels = isEnglish ? { hour: 'Hr', minute: 'Min', second: 'Sec' } : { hour: '时', minute: '分', second: '秒' };
        Object.entries(timeLabels).forEach(([unit, label]) => {
          this._panel.querySelector(`[data-time-field="${unit}"]`).dataset.label = label;
        });
        this._panel.querySelector('[data-action="reset"]').textContent = isEnglish ? 'Reset' : '重置';
        this._panel.querySelector('[data-action="today"]').textContent = isEnglish ? 'Now' : '现在';
        this._panel.querySelector('[data-action="confirm"]').textContent = isEnglish ? 'Confirm' : '确定';
        const preview = this._panel.querySelector('.date-preview');
        if (rangeMode) {
          preview.textContent = this._rangeValue.map((item) => {
            const parsed = this._parse(item);
            return parsed ? this._formatDisplay(parsed) : '';
          }).filter(Boolean).join(this._options.displaySeparator || ' 至 ');
        } else {
          const previewDate = new Date(this._draft);
          const previewDay = Math.min(this._preferredDay, new Date(this._viewYear, this._viewMonth + 1, 0).getDate());
          previewDate.setDate(1);
          previewDate.setFullYear(this._viewYear, this._viewMonth, previewDay);
          preview.textContent = this._formatDisplay(previewDate);
        }
        preview.title = preview.textContent;
        const values = { hour: this._draft.getHours(), minute: this._draft.getMinutes(), second: this._draft.getSeconds() };
        Object.entries(values).forEach(([unit, value]) => {
          const field = this._panel.querySelector(`[data-time-field="${unit}"]`);
          const button = field.querySelector('.time-value');
          button.dataset.value = String(value);
          button.textContent = String(value).padStart(2, '0');
          field.querySelectorAll('.time-option').forEach((option) => option.classList.toggle('selected', Number(option.dataset.value) === value));
          if (this._options.type === 'datetime' && !choosing) {
            queueMicrotask(() => field.querySelector('.time-option.selected')?.scrollIntoView({ block: 'center' }));
          }
        });
      }
      _sameDay(left, right) { return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate(); }
      _resolveMark(date) {
        const marks = this._options.mark && typeof this._options.mark === 'object' ? this._options.mark : {};
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const keys = [`${year}-${month}-${day}`, `0-${month}-${day}`, `${year}-0-${day}`, `0-0-${day}`];
        const key = keys.find((item) => marks[item] != null);
        return key ? String(marks[key]) : '';
      }
      _renderRangeCalendars(isEnglish) {
        const weekLabels = isEnglish
          ? (this._firstDayOfWeek() === 1 ? ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] : ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'])
          : (this._firstDayOfWeek() === 1 ? ['一', '二', '三', '四', '五', '六', '日'] : ['日', '一', '二', '三', '四', '五', '六']);
        const panes = [
          { name: 'left', year: this._viewYear, month: this._viewMonth },
          { name: 'right', year: this._viewMonth === 11 ? this._viewYear + 1 : this._viewYear, month: (this._viewMonth + 1) % 12 }
        ];
        const rangeStart = this._parse(this._rangeValue[0]);
        const rangeEnd = this._parse(this._rangeValue[1]);
        panes.forEach((paneData) => {
          const pane = this._rangeCalendars.querySelector(`[data-range-pane="${paneData.name}"]`);
          const monthNames = isEnglish ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] : null;
          const choosing = this._rangeChooser.pane === paneData.name ? this._rangeChooser.mode : '';
          const yearPageStart = paneData.year - 7;
          const title = pane.querySelector('.range-title');
          const yearButton = pane.querySelector('[data-range-choose="year"]');
          const monthButton = pane.querySelector('[data-range-choose="month"]');
          title.dataset.lang = isEnglish ? 'en' : 'cn';
          yearButton.textContent = isEnglish ? String(paneData.year) : `${paneData.year} 年`;
          monthButton.textContent = isEnglish ? monthNames[paneData.month] : `${paneData.month + 1} 月`;
          monthButton.hidden = false;
          const week = pane.querySelector('.range-week');
          week.replaceChildren(...weekLabels.map((label) => {
            const item = document.createElement('span'); item.textContent = label; return item;
          }));
          const days = pane.querySelector('.range-days');
          days.replaceChildren();
          week.hidden = Boolean(choosing);
          days.hidden = Boolean(choosing);
          const chooser = pane.querySelector('.range-chooser');
          chooser.hidden = !choosing;
          chooser.dataset.mode = choosing || 'day';
          chooser.replaceChildren();
          if (choosing === 'year') {
            for (let year = yearPageStart; year < yearPageStart + 15; year += 1) {
              const button = document.createElement('button');
              button.type = 'button'; button.dataset.rangeYear = String(year); button.dataset.pane = paneData.name;
              button.textContent = isEnglish ? String(year) : `${year} 年`;
              if (year === paneData.year) button.classList.add('selected');
              chooser.appendChild(button);
            }
          } else if (choosing === 'month') {
            for (let month = 0; month < 12; month += 1) {
              const button = document.createElement('button');
              button.type = 'button'; button.dataset.rangeMonth = String(month); button.dataset.pane = paneData.name;
              button.textContent = isEnglish ? monthNames[month] : `${month + 1} 月`;
              if (month === paneData.month) button.classList.add('selected');
              chooser.appendChild(button);
            }
          }
          const first = new Date(paneData.year, paneData.month, 1);
          const leadingDays = (first.getDay() - this._firstDayOfWeek() + 7) % 7;
          const start = new Date(paneData.year, paneData.month, 1 - leadingDays);
          for (let index = 0; index < 42; index += 1) {
            const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
            const button = document.createElement('button');
            button.type = 'button'; button.className = 'range-day';
            button.dataset.rangeDate = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
            button.textContent = String(date.getDate());
            if (date.getMonth() !== paneData.month) button.classList.add('other');
            if (this._isDateDisabled(date)) { button.disabled = true; button.classList.add('disabled'); }
            if (rangeStart && this._sameDay(date, rangeStart)) button.classList.add('range-start');
            if (rangeEnd && this._sameDay(date, rangeEnd)) button.classList.add('range-end');
            if (rangeStart && rangeEnd && date > rangeStart && date < rangeEnd) button.classList.add('in-range');
            const mark = this._resolveMark(date);
            if (mark) { button.dataset.mark = mark; button.title = mark; button.textContent = mark; }
            days.appendChild(button);
          }
        });
      }
      _isDateDisabled(date) {
        const dayValue = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
        const rangeMin = this._options.range === true && this._rangePhase === 'end' ? this._rangeValue[0] : null;
        const min = this._parse(rangeMin || this._options.min);
        const max = this._parse(this._options.max);
        const minValue = min ? new Date(min.getFullYear(), min.getMonth(), min.getDate()).getTime() : null;
        const maxValue = max ? new Date(max.getFullYear(), max.getMonth(), max.getDate()).getTime() : null;
        return (minValue != null && dayValue < minValue) || (maxValue != null && dayValue > maxValue);
      }
      _setDraftTime() {
        const timePanel = this._panel.querySelector('.time');
        const hours = timePanel.dataset.showHour === 'true' ? +this._panel.querySelector('[data-time-field="hour"] .time-value').dataset.value : 0;
        const minutes = timePanel.dataset.showMinute === 'true' ? +this._panel.querySelector('[data-time-field="minute"] .time-value').dataset.value : 0;
        const seconds = timePanel.dataset.showSeconds === 'true' ? +this._panel.querySelector('[data-time-field="second"] .time-value').dataset.value : 0;
        this._draft.setHours(hours, minutes, seconds, 0);
      }
      _handleClick(event) {
        const rangeChoose = event.target.closest('[data-range-choose]');
        if (rangeChoose) {
          const pane = rangeChoose.closest('[data-range-pane]').dataset.rangePane;
          this._rangeChooser = { pane: pane, mode: rangeChoose.dataset.rangeChoose };
          this._render();
          return;
        }
        const rangeYear = event.target.closest('[data-range-year]');
        if (rangeYear) {
          const pane = rangeYear.dataset.pane;
          const paneDate = this._getRangePaneDate(pane);
          this._setRangePaneView(pane, Number(rangeYear.dataset.rangeYear), paneDate.month);
          this._rangeChooser = { pane: pane, mode: 'month' };
          this._render();
          return;
        }
        const rangeMonth = event.target.closest('[data-range-month]');
        if (rangeMonth) {
          const pane = rangeMonth.dataset.pane;
          const paneDate = this._getRangePaneDate(pane);
          this._setRangePaneView(pane, paneDate.year, Number(rangeMonth.dataset.rangeMonth));
          this._rangeChooser = { pane: '', mode: '' };
          this._render();
          return;
        }
        const rangeDay = event.target.closest('[data-range-date]');
        if (rangeDay) {
          const [year, month, day] = rangeDay.dataset.rangeDate.split('-').map(Number);
          this._draft.setFullYear(year, month - 1, day);
          this._preferredDay = day;
          this._setDraftTime();
          const selectedValue = this._format(this._draft);
          if (this._rangePhase === 'start' || (this._rangeValue[0] && this._rangeValue[1])) {
            this._rangeValue = [selectedValue, ''];
            this._rangePhase = 'end';
          } else {
            this._rangeValue[1] = selectedValue;
            if (this._rangeValue[1] < this._rangeValue[0]) this._rangeValue.reverse();
            this._rangePhase = 'complete';
          }
          this._syncRangeDisplay();
          this._render();
          this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
          this.dispatchEvent(new CustomEvent('change', { detail: { value: this.value, kind: this._rangePhase === 'end' ? 'start-change' : 'end-change' }, bubbles: true, composed: true }));
          return;
        }
        const rangeAction = event.target.closest('[data-range-action]')?.dataset.rangeAction;
        if (rangeAction) {
          const pane = event.target.closest('[data-range-pane]').dataset.rangePane;
          const paneDate = this._getRangePaneDate(pane);
          const target = new Date(paneDate.year, paneDate.month, 1);
          if (rangeAction === 'prev-year') target.setFullYear(target.getFullYear() - 1);
          if (rangeAction === 'next-year') target.setFullYear(target.getFullYear() + 1);
          if (rangeAction === 'prev-month') target.setMonth(target.getMonth() - 1);
          if (rangeAction === 'next-month') target.setMonth(target.getMonth() + 1);
          this._setRangePaneView(pane, target.getFullYear(), target.getMonth());
          this._render();
          return;
        }
        const timeOption = event.target.closest('[data-time-option]');
        if (timeOption) {
          const unit = timeOption.dataset.timeOption;
          const field = this._panel.querySelector(`[data-time-field="${unit}"]`);
          const button = field.querySelector('.time-value');
          button.dataset.value = timeOption.dataset.value;
          button.textContent = timeOption.textContent;
          this._setDraftTime();
          this._closeTimeMenus();
          this._render();
          return;
        }
        const timeButton = event.target.closest('.time-value');
        if (timeButton) {
          const field = timeButton.closest('.time-field');
          const willOpen = field.dataset.open !== 'true';
          this._closeTimeMenus();
          if (willOpen) {
            field.dataset.open = 'true';
            const options = field.querySelector('.time-options');
            options.hidden = false;
            queueMicrotask(() => field.querySelector('.time-option.selected')?.scrollIntoView({ block: 'center' }));
          }
          return;
        }
        this._closeTimeMenus();
        const yearChoice = event.target.closest('[data-year]');
        if (yearChoice) {
          this._viewYear = Number(yearChoice.dataset.year);
          const dayOfMonth = this._preferredDay;
          this._draft.setDate(1);
          this._draft.setFullYear(this._viewYear);
          this._draft.setDate(Math.min(dayOfMonth, new Date(this._viewYear, this._draft.getMonth() + 1, 0).getDate()));
          this._panelMode = 'month'; this._render(); return;
        }
        const monthChoice = event.target.closest('[data-month]');
        if (monthChoice) {
          this._viewMonth = Number(monthChoice.dataset.month);
          const dayOfMonth = this._preferredDay;
          this._draft.setDate(1);
          this._draft.setMonth(this._viewMonth);
          this._draft.setDate(Math.min(dayOfMonth, new Date(this._viewYear, this._viewMonth + 1, 0).getDate()));
          this._panelMode = 'day'; this._render(); return;
        }
        const day = event.target.closest('.day');
        if (day) {
          const [year, month, date] = day.dataset.date.split('-').map(Number);
          this._draft.setFullYear(year, month - 1, date);
          this._preferredDay = date;
          this._viewYear = year; this._viewMonth = month - 1; this._render(); return;
        }
        let action = event.target.closest('[data-action]')?.dataset.action;
        if (!action) return;
        if (action === 'choose-year') this._panelMode = 'year';
        if (action === 'choose-month') this._panelMode = 'month';
        if (action === 'prev-year') this._viewYear -= 1;
        if (action === 'next-year') this._viewYear += 1;
        if (action === 'prev-month') {
          this._viewMonth -= 1;
          if (this._viewMonth < 0) { this._viewMonth = 11; this._viewYear -= 1; }
        }
        if (action === 'next-month') {
          this._viewMonth += 1;
          if (this._viewMonth > 11) { this._viewMonth = 0; this._viewYear += 1; }
        }
        if (action === 'today') {
          this._draft = new Date();
          this._preferredDay = this._draft.getDate();
          this._viewYear = this._draft.getFullYear();
          this._viewMonth = this._draft.getMonth();
          this._panelMode = 'day';
          if (this._options.range === true) {
            this._rangeValue = ['', ''];
            this._rangePhase = 'start';
          }
          this._render();
          action = 'confirm';
        }
        if (action === 'reset') {
          this._draft = new Date();
          if (this._options.range === true) {
            this._rangeValue = ['', ''];
            this._syncRangeDisplay();
            this._rangePhase = 'start';
          } else {
            this.value = '';
          }
          this._preferredDay = this._draft.getDate();
          this._viewYear = this._draft.getFullYear();
          this._viewMonth = this._draft.getMonth();
          this._panelMode = 'day';
          this._rangeChooser = { pane: '', mode: '' };
        }
        if (action === 'confirm') {
          const actualDay = Math.min(this._preferredDay, new Date(this._viewYear, this._viewMonth + 1, 0).getDate());
          this._draft.setDate(1);
          this._draft.setFullYear(this._viewYear, this._viewMonth, actualDay);
          this._setDraftTime();
          const selectedValue = this._format(this._draft);
          if (this._options.range === true) {
            if (!this._rangeValue[0]) this._rangeValue[0] = selectedValue;
            if (!this._rangeValue[1]) this._rangeValue[1] = this._rangeValue[0];
            if (this._rangeValue[0] && this._rangeValue[1] < this._rangeValue[0]) this._rangeValue.reverse();
            this._syncRangeDisplay();
          } else {
            this.value = selectedValue;
          }
          this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
          this.dispatchEvent(new CustomEvent('change', { detail: this._options.range === true ? { value: this.value, kind: 'end-change' } : this.value, bubbles: true, composed: true }));
          this._close(); return;
        }
        this._render();
      }
      _getRangePaneDate(pane) {
        if (pane !== 'right') return { year: this._viewYear, month: this._viewMonth };
        return { year: this._viewMonth === 11 ? this._viewYear + 1 : this._viewYear, month: (this._viewMonth + 1) % 12 };
      }
      _setRangePaneView(pane, year, month) {
        if (pane !== 'right') {
          this._viewYear = year;
          this._viewMonth = month;
          return;
        }
        const previous = new Date(year, month - 1, 1);
        this._viewYear = previous.getFullYear();
        this._viewMonth = previous.getMonth();
      }
      _closeTimeMenus() {
        this._panel.querySelectorAll('.time-field').forEach((field) => {
          delete field.dataset.open;
          field.querySelector('.time-options').hidden = true;
        });
      }
    }
    customElements.define('kniu-date-picker', KniuSysDatePicker);
  }

  function registerFormComponent() {
    if (typeof customElements === 'undefined' || typeof HTMLElement === 'undefined') return;
    if (customElements.get('kniu-form')) return;
    // 表单内被视为「字段」的控件：带 name，或 kniu:model 指向 options 的某个字段。
    const FORM_FIELD_SELECTOR = [
      'kniu-input', 'kniu-textarea', 'kniu-select', 'kniu-switch', 'kniu-radio-group',
      'kniu-checkbox-group', 'kniu-date-picker', 'kniu-upload', 'kniu-editor', 'kniu-slider'
    ].join(',');
    // options 里的表单级保留键：不是字段，不参与取值与验证。
    const FORM_RESERVED_KEYS = ['labelPosition', 'labelWidth'];
    // 字段对象约定：{ value, condition, message }——有 condition 才验证，value 为默认值/当前值。
    const isFieldObject = function (value) {
      return !!value && typeof value === 'object' && !Array.isArray(value) && 'value' in value;
    };
    const unwrapField = function (value) {
      return isFieldObject(value) ? value.value : value;
    };

    class KniuSysForm extends HTMLElement {
      constructor() {
        super();
        attachComponentShadow(this);
        this.shadowRoot.innerHTML = '<slot></slot>';
        this.style.display = 'contents';
        this._options = {};
        this._defaults = null;
        this._mountedForm = null;
        this._validateHandler = null;
      }
      connectedCallback() {
        queueMicrotask(() => {
          this._ensureNativeForm();
          this._syncLayout();
          this._mountForm();
        });
      }
      static snapshotOptions(options) {
        const out = {};
        Object.keys(options).forEach(function (key) {
          if (FORM_RESERVED_KEYS.indexOf(key) !== -1) return;
          out[key] = unwrapField(options[key]);
        });
        return out;
      }
      // 唯一配置入口：kniu:options="{{xxxOptions}}"。
      // 除 ref 与事件外，表单元素上不再有任何配置项属性（model / data / rules / formConfig /
      // label-position / label-width 全部作废）。字段要么写成对象（可验证），要么直接给默认值。
      set options(value) {
        const next = value && typeof value === 'object' ? value : {};
        this._options = next;
        if (this._defaults === null) this._defaults = KniuSysForm.snapshotOptions(next);
        if (this.isConnected) { this._syncLayout(); this._mountForm(); }
      }
      get options() { return this._options; }
      // 当前表单值：字段对象摊平成值，供控制器直接提交。
      get values() { return this._valuesOf(this._fieldNodes()); }
      _valuesOf(entries) {
        const options = this._options || {};
        const out = {};
        entries.forEach(function (entry) { out[entry.field] = entry.value; });
        Object.keys(options).forEach(function (key) {
          if (FORM_RESERVED_KEYS.indexOf(key) !== -1) return;
          if (key in out) return;
          out[key] = unwrapField(options[key]);
        });
        return out;
      }
      // 把所有字段恢复到 options 首次传入时的默认值。
      reset() {
        const defaults = this._defaults;
        const options = this._options;
        if (!defaults || !options) return;
        Object.keys(defaults).forEach(function (field) {
          if (isFieldObject(options[field])) options[field].value = defaults[field];
          else options[field] = defaults[field];
        });
      }
      validate() {
        const options = this._options || {};
        const entries = this._fieldNodes();
        const values = this._valuesOf(entries);
        let valid = true;
        let firstInvalid = null;
        let firstMessage = '';
        entries.forEach((entry) => {
          const rule = options[entry.field];
          const hasRule = isFieldObject(rule) && 'condition' in rule;
          if (!hasRule) {
            entry.node.removeAttribute('data-invalid');
            return;
          }
          const value = entry.value == null ? '' : String(entry.value);
          const invalid = !this._testCondition(rule.condition, value, entry, values);
          (entry.group || entry.node).toggleAttribute('required', true);
          entry.node.toggleAttribute('data-invalid', invalid);
          if (!invalid) return;
          valid = false;
          if (!firstInvalid) {
            firstInvalid = entry.node;
            firstMessage = rule.message || `${entry.field}格式不正确`;
          }
        });
        if (firstInvalid) {
          if (typeof firstInvalid.focus === 'function') firstInvalid.focus();
          if (typeof this.$msg === 'function') this.$msg({ content: firstMessage, type: 'error' });
          else KniuUI.msg({ content: firstMessage, type: 'error' });
        }
        return valid;
      }
      _testCondition(condition, value, entry, values) {
        if (condition === true) return value.trim().length > 0;
        if (condition == null) return true;
        // options 来自响应式代理，正则常被 Proxy 包裹：instanceof 仍为 true，
        // 但原生 RegExp.prototype.test 以 Proxy 为 this 会抛
        // "Method RegExp.prototype.exec called on incompatible receiver"。
        // 因此只要能取到 source 就一律重建真实 RegExp 再 test。
        if (condition && typeof condition.source === 'string') {
          return new RegExp(condition.source, condition.flags || '').test(value);
        }
        if (condition instanceof RegExp) return condition.test(value);
        if (typeof condition === 'function') {
          const payload = {
            value: value,
            field: entry.field,
            input: entry.node,
            model: this._options,
            options: this._options,
            values: values || {}
          };
          // 同表单其它字段的当前值一并展开到入参上，condition 可直接写 v.password 之类
          Object.keys(payload.values).forEach(function (key) {
            if (!(key in payload)) payload[key] = payload.values[key];
          });
          return !!condition(payload);
        }
        return true;
      }
      // 字段清单 [{ field, node, group, value }]，同名只取首个控件。
      _fieldNodes() {
        const options = this._options || {};
        const seen = new Set();
        const out = [];
        const self = this;
        this.querySelectorAll(FORM_FIELD_SELECTOR).forEach(function (node) {
          const field = self._fieldNameOf(node);
          if (!field || seen.has(field)) return;
          seen.add(field);
          out.push({
            field: field,
            node: node,
            group: node.closest('kniu-input-group, kniu-form-cell'),
            value: self._readField(field, node, options)
          });
        });
        return out;
      }
      _fieldNameOf(node) {
        const name = node.getAttribute('name');
        if (name) return name;
        const path = node.__kniuModelPath;
        if (path) return String(path).split('.').pop();
        return '';
      }
      _readField(field, node, options) {
        const option = options[field];
        if (isFieldObject(option)) return option.value;
        if (option !== undefined && option !== null && typeof option !== 'object') return option;
        return node.value === undefined ? '' : node.value;
      }
      _ensureNativeForm() {
        if (this.querySelector(':scope > form')) return;
        const form = (this.ownerDocument || document).createElement('form');
        form.className = 'kniu_sys_form_native';
        if (!form.hasAttribute('autocomplete')) form.setAttribute('autocomplete', 'off');
        while (this.firstChild) form.append(this.firstChild);
        this.append(form);
      }
      _syncLayout() {
        const options = this._options || {};
        const position = ['left', 'right', 'top'].indexOf(options.labelPosition) !== -1
          ? options.labelPosition
          : 'right';
        const width = options.labelWidth || '80px';
        // 标签位置落到 data 属性上供外部样式挂钩（label-position 属性已作废）
        this.setAttribute('data-label-position', position);
        this.querySelectorAll('kniu-input-group, kniu-form-cell').forEach(function (group) {
          if (!group.hasAttribute('label-position')) group.setAttribute('label-position', position);
          if (!group.hasAttribute('label-width')) group.setAttribute('label-width', width);
        });
      }
      _mountForm() {
        const form = this.querySelector('form');
        if (!form || this._mountedForm === form) return;
        form.noValidate = true;
        this._validateHandler = (event) => {
          event.preventDefault();
          if (!this.validate()) event.stopImmediatePropagation();
        };
        form.addEventListener('submit', this._validateHandler);
        this._mountedForm = form;
      }
    }
    customElements.define('kniu-form', KniuSysForm);
  }

  // 图片选择与本地照片墙预览。文件只保存在浏览器内存中，提交由所属表单负责。
  function registerUploadComponent() {
    if (typeof customElements === 'undefined' || typeof HTMLElement === 'undefined') return;
    if (customElements.get('kniu-upload')) return;
    class KniuSysUpload extends HTMLElement {
      static get observedAttributes() { return ['accept', 'multiple', 'max-count', 'max-size', 'disabled']; }
      constructor() {
        super();
        attachComponentShadow(this);
        this._files = [];
        this._objectUrls = new Map();
        this.shadowRoot.innerHTML = `<style>
          :host{display:block;width:100%;color:#606266;font:14px/1.5 Arial,"Microsoft YaHei",sans-serif}:host([disabled]){background-color:transparent!important}.kniu_upload_bar{display:flex;align-items:stretch;width:100%;min-height:40px}.kniu_upload_hint{display:flex;flex:1;align-items:center;min-width:0;padding:0 12px;border:1px solid #dcdfe6;border-right:0;background-color:#f5f7fa;color:#c0c4cc;box-sizing:border-box}.kniu_upload_btn{flex:none;padding:0 20px;border:1px solid #409eff;border-radius:0 4px 4px 0;background-color:#409eff;color:#fff;font:inherit;cursor:pointer}.kniu_upload_btn:hover{background-color:#66b1ff;border-color:#66b1ff}.kniu_upload_btn:focus-visible{outline:2px solid rgba(64,158,255,.35);outline-offset:2px}.kniu_upload_btn:disabled{background-color:#a0cfff;border-color:#a0cfff;cursor:not-allowed}.kniu_upload_input{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}.kniu_upload_wall{display:flex;flex-wrap:wrap;gap:10px;margin-top:10px}.kniu_upload_item{position:relative;width:160px;height:160px;overflow:hidden;background-color:#f5f7fa}.kniu_upload_image{display:block;width:100%;height:100%;object-fit:contain}.kniu_upload_remove{position:absolute;top:8px;right:8px;display:flex;align-items:center;justify-content:center;width:22px;height:22px;padding:0;border:0;border-radius:50%;background-color:#aab4c4;color:#fff;font:18px/1 Arial;cursor:pointer}.kniu_upload_remove:hover{background-color:#f56c6c}.kniu_upload_empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;color:#c0c4cc;font-size:18px;background-image:linear-gradient(135deg,#f7f9fc,#f1f4fa)}.kniu_upload_empty svg{width:38px;height:38px;fill:none;stroke:currentColor;stroke-width:1.8}
        </style><div class="kniu_upload_bar"><span class="kniu_upload_hint"></span><button class="kniu_upload_btn" type="button"><slot>选择图片</slot></button><input class="kniu_upload_input" type="file"></div><div class="kniu_upload_wall" aria-live="polite"></div>`;
        this._input = this.shadowRoot.querySelector('.kniu_upload_input');
        this._button = this.shadowRoot.querySelector('.kniu_upload_btn');
        this._hint = this.shadowRoot.querySelector('.kniu_upload_hint');
        this._wall = this.shadowRoot.querySelector('.kniu_upload_wall');
        this._button.addEventListener('click', () => this._input.click());
        this._input.addEventListener('change', () => this._select(Array.from(this._input.files || [])));
        this._wall.addEventListener('click', (event) => {
          if (this.hasAttribute('disabled')) return;
          const target = event.target instanceof Element ? event.target : event.target.parentElement;
          const button = target && target.closest('.kniu_upload_remove');
          if (button) this.removeAt(Number(button.dataset.index));
        });
      }
      connectedCallback() { this._sync(); this._render(); }
      disconnectedCallback() { this._revokeUrls(); }
      attributeChangedCallback() { if (this._input) this._sync(); }
      get value() { return this._files.slice(); }
      set value(value) {
        const next = Array.isArray(value) ? value.filter((file) => {
          return (typeof File !== 'undefined' && file instanceof File)
            || (typeof file === 'string' && file.trim().length > 0);
        }) : [];
        if (next.length === this._files.length && next.every((file, index) => file === this._files[index])) return;
        this._files.forEach((file) => { if (!next.includes(file)) this._revokeFileUrl(file); });
        this._files = next;
        this._render();
      }
      get files() { return this.value; }
      clear() { this._revokeUrls(); this._files = []; this._input.value = ''; this._render(); this._emitInput(); }
      removeAt(index) {
        if (!Number.isInteger(index) || index < 0 || index >= this._files.length) return;
        const removed = this._files.splice(index, 1)[0];
        this._revokeFileUrl(removed);
        this._render();
        this._emitInput();
        this.dispatchEvent(new CustomEvent('remove', { detail: removed, bubbles: true, composed: true }));
      }
      _limits() {
        const size = Number(this.getAttribute('max-size'));
        const count = this.hasAttribute('multiple') ? Number.parseInt(this.getAttribute('max-count'), 10) : 1;
        return {
          bytes: Number.isFinite(size) && size > 0 ? size * 1024 * 1024 : Infinity,
          count: Number.isFinite(count) && count > 0 ? count : (this.hasAttribute('multiple') ? Infinity : 1)
        };
      }
      _select(selected) {
        const limits = this._limits();
        const valid = selected.filter((file) => {
          if (file.size <= limits.bytes) return true;
          this._notice(`${file.name} 超过单张 ${this.getAttribute('max-size')}M 的限制`, 'error');
          return false;
        });
        if (!this.hasAttribute('multiple')) {
          if (valid.length) {
            this._revokeUrls();
            // 单图字段再次选择时覆盖原图，保证预览数量与数据库回显一致。
            this._files = [valid[valid.length - 1]];
          }
          this._input.value = '';
          this._render();
          this._emitInput();
          return;
        }
        const room = Math.max(0, limits.count - this._files.length);
        if (valid.length > room) {
          this._notice(`最多只能选择 ${limits.count} 张图片`, 'warning');
          this.dispatchEvent(new CustomEvent('exceed', { detail: { files: valid, maxCount: limits.count }, bubbles: true, composed: true }));
        }
        this._files.push(...valid.slice(0, room));
        this._input.value = '';
        this._render();
        this._emitInput();
      }
      _emitInput() {
        this.dispatchEvent(new CustomEvent('input', { detail: this.value, bubbles: true, composed: true }));
        this.dispatchEvent(new CustomEvent('change', { detail: this.value, bubbles: true, composed: true }));
      }
      _notice(content, type) {
        if (typeof this.$msg === 'function') this.$msg({ content: content, type: type });
        else KniuUI.msg({ content: content, type: type });
      }
      _revokeFileUrl(file) {
        const url = this._objectUrls.get(file);
        if (!url) return;
        URL.revokeObjectURL(url);
        this._objectUrls.delete(file);
      }
      _revokeUrls() { this._objectUrls.forEach((url) => URL.revokeObjectURL(url)); this._objectUrls.clear(); }
      _render() {
        const previews = this._files.map((file, index) => {
          const item = document.createElement('div');
          item.className = 'kniu_upload_item';
          const image = document.createElement('img');
          image.className = 'kniu_upload_image';
          const isStoredImage = typeof file === 'string';
          image.alt = isStoredImage ? '已上传图片' : file.name;
          let url = isStoredImage ? file : this._objectUrls.get(file);
          if (!url && !isStoredImage) {
            url = URL.createObjectURL(file);
            this._objectUrls.set(file, url);
          }
          image.src = url;
          const remove = document.createElement('button');
          remove.className = 'kniu_upload_remove';
          remove.type = 'button';
          remove.disabled = this.hasAttribute('disabled');
          remove.dataset.index = String(index);
          remove.setAttribute('aria-label', `删除 ${isStoredImage ? '已上传图片' : file.name}`);
          remove.textContent = '×';
          item.append(image, remove);
          return item;
        });
        if (previews.length === 0) {
          const empty = document.createElement('div');
          empty.className = 'kniu_upload_item kniu_upload_empty';
          empty.setAttribute('aria-label', '暂无图片');
          empty.innerHTML = '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="4" y="6" width="24" height="20" rx="1"></rect><circle cx="21" cy="12" r="2"></circle><path d="m6 23 7-8 5 5 3-3 5 6"></path></svg><span>暂无图片</span>';
          previews.push(empty);
        }
        replaceChildrenWithFragment(this._wall, previews);
        this._wall.hidden = false;
        this._sync();
      }
      _sync() {
        const limits = this._limits();
        this._input.accept = this.getAttribute('accept') || 'image/*';
        this._input.multiple = this.hasAttribute('multiple');
        this._input.disabled = this.hasAttribute('disabled')
          || (this.hasAttribute('multiple') && this._files.length >= limits.count);
        this._button.disabled = this._input.disabled;
        this._hint.textContent = this._files.length ? `已选择 ${this._files.length} 张图片` : (this.hasAttribute('multiple') ? `选择图片可以预览（最多 ${limits.count} 张）` : '选择图片可以预览');
      }
    }
    customElements.define('kniu-upload', KniuSysUpload);
  }

  const KNIU_ICON_SET = {
    "arrow-down": ["M831.9 340.9 512 652.7 192.1 340.9a30.6 30.6 0 0 0-42.7 0 29 29 0 0 0 0 41.6l340.3 331.7a32 32 0 0 0 44.6 0l340.3-331.7a29 29 0 0 0 0-41.7 30.6 30.6 0 0 0-42.7 0z"],
    "arrow-left": ["M609.4 149.4 277.8 489.6a32 32 0 0 0 0 44.7l331.6 340.3a29 29 0 0 0 41.7 0 30.6 30.6 0 0 0 0-42.7l-311.8-320L651 192.1a30.6 30.6 0 0 0 0-42.7 29 29 0 0 0-41.7 0"],
    "arrow-right": ["M340.9 149.3a30.6 30.6 0 0 0 0 42.8L652.7 512 341 831.9a30.6 30.6 0 0 0 0 42.7 29 29 0 0 0 41.7 0l331.6-340.3a32 32 0 0 0 0-44.6L382.6 149.4a29 29 0 0 0-41.7 0z"],
    "arrow-up": ["M488.8 344.3 149 701a32 32 0 0 0 0 44.2l.4.3a29.4 29.4 0 0 0 42.7 0l320-335.8 319.8 335.8a29.4 29.4 0 0 0 42.7 0l.4-.3a32 32 0 0 0 0-44.2L535.2 344.3a32 32 0 0 0-46.4 0"],
    "check": ["M406.7 707 195.8 496.2a32 32 0 1 0-45.2 45.2l256 256 512-512a32 32 0 0 0-45.3-45.2L406.6 706.9z"],
    "caret-bottom": ["m192 384 320 384 320-384z"],
    "caret-top": ["M512 320 192 704h639.936z"],
    "circle-check": ["M512 896a384 384 0 1 0 0-768 384 384 0 0 0 0 768m0 64a448 448 0 1 1 0-896 448 448 0 0 1 0 896", "M745.3 361.3a32 32 0 0 1 45.4 45.4l-288 288a32 32 0 0 1-45.4 0l-160-160a32 32 0 1 1 45.4-45.4L480 626.8z"],
    "circle-close": ["m466.8 512-90.5-90.5a32 32 0 0 1 45.2-45.2l90.5 90.5 90.5-90.5a32 32 0 1 1 45.2 45.2L557.2 512l90.5 90.5a32 32 0 1 1-45.2 45.2L512 557.2l-90.5 90.5a32 32 0 0 1-45.2-45.2z", "M512 896a384 384 0 1 0 0-768 384 384 0 0 0 0 768m0 64a448 448 0 1 1 0-896 448 448 0 0 1 0 896"],
    "close": ["M764.3 214.6 512 466.9 259.7 214.6a32 32 0 0 0-45.1 45.1L466.8 512 214.5 764.2a32 32 0 1 0 45.1 45.2L512 557.2l252.3 252.3a32 32 0 0 0 45.1-45.1L557.1 512l252.3-252.4a32 32 0 1 0-45.1-45.2z"],
    "delete": ["M160 256H96a32 32 0 0 1 0-64h256V96a32 32 0 0 1 32-32h256a32 32 0 0 1 32 32v96h256a32 32 0 1 1 0 64h-64v672a32 32 0 0 1-32 32H192a32 32 0 0 1-32-32zm448-64v-64H416v64zM224 896h576V256H224zm192-128a32 32 0 0 1-32-32V416a32 32 0 0 1 64 0v320a32 32 0 0 1-32 32m192 0a32 32 0 0 1-32-32V416a32 32 0 0 1 64 0v320a32 32 0 0 1-32 32"],
    "download": ["M160 832h704a32 32 0 1 1 0 64H160a32 32 0 1 1 0-64m384-253.7L780.3 342l45.2 45.2L508.8 704 192 387.2l45.2-45.2L480 584.7V128h64z"],
    "edit": ["M832 512a32 32 0 1 1 64 0v352a32 32 0 0 1-32 32H160a32 32 0 0 1-32-32V160a32 32 0 0 1 32-32h352a32 32 0 0 1 0 64H192v640h640z", "m470 554.2 52.8-7.5L847 222.4a32 32 0 1 0-45.2-45.2L477.4 501.4l-7.5 52.8zm422.4-422.4a96 96 0 0 1 0 135.8L560.5 599.5a32 32 0 0 1-18.1 9l-105.6 15.2a32 32 0 0 1-36.2-36.2l15-105.6a32 32 0 0 1 9.1-18.2l332-331.8a96 96 0 0 1 135.7 0z"],
    "hide": ["M876.8 156.8c0-9.6-3.2-16-9.6-22.4s-12.8-9.6-22.4-9.6-16 3.2-22.4 9.6L736 220.8c-64-32-137.6-51.2-224-60.8-160 16-288 73.6-377.6 176S0 496 0 512s48 73.6 134.4 176c22.4 25.6 44.8 48 73.6 67.2l-86.4 89.6c-6.4 6.4-9.6 12.8-9.6 22.4s3.2 16 9.6 22.4 12.8 9.6 22.4 9.6 16-3.2 22.4-9.6l704-710.4c3.2-6.4 6.4-12.8 6.4-22.4m-646.4 528Q115.2 579.2 76.8 512q43.2-72 153.6-172.8C304 272 400 230.4 512 224c64 3.2 124.8 19.2 176 44.8l-54.4 54.4A218 218 0 0 0 512 288c-64 0-115.2 22.4-160 64s-64 96-64 160c0 48 12.8 89.6 35.2 124.8L256 707.2c-9.6-6.4-19.2-16-25.6-22.4m140.8-96Q352 555.2 352 512c0-44.8 16-83.2 48-112s67.2-48 112-48c28.8 0 54.4 6.4 73.6 19.2zM889.6 336c-12.8-16-28.8-28.8-41.6-41.6l-48 48c73.6 67.2 124.8 124.8 150.4 169.6q-43.2 72-153.6 172.8C723.2 752 624 793.6 512 800a478 478 0 0 1-140.8-28.8l-48 48A680 680 0 0 0 512 864c160-16 288-73.6 377.6-176S1024 528 1024 512s-48-73.6-134.4-176", "M512 672c-12.8 0-25.6-3.2-38.4-6.4l-51.2 51.2A215 215 0 0 0 512 736c64 0 115.2-22.4 160-64 41.6-41.6 64-96 64-160 0-32-6.4-64-19.2-89.6l-51.2 51.2c3.2 12.8 6.4 25.6 6.4 38.4 0 44.8-16 83.2-48 112s-67.2 48-112 48"],
    "info-filled": ["M512 64a448 448 0 1 1 0 896 448 448 0 0 1 0-896m67.2 275c33.3 0 60.3-23 60.3-57.3s-27-57.3-60.3-57.3-60.2 23-60.2 57.3 27 57.4 60.2 57.4m11.7 360.1c0-6.8 2.4-24.6 1-34.8L539.3 725c-10.9 11.4-24.5 19.4-30.9 17.3a13 13 0 0 1-8.2-14.7l87.6-277c7.2-35.2-12.5-67.2-54.3-71.3-44 0-109 44.7-148.5 101.5 0 6.8-1.3 23.6 0 33.8l52.6-60.6c11-11.4 23.6-19.4 30-17.2a13 13 0 0 1 7.8 16.1l-87 275.7c-10 32.2 9 63.8 55.1 71 67.9 0 108-43.6 147.5-100.4z"],
    "menu": ["M160 448a32 32 0 0 1-32-32V160a32 32 0 0 1 32-32h256a32 32 0 0 1 32 32v256a32 32 0 0 1-32 32zm448 0a32 32 0 0 1-32-32V160a32 32 0 0 1 32-32h256a32 32 0 0 1 32 32v256a32 32 0 0 1-32 32zM160 896a32 32 0 0 1-32-32V608a32 32 0 0 1 32-32h256a32 32 0 0 1 32 32v256a32 32 0 0 1-32 32zm448 0a32 32 0 0 1-32-32V608a32 32 0 0 1 32-32h256a32 32 0 0 1 32 32v256a32 32 0 0 1-32 32z"],
    "minus": ["M128 544h768a32 32 0 1 0 0-64H128a32 32 0 0 0 0 64"],
    "more": ["M176 416a112 112 0 1 0 0 224 112 112 0 0 0 0-224m0 64a48 48 0 1 1 0 96 48 48 0 0 1 0-96m336-64a112 112 0 1 1 0 224 112 112 0 0 1 0-224m0 64a48 48 0 1 0 0 96 48 48 0 0 0 0-96m336-64a112 112 0 1 1 0 224 112 112 0 0 1 0-224m0 64a48 48 0 1 0 0 96 48 48 0 0 0 0-96"],
    "plus": ["M480 480V128a32 32 0 0 1 64 0v352h352a32 32 0 1 1 0 64H544v352a32 32 0 1 1-64 0V544H128a32 32 0 0 1 0-64z"],
    "refresh-left": ["M289 296.7h93a32 32 0 0 1 0 64H233a32 32 0 0 1-32-32v-149a32 32 0 0 1 64 0v50.6a384 384 0 0 1 643.8 282.9 384 384 0 0 1-384 384 384 384 0 0 1-384-384h64a320 320 0 1 0 640 0 320 320 0 0 0-555.6-216.5z"],
    "refresh": ["M771.8 794.9A384 384 0 0 1 128 512h64a320 320 0 0 0 555.7 216.4h-93a32 32 0 1 1 0-64h149a32 32 0 0 1 32 32v149a32 32 0 1 1-64 0zM276.3 295.6h93a32 32 0 0 1 0 64H220.2a32 32 0 0 1-32-32v-149a32 32 0 0 1 64 0V229a384 384 0 0 1 644 282.9h-64a320 320 0 0 0-555.8-216.4z"],
    "search": ["m795.9 750.7 125 125a32 32 0 0 1-45.3 45.2l-125-125a416 416 0 1 1 45.3-45.2zM480 832a352 352 0 1 0 0-704 352 352 0 0 0 0 704"],
    "setting": ["M600.7 64a32 32 0 0 1 30.5 22.2l35.2 109.4a348 348 0 0 1 42.4 24.5l112.4-24.2a32 32 0 0 1 34.4 15.4l88.7 153.5a32 32 0 0 1-4 37.5l-77.1 85.1a357 357 0 0 1 0 49l77 85.3a32 32 0 0 1 4.1 37.5l-88.7 153.6a32 32 0 0 1-34.4 15.3l-112.4-24.2q-20.2 13.6-42.4 24.5l-35.2 109.4a32 32 0 0 1-30.5 22.2H423.3a32 32 0 0 1-30.5-22.2l-35.1-109.3a352 352 0 0 1-42.6-24.7l-112.3 24.3a32 32 0 0 1-34.4-15.4L79.7 659.2a32 32 0 0 1 4-37.5l77.1-85.3a357 357 0 0 1 0-48.8l-77-85.3a32 32 0 0 1-4.1-37.5l88.7-153.6a32 32 0 0 1 34.4-15.3l112.3 24.3a355 355 0 0 1 42.6-24.7l35.2-109.3A32 32 0 0 1 423.2 64zm-23.4 64H446.7l-36.3 113-24.5 12a294 294 0 0 0-34.9 20.2l-22.6 15.3-116.2-25-65.3 113 79.7 88.3-2 27.1a293 293 0 0 0 0 40.2l2 27.1-79.8 88.2L212 760.6l116.2-25 22.7 15.2a294 294 0 0 0 34.8 20.1l24.5 12L446.7 896h130.7L614 782.8l24.4-11.9a288 288 0 0 0 34.8-20l22.6-15.3 116.3 25 65.2-113.2-79.7-88.2 2-27.1a293 293 0 0 0 0-40.3l-2-27.1 79.8-88.1L812 263.4l-116.3 25-22.6-15.2a288 288 0 0 0-34.8-20.1L614 241zM512 320a192 192 0 1 1 0 384 192 192 0 0 1 0-384m0 64a128 128 0 1 0 0 256 128 128 0 0 0 0-256"],
    "upload": ["M160 832h704a32 32 0 1 1 0 64H160a32 32 0 1 1 0-64m384-578.3V704h-64V247.3L237.2 490 192 444.8 508.8 128l316.8 316.8-45.3 45.2z"],
    "user": ["M512 512a192 192 0 1 0 0-384 192 192 0 0 0 0 384m0 64a256 256 0 1 1 0-512 256 256 0 0 1 0 512m320 320v-96a96 96 0 0 0-96-96H288a96 96 0 0 0-96 96v96a32 32 0 1 1-64 0v-96a160 160 0 0 1 160-160h448a160 160 0 0 1 160 160v96a32 32 0 1 1-64 0"],
    "view": ["M512 160c320 0 512 352 512 352S832 864 512 864 0 512 0 512s192-352 512-352m0 64c-225.3 0-384.1 208-436.8 288 52.6 79.9 211.5 288 436.8 288s384.1-208 436.8-288C896.2 432.1 737.3 224 512 224m0 64a224 224 0 1 1 0 448 224 224 0 0 1 0-448m0 64a160 160 0 0 0-160 160c0 88.2 71.7 160 160 160s160-71.8 160-160-71.7-160-160-160"],
    "warning": ["M512 64a448 448 0 1 1 0 896 448 448 0 0 1 0-896m0 832a384 384 0 0 0 0-768 384 384 0 0 0 0 768m48-176a48 48 0 1 1-96 0 48 48 0 0 1 96 0m-48-464a32 32 0 0 1 32 32v288a32 32 0 0 1-64 0V288a32 32 0 0 1 32-32"],
    "house": ["M192 413.952V896h640V413.952L512 147.328zM139.52 374.4l352-293.312a32 32 0 0 1 40.96 0l352 293.312A32 32 0 0 1 896 398.976V928a32 32 0 0 1-32 32H160a32 32 0 0 1-32-32V398.976a32 32 0 0 1 11.52-24.576"],
    "document": ["M832 384H576V128H192v768h640zm-26.496-64L640 154.496V320zM160 64h480l256 256v608a32 32 0 0 1-32 32H160a32 32 0 0 1-32-32V96a32 32 0 0 1 32-32m160 448h384v64H320zm0-192h160v64H320zm0 384h384v64H320z"],
    "file": ["M128 384v448h768V384zm-32-64h832a32 32 0 0 1 32 32v512a32 32 0 0 1-32 32H96a32 32 0 0 1-32-32V352a32 32 0 0 1 32-32m64-128h704v64H160zm96-128h512v64H256z"],
    "folder": ["M128 192v640h768V320H485.76L357.504 192zm-32-64h287.872l128.384 128H928a32 32 0 0 1 32 32v576a32 32 0 0 1-32 32H96a32 32 0 0 1-32-32V160a32 32 0 0 1 32-32"],
    "bell": ["M512 64a64 64 0 0 1 64 64v64H448v-64a64 64 0 0 1 64-64",
      "M256 768h512V448a256 256 0 1 0-512 0zm256-640a320 320 0 0 1 320 320v384H192V448a320 320 0 0 1 320-320",
      "M96 768h832q32 0 32 32t-32 32H96q-32 0-32-32t32-32m352 128h128a64 64 0 0 1-128 0"],
    "chat-dot-round": ["m174.72 855.68 135.296-45.12 23.68 11.84C388.096 849.536 448.576 864 512 864c211.84 0 384-166.784 384-352S723.84 160 512 160 128 326.784 128 512c0 69.12 24.96 139.264 70.848 199.232l22.08 28.8-46.272 115.584zm-45.248 82.56A32 32 0 0 1 89.6 896l58.368-145.92C94.72 680.32 64 596.864 64 512 64 299.904 256 96 512 96s448 203.904 448 416-192 416-448 416a461.06 461.06 0 0 1-206.912-48.384l-175.616 58.56z",
      "M512 563.2a51.2 51.2 0 1 1 0-102.4 51.2 51.2 0 0 1 0 102.4m192 0a51.2 51.2 0 1 1 0-102.4 51.2 51.2 0 0 1 0 102.4m-384 0a51.2 51.2 0 1 1 0-102.4 51.2 51.2 0 0 1 0 102.4"],
    "question": ["M512 64a448 448 0 1 1 0 896 448 448 0 0 1 0-896m23.744 191.488c-52.096 0-92.928 14.784-123.2 44.352-30.976 29.568-45.76 70.4-45.76 122.496h80.256c0-29.568 5.632-52.8 17.6-68.992 13.376-19.712 35.2-28.864 66.176-28.864 23.936 0 42.944 6.336 56.32 19.712 12.672 13.376 19.712 31.68 19.712 54.912 0 17.6-6.336 34.496-19.008 49.984l-8.448 9.856c-45.76 40.832-73.216 70.4-82.368 89.408-9.856 19.008-14.08 42.24-14.08 68.992v9.856h80.96v-9.856c0-16.896 3.52-31.68 10.56-45.76 6.336-12.672 15.488-24.64 28.16-35.2 33.792-29.568 54.208-48.576 60.544-55.616 16.896-22.528 26.048-51.392 26.048-86.592q0-64.416-42.24-101.376c-28.16-25.344-65.472-37.312-111.232-37.312m-12.672 406.208a54.27 54.27 0 0 0-38.72 14.784 49.4 49.4 0 0 0-15.488 38.016c0 15.488 4.928 28.16 15.488 38.016A54.85 54.85 0 0 0 523.072 768c15.488 0 28.16-4.928 38.72-14.784a51.52 51.52 0 0 0 16.192-38.72 51.97 51.97 0 0 0-15.488-38.016 55.94 55.94 0 0 0-39.424-14.784"],
    "logout": ["M352 159.872V230.4a352 352 0 1 0 320 0v-70.528A416.128 416.128 0 0 1 512 960a416 416 0 0 1-160-800.128",
      "M512 64q32 0 32 32v320q0 32-32 32t-32-32V96q0-32 32-32"],
    "reload": ["M771.776 794.88A384 384 0 0 1 128 512h64a320 320 0 0 0 555.712 216.448H654.72a32 32 0 1 1 0-64h149.056a32 32 0 0 1 32 32v148.928a32 32 0 1 1-64 0v-50.56zM276.288 295.616h92.992a32 32 0 0 1 0 64H220.16a32 32 0 0 1-32-32V178.56a32 32 0 0 1 64 0v50.56A384 384 0 0 1 896.128 512h-64a320 320 0 0 0-555.776-216.384z"],
    "chart": ["M359.168 768H160a32 32 0 0 1-32-32V192H64a32 32 0 0 1 0-64h896a32 32 0 1 1 0 64h-64v544a32 32 0 0 1-32 32H665.216l110.848 192h-73.856L591.36 768H433.024L322.176 960H248.32zM832 192H192v512h640zM342.656 534.656a32 32 0 1 1-45.312-45.312L444.992 341.76l125.44 94.08L679.04 300.032a32 32 0 1 1 49.92 39.936L581.632 524.224 451.008 426.24 342.656 534.592z"],
    "loading": ["M512 1024c-17.6 0-32-14.4-32-32V832c0-17.6 14.4-32 32-32s32 14.4 32 32v160c0 17.6-14.4 32-32 32zM512 224c-17.6 0-32-14.4-32-32V32c0-17.6 14.4-32 32-32s32 14.4 32 32v160c0 17.6-14.4 32-32 32zM1014.4 512c0 17.6-14.4 32-32 32H822.4c-17.6 0-32-14.4-32-32s14.4-32 32-32h160c17.6 0 32 14.4 32 32zM234.4 512c0 17.6-14.4 32-32 32H42.4c-17.6 0-32-14.4-32-32s14.4-32 32-32h160c17.6 0 32 14.4 32 32zM822.4 271.2c-12.8 0-25.6-5.6-34.4-15.2L689.6 144.8c-9.6-12.8-7.2-30.4 5.6-40 12.8-9.6 30.4-7.2 40 5.6l98.4 111.2c9.6 12.8 7.2 30.4-5.6 40-7.2 5.6-15.2 8.8-24 8.8zM288.8 805.6c-12.8 0-25.6-5.6-34.4-15.2-9.6-12.8-7.2-30.4 5.6-40l111.2-98.4c12.8-9.6 30.4-7.2 40 5.6 9.6 12.8 7.2 30.4-5.6 40L299.2 798.4c-7.2 6.4-16 9.6-24.8 9.6zM734.4 759.2c-12.8 0-25.6-5.6-34.4-15.2L588.8 644.8c-12.8-9.6-15.2-27.2-5.6-40 9.6-12.8 27.2-15.2 40-5.6l111.2 98.4c12.8 9.6 15.2 27.2 5.6 40-7.2 6.4-16 9.6-24.8 9.6zM269.6 225.6c-12.8 0-25.6-5.6-34.4-15.2L124 99.2c-12.8-9.6-15.2-27.2-5.6-40 9.6-12.8 27.2-15.2 40-5.6l111.2 111.2c12.8 9.6 15.2 27.2 5.6 40-7.2 6.4-16 9.6-24.8 9.6z"],
  };
  function normalizeIconName(name) {
    return String(name || '')
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
      .toLowerCase();
  }

  function normalizeIconDef(def) {
    if (!def) return null;
    if (Array.isArray(def)) return { viewBox: '0 0 1024 1024', paths: def };
    if (typeof def === 'object' && Array.isArray(def.paths)) {
      return { viewBox: def.viewBox || '0 0 1024 1024', paths: def.paths };
    }
    return null;
  }

  function buildGlyphInner(paths) {
    return (paths || []).map(function (d) {
      return '<path fill="currentColor" d="' + d + '"/>';
    }).join('');
  }

  function buildGlyphSvg(def) {
    const norm = normalizeIconDef(def);
    if (!norm) return '';
    return '<svg viewBox="' + norm.viewBox + '" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true">' + buildGlyphInner(norm.paths) + '</svg>';
  }

  function registerIconGlyph(name, def) {
    if (typeof customElements === 'undefined' || typeof HTMLElement === 'undefined') return;
    const tag = 'kniu-icon-' + name;
    if (customElements.get(tag)) return;
    const norm = normalizeIconDef(def);
    const inner = norm ? buildGlyphInner(norm.paths) : '';
    const viewBox = norm ? norm.viewBox : '0 0 1024 1024';
    class KniuSysIconGlyph extends HTMLElement {
      static get observedAttributes() { return []; }
      constructor() {
        super();
        attachComponentShadow(this);
        this.shadowRoot.innerHTML =
          '<style>' +
          ':host{display:inline-flex;vertical-align:middle;line-height:0;width:1em;height:1em;font-size:inherit;flex-shrink:0}' +
          ':host([hidden]){display:none}' +
          'svg{display:block;width:100%;height:100%;fill:currentColor;overflow:visible}' +
          '</style>' +
          '<svg viewBox="' + viewBox + '" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true">' + inner + '</svg>';
      }
    }
    customElements.define(tag, KniuSysIconGlyph);
  }

  function registerIconComponent() {
    if (typeof customElements === 'undefined' || typeof HTMLElement === 'undefined') return;
    if (customElements.get('kniu-icon')) return;
    class KniuSysIcon extends HTMLElement {
      static get observedAttributes() { return ['icon']; }
      constructor() {
        super();
        attachComponentShadow(this);
        this.shadowRoot.innerHTML =
          '<style>' +
          ':host{display:inline-flex;vertical-align:middle;align-items:center;justify-content:center;line-height:0;font-size:inherit;flex-shrink:0}' +
          ':host([hidden]){display:none}' +
          '.kniu_sys_icon_glyph{display:none;width:1em;height:1em}' +
          ':host(.kniu_sys_icon_has_glyph) .kniu_sys_icon_glyph{display:block}' +
          ':host(.kniu_sys_icon_has_glyph) slot{display:none}' +
          '.kniu_sys_icon_glyph svg{display:block;width:100%;height:100%;fill:currentColor;overflow:visible}' +
          ':host([data-spin]) .kniu_sys_icon_glyph{animation:kniu_sys_icon_spin .8s linear infinite}' +
          '@keyframes kniu_sys_icon_spin{to{transform:rotate(360deg)}}' +
          '@media(prefers-reduced-motion:reduce){:host([data-spin]) .kniu_sys_icon_glyph{animation:none}}' +
          '::slotted(*){display:inline-flex;vertical-align:middle}' +
          '</style>' +
          '<span class="kniu_sys_icon_glyph"></span><slot></slot>';
      }
      connectedCallback() { this._render(); }
      attributeChangedCallback() { this._render(); }
      _resolveName() {
        let name = (this.getAttribute('icon') || '').trim();
        if (!name) {
          const child = this.firstElementChild;
          if (child) name = child.localName;
        }
        return normalizeIconName(name);
      }
      _render() {
        const name = this._resolveName();
        const glyph = this.shadowRoot.querySelector('.kniu_sys_icon_glyph');
        const def = name ? KNIU_ICON_SET[name] : null;
        if (def) {
          glyph.innerHTML = buildGlyphSvg(def);
          this.classList.add('kniu_sys_icon_has_glyph');
          if (name === 'loading') this.setAttribute('data-spin', 'true');
          else this.removeAttribute('data-spin');
        } else {
          glyph.innerHTML = '';
          this.classList.remove('kniu_sys_icon_has_glyph');
          this.removeAttribute('data-spin');
        }
      }
    }
    customElements.define('kniu-icon', KniuSysIcon);
  }

  // 徽章组件：包裹任意子节点，在右上角显示红点或数字；click 透传（包裹的子节点在 light DOM，点击事件正常冒泡到 host）。
  function registerBadgeComponent() {
    if (typeof customElements === 'undefined' || typeof HTMLElement === 'undefined') return;
    if (customElements.get('kniu-badge')) return;
    class KniuSysBadge extends HTMLElement {
      static get observedAttributes() { return ['value', 'max', 'is-dot', 'hidden', 'unstyled']; }
      constructor() {
        super();
        attachComponentShadow(this);
        this.shadowRoot.innerHTML =
          '<style>' +
          ':host{display:inline-flex;position:relative;vertical-align:middle;line-height:0;flex-shrink:0}' +
          ':host([hidden]){display:none}' +
          ':host([unstyled]){background-color:transparent;border:0;padding:0}' +
          '.kniu_sys_badge_indicator{position:absolute;top:0;right:0;transform:translate(50%,-50%);box-sizing:border-box;pointer-events:none;display:flex;align-items:center;justify-content:center}' +
          '.kniu_sys_badge_indicator[data-shape="dot"]{width:8px;height:8px;border-radius:50%;background-color:#f56c6c;border:1.5px solid #fff}' +
          '.kniu_sys_badge_indicator[data-shape="sup"]{min-width:18px;height:18px;padding:0 5px;border-radius:9px;background-color:#f56c6c;color:#fff;font-size:12px;line-height:18px;font-weight:600;border:1.5px solid #fff;white-space:nowrap}' +
          ':host([unstyled]) .kniu_sys_badge_indicator{border-color:transparent}' +
          '</style>' +
          '<slot></slot>' +
          '<span class="kniu_sys_badge_indicator" aria-hidden="true"></span>';
      }
      connectedCallback() { this._sync(); }
      attributeChangedCallback() { this._sync(); }
      _sync() {
        const indicator = this.shadowRoot.querySelector('.kniu_sys_badge_indicator');
        if (this.hasAttribute('hidden')) {
          indicator.style.display = 'none';
          return;
        }
        if (this.hasAttribute('is-dot')) {
          indicator.dataset.shape = 'dot';
          indicator.textContent = '';
          indicator.style.display = '';
          return;
        }
        const raw = this.getAttribute('value');
        if (raw == null || raw === '') {
          indicator.style.display = 'none';
          return;
        }
        const max = parseInt(this.getAttribute('max'), 10);
        let text = raw;
        if (!Number.isNaN(max) && max > 0) {
          const num = parseInt(raw, 10);
          if (!Number.isNaN(num) && num > max) text = max + '+';
        }
        indicator.dataset.shape = 'sup';
        indicator.textContent = String(text);
        indicator.style.display = '';
      }
    }
    customElements.define('kniu-badge', KniuSysBadge);
  }

  // 标签组件：用于状态、角色、权限等短文本标记，可独立使用，也可放入表格默认插槽。
  function registerTagComponent() {
    if (typeof customElements === 'undefined' || typeof HTMLElement === 'undefined') return;
    if (customElements.get('kniu-tag')) return;
    class KniuSysTag extends HTMLElement {
      static get observedAttributes() { return ['type', 'size', 'effect', 'round', 'closable', 'disabled']; }
      constructor() {
        super();
        attachComponentShadow(this);
        this.shadowRoot.innerHTML = `<style>:host{--kniu-tag-color:#409eff;--kniu-tag-bg:#ecf5ff;--kniu-tag-border:#d9ecff;display:inline-flex;vertical-align:middle}.kniu_sys_tag{display:inline-flex;align-items:center;justify-content:center;gap:5px;height:24px;padding:0 9px;border:1px solid var(--kniu-tag-border);border-radius:4px;background-color:var(--kniu-tag-bg);color:var(--kniu-tag-color);font:12px/1 Arial,"Microsoft YaHei",sans-serif;white-space:nowrap;box-sizing:border-box}:host([type="success"]){--kniu-tag-color:#67c23a;--kniu-tag-bg:#f0f9eb;--kniu-tag-border:#e1f3d8}:host([type="warning"]){--kniu-tag-color:#e6a23c;--kniu-tag-bg:#fdf6ec;--kniu-tag-border:#faecd8}:host([type="danger"]){--kniu-tag-color:#f56c6c;--kniu-tag-bg:#fef0f0;--kniu-tag-border:#fde2e2}:host([type="info"]){--kniu-tag-color:#909399;--kniu-tag-bg:#f4f4f5;--kniu-tag-border:#e9e9eb}:host([effect="dark"]){--kniu-tag-bg:var(--kniu-tag-color);--kniu-tag-border:var(--kniu-tag-color)}:host([effect="dark"]) .kniu_sys_tag{color:#fff}:host([effect="plain"]){--kniu-tag-bg:#fff}:host([size="large"]) .kniu_sys_tag{height:28px;padding:0 11px;font-size:13px}:host([size="small"]) .kniu_sys_tag{height:20px;padding:0 7px}:host([round]) .kniu_sys_tag{border-radius:999px}:host([disabled]){opacity:.55;pointer-events:none}.kniu_sys_tag_close{display:none;width:14px;height:14px;padding:0;border:0;border-radius:50%;background-color:transparent;color:inherit;font:14px/12px Arial;cursor:pointer}:host([closable]) .kniu_sys_tag_close{display:inline-flex;align-items:center;justify-content:center}</style><span class="kniu_sys_tag"><slot></slot><button class="kniu_sys_tag_close" type="button" aria-label="关闭">×</button></span>`;
        this.shadowRoot.querySelector('.kniu_sys_tag_close').addEventListener('click', (event) => {
          event.stopPropagation();
          if (this.hasAttribute('disabled')) return;
          this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
        });
      }
    }
    customElements.define('kniu-tag', KniuSysTag);
  }

  // 状态组件：使用彩色圆点表达状态类型，文字保持正文颜色。
  function registerStatusComponent() {
    if (typeof customElements === 'undefined' || typeof HTMLElement === 'undefined') return;
    if (customElements.get('kniu-status')) return;
    class KniuSysStatus extends HTMLElement {
      static get observedAttributes() { return ['type', 'size']; }
      constructor() {
        super();
        attachComponentShadow(this);
        this.shadowRoot.innerHTML = `<style>:host{--kniu-status-color:#409eff;display:inline-flex;vertical-align:middle}:host([type="success"]){--kniu-status-color:#67c23a}:host([type="warning"]){--kniu-status-color:#e6a23c}:host([type="danger"]){--kniu-status-color:#f56c6c}:host([type="info"]){--kniu-status-color:#909399}.kniu_sys_status{display:inline-flex;align-items:center;gap:6px;color:#606266;font:14px/1.5 Arial,"Microsoft YaHei",sans-serif;white-space:nowrap}.kniu_sys_status_dot{width:6px;height:6px;border-radius:50%;background-color:var(--kniu-status-color);flex:none}:host([size="large"]) .kniu_sys_status{font-size:16px}:host([size="large"]) .kniu_sys_status_dot{width:8px;height:8px}:host([size="small"]) .kniu_sys_status{gap:5px;font-size:12px}:host([size="small"]) .kniu_sys_status_dot{width:5px;height:5px}</style><span class="kniu_sys_status"><i class="kniu_sys_status_dot" aria-hidden="true"></i><slot></slot></span>`;
      }
    }
    customElements.define('kniu-status', KniuSysStatus);
  }

  // 空状态组件：居中展示插画 + 文案（note 属性，默认“暂无数据”），可选投影 slot 放自定义内容。
  // 与 kniu:if 配合作为列表/表格的空状态占位，替代手写 .detail_empty 这类 div。
  function registerEmptyComponent() {
    if (typeof customElements === 'undefined' || typeof HTMLElement === 'undefined') return;
    if (customElements.get('kniu-empty')) return;
    // 空状态插画：打开的盒子 + 两片斜开的纸盖 + 中间伸出的白纸。配色统一使用项目既有的中性灰
    // (#ebeef5 盒身 / #f4f4f5 盒盖 / #ffffff 纸 / #dcdfe6 描边 / #ebeef5 地面投影)。
    // 各形状使用内联 style="fill:#xxx" 以避开外层 .kniu_sys_empty_img svg{fill:currentColor} 的样式继承，
    // 保留颜色自定义能力。多色 inline style 优先级高于外层 fill:currentColor。
    var EMPTY_SVG = '<svg viewBox="0 0 64 41" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      // 盒底地面投影
      '<ellipse cx="32" cy="36.5" rx="22" ry="2.4" style="fill:#ebeef5"/>' +
      // 右侧盒盖（向外斜开）
      '<path d="M53 28.5 L43 12.5 L32 16 L42.5 24.5 Z" style="fill:#f4f4f5;stroke:#dcdfe6;stroke-width:0.6;stroke-linejoin:round"/>' +
      // 左侧盒盖（向外斜开）
      '<path d="M11 28.5 L21 12.5 L32 16 L21.5 24.5 Z" style="fill:#f4f4f5;stroke:#dcdfe6;stroke-width:0.6;stroke-linejoin:round"/>' +
      // 中间伸出的白纸
      '<path d="M27 4 L37 7 L37 19 L27 19 Z" style="fill:#ffffff;stroke:#dcdfe6;stroke-width:0.6;stroke-linejoin:round"/>' +
      // 纸张上方折痕
      '<path d="M27.5 12 L37 14.5" style="stroke:#e6e8eb;stroke-width:0.8;stroke-linecap:round;fill:none"/>' +
      // 盒身（微梯形正面）
      '<path d="M14.5 17 L18 21 L46 21 L49.5 17 L49.5 32 L46.5 35 L17.5 35 L14.5 32 Z" style="fill:#ebeef5;stroke:#dcdfe6;stroke-width:0.6;stroke-linejoin:round"/>' +
      // 盒身中线接缝
      '<path d="M32 21 L32 35" style="stroke:#dcdfe6;stroke-width:0.5;stroke-linecap:round;fill:none"/>' +
      '</svg>';
    class KniuSysEmpty extends HTMLElement {
      static get observedAttributes() { return ['note']; }
      constructor() {
        super();
        attachComponentShadow(this);
        this.shadowRoot.innerHTML =
          '<style>' +
          ':host{display:flex;flex-direction:column;align-items:center;justify-content:center;box-sizing:border-box;padding:40px 0;color:#909399;font-size:14px;line-height:1.5;text-align:center}' +
          ':host([hidden]){display:none}' +
          '.kniu_sys_empty_img{width:200px;height:128px;margin-bottom:16px;color:#C0C4CC}' +
          '.kniu_sys_empty_img svg{display:block;width:100%;height:100%;fill:currentColor}' +
          '.kniu_sys_empty_text{color:#909399}' +
          '::slotted(*){margin-top:8px;color:#909399}' +
          '</style>' +
          '<span class="kniu_sys_empty_img">' + EMPTY_SVG + '</span>' +
          '<span class="kniu_sys_empty_text"></span>' +
          '<slot></slot>';
      }
      connectedCallback() { this._render(); }
      attributeChangedCallback() { this._render(); }
      _render() {
        var text = this.shadowRoot.querySelector('.kniu_sys_empty_text');
        text.textContent = this.getAttribute('note') || '暂无数据';
      }
    }
    customElements.define('kniu-empty', KniuSysEmpty);
  }

  function registerEditorComponent() {
    if (typeof customElements === 'undefined' || typeof HTMLElement === 'undefined') return;
    if (customElements.get('kniu-editor')) return;

    var documentRef = typeof document !== 'undefined' ? document : null;
    if (!documentRef) return;

    // 现代表情集（参考 KindEditor emoticons 功能设计，使用 Unicode 表情替代旧版 gif 图标）
    var EMOJIS = ['😀', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '😉', '😊', '😍', '😘', '😎', '🤔', '🤨', '😐', '😴', '😭', '😡', '👍', '👎', '👌', '✌️', '🤝', '👏', '💪', '🙏', '👀', '💡', '🔥', '⭐', '✨', '🎉', '❤️', '💔', '💯', '✅', '❌', '⚠️', '❓', '❗', '💬', '📌', '📎', '🔗', '🚀', '📝', '📅', '📈', '📊', '☕', '🍀', '🌟', '🎯', '🏆', '💻', '📱', '🌈', '🍻'];

    // 最大化 / 还原 图标（viewBox 16x16）。必须放在 EDITOR_TOOLBAR_ITEMS 之前，
    // 否则对象字面量内 + EDITOR_ICON_MAXIMIZE + 拼接时变量未赋值，得到字符串 "undefined"。
    var EDITOR_ICON_MAXIMIZE = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 6V2h4M14 6V2h-4M2 10v4h4M14 10v4h-4"/></svg>';
    var EDITOR_ICON_RESTORE = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 2h4v4M14 2h-4v4M2 14h4v-4M14 14h-4v-4"/></svg>';

    // 工具栏条目定义：token -> HTML 片段。分组之间由 _buildToolbar 自动插入分隔线。
    var EDITOR_ICON_CLEAR_FORMAT = '<svg width="20" height="20" viewBox="0 0 1075 1024" fill="currentColor" aria-hidden="true"><path d="M184.576 90.2144a25.6 25.6 0 0 1-25.6-25.6v-36.5568a25.6 25.6 0 0 1 25.6-25.6H835.584a25.6 25.6 0 0 1 25.6 25.6v36.5568a25.6 25.6 0 0 1-25.6 25.6z m434.5856 689.4592l-446.976-446.9248a45.1584 45.1584 0 0 1-3.9936-59.2384l3.9936-4.608 120.1664-120.1152H562.8928l343.6544 343.552a45.1584 45.1584 0 0 1 0 63.8464L683.008 779.6736a45.1584 45.1584 0 0 1-63.8464 0zM411.6992 476.4672l191.5904-191.5904-60.0064-60.0064H312.2176l-76.0832 75.9808L349.184 412.5696l62.464 63.8976z" transform="translate(0,1024) scale(1,-1)"/></svg>';
    // iconfont.svg 的 remove_link 去掉末尾 X 路径，仅保留断开的链环。
    var EDITOR_ICON_UNLINK = '<svg width="16" height="16" viewBox="0 0 1024 1024" fill="currentColor" aria-hidden="true"><path d="M472.615385 175.261538c-11.815385 0-23.630769 1.969231-35.446154 5.907693-11.815385 1.969231-25.6 5.907692-37.415385 9.846154-7.876923 1.969231-15.753846 0-19.692308-3.938462l-7.876923-7.876923c-49.230769-49.230769-129.969231-55.138462-183.138461-9.846154-57.107692 51.2-61.046154 139.815385-5.907692 192.984616l129.96923 129.96923c17.723077 17.723077 37.415385 27.569231 59.076923 33.476923 27.569231 7.876923 57.107692 5.907692 82.707693-5.907692 15.753846-5.907692 31.507692-15.753846 43.323077-29.538461 5.907692-5.907692 11.815385-13.784615 17.723077-23.63077 5.907692-11.815385 21.661538-13.784615 31.507692-3.938461l49.230769 49.230769c7.876923 7.876923 7.876923 17.723077 1.969231 25.6-7.876923 9.846154-15.753846 17.723077-23.630769 27.569231-11.815385 11.815385-27.569231 23.630769-41.353847 33.476923-25.6 15.753846-51.2 25.6-80.738461 31.507692-53.169231 9.846154-110.276923 1.969231-161.476923-25.6-19.692308-9.846154-37.415385-23.630769-53.169231-39.384615l-126.030769-126.030769c-90.584615-90.584615-98.461538-238.276923-9.846154-332.8 92.553846-98.461538 248.123077-102.4 342.646154-5.907693l43.323077 43.323077c9.846154 9.846154 1.969231 29.538462-15.753846 31.507692z m324.923077 277.661539c94.523077 94.523077 92.553846 250.092308-5.907693 342.646154C697.107692 882.215385 549.415385 876.307692 458.830769 785.723077l-39.384615-39.384615c-11.815385-11.815385-3.938462-31.507692 11.815384-33.476924 23.630769-1.969231 49.230769-5.907692 72.861539-13.784615 7.876923-1.969231 15.753846 0 19.692308 3.938462l7.876923 7.876923c49.230769 49.230769 129.969231 55.138462 183.138461 9.846154 57.107692-51.2 61.046154-139.815385 5.907693-192.984616L590.769231 397.784615c-17.723077-17.723077-37.415385-27.569231-59.076923-33.476923-27.569231-7.876923-57.107692-5.907693-82.707693 5.907693-15.753846 5.907692-31.507692 15.753846-43.323077 29.538461-5.907692 5.907692-11.815385 13.784615-15.753846 21.661539-5.907692 11.815385-21.661538 13.784615-31.507692 3.938461l-47.261538-47.261538c-7.876923-7.876923-7.876923-17.723077-1.969231-25.6 7.876923-9.846154 13.784615-17.723077 23.630769-27.569231 13.784615-13.784615 27.569231-23.630769 41.353846-33.476923 25.6-15.753846 51.2-25.6 80.738462-31.507692 53.169231-9.846154 110.276923-1.969231 161.476923 25.6 19.692308 9.846154 37.415385 23.630769 53.169231 39.384615l128 128z" transform="translate(0,1025) scale(1,-1)"/></svg>';

    var EDITOR_TOOLBAR_ITEMS = {
      'undo': '<button type="button" class="kniu_sys_editor_btn" data-cmd="undo" title="撤销"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M9 7L4 12l5 5"/><path d="M4 12h11a5 5 0 0 1 0 10h-2"/></svg></button>',
      'redo': '<button type="button" class="kniu_sys_editor_btn" data-cmd="redo" title="重做"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M15 7l5 5-5 5"/><path d="M20 12H9a5 5 0 0 0 0 10h2"/></svg></button>',
      'preview': '<button type="button" class="kniu_sys_editor_btn" data-action="preview" title="预览"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg></button>',
      'print': '<button type="button" class="kniu_sys_editor_btn" data-action="print" title="打印"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M7 9V4h10v5"/><path d="M7 19H5v-7h14v7h-2"/><rect x="7" y="14" width="10" height="6" rx="1"/></svg></button>',
      'code': '<button type="button" class="kniu_sys_editor_btn" data-action="code" title="代码模式">&lt;/&gt;</button>',
      'maximize': '<button type="button" class="kniu_sys_editor_btn" data-action="maximize" title="最大化/还原"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 6V2h4M14 6V2h-4M2 10v4h4M14 10v4h-4"/></svg></button>',
      'bold': '<button type="button" class="kniu_sys_editor_btn" data-cmd="bold" title="加粗"><b>B</b></button>',
      'italic': '<button type="button" class="kniu_sys_editor_btn" data-cmd="italic" title="斜体"><i>I</i></button>',
      'underline': '<button type="button" class="kniu_sys_editor_btn" data-cmd="underline" title="下划线"><u>U</u></button>',
      'strikeThrough': '<button type="button" class="kniu_sys_editor_btn" data-cmd="strikeThrough" title="删除线"><s>S</s></button>',
      'subscript': '<button type="button" class="kniu_sys_editor_btn" data-cmd="subscript" title="下标">x₂</button>',
      'superscript': '<button type="button" class="kniu_sys_editor_btn" data-cmd="superscript" title="上标">x²</button>',
      'justifyLeft': '<button type="button" class="kniu_sys_editor_btn" data-cmd="justifyLeft" title="左对齐"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 6h16M4 10h10M4 14h16M4 18h10"/></svg></button>',
      'justifyCenter': '<button type="button" class="kniu_sys_editor_btn" data-cmd="justifyCenter" title="居中"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 6h16M7 10h10M4 14h16M7 18h10"/></svg></button>',
      'justifyRight': '<button type="button" class="kniu_sys_editor_btn" data-cmd="justifyRight" title="右对齐"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 6h16M10 10h10M4 14h16M10 18h10"/></svg></button>',
      'justifyFull': '<button type="button" class="kniu_sys_editor_btn" data-cmd="justifyFull" title="两端对齐"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 6h16M4 10h16M4 14h16M4 18h16"/></svg></button>',
      'indent': '<button type="button" class="kniu_sys_editor_btn" data-cmd="indent" title="增加缩进"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M11 6h9M11 10h9M11 14h9M11 18h9"/><path d="M4 9l4 3-4 3z" fill="currentColor" stroke="none"/></svg></button>',
      'outdent': '<button type="button" class="kniu_sys_editor_btn" data-cmd="outdent" title="减少缩进"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M11 6h9M11 10h9M11 14h9M11 18h9"/><path d="M8 9l-4 3 4 3z" fill="currentColor" stroke="none"/></svg></button>',
      'insertOrderedList': '<button type="button" class="kniu_sys_editor_btn" data-cmd="insertOrderedList" title="有序列表"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M9 6h11M9 10h11M9 14h11M9 18h11"/><text x="3" y="9" font-size="7" fill="currentColor" stroke="none">1.</text><text x="3" y="17" font-size="7" fill="currentColor" stroke="none">2.</text></svg></button>',
      'insertUnorderedList': '<button type="button" class="kniu_sys_editor_btn" data-cmd="insertUnorderedList" title="无序列表"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M9 6h11M9 10h11M9 14h11M9 18h11"/><circle cx="4" cy="6" r="1.4" fill="currentColor" stroke="none"/><circle cx="4" cy="10" r="1.4" fill="currentColor" stroke="none"/><circle cx="4" cy="14" r="1.4" fill="currentColor" stroke="none"/><circle cx="4" cy="18" r="1.4" fill="currentColor" stroke="none"/></svg></button>',
      'lineheight': '<select class="kniu_sys_editor_select" data-action="lineheight" title="行距"><option value="1">1.0</option><option value="1.5" selected>1.5</option><option value="1.75">1.75</option><option value="2">2.0</option><option value="2.5">2.5</option><option value="3">3.0</option></select>',
      'h1': '<button type="button" class="kniu_sys_editor_btn" data-block="h1" title="标题1"><b>H1</b></button>',
      'h2': '<button type="button" class="kniu_sys_editor_btn" data-block="h2" title="标题2"><b>H2</b></button>',
      'h3': '<button type="button" class="kniu_sys_editor_btn" data-block="h3" title="标题3"><b>H3</b></button>',
      'p': '<button type="button" class="kniu_sys_editor_btn" data-block="p" title="段落">&para;</button>',
      'blockquote': '<button type="button" class="kniu_sys_editor_btn" data-block="blockquote" title="引用">&#10077;</button>',
      'pre': '<button type="button" class="kniu_sys_editor_btn" data-block="pre" title="代码块">{ }</button>',
      'hr': '<button type="button" class="kniu_sys_editor_btn" data-action="hr" title="分割线"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 12h18"/><path d="M3 8v8M21 8v8"/></svg></button>',
      'table': '<button type="button" class="kniu_sys_editor_btn" data-action="table" title="表格"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="4" width="18" height="16" rx="1"/><path d="M3 10h18M3 15h18M9 4v16M15 4v16"/></svg></button>',
      'fontname': '<button type="button" class="kniu_sys_editor_btn kniu_sys_editor_fontname" data-action="fontname" title="字体" aria-label="选择字体"><span class="kniu_sys_editor_font_icon">F</span><span class="kniu_sys_editor_font_arrow">▾</span></button>',
      'fontsize': '<button type="button" class="kniu_sys_editor_btn kniu_sys_editor_fontsize" data-action="fontsize" title="字号" aria-label="选择字号"><span class="kniu_sys_editor_size_icon"><small>T</small>T</span><span class="kniu_sys_editor_font_arrow">▾</span></button>',
      'forecolor': '<button type="button" class="kniu_sys_editor_btn kniu_sys_editor_color_btn" data-action="forecolor" title="文字颜色" aria-label="文字颜色"><span class="kniu_sys_editor_color_letter">A</span><span class="kniu_sys_editor_color_mark" style="background-color:#409eff"></span><span class="kniu_sys_editor_font_arrow">▾</span></button>',
      'hilitecolor': '<button type="button" class="kniu_sys_editor_btn kniu_sys_editor_color_btn" data-action="hilitecolor" title="文字背景" aria-label="文字背景"><span class="kniu_sys_editor_color_letter kniu_sys_editor_color_letter_bg">A</span><span class="kniu_sys_editor_font_arrow">▾</span></button>',
      'link': '<button type="button" class="kniu_sys_editor_btn" data-action="link" title="链接"><svg width="16" height="16" viewBox="0 0 1024 1024" fill="currentColor"><path d="M715.648 625.152 670.4 579.904l90.496-90.56c75.008-74.944 85.12-186.368 22.656-248.896-62.528-62.464-173.952-52.352-248.96 22.656L444.16 353.6l-45.248-45.248 90.496-90.496c100.032-99.968 251.968-110.08 339.456-22.656 87.488 87.488 77.312 239.424-22.656 339.456l-90.496 90.496zm-90.496 90.496-90.496 90.496C434.624 906.112 282.688 916.224 195.2 828.8c-87.488-87.488-77.312-239.424 22.656-339.456l90.496-90.496 45.248 45.248-90.496 90.56c-75.008 74.944-85.12 186.368-22.656 248.896 62.528 62.464 173.952 52.352 248.96-22.656l90.496-90.496zm0-362.048 45.248 45.248L398.848 670.4 353.6 625.152z"/></svg></button>',
      'image': '<button type="button" class="kniu_sys_editor_btn" data-action="image" title="插入图片" aria-label="插入图片"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m4 18 5-5 3 3 3-4 5 6"/></svg></button>',
      'media': '<button type="button" class="kniu_sys_editor_btn" data-action="media" title="插入音视频" aria-label="插入音视频"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m10 9 5 3-5 3z" fill="currentColor" stroke="none"/><path d="M6 3v2M18 3v2"/></svg></button>',
      'unlink': '<button type="button" class="kniu_sys_editor_btn" data-cmd="unlink" title="取消链接"><svg width="16" height="16" viewBox="0 0 1024 1024" fill="currentColor"><path d="M472.615385 175.261538c-11.815385 0-23.630769 1.969231-35.446154 5.907693-11.815385 1.969231-25.6 5.907692-37.415385 9.846154-7.876923 1.969231-15.753846 0-19.692308-3.938462l-7.876923-7.876923c-49.230769-49.230769-129.969231-55.138462-183.138461-9.846154-57.107692 51.2-61.046154 139.815385-5.907692 192.984616l129.96923 129.96923c17.723077 17.723077 37.415385 27.569231 59.076923 33.476923 27.569231 7.876923 57.107692 5.907692 82.707693-5.907692 15.753846-5.907692 31.507692-15.753846 43.323077-29.538461 5.907692-5.907692 11.815385-13.784615 17.723077-23.63077 5.907692-11.815385 21.661538-13.784615 31.507692-3.938461l49.230769 49.230769c7.876923 7.876923 7.876923 17.723077 1.969231 25.6-7.876923 9.846154-15.753846 17.723077-23.630769 27.569231-11.815385 11.815385-27.569231 23.630769-41.353847 33.476923-25.6 15.753846-51.2 25.6-80.738461 31.507692-53.169231 9.846154-110.276923 1.969231-161.476923-25.6-19.692308-9.846154-37.415385-23.630769-53.169231-39.384615l-126.030769-126.030769c-90.584615-90.584615-98.461538-238.276923-9.846154-332.8 92.553846-98.461538 248.123077-102.4 342.646154-5.907693l43.323077 43.323077c9.846154 9.846154 1.969231 29.538462-15.753846 31.507692z m324.923077 277.661539c94.523077 94.523077 92.553846 250.092308-5.907693 342.646154C697.107692 882.215385 549.415385 876.307692 458.830769 785.723077l-39.384615-39.384615c-11.815385-11.815385-3.938462-31.507692 11.815384-33.476924 23.630769-1.969231 49.230769-5.907692 72.861539-13.784615 7.876923-1.969231 15.753846 0 19.692308 3.938462l7.876923 7.876923c49.230769 49.230769 129.969231 55.138462 183.138461 9.846154 57.107692-51.2 61.046154-139.815385 5.907693-192.984616L590.769231 397.784615c-17.723077-17.723077-37.415385-27.569231-59.076923-33.476923-27.569231-7.876923-57.107692-5.907692-82.707693 5.907693-15.753846 5.907692-31.507692 15.753846-43.323077 29.538461-5.907692 5.907692-11.815385 13.784615-15.753846 21.661539-5.907692 11.815385-21.661538 13.784615-31.507692 3.938461l-47.261538-47.261538c-7.876923-7.876923-7.876923-17.723077-1.969231-25.6 7.876923-9.846154 13.784615-17.723077 23.630769-27.569231 13.784615-13.784615 27.569231-23.630769 41.353846-33.476923 25.6-15.753846 51.2-25.6 80.738462-31.507692 53.169231-9.846154 110.276923-1.969231 161.476923 25.6 19.692308 9.846154 37.415385 23.630769 53.169231 39.384615l128 128zM888.123077 88.615385l90.584615 90.584615c7.876923 7.876923 7.876923 19.692308 0 27.569231l-55.138461 55.138461c-7.876923 7.876923-19.692308 7.876923-27.569231 0L807.384615 169.353846l-84.676923 84.676923c-7.876923 7.876923-19.692308 7.876923-27.56923 0l-55.138462-55.138461c-7.876923-7.876923-7.876923-19.692308 0-27.569231l84.676923-84.676923-82.707692-82.707692c-7.876923-7.876923-7.876923-19.692308 0-27.569231l55.138461-55.138462c7.876923-7.876923 19.692308-7.876923 27.569231 0l82.707692 82.707693 88.615385-88.615385c7.876923-7.876923 19.692308-7.876923 27.569231 0l55.138461 55.138461c7.876923 7.876923 7.876923 19.692308 0 27.569231L888.123077 88.615385z" transform="translate(0,1025) scale(1,-1)"/></svg></button>',
      'emoticons': '<button type="button" class="kniu_sys_editor_btn" data-action="emoticons" title="表情"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><circle cx="9" cy="10" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="10" r="1" fill="currentColor" stroke="none"/><path d="M8 15a5 5 0 0 0 8 0"/></svg></button>',
      'removeFormat': '<button type="button" class="kniu_sys_editor_btn" data-cmd="removeFormat" title="清除格式"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 15l7-7 5 5-4 4H7z"/><path d="M9 20h11"/></svg></button>',
      'clearhtml': '<button type="button" class="kniu_sys_editor_btn" data-action="clearhtml" title="清理HTML"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M19 4l1 1-8 8-2-2z"/><path d="M11 12L4 19l1 1 7-7"/></svg></button>',
      'selectAll': '<button type="button" class="kniu_sys_editor_btn" data-cmd="selectAll" title="全选"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 4h16v16H4z"/><path d="M9 9h6v6H9z"/></svg></button>'
    };

    // 默认工具栏（分组数组，每组之间用分隔线分隔）。未设置 toolbar 属性时使用。
    // 顺序参考 KindEditor 默认布局：source | undo redo | preview print code | justify* list indent subscript superscript clearhtml selectall | fullscreen / formatblock fontname fontsize | forecolor hilitecolor bold italic underline strikethrough lineheight removeformat | table hr emoticons link unlink
    // 映射：source→code(源码模式)、code(插入代码)→pre、fullscreen→maximize；image/flash/media/map 等需后端能力项按项目约定跳过。
    var EDITOR_DEFAULT_TOOLBAR = [
      ['code'],
      ['undo', 'redo'],
      ['preview', 'print', 'pre'],
      ['justifyLeft', 'justifyCenter', 'justifyRight', 'justifyFull'],
      ['insertOrderedList', 'insertUnorderedList'],
      ['indent', 'outdent'],
      ['subscript', 'superscript'],
      ['clearhtml', 'selectAll'],
      ['maximize'],
      ['h1', 'h2', 'h3', 'p', 'blockquote'],
      ['fontname', 'fontsize'],
      ['forecolor', 'hilitecolor'],
      ['bold', 'italic', 'underline', 'strikeThrough', 'lineheight', 'removeFormat'],
      ['table', 'hr', 'emoticons'],
      ['link', 'image', 'media', 'unlink']
    ];

    class KniuSysEditor extends HTMLElement {
      static get observedAttributes() { return ['name', 'placeholder', 'readonly', 'disabled', 'toolbar']; }
      constructor() {
        super();
        attachComponentShadow(this);
        this.shadowRoot.innerHTML = [
          '<style>',
          ':host{display:block;width:100%}',
          '.kniu_sys_editor_group{display:flex;width:100%}',
          '.kniu_sys_editor_affix{display:none;align-items:center;justify-content:center;align-self:flex-start;flex:none;padding:0 20px;border:1px solid #dcdfe6;background-color:#f5f7fa;color:#909399;font-size:14px;line-height:38px;text-align:center;white-space:nowrap;box-sizing:border-box}',
          '.kniu_sys_editor_group[data-has-prepend="true"] .kniu_sys_editor_prepend{display:flex;border-right:0;border-radius:4px 0 0 4px}',
          '.kniu_sys_editor_main{position:relative;flex:1;min-width:0;display:flex;flex-direction:column;border:1px solid #dcdfe6;border-radius:4px;background-color:#fff;overflow:hidden}',
          '.kniu_sys_editor_group[data-has-prepend="true"] .kniu_sys_editor_main{border-radius:0 4px 4px 4px}',
          '.kniu_sys_editor_toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:2px;padding:6px 8px;border-bottom:1px solid #ebeef5;background-color:#f5f7fa}',
          '.kniu_sys_editor_btn{display:inline-flex;align-items:center;justify-content:center;width:32px;height:30px;padding:0;border:0;border-radius:4px;background-color:transparent;color:#606266;font-size:14px;font-weight:600;line-height:1;cursor:pointer;transition:background-color .15s,color .15s;flex:none;overflow:hidden}',
          // 工具栏内统一图标视觉占位：SVG 强制 18×18，文字图标（<b>/<i>/<u>/<s>/裸文本）至少 18×18，flex 居中
          '.kniu_sys_editor_btn > svg{width:17px;height:17px;display:block;flex:none}',
          '.kniu_sys_editor_btn[data-cmd="removeFormat"] > svg{width:20px;height:20px}',
          '.kniu_sys_editor_btn > *{font-weight:600}',
          '.kniu_sys_editor_btn > b,.kniu_sys_editor_btn > i,.kniu_sys_editor_btn > u,.kniu_sys_editor_btn > s{display:inline-flex;align-items:center;justify-content:center;height:17px;min-width:17px;min-height:17px;font-size:14px;line-height:1;font-weight:700;text-align:center;letter-spacing:0}',
          '.kniu_sys_editor_btn > :not(svg):not(b):not(i):not(u):not(s){display:inline-flex;align-items:center;justify-content:center;min-width:17px;min-height:17px;font-size:14px;line-height:1;text-align:center}',
          '.kniu_sys_editor_btn:hover{background-color:#ecf5ff;color:#409eff}',
          '.kniu_sys_editor_btn:active{background-color:#d9ecff}',
          '.kniu_sys_editor_btn[aria-pressed="true"]{background-color:#d9ecff;color:#409eff}',
          '.kniu_sys_editor_btn:disabled{opacity:.5;cursor:not-allowed}',
          '.kniu_sys_editor_divider{width:1px;height:20px;background-color:#dcdfe6;margin:5px 3px;flex:none}',
          '.kniu_sys_editor_content{min-height:200px;max-height:400px;padding:10px 14px;outline:0;overflow-y:auto;font:14px/1.7 Arial,"Microsoft YaHei",sans-serif;color:#303133;word-break:break-word;cursor:text}',
          '.kniu_sys_editor_content:empty::before{content:attr(data-placeholder);color:#c0c4cc;pointer-events:none}',
          '.kniu_sys_editor_content h1{font-size:1.6em;margin:.5em 0}',
          '.kniu_sys_editor_content h2{font-size:1.4em;margin:.5em 0}',
          '.kniu_sys_editor_content h3{font-size:1.2em;margin:.5em 0}',
          '.kniu_sys_editor_content p{margin:.3em 0}',
          '.kniu_sys_editor_content ul,.kniu_sys_editor_content ol{padding-left:2em;margin:.3em 0}',
          '.kniu_sys_editor_content blockquote{margin:.5em 0;padding:.5em 1em;border-left:4px solid #dcdfe6;background-color:#f9fafc;color:#606266}',
          '.kniu_sys_editor_content code{background-color:#f0f0f0;padding:2px 4px;border-radius:3px;font-family:Consolas,Monaco,monospace;font-size:.9em}',
          '.kniu_sys_editor_content pre{margin:.5em 0;padding:.6em 1em;background-color:#f6f8fa;border-radius:4px;overflow-x:auto;font-family:Consolas,Monaco,monospace;font-size:.9em;line-height:1.5}',
          '.kniu_sys_editor_content pre code{background-color:transparent;padding:0}',
          '.kniu_sys_editor_content a{color:#409eff;text-decoration:underline}',
          '.kniu_sys_editor_content img,.kniu_sys_editor_content video{display:block;max-width:100%;height:auto;margin:.5em 0}',
          '.kniu_sys_editor_content audio{display:block;max-width:100%;margin:.5em 0}',
          '.kniu_sys_editor_content .kniu_sys_editor_media_selected{outline:0;filter:brightness(.62) sepia(.65) saturate(5) hue-rotate(175deg);transition:filter .15s ease}',
          '.kniu_sys_editor_source{display:none;min-height:200px;max-height:400px;width:100%;padding:10px 14px;border:0;outline:0;resize:vertical;font:13px/1.6 Consolas,Monaco,monospace;color:#303133;box-sizing:border-box;background-color:#fbfbfc}',
          '.kniu_sys_editor_group[data-code-mode="true"] .kniu_sys_editor_content{display:none}',
          '.kniu_sys_editor_group[data-code-mode="true"] .kniu_sys_editor_source{display:block}',
          '.kniu_sys_editor_select{height:28px;max-width:120px;padding:0 4px;border:1px solid #dcdfe6;border-radius:3px;background-color:#fff;color:#606266;font-size:12px;cursor:pointer;flex:none;box-sizing:border-box}',
          '.kniu_sys_editor_fontname{position:relative;width:36px;padding-right:8px}',
          '.kniu_sys_editor_font_icon{font-family:Georgia,serif;font-size:15px!important;font-style:italic;font-weight:700}',
          '.kniu_sys_editor_fontsize{position:relative;width:36px;padding-right:8px}',
          '.kniu_sys_editor_size_icon{display:inline-flex!important;align-items:flex-end!important;gap:1px;font-family:Arial,sans-serif;font-size:15px!important;font-weight:600}',
          '.kniu_sys_editor_size_icon small{font-size:9px;line-height:1.2}',
          '.kniu_sys_editor_color_btn{position:relative;width:36px;padding-right:8px}',
          '.kniu_sys_editor_color_letter{font-family:Arial,sans-serif;font-size:15px!important;font-weight:500;color:#409eff}',
          '.kniu_sys_editor_color_letter_bg{padding:2px 3px;border-radius:2px;background-color:#ffd900;color:#222;font-size:12px!important;font-weight:700}',
          '.kniu_sys_editor_color_mark{position:absolute;left:8px;right:10px;bottom:3px;height:2px;min-width:0!important;min-height:0!important}',
          '.kniu_sys_editor_font_arrow{position:absolute;right:3px;bottom:3px;min-width:0!important;min-height:0!important;font-size:8px!important;color:#909399}',
          '.kniu_sys_editor_select:focus{outline:0;border-color:#409eff}',
          '.kniu_sys_editor_color{width:30px;height:28px;padding:0;border:1px solid #dcdfe6;border-radius:3px;background-color:#fff;cursor:pointer;flex:none;box-sizing:border-box}',
          '.kniu_sys_editor_color::-webkit-color-swatch-wrapper{padding:2px}',
          '.kniu_sys_editor_color::-webkit-color-swatch{border:0;border-radius:2px}',
          '.kniu_sys_editor_content font[size="1"]{font-size:12px}',
          '.kniu_sys_editor_content font[size="2"]{font-size:14px}',
          '.kniu_sys_editor_content font[size="3"]{font-size:16px}',
          '.kniu_sys_editor_content font[size="4"]{font-size:18px}',
          '.kniu_sys_editor_content font[size="5"]{font-size:22px}',
          '.kniu_sys_editor_content font[size="6"]{font-size:26px}',
          '.kniu_sys_editor_content font[size="7"]{font-size:32px}',
          '.kniu_sys_editor_content table{border-collapse:collapse;width:100%;margin:.5em 0}',
          '.kniu_sys_editor_content td,.kniu_sys_editor_content th{border:1px solid #dcdfe6;padding:6px 10px;min-width:40px;height:22px}',
          '.kniu_sys_editor_toolbar{position:static}',
          '.kniu_sys_editor_popover{position:absolute;top:0;left:0;z-index:30;background-color:#fff;border:1px solid #ebeef5;border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.14);padding:12px;min-width:210px;max-width:calc(100% - 16px);overflow-x:hidden;overflow-y:auto;box-sizing:border-box}',
          '.kniu_sys_editor_popover[hidden]{display:none}',
          '.kniu_sys_editor_popover_row{display:flex;align-items:center;gap:8px;margin-bottom:10px;font-size:13px;color:#606266}',
          '.kniu_sys_editor_popover_row[hidden]{display:none}',
          '.kniu_sys_editor_popover_row label{flex:none;width:42px}',
          '.kniu_sys_editor_popover_row input{width:70px;height:28px;padding:0 6px;border:1px solid #dcdfe6;border-radius:4px;font-size:13px;box-sizing:border-box}',
          '.kniu_sys_editor_popover_link{width:320px;padding:14px}',
          '.kniu_sys_editor_popover_media_edit{box-shadow:0 0 0 9999px rgba(0,0,0,.6),0 8px 24px rgba(0,0,0,.22);animation:kniu_editor_media_modal_in .2s ease-out both}',
          '.kniu_sys_editor_popover_media_edit.kniu_sys_editor_popover_closing{animation:kniu_editor_media_modal_out .18s ease-in both;pointer-events:none}',
          '@keyframes kniu_editor_media_modal_in{from{opacity:0;scale:.94;box-shadow:0 0 0 9999px rgba(0,0,0,0),0 4px 12px rgba(0,0,0,0)}to{opacity:1;scale:1;box-shadow:0 0 0 9999px rgba(0,0,0,.6),0 8px 24px rgba(0,0,0,.22)}}',
          '@keyframes kniu_editor_media_modal_out{from{opacity:1;scale:1;box-shadow:0 0 0 9999px rgba(0,0,0,.6),0 8px 24px rgba(0,0,0,.22)}to{opacity:0;scale:.94;box-shadow:0 0 0 9999px rgba(0,0,0,0),0 4px 12px rgba(0,0,0,0)}}',
          '.kniu_sys_editor_popover_title{margin-bottom:12px;color:#303133;font-size:15px;font-weight:600}',
          '.kniu_sys_editor_popover_link .kniu_sys_editor_popover_row label{width:58px}',
          '.kniu_sys_editor_popover_link .kniu_sys_editor_popover_row input{flex:1;width:auto;min-width:0}',
          '.kniu_sys_editor_popover_link .kniu_sys_editor_popover_row input[type="checkbox"]{appearance:none;flex:none;width:14px;height:14px;margin:0;border:1px solid #dcdfe6;border-radius:2px;outline:0;background-color:#fff;background-position:center;background-repeat:no-repeat;background-size:10px 8px;box-sizing:border-box;cursor:pointer}.kniu_sys_editor_popover_link .kniu_sys_editor_popover_row input[type="checkbox"]:checked{border-color:#409eff;background-color:#409eff;background-image:url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 12 10\'%3E%3Cpath d=\'M1 5l3 3 7-7\' fill=\'none\' stroke=\'%23fff\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'/%3E%3C/svg%3E")}.kniu_sys_editor_popover_link .kniu_sys_editor_popover_row input[type="checkbox"]:focus-visible{outline:2px solid rgba(64,158,255,.3);outline-offset:2px}',
          '.kniu_sys_editor_popover_link .kniu_sys_editor_popover_row select{flex:1;height:28px;padding:0 6px;border:1px solid #dcdfe6;border-radius:4px;background-color:#fff;color:#606266;font-size:13px;box-sizing:border-box}',
          '.kniu_sys_editor_popover_actions{display:flex;justify-content:flex-end;gap:8px;margin:2px 0 0}',
          '.kniu_sys_editor_popover_cancel{height:30px;padding:0 14px;border:1px solid #dcdfe6;border-radius:4px;background-color:#fff;color:#606266;font-size:13px;cursor:pointer}',
          '.kniu_sys_editor_popover_delete{height:30px;margin-right:auto;padding:0 14px;border:1px solid #f56c6c;border-radius:4px;background-color:#fff;color:#f56c6c;font-size:13px;cursor:pointer}',
          '.kniu_sys_editor_popover_delete:hover{background-color:#fef0f0}',
          '.kniu_sys_editor_delete_tip{padding:14px 0 20px;color:#606266;font-size:14px;line-height:1.6}',
          '.kniu_sys_editor_popover_error{min-height:18px;margin:-4px 0 6px 66px;color:#f56c6c;font-size:12px}',
          '.kniu_sys_editor_popover_btn{height:30px;padding:0 14px;border:0;border-radius:4px;background-color:#409eff;color:#fff;font-size:13px;cursor:pointer}',
          '.kniu_sys_editor_popover_btn:hover{background-color:#66b1ff}',
          '.kniu_sys_editor_popover_grid{display:grid;grid-template-columns:repeat(8,1fr);gap:4px;max-height:208px;overflow:auto}',
          '.kniu_sys_editor_font_list{display:flex;flex-direction:column;width:190px;max-width:100%}',
          '.kniu_sys_editor_font_item{display:flex;align-items:center;width:100%;min-height:32px;padding:5px 10px;border:0;border-radius:4px;background-color:transparent;color:#303133;font-size:14px;text-align:left;cursor:pointer}',
          '.kniu_sys_editor_font_item:hover{background-color:#ecf5ff;color:#409eff}',
          '.kniu_sys_editor_font_item[aria-checked="true"]::before{content:"✓";width:20px;color:#409eff;font-family:Arial,sans-serif}',
          '.kniu_sys_editor_font_item[aria-checked="false"]::before{content:"";width:20px}',
          '.kniu_sys_editor_size_list{display:flex;flex-direction:column;width:130px;max-width:100%}',
          '.kniu_sys_editor_size_item{display:flex;align-items:center;width:100%;min-height:32px;padding:4px 12px;border:0;border-radius:4px;background-color:transparent;color:#303133;text-align:left;line-height:1.15;cursor:pointer}',
          '.kniu_sys_editor_size_item:hover{background-color:#ecf5ff;color:#409eff}',
          '.kniu_sys_editor_palette{width:176px}',
          '.kniu_sys_editor_no_color{display:block;width:100%;height:30px;margin-bottom:8px;border:0;border-radius:4px;background-color:transparent;color:#606266;font-size:13px;cursor:pointer}',
          '.kniu_sys_editor_no_color:hover{background-color:#ecf5ff;color:#409eff}',
          '.kniu_sys_editor_swatch_grid{display:grid;grid-template-columns:repeat(6,22px);gap:6px}',
          '.kniu_sys_editor_swatch{width:22px;height:22px;border:1px solid transparent;border-radius:2px;cursor:pointer;box-sizing:border-box}',
          '.kniu_sys_editor_swatch:hover{outline:2px solid #409eff;outline-offset:1px}',
          '.kniu_sys_editor_emoji{display:flex;align-items:center;justify-content:center;height:32px;font-size:18px;border:0;background-color:transparent;border-radius:6px;cursor:pointer}',
          '.kniu_sys_editor_emoji:hover{background-color:#ecf5ff}',
          ':host([data-preview="true"]) .kniu_sys_editor_content{background-color:#fafafa;cursor:default}',
          ':host([data-maximized="true"]){position:fixed;top:0;left:0;right:0;bottom:0;z-index:9999;width:auto;height:auto;background-color:#fff}',
          ':host([data-maximized="true"]) .kniu_sys_editor_group{height:100%;flex-direction:column}',
          ':host([data-maximized="true"]) .kniu_sys_editor_main{flex:1;max-height:none;border-radius:0;display:flex;flex-direction:column}',
          ':host([data-maximized="true"]) .kniu_sys_editor_content,:host([data-maximized="true"]) .kniu_sys_editor_source{flex:1;min-height:0;max-height:none}',
          ':host([data-maximized="true"]) .kniu_sys_editor_prepend,:host([data-maximized="true"]) .kniu_sys_editor_append{display:none}',
          ':host([data-invalid="true"]) .kniu_sys_editor_main{border-color:#f56c6c}',
          '</style>',
          '<div class="kniu_sys_editor_group" data-has-prepend="false" data-code-mode="false">',
          '<span class="kniu_sys_editor_affix kniu_sys_editor_prepend"><slot name="prepend"></slot></span>',
          '<div class="kniu_sys_editor_main">',
          '<div class="kniu_sys_editor_toolbar">',
          // 撤销 / 重做
          '<button type="button" class="kniu_sys_editor_btn" data-cmd="undo" title="撤销"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M9 7L4 12l5 5"/><path d="M4 12h11a5 5 0 0 1 0 10h-2"/></svg></button>',
          '<button type="button" class="kniu_sys_editor_btn" data-cmd="redo" title="重做"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M15 7l5 5-5 5"/><path d="M20 12H9a5 5 0 0 0 0 10h2"/></svg></button>',
          '<span class="kniu_sys_editor_divider"></span>',
          // 视图
          '<button type="button" class="kniu_sys_editor_btn" data-action="preview" title="预览"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg></button>',
          '<button type="button" class="kniu_sys_editor_btn" data-action="print" title="打印"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M7 9V4h10v5"/><path d="M7 19H5v-7h14v7h-2"/><rect x="7" y="14" width="10" height="6" rx="1"/></svg></button>',
          '<button type="button" class="kniu_sys_editor_btn" data-action="code" title="代码模式">&lt;/&gt;</button>',
          '<button type="button" class="kniu_sys_editor_btn" data-action="maximize" title="最大化/还原"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 6V2h4M14 6V2h-4M2 10v4h4M14 10v4h-4"/></svg></button>',
          '<span class="kniu_sys_editor_divider"></span>',
          // 字体样式
          '<button type="button" class="kniu_sys_editor_btn" data-cmd="bold" title="加粗"><b>B</b></button>',
          '<button type="button" class="kniu_sys_editor_btn" data-cmd="italic" title="斜体"><i>I</i></button>',
          '<button type="button" class="kniu_sys_editor_btn" data-cmd="underline" title="下划线"><u>U</u></button>',
          '<button type="button" class="kniu_sys_editor_btn" data-cmd="strikeThrough" title="删除线"><s>S</s></button>',
          '<button type="button" class="kniu_sys_editor_btn" data-cmd="subscript" title="下标">x₂</button>',
          '<button type="button" class="kniu_sys_editor_btn" data-cmd="superscript" title="上标">x²</button>',
          '<span class="kniu_sys_editor_divider"></span>',
          // 对齐
          '<button type="button" class="kniu_sys_editor_btn" data-cmd="justifyLeft" title="左对齐"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 6h16M4 10h10M4 14h16M4 18h10"/></svg></button>',
          '<button type="button" class="kniu_sys_editor_btn" data-cmd="justifyCenter" title="居中"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 6h16M7 10h10M4 14h16M7 18h10"/></svg></button>',
          '<button type="button" class="kniu_sys_editor_btn" data-cmd="justifyRight" title="右对齐"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 6h16M10 10h10M4 14h16M10 18h10"/></svg></button>',
          '<button type="button" class="kniu_sys_editor_btn" data-cmd="justifyFull" title="两端对齐"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 6h16M4 10h16M4 14h16M4 18h16"/></svg></button>',
          '<span class="kniu_sys_editor_divider"></span>',
          // 缩进 / 列表
          '<button type="button" class="kniu_sys_editor_btn" data-cmd="indent" title="增加缩进"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M11 6h9M11 10h9M11 14h9M11 18h9"/><path d="M4 9l4 3-4 3z" fill="currentColor" stroke="none"/></svg></button>',
          '<button type="button" class="kniu_sys_editor_btn" data-cmd="outdent" title="减少缩进"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M11 6h9M11 10h9M11 14h9M11 18h9"/><path d="M8 9l-4 3 4 3z" fill="currentColor" stroke="none"/></svg></button>',
          '<span class="kniu_sys_editor_divider"></span>',
          '<button type="button" class="kniu_sys_editor_btn" data-cmd="insertOrderedList" title="有序列表"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M9 6h11M9 10h11M9 14h11M9 18h11"/><text x="3" y="9" font-size="7" fill="currentColor" stroke="none">1.</text><text x="3" y="17" font-size="7" fill="currentColor" stroke="none">2.</text></svg></button>',
          '<button type="button" class="kniu_sys_editor_btn" data-cmd="insertUnorderedList" title="无序列表"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M9 6h11M9 10h11M9 14h11M9 18h11"/><circle cx="4" cy="6" r="1.4" fill="currentColor" stroke="none"/><circle cx="4" cy="10" r="1.4" fill="currentColor" stroke="none"/><circle cx="4" cy="14" r="1.4" fill="currentColor" stroke="none"/><circle cx="4" cy="18" r="1.4" fill="currentColor" stroke="none"/></svg></button>',
          '<span class="kniu_sys_editor_divider"></span>',
          // 行距
          '<select class="kniu_sys_editor_select" data-action="lineheight" title="行距">',
          '<option value="1">1.0</option>',
          '<option value="1.5" selected>1.5</option>',
          '<option value="1.75">1.75</option>',
          '<option value="2">2.0</option>',
          '<option value="2.5">2.5</option>',
          '<option value="3">3.0</option>',
          '</select>',
          '<span class="kniu_sys_editor_divider"></span>',
          // 块级
          '<button type="button" class="kniu_sys_editor_btn" data-block="h1" title="标题1"><b>H1</b></button>',
          '<button type="button" class="kniu_sys_editor_btn" data-block="h2" title="标题2"><b>H2</b></button>',
          '<button type="button" class="kniu_sys_editor_btn" data-block="h3" title="标题3"><b>H3</b></button>',
          '<button type="button" class="kniu_sys_editor_btn" data-block="p" title="段落">&para;</button>',
          '<span class="kniu_sys_editor_divider"></span>',
          '<button type="button" class="kniu_sys_editor_btn" data-block="blockquote" title="引用">&#10077;</button>',
          '<button type="button" class="kniu_sys_editor_btn" data-block="pre" title="代码块">{ }</button>',
          '<button type="button" class="kniu_sys_editor_btn" data-action="hr" title="分割线"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 12h18"/><path d="M3 8v8M21 8v8"/></svg></button>',
          '<button type="button" class="kniu_sys_editor_btn" data-action="table" title="表格"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="4" width="18" height="16" rx="1"/><path d="M3 10h18M3 15h18M9 4v16M15 4v16"/></svg></button>',
          '<span class="kniu_sys_editor_divider"></span>',
          // 字体
          '<button type="button" class="kniu_sys_editor_btn kniu_sys_editor_fontname" data-action="fontname" title="字体" aria-label="选择字体"><span class="kniu_sys_editor_font_icon">F</span><span class="kniu_sys_editor_font_arrow">▾</span></button>',
          '<button type="button" class="kniu_sys_editor_btn kniu_sys_editor_fontsize" data-action="fontsize" title="字号" aria-label="选择字号"><span class="kniu_sys_editor_size_icon"><small>T</small>T</span><span class="kniu_sys_editor_font_arrow">▾</span></button>',
          '<button type="button" class="kniu_sys_editor_btn kniu_sys_editor_color_btn" data-action="forecolor" title="文字颜色" aria-label="文字颜色"><span class="kniu_sys_editor_color_letter">A</span><span class="kniu_sys_editor_color_mark" style="background-color:#409eff"></span><span class="kniu_sys_editor_font_arrow">▾</span></button>',
          '<button type="button" class="kniu_sys_editor_btn kniu_sys_editor_color_btn" data-action="hilitecolor" title="文字背景" aria-label="文字背景"><span class="kniu_sys_editor_color_letter kniu_sys_editor_color_letter_bg">A</span><span class="kniu_sys_editor_font_arrow">▾</span></button>',
          '<span class="kniu_sys_editor_divider"></span>',
          // 插入
          '<button type="button" class="kniu_sys_editor_btn" data-action="link" title="链接"><svg width="16" height="16" viewBox="0 0 1024 1024" fill="currentColor"><path d="M715.648 625.152 670.4 579.904l90.496-90.56c75.008-74.944 85.12-186.368 22.656-248.896-62.528-62.464-173.952-52.352-248.96 22.656L444.16 353.6l-45.248-45.248 90.496-90.496c100.032-99.968 251.968-110.08 339.456-22.656 87.488 87.488 77.312 239.424-22.656 339.456l-90.496 90.496zm-90.496 90.496-90.496 90.496C434.624 906.112 282.688 916.224 195.2 828.8c-87.488-87.488-77.312-239.424 22.656-339.456l90.496-90.496 45.248 45.248-90.496 90.56c-75.008 74.944-85.12 186.368-22.656 248.896 62.528 62.464 173.952 52.352 248.96-22.656l90.496-90.496zm0-362.048 45.248 45.248L398.848 670.4 353.6 625.152z"/></svg></button>',
          '<button type="button" class="kniu_sys_editor_btn" data-cmd="unlink" title="取消链接"><svg width="16" height="16" viewBox="0 0 1024 1024" fill="currentColor"><path d="M472.615385 175.261538c-11.815385 0-23.630769 1.969231-35.446154 5.907693-11.815385 1.969231-25.6 5.907692-37.415385 9.846154-7.876923 1.969231-15.753846 0-19.692308-3.938462l-7.876923-7.876923c-49.230769-49.230769-129.969231-55.138462-183.138461-9.846154-57.107692 51.2-61.046154 139.815385-5.907692 192.984616l129.96923 129.96923c17.723077 17.723077 37.415385 27.569231 59.076923 33.476923 27.569231 7.876923 57.107692 5.907692 82.707693-5.907692 15.753846-5.907692 31.507692-15.753846 43.323077-29.538461 5.907692-5.907692 11.815385-13.784615 17.723077-23.63077 5.907692-11.815385 21.661538-13.784615 31.507692-3.938461l49.230769 49.230769c7.876923 7.876923 7.876923 17.723077 1.969231 25.6-7.876923 9.846154-15.753846 17.723077-23.630769 27.569231-11.815385 11.815385-27.569231 23.630769-41.353847 33.476923-25.6 15.753846-51.2 25.6-80.738461 31.507692-53.169231 9.846154-110.276923 1.969231-161.476923-25.6-19.692308-9.846154-37.415385-23.630769-53.169231-39.384615l-126.030769-126.030769c-90.584615-90.584615-98.461538-238.276923-9.846154-332.8 92.553846-98.461538 248.123077-102.4 342.646154-5.907693l43.323077 43.323077c9.846154 9.846154 1.969231 29.538462-15.753846 31.507692z m324.923077 277.661539c94.523077 94.523077 92.553846 250.092308-5.907693 342.646154C697.107692 882.215385 549.415385 876.307692 458.830769 785.723077l-39.384615-39.384615c-11.815385-11.815385-3.938462-31.507692 11.815384-33.476924 23.630769-1.969231 49.230769-5.907692 72.861539-13.784615 7.876923-1.969231 15.753846 0 19.692308 3.938462l7.876923 7.876923c49.230769 49.230769 129.969231 55.138462 183.138461 9.846154 57.107692-51.2 61.046154-139.815385 5.907693-192.984616L590.769231 397.784615c-17.723077-17.723077-37.415385-27.569231-59.076923-33.476923-27.569231-7.876923-57.107692-5.907692-82.707693 5.907693-15.753846 5.907692-31.507692 15.753846-43.323077 29.538461-5.907692 5.907692-11.815385 13.784615-15.753846 21.661539-5.907692 11.815385-21.661538 13.784615-31.507692 3.938461l-47.261538-47.261538c-7.876923-7.876923-7.876923-17.723077-1.969231-25.6 7.876923-9.846154 13.784615-17.723077 23.630769-27.569231 13.784615-13.784615 27.569231-23.630769 41.353846-33.476923 25.6-15.753846 51.2-25.6 80.738462-31.507692 53.169231-9.846154 110.276923-1.969231 161.476923 25.6 19.692308 9.846154 37.415385 23.630769 53.169231 39.384615l128 128zM888.123077 88.615385l90.584615 90.584615c7.876923 7.876923 7.876923 19.692308 0 27.569231l-55.138461 55.138461c-7.876923 7.876923-19.692308 7.876923-27.569231 0L807.384615 169.353846l-84.676923 84.676923c-7.876923 7.876923-19.692308 7.876923-27.56923 0l-55.138462-55.138461c-7.876923-7.876923-7.876923-19.692308 0-27.569231l84.676923-84.676923-82.707692-82.707692c-7.876923-7.876923-7.876923-19.692308 0-27.569231l55.138461-55.138462c7.876923-7.876923 19.692308-7.876923 27.569231 0l82.707692 82.707693 88.615385-88.615385c7.876923-7.876923 19.692308-7.876923 27.569231 0l55.138461 55.138461c7.876923 7.876923 7.876923 19.692308 0 27.569231L888.123077 88.615385z" transform="translate(0,1025) scale(1,-1)"/></svg></button>',
          '<button type="button" class="kniu_sys_editor_btn" data-action="emoticons" title="表情"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><circle cx="9" cy="10" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="10" r="1" fill="currentColor" stroke="none"/><path d="M8 15a5 5 0 0 0 8 0"/></svg></button>',
          '<span class="kniu_sys_editor_divider"></span>',
          // 清理 / 全选
          '<button type="button" class="kniu_sys_editor_btn" data-cmd="removeFormat" title="清除格式"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 15l7-7 5 5-4 4H7z"/><path d="M9 20h11"/></svg></button>',
          '<button type="button" class="kniu_sys_editor_btn" data-action="clearhtml" title="清理HTML"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M19 4l1 1-8 8-2-2z"/><path d="M11 12L4 19l1 1 7-7"/></svg></button>',
          '<button type="button" class="kniu_sys_editor_btn" data-cmd="selectAll" title="全选"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 4h16v16H4z"/><path d="M9 9h6v6H9z"/></svg></button>',
          '<div class="kniu_sys_editor_popover" hidden></div>',
          '</div>',
          '<div class="kniu_sys_editor_content" contenteditable="true" data-placeholder=""></div>',
          '<textarea class="kniu_sys_editor_source" spellcheck="false"></textarea>',
          '</div>',
          '</div>'
        ].join('');
        this._editor = this.shadowRoot.querySelector('.kniu_sys_editor_content');
        this._group = this.shadowRoot.querySelector('.kniu_sys_editor_group');
        this._toolbar = this.shadowRoot.querySelector('.kniu_sys_editor_toolbar');
        this._source = this.shadowRoot.querySelector('.kniu_sys_editor_source');
        this._codeMode = false;
        this._maximized = false;
        this._maxPrevParent = null;
        this._maxPrevNext = null;
        this._preview = false;
        this._popoverAction = null;

        var self = this;
        this._buildToolbar(this._resolveToolbarConfig());

        this.addEventListener('keydown', function (e) {
          if (e.key === 'Escape' && self._maximized) {
            e.stopPropagation();
            self._toggleMaximize();
          }
        });

        this._editor.addEventListener('input', function () {
          self.removeAttribute('data-invalid');
          self.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        });
        this._editor.addEventListener('blur', function () {
          self.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
        });
        this._source.addEventListener('input', function () {
          self.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        });
        this._editor.addEventListener('keyup', function () { self._syncToolbarState(); });
        this._editor.addEventListener('mouseup', function () { self._syncToolbarState(); });
        this._editor.addEventListener('focus', function () { self._syncToolbarState(); });
        this._editor.addEventListener('click', function (e) {
          var media = e.target.closest ? e.target.closest('img,video,audio') : null;
          if (media && self._editor.contains(media)) self._selectMedia(media);
          else self._selectMedia(null);
        });
        this._editor.addEventListener('contextmenu', function (e) {
          var media = e.target.closest ? e.target.closest('img,video,audio') : null;
          if (media && self._editor.contains(media)) {
            e.preventDefault();
            self._selectMedia(media);
            self._openMediaSizeDialog(media);
          }
        });
      }

      connectedCallback() {
        this._mountAffixes();
        this._sync();
        // 兜底：若构造时的硬编码 fallback 模板因某种旧缓存/解析异常导致最大化按钮缺失 SVG，重新填充
        var mb0 = this._toolbar && this._toolbar.querySelector('[data-action="maximize"]');
        if (mb0 && !mb0.querySelector('svg')) mb0.innerHTML = EDITOR_ICON_MAXIMIZE;
        queueMicrotask(function () { this._mountAffixes(); }.bind(this));
      }
      attributeChangedCallback(name) {
        if (!this._editor) return;
        if (name === 'toolbar') {
          this._buildToolbar(this._resolveToolbarConfig());
          this._sync();
          return;
        }
        this._sync();
      }

      get toolbar() { return this.getAttribute('toolbar'); }
      set toolbar(v) {
        if (v == null || v === '') { this.removeAttribute('toolbar'); return; }
        var str = Array.isArray(v) ? v.map(function (g) { return g.join(' '); }).join(' | ') : String(v);
        this.setAttribute('toolbar', str);
      }

      // 解析 toolbar 属性为分组数组：
      //  - 字符串中 '|' 作为分组分隔符，组内以空白/逗号分隔 token
      //  - 空或缺失 -> 使用 EDITOR_DEFAULT_TOOLBAR（全部功能）
      _resolveToolbarConfig() {
        var raw = this.getAttribute('toolbar');
        if (raw == null || raw.trim() === '') return EDITOR_DEFAULT_TOOLBAR;
        var groups;
        if (raw.indexOf('|') !== -1) {
          groups = raw.split('|').map(function (g) { return g.trim().split(/[\s,]+/).filter(Boolean); });
        } else {
          groups = [raw.split(/[\s,]+/).filter(Boolean)];
        }
        return groups;
      }

      // 依据分组数组重建工具栏，并重新绑定事件（含表格/表情弹层）。
      _buildToolbar(groups) {
        var html = [];
        for (var gi = 0; gi < groups.length; gi++) {
          if (gi > 0) html.push('<span class="kniu_sys_editor_divider"></span>');
          var group = groups[gi] || [];
          for (var i = 0; i < group.length; i++) {
            var item = EDITOR_TOOLBAR_ITEMS[group[i]];
            if (item) html.push(item);
          }
        }
        html.push('<div class="kniu_sys_editor_popover" hidden></div>');
        this._toolbar.innerHTML = html.join('');
        var linkBtn = this._toolbar.querySelector('[data-action="link"]');
        if (linkBtn) linkBtn.innerHTML = EDITOR_ICON_UNLINK;
        var clearFormatBtn = this._toolbar.querySelector('[data-cmd="removeFormat"]');
        if (clearFormatBtn) clearFormatBtn.innerHTML = EDITOR_ICON_CLEAR_FORMAT;
        // 兜底：若最大化按钮缺失 SVG（极端情况下变量未定义或缓存了旧产物），补回 MAXIMIZE 图标
        var mb = this._toolbar.querySelector('[data-action="maximize"]');
        if (mb && !mb.querySelector('svg')) mb.innerHTML = EDITOR_ICON_MAXIMIZE;
        if (this._maximized) {
          var maxBtn = this._toolbar.querySelector('[data-action="maximize"]');
          if (maxBtn) {
            maxBtn.setAttribute('aria-pressed', 'true');
            maxBtn.innerHTML = EDITOR_ICON_RESTORE;
          }
        }
        var self = this;
        this._toolbar.querySelectorAll('.kniu_sys_editor_btn').forEach(function (btn) {
          btn.addEventListener('pointerdown', function (e) { e.preventDefault(); });
          btn.addEventListener('click', function () { self._handleToolbar(btn); });
        });
        this._toolbar.querySelectorAll('.kniu_sys_editor_select').forEach(function (sel) {
          sel.addEventListener('change', function () {
            self._editor.focus();
            self._applySelect(sel);
            self.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
          });
        });
        this._toolbar.querySelectorAll('.kniu_sys_editor_color').forEach(function (inp) {
          inp.addEventListener('change', function () {
            self._editor.focus();
            self._applyColor(inp);
            self.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
          });
        });
        this._popover = this._toolbar.querySelector('.kniu_sys_editor_popover');
        this._popover.addEventListener('click', function (e) {
          var t = e.target;
          var emojiBtn = t.closest ? t.closest('.kniu_sys_editor_emoji') : null;
          if (emojiBtn) { self._insertEmoji(emojiBtn.dataset.emoji); self._closePopover(); return; }
          var confirmBtn = t.closest ? t.closest('[data-confirm="table"]') : null;
          if (confirmBtn) {
            var r = self._popover.querySelector('.pop_rows').value;
            var c = self._popover.querySelector('.pop_cols').value;
            self._insertTable(r, c);
            self._closePopover();
            return;
          }
          var linkBtn = t.closest ? t.closest('[data-confirm="link"]') : null;
          if (linkBtn) { self._confirmLink(); return; }
          var imageBtn = t.closest ? t.closest('[data-confirm="image"]') : null;
          if (imageBtn) { self._confirmImage(); return; }
          var mediaBtn = t.closest ? t.closest('[data-confirm="media"]') : null;
          if (mediaBtn) { self._confirmMedia(); return; }
          var mediaSizeBtn = t.closest ? t.closest('[data-confirm="media-size"]') : null;
          if (mediaSizeBtn) { self._confirmMediaSize(); return; }
          var deleteMediaBtn = t.closest ? t.closest('[data-delete="media"]') : null;
          if (deleteMediaBtn) { self._showMediaDeleteConfirm(); return; }
          var confirmDeleteMediaBtn = t.closest ? t.closest('[data-confirm="delete-media"]') : null;
          if (confirmDeleteMediaBtn) { self._deleteEditingMedia(); return; }
          var backMediaEditBtn = t.closest ? t.closest('[data-back="media-edit"]') : null;
          if (backMediaEditBtn && self._editingMedia) { self._openMediaSizeDialog(self._editingMedia); return; }
          var cancelBtn = t.closest ? t.closest('[data-cancel="popover"]') : null;
          if (cancelBtn) { self._closePopover(); return; }
          var fontBtn = t.closest ? t.closest('[data-font]') : null;
          if (fontBtn) { self._applyFont(fontBtn.dataset.font || ''); return; }
          var sizeBtn = t.closest ? t.closest('[data-font-size]') : null;
          if (sizeBtn) { self._applyFontSize(sizeBtn.dataset.fontSize); return; }
          var colorBtn = t.closest ? t.closest('[data-editor-color]') : null;
          if (colorBtn) { self._applyEditorColor(colorBtn.dataset.editorColor || ''); return; }
        });
        this._popover.addEventListener('pointerdown', function (e) {
          var option = e.target.closest ? e.target.closest('[data-font],[data-font-size],[data-editor-color]') : null;
          if (option) e.preventDefault();
        });
        this._popover.addEventListener('change', function (e) {
          if (e.target.matches('.pop_image_source,.pop_media_source,.pop_edit_source,.pop_media_type')) self._syncMediaSourceFields();
          if (e.target.matches('.pop_image_file,.pop_media_file,.pop_edit_file')) self._fillMediaNameFromFile(e.target);
        });
        this._popover.addEventListener('input', function (e) {
          if (e.target.matches('.pop_media_width,.pop_media_height')) self._syncMediaAspect(e.target);
        });
        this._popover.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' && self._popoverAction === 'link') {
            e.preventDefault();
            self._confirmLink();
          } else if (e.key === 'Enter' && self._popoverAction === 'image') {
            e.preventDefault();
            self._confirmImage();
          } else if (e.key === 'Enter' && self._popoverAction === 'media') {
            e.preventDefault();
            self._confirmMedia();
          } else if (e.key === 'Enter' && self._popoverAction === 'media-size') {
            e.preventDefault();
            self._confirmMediaSize();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            self._closePopover();
          }
        });
        this._syncToolbarState();
      }

      get value() {
        if (this._codeMode) return this._source.value;
        var clone = this._editor.cloneNode(true);
        clone.querySelectorAll('.kniu_sys_editor_media_selected').forEach(function (media) {
          media.classList.remove('kniu_sys_editor_media_selected');
          if (!media.getAttribute('class')) media.removeAttribute('class');
        });
        return clone.innerHTML;
      }
      set value(v) {
        var html = sanitizeRichHtml(v == null ? '' : String(v));
        this._editor.innerHTML = html;
        if (this._source) this._source.value = html;
      }
      focus() { this._editor.focus(); }

      _handleToolbar(btn) {
        var cmd = btn.dataset.cmd;
        var block = btn.dataset.block;
        var action = btn.dataset.action;
        if (action === 'maximize') { this._toggleMaximize(); return; }
        if (action === 'code') { this._toggleCodeMode(); return; }
        if (action === 'preview') { this._togglePreview(); return; }
        if (action === 'print') { this._print(); return; }
        if (action === 'table' || action === 'emoticons' || action === 'link' || action === 'image' || action === 'media' || action === 'fontname' || action === 'fontsize' || action === 'forecolor' || action === 'hilitecolor') { this._togglePopover(action, btn); return; }
        if (cmd && this._selectedMedia && /^justify(?:Left|Center|Right|Full)$/.test(cmd)) {
          this._alignSelectedMedia(cmd);
          return;
        }
        this._editor.focus();
        if (cmd === 'selectAll') { this._toggleSelectAll(); this._syncToolbarState(); return; }
        if (cmd) {
          documentRef.execCommand(cmd, false, null);
        } else if (block) {
          if (block === 'pre') { this._togglePre(); }
          else { this._formatBlockSafe(block); }
        } else if (action === 'hr') {
          documentRef.execCommand('insertHorizontalRule', false, null);
        } else if (action === 'unlink') {
          documentRef.execCommand('unlink', false, null);
        } else if (action === 'clearhtml') {
          this._clearHtml();
          return;
        }
        this._editor.focus();
        this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        this._syncToolbarState();
      }

      _alignSelectedMedia(command) {
        var media = this._selectedMedia;
        if (!media || !this._editor.contains(media)) return;
        media.style.display = 'block';
        media.style.marginTop = '.5em';
        media.style.marginBottom = '.5em';
        if (command === 'justifyCenter') {
          media.style.marginLeft = 'auto';
          media.style.marginRight = 'auto';
        } else if (command === 'justifyRight') {
          media.style.marginLeft = 'auto';
          media.style.marginRight = '0';
        } else if (command === 'justifyFull') {
          media.style.marginLeft = '0';
          media.style.marginRight = '0';
          media.style.width = '100%';
        } else {
          media.style.marginLeft = '0';
          media.style.marginRight = 'auto';
        }
        this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        this._syncToolbarState();
      }

      _applySelect(sel) {
        var action = sel.dataset.action;
        if (!sel.value && action !== 'fontname') return;
        this._editor.focus();
        if (action === 'fontname') {
          if (sel.value) {
            documentRef.execCommand('fontName', false, sel.value);
          } else {
            // "无"：清掉选区内 font[face]/inline style font-family（不动其他格式）
            this._clearFontName();
          }
          // 收起态让 select 自身用选中字体渲染（chrome 默认会用 OS 字体，需手动同步）
          var opt = sel.options[sel.selectedIndex];
          sel.style.fontFamily = opt ? opt.style.fontFamily : '';
        } else if (action === 'fontsize') {
          documentRef.execCommand('fontSize', false, sel.value);
        } else if (action === 'lineheight') {
          documentRef.execCommand('lineHeight', false, sel.value);
        }
        this._syncToolbarState();
      }

      // 清掉编辑器内所有 font[face] 标签 + 节点的 font-family 内联样式。
      // 用于字体下拉的"无"选项。选区为空时也清整个编辑器内字体（更符合用户预期）。
      _clearFontName() {
        var editor = this._editor;
        var walker = documentRef.createTreeWalker(editor, NodeFilter.SHOW_ELEMENT, {
          acceptNode: function (n) {
            if (n.tagName === 'FONT' && n.hasAttribute('face')) return NodeFilter.FILTER_ACCEPT;
            if (n.style && n.style.fontFamily) return NodeFilter.FILTER_ACCEPT;
            return NodeFilter.FILTER_SKIP;
          }
        });
        var targets = [];
        var node;
        while ((node = walker.nextNode())) targets.push(node);
        for (var i = 0; i < targets.length; i++) {
          var el = targets[i];
          if (el.tagName === 'FONT') {
            var p = el.parentNode;
            while (el.firstChild) p.insertBefore(el.firstChild, el);
            p.removeChild(el);
          } else {
            el.style.removeProperty('font-family');
          }
        }
      }

      _applyColor(inp) {
        var action = inp.dataset.action;
        this._editor.focus();
        if (action === 'forecolor') {
          documentRef.execCommand('foreColor', false, inp.value);
        } else if (action === 'hilitecolor') {
          try { documentRef.execCommand('hiliteColor', false, inp.value); }
          catch (e) { documentRef.execCommand('backColor', false, inp.value); }
        }
      }

      _toggleMaximize() {
        if (!this._maximized) {
          this._maxPrevParent = this.parentNode;
          this._maxPrevNext = this.nextSibling;
          documentRef.body.appendChild(this);
          this._maximized = true;
          this.setAttribute('data-maximized', 'true');
        } else {
          if (this._maxPrevParent) {
            if (this._maxPrevNext && this._maxPrevNext.parentNode === this._maxPrevParent) {
              this._maxPrevParent.insertBefore(this, this._maxPrevNext);
            } else {
              this._maxPrevParent.appendChild(this);
            }
          }
          this._maximized = false;
          this.removeAttribute('data-maximized');
        }
        var maxBtn = this.shadowRoot.querySelector('[data-action="maximize"]');
        if (maxBtn) {
          maxBtn.setAttribute('aria-pressed', String(this._maximized));
          maxBtn.innerHTML = this._maximized ? EDITOR_ICON_RESTORE : EDITOR_ICON_MAXIMIZE;
        }
        if (!this._codeMode) this._editor.focus(); else this._source.focus();
      }

      _toggleCodeMode() {
        if (this._popover) this._closePopover();
        this._selectMedia(null);
        this._codeMode = !this._codeMode;
        if (this._codeMode) {
          this._source.value = this._beautifyHtml(this._editor.innerHTML);
          this._group.dataset.codeMode = 'true';
          this._source.focus();
        } else {
          this._editor.innerHTML = sanitizeRichHtml(this._source.value);
          this._group.dataset.codeMode = 'false';
          this._editor.focus();
        }
        var codeBtn = this.shadowRoot.querySelector('[data-action="code"]');
        if (codeBtn) codeBtn.setAttribute('aria-pressed', String(this._codeMode));
        this._sync();
        this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      }

      _beautifyHtml(html) {
        if (!html) return html;
        var BLOCK = 'p|div|h1|h2|h3|h4|h5|h6|ul|ol|li|dl|dt|dd|table|thead|tbody|tfoot|tr|td|th|blockquote|pre|hr|figure|figcaption|section|article|header|footer|aside|nav|main|form|fieldset|details|summary|address';
        var blockRe = new RegExp('^<\\s*/?\\s*(' + BLOCK + ')\\b', 'i');
        var voidRe = /^<\s*(?:br|hr|img|input|area|base|col|embed|source|track|wbr)\b/i;
        var parts = String(html).split(/(<[^>]+>)/);
        var out = [];
        var depth = 0;
        var stack = [];
        function pad() {
          var s = '';
          for (var i = 0; i < depth; i++) s += '  ';
          return s;
        }
        function lastStartsWithNewline() {
          var last = out.length ? out[out.length - 1] : '';
          return typeof last === 'string' ? last.charAt(0) === '\n' : false;
        }
        for (var i = 0; i < parts.length; i++) {
          var t = parts[i];
          if (t === '') continue;
          if (t.charAt(0) !== '<') {
            // 文本节点：连续空白折叠为单个空格（渲染等价；pre 内容走原样分支）
            var txt = t.replace(/\s+/g, ' ');
            if (txt === ' ') {
              // 纯空白且相邻块级标签 → 丢弃（保证美化往返稳定）
              var prevPart = i > 0 ? parts[i - 1] : '';
              var nextPart = i + 1 < parts.length ? parts[i + 1] : '';
              if (blockRe.test(prevPart) || blockRe.test(nextPart)) continue;
            }
            out.push(txt);
            continue;
          }
          var isClose = /^<\s*\//.test(t);
          var m = t.match(/^<\s*\/?\s*([a-zA-Z0-9-]+)/);
          var name = m ? m[1].toLowerCase() : '';
          var isBlock = blockRe.test(t);
          var isVoid = voidRe.test(t);
          if (!isClose && name === 'pre' && !/\/>$/.test(t)) {
            // <pre> 内容原样保留，避免破坏代码块缩进
            if (stack.length) stack[stack.length - 1].inline = false;
            out.push('\n' + pad() + t);
            depth++;
            stack.push({ inline: false });
            var raw = [];
            var closed = false;
            for (var j = i + 1; j < parts.length; j++) {
              raw.push(parts[j]);
              if (/^<\s*\/\s*pre\s*>$/i.test(parts[j])) { closed = true; i = j; break; }
            }
            out.push(raw.join(''));
            if (closed) { depth--; stack.pop(); }
            continue;
          }
          if (isClose) {
            var frame = isBlock && !isVoid ? stack.pop() : null;
            if (isBlock && !isVoid && depth > 0) depth--;
            if (isBlock) {
              // 仅含行内内容的块：闭合标签紧跟内容同一行；否则独占一行
              if (frame && frame.inline && !lastStartsWithNewline()) out.push(t);
              else out.push('\n' + pad() + t);
            } else {
              out.push(t);
            }
          } else {
            if (isBlock) {
              if (stack.length) stack[stack.length - 1].inline = false;
              out.push('\n' + pad() + t);
              if (!isVoid && !/\/>$/.test(t)) { depth++; stack.push({ inline: true }); }
            } else {
              out.push(t);
            }
          }
        }
        return out.join('').replace(/^\s+/, '');
      }

      _togglePreview() {
        this._preview = !this._preview;
        this.setAttribute('data-preview', String(this._preview));
        var ro = this._preview || this.hasAttribute('readonly') || this.hasAttribute('disabled');
        this._editor.contentEditable = ro ? 'false' : 'true';
        var btn = this.shadowRoot.querySelector('[data-action="preview"]');
        if (btn) btn.setAttribute('aria-pressed', String(this._preview));
      }

      _print() {
        try {
          var w = documentRef.defaultView.open('', '_blank');
          if (!w) return;
          w.document.write('<html><head><meta charset="utf-8"><title>打印</title><style>body{font:14px/1.7 -apple-system,"Microsoft YaHei",sans-serif;padding:24px;color:#333}img{max-width:100%}table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:6px 10px}</style></head><body>' + this._editor.innerHTML + '</body></html>');
          w.document.close();
          w.focus();
          w.print();
        } catch (e) { /* 弹窗被拦截时静默 */ }
      }

      _isAllSelected() {
        var sel = documentRef.getSelection();
        if (!sel || sel.rangeCount === 0) return false;
        var range = sel.getRangeAt(0);
        if (range.collapsed) return false;
        var full = documentRef.createRange();
        full.selectNodeContents(this._editor);
        // 0 = START_TO_START, 2 = END_TO_END：选区边界与编辑器整体边界完全重合
        return range.compareBoundaryPoints(0, full) === 0 && range.compareBoundaryPoints(2, full) === 0;
      }

      _toggleSelectAll() {
        var sel = documentRef.getSelection();
        if (this._isAllSelected()) {
          // 已全选 → 取消全选（收拢光标到末尾）
          sel.removeAllRanges();
          var r = documentRef.createRange();
          r.selectNodeContents(this._editor);
          r.collapse(false);
          sel.addRange(r);
        } else {
          // execCommand('selectAll') 在 Shadow DOM 下会选中整个 light DOM 文档（body）而非编辑器内容，
          // 手动构造 Range 圈选编辑器内部全部内容
          sel.removeAllRanges();
          var rAll = documentRef.createRange();
          rAll.selectNodeContents(this._editor);
          sel.addRange(rAll);
        }
      }

      _currentBlockTag() {
        // queryCommandValue('formatBlock') 在 Chrome + Shadow DOM 下极不可靠（常返回空串），
        // 改为从选区锚点向上遍历 DOM，找到最近的块级元素标签名
        try {
          var sel = documentRef.getSelection();
          if (!sel || sel.rangeCount === 0) return '';
          var node = sel.anchorNode;
          if (!node) return '';
          if (node.nodeType === 3) node = node.parentNode;
          var blockTags = { pre: 1, p: 1, h1: 1, h2: 1, h3: 1, h4: 1, h5: 1, h6: 1, blockquote: 1, div: 1, li: 1, dd: 1, dt: 1, address: 1, article: 1, section: 1, aside: 1, figure: 1, figcaption: 1 };
          while (node && node !== this._editor) {
            var tag = (node.tagName || '').toLowerCase();
            if (blockTags[tag]) return tag;
            node = node.parentNode;
          }
          // 到达编辑器容器 → 默认 p
          return 'p';
        }
        catch (e) { return ''; }
      }

      _togglePre() {
        this._formatBlockSafe(this._currentBlockTag() === 'pre' ? 'p' : 'pre');
      }

      // Chrome + Shadow DOM 下 execCommand('formatBlock') 执行后会把文档选区重置到 body
      // （逃出编辑器），导致再次点击块格式按钮时拿不到正确选区（如代码块无法取消）。
      // 此封装：命令前记录受影响块位置与选区字符偏移，命令后选区若逃逸则恢复到新块原位置。
      _formatBlockSafe(tag) {
        var sel = documentRef.getSelection();
        var oldBlock = null;
        if (sel && sel.rangeCount) {
          var node = sel.anchorNode;
          if (node && node.nodeType === 3) node = node.parentNode;
          while (node && node.parentNode && node.parentNode !== this._editor) node = node.parentNode;
          if (node && node !== this._editor && node.parentNode === this._editor) oldBlock = node;
        }
        var index = oldBlock ? Array.prototype.indexOf.call(this._editor.children, oldBlock) : -1;
        var startOffset = -1, endOffset = -1;
        if (oldBlock && sel && sel.rangeCount) {
          var r = documentRef.createRange();
          r.selectNodeContents(oldBlock);
          try {
            var cur = sel.getRangeAt(0);
            r.setEnd(cur.startContainer, cur.startOffset);
            startOffset = r.toString().length;
            r.setEnd(cur.endContainer, cur.endOffset);
            endOffset = r.toString().length;
          } catch (e) { startOffset = endOffset = -1; }
        }
        documentRef.execCommand('formatBlock', false, tag);
        // 选区仍在编辑器内 → 无需恢复
        var anchor = sel && sel.anchorNode;
        while (anchor) {
          if (anchor === this._editor) return;
          anchor = anchor.parentNode;
        }
        // 选区已逃逸 → 恢复到新块的原位置
        var newBlock = (index >= 0 && this._editor.children[index]) || this._editor.firstElementChild;
        if (!newBlock) return;
        var range = documentRef.createRange();
        if (startOffset >= 0) {
          var probe = documentRef.createRange();
          probe.selectNodeContents(newBlock);
          var max = probe.toString().length;
          var s = Math.min(startOffset, max);
          var e = Math.min(Math.max(endOffset, startOffset), max);
          var sp = this._locateByCharOffset(newBlock, s);
          var ep = this._locateByCharOffset(newBlock, e);
          range.setStart(sp[0], sp[1]);
          range.setEnd(ep[0], ep[1]);
        } else {
          range.selectNodeContents(newBlock);
          range.collapse(false);
        }
        sel.removeAllRanges();
        sel.addRange(range);
      }

      // 在 scope 内按字符偏移定位 [node, offset]（超出长度时收拢到末尾）
      _locateByCharOffset(scope, charOffset) {
        var walker = documentRef.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
        var remaining = charOffset;
        var textNode;
        while ((textNode = walker.nextNode())) {
          var len = textNode.nodeValue.length;
          if (remaining <= len) return [textNode, remaining];
          remaining -= len;
        }
        var last = scope;
        while (last.lastChild) last = last.lastChild;
        return [last, last.nodeType === 3 ? last.nodeValue.length : last.childNodes.length];
      }

      _clearHtml() {
        var tmp = documentRef.createElement('div');
        tmp.innerHTML = this._editor.innerHTML;
        var text = (tmp.innerText || '').replace(/ /g, ' ');
        var paras = text.split(/\n+/).map(function (s) { return s.trim(); }).filter(Boolean);
        this._editor.innerHTML = paras.length ? '<p>' + paras.join('</p><p>') + '</p>' : '';
        this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        this._syncToolbarState();
      }

      _togglePopover(action, btn) {
        if (this._popoverAction === action && !this._popover.hidden) { this._closePopover(); return; }
        if (!this._popover.hidden) this._closePopover(true);
        this._popoverAction = action;
        if (action === 'link' || action === 'image' || action === 'media' || action === 'fontname' || action === 'fontsize' || action === 'forecolor' || action === 'hilitecolor') {
          var selection = (this.shadowRoot.getSelection && this.shadowRoot.getSelection()) || documentRef.getSelection();
          var savedRange = selection && selection.rangeCount ? selection.getRangeAt(0).cloneRange() : null;
          if (action === 'link') this._linkRange = savedRange;
          else if (action === 'image' || action === 'media') this._resourceRange = savedRange;
          else if (action === 'fontname') this._fontRange = savedRange;
          else if (action === 'fontsize') this._fontSizeRange = savedRange;
          else { this._colorRange = savedRange; this._colorAction = action; }
        }
        this._popover.innerHTML = action === 'table' ? this._tablePopoverHTML()
          : action === 'link' ? this._linkPopoverHTML()
            : action === 'image' ? this._imagePopoverHTML()
              : action === 'media' ? this._mediaPopoverHTML()
                : action === 'fontname' ? this._fontPopoverHTML()
                  : action === 'fontsize' ? this._fontSizePopoverHTML()
                    : action === 'forecolor' || action === 'hilitecolor' ? this._colorPopoverHTML()
                      : this._emojiPopoverHTML();
        this._popover.classList.toggle('kniu_sys_editor_popover_link', action === 'link' || action === 'image' || action === 'media');
        this._popover.hidden = false;
        this._positionPopover(btn);
        if (action === 'link') {
          var urlInput = this._popover.querySelector('.pop_link_url');
          if (urlInput) setTimeout(function () { urlInput.focus(); urlInput.select(); }, 0);
        }
        var self = this;
        setTimeout(function () {
          var handler = function (e) {
            if (self._popover.contains(e.target)) return;
            if (btn.contains(e.target)) return;
            self._closePopover();
            self.shadowRoot.removeEventListener('pointerdown', handler, true);
          };
          self.shadowRoot.addEventListener('pointerdown', handler, true);
        }, 0);
      }

      _closePopover(immediate) {
        if (!immediate && !this._popover.hidden && this._popover.classList.contains('kniu_sys_editor_popover_media_edit')) {
          if (this._popover.classList.contains('kniu_sys_editor_popover_closing')) return;
          this._popover.classList.add('kniu_sys_editor_popover_closing');
          var self = this;
          this._popoverCloseTimer = setTimeout(function () { self._finishClosePopover(); }, 180);
          return;
        }
        this._finishClosePopover();
      }

      _finishClosePopover() {
        if (this._popoverCloseTimer) clearTimeout(this._popoverCloseTimer);
        this._popoverCloseTimer = null;
        this._popover.hidden = true;
        this._popover.innerHTML = '';
        this._popover.classList.remove('kniu_sys_editor_popover_link');
        this._popover.classList.remove('kniu_sys_editor_popover_media_edit');
        this._popover.classList.remove('kniu_sys_editor_popover_closing');
        this._popoverAction = null;
        this._linkRange = null;
        this._fontRange = null;
        this._fontSizeRange = null;
        this._colorRange = null;
        this._colorAction = null;
        this._resourceRange = null;
        this._editingMedia = null;
      }

      _positionPopover(btn) {
        var main = this.shadowRoot.querySelector('.kniu_sys_editor_main');
        if (!btn || !this._popover || !main) return;
        var mainRect = main.getBoundingClientRect();
        if (this._popoverAction === 'link' || this._popoverAction === 'image' || this._popoverAction === 'media' || this._popoverAction === 'media-size') {
          this._popover.style.top = '50%';
          this._popover.style.left = '50%';
          this._popover.style.transform = 'translate(-50%, -50%)';
          this._popover.style.maxHeight = 'calc(100% - 32px)';
          return;
        }
        var btnRect = btn.getBoundingClientRect();
        var top = btnRect.bottom - mainRect.top + 4;
        var left = btnRect.left - mainRect.left;
        var availableHeight = Math.max(80, mainRect.height - top - 8);
        this._popover.style.transform = 'none';
        this._popover.style.top = top + 'px';
        this._popover.style.maxHeight = availableHeight + 'px';
        var popoverWidth = this._popover.offsetWidth;
        left = Math.max(8, Math.min(left, mainRect.width - popoverWidth - 8));
        this._popover.style.left = left + 'px';
      }

      _tablePopoverHTML() {
        return '<div class="kniu_sys_editor_popover_row"><label>行数</label><input type="number" class="pop_rows" min="1" max="20" value="3"></div>' +
          '<div class="kniu_sys_editor_popover_row"><label>列数</label><input type="number" class="pop_cols" min="1" max="20" value="3"></div>' +
          '<div class="kniu_sys_editor_popover_row"><button type="button" class="kniu_sys_editor_popover_btn" data-confirm="table">插入表格</button></div>';
      }

      _emojiPopoverHTML() {
        return '<div class="kniu_sys_editor_popover_grid">' + EMOJIS.map(function (e) {
          return '<button type="button" class="kniu_sys_editor_emoji" data-emoji="' + e + '">' + e + '</button>';
        }).join('') + '</div>';
      }

      _linkPopoverHTML() {
        var selectedText = this._linkRange ? this._linkRange.toString() : '';
        return '<div class="kniu_sys_editor_popover_title">插入链接</div>' +
          '<div class="kniu_sys_editor_popover_row"><label>链接地址</label><input type="url" class="pop_link_url" value="https://" autocomplete="off" placeholder="https://example.com"></div>' +
          (selectedText ? '' : '<div class="kniu_sys_editor_popover_row"><label>链接文字</label><input type="text" class="pop_link_text" value="链接" autocomplete="off" placeholder="请输入链接文字"></div>') +
          '<div class="kniu_sys_editor_popover_error" role="alert"></div>' +
          '<div class="kniu_sys_editor_popover_actions"><button type="button" class="kniu_sys_editor_popover_cancel" data-cancel="popover">取消</button><button type="button" class="kniu_sys_editor_popover_btn" data-confirm="link">确定</button></div>';
      }

      _imagePopoverHTML() {
        return '<div class="kniu_sys_editor_popover_title">插入图片</div>' +
          '<div class="kniu_sys_editor_popover_row"><label>来源类型</label><select class="pop_image_source"><option value="cloud">云媒体</option><option value="local">本地上传</option></select></div>' +
          '<div class="kniu_sys_editor_popover_row pop_cloud_row"><label>图片地址</label><input type="url" class="pop_image_url" autocomplete="off" placeholder="https://example.com/image.jpg"></div>' +
          '<div class="kniu_sys_editor_popover_row pop_local_row" hidden><label>本地图片</label><input type="file" class="pop_image_file" accept="image/jpeg,image/png,image/gif,image/webp"></div>' +
          '<div class="kniu_sys_editor_popover_row"><label>媒体名称</label><input type="text" class="pop_image_name" autocomplete="off" placeholder="请输入媒体名称"></div>' +
          '<div class="kniu_sys_editor_popover_error" role="alert"></div>' +
          '<div class="kniu_sys_editor_popover_actions"><button type="button" class="kniu_sys_editor_popover_cancel" data-cancel="popover">取消</button><button type="button" class="kniu_sys_editor_popover_btn" data-confirm="image">确定</button></div>';
      }

      _mediaPopoverHTML() {
        return '<div class="kniu_sys_editor_popover_title">插入音视频</div>' +
          '<div class="kniu_sys_editor_popover_row"><label>媒体类型</label><select class="pop_media_type"><option value="video">视频</option><option value="audio">音频</option></select></div>' +
          '<div class="kniu_sys_editor_popover_row"><label>来源类型</label><select class="pop_media_source"><option value="cloud">云媒体</option><option value="local">本地上传</option></select></div>' +
          '<div class="kniu_sys_editor_popover_row pop_cloud_row"><label>媒体地址</label><input type="url" class="pop_media_url" autocomplete="off" placeholder="https://example.com/media.mp4"></div>' +
          '<div class="kniu_sys_editor_popover_row pop_local_row" hidden><label>本地文件</label><input type="file" class="pop_media_file" accept="video/mp4,video/webm,video/ogg,video/quicktime"></div>' +
          '<div class="kniu_sys_editor_popover_row"><label>媒体名称</label><input type="text" class="pop_media_name" autocomplete="off" placeholder="请输入媒体名称"></div>' +
          '<div class="kniu_sys_editor_popover_error" role="alert"></div>' +
          '<div class="kniu_sys_editor_popover_actions"><button type="button" class="kniu_sys_editor_popover_cancel" data-cancel="popover">取消</button><button type="button" class="kniu_sys_editor_popover_btn" data-confirm="media">确定</button></div>';
      }

      _openMediaSizeDialog(media) {
        this._closePopover(true);
        this._editingMedia = media;
        this._selectMedia(media);
        this._popoverAction = 'media-size';
        var label = media.tagName === 'IMG' ? '图片' : media.tagName === 'AUDIO' ? '音频' : '视频';
        var rect = media.getBoundingClientRect();
        var width = parseFloat(media.style.width) || Math.round(rect.width) || '';
        var height = parseFloat(media.style.height) || Math.round(rect.height) || '';
        var source = this._escapeEditorAttribute(media.getAttribute('src') || '');
        var name = this._escapeEditorAttribute(media.getAttribute('data-media-name') || '');
        var accept = media.tagName === 'IMG' ? 'image/jpeg,image/png,image/gif,image/webp'
          : media.tagName === 'AUDIO' ? 'audio/mpeg,audio/ogg,audio/wav,audio/mp4'
            : 'video/mp4,video/webm,video/ogg,video/quicktime';
        this._popover.innerHTML = '<div class="kniu_sys_editor_popover_title">编辑' + label + '</div>' +
          '<div class="kniu_sys_editor_popover_row"><label>来源类型</label><select class="pop_edit_source"><option value="cloud">云媒体</option><option value="local">本地上传</option></select></div>' +
          '<div class="kniu_sys_editor_popover_row pop_cloud_row"><label>媒体地址</label><input type="url" class="pop_edit_url" value="' + source + '" autocomplete="off" placeholder="请输入媒体地址"></div>' +
          '<div class="kniu_sys_editor_popover_row pop_local_row" hidden><label>本地文件</label><input type="file" class="pop_edit_file" accept="' + accept + '"></div>' +
          '<div class="kniu_sys_editor_popover_row"><label>媒体名称</label><input type="text" class="pop_edit_name" value="' + name + '" autocomplete="off" placeholder="请输入媒体名称"></div>' +
          '<div class="kniu_sys_editor_popover_row"><label>宽度</label><input type="number" class="pop_media_width" min="1" max="5000" value="' + width + '" placeholder="自动"><span>px</span></div>' +
          '<div class="kniu_sys_editor_popover_row"><label>高度</label><input type="number" class="pop_media_height" min="1" max="5000" value="' + height + '" placeholder="自动"><span>px</span></div>' +
          '<div class="kniu_sys_editor_popover_row"><label>缩放</label><input type="checkbox" class="pop_media_ratio_lock" checked><span>锁定宽高比</span></div>' +
          '<div class="kniu_sys_editor_popover_error" role="alert"></div>' +
          '<div class="kniu_sys_editor_popover_actions"><button type="button" class="kniu_sys_editor_popover_delete" data-delete="media">删除媒体</button><button type="button" class="kniu_sys_editor_popover_cancel" data-cancel="popover">取消</button><button type="button" class="kniu_sys_editor_popover_btn" data-confirm="media-size">确定</button></div>';
        this._popover.classList.add('kniu_sys_editor_popover_link');
        this._popover.classList.add('kniu_sys_editor_popover_media_edit');
        this._popover.hidden = false;
        this._positionPopover(media);
        var widthInput = this._popover.querySelector('.pop_media_width');
        this._mediaAspectRatio = rect.width && rect.height ? rect.width / rect.height : 1;
        if (widthInput) { widthInput.focus(); widthInput.select(); }
      }

      _escapeEditorAttribute(value) {
        return String(value == null ? '' : value)
          .replace(/&/g, '&amp;')
          .replace(/"/g, '&quot;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
      }

      _selectMedia(media) {
        if (this._selectedMedia && this._selectedMedia !== media) {
          this._selectedMedia.classList.remove('kniu_sys_editor_media_selected');
        }
        this._selectedMedia = media || null;
        if (this._selectedMedia) this._selectedMedia.classList.add('kniu_sys_editor_media_selected');
      }

      _showMediaDeleteConfirm() {
        if (!this._editingMedia) return;
        var label = this._editingMedia.tagName === 'IMG' ? '图片' : this._editingMedia.tagName === 'AUDIO' ? '音频' : '视频';
        this._popover.innerHTML = '<div class="kniu_sys_editor_popover_title">删除' + label + '</div>' +
          '<div class="kniu_sys_editor_delete_tip">确定要从文章正文中删除当前' + label + '吗？</div>' +
          '<div class="kniu_sys_editor_popover_actions"><button type="button" class="kniu_sys_editor_popover_cancel" data-back="media-edit">返回</button><button type="button" class="kniu_sys_editor_popover_btn" data-confirm="delete-media">确定删除</button></div>';
      }

      _deleteEditingMedia() {
        var media = this._editingMedia;
        if (!media) { this._closePopover(); return; }
        this._selectMedia(null);
        media.remove();
        this._closePopover();
        this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      }

      _syncMediaAspect(changedInput) {
        if (this._syncingMediaAspect) return;
        var lock = this._popover.querySelector('.pop_media_ratio_lock');
        if (!lock || !lock.checked || !this._mediaAspectRatio) return;
        var widthInput = this._popover.querySelector('.pop_media_width');
        var heightInput = this._popover.querySelector('.pop_media_height');
        if (!widthInput || !heightInput) return;
        this._syncingMediaAspect = true;
        if (changedInput === widthInput && Number(widthInput.value) > 0) {
          heightInput.value = Math.max(1, Math.round(Number(widthInput.value) / this._mediaAspectRatio));
        } else if (changedInput === heightInput && Number(heightInput.value) > 0) {
          widthInput.value = Math.max(1, Math.round(Number(heightInput.value) * this._mediaAspectRatio));
        }
        this._syncingMediaAspect = false;
      }

      async _confirmMediaSize() {
        var media = this._editingMedia;
        if (!media) { this._closePopover(); return; }
        var sourceInput = this._popover.querySelector('.pop_edit_source');
        var urlInput = this._popover.querySelector('.pop_edit_url');
        var fileInput = this._popover.querySelector('.pop_edit_file');
        var nameInput = this._popover.querySelector('.pop_edit_name');
        var widthInput = this._popover.querySelector('.pop_media_width');
        var heightInput = this._popover.querySelector('.pop_media_height');
        var error = this._popover.querySelector('.kniu_sys_editor_popover_error');
        var width = widthInput && widthInput.value !== '' ? Number(widthInput.value) : 0;
        var height = heightInput && heightInput.value !== '' ? Number(heightInput.value) : 0;
        if ((width && (width < 1 || width > 5000)) || (height && (height < 1 || height > 5000))) {
          if (error) error.textContent = '宽度和高度必须在 1 至 5000px 之间';
          return;
        }
        var isLocal = sourceInput && sourceInput.value === 'local';
        var source = isLocal
          ? await this._uploadEditorMedia(fileInput && fileInput.files ? fileInput.files[0] : null, error)
          : (urlInput ? urlInput.value.trim() : '');
        if (!source) return;
        if (!isLocal && !this._validResourceUrl(source)) {
          if (error) error.textContent = '请输入安全有效的媒体地址';
          if (urlInput) urlInput.focus();
          return;
        }
        media.src = source;
        var mediaName = nameInput ? nameInput.value.trim() : '';
        if (mediaName) media.setAttribute('data-media-name', mediaName);
        else media.removeAttribute('data-media-name');
        if (width) media.style.width = Math.round(width) + 'px';
        else media.style.removeProperty('width');
        if (height) media.style.height = Math.round(height) + 'px';
        else media.style.removeProperty('height');
        this._closePopover();
        this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      }

      _validResourceUrl(url) {
        return Boolean(url) && !/^(javascript|vbscript):/i.test(url) && !/^data:(?!image\/)/i.test(url);
      }

      _syncMediaSourceFields() {
        var source = this._popover.querySelector('.pop_image_source,.pop_media_source,.pop_edit_source');
        if (!source) return;
        var isLocal = source.value === 'local';
        var cloudRow = this._popover.querySelector('.pop_cloud_row');
        var localRow = this._popover.querySelector('.pop_local_row');
        if (cloudRow) cloudRow.hidden = isLocal;
        if (localRow) localRow.hidden = !isLocal;
        var mediaType = this._popover.querySelector('.pop_media_type');
        var mediaFile = this._popover.querySelector('.pop_media_file');
        if (mediaType && mediaFile) {
          mediaFile.accept = mediaType.value === 'audio'
            ? 'audio/mpeg,audio/ogg,audio/wav,audio/mp4'
            : 'video/mp4,video/webm,video/ogg,video/quicktime';
          mediaFile.value = '';
        }
      }

      _fillMediaNameFromFile(fileInput) {
        var file = fileInput && fileInput.files ? fileInput.files[0] : null;
        if (!file) return;
        var nameInput = this._popover.querySelector('.pop_image_name,.pop_media_name,.pop_edit_name');
        if (nameInput) nameInput.value = file.name;
      }

      async _uploadEditorMedia(file, error) {
        if (!file) {
          if (error) error.textContent = '请选择需要上传的本地文件';
          return '';
        }
        var form = new FormData();
        form.append('file', file);
        try {
          var response = await fetch('/api/article_media_upload', { method: 'POST', body: form, credentials: 'include' });
          var result = await response.json();
          if (!response.ok || Number(result.status) !== 1 || !result.data || !result.data.url) {
            if (error) error.textContent = result.msg || '媒体文件上传失败';
            return '';
          }
          return result.data.url;
        } catch (e) {
          if (error) error.textContent = '媒体文件上传失败，请稍后重试';
          return '';
        }
      }

      _insertResourceNode(node) {
        var selection = (this.shadowRoot.getSelection && this.shadowRoot.getSelection()) || documentRef.getSelection();
        this._editor.focus();
        if (selection && this._resourceRange) {
          selection.removeAllRanges();
          selection.addRange(this._resourceRange);
          this._resourceRange.deleteContents();
          this._resourceRange.insertNode(node);
          this._resourceRange.setStartAfter(node);
          this._resourceRange.collapse(true);
          selection.removeAllRanges();
          selection.addRange(this._resourceRange);
        } else {
          this._editor.appendChild(node);
        }
        this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        this._syncToolbarState();
        this._closePopover();
      }

      async _confirmImage() {
        var sourceInput = this._popover.querySelector('.pop_image_source');
        var urlInput = this._popover.querySelector('.pop_image_url');
        var fileInput = this._popover.querySelector('.pop_image_file');
        var nameInput = this._popover.querySelector('.pop_image_name');
        var error = this._popover.querySelector('.kniu_sys_editor_popover_error');
        var isLocal = sourceInput && sourceInput.value === 'local';
        var localFile = fileInput && fileInput.files ? fileInput.files[0] : null;
        var url = isLocal
          ? await this._uploadEditorMedia(localFile, error)
          : (urlInput ? urlInput.value.trim() : '');
        if (!url) return;
        if (!isLocal && !this._validResourceUrl(url)) {
          if (error) error.textContent = '请输入安全有效的图片地址';
          if (urlInput) urlInput.focus();
          return;
        }
        var img = documentRef.createElement('img');
        img.src = url;
        var imageName = (nameInput ? nameInput.value.trim() : '') || (localFile ? localFile.name : this._mediaNameFromUrl(url));
        if (imageName) img.setAttribute('data-media-name', imageName);
        img.style.maxWidth = '100%';
        img.style.height = 'auto';
        this._insertResourceNode(img);
      }

      async _confirmMedia() {
        var typeInput = this._popover.querySelector('.pop_media_type');
        var sourceInput = this._popover.querySelector('.pop_media_source');
        var urlInput = this._popover.querySelector('.pop_media_url');
        var fileInput = this._popover.querySelector('.pop_media_file');
        var nameInput = this._popover.querySelector('.pop_media_name');
        var error = this._popover.querySelector('.kniu_sys_editor_popover_error');
        var type = typeInput && typeInput.value === 'audio' ? 'audio' : 'video';
        var isLocal = sourceInput && sourceInput.value === 'local';
        var localFile = fileInput && fileInput.files ? fileInput.files[0] : null;
        var url = isLocal
          ? await this._uploadEditorMedia(localFile, error)
          : (urlInput ? urlInput.value.trim() : '');
        if (!url) return;
        if (!isLocal && !this._validResourceUrl(url)) {
          if (error) error.textContent = '请输入安全有效的媒体地址';
          if (urlInput) urlInput.focus();
          return;
        }
        var media = documentRef.createElement(type);
        media.src = url;
        media.controls = true;
        media.preload = 'metadata';
        var mediaName = (nameInput ? nameInput.value.trim() : '') || (localFile ? localFile.name : this._mediaNameFromUrl(url));
        if (mediaName) media.setAttribute('data-media-name', mediaName);
        if (type === 'video') media.style.maxWidth = '100%';
        this._insertResourceNode(media);
      }

      _mediaNameFromUrl(url) {
        try {
          var pathname = new URL(url, documentRef.baseURI).pathname;
          return decodeURIComponent(pathname.split('/').pop() || '');
        } catch (e) { return ''; }
      }

      _fontPopoverHTML() {
        var fonts = [
          ['', '无', 'inherit'], ['SimSun', '宋体', 'SimSun'],
          ['Microsoft YaHei', '微软雅黑', 'Microsoft YaHei'], ['FangSong', '仿宋', 'FangSong'],
          ['KaiTi', '楷体', 'KaiTi'], ['SimHei', '黑体', 'SimHei'],
          ['Microsoft YaHei Light', '微软雅黑 Light', 'Microsoft YaHei Light'],
          ['Arial', 'Arial', 'Arial'], ['Arial Black', 'Arial Black', 'Arial Black'],
          ['Times New Roman', 'Times New Roman', 'Times New Roman'],
          ['Courier New', 'Courier New', 'Courier New'], ['Tahoma', 'Tahoma', 'Tahoma'],
          ['Verdana', 'Verdana', 'Verdana'], ['PingFang SC', 'PingFang SC', 'PingFang SC']
        ];
        return '<div class="kniu_sys_editor_font_list" role="menu">' + fonts.map(function (font) {
          return '<button type="button" class="kniu_sys_editor_font_item" role="menuitemradio" aria-checked="' + (font[0] ? 'false' : 'true') + '" data-font="' + font[0] + '" style="font-family:\'' + font[2] + '\'">' + font[1] + '</button>';
        }).join('') + '</div>';
      }

      _applyFont(font) {
        var selection = documentRef.getSelection();
        if (selection && this._fontRange) {
          selection.removeAllRanges();
          selection.addRange(this._fontRange);
        }
        this._editor.focus();
        if (font) documentRef.execCommand('fontName', false, font);
        else this._clearFontName();
        this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        this._syncToolbarState();
        this._closePopover();
      }

      _fontSizePopoverHTML() {
        var sizes = [['1', '12px'], ['2', '14px'], ['3', '16px'], ['4', '18px'], ['5', '22px'], ['6', '26px'], ['7', '32px']];
        return '<div class="kniu_sys_editor_size_list" role="menu">' + sizes.map(function (size) {
          return '<button type="button" class="kniu_sys_editor_size_item" role="menuitem" data-font-size="' + size[0] + '" style="font-size:' + size[1] + '">' + size[1] + '</button>';
        }).join('') + '</div>';
      }

      _applyFontSize(size) {
        var selection = documentRef.getSelection();
        if (selection && this._fontSizeRange) {
          selection.removeAllRanges();
          selection.addRange(this._fontSizeRange);
        }
        this._editor.focus();
        documentRef.execCommand('fontSize', false, size || '3');
        this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        this._syncToolbarState();
        this._closePopover();
      }

      _colorPopoverHTML() {
        var colors = [
          '#f5222d', '#fa541c', '#fa8c16', '#fadb14', '#ffe58f', '#fff000',
          '#52c41a', '#13c2c2', '#08979c', '#389e0d', '#b7eb8f', '#00e5ff',
          '#2f80ed', '#003eb3', '#531dab', '#722ed1', '#c41dff', '#eb2fdb',
          '#ffffff', '#e5e5e5', '#bfbfbf', '#8c8c8c', '#595959', '#262626', '#000000'
        ];
        return '<div class="kniu_sys_editor_palette"><button type="button" class="kniu_sys_editor_no_color" data-editor-color="">无颜色</button>' +
          '<div class="kniu_sys_editor_swatch_grid">' + colors.map(function (color) {
            return '<button type="button" class="kniu_sys_editor_swatch" data-editor-color="' + color + '" title="' + color + '" aria-label="' + color + '" style="background-color:' + color + '"></button>';
          }).join('') + '</div></div>';
      }

      _applyEditorColor(color) {
        var action = this._colorAction || 'forecolor';
        var selection = (this.shadowRoot.getSelection && this.shadowRoot.getSelection()) || documentRef.getSelection();
        this._editor.focus();
        if (selection && this._colorRange) {
          selection.removeAllRanges();
          selection.addRange(this._colorRange);
        }
        var appliedColor = color || (action === 'hilitecolor' ? 'transparent' : '#303133');
        var range = selection && selection.rangeCount ? selection.getRangeAt(0) : this._colorRange;
        if (!color && range && !range.collapsed) {
          this._removeSelectedColor(range, action);
        } else if (range && !range.collapsed) {
          var span = documentRef.createElement('span');
          if (action === 'hilitecolor') span.style.backgroundColor = appliedColor;
          else span.style.color = appliedColor;
          try {
            span.appendChild(range.extractContents());
            range.insertNode(span);
            selection.removeAllRanges();
            var appliedRange = documentRef.createRange();
            appliedRange.selectNodeContents(span);
            selection.addRange(appliedRange);
          } catch (e) {
            var fallbackCommand = action === 'hilitecolor' ? 'backColor' : 'foreColor';
            documentRef.execCommand(fallbackCommand, false, appliedColor);
          }
        } else {
          var command = action === 'hilitecolor' ? 'backColor' : 'foreColor';
          documentRef.execCommand(command, false, appliedColor);
        }
        var toolbarBtn = this._toolbar.querySelector('[data-action="' + action + '"]');
        if (toolbarBtn) {
          var mark = toolbarBtn.querySelector('.kniu_sys_editor_color_mark');
          var letter = toolbarBtn.querySelector('.kniu_sys_editor_color_letter_bg');
          if (mark) mark.style.backgroundColor = color || '#409eff';
          if (letter) letter.style.backgroundColor = color || '#ffd900';
        }
        this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        this._syncToolbarState();
        this._closePopover();
      }

      _removeSelectedColor(range, action) {
        var property = action === 'hilitecolor' ? 'background-color' : 'color';
        var editor = this._editor;
        function coloredAncestor(source) {
          var element = source && source.nodeType === 3 ? source.parentNode : source;
          while (element && element !== editor) {
            if (element.nodeType === 1 && element.style && element.style.getPropertyValue(property)) return element;
            element = element.parentNode;
          }
          return null;
        }
        function cleanColor(scope) {
          if (scope.nodeType === 1 && scope.style) {
            scope.style.removeProperty(property);
            if (!scope.getAttribute('style')) scope.removeAttribute('style');
          }
          var elements = Array.from(scope.querySelectorAll ? scope.querySelectorAll('*') : []);
          elements.forEach(function (element) {
            element.style.removeProperty(property);
            if (!element.getAttribute('style')) element.removeAttribute('style');
          });
          elements.reverse().forEach(function (element) {
            if (element.tagName === 'SPAN' && element.attributes.length === 0 && element.parentNode) {
              while (element.firstChild) element.parentNode.insertBefore(element.firstChild, element);
              element.remove();
            }
          });
        }
        var startColor = coloredAncestor(range.startContainer);
        var endColor = coloredAncestor(range.endContainer);
        if (startColor && startColor === endColor && startColor.parentNode) {
          var beforeRange = documentRef.createRange();
          beforeRange.selectNodeContents(startColor);
          beforeRange.setEnd(range.startContainer, range.startOffset);
          var before = beforeRange.cloneContents();
          var selected = range.cloneContents();
          var afterRange = documentRef.createRange();
          afterRange.selectNodeContents(startColor);
          afterRange.setStart(range.endContainer, range.endOffset);
          var after = afterRange.cloneContents();
          cleanColor(selected);

          var replacement = documentRef.createDocumentFragment();
          if (before.hasChildNodes()) {
            var beforeWrap = startColor.cloneNode(false);
            beforeWrap.appendChild(before);
            replacement.appendChild(beforeWrap);
          }
          var marker = documentRef.createElement('span');
          marker.setAttribute('data-kniu-color-clear', '');
          var selectedWrap = startColor.cloneNode(false);
          selectedWrap.style.removeProperty(property);
          if (!selectedWrap.getAttribute('style')) selectedWrap.removeAttribute('style');
          selectedWrap.appendChild(selected);
          if (selectedWrap.tagName === 'SPAN' && selectedWrap.attributes.length === 0) {
            while (selectedWrap.firstChild) marker.appendChild(selectedWrap.firstChild);
          } else {
            marker.appendChild(selectedWrap);
          }
          replacement.appendChild(marker);
          if (after.hasChildNodes()) {
            var afterWrap = startColor.cloneNode(false);
            afterWrap.appendChild(after);
            replacement.appendChild(afterWrap);
          }
          startColor.parentNode.replaceChild(replacement, startColor);

          var first = marker.firstChild;
          var last = marker.lastChild;
          var parent = marker.parentNode;
          while (marker.firstChild) parent.insertBefore(marker.firstChild, marker);
          marker.remove();
          if (first && last) {
            var selection = (this.shadowRoot.getSelection && this.shadowRoot.getSelection()) || documentRef.getSelection();
            var restored = documentRef.createRange();
            restored.setStartBefore(first);
            restored.setEndAfter(last);
            selection.removeAllRanges();
            selection.addRange(restored);
          }
          return;
        }

        var fragment = range.cloneContents();
        cleanColor(fragment);
        range.deleteContents();
        range.insertNode(fragment);
      }

      _confirmLink() {
        var urlInput = this._popover.querySelector('.pop_link_url');
        var textInput = this._popover.querySelector('.pop_link_text');
        var error = this._popover.querySelector('.kniu_sys_editor_popover_error');
        var url = urlInput ? urlInput.value.trim() : '';
        if (!url || /^(javascript|vbscript|data):/i.test(url)) {
          if (error) error.textContent = !url ? '请输入链接地址' : '请输入安全有效的链接地址';
          if (urlInput) urlInput.focus();
          return;
        }
        var selection = documentRef.getSelection();
        if (selection && this._linkRange) {
          selection.removeAllRanges();
          selection.addRange(this._linkRange);
        }
        this._editor.focus();
        if (this._linkRange && this._linkRange.toString()) {
          documentRef.execCommand('createLink', false, url);
        } else {
          var a = documentRef.createElement('a');
          a.href = url;
          a.textContent = textInput && textInput.value.trim() ? textInput.value.trim() : '链接';
          documentRef.execCommand('insertHTML', false, a.outerHTML);
        }
        this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        this._syncToolbarState();
        this._closePopover();
      }

      _insertTable(rows, cols) {
        rows = Math.max(1, Math.min(20, parseInt(rows, 10) || 3));
        cols = Math.max(1, Math.min(20, parseInt(cols, 10) || 3));
        var html = '<table style="border-collapse:collapse;width:100%;margin:.5em 0"><tbody>';
        for (var r = 0; r < rows; r++) {
          html += '<tr>';
          for (var c = 0; c < cols; c++) html += '<td style="border:1px solid #dcdfe6;padding:6px 10px;min-width:48px;height:22px"></td>';
          html += '</tr>';
        }
        html += '</tbody></table><p><br></p>';
        this._editor.focus();
        documentRef.execCommand('insertHTML', false, html);
        this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        this._syncToolbarState();
      }

      _insertEmoji(ch) {
        this._editor.focus();
        documentRef.execCommand('insertText', false, ch);
        this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      }

      _syncToolbarState() {
        if (this._codeMode) return;
        var cmds = ['bold', 'italic', 'underline', 'strikeThrough', 'justifyLeft', 'justifyCenter', 'justifyRight', 'justifyFull', 'subscript', 'superscript'];
        for (var i = 0; i < cmds.length; i++) {
          var btn = this.shadowRoot.querySelector('[data-cmd="' + cmds[i] + '"]');
          if (btn) {
            try { btn.setAttribute('aria-pressed', String(documentRef.queryCommandState(cmds[i]))); }
            catch (e) { btn.setAttribute('aria-pressed', 'false'); }
          }
        }
        var allBtn = this.shadowRoot.querySelector('[data-cmd="selectAll"]');
        if (allBtn) allBtn.setAttribute('aria-pressed', String(this._isAllSelected()));
        var preBtn = this.shadowRoot.querySelector('[data-block="pre"]');
        if (preBtn) preBtn.setAttribute('aria-pressed', String(this._currentBlockTag() === 'pre'));
      }

      _mountAffixes() {
        var template = Array.from(this.children).find(function (child) {
          return child.tagName === 'TEMPLATE' && child.hasAttribute('#prepend');
        });
        if (template) {
          var content = documentRef.createElement('span');
          content.slot = 'prepend';
          var labelWidth = template.getAttribute('label-width');
          if (labelWidth) content.dataset.labelWidth = labelWidth;
          content.append(template.content.cloneNode(true));
          template.replaceWith(content);
        }
        var prependContent = this.querySelector('[slot="prepend"]');
        this._group.dataset.hasPrepend = String(Boolean(prependContent));
        if (prependContent) {
          var affix = this.shadowRoot.querySelector('.kniu_sys_editor_prepend');
          var lw = prependContent.dataset.labelWidth || '';
          if (lw && CSS.supports('width', lw)) {
            affix.style.width = lw;
            affix.style.flexBasis = lw;
          } else {
            affix.style.removeProperty('width');
            affix.style.removeProperty('flex-basis');
          }
        }
      }

      _sync() {
        var placeholder = this.getAttribute('placeholder');
        this._editor.dataset.placeholder = placeholder || '';
        var ro = this.hasAttribute('readonly') || this.hasAttribute('disabled');
        this._editor.contentEditable = ro ? 'false' : 'true';
        if (this._source) this._source.disabled = ro;
        var ctrls = this.shadowRoot.querySelectorAll('.kniu_sys_editor_btn, .kniu_sys_editor_select, .kniu_sys_editor_color');
        for (var i = 0; i < ctrls.length; i++) {
          var c = ctrls[i];
          var isCodeToggle = c.dataset.action === 'code';
          var isMax = c.dataset.action === 'maximize';
          c.disabled = ro || (this._codeMode && !isCodeToggle && !isMax);
        }
      }
    }

    customElements.define('kniu-editor', KniuSysEditor);
  }

  function registerNavbarComponent() {
    if (typeof customElements === 'undefined') return;

    if (!customElements.get('kniu-navbar-cell')) {
      class KniuNavbarCell extends HTMLElement {
        static get observedAttributes() { return ['href', 'active', 'disabled', 'side', 'level']; }
        constructor() {
          super();
          attachComponentShadow(this);
          this.shadowRoot.innerHTML = `
            <style>
              :host{display:block;min-width:0}
              a{display:flex;align-items:center;min-height:44px;padding:0 18px;border-radius:8px;color:#4b5563;text-decoration:none;font:inherit;white-space:nowrap;transition:background-color .2s,color .2s}
              a:hover,:host([active]) a{background-color:#f1f5f9;color:#111827}
              :host([disabled]){opacity:.45;pointer-events:none}
              :host([side]){width:100%}
              :host([side]) a{gap:8px;min-height:50px;width:100%;padding:0 12px;border-radius:11px;box-sizing:border-box;color:#9ca5bf}
              :host([side]) a:hover,:host([side][active]) a{background-color:#252b42;color:#fff}
              @media(max-width:720px){:host(:not([side])){width:100%;border-bottom:1px solid #e5e7eb}:host(:not([side])) a{width:100%;min-height:50px;padding:0 16px 0 calc(16px + var(--kniu-navbar-level,0) * 16px);border-radius:0;box-sizing:border-box}}
            </style>
            <a part="link"><slot></slot></a>`;
          this._link = this.shadowRoot.querySelector('a');
        }
        connectedCallback() { this._sync(); }
        attributeChangedCallback() { this._sync(); }
        _sync() {
          if (!this._link) return;
          this._link.href = this.getAttribute('href') || '#/';
          this._link.setAttribute('aria-current', this.hasAttribute('active') ? 'page' : 'false');
          this._link.setAttribute('aria-disabled', String(this.hasAttribute('disabled')));
        }
      }
      customElements.define('kniu-navbar-cell', KniuNavbarCell);
    }

    if (!customElements.get('kniu-sub-navbar')) {
      class KniuSubNavbar extends HTMLElement {
        static get observedAttributes() { return ['active', 'level']; }
        constructor() {
          super();
          attachComponentShadow(this);
          this.shadowRoot.innerHTML = `
            <style>
              :host{position:relative;display:block}
              details{position:relative}
              summary{display:flex;align-items:center;min-height:44px;padding:0 18px;border-radius:8px;color:#4b5563;cursor:pointer;list-style:none;white-space:nowrap}
              summary::-webkit-details-marker{display:none}
              summary::after{content:'⌄';margin-left:auto;padding-left:8px;font-size:12px;transition:transform .2s}
              details[open]>summary::after{transform:rotate(180deg)}
              summary:hover,:host([active])>details>summary{background-color:#f1f5f9;color:#111827}
              .panel{position:absolute;top:100%;left:0;z-index:20;min-width:180px;padding:8px;border:1px solid #e5e7eb;border-radius:10px;background-color:#fff;box-shadow:0 12px 30px rgba(15,23,42,.12)}
              :host([level="2"]) .panel,:host([level="3"]) .panel{top:0;left:100%}
              @media(max-width:720px){:host{width:100%;border-bottom:1px solid #e5e7eb}summary{min-height:50px;padding:0 16px 0 calc(16px + (var(--kniu-navbar-level,1) - 1) * 16px);border-radius:0}.panel,:host([level="2"]) .panel,:host([level="3"]) .panel{position:static;min-width:0;padding:0;border:0;border-radius:0;background-color:#fff;box-shadow:none}}
            </style>
            <details><summary><slot name="title">菜单</slot></summary><div class="panel"><slot></slot></div></details>`;
          this._details = this.shadowRoot.querySelector('details');
        }
        connectedCallback() { this._sync(); }
        attributeChangedCallback() { this._sync(); }
        _sync() {
          const level = Math.max(1, Number(this.getAttribute('level')) || 1);
          this.style.setProperty('--kniu-navbar-level', String(level));
          if (this.hasAttribute('active')) this._details.open = true;
        }
      }
      customElements.define('kniu-sub-navbar', KniuSubNavbar);
    }

    if (!customElements.get('kniu-navbar')) {
      class KniuNavbar extends HTMLElement {
        static get observedAttributes() { return ['brand', 'home', 'active', 'type', 'open']; }
        constructor() {
          super();
          attachComponentShadow(this);
          this.shadowRoot.innerHTML = `
            <style>
              :host{display:block;width:100%;background-color:#fff;color:#111827}
              .bar{display:flex;align-items:center;justify-content:space-between;gap:24px;margin:0 auto;padding:0 clamp(16px,4vw,60px);min-height:72px;max-width:1600px;box-sizing:border-box}
              .brand{display:flex;align-items:center;overflow:hidden;color:#111827;text-decoration:none;font-size:clamp(22px,3vw,30px);line-height:1.3;text-overflow:ellipsis;white-space:nowrap}
              .brand-label{display:block}
              ::slotted([slot="brand"]){display:block;max-width:min(220px,40vw);max-height:48px}
              .toggle{display:none;align-items:center;justify-content:center;width:44px;height:44px;border:0;border-radius:8px;background-color:transparent;color:#111827;cursor:pointer}
              .toggle-icon{position:relative;display:block;width:24px;height:18px}
              .toggle-icon i{position:absolute;left:0;display:block;width:24px;height:2px;border-radius:2px;background-color:currentColor;transition:top .28s ease,transform .28s ease,opacity .2s ease}
              .toggle-icon i:nth-child(1){top:0}.toggle-icon i:nth-child(2){top:8px}.toggle-icon i:nth-child(3){top:16px}
              :host([open]:not([closing])) .toggle-icon i:nth-child(1){top:8px;transform:rotate(45deg)}
              :host([open]:not([closing])) .toggle-icon i:nth-child(2){opacity:0;transform:scaleX(0)}
              :host([open]:not([closing])) .toggle-icon i:nth-child(3){top:8px;transform:rotate(-45deg)}
              .menu{display:flex;align-items:center;justify-content:flex-end;gap:4px;min-width:0}
              :host([type="side"]){color:#eef2ff;background-color:transparent}
              :host([type="side"]) .bar{display:block;max-width:none;min-height:0;padding:0}
              :host([type="side"]) .brand{gap:10px;padding:0 8px 30px;color:#eef2ff;font-size:20px;font-weight:800}
              :host([type="side"]) .menu{display:grid;grid-template-columns:minmax(0,1fr);width:100%;justify-content:stretch;gap:6px}
              :host([type="side"]) .menu > slot:not([name]){display:grid;grid-template-columns:minmax(0,1fr);width:100%;justify-content:stretch;gap:6px}
              :host([type="side"]) .menu > slot:not([name])::slotted(kniu-navbar-cell){display:block;width:100%}
              :host([type="side"]) .toggle{display:none}
              @media(max-width:720px){
                .bar{position:relative;min-height:60px;padding:0 16px;flex-wrap:wrap;gap:0}
                .brand{font-size:22px}.toggle{display:flex}
                .menu{display:none;flex:0 0 100%;align-items:stretch;padding:0}
                :host([open]:not([type="side"])) .menu{position:fixed;top:60px;right:0;bottom:0;left:0;z-index:1000;display:flex;flex-direction:column;align-items:stretch;justify-content:flex-start;gap:0;width:auto;margin:0;padding:0;overflow-y:auto;background-color:#fff;animation:kniu_navbar_mobile_slide_in .28s ease-out both}
                :host([closing]:not([type="side"])) .menu{animation-name:kniu_navbar_mobile_slide_out;animation-timing-function:ease-in}
                @keyframes kniu_navbar_mobile_slide_in{from{transform:translateX(-100%)}to{transform:translateX(0)}}
                @keyframes kniu_navbar_mobile_slide_out{from{transform:translateX(0)}to{transform:translateX(-100%)}}
                @media(prefers-reduced-motion:reduce){.toggle-icon i{transition:none}:host([open]:not([type="side"])) .menu{animation:none}}
              }
            </style>
            <nav class="bar" aria-label="主导航">
              <a class="brand"><slot name="brand"><span class="brand-label"></span></slot></a>
              <button class="toggle" type="button" aria-label="展开导航" aria-expanded="false"><span class="toggle-icon" aria-hidden="true"><i></i><i></i><i></i></span></button>
              <div class="menu"><slot name="append"></slot><slot></slot></div>
            </nav>`;
          this._brand = this.shadowRoot.querySelector('.brand');
          this._brandLabel = this.shadowRoot.querySelector('.brand-label');
          this._toggle = this.shadowRoot.querySelector('.toggle');
          this._slots = [...this.shadowRoot.querySelectorAll('slot')];
          this._handleHashChange = this._syncActive.bind(this);
          this._handleToggleClick = function (event) {
            event.stopPropagation();
            if (this.hasAttribute('open')) this._closeMenu();
            else this._openMenu();
          }.bind(this);
          this._handleMenuClick = function (event) {
            if (event.composedPath?.().includes(this._toggle)) return;
            const isNavigationLink = event.composedPath?.().some(function (node) {
              return node?.tagName === 'KNIU-NAVBAR-CELL';
            });
            if (!isNavigationLink) return;
            this._closeMenu();
          }.bind(this);
        }
        connectedCallback() {
          this._toggle.addEventListener('click', this._handleToggleClick);
          this._slots.forEach(function (slot) { slot.addEventListener('slotchange', this._handleHashChange); }, this);
          this.addEventListener('click', this._handleMenuClick);
          globalThis.addEventListener?.('hashchange', this._handleHashChange);
          this._sync();
        }
        disconnectedCallback() {
          this._toggle.removeEventListener('click', this._handleToggleClick);
          globalThis.removeEventListener?.('hashchange', this._handleHashChange);
          this._slots.forEach(function (slot) { slot.removeEventListener('slotchange', this._handleHashChange); }, this);
          this.removeEventListener('click', this._handleMenuClick);
          if (this._closeTimer) globalThis.clearTimeout(this._closeTimer);
          this._closeTimer = null;
        }
        attributeChangedCallback() { this._sync(); }
        _sync() {
          if (!this._brand) return;
          this._brandLabel.textContent = this.getAttribute('brand') || '首页';
          this._brand.href = this.getAttribute('home') || '#/';
          this._syncActive();
          this._syncToggle();
        }
        _syncToggle() {
          const open = this.hasAttribute('open') && !this.hasAttribute('closing');
          this._toggle.setAttribute('aria-expanded', String(open));
          this._toggle.setAttribute('aria-label', open ? '收起导航' : '展开导航');
        }
        _openMenu() {
          if (this._closeTimer) globalThis.clearTimeout(this._closeTimer);
          this._closeTimer = null;
          this.removeAttribute('closing');
          this.setAttribute('open', '');
          this._syncToggle();
        }
        _closeMenu() {
          if (!this.hasAttribute('open') || this.hasAttribute('closing')) return;
          this.setAttribute('closing', '');
          this._syncToggle();
          const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
          this._closeTimer = globalThis.setTimeout(function () {
            this.removeAttribute('open');
            this.removeAttribute('closing');
            this._closeTimer = null;
            this._syncToggle();
          }.bind(this), reducedMotion ? 0 : 280);
        }
        _syncActive() {
          const active = this.getAttribute('active') || (globalThis.location?.hash || '#/').replace(/^#/, '').split('?')[0] || '/';
          this.querySelectorAll('kniu-navbar-cell').forEach(function (cell) {
            const index = cell.getAttribute('index') || cell.getAttribute('href')?.replace(/^#/, '').split('?')[0];
            cell.toggleAttribute('active', index === active);
            cell.toggleAttribute('side', this.getAttribute('type') === 'side');
            let level = 0;
            let parent = cell.parentElement?.closest('kniu-sub-navbar');
            while (parent) {
              level += 1;
              parent = parent.parentElement?.closest('kniu-sub-navbar');
            }
            level = Math.min(3, level);
            cell.setAttribute('level', String(level));
            cell.style.setProperty('--kniu-navbar-level', String(level));
          }, this);
          this.querySelectorAll('kniu-sub-navbar').forEach(function (subNavbar) {
            let level = 1;
            let parent = subNavbar.parentElement?.closest('kniu-sub-navbar');
            while (parent) {
              level += 1;
              parent = parent.parentElement?.closest('kniu-sub-navbar');
            }
            level = Math.min(3, level);
            subNavbar.setAttribute('level', String(level));
            subNavbar.style.setProperty('--kniu-navbar-level', String(level));
            subNavbar.toggleAttribute('active', Boolean(subNavbar.querySelector('kniu-navbar-cell[active]')));
          });
        }
      }
      customElements.define('kniu-navbar', KniuNavbar);
    }
  }

  function registerBacktopComponent() {
    if (typeof customElements === 'undefined' || customElements.get('kniu-backtop')) return;
    class KniuBacktop extends HTMLElement {
      static get observedAttributes() { return ['right', 'bottom']; }
      constructor() {
        super();
        attachComponentShadow(this);
        this.shadowRoot.innerHTML = `
          <style>
            :host{display:none;position:fixed;z-index:40;right:min(var(--right,40px),calc(100vw - 56px));bottom:min(var(--bottom,40px),calc(100vh - 56px))}
            :host([visible]){display:block}
            button{display:grid;place-items:center;width:44px;height:44px;border:1px solid #e5e7eb;border-radius:50%;background-color:#fff;color:#374151;cursor:pointer;box-shadow:0 8px 24px rgba(15,23,42,.14);transition:transform .2s,box-shadow .2s}
            button svg{width:20px;height:20px;display:block}
            button:hover{transform:translateY(-2px);box-shadow:0 12px 28px rgba(15,23,42,.18)}
            @media(max-width:720px){:host{right:16px!important;bottom:16px!important}button{width:40px;height:40px}button svg{width:18px;height:18px}}
            @media(prefers-reduced-motion:reduce){button{transition:none}}
          </style>
          <button type="button" aria-label="返回顶部">
            <svg viewBox="0 0 1024 1024" aria-hidden="true">
              <path fill="currentColor" d="M488.8 344.3 149 701a32 32 0 0 0 0 44.2l.4.3a29.4 29.4 0 0 0 42.7 0l320-335.8 319.8 335.8a29.4 29.4 0 0 0 42.7 0l.4-.3a32 32 0 0 0 0-44.2L535.2 344.3a32 32 0 0 0-46.4 0"/>
            </svg>
          </button>`;
        this._handleScroll = this._syncVisible.bind(this);
        this._handleClick = this._scrollTop.bind(this);
      }
      connectedCallback() {
        this._target = this._findScrollTarget();
        const listenerTarget = this._target === document.scrollingElement ? globalThis : this._target;
        listenerTarget?.addEventListener('scroll', this._handleScroll, { passive: true });
        this.shadowRoot.querySelector('button').addEventListener('click', this._handleClick);
        this._syncPosition();
        this._syncVisible();
        this._watchTimer = globalThis.setInterval(this._handleScroll, 200);
      }
      disconnectedCallback() {
        const listenerTarget = this._target === document.scrollingElement ? globalThis : this._target;
        listenerTarget?.removeEventListener('scroll', this._handleScroll);
        this.shadowRoot.querySelector('button')?.removeEventListener('click', this._handleClick);
        if (this._watchTimer) globalThis.clearInterval(this._watchTimer);
        this._watchTimer = null;
      }
      attributeChangedCallback() { this._syncPosition(); }
      _findScrollTarget() {
        let node = this.parentNode;
        while (node) {
          if (node.nodeType === 1) {
            const style = globalThis.getComputedStyle?.(node);
            if (/(auto|scroll)/.test(style?.overflowY || '')) return node;
          }
          const root = node.getRootNode?.();
          node = node.parentNode || (root && root.host) || null;
        }
        return document.scrollingElement || document.documentElement;
      }
      _syncPosition() {
        const right = Math.max(0, Number(this.getAttribute('right')) || 40);
        const bottom = Math.max(0, Number(this.getAttribute('bottom')) || 40);
        this.style.setProperty('--right', right + 'px');
        this.style.setProperty('--bottom', bottom + 'px');
      }
      _syncVisible() {
        const target = this._target || document.scrollingElement || document.documentElement;
        const win = globalThis;
        const docEl = document.documentElement;
        const scrollTop = Math.max(
          win.scrollY || 0,
          docEl?.scrollTop || 0,
          document.body?.scrollTop || 0,
          target?.scrollTop || 0
        );
        // 仅当页面（或当前 scroll target）实际存在滚动空间时才显示按钮：
        // 一屏够用时整页 scrollHeight ≤ clientHeight，应完全隐藏。
        const docOverflow = (docEl?.scrollHeight || 0) > (win.innerHeight || 0) + 1;
        const targetOverflow = target && target !== docEl && target !== document.body
          ? (target.scrollHeight - target.clientHeight) > 1
          : false;
        this.toggleAttribute('visible', (docOverflow || targetOverflow) && scrollTop > 1);
      }
      _scrollTop() {
        const reduced = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        this._target?.scrollTo?.({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
        globalThis.scrollTo?.({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
      }
    }
    customElements.define('kniu-backtop', KniuBacktop);
  }

  function registerCommentComponent() {
    if (typeof customElements === 'undefined' || customElements.get('kniu-comment')) return;
    const documentRef = typeof document !== 'undefined' ? document : null;
    if (!documentRef) return;

    const COMMENT_DEFAULT_EMOJIS = ['😀', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '😉', '😊', '😍', '😘', '😎', '🤔', '🤨', '😐', '😴', '😭', '😡', '👍', '👎', '👌', '✌️', '🤝', '👏', '💪', '🙏', '👀', '💡', '🔥', '⭐', '✨', '🎉', '❤️', '💔', '💯', '✅', '❌', '⚠️', '❓', '❗', '💬', '📌', '📝'];
    const COMMENT_STYLE = `
      :host{display:block;font-size:14px;color:#333;line-height:1.5}
      .kniu_sys_comment{background:#fff;padding:16px;border-radius:4px}
      .kniu_sys_comment_input_area{position:relative;margin-bottom:20px}
      .kniu_sys_comment_textarea{width:100%;min-height:80px;padding:10px 12px;border:1px solid #dcdfe6;border-radius:4px;resize:vertical;font:inherit;box-sizing:border-box;outline:0}
      .kniu_sys_comment_textarea:focus{border-color:#409eff}
      .kniu_sys_comment_toolbar{display:flex;justify-content:flex-end;align-items:center;gap:10px;margin-top:10px}
      .kniu_sys_comment_emoji_btn{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;min-height:32px;padding:8px 12px;border:1px solid #dcdfe6;border-radius:4px;background-color:#fff;color:#606266;font-size:14px;line-height:1;cursor:pointer;user-select:none;transition:.1s}
      .kniu_sys_comment_emoji_btn:hover,.kniu_sys_comment_emoji_btn:focus-visible{border-color:#c6e2ff;background-color:#ecf5ff;color:#409eff}
      .kniu_sys_comment_emoji_btn:active{filter:brightness(.94)}
      .kniu_sys_comment_submit{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;min-height:32px;padding:8px 15px;border:1px solid #409eff;border-radius:4px;background-color:#409eff;color:#fff;font:500 14px/1 Arial,"Microsoft YaHei",sans-serif;cursor:pointer;user-select:none;transition:.1s}
      .kniu_sys_comment_submit:hover,.kniu_sys_comment_submit:focus-visible{background-color:#79bbff;border-color:#79bbff}
      .kniu_sys_comment_submit:active{filter:brightness(.94)}
      .kniu_sys_comment_submit:disabled{border-color:#e4e7ed;background-color:#a0cfff;color:#fff;cursor:not-allowed;filter:none;opacity:.6}
      .kniu_sys_comment_emoji_panel{position:absolute;right:0;top:calc(100% + 6px);width:260px;max-height:220px;overflow-y:auto;overflow-x:hidden;background-color:#fff;border:1px solid #e4e7ed;border-radius:4px;box-shadow:0 2px 12px rgba(0,0,0,.1);padding:8px;z-index:10;display:grid;grid-template-columns:repeat(7,1fr);gap:4px}
      .kniu_sys_comment_emoji_panel.kniu_sys_comment_above{top:auto;bottom:calc(100% + 6px)}
      .kniu_sys_comment_emoji_panel.kniu_sys_comment_hidden{display:none}
      .kniu_sys_comment_emoji_item{background-color:#fff;border:1px solid transparent;border-radius:4px;padding:4px 2px;cursor:pointer;font-size:20px;text-align:center;line-height:1}
      .kniu_sys_comment_emoji_item:hover{background-color:#f5f7fa;border-color:#dcdfe6}
      .kniu_sys_comment_list{}
      .kniu_sys_comment_empty{padding:40px 0;text-align:center;color:#909399;font-size:14px}
      .kniu_sys_comment_item{display:flex;gap:12px;padding:16px 0;border-bottom:1px solid #ebeef5}
      .kniu_sys_comment_item:last-child{border-bottom:0}
      .kniu_sys_comment_avatar{width:40px;height:40px;border-radius:50%;overflow:hidden;flex-shrink:0;background-color:#e4e7ed;display:grid;place-items:center;color:#909399;font-size:14px}
      .kniu_sys_comment_avatar img{width:100%;height:100%;object-fit:cover;display:block}
      .kniu_sys_comment_body{flex:1;min-width:0}
      .kniu_sys_comment_meta{display:flex;align-items:center;gap:10px;margin-bottom:4px}
      .kniu_sys_comment_username{color:#409eff;font-weight:500}
      .kniu_sys_comment_time{color:#909399;font-size:12px}
      .kniu_sys_comment_content{margin:6px 0;color:#606266;word-break:break-all}
      .kniu_sys_comment_actions{display:flex;align-items:center;gap:8px;font-size:13px;color:#606266}
      .kniu_sys_comment_action_sep{color:#dcdfe6}
      .kniu_sys_comment_action_reply,.kniu_sys_comment_action_like{background-color:transparent;border:0;padding:0;color:#606266;cursor:pointer;font:inherit;display:flex;align-items:center;gap:4px;transition:color .2s}
      .kniu_sys_comment_action_reply:hover,.kniu_sys_comment_action_like:hover{color:#409eff}
      .kniu_sys_comment_action_like.kniu_sys_comment_liked{color:#f56c6c}
      .kniu_sys_comment_like_icon{font-size:12px}
      .kniu_sys_comment_reply_hint{padding:6px 10px;margin-bottom:8px;background-color:#f5f7fa;border-radius:4px;color:#606266;font-size:13px;display:flex;justify-content:space-between;align-items:center}
      .kniu_sys_comment_reply_hint button{background-color:transparent;border:0;color:#909399;cursor:pointer;font-size:16px;line-height:1}
      .kniu_sys_comment_reply_hint button:hover{color:#f56c6c}
    `;

    function commentEscape(text) {
      return String(text == null ? '' : text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    class KniuSysComment extends HTMLElement {
      constructor() {
        super();
        attachComponentShadow(this);
        this._options = {};
        this._showEmoji = false;
        this._replyId = null;
        this._replyName = '';
        this._closeEmojiHandler = null;
      }
      connectedCallback() { this._render(); }
      attributeChangedCallback() {}
      // kniu:options 统一配置入口：必须提供本组件自身的 options accessor，
      // 否则 installOptionsOnlyProtocol 因无 ownDescriptor.set 会退回属性反射
      // （reflectOptions），_options 恒空、_render 渲染不出任何内容
      // （对齐 kniu-switch / kniu-select / kniu-date-picker 的既有模式）。
      set options(value) {
        this._options = value && typeof value === 'object' ? value : {};
        this._render();
      }
      get options() { return this._options; }
      _render() {
        const options = this._options || {};
        const list = Array.isArray(options.list) ? options.list : [];
        const placeholder = options.placeholder || 'Please enter a comment...';
        const submitText = options.submitText || '评论';
        const emojis = Array.isArray(options.emojis) ? options.emojis : COMMENT_DEFAULT_EMOJIS;
        const emptyText = options.emptyText || '暂无评论，快来抢沙发吧！';
        const currentUser = options.currentUser || null;
        const canSubmit = typeof options.onSubmit === 'function' || true;

        const htmlParts = ['<style>' + COMMENT_STYLE + '</style><div class="kniu_sys_comment">'];
        // 输入区
        htmlParts.push('<div class="kniu_sys_comment_input_area">');
        if (this._replyId) {
          htmlParts.push('<div class="kniu_sys_comment_reply_hint">回复 ' + commentEscape(this._replyName) + '...<button type="button" data-action="cancel-reply" title="取消回复">×</button></div>');
        }
        htmlParts.push('<textarea class="kniu_sys_comment_textarea" placeholder="' + commentEscape(placeholder) + '"></textarea>');
        htmlParts.push('<div class="kniu_sys_comment_toolbar">');
        htmlParts.push('<button type="button" class="kniu_sys_comment_emoji_btn" title="表情">😊</button>');
        htmlParts.push('<button type="button" class="kniu_sys_comment_submit" type="button">' + commentEscape(submitText) + '</button>');
        htmlParts.push('</div>');
        htmlParts.push('<div class="kniu_sys_comment_emoji_panel' + (this._showEmoji ? '' : ' kniu_sys_comment_hidden') + '">');
        emojis.forEach(function (emoji) {
          htmlParts.push('<button type="button" class="kniu_sys_comment_emoji_item">' + emoji + '</button>');
        });
        htmlParts.push('</div>');
        htmlParts.push('</div>');
        // 评论列表
        htmlParts.push('<div class="kniu_sys_comment_list">');
        if (list.length === 0) {
          htmlParts.push('<div class="kniu_sys_comment_empty">' + commentEscape(emptyText) + '</div>');
        } else {
          list.forEach(function (item) {
            const username = item.username || '匿名';
            const firstChar = String(username).charAt(0).toUpperCase();
            htmlParts.push('<div class="kniu_sys_comment_item" data-id="' + commentEscape(item.id) + '">');
            htmlParts.push('<div class="kniu_sys_comment_avatar">');
            if (item.avatar) htmlParts.push('<img src="' + commentEscape(item.avatar) + '" alt="">');
            else htmlParts.push('<div class="kniu_sys_comment_avatar_default">' + commentEscape(firstChar) + '</div>');
            htmlParts.push('</div>');
            htmlParts.push('<div class="kniu_sys_comment_body">');
            htmlParts.push('<div class="kniu_sys_comment_meta">');
            htmlParts.push('<span class="kniu_sys_comment_username">' + commentEscape(username) + '</span>');
            htmlParts.push('<span class="kniu_sys_comment_time">' + commentEscape(item.time || '') + '</span>');
            htmlParts.push('</div>');
            htmlParts.push('<div class="kniu_sys_comment_content">' + commentEscape(item.content || '') + '</div>');
            htmlParts.push('<div class="kniu_sys_comment_actions">');
            htmlParts.push('<button type="button" class="kniu_sys_comment_action_reply">回复</button>');
            htmlParts.push('<span class="kniu_sys_comment_action_sep">|</span>');
            htmlParts.push('<button type="button" class="kniu_sys_comment_action_like' + (item.liked ? ' kniu_sys_comment_liked' : '') + '">');
            htmlParts.push('<span class="kniu_sys_comment_like_icon">' + (item.liked ? '❤' : '♡') + '</span>');
            htmlParts.push('<span>' + (Number(item.likes) || 0) + '</span>');
            htmlParts.push('</button>');
            htmlParts.push('</div>');
            htmlParts.push('</div>');
            htmlParts.push('</div>');
          });
        }
        htmlParts.push('</div>');
        htmlParts.push('</div>');
        this.shadowRoot.innerHTML = htmlParts.join('');
        this._bindEvents();
      }
      _bindEvents() {
        const self = this;
        const root = this.shadowRoot;
        const documentRefLocal = this.ownerDocument || document;
        if (!root) return;

        const textarea = root.querySelector('.kniu_sys_comment_textarea');
        const emojiBtn = root.querySelector('.kniu_sys_comment_emoji_btn');
        const emojiPanel = root.querySelector('.kniu_sys_comment_emoji_panel');
        const submitBtn = root.querySelector('.kniu_sys_comment_submit');

        if (emojiBtn && emojiPanel) {
          emojiBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            self._showEmoji = !self._showEmoji;
            emojiPanel.classList.toggle('kniu_sys_comment_hidden', !self._showEmoji);
            if (self._showEmoji) {
              // 弹框位置默认在下方；下方空间不足时翻转到上方。
              // 仅在用户点击打开时测量一次（非渲染热路径，允许同步布局）。
              emojiPanel.classList.remove('kniu_sys_comment_above');
              const area = emojiPanel.closest('.kniu_sys_comment_input_area');
              const rect = area ? area.getBoundingClientRect() : null;
              if (rect) {
                const panelHeight = emojiPanel.offsetHeight || 220;
                const spaceBelow = (globalThis.innerHeight || 0) - rect.bottom;
                if (spaceBelow < panelHeight + 6) {
                  emojiPanel.classList.add('kniu_sys_comment_above');
                }
              }
            }
          });
          // 全局点击关闭 emoji 面板
          if (this._closeEmojiHandler) documentRefLocal.removeEventListener('click', this._closeEmojiHandler);
          this._closeEmojiHandler = function (e) {
            if (!self.isConnected) return;
            const path = e.composedPath?.() || [];
            if (!path.includes(emojiBtn) && !path.includes(emojiPanel)) {
              self._showEmoji = false;
              emojiPanel.classList.add('kniu_sys_comment_hidden');
            }
          };
          documentRefLocal.addEventListener('click', this._closeEmojiHandler);
        }

        root.querySelectorAll('.kniu_sys_comment_emoji_item').forEach(function (btn) {
          btn.addEventListener('click', function (e) {
            e.stopPropagation();
            if (textarea) {
              textarea.value += btn.textContent;
              textarea.focus();
            }
            self._showEmoji = false;
            emojiPanel?.classList.add('kniu_sys_comment_hidden');
          });
        });

        if (submitBtn && textarea) {
          submitBtn.addEventListener('click', function () {
            const content = String(textarea.value || '').trim();
            if (!content) return;
            self._dispatch('submit', { content: content, parentId: self._replyId });
            textarea.value = '';
            self._replyId = null;
            self._replyName = '';
            self._render();
          });
        }

        const cancelReplyBtn = root.querySelector('[data-action="cancel-reply"]');
        if (cancelReplyBtn && textarea) {
          cancelReplyBtn.addEventListener('click', function () {
            self._replyId = null;
            self._replyName = '';
            self._render();
          });
        }

        root.querySelectorAll('.kniu_sys_comment_action_reply').forEach(function (btn) {
          btn.addEventListener('click', function () {
            const item = btn.closest('.kniu_sys_comment_item');
            if (!item || !textarea) return;
            const id = item.dataset.id;
            const usernameEl = item.querySelector('.kniu_sys_comment_username');
            self._replyId = id || null;
            self._replyName = usernameEl ? usernameEl.textContent : '';
            self._render();
          });
        });

        root.querySelectorAll('.kniu_sys_comment_action_like').forEach(function (btn) {
          btn.addEventListener('click', function () {
            const item = btn.closest('.kniu_sys_comment_item');
            if (!item) return;
            const id = item.dataset.id;
            if (!id) return;
            const liked = btn.classList.contains('kniu_sys_comment_liked');
            self._dispatch('like', { commentId: id, liked: !liked });
          });
        });
      }
      _dispatch(name, detail) {
        this.dispatchEvent(new CustomEvent(name, { detail: detail, bubbles: true, composed: true }));
      }
      disconnectedCallback() {
        if (this._closeEmojiHandler) {
          (this.ownerDocument || document).removeEventListener('click', this._closeEmojiHandler);
          this._closeEmojiHandler = null;
        }
      }
    }
    customElements.define('kniu-comment', KniuSysComment);
  }

  function registerIcons(set) {
    Object.keys(set || {}).forEach(function (name) {
      registerIconGlyph(name, set[name]);
    });
  }

  function installOptionsOnlyProtocol(tagName) {
    const Component = customElements.get(tagName);
    if (!Component || Component.prototype.__kniuOptionsOnly) return;
    const prototype = Component.prototype;
    const ownDescriptor = Object.getOwnPropertyDescriptor(prototype, 'options');
    const originalConnected = prototype.connectedCallback;
    const originalAttributeChanged = prototype.attributeChangedCallback;
    const allowedAttribute = function (name) {
      return ['id', 'class', 'style', 'slot', 'ref', 'role', 'tabindex'].includes(name)
        || name.startsWith('aria-') || name.startsWith('data-') || name.startsWith('kniu:')
        || name.startsWith('kniu@') || name.startsWith('#');
    };
    const clearCallbacks = function (element) {
      (element.__kniuOptionListeners || []).forEach(function ([name, handler]) { element.removeEventListener(name, handler); });
      element.__kniuOptionListeners = [];
    };
    const bindCallbacks = function (element, options) {
      clearCallbacks(element);
      Object.entries(options || {}).forEach(function ([key, callback]) {
        if (!/^on[A-Z]/.test(key) || typeof callback !== 'function') return;
        const eventName = key.slice(2).replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
        const handler = function (event) { return callback(event.detail, event, element); };
        element.addEventListener(eventName, handler);
        element.__kniuOptionListeners.push([eventName, handler]);
      });
    };
    const hasWritableProperty = function (element, key) {
      let target = element;
      while (target) {
        const descriptor = Object.getOwnPropertyDescriptor(target, key);
        if (descriptor) return typeof descriptor.set === 'function' || descriptor.writable === true;
        target = Object.getPrototypeOf(target);
      }
      return false;
    };
    const reflectOptions = function (element, options) {
      (element.__kniuOptionAttributes || []).forEach(function (name) { element.removeAttribute(name); });
      element.__kniuOptionAttributes = [];
      Object.entries(options || {}).forEach(function ([key, value]) {
        if (/^on[A-Z]/.test(key) || value == null || typeof value === 'function' || typeof value === 'object') return;
        // 有公开 property 的配置必须走 property setter。部分组件（例如 kniu-loading.show）
        // 不观察同名 attribute，只在 setter 内更新 Shadow DOM；若一律反射 attribute，
        // 全局 loading 会永远停留在构造时的 data-show="true"，表现为所有路由白屏。
        if (key !== 'options' && hasWritableProperty(element, key)) {
          const propertyAttribute = key.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
          // property setter 可能继续反射到 attribute；先登记为 options 内部写入，
          // 避免 attributeChangedCallback 的旧属性门禁把合法反射拦截并移除。
          element.__kniuOptionAttributes.push(propertyAttribute);
          element[key] = value;
          return;
        }
        const name = key.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
        element.__kniuOptionAttributes.push(name);
        if (value === false) element.removeAttribute(name);
        else element.setAttribute(name, value === true ? '' : String(value));
      });
    };
    Object.defineProperty(prototype, 'options', {
      configurable: true,
      get() { return ownDescriptor?.get ? ownDescriptor.get.call(this) : (this.__kniuOptions || {}); },
      set(value) {
        const options = value && typeof value === 'object' ? value : {};
        this.__kniuOptions = options;
        bindCallbacks(this, options);
        if (ownDescriptor?.set) ownDescriptor.set.call(this, options);
        else reflectOptions(this, options);
        this._sync?.();
        this._render?.();
      }
    });
    prototype.connectedCallback = function () {
      [...this.attributes].forEach((attribute) => {
        if (!allowedAttribute(attribute.name) && !(this.__kniuOptionAttributes || []).includes(attribute.name)) this.removeAttribute(attribute.name);
      });
      if (typeof originalConnected === 'function') originalConnected.call(this);
    };
    if (typeof originalAttributeChanged === 'function') {
      prototype.attributeChangedCallback = function (name, oldValue, newValue) {
        const internal = (this.__kniuOptionAttributes || []).includes(name);
        if (!allowedAttribute(name) && !internal) {
          if (this.isConnected && this.hasAttribute(name)) queueMicrotask(() => this.removeAttribute(name));
          return;
        }
        return originalAttributeChanged.call(this, name, oldValue, newValue);
      };
    }
    prototype.__kniuOptionsOnly = true;
  }

  registerButtonComponent();
  registerSwitchComponent();
  registerModalComponent();
  registerTableComponent();
  registerLoadingComponent();
  registerMsgComponent();
  registerSelectComponent();
  registerRadioGroupComponent();
  registerPageComponent();
  registerImageComponent();
  registerInputComponent();
  registerDatePickerComponent();
  registerFormComponent();
  registerUploadComponent();
  registerIconComponent();
  registerBadgeComponent();
  registerTagComponent();
  registerStatusComponent();
  registerEmptyComponent();
  registerEditorComponent();
  registerNavbarComponent();
  registerBacktopComponent();
  registerCommentComponent();
  registerIcons(KNIU_ICON_SET);
  [
    'kniu-btn', 'kniu-switch', 'kniu-modal', 'kniu-table', 'kniu-table-col', 'kniu-loading', 'kniu-msg',
    'kniu-option', 'kniu-select', 'kniu-radio', 'kniu-radio-group', 'kniu-page', 'kniu-image', 'kniu-input',
    'kniu-input-group', 'kniu-form-cell', 'kniu-date-picker', 'kniu-form', 'kniu-upload', 'kniu-icon',
    'kniu-badge', 'kniu-tag', 'kniu-status', 'kniu-empty', 'kniu-editor', 'kniu-navbar-cell',
    'kniu-sub-navbar', 'kniu-navbar', 'kniu-backtop', 'kniu-comment'
  ].forEach(installOptionsOnlyProtocol);

  return {
    state: state,
    setLoading: setLoading,
    msg: msg,
    usePagination: usePagination,
    confirm: confirm
  };
}());

export default KniuUI;
