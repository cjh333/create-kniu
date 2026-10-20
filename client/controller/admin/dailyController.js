import MVVM from '../../core/kniumvvm.mjs';
import UI from '../../core/kniuui/kniuui.mjs';
import AUTH from '../../core/kniuauth.mjs';
import { createRequestActions } from '../../core/kniupage.mjs';
import { adminTableMaxHeight, createSortUpdateHandler, isAdminRole, requireLogin } from './adminShared.js';
import { assignOptionFields, optionsToValues, required, updateListRecord } from '../../core/kniuutil.mjs';

const { controller } = MVVM;
const { makeSwitchOptions, usePage } = UI;

const dailyController = controller(({ $confirm, $msg, $refs, navigateTo, request, reactive, onMounted }) => {
  const self = { $confirm, $msg };
  const canEditContent = isAdminRole(AUTH.getUser());
  const actions = createRequestActions({ request, msg: $msg });
  function createDailyModel() {
    return {
      id: '',
      sid: 0,
      cn: required('请输入中文'),
      en: required('请输入英文'),
      is_show: 1
    };
  }
  const state = reactive({
    canEditContent,
    list: [],
    loading: true,
    error: '',
    keyword: '',
    showmodal: false,
    editform: createDailyModel(),
    switchOption: makeSwitchOptions(canEditContent)
  });

  const { loadList, syncOptions, searchList, debouncedSearch, deleteRow } = usePage({
    state,
    self,
    url: '/daily_list',
    field: 'sid',
    sort: 'asc',
    params: () => ({ keyword: state.keyword }),
    tableKey: 'dailyTable',
    table: { maxHeight: adminTableMaxHeight() },
    pageKey: 'dailyPage',
    deleteUrl: '/daily_delete'
  });

  // 同 articleController.updateShow：回传保存结果，失败时开关回滚。
  async function updateShow(index, list, value) {
    const row = list[index];
    if (!row) return false;
    return await actions.updateRow('/daily_update', row, { is_show: value }, { onSaved: syncOptions });
  }

  const updateSort = createSortUpdateHandler({
    actions,
    url: '/daily_update',
    reload: () => loadList(state.currentPage, { silent: true })
  });

  function editRow(index, list) {
    const row = list[index];
    if (!row) return false;
    assignOptionFields(state.editform, row);
    state.showmodal = true;
    return false;
  }

  function closeDialog() {
    state.showmodal = false;
  }

  async function saveEdit() {
    const form = state.editform;
    if (!form.id) return;
    if (!$refs.form || !$refs.form.validate()) return;
    const values = optionsToValues(form);
    await actions.post('/daily_update', { id: values.id, sid: values.sid, cn: values.cn, en: values.en }, {
      onOk() {
        state.list = updateListRecord(state.list, values);
        syncOptions();
        state.showmodal = false;
      }
    });
  }

  function goBack() {
    navigateTo('/admin');
  }

  onMounted(function () {
    if (!requireLogin(AUTH, { $msg, navigateTo })) return;
    loadList(1);
  });
  return { state, searchList, debouncedSearch, updateShow, updateSort, deleteRow, editRow, closeDialog, saveEdit, goBack };
});

export default dailyController;