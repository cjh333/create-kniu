import MVVM from '../../core/kniumvvm.mjs';
import UI from '../../core/kniuui.js';
import REQUEST from '../../core/kniurequest.mjs';
import AUTH from '../../core/kniuauth.mjs';
import { assignModelFields, updateListRecord } from '../../core/kniuutil.mjs';

const { controller, onMounted, reactive } = MVVM;
const { usePagination, makeSwitchOptions, createSearchActions, createRowDeleteHandler } = UI;

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
