import MVVM from '../../core/kniumvvm.mjs';
import UI from '../../core/kniuui/kniuui.mjs';
import AUTH from '../../core/kniuauth.mjs';
import { createRequestActions } from '../../core/kniupage.mjs';
import { isAdminRole, makeFail, requireLogin } from './adminShared.js';
import { assignOptionFields } from '../../core/kniuutil.mjs';

const { controller } = MVVM;
const { makeSwitchOptions, createRowDeleteHandler, usePage } = UI;
const ROLE_TEXT = { '1': '管理员', '2': '普通用户' };

function deriveRoleAuth(role) {
  return String(role) == '1' ? '1' : '2';
}

const userController = controller(({ $confirm, $msg, $refs, navigateTo, request, reactive, onMounted }) => {
  const currentUser = AUTH.getUser() || {};
  const currentUserName = String(currentUser.name || '');
  const canAdministerUsers = isAdminRole(currentUser);
  const self = { $confirm, $msg, navigateTo };
  const actions = createRequestActions({ request, msg: $msg });
  function createUserModel() {
    return {
      id: '',
      sid: 0,
      name: {
        value: '',
        condition: function (v) {
          const name = String(v.value || '').trim();
          return name.length > 0 && Array.from(name).length <= 30;
        },
        message: '用户名必填且不能超过30个字'
      },
      password: {
        value: '',
        condition: function (v) {
          const password = String(v.value || '');
          if (!state.isAddDialog && password === '') return true;
          return /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,./?])[^<>]{8,}$/.test(password);
        },
        message: '密码需 8 位以上，含大小写字母、数字和特殊字符'
      },
      repassword: {
        value: '',
        condition: function (v) {
          const password = String(v.password || '');
          return (!state.isAddDialog && password === '' && String(v.value || '') === '') || v.value === password;
        },
        message: '您输入的两次密码不一致'
      },
      old_password: {
        value: '',
        condition: function (v) {
          if (state.isAddDialog) return true;
          const changed = String(v.password || '') !== '';
          return !changed || /^(?=.*\S).+$/.test(String(v.value || ''));
        },
        message: '您未填写旧密码'
      },
      new_password: {
        value: '',
        condition: function (v) {
          const password = String(v.value || '');
          if (!state.isAddDialog && password === '') return true;
          return /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,./?])[^<>]{8,}$/.test(password);
        },
        message: '密码需 8 位以上，含大小写字母、数字和特殊字符'
      },
      confirm_password: {
        value: '',
        condition: function (v) {
          const password = String(v.new_password || '');
          return (!state.isAddDialog && password === '' && String(v.value || '') === '') || v.value === password;
        },
        message: '您输入的两次密码不一致'
      },
      role: 2,
      role_auth: 2,
      is_show: 1
    };
  }

  const state = reactive({
    list: [],
    loading: true,
    error: '',
    keyword: '',
    showmodal: false,
    dialogTitle: '添加用户',
    isAddDialog: true,
    canAdministerUsers,
    userModel: createUserModel(),
    userSwitch: makeSwitchOptions(canAdministerUsers),
    auditSwitch: {
      name: 'comment_audit',
      activeValue: 1,
      inactiveValue: 0,
      activeColor: '#13ce66',
      inactiveColor: '#f56c6c',
      disabled: !canAdministerUsers
    },
    mutedSwitch: {
      name: 'comment_ban',
      activeValue: true,
      inactiveValue: false,
      activeColor: '#13ce66',
      inactiveColor: '#f56c6c',
      disabled: !canAdministerUsers
    },
    disabledSwitch: {
      name: 'is_show', activeValue: 0, inactiveValue: 1,
      activeColor: '#13ce66', inactiveColor: '#f56c6c', disabled: !canAdministerUsers
    }
  });

  const { loadList, searchList, debouncedSearch } = usePage({
    state,
    self,
    url: '/role_list',
    field: 'sid',
    sort: 'asc',
    params: () => ({ keyword: state.keyword }),
    tableKey: 'userTable',
    table: { maxHeight: 480 },
    pageKey: 'userPage',
    transform(list) {
      return (list || []).map(function (row) {
        return {
          ...row,
          role_text: ROLE_TEXT[String(row.role)] || `未知(${row.role})`,
          role_auth_text: Number(row.role_auth) === 1 ? '编辑' : '查看',
          deletable: Number(row.role) !== 1,
          muted: Number(row.comment_ban) === 1,
          nickname_editable: !row.issue_time || new Date(String(row.issue_time).replace(' ', 'T')).getTime() <= Date.now() - 365 * 24 * 60 * 60 * 1000,
          can_edit: canAdministerUsers || String(row.name || '') === currentUserName
        };
      });
    }
  });
  function addRow() {
    if (!canAdministerUsers) return;
    state.isAddDialog = true;
    state.userModel = createUserModel();
    state.dialogTitle = '添加用户';
    state.showmodal = true;
  }

  function editRow(index, list) {
    const row = list[index];
    if (!row) return false;
    if (!canAdministerUsers && String(row.name || '') !== currentUserName) {
      $msg({ content: '只能修改自己的密码', type: 'error' });
      return false;
    }
    state.isAddDialog = false;
    const model = createUserModel();
    assignOptionFields(model, row);
    model.id = row.id;
    model.role = Number(row.role == null ? 2 : row.role);
    model.role_auth = Number(deriveRoleAuth(row.role));
    state.userModel = model;
    state.dialogTitle = canAdministerUsers ? '修改密码' : '修改用户';
    state.showmodal = true;
    return false;
  }

  function closeDialog() { state.showmodal = false; }

  async function applyForcedLogout(res) {
    if (!res || !res.data || !res.data.logout) return false;
    try {
      await AUTH.logout();
    } catch (error) {
      console.warn('[users] logout after password change failed:', error);
    }
    navigateTo('/login');
    return true;
  }

  async function saveEdit() {
    const userForm = $refs.form;
    if (!userForm) return;
    if (!userForm.validate()) return;
    const form = userForm.values;
    const isAdd = !form.id;
    if (!canAdministerUsers) {
      await request({
        url: '/role_update',
        type: 'POST',
        data: { id: form.id, old_password: form.old_password, new_password: form.new_password },
        async success(res) {
          if (res.status !== 1) {
            $msg({ content: res.msg, type: 'error' });
            return;
          }
          state.showmodal = false;
          $msg({ content: res.msg, type: 'success' });
          await applyForcedLogout(res);
        },
        fail: makeFail($msg)
      });
      return;
    }
    const data = isAdd
      ? {
        sid: form.sid,
        name: String(form.name).trim(),
        role: form.role,
        role_auth: deriveRoleAuth(form.role),
        is_show: form.is_show
      }
      : { id: form.id };
    if (!isAdd && !String(form.password || '').trim()) {
      $msg({ content: '请填写新密码', type: 'error' });
      return;
    }
    if (isAdd || String(form.password || '').trim()) {
      data.password = form.password;
      if (!isAdd) data.old_password = form.old_password;
    }
    await request({
      url: isAdd ? '/role_add' : '/role_update',
      type: 'POST',
      data,
      async success(res) {
        if (res.status !== 1) {
          $msg({ content: res.msg, type: 'error' });
          return;
        }
        state.showmodal = false;
        $msg({ content: res.msg, type: 'success' });
        if (await applyForcedLogout(res)) return;
        if (isAdd) {
          await loadList(1);
        } else {
          const updated = state.list.find(function (item) { return Number(item?.id) === Number(form.id); });
          if (updated) {
            Object.assign(updated, {
              name: data.name ?? updated.name,
              role: data.role ?? updated.role,
              role_auth: data.role_auth ?? updated.role_auth,
              is_show: data.is_show ?? updated.is_show
            });
            state.userTable = { ...state.userTable, data: state.list };
          }
        }
      },
      fail: makeFail($msg)
    });
  }

  async function updateRoleField(row, patch) {
    return actions.updateRow('/role_update', row, patch);
  }

  async function updateMuted(index, list, value) {
    const row = list[index];
    if (!row) return false;
    const saved = await updateRoleField(row, { comment_ban: Number(value) ? 1 : 0 });
    if (saved) row.muted = Boolean(value);
    return saved;
  }

  async function updateDisabled(index, list, value) {
    const row = list[index];
    if (!row) return false;
    const isShow = Number(value) === 0 ? 0 : 1;
    const saved = await updateRoleField(row, { is_show: isShow });
    if (saved) row.is_show = isShow;
    return saved;
  }

  async function updateRoleAuth(index, list, value) {
    const row = list[index];
    if (!row) return false;
    const saved = await updateRoleField(row, { role_auth: Number(value) });
    return saved;
  }

  async function updateNickname(index, list, value) {
    const row = list[index];
    if (!row) return false;
    const saved = await updateRoleField(row, { nickname: String(value ?? '').trim() });
    return saved;
  }

  async function updateCommentAudit(index, list, value) {
    const row = list[index];
    if (!row) return false;
    const saved = await updateRoleField(row, { comment_audit: Number(value) ? 1 : 0 });
    return saved;
  }

  async function updateSort(index, list, value) {
    const row = list && list[index];
    if (!row) return false;
    const saved = await updateRoleField(row, { sid: Math.max(0, Number(value) || 0) });
    if (saved) {
      loadList(state.currentPage, { silent: true });
    }
    return saved;
  }

  const deleteRowBase = createRowDeleteHandler({
    self,
    state,
    loadList,
    url: '/role_delete',
    confirmMessage: (row) => `确定删除用户“${row.name}”吗？`,
    gate: () => canAdministerUsers,
    getSuccessMessage: (res) => res.msg,
    reloadOnSuccess: false,
    onSuccess(row) {
      state.list = (state.list || []).filter(function (item) {
        return Number(item?.id) !== Number(row?.id);
      });
      state.total = Math.max(0, Number(state.total || 0) - 1);
      state.userTable = { ...state.userTable, data: state.list };
      state.userPage = { ...state.userPage, total: state.total };
    }
  });

  function deleteRow(index, list) {
    const row = (list || [])[index];
    if (row && Number(row.role) === 1) {
      $msg({ content: 'admin 超级账号不可删除', type: 'error' });
      return false;
    }
    return deleteRowBase(index, list);
  }

  function goBack() {
    navigateTo('/admin');
  }

  // 登录态判定统一走 requireLogin（后端会话为准，禁自造谓词 + 手写路由跳转）。
  onMounted(function () {
    if (!requireLogin(AUTH, { $msg, navigateTo })) return;
    loadList(1);
  });

  return { state, searchList, debouncedSearch, addRow, editRow, closeDialog, saveEdit, updateMuted, updateDisabled, updateRoleAuth, updateNickname, updateCommentAudit, updateSort, deleteRow, goBack };
});

export default userController;