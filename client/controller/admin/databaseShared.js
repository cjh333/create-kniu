import { getRouteQuery, getRouteContext } from '../../core/kniuutil.mjs';
export const IDENTIFIER_PATTERN = /^[A-Za-z0-9_]{1,64}$/;
export const CONNECT_REDIRECT_FLAG = 'kniu_db_connect_redirected';
export const FIELD_TYPES = [
  'BIGINT', 'INT', 'SMALLINT', 'TINYINT', 'MEDIUMINT',
  'DECIMAL', 'DOUBLE', 'FLOAT',
  'VARCHAR', 'CHAR', 'TEXT', 'LONGTEXT', 'MEDIUMTEXT', 'TINYTEXT',
  'DATETIME', 'TIMESTAMP', 'DATE', 'TIME', 'YEAR', 'JSON', 'BLOB'
];

export function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} B`;
  if (value < 1048576) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1048576).toFixed(2)} MB`;
}

export function formatCell(value) {
  if (value === null || value === undefined) return 'NULL';
  const text = String(value);
  return text === '' ? '(空串)' : text;
}

export function findDeep(tagName) {
  const stack = [document];
  while (stack.length) {
    const scope = stack.shift();
    const nodes = scope.querySelectorAll ? scope.querySelectorAll('*') : [];
    for (let i = 0; i < nodes.length; i += 1) {
      const node = nodes[i];
      if (node.tagName === tagName) return node;
      if (node.shadowRoot) stack.push(node.shadowRoot);
    }
  }
  return null;
}

export function pageRoot(tagName) {
  const host = findDeep(tagName);
  return host && host.shadowRoot ? host.shadowRoot : null;
}

export function nodeById(tagName, id) {
  const root = pageRoot(tagName);
  return root ? root.querySelector(`#${id}`) : null;
}

export function tableByRowKey(tagName, rowKey) {
  const root = pageRoot(tagName);
  if (!root) return null;
  return [...root.querySelectorAll('kniu-table')].find((table) => {
    try { return table.options && table.options.rowKey === rowKey; } catch (e) { return false; }
  }) || null;
}

export function clearNode(node) {
  while (node && node.firstChild) node.removeChild(node.firstChild);
}

export function readNativeValue(input) {
  if (typeof input.value === 'string') return input.value;
  const shadow = input.shadowRoot;
  const native = shadow ? shadow.querySelector('input, textarea') : null;
  return native ? native.value : '';
}

export function makeInput(value, extra) {
  const input = document.createElement('kniu-input');
  input.options = { name: 'field', ...(extra || {}) };
  input.value = value == null ? '' : String(value);
  return input;
}

export function makeRow(labelText, control) {
  const tag = String(control.tagName || '').toLowerCase();
  const labelBoxStyle = 'flex:0 0 100px;display:flex;align-items:center;justify-content:center;'
    + 'align-self:stretch;padding:0 12px;background-color:#f5f7fa;border:1px solid #dcdfe6;'
    + 'border-radius:4px;color:#909399;font-size:14px;white-space:nowrap;box-sizing:border-box;';
  const label = document.createElement('span');
  label.setAttribute('label-width', '100px');
  label.textContent = labelText;
  if (tag === 'kniu-input' || tag === 'kniu-switch') {
    label.setAttribute('slot', 'prepend');
    control.appendChild(label);
    return control;
  }
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:8px;';
  const fallbackLabel = document.createElement('label');
  fallbackLabel.style.cssText = labelBoxStyle;
  fallbackLabel.textContent = labelText;
  const grow = document.createElement('div');
  grow.style.cssText = 'flex:1;min-width:0;';
  grow.appendChild(control);
  row.appendChild(fallbackLabel);
  row.appendChild(grow);
  return row;
}

export const readRouteParams = getRouteQuery;

export function routeParams(getRouteData, keys) {
  return getRouteContext(getRouteData, keys);
}

export function rowAt(index, list) {
  return Array.isArray(list) && list[index] ? list[index] : null;
}