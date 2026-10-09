import MVVM from '../../core/kniumvvm.mjs';
import AUTH from '../../core/kniuauth.mjs';
import { IDENTIFIER_PATTERN, formatBytes, formatCell, rowAt, CONNECT_REDIRECT_FLAG } from './databaseShared.js';

const { controller } = MVVM;

const databaseController = controller(({ $confirm, $msg, $refs, navigateTo, request, reactive, onMounted }) => {
  const self = { $confirm, $msg, $refs, navigateTo };
  const isSuperAdmin = Number(AUTH.getUser()?.roleId || AUTH.getUser()?.role || 0) === 1;

  const state = reactive({
    isSuperAdmin,
    createDatabaseModel: {
      labelPosition: 'top',
      labelWidth: 'auto',
      name: {
        value: '',
        condition: function (v) { return IDENTIFIER_PATTERN.test(String(v.value || '').trim()); },
        message: '库名只能由字母、数字和下划线组成（1-64 位）'
      }
    },
    importModel: {
      labelPosition: 'top',
      labelWidth: 'auto',
      sql: {
        value: '',
        condition: function () { return true; },
        message: ''
      }
    },
    sqlModel: {
      labelPosition: 'top',
      labelWidth: 'auto',
      sql: {
        value: '',
        condition: function () { return true; },
        message: ''
      }
    },
    sqlResultText: '',
    showCreateDatabase: false,
    showImport: false,
    showSql: false,
    dbTable: {
      data: [],
      rowKey: 'name',
      stripe: true,
      border: true
    }
  });

  async function loadDatabases() {
    const res = await request({ url: '/db_list', type: 'POST', mutation: false, data: {} });
    if (res.status !== 1) {
      self.$msg({ content: res.msg || '读取数据库列表失败', type: 'error' });
      return { ok: false, empty: false };
    }
    const list = (res.data && res.data.list) || [];
    state.dbTable = {
      ...state.dbTable,
      data: list.map(function (row) {
        return { ...row, size_text: formatBytes(row.total_bytes) };
      })
    };
    return { ok: true, empty: list.length === 0 };
  }

  function openCreateDatabase() {
    state.createDatabaseModel = {
      ...state.createDatabaseModel,
      name: { ...state.createDatabaseModel.name, value: '' }
    };
    state.showCreateDatabase = true;
  }

  function closeCreateDatabase() {
    state.showCreateDatabase = false;
  }

  async function submitCreateDatabase() {
    const form = self.$refs.createDatabaseForm;
    if (!form || !form.validate()) return;
    const name = String((form.values && form.values.name) || '').trim();
    if (!IDENTIFIER_PATTERN.test(name)) {
      self.$msg({ content: '库名只能由字母、数字和下划线组成（1-64 位）', type: 'error' });
      return;
    }
    const res = await request({ url: '/db_create', type: 'POST', data: { name } });
    if (res.status !== 1) {
      self.$msg({ content: res.msg, type: 'error' });
      return;
    }
    state.showCreateDatabase = false;
    self.$msg({ content: res.msg, type: 'success' });
    await loadDatabases();
  }

  function openImport() {
    state.importModel = { ...state.importModel, sql: { ...state.importModel.sql, value: '' } };
    state.showImport = true;
  }

  function closeImport() {
    state.showImport = false;
  }

  function onImportFile(event) {
    const input = event && event.target ? event.target : null;
    const file = input && input.files ? input.files[0] : null;
    if (!file) return;
    if (!/\.sql$/i.test(file.name)) {
      self.$msg({ content: '只允许选择 .sql 文件', type: 'error' });
      return;
    }
    const reader = new FileReader();
    reader.onload = function () {
      state.importModel = { ...state.importModel, sql: { ...state.importModel.sql, value: String(reader.result || '') } };
      self.$msg({ content: `已读入 ${file.name}，可直接点「开始导入」`, type: 'success' });
    };
    reader.onerror = function () {
      self.$msg({ content: '读取文件失败', type: 'error' });
    };
    reader.readAsText(file, 'utf-8');
  }

  async function submitImport() {
    const sql = String(state.importModel.sql.value || '');
    if (!sql.trim()) {
      self.$msg({ content: '请粘贴 SQL 文本或选择 .sql 文件', type: 'error' });
      return;
    }
    const confirmed = await self.$confirm('导入会按分号逐条执行脚本，且遇错即停。确定继续吗？', '提示', {
      confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning'
    }).then(function () { return true; }).catch(function () { return false; });
    if (!confirmed) return;
    const res = await request({ url: '/db_import', type: 'POST', data: { sql } });
    if (res.status !== 1) {
      self.$msg({ content: res.msg, type: 'error' });
      return;
    }
    const data = res.data || {};
    self.$msg({ content: res.msg || '导入完成', type: data.failed > 0 ? 'warning' : 'success' });
    if (!data.failed) state.showImport = false;
    await loadDatabases();
  }

  function openSqlConsole() {
    state.sqlModel = { ...state.sqlModel, sql: { ...state.sqlModel.sql, value: '' } };
    state.sqlResultText = '';
    state.showSql = true;
  }

  function closeSql() {
    state.showSql = false;
  }

  async function submitSql() {
    const sql = String(state.sqlModel.sql.value || '');
    if (!sql.trim()) {
      self.$msg({ content: '请输入要执行的 SQL', type: 'error' });
      return;
    }
    const res = await request({ url: '/db_query', type: 'POST', data: { sql } });
    if (res.status !== 1) {
      self.$msg({ content: res.msg, type: 'error' });
      return;
    }
    const data = res.data || {};
    const lines = [
      `共 ${data.statements || 0} 条语句，失败 ${data.failed || 0} 条，影响 ${data.affected || 0} 行`,
      ''
    ];
    (data.results || []).forEach(function (item) {
      lines.push(`#${item.index + 1} ${item.ok ? '成功' : '失败'} · ${item.kind} · 影响/返回 ${item.affected} 行`);
      if (item.message) lines.push(`　错误：${item.message}`);
      if (item.truncated) lines.push('　（结果过多，仅回显前若干行）');
      (item.rows || []).forEach(function (row) {
        lines.push('　' + Object.keys(row).map((key) => `${key}=${formatCell(row[key])}`).join('　'));
      });
    });
    state.sqlResultText = lines.join('\n');
    self.$msg({ content: res.msg || '执行完成', type: data.failed > 0 ? 'warning' : 'success' });
    await loadDatabases();
  }

  function viewDatabase(index, list) {
    const row = rowAt(index, list);
    if (!row || !row.name) return false;
    self.navigateTo('/databasetables', { database: row.name });
    return false;
  }

  function goDbConnect() {
    self.navigateTo('/dbconnect');
  }

  function goConnections() {
    self.navigateTo('/dbconnect');
  }

  onMounted(async function () {
    if (!isSuperAdmin) {
      self.$msg({ content: '数据库管理仅对超级管理员开放', type: 'error' });
      self.navigateTo('/admin');
      return;
    }
    let hasFlag = false;
    try {
      hasFlag = !!globalThis.sessionStorage?.getItem(CONNECT_REDIRECT_FLAG);
    } catch (e) {

    }
    if (hasFlag) {
      try { globalThis.sessionStorage?.removeItem(CONNECT_REDIRECT_FLAG); } catch (e) { }
      await loadDatabases();
    } else {
      self.navigateTo('/dbconnect');
    }
  });

  return {
    state,
    openCreateDatabase,
    closeCreateDatabase,
    submitCreateDatabase,
    openImport,
    closeImport,
    onImportFile,
    submitImport,
    openSqlConsole,
    closeSql,
    submitSql,
    viewDatabase,
    goConnections,
    goDbConnect
  };
});

export default databaseController;