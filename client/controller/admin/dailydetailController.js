import KniuMvvm from '../../core/kniumvvm.mjs';
import KniuUI from '../../core/kniuui.js';
import REQUEST from '../../core/kniurequest.mjs';
import AUTH from '../../core/kniuauth.mjs';
import { assignModelFields, updateListRecord, debounce } from '../../core/kniuutil.mjs';

const { controller, onMounted, reactive } = KniuMvvm;
const { usePagination } = KniuUI;

const dailydetailController = controller(function () {
  const self = this;
  const canEditContent = Number(AUTH.getUser()?.roleId || AUTH.getUser()?.role || 0) === 1 || Number(AUTH.getUser()?.roleAuth || 0) === 1;
  const state = reactive({
    canEditContent,
    list: [],
    loading: true,
    error: '',
    keyword: '',
    showmodal: false,
    editform: {
      id: '',
      sid: 0,
      cn: '',
      en: '',
      is_show: 1
    },
    dailyTable: {
      data: [],
      rowKey: 'id',
      stripe: true,
      border: true,
      maxHeight: innerHeight - 220 / 1920 * innerWidth,
      loading: true,
      cols: [
        {
          type: 'checkbox',
          width: 60,
          align: 'center',
          fixed: true
        },
        {
          field: 'id',
          label: 'ID',
          width: 80,
          align: 'center',
          fixed: true,
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
          field: 'cn',
          label: '中文',
          showOverflowTooltip: true
        },
        {
          field: 'en',
          label: '英文',
          showOverflowTooltip: true
        },
        {
          field: 'create_time',
          label: '发布时间',
          width: 160,
          align: 'center'
        },
        {
          field: 'is_show',
          label: '显示',
          width: 80,
          align: 'center',
          condition: canEditContent,
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
          condition: canEditContent,
          actions: [
            {
              title: '删除',
              type: 'danger',
              size: 'small',
              link: true,
              onClick: ({ index, rows }) => deleteRow(index, rows)
            },
            {
              title: '修改',
              type: 'primary',
              size: 'small',
              link: true,
              onClick: ({ index, rows }) => editRow(index, rows)
            }
          ]
        }
      ]
    },
    dailyPage: {
      layout: '上一页,首页,页码,末页,下一页,跳转,总数,条数',
      currentPage: 1,
      pageSize: 20,
      total: 0,
      background: true,
      onCurrentChange: (detail) => changePage({ detail }),
      onSizeChange: (detail) => changePageSize({ detail })
    },
    switchOptions: {
      name: 'is_show',
      activeValue: 1,
      inactiveValue: 0,
      activeColor: '#13ce66',
      inactiveColor: '#ff4949',
      disabled: !canEditContent
    }
  });
  state.dailyTable.cols[6].switch.options = state.switchOptions;

  const { loadList, changePage, changePageSize } = usePagination({
    state,
    self,
    url: '/daily_list',
    field: 'id',
    sort: 'asc',
    params: () => ({ keyword: state.keyword }),
    tableKey: 'dailyTable',
    pageKey: 'dailyPage'
  });

  function searchList() {
    loadList(1);
  }

  const debouncedSearch = debounce(searchList, 250);

  async function updateShow(index, list, value) {
    const row = list[index];
    if (!row) return;
    await REQUEST({
      url: '/daily_update',
      type: 'POST',
      data: { id: row.id, is_show: value },
      success(res) {
        if (res.status !== 1) {
          self.$msg({ content: res.msg, type: 'error' });
          return;
        }
        row.is_show = value;
        self.$msg({ content: res.msg, type: 'success' });
      },
      fail(res) { self.$msg({ content: res.msg, type: 'error' }); }
    });
  }

  async function deleteRow(index, list) {
    const row = list[index];
    if (!row) return false;
    const confirmed = await self.$confirm('此操作将永久删除该条数据, 是否继续?', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }).then(function () { return true; }).catch(function () { return false; });
    if (!confirmed) return false;
    await REQUEST({
      url: '/daily_delete',
      type: 'POST',
      data: { id: row.id },
      success(res) {
        if (res.status !== 1) {
          self.$msg({ content: res.msg, type: 'error' });
          return;
        }
        self.$msg({ content: '删除成功!', type: 'success' });
        loadList(state.currentPage);
      },
      fail(res) { self.$msg({ content: res.msg, type: 'error' }); }
    });
    return false;
  }

  function editRow(index, list) {
    const row = list[index];
    if (!row) return false;
    assignModelFields(state.editform, row);
    state.showmodal = true;
    return false;
  }

  function closeDialog() {
    state.showmodal = false;
  }

  async function saveEdit() {
    const form = state.editform;
    if (!form.id) return;
    await REQUEST({
      url: '/daily_update',
      type: 'POST',
      data: {
        id: form.id,
        sid: form.sid,
        cn: form.cn,
        en: form.en,
        is_show: form.is_show
      },
      success(res) {
        if (res.status !== 1) {
          self.$msg({ content: res.msg, type: 'error' });
          return;
        }
        state.list = updateListRecord(state.list, form);
        state.showmodal = false;
        self.$msg({ content: res.msg, type: 'success' });
      },
      fail(res) { self.$msg({ content: res.msg, type: 'error' }); }
    });
  }

  function goBack() {
    self.navigateTo('/nav');
  }

  onMounted(function () { loadList(1); });
  return { state, changePage, changePageSize, searchList, debouncedSearch, updateShow, deleteRow, editRow, closeDialog, saveEdit, goBack };
});

export default dailydetailController;