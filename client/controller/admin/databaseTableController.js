import MVVM from '../../core/kniumvvm.mjs';
import UI from '../../core/kniuui/kniuui.mjs';
import AUTH from '../../core/kniuauth.mjs';
import { createRequestActions } from '../../core/kniupage.mjs';
import { adminTableMaxHeight, confirmYes, requireLogin, withSubmitting } from './adminShared.js';
import { createRowDeleteHandler } from '../../core/kniuui/kniuui.mjs';
import { tableByRowKey, routeParams } from './databaseShared.js';

const { controller } = MVVM;
const { usePage } = UI;
const PAGE_TAG = 'KNIU-SYSTEM-ADMIN-DATABASETABLE';
const databaseTableController = controller(({ $confirm, $msg, $refs, getRouteData, navigateTo, request, reactive, onMounted }) => {
  const self = { $confirm, $msg, $refs };
  const actions = createRequestActions({ request, msg: $msg });
  const params = routeParams(getRouteData, ['database', 'table']);
  const state = reactive({
    database: params.database,
    table: params.table,
    primaryKey: '',
    writable: false,
    columns: [],
    total: 0,
    keyword: '',
    list: [],
    loading: true,
    error: '',
    showRowEditor: false,
    rowEditorTitle: '编辑行',
    rowFields: [],
    rowEditorId: '',
    emptyAsNull: true,
    showColumnEditor: false,
    columnEditorTitle: '编辑列',
    columnForm: {
      name: '',
      type: '',
      length: '',
      unsigned: false,
      zerofill: false,
      notNull: true,
      primaryKey: false,
      unique: false,
      autoInc: false,
      default: '',
      comment: ''
    },
    structTable: {
      data: [],
      rowKey: 'name',
      maxHeight: adminTableMaxHeight(),
      stripe: true,
      border: true
    }
  });

  let columnContext = { column: '' };
  let lastRowColumns = [];

  function flattenRows(records) {
    return records.map(function (row) {
      const flat = { primary_key: row.primary_key, primary_value: row.primary_value, cells: row.cells };
      (row.cells || []).forEach(function (cell) { flat[cell.name] = cell.value; });
      return flat;
    });
  }

  const { loadList, searchList, debouncedSearch } = usePage({
    state,
    self,
    url: '/db_rows',
    field: '',
    sort: 'asc',
    params: () => ({ database: state.database, table: state.table, keyword: state.keyword }),
    transform: flattenRows,
    tableKey: 'rowTable',
    table: { rowKey: 'primary_value', maxHeight: adminTableMaxHeight(), stripe: true, border: true },
    pageKey: 'rowPage',
    page: { pageSize: 20 },
    onLoaded: function () { renderRowColumns(lastRowColumns); }
  });

  async function loadStructure() {
    const res = await request({
      url: '/db_table_structure', type: 'POST', mutation: false,
      data: { database: state.database, table: state.table }
    });
    if (res.status !== 1) {
      $msg({ content: res.msg || '读取表结构失败', type: 'error' });
      navigateTo('/databasetables', { database: state.database });
      return;
    }
    const data = res.data || {};
    state.primaryKey = data.primary_key || '';
    state.writable = data.writable === true;
    state.columns = data.columns || [];
    lastRowColumns = state.columns.map(function (meta) { return meta.name; });
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
    await loadList(1);
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
        col.setAttribute('width', 160);
        if (name === 'id' || name === 'role_id' || name === 'create_time' || name === 'issue_time') {
          col.setAttribute('align', 'center');
        }
        if (name === 'id' || name === 'role_id') {
          col.setAttribute('width', 80);
        }
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

  function fillColumnForm(meta) {
    const parsed = parseColumnType(meta.type);
    columnContext.column = meta.name;
    state.columnForm = {
      name: meta.name,
      type: parsed.base,
      length: meta.length === null || meta.length === undefined ? parsed.width : String(meta.length),
      unsigned: /\bunsigned\b/i.test(parsed.flags),
      zerofill: /\bzerofill\b/i.test(parsed.flags),
      notNull: meta.null !== true,
      primaryKey: meta.is_primary === '✓',
      unique: meta.is_unique === '✓',
      autoInc: /auto_increment/i.test(String(meta.extra || '')),
      default: meta.default === null || meta.default === undefined ? '' : String(meta.default),
      comment: String(meta.comment || '')
    };
    state.columnEditorTitle = `编辑列 · ${meta.name}`;
    state.showColumnEditor = true;
  }

  function openColumnEdit(index, list) {
    const row = (list || [])[index];
    if (!row) return false;
    fillColumnForm(row);
    return false;
  }

  function closeColumnEditor() {
    state.showColumnEditor = false;
  }

  async function submitColumnEdit() {
    await withSubmitting(state, async () => {
      const form = state.columnForm;
      const read = function (value) { return String(value == null ? '' : value).trim(); };
      const definition = {
        name: read(form.name),
        type: read(form.type),
        length: read(form.length),
        unsigned: form.unsigned === true,
        zerofill: form.zerofill === true,
        notNull: form.notNull === true,
        autoInc: form.autoInc === true,
        default: form.default == null ? '' : String(form.default),
        comment: read(form.comment)
      };
      if (!definition.name || !definition.type) {
        $msg({ content: '名称与类型不能为空', type: 'error' });
        return;
      }
      const res = await actions.post('/db_column_edit',
        { database: state.database, table: state.table, column: columnContext.column, definition },
        { onOk: function () { state.showColumnEditor = false; } }
      );
      if (!res) return;
      await loadStructure();
    });
  }

  async function dropColumn(index, list) {
    const row = (list || [])[index];
    if (!row) return false;
    if (row.name === state.primaryKey) {
      $msg({ content: '主键列不允许删除；确需删除请先在 SQL 控制台移除主键约束', type: 'error' });
      return false;
    }
    const confirmed = await confirmYes($confirm, `确定删除列「${row.name}」吗？该列数据将一并丢失。`);
    if (!confirmed) return false;
    const res = await actions.post('/db_column_drop', { database: state.database, table: state.table, column: row.name });
    if (!res) return false;
    await loadStructure();
    return false;
  }

  const PICKER_TYPES = { date: 'date', datetime: 'datetime', timestamp: 'datetime', time: 'time' };

  function decodeHtmlEntities(text) {
    return String(text == null ? '' : text)
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#0?39;/g, '\'')
      .replace(/&amp;/g, '&');
  }

  function buildRowEditor(row, title) {
    const isEdit = !!row;
    const saved = {};
    if (isEdit) {
      (row.cells || []).forEach(function (cell) { saved[cell.name] = cell.value; });
    }
    const fields = state.columns.filter(function (meta) {
      if (isEdit) return meta.name !== state.primaryKey;
      return !/auto_increment/i.test(String(meta.extra || ''));
    });
    state.rowFields = fields.map(function (meta) {
      const base = parseColumnType(String(meta.type || '')).base.toLowerCase();
      const raw = isEdit ? saved[meta.name] : '';
      return {
        name: meta.name,
        type: base === 'blob' ? 'textarea' : 'text',
        picker: PICKER_TYPES[base] || '',
        editor: meta.name === 'content' ? (base === 'json' ? 'markdown' : 'rich') : '',
        value: raw === null || raw === undefined ? '' : decodeHtmlEntities(raw)
      };
    });
    state.rowEditorId = isEdit ? (row.primary_value || '') : '';
    state.rowEditorTitle = title;
    state.showRowEditor = true;
  }

  function openInsertRow() {
    if (!state.writable) {
      $msg({ content: '该表没有主键，数据库管理不允许写入', type: 'error' });
      return;
    }
    buildRowEditor(null, '新增行');
  }

  function openEditRow(index, list) {
    const row = (list || [])[index];
    if (!row) return false;
    if (!state.writable) {
      $msg({ content: '该表没有主键，数据库管理不允许写入', type: 'error' });
      return false;
    }
    buildRowEditor(row, '编辑行');
    return false;
  }

  function closeRowEditor() {
    state.showRowEditor = false;
  }

  async function submitRow() {
    await withSubmitting(state, async () => {
      if (!state.rowFields.length) {
        $msg({ content: '没有可保存的字段', type: 'error' });
        return;
      }
      const values = {};
      state.rowFields.forEach(function (field) {
        const raw = String(field.value == null ? '' : field.value).trim();
        values[field.name] = raw === '' && state.emptyAsNull ? null : raw;
      });
      const res = await actions.post('/db_row_save',
        { database: state.database, table: state.table, id: state.rowEditorId, values },
        { onOk: function () { state.showRowEditor = false; } }
      );
      if (!res) return;
      await loadList(state.rowPage.currentPage);
    });
  }

  // 删行走 core 删除处理器（A-M4）：无主键闸门自带提示，载荷按 database/table/主键值定位。
  const deleteRow = createRowDeleteHandler({
    self,
    url: '/db_row_delete',
    gate: () => {
      if (!state.writable) {
        $msg({ content: '该表没有主键，数据库管理不允许删除', type: 'error' });
        return false;
      }
      return true;
    },
    confirmMessage: '确定删除该行数据吗？此操作不可撤销。',
    buildData: (row) => ({ database: state.database, table: state.table, id: row.primary_value }),
    reload: () => loadList(state.rowPage.currentPage)
  });

  async function dropTable() {
    if (!state.table) return;
    const confirmed = await confirmYes($confirm, `确定删除数据表「${state.database}.${state.table}」吗？表内数据将一并丢失。`);
    if (!confirmed) return;
    const res = await actions.post('/db_table_drop', { database: state.database, table: state.table });
    if (!res) return;
    navigateTo('/databasetables', { database: state.database });
  }

  function toTables() {
    navigateTo('/databasetables', { database: state.database });
  }

  onMounted(async function () {
    if (!requireLogin(AUTH, { $msg, navigateTo })) return;
    if (!state.database || !state.table) {
      $msg({ content: '请先在数据表列表里选择数据表', type: 'error' });
      navigateTo(state.database ? '/databasetables' : '/database', state.database ? { database: state.database } : {});
      return;
    }
    await loadStructure();
  });

  return {
    state,
    searchList,
    debouncedSearch,
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
    toTables
  };
});

export default databaseTableController;