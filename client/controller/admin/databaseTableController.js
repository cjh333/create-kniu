import MVVM from '../../core/kniumvvm.mjs';
import AUTH from '../../core/kniuauth.mjs';
import { tableByRowKey, nodeById, clearNode, readNativeValue, makeInput, makeRow, routeParams } from './databaseShared.js';

const { controller } = MVVM;
const PAGE_TAG = 'KNIU-SYSTEM-ADMIN-DATABASETABLE';
const databaseTableController = controller(({ $confirm, $msg, getRouteData, navigateTo, request, reactive, onMounted }) => {
  const self = { $confirm, $msg, navigateTo };
  const isSuperAdmin = Number(AUTH.getUser()?.roleId || AUTH.getUser()?.role || 0) === 1;
  const params = routeParams(getRouteData, ['database', 'table']);

  const state = reactive({
    isSuperAdmin,
    database: params.database,
    table: params.table,
    primaryKey: '',
    writable: false,
    activeTab: 'data',
    tabBar: {
      items: [
        { name: 'data', label: '数据' },
        { name: 'struct', label: '属性' }
      ],
      active: 'data',
      onChange: (detail) => onTabChange(detail)
    },
    columns: [],
    total: 0,
    keyword: {
      value: '',
      condition: function () { return true; },
      message: ''
    },
    showRowEditor: false,
    rowEditorTitle: '编辑行',
    showColumnEditor: false,
    columnEditorTitle: '编辑列',
    structTable: {
      data: [],
      rowKey: 'name',
      stripe: true,
      border: true
    },
    rowTable: {
      data: [],
      rowKey: 'primary_value',
      stripe: true,
      border: true,
      maxHeight: 460
    },
    rowPage: {
      currentPage: 1,
      pageSize: 20,
      total: 0,
      background: true,
      onCurrentChange: (detail) => changeRowPage({ detail }),
      onSizeChange: (detail) => changeRowPageSize({ detail })
    }
  });

  let rowContext = { id: '', fields: [], inputs: [] };
  let columnContext = { column: '', inputs: {} };
  let lastRowColumns = [];

  function onTabChange(detail) {
    const raw = detail == null ? {} : (detail.name != null ? detail : (detail.detail || {}));
    const name = raw.name === 'struct' ? 'struct' : 'data';
    state.activeTab = name;
    if (name === 'data') renderRowColumns(lastRowColumns);
  }

  async function loadStructure() {
    const res = await request({
      url: '/db_table_structure', type: 'POST', mutation: false,
      data: { database: state.database, table: state.table }
    });
    if (res.status !== 1) {
      self.$msg({ content: res.msg || '读取表结构失败', type: 'error' });
      self.navigateTo('/databasetables', { database: state.database });
      return;
    }
    const data = res.data || {};
    state.primaryKey = data.primary_key || '';
    state.writable = data.writable === true;
    state.columns = data.columns || [];
    const uniqueColumns = {};
    (data.indexes || []).forEach(function (index) {
      if (index.unique !== true) return;
      const indexColumns = index.columns || [];
      if (indexColumns.length !== 1) return;
      uniqueColumns[indexColumns[0]] = true;
    });
    state.structTable = {
      ...state.structTable,
      data: state.columns.map(function (column) {
        const parsed = parseColumnType(String(column.type || ''));
        return {
          ...column,
          type_text: parsed.base + (parsed.flags ? ` ${parsed.flags}` : ''),
          length_text: column.length === null || column.length === undefined
            ? parsed.width
            : String(column.length),
          default_text: column.default === null || column.default === undefined ? '' : String(column.default),
          not_null: column.null ? '' : '✓',
          is_primary: column.key === 'PRI' || state.primaryKey === column.name ? '✓' : '',
          is_unique: uniqueColumns[column.name] ? '✓' : '',
          is_auto: /auto_increment/i.test(String(column.extra || '')) ? '✓' : '',
          is_unsigned: /\bunsigned\b/i.test(String(column.type || '')) ? '✓' : '',
          is_zerofill: /\bzerofill\b/i.test(String(column.type || '')) ? '✓' : ''
        };
      })
    };
    await loadRows(1);
  }

  async function loadRows(page) {
    if (!state.database || !state.table) return;
    const res = await request({
      url: '/db_rows', type: 'POST', mutation: false,
      data: {
        database: state.database,
        table: state.table,
        page_current: page || 1,
        page_rows: state.rowPage.pageSize,
        keyword: state.keyword.value
      }
    });
    if (res.status !== 1) {
      self.$msg({ content: res.msg || '读取数据失败', type: 'error' });
      return;
    }
    const data = res.data || {};
    state.total = Number(data.total || 0);
    state.rowPage = { ...state.rowPage, currentPage: Number(data.page || 1), total: state.total };
    state.writable = data.writable === true;
    lastRowColumns = data.columns || [];
    state.rowTable = {
      ...state.rowTable,
      data: (data.list || []).map(function (row) {
        const flat = { primary_key: row.primary_key, primary_value: row.primary_value, cells: row.cells };
        (row.cells || []).forEach(function (cell) { flat[cell.name] = cell.value; });
        return flat;
      })
    };
    renderRowColumns(lastRowColumns);
  }

  function changeRowPage(detail) {
    state.rowPage = { ...state.rowPage, currentPage: Number((detail && detail.value) || 1) };
    loadRows(state.rowPage.currentPage);
  }

  function changeRowPageSize(detail) {
    state.rowPage = { ...state.rowPage, pageSize: Number((detail && detail.value) || 20), currentPage: 1 };
    loadRows(1);
  }

  function searchRows() {
    loadRows(1);
  }

  function renderRowColumns(columns) {
    let tries = 0;
    const attempt = function () {
      const table = tableByRowKey(PAGE_TAG, 'primary_value');
      if (!table) {
        if (tries < 12 && typeof requestAnimationFrame === 'function') {
          tries += 1;
          requestAnimationFrame(attempt);
        }
        return;
      }
      [...table.querySelectorAll(':scope > kniu-table-col[data-db-col]')].forEach((node) => node.remove());
      const action = table.querySelector(':scope > kniu-table-col[data-db-action]');
      columns.forEach(function (name) {
        const col = document.createElement('kniu-table-col');
        col.setAttribute('data-db-col', '');
        col.setAttribute('field', name);
        col.setAttribute('label', name);
        col.setAttribute('min-width', '160');
        col.setAttribute('show-overflow-tooltip', '');
        if (action) table.insertBefore(col, action); else table.appendChild(col);
      });
      if (typeof table.refreshColumns === 'function') table.refreshColumns();
    };
    attempt();
  }

  function parseColumnType(type) {
    const raw = String(type || '').trim();
    const match = raw.match(/^([a-zA-Z]+)\s*(\(\s*\d+(?:\s*,\s*\d+)?\s*\))?\s*(.*)$/);
    if (!match) return { base: raw, width: '', flags: '' };
    const flags = (match[3] || '').trim();
    if (flags.startsWith('(')) return { base: raw, width: '', flags: '' };
    return {
      base: match[1],
      width: match[2] ? match[2].replace(/[()\s]/g, '') : '',
      flags,
    };
  }

  function makeSwitch(on) {
    const toggle = document.createElement('kniu-switch');
    toggle.options = { name: 'field' };
    toggle.value = !!on;
    return toggle;
  }

  function buildColumnEditor(meta) {
    const box = nodeById(PAGE_TAG, 'columnEditorFields');
    if (!box) return;
    clearNode(box);
    const parsed = parseColumnType(meta.type);
    columnContext = { column: meta.name, inputs: {} };
    const inputs = {
      name: makeInput(meta.name, { placeholder: '列名（字母、数字、下划线）' }),
      type: makeInput(parsed.base, { placeholder: '如 varchar / bigint / datetime' }),
      length: makeInput(parsed.width, { placeholder: '可留空，如 255 或 10,2' }),
      unsigned: makeSwitch(/\bunsigned\b/i.test(parsed.flags)),
      zerofill: makeSwitch(/\bzerofill\b/i.test(parsed.flags)),
      notNull: makeSwitch(meta.null !== true),
      autoInc: makeSwitch(/auto_increment/i.test(String(meta.extra || ''))),
      default: makeInput(meta.default === null || meta.default === undefined ? '' : String(meta.default), { placeholder: '留空清除默认值' }),
      comment: makeInput(String(meta.comment || ''), { placeholder: '列注释' })
    };
    columnContext.inputs = inputs;
    box.appendChild(makeRow('名称', inputs.name));
    box.appendChild(makeRow('类型', inputs.type));
    box.appendChild(makeRow('长度', inputs.length));
    box.appendChild(makeRow('UNSIGNED', inputs.unsigned));
    box.appendChild(makeRow('Zerofill', inputs.zerofill));
    box.appendChild(makeRow('Not Null', inputs.notNull));
    box.appendChild(makeRow('自增', inputs.autoInc));
    box.appendChild(makeRow('默认值', inputs.default));
    box.appendChild(makeRow('注释', inputs.comment));
    state.columnEditorTitle = `编辑列 · ${meta.name}`;
    state.showColumnEditor = true;
  }

  function openColumnEdit(index, list) {
    const row = (list || [])[index];
    if (!row) return false;
    buildColumnEditor(row);
    return false;
  }

  function closeColumnEditor() {
    state.showColumnEditor = false;
  }

  async function submitColumnEdit() {
    const inputs = columnContext.inputs || {};
    const read = function (input) { return readNativeValue(input).trim(); };
    const definition = {
      name: read(inputs.name),
      type: read(inputs.type),
      length: read(inputs.length),
      unsigned: inputs.unsigned.value === true,
      zerofill: inputs.zerofill.value === true,
      notNull: inputs.notNull.value === true,
      autoInc: inputs.autoInc.value === true,
      default: readNativeValue(inputs.default),
      comment: read(inputs.comment)
    };
    if (!definition.name || !definition.type) {
      self.$msg({ content: '名称与类型不能为空', type: 'error' });
      return;
    }
    const res = await request({
      url: '/db_column_edit', type: 'POST',
      data: { database: state.database, table: state.table, column: columnContext.column, definition }
    });
    if (res.status !== 1) {
      self.$msg({ content: res.msg, type: 'error' });
      return;
    }
    state.showColumnEditor = false;
    self.$msg({ content: res.msg, type: 'success' });
    await loadStructure();
  }

  async function dropColumn(index, list) {
    const row = (list || [])[index];
    if (!row) return false;
    if (row.name === state.primaryKey) {
      self.$msg({ content: '主键列不允许删除；确需删除请先在 SQL 控制台移除主键约束', type: 'error' });
      return false;
    }
    const confirmed = await self.$confirm(`确定删除列「${row.name}」吗？该列数据将一并丢失。`, '提示', {
      confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning'
    }).then(function () { return true; }).catch(function () { return false; });
    if (!confirmed) return false;
    const res = await request({
      url: '/db_column_drop', type: 'POST',
      data: { database: state.database, table: state.table, column: row.name }
    });
    if (res.status !== 1) {
      self.$msg({ content: res.msg, type: 'error' });
      return false;
    }
    self.$msg({ content: res.msg, type: 'success' });
    await loadStructure();
    return false;
  }

  function buildRowEditor(row, title) {
    const box = nodeById(PAGE_TAG, 'rowEditorFields');
    if (!box) return;
    clearNode(box);
    const isEdit = !!row;
    const saved = {};
    if (isEdit) {
      (row.cells || []).forEach(function (cell) { saved[cell.name] = cell.value; });
    }
    const fields = state.columns.filter(function (meta) {
      if (isEdit) return meta.name !== state.primaryKey;
      return !/auto_increment/i.test(String(meta.extra || ''));
    });
    rowContext = { id: isEdit ? (row.primary_value || '') : '', fields: [], inputs: [] };
    fields.forEach(function (meta) {
      const type = /^(tinytext|text|mediumtext|longtext|json|blob)$/i.test(String(meta.type || '')) ? 'textarea' : 'text';
      const raw = isEdit ? saved[meta.name] : '';
      const input = makeInput(raw === null || raw === undefined ? '' : raw, {
        placeholder: `留空写入 NULL · ${meta.name}`,
        type
      });
      box.appendChild(makeRow(meta.name, input));
      rowContext.fields.push(meta.name);
      rowContext.inputs.push(input);
    });
    if (!rowContext.fields.length) {
      const tip = document.createElement('div');
      tip.style.cssText = 'font-size:13px;color:#909399;padding:8px 0;';
      tip.textContent = isEdit ? '该表除主键外没有其它字段，无需编辑。' : '该表没有可新增的字段。';
      box.appendChild(tip);
    }
    state.rowEditorTitle = title;
    state.showRowEditor = true;
  }

  function openInsertRow() {
    if (!state.writable) {
      self.$msg({ content: '该表没有主键，数据库管理不允许写入', type: 'error' });
      return;
    }
    buildRowEditor(null, '新增行');
  }

  function openEditRow(index, list) {
    const row = (list || [])[index];
    if (!row) return false;
    if (!state.writable) {
      self.$msg({ content: '该表没有主键，数据库管理不允许写入', type: 'error' });
      return false;
    }
    buildRowEditor(row, '编辑行');
    return false;
  }

  function closeRowEditor() {
    state.showRowEditor = false;
  }

  async function submitRow() {
    if (!rowContext.fields.length) {
      self.$msg({ content: '没有可保存的字段', type: 'error' });
      return;
    }
    const values = {};
    rowContext.inputs.forEach(function (input, index) {
      const raw = readNativeValue(input);
      values[rowContext.fields[index]] = raw === '' ? null : raw;
    });
    const res = await request({
      url: '/db_row_save', type: 'POST',
      data: { database: state.database, table: state.table, id: rowContext.id, values }
    });
    if (res.status !== 1) {
      self.$msg({ content: res.msg, type: 'error' });
      return;
    }
    state.showRowEditor = false;
    self.$msg({ content: res.msg, type: 'success' });
    await loadRows(state.rowPage.currentPage);
  }

  async function deleteRow(index, list) {
    const row = (list || [])[index];
    if (!row) return false;
    if (!state.writable) {
      self.$msg({ content: '该表没有主键，数据库管理不允许删除', type: 'error' });
      return false;
    }
    const confirmed = await self.$confirm('确定删除该行数据吗？此操作不可撤销。', '提示', {
      confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning'
    }).then(function () { return true; }).catch(function () { return false; });
    if (!confirmed) return false;
    const res = await request({
      url: '/db_row_delete', type: 'POST',
      data: { database: state.database, table: state.table, id: row.primary_value }
    });
    if (res.status !== 1) {
      self.$msg({ content: res.msg, type: 'error' });
      return false;
    }
    self.$msg({ content: res.msg, type: 'success' });
    await loadRows(state.rowPage.currentPage);
    return false;
  }

  async function dropTable() {
    if (!state.table) return;
    const confirmed = await self.$confirm(
      `确定删除数据表「${state.database}.${state.table}」吗？表内数据将一并丢失。`,
      '提示',
      { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
    ).then(function () { return true; }).catch(function () { return false; });
    if (!confirmed) return;
    const res = await request({
      url: '/db_table_drop', type: 'POST',
      data: { database: state.database, table: state.table }
    });
    if (res.status !== 1) {
      self.$msg({ content: res.msg, type: 'error' });
      return;
    }
    self.$msg({ content: res.msg, type: 'success' });
    self.navigateTo('/databasetables', { database: state.database });
  }

  function goTables() {
    self.navigateTo('/databasetables', { database: state.database });
  }

  onMounted(async function () {
    if (!isSuperAdmin) {
      self.$msg({ content: '数据库管理仅对超级管理员开放', type: 'error' });
      self.navigateTo('/admin');
      return;
    }
    if (!state.database || !state.table) {
      self.$msg({ content: '请先在数据表列表里选择数据表', type: 'error' });
      self.navigateTo(state.database ? '/databasetables' : '/database', state.database ? { database: state.database } : {});
      return;
    }
    await loadStructure();
  });

  return {
    state,
    changeRowPage,
    changeRowPageSize,
    searchRows,
    openInsertRow,
    openEditRow,
    closeRowEditor,
    submitRow,
    deleteRow,
    openColumnEdit,
    closeColumnEditor,
    submitColumnEdit,
    dropColumn,
    dropTable,
    goTables
  };
});

export default databaseTableController;