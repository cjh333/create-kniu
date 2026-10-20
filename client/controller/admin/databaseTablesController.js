import MVVM from '../../core/kniumvvm.mjs';
import AUTH from '../../core/kniuauth.mjs';
import { IDENTIFIER_PATTERN, formatBytes, rowAt, routeParams, createTableLoader, createSqlConsoleModel, openSqlConsole } from './databaseShared.js';
import { adminTableMaxHeight, confirmYes, executeSqlTextShared, requireLogin } from './adminShared.js';

const { controller } = MVVM;

const databaseTablesController = controller(({ $confirm, $msg, getRouteData, navigateTo, request, reactive, onMounted }) => {
  const params = routeParams(getRouteData, ['database']);

  const state = reactive({
    database: params.database,
    sqlModel: createSqlConsoleModel(),
    sqlResultText: '',
    showCreateTable: false,
    tableTable: {
      data: [],
      rowKey: 'name',
      stripe: true,
      border: true,
      maxHeight: adminTableMaxHeight()
    }
  });

  const loadTables = createTableLoader({
    request,
    url: '/db_tables',
    params: () => ({ database: state.database }),
    state,
    tableKey: 'tableTable',
    $msg,
    failMsg: '读取数据表失败',
    onFail: function () { navigateTo('/database'); },
    decorate: function (row) {
      return {
        ...row,
        type_text: row.type === 'VIEW' ? '视图' : '数据表',
        size_text: formatBytes(Number(row.data_length) + Number(row.index_length))
      };
    }
  });

  function openCreateTable() {
    if (!state.database || !IDENTIFIER_PATTERN.test(String(state.database))) {
      $msg({ content: '缺少数据库上下文，请重新从数据库列表进入', type: 'error' });
      navigateTo('/database');
      return;
    }
    openSqlConsole(state, 'showCreateTable');
  }

  function closeCreateTable() {
    state.showCreateTable = false;
  }

  function submitCreateTable() {
    return executeSqlText().then(function (ok) {
      if (ok) state.showCreateTable = false;
    });
  }

  function executeSqlText() {
    return executeSqlTextShared(state, request, {
      $msg,
      buildSql: function (sql) { return `USE \`${state.database}\`;\n${sql}`; },
      reload: loadTables
    });
  }

  async function doExport() {
    if (!state.database) return;
    const confirmed = await confirmYes($confirm, `确定导出数据库「${state.database}」为 .sql 文件吗？`);
    if (!confirmed) return;
    const res = await request({
      url: '/db_export', type: 'POST', dataType: 'text',
      data: { database: state.database }
    });
    const text = typeof res === 'string' ? res : String((res && res.data) || '');
    if (text.indexOf('-- KniuSystem') !== 0) {
      let message = '导出失败';
      try {
        const body = JSON.parse(text);
        if (body && body.msg) message = body.msg;
      } catch (err) { }
      $msg({ content: message, type: 'error' });
      return;
    }
    const blob = new Blob([text], { type: 'application/sql;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${state.database}.sql`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    $msg({ content: `已导出 ${formatBytes(text.length)}`, type: 'success' });
  }

  function viewTable(index, list) {
    const row = rowAt(index, list);
    if (!row || !row.name) return false;
    navigateTo('/databasetable', { database: state.database, table: row.name });
    return false;
  }

  async function updateSort(index, list, value) {
    const row = rowAt(index, list);
    if (!row || !row.name) return false;
    const res = await request({
      url: '/db_table_sort_update', type: 'POST',
      data: { database: state.database, table: row.name, sid: Math.max(0, Number(value) || 0) }
    });
    if (res.status !== 1) {
      $msg({ content: res.msg, type: 'error' });
      return false;
    }
    await loadTables();
    return true;
  }

  function toDatabase() {
    navigateTo('/database');
  }

  onMounted(async function () {
    if (!requireLogin(AUTH, { $msg, navigateTo })) return;
    if (!state.database) {
      $msg({ content: '请先在数据库列表里选择数据库', type: 'error' });
      navigateTo('/database');
      return;
    }
    await loadTables();
  });

  return {
    state,
    openCreateTable,
    closeCreateTable,
    submitCreateTable,
    doExport,
    viewTable,
    updateSort,
    toDatabase
  };
});

export default databaseTablesController;