import MVVM from '../../core/kniumvvm.mjs';
import { createRowDeleteHandler } from '../../core/kniuui/kniuui.mjs';
import AUTH from '../../core/kniuauth.mjs';
import { createRequestActions } from '../../core/kniupage.mjs';
import { IDENTIFIER_PATTERN, rowAt, createTableLoader } from './databaseShared.js';
import { requireLogin, withSubmitting } from './adminShared.js';

const { controller } = MVVM;
const HOST_PATTERN = /^[A-Za-z0-9._-]{1,190}$/;
const CHARSETS = ['utf8mb4', 'utf8', 'latin1', 'gbk', 'big5'];

function fieldValue(source) {
  const raw = (source && typeof source === 'object' && 'value' in source) ? source.value : source;
  return String(raw === null || raw === undefined ? '' : raw).trim();
}

const dbConnectController = controller(({ $refs, $confirm, $msg, navigateTo, request, reactive, onMounted }) => {
  const actions = createRequestActions({ request, msg: $msg });
  const state = reactive({
    showForm: false,
    formTitle: '新建连接',
    editingId: '',
    connectModel: emptyModel(),
    connectTable: {
      data: [],
      rowKey: 'profile_id',
      stripe: true,
      border: true
    }
  });

  function emptyModel() {
    return {
      labelPosition: 'top',
      labelWidth: 'auto',
      name: {
        value: '',
        condition: function (v) { return fieldValue(v) !== ''; },
        message: '请填写连接名称'
      },
      host: {
        value: '',
        condition: function (v) { return HOST_PATTERN.test(fieldValue(v)); },
        message: '主机地址只能由字母、数字、点、下划线和连字符组成'
      },
      port: {
        value: '3306',
        condition: function (v) {
          const port = Number(fieldValue(v));
          return Number.isInteger(port) && port >= 1 && port <= 65535;
        },
        message: '端口必须是 1-65535 之间的整数'
      },
      username: {
        value: '',
        condition: function (v) { return fieldValue(v) !== ''; },
        message: '请填写用户名'
      },
      password: {
        value: '',
        condition: function () { return true; },
        message: ''
      },
      database: {
        value: '',
        condition: function (v) {
          const name = fieldValue(v);
          return name === '' || IDENTIFIER_PATTERN.test(name);
        },
        message: '默认数据库名只能由字母、数字和下划线组成'
      },
      charset: {
        value: 'utf8mb4',
        condition: function (v) { return CHARSETS.indexOf(fieldValue(v)) >= 0; },
        message: '不支持的字符集'
      }
    };
  }

  const loadConnections = createTableLoader({
    request,
    url: '/db_connection_list',
    state,
    tableKey: 'connectTable',
    $msg,
    failMsg: '读取连接列表失败',
    decorate: function (row) {
      return {
        ...row,
        can_activate: !row.is_active,
        status_text: row.status || '未知',
        status_type: row.status === '正常' ? 'success' : (row.status === '异常' ? 'danger' : 'info'),
        password_text: row.has_password ? '已设置' : '未设置'
      };
    }
  });

  function readForm() {
    const form = $refs.connectForm;
    const values = (form && form.values) || {};
    return {
      id: state.editingId,
      name: fieldValue(values.name),
      host: fieldValue(values.host),
      port: Number(fieldValue(values.port)) || 0,
      username: fieldValue(values.username),
      password: String(values.password === null || values.password === undefined ? '' : values.password),
      database: fieldValue(values.database),
      charset: fieldValue(values.charset) || 'utf8mb4'
    };
  }

  function collect() {
    const form = $refs.connectForm;
    if (!form || !form.validate()) return null;
    return readForm();
  }

  function openCreate() {
    state.editingId = '';
    state.formTitle = '新建连接';
    state.connectModel = emptyModel();
    state.showForm = true;
  }

  function editConnection(index, list) {
    const row = rowAt(index, list);
    if (!row) return false;
    const model = emptyModel();
    model.name.value = row.name;
    model.host.value = row.host;
    model.port.value = String(row.port);
    model.username.value = row.username;
    model.database.value = row.database;
    model.charset.value = row.charset;
    state.editingId = row.profile_id;
    state.formTitle = `编辑连接 · ${row.name}`;
    state.connectModel = model;
    state.showForm = true;
    return false;
  }

  function closeForm() {
    state.showForm = false;
  }

  async function submitForm() {
    await withSubmitting(state, async () => {
      const payload = collect();
      if (!payload) return;
      await actions.post('/db_connection_save', payload, {
        onOk: function () { state.showForm = false; },
        toast: false
      });
      if (state.showForm) return;
      await loadConnections();
    });
  }

  async function testFormConnection() {
    const payload = readForm();
    await actions.post('/db_connection_test', payload, { mutation: false });
  }

  async function activateConnection(index, list) {
    const row = rowAt(index, list);
    if (!row) return false;
    await actions.post('/db_connection_activate', { id: row.profile_id }, { onOk: () => loadConnections() });
    return false;
  }

  async function testConnection(index, list) {
    const row = rowAt(index, list);
    if (!row) return false;
    await actions.post('/db_connection_test', { id: row.profile_id }, { mutation: false });
    return false;
  }

  const deleteConnection = createRowDeleteHandler({
    self: { $confirm, $msg },
    url: '/db_connection_delete',
    confirmMessage: (row) => `确定删除连接「${row.name}」吗？`,
    idOf: (row) => row.profile_id,
    reload: () => loadConnections()
  });

  async function viewConnection(index, list) {
    const row = rowAt(index, list);
    if (!row) return false;
    if (!row.is_active) {
      const res = await actions.post('/db_connection_activate', { id: row.profile_id }, { toast: false });
      if (!res) return false;
    }
    goDatabases();
    return false;
  }

  async function updateSort(index, list, value) {
    const row = rowAt(index, list);
    if (!row || !row.profile_id) return false;
    const res = await actions.post('/db_connection_sort_update', { id: row.profile_id, sid: Math.max(0, Number(value) || 0) }, { toast: false });
    if (!res) return false;
    await loadConnections();
    return true;
  }

  function goDatabases() {
    navigateTo('/database');
  }

  function goBack() {
    navigateTo('/admin');
  }

  onMounted(async function () {
    if (!requireLogin(AUTH, { $msg, navigateTo })) return;
    await loadConnections();
  });

  return {
    state,
    openCreate,
    editConnection,
    closeForm,
    submitForm,
    testFormConnection,
    activateConnection,
    testConnection,
    deleteConnection,
    viewConnection,
    updateSort,
    goDatabases,
    goBack
  };
});

export default dbConnectController;