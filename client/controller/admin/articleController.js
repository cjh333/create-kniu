import MVVM from '../../core/kniumvvm.mjs';
import UI from '../../core/kniuui.js';
import { assignModelFields, buildMultipartFormData, formatLocalDateTime, getLocalDateParts, toSingleFileList } from '../../core/kniuutil.mjs';

const { controller } = MVVM;
const { makeSwitchOptions, useListPage } = UI;
const articleController = controller(({ $msg, $refs, navigateTo, request, reactive, onMounted }) => {
  const self = { $msg, $refs, navigateTo };
  const canEditContent = true;
  const today = getLocalDateParts();
  const state = reactive({
    canEditContent,
    list: [],
    loading: true,
    error: '',
    keyword: '',
    showmodal: false,
    dialogTitle: '修改文章',
    files: [],
    editform: {
      id: '',
      sid: '',
      title: '',
      subtitle: '',
      summary: '',
      url: '',
      create_time: '',
      content: '',
      content_mode: 'rich',
      is_show: '1',
      cover: ''
    },
    articleTable: {
      data: [],
      rowKey: 'id',
      stripe: true,
      border: true,
      maxHeight: 480,
      loading: true
    },
    articlePage: {
      layout: '总数,首页,上一页,页码,下一页,末页,条数',
      currentPage: 1,
      pageSize: 10,
      total: 0,
      background: true,
      onCurrentChange: (detail) => changePage({ detail }),
      onSizeChange: (detail) => changePageSize({ detail })
    },
    switchOptions: makeSwitchOptions(canEditContent),
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

  const { loadList, changePage, changePageSize, searchList, debouncedSearch, deleteRow } = useListPage({
    state,
    self,
    url: '/article_list',
    field: 'sid',
    sort: 'asc',
    params: () => ({ keyword: state.keyword }),
    tableKey: 'articleTable',
    pageKey: 'articlePage',
    deleteUrl: '/article_delete'
  });

  async function updateShow(index, list, value) {
    const row = list[index];
    if (!row) return;
    await request({
      url: '/article_update',
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

  function editRow(index, list) {
    const row = list[index];
    if (!row) return false;
    assignModelFields(state.editform, row);
    state.editform.content_mode = row.content_mode === 'markdown' ? 'markdown' : 'rich';
    state.files = toSingleFileList(row.cover);
    state.dialogTitle = '修改文章';
    state.showmodal = true;
    return false;
  }

  function addRow() {
    const form = state.editform;
    Object.keys(form).forEach(function (field) {
      form[field] = '';
    });
    form.is_show = '1';
    form.content_mode = 'rich';
    form.sid = '0';
    form.create_time = formatLocalDateTime();
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
    const form = state.editform;
    const editor = self.$refs.editor;
    if (editor) form.content_mode = editor.mode === 'markdown' ? 'markdown' : 'rich';
    if (!String(form.title || '').trim()) {
      self.$msg({ content: '请输入标题', type: 'error' });
      return;
    }
    const isAdd = !form.id;
    const data = buildMultipartFormData(form, {
      fileField: 'cover',
      files: state.files
    });
    await request({
      url: isAdd ? '/article_add' : '/article_update',
      type: 'POST',
      data: data,
      async success(res) {
        if (res.status !== 1) {
          self.$msg({ content: res.msg, type: 'error' });
          return;
        }
        state.showmodal = false;
        state.files = [];
        await loadList(isAdd ? 1 : state.articlePage.currentPage);
        self.$msg({ content: res.msg, type: 'success' });
      },
      fail(res) { self.$msg({ content: res.msg, type: 'error' }); }
    });
  }

  function goBack() {
    self.navigateTo('/admin');
  }

  onMounted(function () {
    loadList(1);
  });
  return { state, changePage, changePageSize, searchList, debouncedSearch, updateShow, deleteRow, editRow, addRow, closeDialog, saveEdit, goBack };
});

export default articleController;
