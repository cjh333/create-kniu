import KniuMvvm from '../../core/kniumvvm.mjs';
import KniuUI from '../../core/kniuui.js';
import REQUEST from '../../core/kniurequest.mjs';
import AUTH from '../../core/kniuauth.mjs';
import { assignOptionFields, debounce } from '../../core/kniuutil.mjs';

const { controller, onMounted, reactive } = KniuMvvm;
const { usePagination } = KniuUI;
const ROLE_TEXT = { '1': '管理员', '2': '普通用户' };

function deriveRoleAuth(role) {
  return String(role) === '1' ? '1' : '2';
}

function canAccessUsers(user) {
  return !!String(user?.name || '').trim();
}

const usersController = controller(function () {
  const self = this;
  const currentUser = AUTH.getUser() || {};
  const currentUserName = String(currentUser.name || '');
  const canAdministerUsers = Number(currentUser.roleId || currentUser.role || 0) === 1 || Number(currentUser.roleAuth || 0) === 1;
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
        message: '您未填写密码或密码格式不正确'
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
        message: '您未填写新密码或新密码格式不正确'
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
    userTable: {
      data: [],
      rowKey: 'id',
      stripe: true,
      border: true,
      maxHeight: 480,
      loading: true,
      cols: [
        {
          type: 'checkbox',
          width: 60,
          align: 'center',
          fixed: 'left'
        },
        {
          field: 'id',
          label: 'ID',
          width: 80,
          align: 'center',
          fixed: 'left',
          sortable: true
        },
        {
          field: 'sid',
          label: '排序',
          fixed: 'left',
          width: 100,
          align: 'center',
          editable: canAdministerUsers ? 'number' : false,
          sortable: true
        },
        {
          field: 'name',
          label: '用户名',
          showOverflowTooltip: true
        },
        {
          field: 'role_text',
          label: '角色',
          width: 120,
          align: 'center',
          tag: {
            options: {
              round: true,
              type: row => row.role_text === '管理员' ? 'success' : 'primary'
            }
          }
        },
        {
          field: 'role_auth_text',
          label: '权限',
          width: 100,
          align: 'center',
          status: {
            options: {
              type: row => row.role_auth_text === '编辑' ? 'success' : 'primary'
            }
          }
        },
        {
          field: 'is_show',
          label: '显示',
          width: 90,
          align: 'center',
          condition: canAdministerUsers,
          switch: {
            options: null,
            onChange: updateShow
          }
        },
        {
          field: 'create_time',
          label: '创建时间',
          width: 180,
          align: 'center'
        },
        {
          label: '操作',
          width: 120,
          align: 'center',
          fixed: 'right',
          actions: [
            {
              title: '删除',
              type: 'danger',
              size: 'small',
              link: true,
              condition: () => canAdministerUsers,
              onClick: ({ index, rows }) => deleteRow(index, rows)
            },
            {
              title: row => canAdministerUsers ? '修改' : '修改密码',
              type: 'primary',
              size: 'small',
              link: true,
              condition: row => canAdministerUsers || row.can_edit,
              onClick: ({ index, rows }) => editRow(index, rows)
            }
          ]
        }
      ]
    },
    userModel: createUserModel(),
    userSwitch: {
      name: 'is_show',
      activeValue: 1,
      activeColor: '#13ce66',
      inactiveValue: 0,
      inactiveColor: '#ff4949',
      disabled: !canAdministerUsers
    },
    userPage: {
      layout: '总数,首页,上一页,页码,下一页,末页,条数',
      currentPage: 1,
      pageSize: 10,
      total: 0,
      background: true,
      onCurrentChange: (detail) => changePage({ detail }),
      onSizeChange: (detail) => changePageSize({ detail })
    }
  });
  state.userTable.cols[6].switch.options = state.userSwitch;

  const { loadList, changePage, changePageSize } = usePagination({
    state,
    self,
    url: '/role_list',
    field: 'sid',
    sort: 'asc',
    params: () => ({ keyword: state.keyword }),
    tableKey: 'userTable',
    pageKey: 'userPage',
    transform(list) {
      return (list || []).map(function (row) {
        return {
          ...row,
          role_text: ROLE_TEXT[String(row.role)] || `未知(${row.role})`,
          role_auth_text: Number(row.role_auth) === 1 ? '编辑' : '查看',
          can_edit: canAdministerUsers || String(row.name || '') === currentUserName
        };
      });
    }
  });

  function searchList() { loadList(1); }
  const debouncedSearch = debounce(searchList, 250);

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
      self.$msg({ content: '只能修改自己的密码', type: 'error' });
      return false;
    }
    state.isAddDialog = false;
    const model = createUserModel();
    assignOptionFields(model, row);
    model.role = Number(row.role == null ? 2 : row.role);
    model.role_auth = Number(deriveRoleAuth(row.role));
    model.is_show = Number(row.is_show == null ? 1 : row.is_show);
    state.userModel = model;
    state.dialogTitle = canAdministerUsers ? '修改用户' : '修改密码';
    state.showmodal = true;
    return false;
  }

  function onRoleChange(event) {
    const role = String(event?.detail ?? event?.target?.value ?? state.userModel.role ?? '');
    state.userModel.role = role;
    state.userModel.role_auth = deriveRoleAuth(role);
  }

  function closeDialog() { state.showmodal = false; }

  async function saveEdit() {
    const userForm = self.$refs.userform;
    if (!userForm) return;
    if (!userForm.validate()) return;
    const form = userForm.values;
    const isAdd = !form.id;
    if (!canAdministerUsers) {
      await REQUEST({
        url: '/role_update',
        type: 'POST',
        data: { id: form.id, old_password: form.old_password, new_password: form.new_password },
        async success(res) {
          if (res.status !== 1) {
            self.$msg({ content: res.msg, type: 'error' });
            return;
          }
          state.showmodal = false;
          self.$msg({ content: res.msg, type: 'success' });
          try {
            await AUTH.logout();
          } catch (error) {
            console.warn('[users] logout after password change failed:', error);
          }
          self.navigateTo('/login');
        },
        fail(res) { self.$msg({ content: res.msg, type: 'error' }); }
      });
      return;
    }
    const data = {
      sid: form.sid,
      name: String(form.name).trim(),
      role: form.role,
      role_auth: deriveRoleAuth(form.role),
      is_show: form.is_show
    };
    if (!isAdd) data.id = form.id;
    if (isAdd || String(form.password || '').trim()) {
      data.password = form.password;
      if (!isAdd) data.old_password = form.old_password;
    }
    await REQUEST({
      url: isAdd ? '/role_add' : '/role_update',
      type: 'POST',
      data,
      async success(res) {
        if (res.status !== 1) {
          self.$msg({ content: res.msg, type: 'error' });
          return;
        }
        state.showmodal = false;
        self.$msg({ content: res.msg, type: 'success' });
        await loadList(isAdd ? 1 : state.currentPage);
      },
      fail(res) { self.$msg({ content: res.msg, type: 'error' }); }
    });
  }

  async function updateShow(index, list, value) {
    const row = list[index];
    if (!row) return false;
    let saved = false;
    await REQUEST({
      url: '/role_update',
      type: 'POST',
      data: { id: row.id, is_show: value },
      success(res) {
        saved = res.status === 1;
        self.$msg({ content: res.msg, type: saved ? 'success' : 'error' });
      },
      fail(res) { self.$msg({ content: res.msg, type: 'error' }); }
    });
    return saved;
  }

  async function deleteRow(index, list) {
    if (!canAdministerUsers) return false;
    const row = list[index];
    if (!row) return false;
    const confirmed = await self.$confirm(`确定删除用户“${row.name}”吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }).then(function () { return true; }).catch(function () { return false; });
    if (!confirmed) return false;
    await REQUEST({
      url: '/role_delete',
      type: 'POST',
      data: { id: row.id },
      async success(res) {
        if (res.status !== 1) {
          self.$msg({ content: res.msg, type: 'error' });
          return;
        }
        self.$msg({ content: res.msg, type: 'success' });
        await loadList(state.currentPage);
      },
      fail(res) { self.$msg({ content: res.msg, type: 'error' }); }
    });
    return false;
  }

  onMounted(function () {
    if (!canAccessUsers(AUTH.getUser())) {
      self.$msg({ content: '权限不足', type: 'error' });
      self.navigateTo('/admin');
      return;
    }
    loadList(1);
  });

  return { state, changePage, changePageSize, searchList, debouncedSearch, addRow, editRow, closeDialog, saveEdit, updateShow, deleteRow, onRoleChange };
});

export default usersController;
