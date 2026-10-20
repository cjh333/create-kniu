import MVVM from '../../core/kniumvvm.mjs';
import { createRequestActions } from '../../core/kniupage.mjs';
import { createRowDeleteHandler } from '../../core/kniuui/kniuui.mjs';
import AUTH from '../../core/kniuauth.mjs';
import { confirmYes, executeSqlTextShared, isSuperRole, requireLogin, withSubmitting } from './adminShared.js';
import { formatBytes, rowAt, fetchList, createTableLoader, createSqlConsoleModel, openSqlConsole } from './databaseShared.js';

const { controller } = MVVM;

const databaseController = controller(({ $confirm, $msg, $refs, navigateTo, request, reactive, onMounted }) => {
  const isSuperAdmin = isSuperRole(AUTH.getUser());
  const actions = createRequestActions({ request, msg: $msg });

  const state = reactive({
    isSuperAdmin,
    canEditContent: isSuperAdmin,
    importModel: {
      labelPosition: 'top',
      labelWidth: 'auto'
    },
    sqlModel: createSqlConsoleModel(),
    sqlResultText: '',
    files: [],
    showCreateDatabase: false,
    showImport: false,
    dbTable: {
      data: [],
      rowKey: 'name',
      stripe: true,
      border: true
    }
  });

  const loadDatabases = createTableLoader({
    request,
    url: '/db_list',
    state,
    tableKey: 'dbTable',
    $msg,
    failMsg: '读取数据库列表失败',
    returnsEmpty: true,
    decorate: function (row) {
      return { ...row, size_text: formatBytes(row.total_bytes) };
    }
  });

  function openCreateDatabase() {
    openSqlConsole(state, 'showCreateDatabase');
  }

  function closeCreateDatabase() {
    state.showCreateDatabase = false;
  }

  function submitCreateDatabase() {
    return executeSqlText().then(function (ok) {
      if (ok) state.showCreateDatabase = false;
    });
  }

  function openImport() {
    state.files = [];
    state.showImport = true;
  }

  function closeImport() {
    state.showImport = false;
    state.files = [];
    if ($refs.upload) $refs.upload.clear();
  }

  async function submitImport() {
    await withSubmitting(state, async () => {
      const file = (state.files || [])[0];
      if (!(file instanceof File)) {
        $msg({ content: '请选择 .sql 文件', type: 'error' });
        return;
      }
      let sql;
      try {
        sql = await file.text();
      } catch (err) {
        $msg({ content: '读取文件失败', type: 'error' });
        return;
      }
      const confirmed = await confirmYes($confirm, '导入会按分号逐条执行脚本，且遇错即停。确定继续吗？');
      if (!confirmed) return;
      const res = await request({ url: '/db_import', type: 'POST', data: { sql } });
      if (res.status !== 1) {
        $msg({ content: res.msg, type: 'error' });
        return;
      }
      const data = res.data || {};
      $msg({ content: res.msg || '导入完成', type: data.failed > 0 ? 'warning' : 'success' });
      if (!data.failed) state.showImport = false;
      await loadDatabases();
    });
  }

  function executeSqlText() {
    return executeSqlTextShared(state, request, { $msg, reload: loadDatabases });
  }

  function viewRow(index, list) {
    const row = rowAt(index, list);
    if (!row || !row.name) return false;
    navigateTo('/databasetables', { database: row.name });
    return false;
  }

  const deleteRow = createRowDeleteHandler({
    self: { $confirm, $msg },
    url: '/db_drop',
    confirmMessage: (row) => `确定删除数据库「${row.name}」吗？库内所有表和数据将被永久删除。`,
    confirmTitle: '危险操作',
    confirmButtonText: '删除',
    buildData: (row) => ({ database: row.name }),
    reload: () => loadDatabases()
  });

  function goDbConnect() {
    navigateTo('/dbconnect');
  }

  async function updateSort(index, list, value) {
    const row = rowAt(index, list);
    if (!row || !row.name) return false;
    const res = await actions.post('/db_sort_update', { database: row.name, sid: Math.max(0, Number(value) || 0) });
    if (res) await loadDatabases();
    return !!res;
  }

  onMounted(async function () {
    if (!requireLogin(AUTH, { $msg, navigateTo })) return;
    const result = await loadDatabases();
    if (!result.ok) navigateTo('/dbconnect');
  });

  return {
    state,
    openCreateDatabase,
    closeCreateDatabase,
    submitCreateDatabase,
    openImport,
    closeImport,
    submitImport,
    viewRow,
    deleteRow,
    updateSort,
    goDbConnect
  };
});

export default databaseController;