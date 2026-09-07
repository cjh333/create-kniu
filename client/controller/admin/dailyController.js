import KniuMvvm from '../../core/kniumvvm.mjs';
import KniuUI from '../../core/kniuui.js';
import REQUEST from '../../core/kniurequest.mjs';
import AUTH from '../../core/kniuauth.mjs';
import { assignModelFields, updateListRecord } from '../../core/kniuutil.mjs';

const { controller, onMounted, reactive } = KniuMvvm;
const { usePagination, makeSwitchOptions, createSearchActions, createRowDeleteHandler } = KniuUI;

const dailyController = controller(function () {
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
    switchOptions: makeSwitchOptions(canEditContent)
  });
  state.dailyTable.cols[6].switch.options = state.switchOptions;

  const { loadList, changePage, changePageSize, syncOptions } = usePagination({
    state,
    self,
    url: '/daily_list',
    field: 'id',
    sort: 'asc',
    params: () => ({ keyword: state.keyword }),
    tableKey: 'dailyTable',
    pageKey: 'dailyPage'
  });

  const { searchList, debouncedSearch } = createSearchActions(loadList);

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
        // 原地改字段后 state.dailyTable 引用未变 → kniu-table setter 不触发；
        // 复用 usePagination 暴露的 syncOptions 把 state.list 推到 options 上即可。
        syncOptions();
        self.$msg({ content: res.msg, type: 'success' });
      },
      fail(res) { self.$msg({ content: res.msg, type: 'error' }); }
    });
  }

  const deleteRow = createRowDeleteHandler({
    self,
    state,
    loadList,
    url: '/daily_delete',
    confirmMessage: '此操作将永久删除该条数据, 是否继续?'
  });

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
        // 本地补丁后必须把新数组推到 options 上，否则 state.dailyTable.data
        // 仍指向旧数组，kniu-table setter 不触发、表不刷新。
        syncOptions();
        state.showmodal = false;
        self.$msg({ content: res.msg, type: 'success' });
      },
      fail(res) { self.$msg({ content: res.msg, type: 'error' }); }
    });
  }

  function goBack() {
    self.navigateTo('/admin');
  }

  onMounted(function () { loadList(1); });
  return { state, changePage, changePageSize, searchList, debouncedSearch, updateShow, deleteRow, editRow, closeDialog, saveEdit, goBack };
});

export default dailyController;