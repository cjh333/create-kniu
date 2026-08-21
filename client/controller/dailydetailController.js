import KniuMvvm from '../core/kniumvvm.mjs';
import KniuUI from '../core/kniuui.js';
import REQUEST from '../core/kniurequest.mjs';
import { assignModelFields, updateListRecord } from '../core/kniuutil.mjs';

const { controller, onMounted, reactive } = KniuMvvm;
const { usePagination, paginationState } = KniuUI;

const dailydetailController = controller(function () {
    const self = this;
    const state = reactive({
      list: [],
      loading: true,
      error: '',
      showmodal: false,
      editForm: { id: '', sid: '', cn: '', en: '', is_show: '1' },
      ...paginationState(15)
    });

    const { loadList, changePage, prevPage, nextPage, changePageSize } = usePagination({
      state,
      self,
      url: '/daily_list',
      field: 'id',
      sort: 'asc'
    });

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
      assignModelFields(state.editForm, row);
      state.showmodal = true;
      return false;
    }

    function closeDialog() {
      state.showmodal = false;
    }

    async function saveEdit() {
      const form = state.editForm;
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
    return { state, changePage, prevPage, nextPage, changePageSize, updateShow, deleteRow, editRow, closeDialog, saveEdit, goBack };
});

export default dailydetailController;
