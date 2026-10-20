import MVVM from '../../core/kniumvvm.mjs';
import UI from '../../core/kniuui/kniuui.mjs';
import AUTH from '../../core/kniuauth.mjs';
import { createRequestActions } from '../../core/kniupage.mjs';
import { adminTableMaxHeight, createSortUpdateHandler, isAdminRole, requireLogin } from './adminShared.js';
import { assignOptionFields, buildMultipartFormData, formatLocalDateTime, getLocalDateParts, optionsToValues, required, toSingleFileList } from '../../core/kniuutil.mjs';

const { controller } = MVVM;
const { makeSwitchOptions, usePage } = UI;

const articleController = controller(({ $confirm, $msg, $refs, navigateTo, request, reactive, onMounted }) => {
  const self = { $confirm, $msg };
  const canEditContent = true;
  const canRecommend = isAdminRole(AUTH.getUser());
  const actions = createRequestActions({ request, msg: $msg });
  const today = getLocalDateParts();
  function createArticleModel() {
    return {
      id: '',
      sid: '0',
      title: required('请输入标题'),
      subtitle: '',
      summary: '',
      url: '',
      create_time: '',
      content: '',
      is_show: '1',
      is_recommend: '0',
      cover: ''
    };
  }
  const state = reactive({
    canEditContent,
    canRecommend,
    list: [],
    loading: true,
    error: '',
    keyword: '',
    showmodal: false,
    dialogTitle: '修改文章',
    files: [],
    editform: createArticleModel(),
    switchOption: makeSwitchOptions(canEditContent),
    // 「推荐」列必须独立配置：makeSwitchOptions 生成的 name 恒为 is_show，
    // 与 switchOption 共用会让推荐开关把值写进 is_show 字段。
    recommendSwitch: makeSwitchOptions(canRecommend),
    datePickerOptions: {
      type: 'datetime',
      range: false,
      value: today.year + '-' + today.month + '-' + today.date,
      format: 'yyyy-mm-dd hh:mm:ss',
      mark: {
        '0-6-1': '儿童',
        '0-7-1': '建党',
        '0-8-1': '建军',
        '0-9-10': '教师'
      }
    }
  });

  const { loadList, searchList, debouncedSearch, deleteRow } = usePage({
    state,
    self,
    url: '/article_list',
    field: 'sid',
    sort: 'asc',
    params: () => ({
      keyword: state.keyword
    }),
    tableKey: 'articleTable',
    table: {
      maxHeight: adminTableMaxHeight()
    },
    pageKey: 'articlePage',
    deleteUrl: '/article_delete'
  });

  // 开关列回调必须回传保存结果：框架只在显式 false 时回滚（kniuui.mjs switch 列判定），
  // 不返回值会被判为「已保存」，请求失败时开关停在错误状态。
  async function updateShow(index, list, value) {
    const row = list[index];
    if (!row) return false;
    return await actions.updateRow('/article_update', row, { is_show: value });
  }

  const updateSort = createSortUpdateHandler({
    actions,
    url: '/article_update',
    reload: () => loadList(state.currentPage, { silent: true })
  });

  async function updateRecommend(index, list, value) {
    const row = list[index];
    if (!row) return false;
    return await actions.updateRow('/article_update', row, { is_recommend: value });
  }

  function editRow(index, list) {
    const row = list[index];
    if (!row) return false;
    assignOptionFields(state.editform, row);
    state.editform.content = '';
    state.files = toSingleFileList(row.cover);
    state.dialogTitle = '修改文章';
    state.showmodal = true;
    loadArticleContent(row.id);
    return false;
  }

  async function loadArticleContent(id) {
    const res = await request({ url: '/article_detail', type: 'POST', mutation: false, data: { id } });
    if (res.status !== 1) {
      $msg({ content: res.msg || '读取正文失败', type: 'error' });
      if (Number(state.editform.id) === Number(id)) state.editform.content = '';
      return;
    }
    if (Number(state.editform.id) === Number(id)) state.editform.content = res.data?.content || '';
  }

  function addRow() {
    state.editform = createArticleModel();
    state.editform.create_time = formatLocalDateTime();
    state.files = [];
    state.dialogTitle = '添加文章';
    state.showmodal = true;
    return false;
  }

  function closeDialog() {
    state.showmodal = false;
    state.files = [];
  }

  async function saveEdit() {
    if (!$refs.form || !$refs.form.validate()) return;
    const form = optionsToValues(state.editform);
    const isAdd = !form.id;
    const payload = { ...form };
    delete payload.is_show;
    delete payload.is_recommend;
    const data = buildMultipartFormData(payload, {
      fileField: 'cover',
      files: state.files
    });
    await actions.post(isAdd ? '/article_add' : '/article_update', data, {
      onOk: async function () {
        state.showmodal = false;
        state.files = [];
        await loadList(isAdd ? 1 : state.articlePage.currentPage);
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

  return { state, searchList, debouncedSearch, updateShow, updateRecommend, updateSort, deleteRow, editRow, addRow, closeDialog, saveEdit, goBack };
});

export default articleController;