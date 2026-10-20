import { getRouteQuery, getRouteContext } from '../../core/kniuutil.mjs';
export const IDENTIFIER_PATTERN = /^[A-Za-z0-9_]{1,64}$/;

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

export async function fetchList(request, url, data, opts) {
  const o = opts || {};
  const res = await request({ url: url, type: 'POST', mutation: false, data: data });
  if (res.status !== 1) {
    if (o.$msg) o.$msg({ content: (o.failMsg || res.msg || '读取列表失败'), type: 'error' });
    if (typeof o.onFail === 'function') o.onFail(res);
    return { ok: false, list: [] };
  }
  return { ok: true, list: (res.data && res.data.list) || [] };
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

export function tableByRowKey(tagName, rowKey) {
  const root = pageRoot(tagName);
  if (!root) return null;
  return [...root.querySelectorAll('kniu-table')].find((table) => {
    try { return table.options && table.options.rowKey === rowKey; } catch (e) { return false; }
  }) || null;
}

export const readRouteParams = getRouteQuery;

export function createSqlConsoleModel() {
  return {
    labelPosition: 'top',
    labelWidth: 'auto',
    sql: {
      value: '',
      condition: function () { return true; },
      message: ''
    }
  };
}

export function openSqlConsole(state, showKey) {
  state.sqlModel = { ...state.sqlModel, sql: { ...state.sqlModel.sql, value: '' } };
  state.sqlResultText = '';
  state[showKey] = true;
}

export function routeParams(getRouteData, keys) {
  return getRouteContext(getRouteData, keys);
}

export function rowAt(index, list) {
  return Array.isArray(list) && list[index] ? list[index] : null;
}

export function createTableLoader(options) {
  const { request, url, state, tableKey, decorate, returnsEmpty = false } = options;
  return async function load() {
    const params = typeof options.params === 'function' ? options.params() : (options.params || {});
    const r = await fetchList(request, url, params, options);
    if (!r.ok) return returnsEmpty ? { ok: false, empty: false } : false;
    const list = r.list;
    state[tableKey] = {
      ...state[tableKey],
      data: typeof decorate === 'function' ? list.map(decorate) : list
    };
    return returnsEmpty ? { ok: true, empty: list.length === 0 } : list;
  };
}