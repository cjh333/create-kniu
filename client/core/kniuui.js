import KniuTemplate from './kniutemplate.mjs';
import REQUEST from './kniurequest.mjs';
import { getResponseRecords } from './kniuutil.mjs';
import { sanitizeRichHtml } from './kniusanitize.mjs';

const { reactive } = KniuTemplate;

var KniuUI = (function () {
  var state = reactive({
    loading: false
  });
  var toastTimer = null;
  var toastInstance = null;

  // 切换路由加载态。
  function setLoading(value) {
    state.loading = !!value;
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
    const columns = Array.isArray(options.cols) ? options.cols : [];
    if (!columns.length) {
      throw new TypeError('[KniuUI] createTable() requires at least one column');
    }
    const documentRef = target.ownerDocument || document;
    const maxHeight = Number.parseInt(options.maxHeight, 10) || 0;
    const height = Number.parseInt(options.height, 10) || 0;
    let rows = Array.isArray(options.data) ? options.data : [];
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

    const style = documentRef.createElement('style');
    style.textContent = `
      :host{display:block;min-width:0}
      .kniu_sys_table_group{position:relative;overflow:hidden;background:#fff;color:#606266;font-size:14px}
      .kniu_sys_table_viewport{max-width:100%;overflow:auto}
      .kniu_sys_table{border-collapse:separate;border-spacing:0;width:100%;table-layout:fixed;background:#fff}
      .kniu_sys_table th,.kniu_sys_table td{border-bottom:1px solid #ebeef5;padding:0 10px;height:48px;box-sizing:border-box;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;background:#fff}
      .kniu_sys_table th{position:sticky;top:0;z-index:3;color:#909399;font-weight:600;background:#f5f7fa}
      .kniu_sys_table_group[data-empty="true"] thead{pointer-events:none;user-select:none}
      .kniu_sys_table_group[data-empty="true"] thead th{cursor:not-allowed!important}
      .kniu_sys_table_group[data-empty="true"] .kniu_sys_table_sort,.kniu_sys_table_group[data-empty="true"] .kniu_sys_table_selection{cursor:not-allowed}
      .kniu_sys_table tbody tr:hover td{background:#f5f7fa}
      .kniu_sys_table_group[data-stripe="true"] tbody tr:nth-child(even) td{background:#fafafa}
      .kniu_sys_table_group[data-stripe="true"] tbody tr:hover td{background:#f5f7fa}
      .kniu_sys_table_group[data-highlight-current-row="true"] tbody tr[data-current="true"] td{background:#ecf5ff}
      .kniu_sys_table_group[data-border="true"]{border:1px solid #ebeef5;border-right:0;border-bottom:0}
      .kniu_sys_table_group[data-border="true"] th,.kniu_sys_table_group[data-border="true"] td{border-right:1px solid #ebeef5}
      .kniu_sys_table_group[data-size="large"] th,.kniu_sys_table_group[data-size="large"] td{height:52px;padding:0 12px}
      .kniu_sys_table_group[data-size="small"] th,.kniu_sys_table_group[data-size="small"] td{height:40px;padding:0 8px;font-size:12px}
      .kniu_sys_table .kniu_sys_table_fixed_left,.kniu_sys_table .kniu_sys_table_fixed_right{position:sticky;z-index:2;background:#fff}
      .kniu_sys_table th.kniu_sys_table_fixed_left,.kniu_sys_table th.kniu_sys_table_fixed_right{z-index:5;background:#f5f7fa}
      .kniu_sys_table_fixed_shadow{position:absolute;top:0;bottom:0;z-index:10;display:none;pointer-events:none;box-shadow:0 0 10px rgba(0,0,0,.12)}
      .kniu_sys_table_fixed_shadow_left{left:0}
      .kniu_sys_table_fixed_shadow_right{right:0}
      .kniu_sys_table_action{border:0;padding:4px 0;background:transparent;color:#409eff;font:inherit;cursor:pointer}
      .kniu_sys_table_action:hover{color:#66b1ff}
      .kniu_sys_table_editable{cursor:text}
      .kniu_sys_table_editable:hover{background:#ecf5ff!important}
      .kniu_sys_table_edit_input{width:100%;height:32px;padding:0 8px;border:1px solid #409eff;border-radius:3px;outline:0;box-sizing:border-box;color:#606266;font:inherit}
      .kniu_sys_table_empty td{height:80px;text-align:center;color:#909399}
      .kniu_sys_table_empty:hover td{background:#fff!important;cursor:default}
      .kniu_sys_table_empty td slot[name="empty"]{display:inline-flex;flex-direction:column;align-items:center;justify-content:center;gap:8px}
      .kniu_sys_table_sort{display:inline-flex;flex-direction:column;margin-left:6px;vertical-align:middle;color:#c0c4cc;font-size:9px;line-height:7px;cursor:pointer}.kniu_sys_table_sort[data-order="ascending"] .kniu_sys_table_sort_up,.kniu_sys_table_sort[data-order="descending"] .kniu_sys_table_sort_down{color:#409eff}
      .kniu_sys_table_selection{width:14px;height:14px;accent-color:#409eff;cursor:pointer}
      .kniu_sys_table_cell_tooltip{position:relative}
      .kniu_sys_table_tooltip{position:fixed;z-index:9999;max-width:50vw;padding:8px 12px;border-radius:4px;background:rgba(48,49,51,.92);color:#fff;font-size:12px;line-height:1.5;white-space:normal;word-break:break-all;box-shadow:0 2px 12px rgba(0,0,0,.18);pointer-events:none}
      .kniu_sys_table_tooltip::after{content:"";position:absolute;width:0;height:0;border:6px solid transparent;pointer-events:none;left:var(--kniu_tip_arrow_x,50%);transform:translateX(-50%)}
      .kniu_sys_table_tooltip[data-placement="top"]::after{bottom:-12px;border-top-color:rgba(48,49,51,.92)}
      .kniu_sys_table_tooltip[data-placement="bottom"]::after{top:-12px;border-bottom-color:rgba(48,49,51,.92)}
      .kniu_sys_table_loading{position:absolute;inset:0;z-index:30;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;background:rgba(255,255,255,.9);color:#606266;opacity:0;visibility:hidden;transition:opacity .2s ease,visibility .2s ease;pointer-events:auto}
      .kniu_sys_table_loading[data-active="true"]{opacity:1;visibility:visible}
      .kniu_sys_table_loading_spinner{width:34px;height:34px;box-sizing:border-box;border:3px solid rgba(64,158,255,.25);border-top-color:#409eff;border-radius:50%;animation:kniu_sys_table_loading_spin .7s linear infinite}
      .kniu_sys_table_loading_text{font-size:13px;max-width:80%;text-align:center}
      @keyframes kniu_sys_table_loading_spin{to{transform:rotate(360deg)}}
      @media (prefers-reduced-motion:reduce){.kniu_sys_table_loading_spinner{animation:none}}
    `;
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
      return 0;
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
    target.replaceChildren(style, group, tooltip);

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
        checkbox.checked = selectedRows.has(row);
        checkbox.disabled = typeof column.selectable === 'function' && !column.selectable(row, rowIndex);
        checkbox.addEventListener('click', function (event) { event.stopPropagation(); });
        checkbox.addEventListener('change', function () {
          if (checkbox.checked) selectedRows.add(row);
          else selectedRows.delete(row);
          options.host?.dispatchEvent(new CustomEvent('selection-change', { detail: [...selectedRows], bubbles: true, composed: true }));
          render();
        });
        cell.append(checkbox);
        return;
      }
      if (column.switch) {
        const switchElement = documentRef.createElement('kniu-switch');
        Object.entries(column.switch.attributes).forEach(function ([name, value]) {
          if (value === true) switchElement.setAttribute(name, '');
          else if (value !== false && value != null && value !== '') switchElement.setAttribute(name, String(value));
        });
        switchElement.value = column.field == null ? false : row?.[column.field];
        switchElement.addEventListener('change', async function (event) {
          const previousValue = column.field == null ? undefined : row[column.field];
          if (column.field != null) row[column.field] = event.detail;
          if (typeof column.switch.onChange !== 'function') return;
          switchElement.disabled = true;
          let saved = false;
          try {
            saved = await column.switch.onChange(rowIndex, rows, event.detail) !== false;
          } finally {
            switchElement.disabled = !!column.switch.attributes.disabled;
          }
          if (!saved && column.field != null) {
            row[column.field] = previousValue;
            switchElement.value = previousValue;
          }
        });
        cell.append(switchElement);
        return;
      }
      if (Array.isArray(column.actions)) {
        column.actions.forEach(function (action, actionIndex) {
          const button = documentRef.createElement('kniu-btn');
          button.className = `kniu_sys_table_action${action.className ? ` ${action.className}` : ''}`;
          button.setAttribute('native-type', 'button');
          if (action.type) button.setAttribute('type', action.type);
          if (action.size) button.setAttribute('size', action.size);
          if (action.plain) button.setAttribute('plain', '');
          if (action.text) button.setAttribute('text', '');
          if (action.bg) button.setAttribute('bg', '');
          if (action.link) button.setAttribute('link', '');
          if (action.round) button.setAttribute('round', '');
          if (action.circle) button.setAttribute('circle', '');
          if (action.disabled) button.setAttribute('disabled', '');
          if (action.icon) button.setAttribute('icon', action.icon);
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

    function updateFixedShadowVisibility() {
      const maxScrollLeft = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
      const hasHorizontalOverflow = maxScrollLeft > 1;
      leftFixedShadow.style.display =
        fixedLeftWidth > 0 && hasHorizontalOverflow && viewport.scrollLeft > 1
          ? 'block'
          : 'none';
      rightFixedShadow.style.display =
        fixedRightWidth > 0 && hasHorizontalOverflow && viewport.scrollLeft < maxScrollLeft - 1
          ? 'block'
          : 'none';
    }

    function beginCellEdit(cell, column, row, rowIndex) {
      if (!column.editable || cell.querySelector('.kniu_sys_table_edit_input')) return;
      const oldValue = row?.[column.field];
      const input = documentRef.createElement('input');
      input.className = 'kniu_sys_table_edit_input';
      input.type = column.editType === 'number' ? 'number' : 'text';
      if (column.editType === 'number' && column.editMin != null) input.min = String(column.editMin);
      input.value = oldValue == null ? '' : String(oldValue);
      cell.replaceChildren(input);
      input.focus();
      input.select();
      let cancelled = false;
      let committed = false;
      input.addEventListener('keydown', function (event) {
        if (column.editType === 'number' && column.editMin >= 0 && event.key === '-') {
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
        const nextValue = column.editType === 'number'
          ? Math.max(column.editMin ?? Number.NEGATIVE_INFINITY, numericValue)
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
            if (column.editType === 'number') return Number(left?.[column.field] || 0) - Number(right?.[column.field] || 0);
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
        rows.sort(function (left, right) {
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
      }
      options.host?.dispatchEvent(new CustomEvent('sort-change', {
        detail: { column: column || null, field: field || '', order: order || null },
        bubbles: true, composed: true
      }));
      render();
    }

    function render() {
      if (disposed || rendering) return;
      rendering = true;
      const isEmpty = rows.length === 0;
      group.dataset.empty = String(isEmpty);
      const offsets = fixedOffsets();

      // 表头只创建一次：列配置在 table 实例生命周期内固定，避免翻页/排序时反复重建 thead 造成抖动。
      if (!headElement && options.showHeader !== false) {
        headElement = documentRef.createElement('thead');
        const headRow = documentRef.createElement('tr');
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
            sorter.dataset.order = sortState.field === column.field ? sortState.order : '';
            sorter.innerHTML = '<span class="kniu_sys_table_sort_up">▲</span><span class="kniu_sys_table_sort_down">▼</span>';
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
          headRow.append(cell);
        });
        headElement.append(headRow);
      } else if (headElement && options.showHeader !== false) {
        // head 已存在时同步表头 checkbox 列的 checked/indeterminate：setData、组件 toggleRowSelection、
        // setCurrentRow 等都会触发 render，但其不重建表头，需在此刷新以反映 selectedRows 的实时变化。
        const headerInputs = headElement.querySelectorAll('input[type="checkbox"].kniu_sys_table_selection');
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
      if (headElement) headElement.setAttribute('aria-disabled', String(isEmpty));

      const rowNodes = [];
      if (!rows.length) {
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
        rowNodes.push(emptyRow);
      } else {
        rows.forEach(function (row, rowIndex) {
          const tableRow = documentRef.createElement('tr');
          if (options.rowKey && row?.[options.rowKey] != null) {
            tableRow.dataset.rowKey = String(row[options.rowKey]);
          }
          tableRow.dataset.current = String(row === currentRow);
          tableRow.addEventListener('click', function (event) {
            if (event.target.closest?.('.kniu_sys_table_action,.kniu_sys_table_editable,.kniu_sys_table_selection,kniu-switch')) return;
            const previous = currentRow;
            currentRow = row;
            options.host?.dispatchEvent(new CustomEvent('row-click', { detail: { row: row, index: rowIndex }, bubbles: true, composed: true }));
            if (previous !== row) options.host?.dispatchEvent(new CustomEvent('current-change', { detail: { currentRow: row, oldCurrentRow: previous }, bubbles: true, composed: true }));
            if (options.highlightCurrentRow) {
              table.querySelectorAll('tbody tr[data-current="true"]').forEach(function (item) { item.dataset.current = 'false'; });
              tableRow.dataset.current = 'true';
            }
          });
          columns.forEach(function (column, index) {
            const cell = documentRef.createElement('td');
            applyColumnLayout(cell, column, index, offsets);
            appendCellContent(cell, column, row, rowIndex);
            if (column.editable) {
              cell.classList.add('kniu_sys_table_editable');
              cell.addEventListener('pointerdown', function (event) {
                const activeInput = table.querySelector('.kniu_sys_table_edit_input');
                if (!activeInput || cell.contains(activeInput)) return;
                event.preventDefault();
                pendingEdit = { row: row, column: column };
                activeInput.blur();
              });
              cell.addEventListener('click', function () { beginCellEdit(cell, column, row, rowIndex); });
            }
            tableRow.append(cell);
          });
          rowNodes.push(tableRow);
        });
      }
      // 首次渲染时创建并挂载 tbody（同时挂载缓存的 thead），后续仅原地替换行子节点，结构稳定不抖动。
      if (!bodyElement) {
        bodyElement = documentRef.createElement('tbody');
        if (options.showHeader !== false && headElement && !table.contains(headElement)) {
          table.append(headElement);
        }
        table.append(bodyElement);
      }
      bodyElement.replaceChildren(...rowNodes);

      // 按实测列宽计算固定列阴影宽度：固定列无显式宽度时取其内容实际宽度（避免强制 120 造成裁切或留白）。
      function actualColumnWidth(index) {
        const th = table.querySelector('thead')?.rows?.[0]?.cells?.[index];
        const measured = th ? th.getBoundingClientRect().width : 0;
        return measured > 0 ? measured : columnWidth(columns[index]);
      }
      fixedLeftWidth = [...offsets.left.keys()].reduce(function (width, index) {
        return width + actualColumnWidth(index);
      }, 0);
      fixedRightWidth = [...offsets.right.keys()].reduce(function (width, index) {
        return width + actualColumnWidth(index);
      }, 0);
      leftFixedShadow.style.width = `${fixedLeftWidth}px`;
      rightFixedShadow.style.width = `${fixedRightWidth}px`;

      // 右侧固定列阴影宽度保持恒定（仅等于固定列宽度），不随竖向滚动条出现/消失而改变，避免翻页抖动。
      // 滚动条为 classic 模式时，阴影 right 位置跟随滚动条宽度内缩，防止被滚动条覆盖。
      const verticalScrollbarWidth = Math.max(0, viewport.offsetWidth - viewport.clientWidth);
      rightFixedShadow.style.right = `${verticalScrollbarWidth}px`;
      updateFixedShadowVisibility();
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
      const button = event.target.closest?.('.kniu_sys_table_action');
      if (!button || !table.contains(button)) return;
      const rowIndex = Number.parseInt(button.dataset.rowIndex, 10);
      const column = columns[Number.parseInt(button.dataset.columnIndex, 10)];
      const action = column?.actions?.[Number.parseInt(button.dataset.actionIndex, 10)];
      if (!action || typeof action.onClick !== 'function') return;
      action.onClick({ row: rows[rowIndex], index: rowIndex, rows: rows, table: api });
    }

    function setData(data) {
      rows = Array.isArray(data) ? data : [];
      [...selectedRows].forEach(function (row) { if (!rows.includes(row)) selectedRows.delete(row); });
      if (currentRow && !rows.includes(currentRow)) currentRow = null;
      render();
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

    function destroy() {
      if (disposed) return;
      disposed = true;
      table.removeEventListener('click', handleAction);
      viewport.removeEventListener('scroll', updateFixedShadowVisibility);
      target.replaceChildren();
    }

    function setLoading(active, text) {
      loadingMask.setAttribute('data-active', String(!!active));
      if (text != null) loadingTextEl.textContent = String(text);
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
      doLayout: render,
      render: render,
      setLoading: setLoading,
      destroy: destroy
    };
    table.addEventListener('click', handleAction);
    viewport.addEventListener('scroll', updateFixedShadowVisibility, { passive: true });
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
        this.attachShadow({ mode: 'open' });
        this.shadowRoot.innerHTML = `<style>:host{display:inline-block;vertical-align:middle;flex-shrink:0}:host([block]){display:block;width:100%}.kniu_sys_button{--kniu-button-color:#606266;--kniu-button-bg:#fff;--kniu-button-border:#dcdfe6;--kniu-button-hover-color:#409eff;--kniu-button-hover-bg:#ecf5ff;--kniu-button-hover-border:#c6e2ff;--kniu-button-active-bg:#ecf5ff;display:inline-flex;align-items:center;justify-content:center;gap:6px;box-sizing:border-box;min-height:32px;margin:0;padding:8px 15px;border:1px solid var(--kniu-button-border);border-radius:4px;outline:0;background:var(--kniu-button-bg);color:var(--kniu-button-color);font:500 14px/1 Arial,"Microsoft YaHei",sans-serif;text-decoration:none;white-space:nowrap;cursor:pointer;user-select:none;transition:.1s}.kniu_sys_button:hover,.kniu_sys_button:focus-visible{border-color:var(--kniu-button-hover-border);background:var(--kniu-button-hover-bg);color:var(--kniu-button-hover-color)}.kniu_sys_button:active{background:var(--kniu-button-active-bg);filter:brightness(.94)}.kniu_sys_button[data-type="primary"]{--kniu-button-color:#fff;--kniu-button-bg:#409eff;--kniu-button-border:#409eff;--kniu-button-hover-color:#fff;--kniu-button-hover-bg:#79bbff;--kniu-button-hover-border:#79bbff}.kniu_sys_button[data-type="success"]{--kniu-button-color:#fff;--kniu-button-bg:#67c23a;--kniu-button-border:#67c23a;--kniu-button-hover-color:#fff;--kniu-button-hover-bg:#95d475;--kniu-button-hover-border:#95d475}.kniu_sys_button[data-type="warning"]{--kniu-button-color:#fff;--kniu-button-bg:#e6a23c;--kniu-button-border:#e6a23c;--kniu-button-hover-color:#fff;--kniu-button-hover-bg:#eebe77;--kniu-button-hover-border:#eebe77}.kniu_sys_button[data-type="danger"]{--kniu-button-color:#fff;--kniu-button-bg:#f56c6c;--kniu-button-border:#f56c6c;--kniu-button-hover-color:#fff;--kniu-button-hover-bg:#f89898;--kniu-button-hover-border:#f89898}.kniu_sys_button[data-type="info"]{--kniu-button-color:#fff;--kniu-button-bg:#909399;--kniu-button-border:#909399;--kniu-button-hover-color:#fff;--kniu-button-hover-bg:#b1b3b8;--kniu-button-hover-border:#b1b3b8}.kniu_sys_button[data-plain="true"]{--kniu-button-color:var(--kniu-button-border);--kniu-button-bg:color-mix(in srgb,var(--kniu-button-border) 10%,#fff);--kniu-button-hover-color:#fff;--kniu-button-hover-bg:var(--kniu-button-border);--kniu-button-hover-border:var(--kniu-button-border)}.kniu_sys_button[data-type="default"][data-plain="true"]{--kniu-button-color:#606266;--kniu-button-bg:#fff;--kniu-button-border:#dcdfe6;--kniu-button-hover-color:#409eff;--kniu-button-hover-bg:#ecf5ff;--kniu-button-hover-border:#c6e2ff}.kniu_sys_button[data-text="true"],.kniu_sys_button[data-link="true"]{border-color:transparent;background:transparent;color:var(--kniu-button-border)}.kniu_sys_button[data-type="default"][data-text="true"],.kniu_sys_button[data-type="default"][data-link="true"]{color:#606266}.kniu_sys_button[data-text="true"]:hover{border-color:transparent;background:#f5f7fa}.kniu_sys_button[data-text="true"][data-bg="true"]{background:#f5f7fa}.kniu_sys_button[data-text="true"][data-bg="true"]:hover{background:#e9e9eb}.kniu_sys_button[data-unstyled="true"]{border:0;background:transparent;padding:0;margin:0;min-height:0;width:100%;justify-content:flex-start;color:inherit;font:inherit;border-radius:0}.kniu_sys_button[data-link="true"]{height:auto;min-height:0;padding:2px}.kniu_sys_button[data-link="true"]:hover,.kniu_sys_button[data-link="true"]:focus-visible{border-color:transparent;background:transparent;filter:brightness(.8)}.kniu_sys_button[data-size="large"]{min-height:40px;padding:12px 19px;font-size:14px}.kniu_sys_button[data-size="small"]{min-height:24px;padding:5px 11px;font-size:12px}.kniu_sys_button[data-round="true"]{border-radius:999px}.kniu_sys_button[data-circle="true"]{width:32px;height:32px;padding:0;border-radius:50%}.kniu_sys_button[data-circle="true"][data-size="large"]{width:40px;height:40px}.kniu_sys_button[data-circle="true"][data-size="small"]{width:24px;height:24px}.kniu_sys_button:disabled{border-color:#e4e7ed;background:#fff;color:#a8abb2;cursor:not-allowed;filter:none;opacity:.6}.kniu_sys_button[data-block="true"]{width:100%}.kniu_sys_button_icon:empty{display:none}.kniu_sys_button_loading{display:none;width:12px;height:12px;box-sizing:border-box;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:kniu_sys_button_spin .8s linear infinite}.kniu_sys_button_loading[class]:not([class="kniu_sys_button_loading"]){border:0;animation:none}.kniu_sys_button[data-loading="true"] .kniu_sys_button_loading{display:inline-block}.kniu_sys_button_label[data-auto-space="true"]{letter-spacing:.25em;margin-right:-.25em}@keyframes kniu_sys_button_spin{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){.kniu_sys_button_loading{animation:none}}</style><button class="kniu_sys_button" type="button"><span class="kniu_sys_button_loading" aria-hidden="true"></span><i class="kniu_sys_button_icon" aria-hidden="true"></i><span class="kniu_sys_button_label"><slot></slot></span></button>`;
        this._button = this.shadowRoot.querySelector('.kniu_sys_button');
        this._bindButton();
        this.shadowRoot.querySelector('slot').addEventListener('slotchange', () => this._syncAutoSpace());
        const iconStyle = document.createElement('style');
        iconStyle.textContent = '.kniu_sys_button_icon{display:inline-flex;align-items:center;justify-content:center}.kniu_sys_button_icon svg{display:block;width:1em;height:1em;fill:currentColor;overflow:visible}';
        this.shadowRoot.appendChild(iconStyle);
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
      static get observedAttributes() {
        return ['disabled', 'width', 'active-icon-class', 'inactive-icon-class', 'active-text', 'inactive-text', 'active-value', 'inactive-value', 'active-color', 'inactive-color', 'name', 'validate-event'];
      }
      constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this._value = false;
        this._activeValue = undefined;
        this._inactiveValue = undefined;
        this.shadowRoot.innerHTML = `<style>:host{display:inline-block;vertical-align:middle;flex-shrink:0}.kniu_sys_switch_group{display:flex;width:100%;align-items:stretch}.kniu_sys_switch_content{flex:1;min-width:0;display:flex;align-items:center;justify-content:flex-start;padding:0 12px;background:#fff;box-sizing:border-box}.kniu_sys_switch_affix{display:none;align-items:center;justify-content:center;flex:none;padding:0 20px;border:1px solid #dcdfe6;background:#f5f7fa;color:#909399;font-size:14px;line-height:38px;text-align:center;white-space:nowrap;box-sizing:border-box}.kniu_sys_switch_group[data-affix="true"] .kniu_sys_switch_content{border:1px solid #dcdfe6}.kniu_sys_switch_group[data-has-prepend="true"] .kniu_sys_switch_prepend{display:flex;border-right:0;border-radius:4px 0 0 4px}.kniu_sys_switch_group[data-has-prepend="true"] .kniu_sys_switch_content{border-radius:0 4px 4px 0}.kniu_sys_switch_group[data-has-append="true"] .kniu_sys_switch_append{display:flex;border-left:0;border-radius:0 4px 4px 0}.kniu_sys_switch_group[data-affix="true"]{height:40px}.kniu_sys_switch_group:not([data-affix="true"]) .kniu_sys_switch_content{padding:0;background:transparent}.kniu_sys_switch{position:relative;display:inline-flex;align-items:center;gap:8px;color:#303133;font-size:14px;line-height:20px;cursor:pointer;user-select:none}.kniu_sys_switch_input{position:absolute;width:0;height:0;opacity:0}.kniu_sys_switch_core{position:relative;display:inline-block;box-sizing:border-box;height:20px;border:1px solid transparent;border-radius:10px;background:#c0ccda;outline:0;transition:border-color .3s,background-color .3s}.kniu_sys_switch_button{position:absolute;top:1px;left:1px;width:16px;height:16px;border-radius:50%;background:#fff;transition:transform .3s}.kniu_sys_switch[data-active="true"] .kniu_sys_switch_button{transform:translateX(var(--kniu-switch-distance))}.kniu_sys_switch_text{white-space:nowrap}.kniu_sys_switch_icon{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px}.kniu_sys_switch_icon:empty{display:none}.kniu_sys_switch[data-disabled="true"]{opacity:.6;cursor:not-allowed}.kniu_sys_switch_input:focus-visible+.kniu_sys_switch_core{outline:2px solid rgba(64,158,255,.35);outline-offset:2px}</style><div class="kniu_sys_switch_group" data-affix="false" data-has-prepend="false" data-has-append="false"><span class="kniu_sys_switch_affix kniu_sys_switch_prepend"><slot name="prepend"></slot></span><div class="kniu_sys_switch_content"><label class="kniu_sys_switch" data-active="false" data-disabled="false"><span class="kniu_sys_switch_text kniu_sys_switch_inactive_text"></span><input class="kniu_sys_switch_input" type="checkbox"><span class="kniu_sys_switch_core"><span class="kniu_sys_switch_button"></span><i class="kniu_sys_switch_icon"></i></span><span class="kniu_sys_switch_text kniu_sys_switch_active_text"></span></label></div><span class="kniu_sys_switch_affix kniu_sys_switch_append"><slot name="append"></slot></span></div>`;
        this._root = this.shadowRoot.querySelector('.kniu_sys_switch');
        this._input = this.shadowRoot.querySelector('.kniu_sys_switch_input');
        this._core = this.shadowRoot.querySelector('.kniu_sys_switch_core');
        this._icon = this.shadowRoot.querySelector('.kniu_sys_switch_icon');
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
        return this.hasAttribute('active-value') ? this.getAttribute('active-value') : true;
      }
      set activeValue(value) { this._activeValue = value; this._sync(); }
      get inactiveValue() {
        if (this._inactiveValue !== undefined) return this._inactiveValue;
        return this.hasAttribute('inactive-value') ? this.getAttribute('inactive-value') : false;
      }
      set inactiveValue(value) { this._inactiveValue = value; this._sync(); }
      get value() { return this._value; }
      set value(value) { this._value = value; this._sync(); }
      get disabled() { return this.hasAttribute('disabled'); }
      set disabled(value) { this.toggleAttribute('disabled', !!value); }
      focus() { this._input.focus(); }
      _isActive() { return this._value === this.activeValue || String(this._value) === String(this.activeValue); }
      _sync() {
        const active = this._isActive();
        const disabled = this.hasAttribute('disabled');
        const width = Math.max(20, Number.parseInt(this.getAttribute('width'), 10) || 40);
        this._root.dataset.active = String(active);
        this._root.dataset.disabled = String(disabled);
        this._input.checked = active;
        this._input.disabled = disabled;
        this._input.name = this.getAttribute('name') || '';
        this._core.style.width = `${width}px`;
        this._core.style.backgroundColor = active ? (this.getAttribute('active-color') || '#409EFF') : (this.getAttribute('inactive-color') || '#C0CCDA');
        this._root.style.setProperty('--kniu-switch-distance', `${width - 20}px`);
        const iconClass = active ? (this.getAttribute('active-icon-class') || '') : (this.getAttribute('inactive-icon-class') || '');
        this._icon.className = `kniu_sys_switch_icon${iconClass ? ` ${iconClass}` : ''}`;
        this.shadowRoot.querySelector('.kniu_sys_switch_active_text').textContent = this.hasAttribute('active-icon-class') ? '' : (this.getAttribute('active-text') || '');
        this.shadowRoot.querySelector('.kniu_sys_switch_inactive_text').textContent = this.hasAttribute('inactive-icon-class') ? '' : (this.getAttribute('inactive-text') || '');
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
      + '.kniu_modal_mask{position:absolute;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;animation:kniu_modal_mask_in .25s ease both}'
      + '.kniu_modal_dialog{position:relative;width:var(--kniu-modal-width,520px);max-width:100%;background:#fff;border-radius:6px;box-shadow:0 2px 12px rgba(0,0,0,.18);display:flex;flex-direction:column;max-height:90vh;overflow:hidden;animation:kniu_modal_box_in .25s cubic-bezier(.25,.8,.25,1) both}'
      + '.kniu_modal_header{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid #ebeef5;font-size:16px;font-weight:600;color:#303133;flex:none}'
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
      + '.kniu_modal_mask{position:absolute;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;animation:kniu_modal_mask_in .25s ease both}'
      + '.kniu_modal_dialog{position:relative;width:var(--kniu-modal-width,420px);max-width:100%;background:#fff;border-radius:4px;box-shadow:0 2px 12px rgba(0,0,0,.1);display:flex;flex-direction:column;overflow:hidden;animation:kniu_modal_box_in .25s cubic-bezier(.25,.8,.25,1) both}'
      + '.kniu_modal_header{position:relative;padding:15px 15px 10px;flex:none}'
      + '.kniu_modal_confirm_title{margin:0;padding-right:30px;color:#303133;font-size:18px;font-weight:400;line-height:1}'
      + '.kniu_modal_close{position:absolute;top:-2px;right:6px;width:32px;height:32px;padding:0;border:0;background:transparent;color:#909399;font-size:24px;line-height:32px;cursor:pointer}'
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
      + '<div class="kniu_modal_header"><h4 class="kniu_modal_confirm_title"></h4><button class="kniu_modal_close" type="button" aria-label="关闭">×</button></div>'
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
        this.attachShadow({ mode: 'open' });
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
        if (!maskOn) { maskEl.style.background = 'transparent'; return; }
        const alpha = parseFloat(this.getAttribute('mask-alpha'));
        const a = isNaN(alpha) ? 0.6 : Math.min(1, Math.max(0, alpha));
        maskEl.style.background = 'rgba(0,0,0,' + a + ')';
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
    else modal.style.setProperty('--kniu-modal-width', '420px');
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
      static get observedAttributes() {
        return ['height', 'max-height', 'stripe', 'border', 'size', 'fit', 'show-header', 'highlight-current-row', 'row-key', 'empty-text'];
      }
      constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this._config = {};
        this._table = null;
        this._columns = [];
        this._columnDefinitionsCleared = false;
        this._loading = false;
        this._loadingText = '';
      }

      connectedCallback() {
        queueMicrotask(() => {
          if (this.isConnected) this._renderTable();
        });
      }

      attributeChangedCallback() {
        if (this.isConnected) this._renderTable();
      }

      disconnectedCallback() {
        this._destroyTable();
      }

      set config(value) {
        this._config = value && typeof value === 'object' ? value : null;
        if (this.isConnected) this._renderTable();
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

      set data(value) {
        if (!this._config) this._config = {};
        this._config.data = Array.isArray(value) ? value : [];
        if (this._table) this._table.setData(this._config.data);
        else if (this.isConnected) this._renderTable();
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
        const columnElements = [...this.querySelectorAll(':scope > kniu-table-col')];
        if (!columnElements.length) return;
        this._columns = columnElements.map((element) => {
          const fixedAttribute = element.getAttribute('fixed');
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
            editable: element.hasAttribute('editable'),
            editType: element.getAttribute('edit-type') || 'text',
            editMin: element.hasAttribute('edit-min') ? Number(element.getAttribute('edit-min')) : null,
            onChange: (...args) => {
              if (typeof element.onChange === 'function') return element.onChange(...args);
              return true;
            },
            fixed: element.hasAttribute('fixed')
              ? (String(fixedAttribute).toLowerCase() === 'right' ? 'right' : 'left')
              : false
          };
          const template = element.querySelector('template');
          const buttons = [
            ...element.querySelectorAll(':scope > kniu-btn'),
            ...(template ? template.content.querySelectorAll('kniu-btn') : [])
          ];
          const switchElement = element.querySelector(':scope > kniu-switch')
            || template?.content.querySelector('kniu-switch');
          if (switchElement) {
            const attributeNames = ['disabled', 'width', 'active-icon-class', 'inactive-icon-class', 'active-text', 'inactive-text', 'active-value', 'inactive-value', 'active-color', 'inactive-color', 'name', 'validate-event'];
            column.switch = {
              attributes: Object.fromEntries(attributeNames
                .filter(function (name) { return switchElement.hasAttribute(name); })
                .map(function (name) {
                  const value = switchElement.getAttribute(name);
                  return [name, value === '' ? true : value];
                })),
              onChange: (index, rows, value) => {
                const handler = switchElement.__kniuTableScopedHandler;
                if (typeof handler === 'function') return handler(index, rows, value);
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
      }

      _destroyTable() {
        if (!this._table) return;
        this._table.destroy();
        this._table = null;
      }

      _renderTable() {
        this._readColumns();
        const columns = this._columns.length ? this._columns : this._config?.cols;
        if (!Array.isArray(columns) || !columns.length) return;
        this._destroyTable();
        this._table = createTable({
          ...this._config,
          cols: columns,
          data: this.data,
          host: this,
          height: this.getAttribute('height'),
          maxHeight: this.getAttribute('max-height') || this.style.maxHeight,
          stripe: this.hasAttribute('stripe'),
          border: this.hasAttribute('border'),
          size: this.getAttribute('size') || 'default',
          fit: this.getAttribute('fit') !== 'false',
          showHeader: this.getAttribute('show-header') !== 'false',
          highlightCurrentRow: this.hasAttribute('highlight-current-row'),
          rowKey: this.getAttribute('row-key') || '',
          emptyText: this.hasAttribute('empty-text') ? (this.getAttribute('empty-text') || '') : '暂无数据',
          emptySlot: !!this.querySelector('[slot="empty"]'),
          loading: this._loading,
          loadingText: this._loadingText,
          el: this.shadowRoot
        });
      }

      clearSelection() { return this._table?.clearSelection(); }
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
        this.attachShadow({ mode: 'open' });
        this._show = false;
        this.shadowRoot.innerHTML = `<style>:host{display:contents}.kniu_sys_loading_mask{position:fixed;inset:0;z-index:50;display:grid;place-items:center;opacity:0;visibility:hidden;transition:opacity .2s ease,visibility .2s ease;backdrop-filter:blur(2px);background:rgba(255,255,255,.6)}.kniu_sys_loading_mask[data-show="true"]{opacity:1;visibility:visible}.kniu_sys_loading_spinner{width:38px;height:38px;border:3px solid rgba(102,126,234,.25);border-top-color:#667eea;border-radius:50%;animation:kniu_sys_loading_spin .7s linear infinite}@keyframes kniu_sys_loading_spin{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){.kniu_sys_loading_spinner{animation:none}}</style><div class="kniu_sys_loading_mask" data-show="false" role="status" aria-label="加载中"><span class="kniu_sys_loading_spinner"></span></div>`;
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

  function registerToastComponent() {
    if (typeof customElements === 'undefined' || typeof HTMLElement === 'undefined') return;
    if (customElements.get('kniu-msg')) return;
    class KniuSysToast extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this._message = '';
        this._type = 'info';
        this._visible = false;
        this.shadowRoot.innerHTML = `<style>:host{display:contents}.kniu_sys_toast{position:fixed;right:28px;bottom:28px;z-index:60;padding:14px 18px;border:1px solid #ebeef5;border-radius:4px;opacity:0;pointer-events:none;transform:translateY(12px);background:#edf2fc;color:#909399;transition:.25s;box-shadow:0 12px 40px rgba(23,33,59,.18)}.kniu_sys_toast[data-type="success"]{border-color:#e1f3d8;background:#f0f9eb;color:#67c23a}.kniu_sys_toast[data-type="warning"]{border-color:#faecd8;background:#fdf6ec;color:#e6a23c}.kniu_sys_toast[data-type="error"]{border-color:#fde2e2;background:#fef0f0;color:#f56c6c}.kniu_sys_toast[data-visible="true"]{opacity:1;transform:none}</style><div class="kniu_sys_toast" data-visible="false" data-type="info" role="status" aria-live="polite"></div>`;
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

  // 服务端分页所需的响应式 state 初始字段。
  function paginationState(pageRows = 10) {
    return {
      currentPage: 1,
      pageRows,
      pageTotal: 1,
      total: 0,
      pageList: []
    };
  }

  // 服务端分页控制器：对接后端列表接口，返回 loadList/changePage/prevPage/nextPage/changePageSize。
  function usePagination(options) {
    const { state, self, url, field = 'id', sort = 'asc' } = options;
    if (!state || !self || !url) {
      throw new Error('usePagination 需要 state、self、url 三个参数');
    }

    async function loadList(page) {
      const targetPage = Math.min(Math.max(Number(page) || 1, 1), state.pageTotal || 1);
      state.loading = true;
      await REQUEST({
        url,
        type: 'POST',
        data: {
          page_current: targetPage,
          page_rows: state.pageRows,
          field,
          sort
        },
        success(res) {
          if (res.status !== 1) {
            state.error = res.msg || '加载失败';
            state.loading = false;
            self.$msg({ content: state.error, type: 'error' });
            return;
          }
          const payload = res.data || {};
          state.list = getResponseRecords(payload);
          state.currentPage = payload.page_current || 1;
          state.pageTotal = payload.page_total || 1;
          state.total = payload.total || 0;
          state.pageList = buildPageList(state.currentPage, state.pageTotal);
          state.loading = false;
        },
        fail(res) {
          state.loading = false;
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

    function prevPage() {
      if (state.currentPage > 1) loadList(state.currentPage - 1);
    }

    function nextPage() {
      if (state.currentPage < state.pageTotal) loadList(state.currentPage + 1);
    }

    function changePageSize(event) {
      const size = (event?.detail?.size ?? Number(event && event.target ? event.target.value : state.pageRows)) || 10;
      if (size === state.pageRows) return;
      state.pageRows = size;
      state.currentPage = 1;
      loadList(1);
    }

    return { loadList, changePage, prevPage, nextPage, changePageSize };
  }

  function registerPageComponent() {
    if (typeof customElements === 'undefined' || typeof HTMLElement === 'undefined') return;
    if (customElements.get('kniu-page')) return;

    const LAYOUT_ALIASES = {
      total: 'total', 总数: 'total',
      first: 'first', 首页: 'first',
      prev: 'prev', 上一页: 'prev',
      pager: 'pager', 页码: 'pager',
      next: 'next', 下一页: 'next',
      last: 'last', 末页: 'last', 尾页: 'last',
      sizes: 'sizes', 条数: 'sizes'
    };

    class KniuSysPage extends HTMLElement {
      static get observedAttributes() {
        return ['total', 'page-size', 'current-page', 'layout', 'background', 'prev-text', 'next-text', 'first-text', 'last-text'];
      }

      constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this._total = 0;
        this._pageSize = 10;
        this._baseSize = 10;        // 下拉步长基数（来自 controller 的 paginationState(n)），首次有效 pageSize 锁定后不再变
        this._baseSizeLocked = false;
        this._currentPage = 1;
        this._layout = 'total,prev,pager,next,sizes';
        this._background = false;
        this._firstText = '';
        this._prevText = '';
        this._nextText = '';
        this._lastText = '';
        this._sizes = [10, 20, 50, 100];
        this.shadowRoot.innerHTML = `
          <style>
            :host{display:block}
            .kniu_sys_page{display:flex;align-items:center;flex-wrap:wrap;gap:6px;margin-top:16px;font-size:13px;color:#606266}
            .kniu_sys_page[hidden]{display:none}
            .kniu_sys_page_total{margin-right:8px}
            .kniu_sys_page_pager{display:flex;align-items:center;flex-wrap:wrap;gap:6px}
            .kniu_sys_page_btn{min-width:30px;height:30px;padding:0 8px;border:1px solid #dcdfe6;border-radius:4px;background:#fff;color:#606266;cursor:pointer;font-size:13px;font-family:inherit;transition:all .2s}
            .kniu_sys_page_btn:hover:not([disabled]):not(.is-active){color:#409eff;border-color:#c6e2ff}
            .kniu_sys_page_btn.is-active{color:#fff;background:#409eff;border-color:#409eff;cursor:default}
            .kniu_sys_page_btn[disabled]{color:#c0c4cc;cursor:not-allowed;background:#fff}
            .kniu_sys_page_btn[data-background="true"]:not(.is-active):not([disabled]){background:#f4f4f5}
            .kniu_sys_page_sizes{height:30px;border:1px solid #dcdfe6;border-radius:4px;padding:0 8px;margin-left:12px;font-size:13px;color:#606266;background:#fff;cursor:pointer;font-family:inherit}
          </style>
          <div class="kniu_sys_page" hidden>
            <span class="kniu_sys_page_total">共 0 条</span>
            <button class="kniu_sys_page_btn kniu_sys_page_first" type="button">首页</button>
            <button class="kniu_sys_page_btn kniu_sys_page_prev" type="button">上一页</button>
            <span class="kniu_sys_page_pager"></span>
            <button class="kniu_sys_page_btn kniu_sys_page_next" type="button">下一页</button>
            <button class="kniu_sys_page_btn kniu_sys_page_last" type="button">末页</button>
            <select class="kniu_sys_page_sizes"></select>
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
        this._firstEl.addEventListener('click', () => this._goto(1));
        this._prevEl.addEventListener('click', () => this._goto(this._currentPage - 1));
        this._nextEl.addEventListener('click', () => this._goto(this._currentPage + 1));
        this._lastEl.addEventListener('click', () => this._goto(this._pageTotal()));
        this._sizesEl.addEventListener('change', () => this._emit('size-change', { size: Number(this._sizesEl.value) || 10 }));
      }

      connectedCallback() { this._sync(); }
      attributeChangedCallback() { if (this._root) this._sync(); }

      get total() { return this._total; }
      set total(value) { this._total = Math.max(0, Number(value) || 0); this._sync(); }
      get pageSize() { return this._pageSize; }
      set pageSize(value) {
        this._pageSize = Math.max(1, Number(value) || 10);
        if (!this._baseSizeLocked) {
          this._baseSize = this._pageSize;
          this._baseSizeLocked = true;
        }
        // 走 _render 而非 _sync：避免 _sync 的 attribute 路径用旧字面量回写刚被 setter 更新的 _pageSize
        this._render();
      }
      get currentPage() { return this._currentPage; }
      set currentPage(value) { this._currentPage = Math.max(1, Number(value) || 1); this._sync(); }

      _parseLayout() {
        const raw = this.getAttribute('layout') || this._layout;
        return raw.split(/[,，]/).map(function (item) { return LAYOUT_ALIASES[item.trim()] || item.trim(); }).filter(Boolean);
      }

      _sync() {
        const totalAttr = this.getAttribute('total');
        this._total = (totalAttr === null || totalAttr.includes('{{')) ? this._total : Math.max(0, Number(totalAttr) || 0);
        const pageSizeAttr = this.getAttribute('page-size');
        if (pageSizeAttr !== null && !pageSizeAttr.includes('{{')) {
          const next = Math.max(1, Number(pageSizeAttr) || 10);
          this._pageSize = next;
          if (!this._baseSizeLocked) {
            this._baseSize = next;
            this._baseSizeLocked = true;
          }
        }
        const currentPageAttr = this.getAttribute('current-page');
        this._currentPage = (currentPageAttr === null || currentPageAttr.includes('{{')) ? this._currentPage : Math.max(1, Number(currentPageAttr) || 1);
        this._layout = this.getAttribute('layout') || this._layout;
        this._background = this.hasAttribute('background');
        this._firstText = this.getAttribute('first-text') || this._firstText || '首页';
        this._prevText = this.getAttribute('prev-text') || this._prevText || '上一页';
        this._nextText = this.getAttribute('next-text') || this._nextText || '下一页';
        this._lastText = this.getAttribute('last-text') || this._lastText || '末页';
        this._render();
      }

      _pageTotal() {
        return Math.max(1, Math.ceil(this._total / this._pageSize));
      }

      _buildSizes() {
        // 基数由 controller 的 paginationState(n) 一次性锁定（首次有效 pageSize），
        // 下拉永远是它的 1..5 倍。未满 100 追加 100 作上限。若当前 pageSize 不在序列里，临时补一个。
        const base = this._baseSize;
        const arr = [];
        for (let i = 1; i <= 5; i++) arr.push(base * i);
        if (arr[arr.length - 1] < 100) arr.push(100);
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

        // 仅一页（含 0 条数据）时隐藏整个分页组件
        if (pageTotal <= 1) {
          this._root.hidden = true;
          return;
        }
        this._root.hidden = false;

        this._totalEl.textContent = `共 ${total} 条`;
        this._firstEl.textContent = this._firstText;
        this._prevEl.textContent = this._prevText;
        this._nextEl.textContent = this._nextText;
        this._lastEl.textContent = this._lastText;
        this._firstEl.disabled = current <= 1;
        this._prevEl.disabled = current <= 1;
        this._nextEl.disabled = current >= pageTotal;
        this._lastEl.disabled = current >= pageTotal;
        this._firstEl.dataset.background = String(this._background);
        this._prevEl.dataset.background = String(this._background);
        this._nextEl.dataset.background = String(this._background);
        this._lastEl.dataset.background = String(this._background);

        // 下拉选项为 page-size 的倍数（×1..×5），未满 100 时追加 100 作为上限
        const sizes = this._buildSizes();
        this._sizesEl.replaceChildren();
        sizes.forEach((s) => {
          const opt = document.createElement('option');
          opt.value = String(s);
          opt.textContent = s + ' 条/页';
          this._sizesEl.appendChild(opt);
        });
        this._sizesEl.value = String(pageSize);

        // 清空 pager
        this._pagerEl.replaceChildren();
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
          self._pagerEl.append(btn);
        });

        // 按 layout 顺序排列子元素
        const orderMap = { total: this._totalEl, first: this._firstEl, prev: this._prevEl, pager: this._pagerEl, next: this._nextEl, last: this._lastEl, sizes: this._sizesEl };
        layout.forEach(function (key) {
          const el = orderMap[key];
          if (el) {
            el.style.display = '';
            self._root.append(el);
          }
        });
        Object.keys(orderMap).forEach(function (key) {
          if (!layout.includes(key)) orderMap[key].style.display = 'none';
        });
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
        this.attachShadow({ mode: 'open' });
        this._fit = 'fill';
        this.shadowRoot.innerHTML = `<style>:host{display:inline-block;vertical-align:middle;overflow:hidden;flex-shrink:0}.kniu_sys_image_group{display:flex;width:100%;align-items:stretch}.kniu_sys_image_content{position:relative;flex:1;min-width:0;display:flex;align-items:center;justify-content:flex-start;padding:0 12px;background:#fff;box-sizing:border-box;overflow:hidden}.kniu_sys_image_affix{display:none;align-items:center;justify-content:center;flex:none;padding:0 20px;border:1px solid #dcdfe6;background:#f5f7fa;color:#909399;font-size:14px;line-height:38px;text-align:center;white-space:nowrap;box-sizing:border-box}.kniu_sys_image_group[data-affix="true"] .kniu_sys_image_content{border:1px solid #dcdfe6}.kniu_sys_image_group[data-has-prepend="true"] .kniu_sys_image_prepend{display:flex;border-right:0;border-radius:4px 0 0 4px}.kniu_sys_image_group[data-has-prepend="true"] .kniu_sys_image_content{border-radius:0 4px 4px 0}.kniu_sys_image_group[data-has-append="true"] .kniu_sys_image_append{display:flex;border-left:0;border-radius:0 4px 4px 0}.kniu_sys_image_group[data-affix="true"]{height:40px}.kniu_sys_image_group:not([data-affix="true"]) .kniu_sys_image_content{padding:0;background:transparent}.kniu_sys_image_wrap{position:relative;width:100%;height:100%;overflow:hidden;background:#f5f7fa}.kniu_sys_image{display:block;width:100%;height:100%}.kniu_sys_image_status{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:#f5f7fa;color:#909399;font-size:12px}.kniu_sys_image_status[data-hidden="true"]{display:none}</style><div class="kniu_sys_image_group" data-affix="false" data-has-prepend="false" data-has-append="false"><span class="kniu_sys_image_affix kniu_sys_image_prepend"><slot name="prepend"></slot></span><div class="kniu_sys_image_content"><div class="kniu_sys_image_wrap"><img class="kniu_sys_image"><span class="kniu_sys_image_status">加载中…</span></div></div><span class="kniu_sys_image_affix kniu_sys_image_append"><slot name="append"></slot></span></div>`;
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
        this._fit = ['fill', 'contain', 'cover', 'none', 'scale-down'].includes(value) ? value : 'fill';
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
        static get observedAttributes() { return ['type', 'name', 'placeholder', 'autocomplete', 'maxlength', 'rows', 'disabled', 'readonly', 'required', 'show-password', 'clearable']; }
        constructor() {
          super();
          this.attachShadow({ mode: 'open' });
          this.shadowRoot.innerHTML = `<style>:host{display:block;width:100%}.kniu_sys_input_group{display:flex;width:100%;height:40px}.kniu_sys_input_wrap{position:relative;display:block;flex:1;min-width:0}.kniu_sys_input{display:block;width:100%;height:40px;padding:0 12px;border:1px solid #dcdfe6;border-radius:4px;outline:0;background:#fff;color:#606266;font:14px/40px Arial,"Microsoft YaHei",sans-serif;box-sizing:border-box;transition:border-color .2s}.kniu_sys_input::placeholder{color:#c0c4cc}.kniu_sys_input:hover{border-color:#c0c4cc}.kniu_sys_input:focus{position:relative;z-index:1;border-color:#409eff}.kniu_sys_input:disabled{background:#f5f7fa;color:#c0c4cc;cursor:not-allowed}.kniu_sys_input_affix{display:none;align-items:center;justify-content:center;flex:none;padding:0 20px;border:1px solid #dcdfe6;background:#f5f7fa;color:#909399;font-size:14px;line-height:38px;text-align:center;white-space:nowrap;box-sizing:border-box}.kniu_sys_input_group[data-has-prepend="true"] .kniu_sys_input_prepend{display:flex;border-right:0;border-radius:4px 0 0 4px}.kniu_sys_input_group[data-has-append="true"] .kniu_sys_input_append{display:flex;border-left:0;border-radius:0 4px 4px 0}.kniu_sys_input_group[data-has-prepend="true"] .kniu_sys_input{border-radius:0 4px 4px 0}.kniu_sys_input_group[data-has-append="true"] .kniu_sys_input{border-radius:4px 0 0 4px}.kniu_sys_input_group[data-has-prepend="true"][data-has-append="true"] .kniu_sys_input{border-radius:0}</style><span class="kniu_sys_input_group" data-has-prepend="false" data-has-append="false"><span class="kniu_sys_input_affix kniu_sys_input_prepend"><slot name="prepend"></slot></span><input class="kniu_sys_input" type="text"><span class="kniu_sys_input_affix kniu_sys_input_append"><slot name="append"></slot></span></span>`;
          const invalidStyle = document.createElement('style');
          invalidStyle.textContent = ':host([data-invalid="true"]) .kniu_sys_input,:host([data-invalid="true"]) .kniu_sys_input_affix{border-color:#f56c6c}';
          this.shadowRoot.append(invalidStyle);
          const uploadLayoutStyle = document.createElement('style');
          uploadLayoutStyle.textContent = '.kniu_sys_input_group[data-upload-append="true"]{height:auto;align-items:flex-start}.kniu_sys_input_group[data-upload-append="true"] .kniu_sys_input_wrap{display:none}.kniu_sys_input_group[data-upload-append="true"] .kniu_sys_input_append{display:block;flex:1;width:auto!important;flex-basis:auto!important;padding:0;border:0;background:transparent;line-height:normal;text-align:left}.kniu_sys_input_group[data-upload-append="true"] .kniu_sys_input_prepend{height:40px}';
          this.shadowRoot.append(uploadLayoutStyle);
          this._input = this.shadowRoot.querySelector('.kniu_sys_input');
          this._passwordVisible = false;
          const passwordStyle = document.createElement('style');
          passwordStyle.textContent = `.kniu_sys_input_wrap[data-show-password="true"] .kniu_sys_input:not(textarea),.kniu_sys_input_wrap[data-clearable="true"] .kniu_sys_input:not(textarea){padding-right:40px}.kniu_sys_input_wrap[data-show-password="true"][data-clearable="true"] .kniu_sys_input:not(textarea){padding-right:72px}.kniu_sys_input_wrap[data-clearable="true"] textarea.kniu_sys_input{padding-right:32px}.kniu_sys_input_password,.kniu_sys_input_clear{position:absolute;z-index:2;top:0;right:0;display:flex;visibility:hidden;align-items:center;justify-content:center;width:36px;height:40px;padding:0;border:0;outline:0;background:transparent;color:#c0c4cc;font-size:17px;line-height:40px;text-align:center;cursor:pointer;opacity:0;pointer-events:none}.kniu_sys_input_wrap[data-show-password="true"] .kniu_sys_input_password,.kniu_sys_input_wrap[data-clear-visible="true"] .kniu_sys_input_clear{visibility:visible;opacity:1;pointer-events:auto}.kniu_sys_input_wrap[data-show-password="true"] .kniu_sys_input_clear{right:34px}.kniu_sys_input_wrap[data-clear-visible="true"] textarea.kniu_sys_input ~ .kniu_sys_input_clear{top:8px;right:8px;width:auto;height:auto;line-height:1}.kniu_sys_input_password:hover,.kniu_sys_input_password:focus,.kniu_sys_input_clear:hover,.kniu_sys_input_clear:focus{color:#409eff}.kniu_sys_input_password[aria-disabled="true"],.kniu_sys_input_clear[aria-disabled="true"]{cursor:not-allowed;color:#dcdfe6}.kniu_sys_input_password_icon{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}`;
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
          this.shadowRoot.append(passwordStyle);
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
          const textareaStyle = document.createElement('style');
          textareaStyle.textContent = 'textarea.kniu_sys_input{height:auto;min-height:42px;padding:8px 12px;line-height:1.5;font:14px/1.5 Arial,"Microsoft YaHei",sans-serif;resize:vertical;white-space:pre-wrap;overflow:auto}.kniu_sys_input_group[data-is-textarea="true"]{height:auto;min-height:40px;align-items:stretch}.kniu_sys_input_group[data-is-textarea="true"][data-has-prepend="true"] .kniu_sys_input_prepend{align-self:flex-start;height:40px;display:flex;align-items:center;padding-top:0;padding-bottom:0;box-sizing:border-box}';
          this.shadowRoot.append(textareaStyle);
        }
        connectedCallback() {
          if (!this.hasAttribute('autocomplete')) this.setAttribute('autocomplete', 'off');
          if (!this.hasAttribute('clearable')) this.setAttribute('clearable', '');
          this._mountAffixes();
          this._sync();
          queueMicrotask(() => this._mountAffixes());
        }
        attributeChangedCallback() { if (this._input) this._sync(); }
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
          ['prepend', 'append'].forEach((name) => {
            const template = Array.from(this.children).find((child) => child.tagName === 'TEMPLATE' && child.hasAttribute(`#${name}`));
            if (!template) return;
            const content = document.createElement('span');
            content.slot = name;
            const labelWidth = template.getAttribute('label-width');
            if (labelWidth) content.dataset.labelWidth = labelWidth;
            content.append(template.content.cloneNode(true));
            template.replaceWith(content);
          });
          const group = this.shadowRoot.querySelector('.kniu_sys_input_group');
          ['prepend', 'append'].forEach((name) => {
            const content = this.querySelector(`[slot="${name}"]`);
            const affix = this.shadowRoot.querySelector(`.kniu_sys_input_${name}`);
            const labelWidth = content?.dataset.labelWidth || '';
            group.dataset[`has${name[0].toUpperCase()}${name.slice(1)}`] = String(Boolean(content));
            if (labelWidth && CSS.supports('width', labelWidth)) {
              affix.style.width = labelWidth;
              affix.style.flexBasis = labelWidth;
            } else {
              affix.style.removeProperty('width');
              affix.style.removeProperty('flex-basis');
            }
          });
          const appendContent = this.querySelector('[slot="append"]');
          group.dataset.uploadAppend = String(Boolean(appendContent && appendContent.querySelector('kniu-upload')));
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
          this.attachShadow({ mode: 'open' });
          this.shadowRoot.innerHTML = `<style>:host{display:block}.kniu_sys_input_group{display:grid;grid-template-columns:var(--kniu-label-width,80px) minmax(0,1fr);align-items:stretch;border:1px solid #dcdfe6;border-radius:4px;overflow:hidden;background:#fff}.kniu_sys_input_label{padding:0 12px;background:#f5f7fa;border-right:1px solid #dcdfe6;color:#606266;font-size:14px;line-height:1.5;text-align:right;box-sizing:border-box;min-height:40px;display:flex;align-items:center;justify-content:flex-end}.kniu_sys_input_label[data-required="true"]::before{content:"*";margin-right:4px;color:#f56c6c}.kniu_sys_input_content{display:flex;align-items:center;min-width:0;min-height:40px;padding:0 12px;background:#fff}.kniu_sys_input_group[data-position="left"] .kniu_sys_input_label{justify-content:flex-start}.kniu_sys_input_group[data-position="right"] .kniu_sys_input_label{justify-content:flex-end}.kniu_sys_input_group[data-position="top"]{grid-template-columns:minmax(0,1fr);align-items:stretch}.kniu_sys_input_group[data-position="top"] .kniu_sys_input_label{padding:0 0 8px;min-height:auto;display:block;text-align:left;background:transparent;border-right:0}.kniu_sys_input_group[data-position="top"] .kniu_sys_input_content{padding:0}.kniu_sys_input_group[data-contains-input="true"]{border:0;border-radius:0;overflow:visible;background:transparent}.kniu_sys_input_group[data-has-label="false"]{border:0;border-radius:0;overflow:visible;background:transparent;grid-template-columns:minmax(0,1fr)}.kniu_sys_input_group[data-has-label="false"] .kniu_sys_input_label{background:transparent;border-right:0}.kniu_sys_input_group[data-contains-input="true"] .kniu_sys_input_content,.kniu_sys_input_group[data-has-label="false"] .kniu_sys_input_content{padding:0;background:transparent}</style><label class="kniu_sys_input_group" data-position="right" data-has-label="false" data-contains-input="false"><span class="kniu_sys_input_content"><slot></slot></span></label>`;
        }
        connectedCallback() {
          this._sync();
          this._detectInput();
          this.shadowRoot.querySelector('slot').addEventListener('slotchange', () => this._detectInput());
          if (!this.style.marginBottom) this.style.marginBottom = '20px';
        }
        attributeChangedCallback() { if (this.shadowRoot) this._sync(); }
        _detectInput() {
          const hasControl = this.querySelector(':scope > kniu-input, :scope > kniu-image, :scope > kniu-switch, :scope > kniu-editor') != null;
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
          } else if (labelEl) {
            labelEl.remove();
          }
          if (this.hasAttribute('label-width')) this.style.setProperty('--kniu-label-width', this.getAttribute('label-width'));
        }
      }
      customElements.define('kniu-input-group', KniuSysInputGroup);
      if (!customElements.get('kniu-form-cell')) {
        class KniuSysFormCell extends KniuSysInputGroup { }
        customElements.define('kniu-form-cell', KniuSysFormCell);
      }
    }
  }

  function registerFormComponent() {
    if (typeof customElements === 'undefined' || typeof HTMLElement === 'undefined') return;
    if (customElements.get('kniu-form')) return;
    class KniuSysForm extends HTMLElement {
      static get observedAttributes() { return ['label-position', 'label-width']; }
      constructor() {
        super();
        this.style.display = 'contents';
        this._formConfig = {};
        this._mountedForm = null;
        this._hasConfig = false;
        this._submitHandler = null;
        this._data = null;
        this._rules = {};
        this._validateHandler = null;
      }
      connectedCallback() {
        queueMicrotask(() => {
          this._ensureNativeForm();
          this._syncLayout();
          this._mountForm();
        });
      }
      attributeChangedCallback() { if (this.isConnected) this._syncLayout(); }
      set model(value) { this.data = value; }
      get model() { return this.data; }
      set rules(value) { this._rules = value && typeof value === 'object' ? value : {}; }
      get rules() { return this._rules; }
      validate() {
        let valid = true;
        let firstInvalid = null;
        let firstMessage = '';
        this.querySelectorAll('kniu-input').forEach((input) => {
          const field = input.getAttribute('name') || '';
          const group = input.closest('kniu-input-group, kniu-form-cell');
          const value = String(input.value ?? '');
          const rule = this.rules ? this.rules[field] : null;
          const hasRule = rule && typeof rule === 'object' && ('condition' in rule);
          const requiredAttr = input.hasAttribute('required');
          if (!hasRule && !requiredAttr) {
            input.removeAttribute('data-invalid');
            return;
          }
          let ok = true;
          let message = '';
          if (hasRule) {
            const condition = rule.condition;
            if (condition instanceof RegExp) {
              // rules 来自响应式代理，正则可能被 Proxy 包裹，需还原为真实 RegExp 才能调用 .test()
              const re = typeof condition.source === 'string'
                ? new RegExp(condition.source, condition.flags)
                : condition;
              ok = re.test(value);
            } else if (typeof condition === 'function') {
              ok = !!condition({ value: value, field: field, input: input });
            } else {
              ok = true;
            }
            message = rule.message || `${field}格式不正确`;
          } else {
            ok = value.trim().length > 0;
            message = input.getAttribute('placeholder')
              || `${group && group.getAttribute('label') ? group.getAttribute('label') : field}不能为空`;
          }
          const invalid = !ok;
          input.toggleAttribute('data-invalid', invalid);
          if (group) group.toggleAttribute('required', hasRule || requiredAttr);
          if (invalid) {
            valid = false;
            if (!firstInvalid) { firstInvalid = input; firstMessage = message; }
          }
        });
        if (firstInvalid) {
          firstInvalid.focus();
          // 错误信息改用 $msg 全局提示，不再内联展示 kniu_sys_input_error 文本
          if (typeof this.$msg === 'function') this.$msg({ content: firstMessage, type: 'error' });
          else KniuUI.msg({ content: firstMessage, type: 'error' });
        }
        return valid;
      }
      set formConfig(value) {
        this._formConfig = value && typeof value === 'object' ? value : {};
        this._hasConfig = true;
        if (this.isConnected) this._mountForm();
      }
      get formConfig() { return this._formConfig; }
      _ensureNativeForm() {
        if (this.querySelector(':scope > form')) return;
        const form = (this.ownerDocument || document).createElement('form');
        form.className = 'kniu_sys_form_native';
        if (!form.hasAttribute('autocomplete')) form.setAttribute('autocomplete', 'off');
        while (this.firstChild) form.append(this.firstChild);
        this.append(form);
      }
      _syncLayout() {
        const position = ['left', 'right', 'top'].includes(this.getAttribute('label-position'))
          ? this.getAttribute('label-position')
          : 'right';
        const width = this.getAttribute('label-width') || '80px';
        this.querySelectorAll('kniu-input-group, kniu-form-cell').forEach(function (group) {
          if (!group.hasAttribute('label-position')) group.setAttribute('label-position', position);
          if (!group.hasAttribute('label-width')) group.setAttribute('label-width', width);
        });
      }
      _createField(field, model) {
        const documentRef = this.ownerDocument || document;
        const input = documentRef.createElement('input');
        input.name = String(field.field || '');
        input.type = field.type || 'text';
        input.value = model[field.field] == null ? '' : String(model[field.field]);
        if (field.placeholder) input.placeholder = field.placeholder;
        input.autocomplete = field.autocomplete || 'off';
        if (input.type === 'hidden') {
          input.className = 'kniu_sys_form_hidden';
          input.addEventListener('input', function () { model[field.field] = input.value; });
          return input;
        }
        input.className = `kniu_input seo_form_input1${field.required ? ' kniu_required' : ''}`;
        input.addEventListener('input', function () { model[field.field] = input.value; });

        const label = documentRef.createElement('p');
        label.className = 'kniu_input_text seo_form_text1';
        label.textContent = field.title == null ? '' : String(field.title);
        const inputGroup = documentRef.createElement('div');
        inputGroup.className = 'kniu_input_group';
        const suffix = documentRef.createElement('div');
        suffix.className = 'kniu_input_aftfix';
        const clear = documentRef.createElement('span');
        clear.className = 'kniu_icon kniu_icon_circle_close_fill kniu_icon_1d3x kniu_input_btn_clear';
        suffix.append(clear);
        inputGroup.append(input, suffix);
        const pane = documentRef.createElement('div');
        pane.className = 'kniu_label kniu_label_pane';
        pane.append(label, inputGroup);
        const cell = documentRef.createElement('li');
        cell.className = 'kniu_form_cell kniu_sys_form_cell';
        cell.append(pane);
        return cell;
      }
      _renderConfiguredForm() {
        const config = this._formConfig;
        if (!Array.isArray(config.fields)) return null;
        const documentRef = this.ownerDocument || document;
        const model = config.model && typeof config.model === 'object' ? config.model : {};
        const form = documentRef.createElement('form');
        form.className = 'kniu_form kniu_sys_form';
        if (!form.hasAttribute('autocomplete')) form.setAttribute('autocomplete', 'off');
        const group = documentRef.createElement('ul');
        group.className = 'kniu_form_inputs_group kniu_sys_form_inputs_group';
        config.fields.forEach((field) => group.append(this._createField(field, model)));

        if (config.submit !== false) {
          const cell = documentRef.createElement('li');
          cell.className = 'kniu_form_cell kniu_sys_form_cell';
          const pane = documentRef.createElement('div');
          pane.className = 'kniu_label kniu_label_pane';
          const spacer = documentRef.createElement('p');
          spacer.className = 'kniu_space kniu_input_text seo_form_text1';
          const buttonGroup = documentRef.createElement('div');
          buttonGroup.className = 'kniu_input_group';
          const button = documentRef.createElement('button');
          button.className = 'kniu_btn seo_btn seo_btn1 kniu_sys_form_submit';
          button.type = 'submit';
          button.textContent = String(config.submit?.title || '提交');
          buttonGroup.append(button);
          pane.append(spacer, buttonGroup);
          cell.append(pane);
          group.append(cell);
        }
        form.append(group);
        this.replaceChildren(form);
        this._submitHandler = async (event) => {
          event.preventDefault();
          const required = [...form.querySelectorAll('.kniu_required')];
          const invalid = required.find((input) => !String(input.value || '').trim());
          if (invalid) {
            invalid.classList.add('kniu_required_error');
            invalid.focus();
            return;
          }
          const handler = config.submit?.handler || config.onSubmit;
          if (typeof handler !== 'function') return;
          const button = form.querySelector('.kniu_sys_form_submit');
          if (button) button.disabled = true;
          try { await handler(model, event); } finally { if (button) button.disabled = false; }
        };
        form.addEventListener('submit', this._submitHandler);
        return form;
      }
      _mountForm() {
        const form = this._renderConfiguredForm() || this.querySelector('form');
        if (!form || this._mountedForm === form) return;
        form.noValidate = true;
        this._validateHandler = (event) => {
          event.preventDefault();
          if (!this.validate()) event.stopImmediatePropagation();
        };
        form.addEventListener('submit', this._validateHandler);
        const formFactory = globalThis.kniu?.form;
        if (typeof formFactory !== 'function') return;
        formFactory({ ...this._formConfig, el: form });
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
        this.attachShadow({ mode: 'open' });
        this._files = [];
        this._objectUrls = new Map();
        this.shadowRoot.innerHTML = `<style>
          :host{display:block;width:100%;color:#606266;font:14px/1.5 Arial,"Microsoft YaHei",sans-serif}.kniu_upload_bar{display:flex;align-items:stretch;width:100%;min-height:40px}.kniu_upload_hint{display:flex;flex:1;align-items:center;min-width:0;padding:0 12px;border:1px solid #dcdfe6;border-right:0;background:#f5f7fa;color:#c0c4cc;box-sizing:border-box}.kniu_upload_btn{flex:none;padding:0 20px;border:1px solid #409eff;border-radius:0 4px 4px 0;background:#409eff;color:#fff;font:inherit;cursor:pointer}.kniu_upload_btn:hover{background:#66b1ff;border-color:#66b1ff}.kniu_upload_btn:focus-visible{outline:2px solid rgba(64,158,255,.35);outline-offset:2px}.kniu_upload_btn:disabled{background:#a0cfff;border-color:#a0cfff;cursor:not-allowed}.kniu_upload_input{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}.kniu_upload_wall{display:flex;flex-wrap:wrap;gap:10px;margin-top:10px}.kniu_upload_item{position:relative;width:160px;height:160px;overflow:hidden;background:#f5f7fa}.kniu_upload_image{display:block;width:100%;height:100%;object-fit:cover}.kniu_upload_remove{position:absolute;top:8px;right:8px;display:flex;align-items:center;justify-content:center;width:22px;height:22px;padding:0;border:0;border-radius:50%;background:#aab4c4;color:#fff;font:18px/1 Arial;cursor:pointer}.kniu_upload_remove:hover{background:#f56c6c}.kniu_upload_empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;color:#c0c4cc;font-size:18px;background:linear-gradient(135deg,#f7f9fc,#f1f4fa)}.kniu_upload_empty svg{width:38px;height:38px;fill:none;stroke:currentColor;stroke-width:1.8}
        </style><div class="kniu_upload_bar"><span class="kniu_upload_hint"></span><button class="kniu_upload_btn" type="button"><slot>选择图片</slot></button><input class="kniu_upload_input" type="file"></div><div class="kniu_upload_wall" aria-live="polite"></div>`;
        this._input = this.shadowRoot.querySelector('.kniu_upload_input');
        this._button = this.shadowRoot.querySelector('.kniu_upload_btn');
        this._hint = this.shadowRoot.querySelector('.kniu_upload_hint');
        this._wall = this.shadowRoot.querySelector('.kniu_upload_wall');
        this._button.addEventListener('click', () => this._input.click());
        this._input.addEventListener('change', () => this._select(Array.from(this._input.files || [])));
        this._wall.addEventListener('click', (event) => {
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
        this._wall.replaceChildren(...previews);
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
        this.attachShadow({ mode: 'open' });
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
        this.attachShadow({ mode: 'open' });
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
        this.attachShadow({ mode: 'open' });
        this.shadowRoot.innerHTML =
          '<style>' +
          ':host{display:inline-flex;position:relative;vertical-align:middle;line-height:0;flex-shrink:0}' +
          ':host([hidden]){display:none}' +
          ':host([unstyled]){background:transparent;border:0;padding:0}' +
          '.kniu_sys_badge_indicator{position:absolute;top:0;right:0;transform:translate(50%,-50%);box-sizing:border-box;pointer-events:none;display:flex;align-items:center;justify-content:center}' +
          '.kniu_sys_badge_indicator[data-shape="dot"]{width:8px;height:8px;border-radius:50%;background:#f56c6c;border:1.5px solid #fff}' +
          '.kniu_sys_badge_indicator[data-shape="sup"]{min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:#f56c6c;color:#fff;font-size:12px;line-height:18px;font-weight:600;border:1.5px solid #fff;white-space:nowrap}' +
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

  // 空状态组件：居中展示插画 + 文案（note 属性，默认“暂无数据”），可选投影 slot 放自定义内容。
  // 与 kniu:if 配合作为列表/表格的空状态占位，替代手写 .detail_empty 这类 div。
  function registerEmptyComponent() {
    if (typeof customElements === 'undefined' || typeof HTMLElement === 'undefined') return;
    if (customElements.get('kniu-empty')) return;
    var EMPTY_SVG = '<svg viewBox="0 0 64 41" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<path d="M55 13L40 2H15a2 2 0 0 0-2 2v25c0 1.1.9 2 2 2h40a2 2 0 0 0 2-2V13z" fill="currentColor" fill-opacity="0.06"/>' +
      '<path d="M40 2v11c0 1.1.9 2 2 2h13" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>' +
      '<path d="M16 30h32" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-opacity="0.25"/>' +
      '</svg>';
    class KniuSysEmpty extends HTMLElement {
      static get observedAttributes() { return ['note']; }
      constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.shadowRoot.innerHTML =
          '<style>' +
          ':host{display:flex;flex-direction:column;align-items:center;justify-content:center;box-sizing:border-box;padding:40px 0;color:#909399;font-size:14px;line-height:1.5;text-align:center}' +
          ':host([hidden]){display:none}' +
          '.kniu_sys_empty_img{width:64px;height:41px;margin-bottom:14px;color:#C0C4CC}' +
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
    var EMOJIS = ['😀','😄','😁','😆','😅','🤣','😂','🙂','😉','😊','😍','😘','😎','🤔','🤨','😐','😴','😭','😡','👍','👎','👌','✌️','🤝','👏','💪','🙏','👀','💡','🔥','⭐','✨','🎉','❤️','💔','💯','✅','❌','⚠️','❓','❗','💬','📌','📎','🔗','🚀','📝','📅','📈','📊','☕','🍀','🌟','🎯','🏆','💻','📱','🌈','🍻'];

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
      'forecolor': '<button type="button" class="kniu_sys_editor_btn kniu_sys_editor_color_btn" data-action="forecolor" title="文字颜色" aria-label="文字颜色"><span class="kniu_sys_editor_color_letter">A</span><span class="kniu_sys_editor_color_mark" style="background:#409eff"></span><span class="kniu_sys_editor_font_arrow">▾</span></button>',
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
        this.attachShadow({ mode: 'open' });
        this.shadowRoot.innerHTML = [
          '<style>',
          ':host{display:block;width:100%}',
          '.kniu_sys_editor_group{display:flex;width:100%}',
          '.kniu_sys_editor_affix{display:none;align-items:center;justify-content:center;align-self:flex-start;flex:none;padding:0 20px;border:1px solid #dcdfe6;background:#f5f7fa;color:#909399;font-size:14px;line-height:38px;text-align:center;white-space:nowrap;box-sizing:border-box}',
          '.kniu_sys_editor_group[data-has-prepend="true"] .kniu_sys_editor_prepend{display:flex;border-right:0;border-radius:4px 0 0 4px}',
          '.kniu_sys_editor_main{position:relative;flex:1;min-width:0;display:flex;flex-direction:column;border:1px solid #dcdfe6;border-radius:4px;background:#fff;overflow:hidden}',
          '.kniu_sys_editor_group[data-has-prepend="true"] .kniu_sys_editor_main{border-radius:0 4px 4px 4px}',
          '.kniu_sys_editor_toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:2px;padding:6px 8px;border-bottom:1px solid #ebeef5;background:#f5f7fa}',
          '.kniu_sys_editor_btn{display:inline-flex;align-items:center;justify-content:center;width:32px;height:30px;padding:0;border:0;border-radius:4px;background:transparent;color:#606266;font-size:14px;font-weight:600;line-height:1;cursor:pointer;transition:background .15s,color .15s;flex:none;overflow:hidden}',
          // 工具栏内统一图标视觉占位：SVG 强制 18×18，文字图标（<b>/<i>/<u>/<s>/裸文本）至少 18×18，flex 居中
          '.kniu_sys_editor_btn > svg{width:17px;height:17px;display:block;flex:none}',
          '.kniu_sys_editor_btn[data-cmd="removeFormat"] > svg{width:20px;height:20px}',
          '.kniu_sys_editor_btn > *{font-weight:600}',
          '.kniu_sys_editor_btn > b,.kniu_sys_editor_btn > i,.kniu_sys_editor_btn > u,.kniu_sys_editor_btn > s{display:inline-flex;align-items:center;justify-content:center;height:17px;min-width:17px;min-height:17px;font-size:14px;line-height:1;font-weight:700;text-align:center;letter-spacing:0}',
          '.kniu_sys_editor_btn > :not(svg):not(b):not(i):not(u):not(s){display:inline-flex;align-items:center;justify-content:center;min-width:17px;min-height:17px;font-size:14px;line-height:1;text-align:center}',
          '.kniu_sys_editor_btn:hover{background:#ecf5ff;color:#409eff}',
          '.kniu_sys_editor_btn:active{background:#d9ecff}',
          '.kniu_sys_editor_btn[aria-pressed="true"]{background:#d9ecff;color:#409eff}',
          '.kniu_sys_editor_btn:disabled{opacity:.5;cursor:not-allowed}',
          '.kniu_sys_editor_divider{width:1px;height:20px;background:#dcdfe6;margin:5px 3px;flex:none}',
          '.kniu_sys_editor_content{min-height:200px;max-height:400px;padding:10px 14px;outline:0;overflow-y:auto;font:14px/1.7 Arial,"Microsoft YaHei",sans-serif;color:#303133;word-break:break-word;cursor:text}',
          '.kniu_sys_editor_content:empty::before{content:attr(data-placeholder);color:#c0c4cc;pointer-events:none}',
          '.kniu_sys_editor_content h1{font-size:1.6em;margin:.5em 0}',
          '.kniu_sys_editor_content h2{font-size:1.4em;margin:.5em 0}',
          '.kniu_sys_editor_content h3{font-size:1.2em;margin:.5em 0}',
          '.kniu_sys_editor_content p{margin:.3em 0}',
          '.kniu_sys_editor_content ul,.kniu_sys_editor_content ol{padding-left:2em;margin:.3em 0}',
          '.kniu_sys_editor_content blockquote{margin:.5em 0;padding:.5em 1em;border-left:4px solid #dcdfe6;background:#f9fafc;color:#606266}',
          '.kniu_sys_editor_content code{background:#f0f0f0;padding:2px 4px;border-radius:3px;font-family:Consolas,Monaco,monospace;font-size:.9em}',
          '.kniu_sys_editor_content pre{margin:.5em 0;padding:.6em 1em;background:#f6f8fa;border-radius:4px;overflow-x:auto;font-family:Consolas,Monaco,monospace;font-size:.9em;line-height:1.5}',
          '.kniu_sys_editor_content pre code{background:transparent;padding:0}',
          '.kniu_sys_editor_content a{color:#409eff;text-decoration:underline}',
          '.kniu_sys_editor_content img,.kniu_sys_editor_content video{display:block;max-width:100%;height:auto;margin:.5em 0}',
          '.kniu_sys_editor_content audio{display:block;max-width:100%;margin:.5em 0}',
          '.kniu_sys_editor_content .kniu_sys_editor_media_selected{outline:0;filter:brightness(.62) sepia(.65) saturate(5) hue-rotate(175deg);transition:filter .15s ease}',
          '.kniu_sys_editor_source{display:none;min-height:200px;max-height:400px;width:100%;padding:10px 14px;border:0;outline:0;resize:vertical;font:13px/1.6 Consolas,Monaco,monospace;color:#303133;box-sizing:border-box;background:#fbfbfc}',
          '.kniu_sys_editor_group[data-code-mode="true"] .kniu_sys_editor_content{display:none}',
          '.kniu_sys_editor_group[data-code-mode="true"] .kniu_sys_editor_source{display:block}',
          '.kniu_sys_editor_select{height:28px;max-width:120px;padding:0 4px;border:1px solid #dcdfe6;border-radius:3px;background:#fff;color:#606266;font-size:12px;cursor:pointer;flex:none;box-sizing:border-box}',
          '.kniu_sys_editor_fontname{position:relative;width:36px;padding-right:8px}',
          '.kniu_sys_editor_font_icon{font-family:Georgia,serif;font-size:15px!important;font-style:italic;font-weight:700}',
          '.kniu_sys_editor_fontsize{position:relative;width:36px;padding-right:8px}',
          '.kniu_sys_editor_size_icon{display:inline-flex!important;align-items:flex-end!important;gap:1px;font-family:Arial,sans-serif;font-size:15px!important;font-weight:600}',
          '.kniu_sys_editor_size_icon small{font-size:9px;line-height:1.2}',
          '.kniu_sys_editor_color_btn{position:relative;width:36px;padding-right:8px}',
          '.kniu_sys_editor_color_letter{font-family:Arial,sans-serif;font-size:15px!important;font-weight:500;color:#409eff}',
          '.kniu_sys_editor_color_letter_bg{padding:2px 3px;border-radius:2px;background:#ffd900;color:#222;font-size:12px!important;font-weight:700}',
          '.kniu_sys_editor_color_mark{position:absolute;left:8px;right:10px;bottom:3px;height:2px;min-width:0!important;min-height:0!important}',
          '.kniu_sys_editor_font_arrow{position:absolute;right:3px;bottom:3px;min-width:0!important;min-height:0!important;font-size:8px!important;color:#909399}',
          '.kniu_sys_editor_select:focus{outline:0;border-color:#409eff}',
          '.kniu_sys_editor_color{width:30px;height:28px;padding:0;border:1px solid #dcdfe6;border-radius:3px;background:#fff;cursor:pointer;flex:none;box-sizing:border-box}',
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
          '.kniu_sys_editor_popover{position:absolute;top:0;left:0;z-index:30;background:#fff;border:1px solid #ebeef5;border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.14);padding:12px;min-width:210px;max-width:calc(100% - 16px);overflow-x:hidden;overflow-y:auto;box-sizing:border-box}',
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
          '.kniu_sys_editor_popover_link .kniu_sys_editor_popover_row input[type="checkbox"]{flex:none;width:auto;height:auto}',
          '.kniu_sys_editor_popover_link .kniu_sys_editor_popover_row select{flex:1;height:28px;padding:0 6px;border:1px solid #dcdfe6;border-radius:4px;background:#fff;color:#606266;font-size:13px;box-sizing:border-box}',
          '.kniu_sys_editor_popover_actions{display:flex;justify-content:flex-end;gap:8px;margin:2px 0 0}',
          '.kniu_sys_editor_popover_cancel{height:30px;padding:0 14px;border:1px solid #dcdfe6;border-radius:4px;background:#fff;color:#606266;font-size:13px;cursor:pointer}',
          '.kniu_sys_editor_popover_delete{height:30px;margin-right:auto;padding:0 14px;border:1px solid #f56c6c;border-radius:4px;background:#fff;color:#f56c6c;font-size:13px;cursor:pointer}',
          '.kniu_sys_editor_popover_delete:hover{background:#fef0f0}',
          '.kniu_sys_editor_delete_tip{padding:14px 0 20px;color:#606266;font-size:14px;line-height:1.6}',
          '.kniu_sys_editor_popover_error{min-height:18px;margin:-4px 0 6px 66px;color:#f56c6c;font-size:12px}',
          '.kniu_sys_editor_popover_btn{height:30px;padding:0 14px;border:0;border-radius:4px;background:#409eff;color:#fff;font-size:13px;cursor:pointer}',
          '.kniu_sys_editor_popover_btn:hover{background:#66b1ff}',
          '.kniu_sys_editor_popover_grid{display:grid;grid-template-columns:repeat(8,1fr);gap:4px;max-height:208px;overflow:auto}',
          '.kniu_sys_editor_font_list{display:flex;flex-direction:column;width:190px;max-width:100%}',
          '.kniu_sys_editor_font_item{display:flex;align-items:center;width:100%;min-height:32px;padding:5px 10px;border:0;border-radius:4px;background:transparent;color:#303133;font-size:14px;text-align:left;cursor:pointer}',
          '.kniu_sys_editor_font_item:hover{background:#ecf5ff;color:#409eff}',
          '.kniu_sys_editor_font_item[aria-checked="true"]::before{content:"✓";width:20px;color:#409eff;font-family:Arial,sans-serif}',
          '.kniu_sys_editor_font_item[aria-checked="false"]::before{content:"";width:20px}',
          '.kniu_sys_editor_size_list{display:flex;flex-direction:column;width:130px;max-width:100%}',
          '.kniu_sys_editor_size_item{display:flex;align-items:center;width:100%;min-height:32px;padding:4px 12px;border:0;border-radius:4px;background:transparent;color:#303133;text-align:left;line-height:1.15;cursor:pointer}',
          '.kniu_sys_editor_size_item:hover{background:#ecf5ff;color:#409eff}',
          '.kniu_sys_editor_palette{width:176px}',
          '.kniu_sys_editor_no_color{display:block;width:100%;height:30px;margin-bottom:8px;border:0;border-radius:4px;background:transparent;color:#606266;font-size:13px;cursor:pointer}',
          '.kniu_sys_editor_no_color:hover{background:#ecf5ff;color:#409eff}',
          '.kniu_sys_editor_swatch_grid{display:grid;grid-template-columns:repeat(6,22px);gap:6px}',
          '.kniu_sys_editor_swatch{width:22px;height:22px;border:1px solid transparent;border-radius:2px;cursor:pointer;box-sizing:border-box}',
          '.kniu_sys_editor_swatch:hover{outline:2px solid #409eff;outline-offset:1px}',
          '.kniu_sys_editor_emoji{display:flex;align-items:center;justify-content:center;height:32px;font-size:18px;border:0;background:transparent;border-radius:6px;cursor:pointer}',
          '.kniu_sys_editor_emoji:hover{background:#ecf5ff}',
          ':host([data-preview="true"]) .kniu_sys_editor_content{background:#fafafa;cursor:default}',
          ':host([data-maximized="true"]){position:fixed;top:0;left:0;right:0;bottom:0;z-index:9999;width:auto;height:auto;background:#fff}',
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
          '<button type="button" class="kniu_sys_editor_btn kniu_sys_editor_color_btn" data-action="forecolor" title="文字颜色" aria-label="文字颜色"><span class="kniu_sys_editor_color_letter">A</span><span class="kniu_sys_editor_color_mark" style="background:#409eff"></span><span class="kniu_sys_editor_font_arrow">▾</span></button>',
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
          var blockTags = { pre:1, p:1, h1:1, h2:1, h3:1, h4:1, h5:1, h6:1, blockquote:1, div:1, li:1, dd:1, dt:1, address:1, article:1, section:1, aside:1, figure:1, figcaption:1 };
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
            return '<button type="button" class="kniu_sys_editor_swatch" data-editor-color="' + color + '" title="' + color + '" aria-label="' + color + '" style="background:' + color + '"></button>';
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
          if (mark) mark.style.background = color || '#409eff';
          if (letter) letter.style.background = color || '#ffd900';
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

  function registerIcons(set) {
    Object.keys(set || {}).forEach(function (name) {
      registerIconGlyph(name, set[name]);
    });
  }

  registerButtonComponent();
  registerSwitchComponent();
  registerModalComponent();
  registerTableComponent();
  registerLoadingComponent();
  registerToastComponent();
  registerPageComponent();
  registerImageComponent();
  registerInputComponent();
  registerFormComponent();
  registerUploadComponent();
  registerIconComponent();
  registerBadgeComponent();
  registerEmptyComponent();
  registerEditorComponent();
  registerIcons(KNIU_ICON_SET);

  return {
    state: state,
    setLoading: setLoading,
    msg: msg,
    usePagination: usePagination,
    paginationState: paginationState,
    confirm: confirm,
    registerButtonComponent: registerButtonComponent,
    registerSwitchComponent: registerSwitchComponent,
    registerModalComponent: registerModalComponent,
    registerTableComponent: registerTableComponent,
    registerLoadingComponent: registerLoadingComponent,
    registerToastComponent: registerToastComponent,
    registerPageComponent: registerPageComponent,
    registerImageComponent: registerImageComponent,
    registerIconComponent: registerIconComponent,
    registerBadgeComponent: registerBadgeComponent,
    registerEmptyComponent: registerEmptyComponent,
    registerIconGlyph: registerIconGlyph,
    registerIcons: registerIcons,
    KNIU_ICON_SET: KNIU_ICON_SET,
    registerInputComponent: registerInputComponent,
    registerFormComponent: registerFormComponent,
    registerUploadComponent: registerUploadComponent,
    registerEditorComponent: registerEditorComponent
  };
}());

export default KniuUI;
