import KniuMvvm from '../core/kniumvvm.mjs';
import KniuUI from '../core/kniuui.js';
import REQUEST from '../core/kniurequest.mjs';
import { assignModelFields, buildMultipartFormData, toSingleFileList } from '../core/kniuutil.mjs';

const { controller, onMounted, reactive } = KniuMvvm;
const { usePagination, paginationState } = KniuUI;

const articledetailController = controller(function () {
    const self = this;
    const state = reactive({
      list: [],
      loading: true,
      error: '',
      showmodal: false,
      files: [],
      editForm: {
        id: '',
        sid: '',
        title: '',
        subtitle: '',
        summary: '',
        url: '',
        content: '',
        is_show: '1',
        cover: ''
      },
      toolbar: 'code | undo redo | bold italic underline strikeThrough | justifyLeft justifyCenter justifyRight justifyFull | insertOrderedList insertUnorderedList | h1 h2 h3 p | blockquote pre hr table | fontname fontsize forecolor hilitecolor | link unlink image media emoticons | removeFormat clearhtml selectAll | maximize',
      ...paginationState()
    });

    const { loadList, changePage, prevPage, nextPage, changePageSize } = usePagination({
      state,
      self,
      url: '/article_list',
      field: 'sid',
      sort: 'asc'
    });

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
      assignModelFields(state.editForm, row);
      state.files = toSingleFileList(row.cover);
      state.showmodal = true;
      return false;
    }

    function closeDialog() {
      state.showmodal = false;
      state.files = [];
    }

    async function saveEdit() {
      const form = state.editForm;
      if (!form.id) return;
      const data = buildMultipartFormData(form, {
        fileField: 'cover',
        files: state.files
      });
      await REQUEST({
        url: '/article_update',
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
          await loadList(state.currentPage);
        },
        fail(res) { self.$msg({ content: res.msg, type: 'error' }); }
      });
    }

    function goBack() {
      self.navigateTo('/nav');
    }

    onMounted(function () { loadList(1); });
    return { state, changePage, prevPage, nextPage, changePageSize, updateShow, deleteRow, editRow, closeDialog, saveEdit, goBack };
});

export default articledetailController;
