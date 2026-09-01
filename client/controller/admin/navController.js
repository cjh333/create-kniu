import KniuMvvm from '../../core/kniumvvm.mjs';
import REQUEST from '../../core/kniurequest.mjs';
import AUTH from '../../core/kniuauth.mjs';
import { getResponseRecords, removeListRecord } from '../../core/kniuutil.mjs';

const { controller, reactive, onMounted } = KniuMvvm;

const navController = controller(function ({ navigateTo }) {
  const self = this;
  function isAdmin() {
    return Number(AUTH.getUser()?.roleId || AUTH.getUser()?.role || 0) === 1 || Number(AUTH.getUser()?.roleAuth || 0) === 1;
  }

  const state = reactive({
    canEditContent: isAdmin(),
    list: [],
    loading: false,
    navTable: {
      data: [],
      rowKey: 'id',
      stripe: true,
      border: true,
      maxHeight: 480,
      loading: false,
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
          width: 100,
          align: 'center',
          editable: 'number',
          sortable: true
        },
        {
          field: 'name',
          label: '栏目名称'
        },
        {
          field: 'is_show',
          label: '显示',
          width: 90,
          align: 'center',
          switch: {
            options: null,
            onChange: updateShow
          }
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
              condition: (row) => row.can_edit,
              onClick: ({ index, rows }) => deleteRow(index, rows)
            },
            {
              title: '查看',
              type: 'primary',
              size: 'small',
              link: true,
              onClick: ({ index, rows }) => viewRow(index, rows)
            }
          ]
        }
      ]
    },
    switchOptions: {
      name: 'is_show',
      activeValue: 1,
      inactiveValue: 0,
      activeColor: '#13ce66',
      inactiveColor: '#ff4949',
      disabled: !isAdmin()
    }
  });
  state.navTable.cols[4].switch.options = state.switchOptions;

  async function loadTableData() {
    state.loading = true;
    state.navTable = { ...state.navTable, loading: true };
    try {
      await REQUEST({
        url: '/nav_list',
        type: 'POST',
        data: {
          page_current: 1,
          page_rows: 100,
          field: 'sid',
          sort: 'asc'
        },
        success(res) {
          if (res.status !== 1) {
            state.list = [];
            self.$msg({ content: res.msg, type: 'error' });
            return;
          }
          state.list = getResponseRecords(res.data).map(function (row) {
            return { ...row, can_edit: isAdmin() };
          });
          state.navTable = { ...state.navTable, data: state.list };
        },
        fail(res) {
          state.list = [];
          self.$msg({ content: res.msg, type: 'error' });
        }
      });
    } finally {
      state.loading = false;
      state.navTable = { ...state.navTable, loading: false };
    }
  }

  function deleteRow(index, list) {
    if (!state.canEditContent) return false;
    const row = list[index];
    if (!row) return false;
    self.$confirm('此操作将永久删除该文件, 是否继续?', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }).then(async () => {
      await REQUEST({
        url: '/nav_delete',
        type: 'POST',
        data: { id: row.id },
        success: (res) => {
          if (res.status !== 1) {
            self.$msg({ type: 'error', content: res.msg });
            return;
          }
          state.list = removeListRecord(state.list, row);
          self.$msg({ type: 'success', content: '删除成功!' });
        },
        fail: (res) => {
          self.$msg({ type: 'error', content: res.msg });
        }
      });
      return false;
    }).catch(() => {
      self.$msg({ type: 'info', content: '已取消删除' });
      return false;
    });
  }

  function viewRow(index, list) {
    const row = list[index];
    if (!row) return false;
    const text = ((row.name || '') + ' ' + (row.url || '')).toLowerCase();
    const target = /文章|article/.test(text) ? '/articledetail' : '/dailydetail';
    navigateTo(target);
    return false;
  }

  async function updateShow(index, list, value) {
    if (!state.canEditContent) return false;
    const row = list[index];
    if (!row) return false;
    let saved = false;
    await REQUEST({
      url: '/nav_update',
      type: 'POST',
      data: { id: row.id, is_show: value },
      success(res) {
        if (res.status !== 1) {
          self.$msg({ content: res.msg, type: 'error' });
          return;
        }
        saved = true;
        row.is_show = value;
        self.$msg({ content: res.msg, type: 'success' });
      },
      fail(res) { self.$msg({ content: res.msg, type: 'error' }); }
    });
    return saved;
  }

  onMounted(loadTableData);
  return { state, deleteRow, viewRow, updateShow };
});

export default navController;