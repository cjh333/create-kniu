import MVVM from '../../core/kniumvvm.mjs';
import UI from '../../core/kniuui/kniuui.mjs';
import AUTH from '../../core/kniuauth.mjs';

const { controller } = MVVM;
const { makeSwitchOptions, useListPage } = UI;

function createCommentManagementController(managementType = 'comment') {
  return controller(({ $confirm, $msg, eventTo, navigateTo, request, reactive, onMounted }) => {
    const self = { $confirm, $msg, navigateTo };
    const canEditContent = Number(AUTH.getUser()?.roleId || AUTH.getUser()?.role || 0) === 1 || Number(AUTH.getUser()?.roleAuth || 0) === 1;
    const state = reactive({
      canEditContent,
      list: [],
      loading: true,
      error: '',
      keyword: '',
      pageTitle: managementType === 'reply' ? '回复管理' : '评论管理',
      type: managementType,
      audit: '',
      commentTable: {
        data: [],
        rowKey: 'id',
        stripe: true,
        border: true,
        maxHeight: innerHeight - 220 / 1920 * innerWidth,
        loading: true
      },
      commentPage: {
        currentPage: 1,
        pageSize: 20,
        total: 0,
        background: true,
        onCurrentChange: (detail) => changePage({ detail }),
        onSizeChange: (detail) => changePageSize({ detail })
      },
      switchOptions: makeSwitchOptions(canEditContent),
      auditOptions: [
        { label: '全部状态', value: '' },
        { label: '待审核', value: '0' },
        { label: '已通过', value: '1' }
      ]
    });

    const { loadList, changePage, changePageSize, searchList, debouncedSearch, deleteRow } = useListPage({
      state,
      self,
      url: '/comment_list',
      field: 'sid',
      sort: 'asc',
    params: () => ({ keyword: state.keyword, type: state.type, audit: state.audit }),
    tableKey: 'commentTable',
    pageKey: 'commentPage',
    deleteUrl: '/comment_delete',
    deleteMessage: (row) => Number(row.parent_id) === 0
      ? '此操作将永久删除该评论及其全部回复, 是否继续?'
      : '此操作将永久删除该回复, 是否继续?'
    });

    function onFilterChange() {
      loadList(1);
    }

    async function toggleAudit(index, list, value) {
      const row = list[index];
      if (!row) return;
      await auditRequest(row.id, value);
    }

    async function toggleReadState(index, list, value) {
      const row = list[index];
      if (!row) return;
      let saved = false;
      await request({
        url: '/comment_reply_update',
        type: 'POST',
          data: { id: row.id, is_read: Number(value) === 1 ? 1 : 0 },
        success(res) {
          if (res.status !== 1) {
            self.$msg({ content: res.msg, type: 'error' });
            return;
          }
          saved = true;
          row.is_read = Number(value) === 1 ? 1 : 0;
          self.$msg({ content: res.msg, type: 'success' });
          eventTo?.emit('reply:notification-change');
        },
        fail(res) {
          self.$msg({ content: res.msg, type: 'error' });
        }
      });
      return saved;
    }

    async function auditRequest(id, audit) {
      await request({
        url: '/comment_audit',
        type: 'POST',
          data: { id, audit },
        success(res) {
          if (res.status !== 1) {
            self.$msg({ content: res.msg, type: 'error' });
            return;
          }
          self.$msg({ content: res.msg, type: 'success' });
        },
        fail(res) { self.$msg({ content: res.msg, type: 'error' }); }
      });
    }

    async function updateSort(index, list, value) {
      const row = list[index];
      if (!row) return false;
      let saved = false;
      await request({
        url: '/comment_update',
        type: 'POST',
          data: { id: row.id, sid: Math.max(0, Number(value) || 0) },
        success(res) {
          saved = res.status === 1;
          self.$msg({ content: res.msg, type: saved ? 'success' : 'error' });
        },
        fail(res) { self.$msg({ content: res.msg, type: 'error' }); }
      });
      return saved;
    }

    function goBack() {
      self.navigateTo('/admin');
    }

    onMounted(function () { loadList(1); });
    return { state, changePage, changePageSize, searchList, debouncedSearch, onFilterChange, toggleAudit, toggleReadState, updateSort, deleteRow, goBack };
  });
}

const commentController = createCommentManagementController('comment');

export { createCommentManagementController };
export default commentController;
