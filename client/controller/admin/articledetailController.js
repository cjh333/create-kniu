import KniuMvvm from '../../core/kniumvvm.mjs';
import KniuUI from '../../core/kniuui.js';
import REQUEST from '../../core/kniurequest.mjs';
import AUTH from '../../core/kniuauth.mjs';
import { assignModelFields, buildMultipartFormData, toSingleFileList, debounce } from '../../core/kniuutil.mjs';

const { controller, onMounted, reactive } = KniuMvvm;
const { usePagination } = KniuUI;

const articledetailController = controller(function () {
  const self = this;
  const canEditContent = Number(AUTH.getUser()?.roleId || AUTH.getUser()?.role || 0) === 1 || Number(AUTH.getUser()?.roleAuth || 0) === 1;
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
      is_show: '1',
      cover: ''
    },
    toolbar: 'code | undo redo | bold italic underline strikeThrough | justifyLeft justifyCenter justifyRight justifyFull | insertOrderedList insertUnorderedList | h1 h2 h3 p | blockquote pre hr table | fontname fontsize forecolor hilitecolor | link unlink image media emoticons | removeFormat clearhtml selectAll | maximize',
    articleTable: {
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
          width: 100,
          align: 'center',
          editable: 'number',
          sortable: true
        },
        {
          field: 'title',
          label: '标题',
          minWidth: 360,
          showOverflowTooltip: true
        },
        {
          field: 'cover',
          label: '封面',
          width: 180,
          align: 'center',
          image: {
            width: '60px',
            height: '60px',
            options: {
              fit: 'contain'
            }
          }
        },
        {
          field: 'subtitle',
          label: '副标题',
          minWidth: 360,
          showOverflowTooltip: true
        },
        {
          field: 'summary',
          label: '摘要',
          minWidth: 360,
          showOverflowTooltip: true
        },
        {
          field: 'likes',
          label: '点赞数',
          width: 100,
          align: 'center',
          sortable: true
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
              title: '编辑',
              type: 'primary',
              size: 'small',
              link: true,
              onClick: ({ index, rows }) => editRow(index, rows)
            }
          ]
        }
      ]
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
    switchOptions: {
      name: 'is_show',
      activeValue: 1,
      inactiveValue: 0,
      activeColor: '#13ce66',
      inactiveColor: '#ff4949',
      disabled: !canEditContent
    },
    datePickerOptions: {
      type: 'datetime',
      range: false,
      value: getToday().year + '-' + getToday().month + '-' + getToday().date,
      format: 'yyyy-mm-dd hh:mm',
      mark: {
        '0-6-1': '儿童',
        '0-7-1': '建党',
        '0-8-1': '建军',
        '0-9-10': '教师'
      }
    }
  });
  const articleShowColumn = state.articleTable.cols.find((column) => column.switch);
  if (articleShowColumn) articleShowColumn.switch.options = state.switchOptions;

  const { loadList, changePage, changePageSize } = usePagination({
    state,
    self,
    url: '/article_list',
    field: 'sid',
    sort: 'asc',
    params: () => ({ keyword: state.keyword }),
    tableKey: 'articleTable',
    pageKey: 'articlePage'
  });

  function searchList() {
    loadList(1);
  }

  const debouncedSearch = debounce(searchList, 250);

  async function updateShow(index, list, value) {
    const row = list[index];
    if (!row) return;
    await REQUEST({
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
      url: '/article_delete',
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
    form.sid = '0';
    const now = new Date();
    form.create_time = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString().slice(0, 19).replace('T', ' ');
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
    if (!String(form.title || '').trim()) {
      self.$msg({ content: '请输入标题', type: 'error' });
      return;
    }
    const isAdd = !form.id;
    const data = buildMultipartFormData(form, {
      fileField: 'cover',
      files: state.files
    });
    await REQUEST({
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
        self.$msg({ content: res.msg, type: 'success' });
        await loadList(isAdd ? 1 : state.currentPage);
      },
      fail(res) { self.$msg({ content: res.msg, type: 'error' }); }
    });
  }

  function goBack() {
    self.navigateTo('/nav');
  }

  // 获取当前日期和时间。
  function getToday() {
    var now = new Date();
    var addZero = function (num) {
      return num < 10 ? ('0' + num) : num;
    };
    return {
      year: now.getFullYear(),
      month: addZero(now.getMonth() + 1),
      date: addZero(now.getDate()),
      week: now.getDay(),
      hour: addZero(now.getHours()),
      minute: addZero(now.getMinutes()),
      second: addZero(now.getSeconds())
    };
  }

  onMounted(function () { loadList(1); });
  return { state, changePage, changePageSize, searchList, debouncedSearch, updateShow, deleteRow, editRow, addRow, closeDialog, saveEdit, goBack };
});

export default articledetailController;
